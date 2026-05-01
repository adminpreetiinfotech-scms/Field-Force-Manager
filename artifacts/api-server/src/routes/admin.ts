import {
  candidateAuditLogTable,
  candidatesTable,
  candidateNotificationsTable,
  db,
  staffTable,
} from "@workspace/db";
import { and, desc, eq, gte, ilike, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";

const router: IRouter = Router();

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function isAdminPhone(phone: string): Promise<boolean> {
  if (!phone?.trim()) return false;
  const [row] = await db
    .select({ role: staffTable.role, approvalStatus: staffTable.approvalStatus })
    .from(staffTable)
    .where(eq(staffTable.phone, phone.trim()))
    .limit(1);
  return row?.role === "admin";
}

export async function isApprovedStaff(phone: string): Promise<boolean> {
  if (!phone?.trim()) return false;
  const [row] = await db
    .select({ approvalStatus: staffTable.approvalStatus })
    .from(staffTable)
    .where(eq(staffTable.phone, phone.trim()))
    .limit(1);
  return row?.approvalStatus === "approved";
}

export async function getStaffRole(
  phone: string,
): Promise<{ role: string; approvalStatus: string } | null> {
  if (!phone?.trim()) return null;
  const [row] = await db
    .select({ role: staffTable.role, approvalStatus: staffTable.approvalStatus })
    .from(staffTable)
    .where(eq(staffTable.phone, phone.trim()))
    .limit(1);
  return row ?? null;
}

// Middleware that requires admin role (phone passed via x-admin-phone header or adminPhone query param)
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const phone =
    (req.headers["x-admin-phone"] as string | undefined) ??
    (req.query.adminPhone as string | undefined) ??
    (req.body as Record<string, string>)?.adminPhone;

  if (!phone) {
    res.status(401).json({ title: "Unauthorized: admin phone required", status: 401 });
    return;
  }
  isAdminPhone(phone)
    .then((ok) => {
      if (!ok) {
        res.status(403).json({ title: "Forbidden: admin access only", status: 403 });
        return;
      }
      next();
    })
    .catch(next);
}

// ─── GET /api/admin/candidate-stats ───────────────────────────────────────────

