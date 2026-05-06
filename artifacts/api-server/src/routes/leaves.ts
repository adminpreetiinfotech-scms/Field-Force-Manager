import {
  db,
  holidaysTable,
  leavesTable,
  staffTable,
} from "@workspace/db";
import {
  and,
  desc,
  eq,
  gte,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAdmin } from "./admin";
import { isValidUUID } from "../lib/validation";
import { sendPushSilent } from "../lib/push";

const router: IRouter = Router();

// ─── Leave balance config (per year) ────────────────────────────────────────
const LEAVE_QUOTA: Record<string, number> = {
  casual: 12,
  sick: 6,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getStaffByPhone(phone: string) {
  if (!phone?.trim()) return null;
  const [row] = await db
    .select({
      id: staffTable.id,
      companyId: staffTable.companyId,
      name: staffTable.name,
      empCode: staffTable.empCode,
      role: staffTable.role,
    })
    .from(staffTable)
    .where(
      and(
        eq(staffTable.phone, phone.trim()),
        isNull(staffTable.deletedAt),
        isNull(staffTable.disabledAt),
        eq(staffTable.approvalStatus, "approved"),
      ),
    )
    .limit(1);
  return row ?? null;
}

function countDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const diff = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

// ─── POST /api/leaves/apply ──────────────────────────────────────────────────
// Staff applies for leave

router.post("/leaves/apply", async (req, res, next) => {
  try {
    const phone =
      (req.headers["x-staff-phone"] as string | undefined) ??
      (req.headers["x-admin-phone"] as string | undefined);
    if (!phone) {
      res.status(401).json({ title: "Phone header required", status: 401 });
      return;
    }
    const staff = await getStaffByPhone(phone);
    if (!staff || !staff.companyId) {
      res.status(403).json({ title: "Staff not found", status: 403 });
      return;
    }

    const { leaveType, startDate, endDate, reason } = req.body as {
      leaveType?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
    };

    if (!leaveType || !startDate || !endDate) {
      res
        .status(400)
        .json({ title: "leaveType, startDate, endDate required", status: 400 });
      return;
    }

    if (!["casual", "sick", "other"].includes(leaveType)) {
      res.status(400).json({ title: "Invalid leaveType", status: 400 });
      return;
    }

    const totalDays = countDays(startDate, endDate);
    if (totalDays <= 0) {
      res.status(400).json({ title: "endDate must be >= startDate", status: 400 });
      return;
    }

    // Check balance for casual/sick (current calendar year)
    if (leaveType !== "other") {
      const yearStart = `${new Date().getFullYear()}-01-01`;
      const yearEnd = `${new Date().getFullYear()}-12-31`;
      const [used] = await db
        .select({ total: sql<number>`coalesce(sum(total_days),0)::int` })
        .from(leavesTable)
        .where(
          and(
            eq(leavesTable.staffId, staff.id),
            eq(leavesTable.leaveType, leaveType as "casual" | "sick"),
            eq(leavesTable.status, "approved"),
            gte(leavesTable.startDate, yearStart),
            lte(leavesTable.endDate, yearEnd),
          ),
        );
      const usedDays = used?.total ?? 0;
      const quota = LEAVE_QUOTA[leaveType] ?? 0;
      if (usedDays + totalDays > quota) {
        res.status(422).json({
          title: `Insufficient ${leaveType} leave balance`,
          usedDays,
          quota,
          requested: totalDays,
          status: 422,
        });
        return;
      }
    }

    const [leave] = await db
      .insert(leavesTable)
      .values({
        companyId: staff.companyId,
        staffId: staff.id,
        leaveType: leaveType as "casual" | "sick" | "other",
        startDate,
        endDate,
        totalDays,
        reason: reason?.trim() || null,
        status: "pending",
      })
      .returning();

    res.status(201).json({ leave });

    // Fire-and-forget push to company admins
    void (async () => {
      try {
        if (!staff.companyId) return;
        const admins = await db
          .select({ expoPushToken: staffTable.expoPushToken })
          .from(staffTable)
          .where(
            and(
              eq(staffTable.companyId, staff.companyId),
              eq(staffTable.role, "admin"),
              isNull(staffTable.deletedAt),
              isNull(staffTable.disabledAt),
            ),
          );
        await sendPushSilent(
          admins.map((a) => a.expoPushToken),
          "New Leave Request",
          `${staff.name} applied for ${leaveType} leave (${totalDays} day${totalDays > 1 ? "s" : ""}).`,
          { type: "leave_applied", leaveId: leave!.id },
        );
      } catch {
        /* push failure must not affect response */
      }
    })();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/leaves/my ──────────────────────────────────────────────────────
// Staff views own leave history

router.get("/leaves/my", async (req, res, next) => {
  try {
    const phone =
      (req.headers["x-staff-phone"] as string | undefined) ??
      (req.headers["x-admin-phone"] as string | undefined);
    if (!phone) {
      res.status(401).json({ title: "Phone header required", status: 401 });
      return;
    }
    const staff = await getStaffByPhone(phone);
    if (!staff) {
      res.status(403).json({ title: "Staff not found", status: 403 });
      return;
    }

    const year = (req.query.year as string) ?? String(new Date().getFullYear());
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const leaves = await db
      .select({
        id: leavesTable.id,
        leaveType: leavesTable.leaveType,
        startDate: leavesTable.startDate,
        endDate: leavesTable.endDate,
        totalDays: leavesTable.totalDays,
        reason: leavesTable.reason,
        status: leavesTable.status,
        rejectionReason: leavesTable.rejectionReason,
        reviewedAt: leavesTable.reviewedAt,
        createdAt: leavesTable.createdAt,
      })
      .from(leavesTable)
      .where(
        and(
          eq(leavesTable.staffId, staff.id),
          gte(leavesTable.startDate, yearStart),
          lte(leavesTable.endDate, yearEnd),
        ),
      )
      .orderBy(desc(leavesTable.createdAt));

    // Balance summary
    const balance: Record<string, { quota: number; used: number; available: number }> = {};
    for (const lt of ["casual", "sick"] as const) {
      const quota = LEAVE_QUOTA[lt] ?? 0;
      const used = leaves
        .filter((l) => l.leaveType === lt && l.status === "approved")
        .reduce((sum, l) => sum + (l.totalDays ?? 1), 0);
      balance[lt] = { quota, used, available: Math.max(0, quota - used) };
    }

    res.json({ leaves, balance, year });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/leaves/:id ───────────────────────────────────────────────────
// Staff cancels their own pending leave

router.delete("/leaves/:id", async (req, res, next) => {
  try {
    const phone =
      (req.headers["x-staff-phone"] as string | undefined) ??
      (req.headers["x-admin-phone"] as string | undefined);
    if (!phone) {
      res.status(401).json({ title: "Phone header required", status: 401 });
      return;
    }
    const id = String(req.params.id);
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "Invalid leave id", status: 400 });
      return;
    }
    const staff = await getStaffByPhone(phone);
    if (!staff) {
      res.status(403).json({ title: "Staff not found", status: 403 });
      return;
    }

    const [leave] = await db
      .select({ id: leavesTable.id, status: leavesTable.status, staffId: leavesTable.staffId })
      .from(leavesTable)
      .where(eq(leavesTable.id, id))
      .limit(1);

    if (!leave) {
      res.status(404).json({ title: "Leave not found", status: 404 });
      return;
    }
    if (leave.staffId !== staff.id) {
      res.status(403).json({ title: "Not your leave", status: 403 });
      return;
    }
    if (leave.status !== "pending") {
      res
        .status(409)
        .json({ title: "Only pending leaves can be cancelled", status: 409 });
      return;
    }

    await db.delete(leavesTable).where(eq(leavesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/leaves ────────────────────────────────────────────────────
// Admin views all leaves for company

router.get("/admin/leaves", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const status = (req.query.status as string | undefined) ?? "all";
    const year =
      (req.query.year as string | undefined) ?? String(new Date().getFullYear());

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const rows = await db
      .select({
        id: leavesTable.id,
        leaveType: leavesTable.leaveType,
        startDate: leavesTable.startDate,
        endDate: leavesTable.endDate,
        totalDays: leavesTable.totalDays,
        reason: leavesTable.reason,
        status: leavesTable.status,
        rejectionReason: leavesTable.rejectionReason,
        reviewedAt: leavesTable.reviewedAt,
        createdAt: leavesTable.createdAt,
        staffId: leavesTable.staffId,
        staffName: staffTable.name,
        staffEmpCode: staffTable.empCode,
        staffPhone: staffTable.phone,
      })
      .from(leavesTable)
      .innerJoin(staffTable, eq(leavesTable.staffId, staffTable.id))
      .where(
        and(
          companyId ? eq(leavesTable.companyId, companyId) : undefined,
          status !== "all"
            ? eq(leavesTable.status, status as "pending" | "approved" | "rejected")
            : undefined,
          gte(leavesTable.startDate, yearStart),
          lte(leavesTable.endDate, yearEnd),
        ),
      )
      .orderBy(desc(leavesTable.createdAt));

    res.json({ leaves: rows });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/leaves/:id ─────────────────────────────────────────────
// Admin approves or rejects leave

router.patch("/admin/leaves/:id", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const id = String(req.params.id);
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "Invalid leave id", status: 400 });
      return;
    }

    const { action, rejectionReason } = req.body as {
      action?: string;
      rejectionReason?: string;
    };

    if (!action || !["approve", "reject"].includes(action)) {
      res.status(400).json({ title: "action must be approve or reject", status: 400 });
      return;
    }

    const adminPhone =
      (req.headers["x-admin-phone"] as string | undefined) ??
      (req.query.adminPhone as string | undefined);

    const [admin] = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(eq(staffTable.phone, adminPhone!.trim()))
      .limit(1);

    const [leave] = await db
      .select({ id: leavesTable.id, companyId: leavesTable.companyId, status: leavesTable.status })
      .from(leavesTable)
      .where(eq(leavesTable.id, id))
      .limit(1);

    if (!leave) {
      res.status(404).json({ title: "Leave not found", status: 404 });
      return;
    }

    if (companyId && leave.companyId !== companyId) {
      res.status(403).json({ title: "Not your company's leave", status: 403 });
      return;
    }

    if (leave.status !== "pending") {
      res
        .status(409)
        .json({ title: "Leave already reviewed", status: 409 });
      return;
    }

    const [updated] = await db
      .update(leavesTable)
      .set({
        status: action === "approve" ? "approved" : "rejected",
        rejectionReason:
          action === "reject" ? (rejectionReason?.trim() || null) : null,
        reviewedBy: admin?.id ?? null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leavesTable.id, id))
      .returning();

    res.json({ leave: updated });

    // Fire-and-forget push to the staff member who applied
    void (async () => {
      try {
        if (!updated?.staffId) return;
        const [member] = await db
          .select({ expoPushToken: staffTable.expoPushToken })
          .from(staffTable)
          .where(eq(staffTable.id, updated.staffId))
          .limit(1);
        if (!member?.expoPushToken) return;
        const isApproved = action === "approve";
        await sendPushSilent(
          [member.expoPushToken],
          isApproved ? "Leave Approved ✓" : "Leave Rejected",
          isApproved
            ? "Your leave request has been approved."
            : `Your leave request was rejected.${updated.rejectionReason ? ` Reason: ${updated.rejectionReason}` : ""}`,
          { type: "leave_reviewed", leaveId: updated.id, status: updated.status },
        );
      } catch {
        /* push failure must not affect response */
      }
    })();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/leaves/balance/:staffId ──────────────────────────────────
// Admin checks leave balance for a specific staff

router.get(
  "/admin/leaves/balance/:staffId",
  requireAdmin,
  async (req, res, next) => {
    try {
      const staffId = String(req.params.staffId);
      if (!isValidUUID(staffId)) {
        res.status(400).json({ title: "Invalid staffId", status: 400 });
        return;
      }

      const year = String(new Date().getFullYear());
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const used = await db
        .select({
          leaveType: leavesTable.leaveType,
          total: sql<number>`coalesce(sum(total_days),0)::int`,
        })
        .from(leavesTable)
        .where(
          and(
            eq(leavesTable.staffId, staffId),
            eq(leavesTable.status, "approved"),
            gte(leavesTable.startDate, yearStart),
            lte(leavesTable.endDate, yearEnd),
          ),
        )
        .groupBy(leavesTable.leaveType);

      const balance: Record<string, { quota: number; used: number; available: number }> = {};
      for (const lt of ["casual", "sick"] as const) {
        const quota = LEAVE_QUOTA[lt] ?? 0;
        const usedDays = used.find((r) => r.leaveType === lt)?.total ?? 0;
        balance[lt] = { quota, used: usedDays, available: Math.max(0, quota - usedDays) };
      }

      res.json({ balance, year });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Holidays ─────────────────────────────────────────────────────────────────

// GET /api/holidays — public (staff sees their company's holidays)
router.get("/holidays", async (req, res, next) => {
  try {
    const phone =
      (req.headers["x-staff-phone"] as string | undefined) ??
      (req.headers["x-admin-phone"] as string | undefined);

    let companyId: string | null = null;
    if (phone) {
      const [row] = await db
        .select({ companyId: staffTable.companyId })
        .from(staffTable)
        .where(eq(staffTable.phone, phone.trim()))
        .limit(1);
      companyId = row?.companyId ?? null;
    }

    const year =
      (req.query.year as string | undefined) ?? String(new Date().getFullYear());
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const holidays = await db
      .select()
      .from(holidaysTable)
      .where(
        and(
          companyId ? eq(holidaysTable.companyId, companyId) : undefined,
          gte(holidaysTable.date, yearStart),
          lte(holidaysTable.date, yearEnd),
        ),
      )
      .orderBy(holidaysTable.date);

    res.json({ holidays, year });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/holidays — admin creates a holiday
router.post("/admin/holidays", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    if (!companyId) {
      res.status(403).json({ title: "Super admin must scope to a company", status: 403 });
      return;
    }

    const adminPhone = (req.headers["x-admin-phone"] as string | undefined);
    const [admin] = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(eq(staffTable.phone, adminPhone!.trim()))
      .limit(1);

    const { name, date, type, description } = req.body as {
      name?: string;
      date?: string;
      type?: string;
      description?: string;
    };

    if (!name?.trim() || !date) {
      res.status(400).json({ title: "name and date are required", status: 400 });
      return;
    }

    const [holiday] = await db
      .insert(holidaysTable)
      .values({
        companyId,
        name: name.trim(),
        date,
        type: (["national", "regional", "company"].includes(type ?? "")
          ? type
          : "company") as "national" | "regional" | "company",
        description: description?.trim() || null,
        createdBy: admin?.id ?? null,
      })
      .returning();

    res.status(201).json({ holiday });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/holidays/:id — admin deletes a holiday
router.delete("/admin/holidays/:id", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const id = String(req.params.id);
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "Invalid holiday id", status: 400 });
      return;
    }

    const [holiday] = await db
      .select({ id: holidaysTable.id, companyId: holidaysTable.companyId })
      .from(holidaysTable)
      .where(eq(holidaysTable.id, id))
      .limit(1);

    if (!holiday) {
      res.status(404).json({ title: "Holiday not found", status: 404 });
      return;
    }
    if (companyId && holiday.companyId !== companyId) {
      res.status(403).json({ title: "Not your company's holiday", status: 403 });
      return;
    }

    await db.delete(holidaysTable).where(eq(holidaysTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
