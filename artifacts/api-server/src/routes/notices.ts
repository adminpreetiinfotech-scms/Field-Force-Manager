import {
  db,
  noticesTable,
  noticeRecipientsTable,
  staffTable,
} from "@workspace/db";
import {
  and,
  desc,
  eq,
  isNull,
  isNotNull,
  sql,
  inArray,
  or,
  gt,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import { sendSmsSilent } from "../lib/twilio";
import { isValidUUID } from "../lib/validation";
import { requireAdmin } from "./admin";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getStaffByPhone(phone: string) {
  if (!phone?.trim()) return null;
  const [row] = await db
    .select({ id: staffTable.id, role: staffTable.role, name: staffTable.name })
    .from(staffTable)
    .where(
      and(
        eq(staffTable.phone, phone.trim()),
        isNull(staffTable.deletedAt),
        isNull(staffTable.disabledAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ─── POST /api/notices/admin/create ──────────────────────────────────────────

router.post("/notices/admin/create", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const adminPhone =
      (req.headers["x-admin-phone"] as string | undefined) ??
      (req.query.adminPhone as string | undefined) ??
      (req.body as Record<string, string>)?.adminPhone;

    const [admin] = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(eq(staffTable.phone, adminPhone!.trim()))
      .limit(1);

    const body = req.body as {
      title: string;
      message: string;
      priority?: string;
      type?: string;
      targetType?: string;
      targetStaffIds?: string[];
      expiresAt?: string | null;
    };

    const { title, message, priority, type, targetType, targetStaffIds, expiresAt } = body;

    if (!title?.trim() || !message?.trim()) {
      res.status(400).json({ title: "title and message are required", status: 400 });
      return;
    }

    const [notice] = await db
      .insert(noticesTable)
      .values({
        companyId,
        title: title.trim(),
        message: message.trim(),
        priority: (priority as "normal" | "important" | "urgent") ?? "normal",
        type: (type as "notice" | "alert" | "reminder") ?? "notice",
        targetType: (targetType as "all" | "specific") ?? "all",
        createdBy: admin?.id ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    if (!notice) {
      res.status(500).json({ title: "Failed to create notice", status: 500 });
      return;
    }

    // Insert recipients
    let recipientIds: string[] = [];

    if (targetType === "specific" && Array.isArray(targetStaffIds) && targetStaffIds.length > 0) {
      recipientIds = targetStaffIds;
    } else {
      // All active, non-deleted staff scoped to this company (if company admin)
      const allStaff = await db
        .select({ id: staffTable.id })
        .from(staffTable)
        .where(
          and(
            isNull(staffTable.deletedAt),
            isNull(staffTable.disabledAt),
            eq(staffTable.approvalStatus, "approved"),
            companyId ? eq(staffTable.companyId, companyId) : undefined,
          ),
        );
      recipientIds = allStaff.map((s) => s.id);
    }

    if (recipientIds.length > 0) {
      await db.insert(noticeRecipientsTable).values(
        recipientIds.map((staffId) => ({
          noticeId: notice.id,
          staffId,
        })),
      );
    }

    // Fire-and-forget SMS to recipients (capped at 50 to control costs)
    void (async () => {
      try {
        const phones = await db
          .select({ phone: staffTable.phone })
          .from(staffTable)
          .where(inArray(staffTable.id, recipientIds.slice(0, 50)));

        const priorityTag =
          notice.priority === "urgent"
            ? "[URGENT] "
            : notice.priority === "important"
              ? "[IMPORTANT] "
              : "";

        const smsBody = `${priorityTag}SCMS Notice:\n${notice.title}\n${notice.message}`.slice(0, 320);

        await Promise.allSettled(
          phones.map(({ phone }) => sendSmsSilent(phone, smsBody, req.log.warn.bind(req.log))),
        );
      } catch {
        // SMS failure must not affect the main response
      }
    })();

    res.json({ notice, recipientCount: recipientIds.length });
  } catch (e) {
    next(e);
  }
});

// ─── GET /api/notices/admin/list ─────────────────────────────────────────────

router.get("/notices/admin/list", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const notices = await db
      .select({
        id: noticesTable.id,
        title: noticesTable.title,
        message: noticesTable.message,
        priority: noticesTable.priority,
        type: noticesTable.type,
        targetType: noticesTable.targetType,
        expiresAt: noticesTable.expiresAt,
        createdAt: noticesTable.createdAt,
        creatorName: staffTable.name,
        totalRecipients: sql<number>`cast(count(${noticeRecipientsTable.id}) as int)`,
        readCount: sql<number>`cast(count(${noticeRecipientsTable.readAt}) as int)`,
      })
      .from(noticesTable)
      .leftJoin(staffTable, eq(noticesTable.createdBy, staffTable.id))
      .leftJoin(
        noticeRecipientsTable,
        eq(noticesTable.id, noticeRecipientsTable.noticeId),
      )
      .where(companyId ? eq(noticesTable.companyId, companyId) : undefined)
      .groupBy(
        noticesTable.id,
        staffTable.name,
      )
      .orderBy(desc(noticesTable.createdAt));

    res.json({ notices });
  } catch (e) {
    next(e);
  }
});

// ─── GET /api/notices/admin/:id ───────────────────────────────────────────────

router.get("/notices/admin/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }

    const [notice] = await db
      .select()
      .from(noticesTable)
      .where(eq(noticesTable.id, id))
      .limit(1);

    if (!notice) {
      res.status(404).json({ title: "Notice not found", status: 404 });
      return;
    }

    const recipients = await db
      .select({
        staffId: noticeRecipientsTable.staffId,
        staffName: staffTable.name,
        staffPhone: staffTable.phone,
        deliveredAt: noticeRecipientsTable.deliveredAt,
        readAt: noticeRecipientsTable.readAt,
        acknowledged: noticeRecipientsTable.acknowledged,
      })
      .from(noticeRecipientsTable)
      .leftJoin(staffTable, eq(noticeRecipientsTable.staffId, staffTable.id))
      .where(eq(noticeRecipientsTable.noticeId, id))
      .orderBy(desc(noticeRecipientsTable.deliveredAt));

    res.json({ notice, recipients });
  } catch (e) {
    next(e);
  }
});

// ─── DELETE /api/notices/admin/:id ───────────────────────────────────────────

router.delete("/notices/admin/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
    const deleted = await db
      .delete(noticesTable)
      .where(eq(noticesTable.id, id))
      .returning({ id: noticesTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ title: "Notice not found", status: 404 });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ─── GET /api/notices/unread-count ───────────────────────────────────────────

router.get("/notices/unread-count", async (req, res, next) => {
  try {
    const phone = req.query.phone as string | undefined;
    if (!phone?.trim()) {
      res.json({ count: 0 });
      return;
    }

    const staff = await getStaffByPhone(phone);
    if (!staff) {
      res.json({ count: 0 });
      return;
    }

    const now = new Date();

    const [row] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(noticeRecipientsTable)
      .innerJoin(noticesTable, eq(noticeRecipientsTable.noticeId, noticesTable.id))
      .where(
        and(
          eq(noticeRecipientsTable.staffId, staff.id),
          isNull(noticeRecipientsTable.readAt),
          or(isNull(noticesTable.expiresAt), gt(noticesTable.expiresAt, now)),
        ),
      );

    res.json({ count: row?.count ?? 0 });
  } catch (e) {
    next(e);
  }
});

// ─── GET /api/notices/my ─────────────────────────────────────────────────────

router.get("/notices/my", async (req, res, next) => {
  try {
    const phone = req.query.phone as string | undefined;
    if (!phone?.trim()) {
      res.status(400).json({ title: "phone is required", status: 400 });
      return;
    }

    const staff = await getStaffByPhone(phone);
    if (!staff) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

    const now = new Date();

    const rows = await db
      .select({
        id: noticesTable.id,
        title: noticesTable.title,
        message: noticesTable.message,
        priority: noticesTable.priority,
        type: noticesTable.type,
        createdAt: noticesTable.createdAt,
        expiresAt: noticesTable.expiresAt,
        readAt: noticeRecipientsTable.readAt,
        acknowledged: noticeRecipientsTable.acknowledged,
        recipientId: noticeRecipientsTable.id,
      })
      .from(noticeRecipientsTable)
      .innerJoin(noticesTable, eq(noticeRecipientsTable.noticeId, noticesTable.id))
      .where(
        and(
          eq(noticeRecipientsTable.staffId, staff.id),
          or(isNull(noticesTable.expiresAt), gt(noticesTable.expiresAt, now)),
        ),
      )
      .orderBy(desc(noticesTable.createdAt));

    res.json({ notices: rows });
  } catch (e) {
    next(e);
  }
});

// ─── POST /api/notices/:id/read ──────────────────────────────────────────────

router.post("/notices/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
    const phone = (req.body as Record<string, string>)?.phone;

    if (!phone?.trim()) {
      res.status(400).json({ title: "phone is required", status: 400 });
      return;
    }

    const staff = await getStaffByPhone(phone);
    if (!staff) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

    await db
      .update(noticeRecipientsTable)
      .set({
        readAt: new Date(),
        acknowledged: true,
      })
      .where(
        and(
          eq(noticeRecipientsTable.noticeId, id!),
          eq(noticeRecipientsTable.staffId, staff.id),
          isNull(noticeRecipientsTable.readAt),
        ),
      );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ─── GET /api/notices/admin/staff-list  (for targeting) ──────────────────────

router.get("/notices/admin/staff-list", requireAdmin, async (req, res, next) => {
  try {
    const staff = await db
      .select({
        id: staffTable.id,
        name: staffTable.name,
        phone: staffTable.phone,
        empCode: staffTable.empCode,
        area: staffTable.area,
      })
      .from(staffTable)
      .where(
        and(
          isNull(staffTable.deletedAt),
          isNull(staffTable.disabledAt),
          eq(staffTable.approvalStatus, "approved"),
          eq(staffTable.role, "staff"),
        ),
      )
      .orderBy(staffTable.name);
    res.json({ staff });
  } catch (e) {
    next(e);
  }
});

export default router;