router.get("/admin/candidate-stats", async (req, res, next) => {
  try {
    // Status breakdown
    const statusCounts = await db
      .select({
        status: candidatesTable.status,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(candidatesTable)
      .groupBy(candidatesTable.status);

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of statusCounts) {
      counts[row.status] = row.count;
      total += row.count;
    }

    // Today's submissions
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayRow] = await db
      .select({ count: sql<number>`count(*)::int`.as("count") })
      .from(candidatesTable)
      .where(
        and(
          gte(candidatesTable.createdAt, todayStart),
          lt(candidatesTable.createdAt, tomorrow),
        ),
      );
    const todaySubmissions = todayRow?.count ?? 0;

    // Unique mobilizers
    const mobilizersAll = await db
      .selectDistinctOn([candidatesTable.submittedByPhone], {
        phone: candidatesTable.submittedByPhone,
        name: candidatesTable.submittedBy,
      })
      .from(candidatesTable)
      .where(isNotNull(candidatesTable.submittedByPhone));

    // Per-mobilizer counts
    const mobCountRows = await db
      .select({
        phone: candidatesTable.submittedByPhone,
        name: candidatesTable.submittedBy,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(candidatesTable)
      .where(isNotNull(candidatesTable.submittedByPhone))
      .groupBy(candidatesTable.submittedByPhone, candidatesTable.submittedBy)
      .orderBy(desc(sql`count(*)`));

    // Mobilizer approval status
    const phones = mobilizersAll.map((m) => m.phone).filter(Boolean) as string[];
    let mobStatusMap: Record<string, string> = {};
    if (phones.length > 0) {
      const staffRows = await db
        .select({ phone: staffTable.phone, approvalStatus: staffTable.approvalStatus })
        .from(staffTable);
      for (const r of staffRows) {
        if (r.phone) mobStatusMap[r.phone] = r.approvalStatus ?? "unknown";
      }
    }

    const mobilizersBreakdown = mobCountRows.map((m) => ({
      phone: m.phone,
      name: m.name,
      count: m.count,
      approvalStatus: m.phone ? (mobStatusMap[m.phone] ?? "unknown") : "unknown",
    }));

    // Pending mobilizers (staff not yet approved)
    const pendingMobilizers = mobilizersBreakdown.filter(
      (m) => m.approvalStatus === "pending",
    ).length;
    const approvedMobilizers = mobilizersBreakdown.filter(
      (m) => m.approvalStatus === "approved",
    ).length;

    res.json({
      total,
      pending: counts["pending"] ?? 0,
      verified: counts["verified"] ?? 0,
      rejected: counts["rejected"] ?? 0,
      enrolled: counts["enrolled"] ?? 0,
      todaySubmissions,
      uniqueMobilizers: mobilizersAll.length,
      approvedMobilizers,
      pendingMobilizers,
      mobilizersBreakdown,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/permissions?phone=xxx ────────────────────────────────────
// Returns the role + approval status for any phone — used by mobile for access control

router.get("/admin/permissions", async (req, res, next) => {
  try {
    const { phone } = req.query as { phone?: string };
    if (!phone) {
      res.status(400).json({ title: "phone required", status: 400 });
      return;
    }
    const info = await getStaffRole(phone);
    if (!info) {
      res.json({ role: "unknown", approvalStatus: "unknown", canSubmitCandidates: false, isAdmin: false });
      return;
    }
    res.json({
      role: info.role,
      approvalStatus: info.approvalStatus,
      canSubmitCandidates: info.approvalStatus === "approved",
      isAdmin: info.role === "admin",
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/audit-log ─────────────────────────────────────────────────
// Optional ?candidateId=xxx to filter by candidate

router.get("/admin/audit-log", async (req, res, next) => {
  try {
    const { candidateId, phone, limit: limitParam } = req.query as {
      candidateId?: string;
      phone?: string;
      limit?: string;
    };
    const pageLimit = Math.min(parseInt(limitParam ?? "100", 10), 500);

    const conditions = [];
    if (candidateId?.trim()) {
      conditions.push(eq(candidateAuditLogTable.candidateId, candidateId.trim()));
    }
    if (phone?.trim()) {
      conditions.push(eq(candidateAuditLogTable.actionByPhone, phone.trim()));
    }

    const rows = await db
      .select()
      .from(candidateAuditLogTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(candidateAuditLogTable.createdAt))
      .limit(pageLimit);

    res.json(
      rows.map((r) => ({
        id: r.id,
        candidateId: r.candidateId,
        candidateName: r.candidateName,
        actionBy: r.actionBy,
        actionByPhone: r.actionByPhone ?? null,
        oldStatus: r.oldStatus ?? null,
        newStatus: r.newStatus,
        remarks: r.remarks ?? null,
        createdAt: r.createdAt?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/staff-list ───────────────────────────────────────────────
// Returns all non-deleted staff members with their status.

router.get("/admin/staff-list", async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(staffTable)
      .orderBy(staffTable.name);

    res.json(
      rows
        .filter((r) => !r.deletedAt)
        .map((r) => ({
          id: r.id,
          empCode: r.empCode,
          name: r.name,
          phone: r.phone,
          email: r.email ?? null,
          role: r.role,
          area: r.area ?? null,
          organization: r.organization ?? null,
          centerName: r.centerName ?? null,
          projectName: r.projectName ?? null,
          state: r.state ?? null,
          district: r.district ?? null,
          approvalStatus: r.approvalStatus,
          disabledAt: r.disabledAt?.toISOString() ?? null,
          createdAt: r.createdAt?.toISOString() ?? null,
        })),
    );
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/staff/:id/disable ──────────────────────────────────────
// Disable a staff member (they cannot login or submit data).

router.patch("/admin/staff/:id/disable", async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const [row] = await db
      .select({ id: staffTable.id, role: staffTable.role })
      .from(staffTable)
      .where(eq(staffTable.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }
    if (row.role === "admin") {
      res.status(400).json({ title: "Cannot disable admin accounts", status: 400 });
      return;
    }

    await db
      .update(staffTable)
      .set({ disabledAt: new Date() })
      .where(eq(staffTable.id, id));

    req.log.info({ staffId: id }, "Staff disabled");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/staff/:id/enable ───────────────────────────────────────
// Re-enable a disabled staff member.

router.patch("/admin/staff/:id/enable", async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    await db
      .update(staffTable)
      .set({ disabledAt: null })
      .where(eq(staffTable.id, id));

    req.log.info({ staffId: id }, "Staff enabled");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/staff/:id ─────────────────────────────────────────────
// Soft-delete a staff member. Their candidate records are preserved.

router.delete("/admin/staff/:id", async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const [row] = await db
      .select({ id: staffTable.id, role: staffTable.role })
      .from(staffTable)
      .where(eq(staffTable.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }
    if (row.role === "admin") {
      res.status(400).json({ title: "Cannot delete admin accounts", status: 400 });
      return;
    }

    await db
      .update(staffTable)
      .set({ deletedAt: new Date() })
      .where(eq(staffTable.id, id));

    req.log.info({ staffId: id }, "Staff soft-deleted");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/staff/:id/profile ──────────────────────────────────────
// Admin can edit staff profile fields: name, email, centerName, projectName, state, district, area, organization

router.patch("/admin/staff/:id/profile", async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { name, email, organization, centerName, projectName, state, district, area } = req.body as {
      name?: string;
      email?: string | null;
      organization?: string | null;
      centerName?: string | null;
      projectName?: string | null;
      state?: string | null;
      district?: string | null;
      area?: string | null;
    };

    const [row] = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(and(eq(staffTable.id, id), isNull(staffTable.deletedAt)))
      .limit(1);

    if (!row) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

    if (name !== undefined && name.trim().length < 2) {
      res.status(400).json({ title: "Name too short", status: 400 });
      return;
    }

    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ title: "Invalid email", status: 400 });
      return;
    }

    const updates: Partial<typeof staffTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email?.trim() || null;
    if (organization !== undefined) updates.organization = organization?.trim() || null;
    if (centerName !== undefined) updates.centerName = centerName?.trim() || null;
    if (projectName !== undefined) updates.projectName = projectName?.trim() || null;
    if (state !== undefined) updates.state = state?.trim() || null;
    if (district !== undefined) updates.district = district?.trim() || null;
    if (area !== undefined) updates.area = area?.trim() || null;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ title: "No fields to update", status: 400 });
      return;
    }

    const [updated] = await db
      .update(staffTable)
      .set(updates)
      .where(eq(staffTable.id, id))
      .returning();

    res.json({
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email ?? null,
      organization: updated.organization ?? null,
      centerName: updated.centerName ?? null,
      projectName: updated.projectName ?? null,
      state: updated.state ?? null,
      district: updated.district ?? null,
      area: updated.area ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/candidates/csv (with date + mobilizer filter) ─────────────
// This is registered here so we can use enhanced params before the generic route in candidates.ts

// ─── GET /api/admin/live-locations ─────────────────────────────────────────────
// Returns all non-deleted staff with their last known GPS position and shift status.
// Admin map polls this every 15 s for real-time tracking.
router.get("/admin/live-locations", async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: staffTable.id,
        name: staffTable.name,
        empCode: staffTable.empCode,
        area: staffTable.area,
        role: staffTable.role,
        lastLat: staffTable.lastLat,
        lastLng: staffTable.lastLng,
        lastLocationAt: staffTable.lastLocationAt,
        isOnShift: staffTable.isOnShift,
      })
      .from(staffTable)
      .where(isNull(staffTable.deletedAt))
      .orderBy(staffTable.name);

    res.json(
      rows.map((r) => ({
        staffId: r.id,
        staffName: r.name,
        empCode: r.empCode,
        area: r.area ?? null,
        role: r.role,
        lastLat: r.lastLat ?? null,
        lastLng: r.lastLng ?? null,
        lastLocationAt: r.lastLocationAt?.toISOString() ?? null,
        isOnShift: r.isOnShift,
      })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
