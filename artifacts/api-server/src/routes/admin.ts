import {
  candidateAuditLogTable,
  candidatesTable,
  candidateNotificationsTable,
  companiesTable,
  db,
  staffTable,
} from "@workspace/db";
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";

const router: IRouter = Router();

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function isAdminPhone(phone: string): Promise<boolean> {
  if (!phone?.trim()) return false;
  const [row] = await db
    .select({ role: staffTable.role })
    .from(staffTable)
    .where(eq(staffTable.phone, phone.trim()))
    .limit(1);
  return row?.role === "admin" || row?.role === "super_admin";
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

/**
 * Look up a staff member by phone and return their companyId.
 * Super admin has no company (returns null, which means "all companies").
 */
export async function getAdminCompanyId(phone: string): Promise<{
  companyId: string | null;
  role: string;
} | null> {
  if (!phone?.trim()) return null;
  const [row] = await db
    .select({ role: staffTable.role, companyId: staffTable.companyId, approvalStatus: staffTable.approvalStatus })
    .from(staffTable)
    .where(eq(staffTable.phone, phone.trim()))
    .limit(1);
  if (!row) return null;
  if (row.role !== "admin" && row.role !== "super_admin") return null;
  if (row.approvalStatus !== "approved") return null;
  return { companyId: row.companyId ?? null, role: row.role };
}

/**
 * Middleware: requires admin or super_admin role.
 * Sets res.locals.companyId (string for company admin, null for super admin = sees all).
 * Sets res.locals.adminRole to "admin" | "super_admin".
 */
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
  getAdminCompanyId(phone)
    .then((info) => {
      if (!info) {
        res.status(403).json({ title: "Forbidden: admin access only", status: 403 });
        return;
      }
      res.locals.companyId = info.companyId; // null = super admin (no filter)
      res.locals.adminRole = info.role;
      next();
    })
    .catch(next);
}

// ─── GET /api/admin/candidate-stats ───────────────────────────────────────────

router.get("/admin/candidate-stats", requireAdmin, async (_req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const companyFilter = companyId
      ? or(eq(candidatesTable.companyId, companyId), isNull(candidatesTable.companyId))
      : undefined;

    // Status breakdown
    const statusCounts = await db
      .select({
        status: candidatesTable.status,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(candidatesTable)
      .where(companyFilter)
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
          companyFilter,
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
      .where(and(companyFilter, isNotNull(candidatesTable.submittedByPhone)));

    // Per-mobilizer counts
    const mobCountRows = await db
      .select({
        phone: candidatesTable.submittedByPhone,
        name: candidatesTable.submittedBy,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(candidatesTable)
      .where(and(companyFilter, isNotNull(candidatesTable.submittedByPhone)))
      .groupBy(candidatesTable.submittedByPhone, candidatesTable.submittedBy)
      .orderBy(desc(sql`count(*)`));

    // Mobilizer approval status
    const staffFilter = companyId ? eq(staffTable.companyId, companyId) : undefined;
    const phones = mobilizersAll.map((m) => m.phone).filter(Boolean) as string[];
    let mobStatusMap: Record<string, string> = {};
    if (phones.length > 0) {
      const staffRows = await db
        .select({ phone: staffTable.phone, approvalStatus: staffTable.approvalStatus })
        .from(staffTable)
        .where(staffFilter);
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
      isAdmin: info.role === "admin" || info.role === "super_admin",
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/audit-log ─────────────────────────────────────────────────

router.get("/admin/audit-log", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { candidateId, phone, limit: limitParam } = req.query as {
      candidateId?: string;
      phone?: string;
      limit?: string;
    };
    const pageLimit = Math.min(parseInt(limitParam ?? "100", 10), 500);

    const conditions: ReturnType<typeof eq>[] = [];
    if (companyId) conditions.push(eq(candidateAuditLogTable.companyId, companyId));
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

router.get("/admin/staff-list", requireAdmin, async (_req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const companyFilter = companyId
      ? or(eq(staffTable.companyId, companyId), isNull(staffTable.companyId))
      : undefined;

    const rows = await db
      .select()
      .from(staffTable)
      .where(companyFilter)
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

// ─── PATCH /api/admin/staff/:id/approve ──────────────────────────────────────

router.patch("/admin/staff/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const companyId = res.locals.companyId as string | null;
    const filter = companyId
      ? and(eq(staffTable.id, id), or(eq(staffTable.companyId, companyId), isNull(staffTable.companyId)))
      : eq(staffTable.id, id);

    const [row] = await db.select({ id: staffTable.id }).from(staffTable).where(filter).limit(1);
    if (!row) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }
    await db.update(staffTable).set({ approvalStatus: "approved" }).where(eq(staffTable.id, id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/staff/:id/disable ──────────────────────────────────────

router.patch("/admin/staff/:id/disable", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const companyId = res.locals.companyId as string | null;
    const filter = companyId
      ? and(eq(staffTable.id, id), or(eq(staffTable.companyId, companyId), isNull(staffTable.companyId)))
      : eq(staffTable.id, id);

    const [row] = await db
      .select({ id: staffTable.id, role: staffTable.role })
      .from(staffTable)
      .where(filter)
      .limit(1);

    if (!row) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }
    if (row.role === "admin" || row.role === "super_admin") {
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

router.patch("/admin/staff/:id/enable", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const companyId = res.locals.companyId as string | null;
    const filter = companyId
      ? and(eq(staffTable.id, id), or(eq(staffTable.companyId, companyId), isNull(staffTable.companyId)))
      : eq(staffTable.id, id);

    const [row] = await db.select({ id: staffTable.id }).from(staffTable).where(filter).limit(1);
    if (!row) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

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

router.delete("/admin/staff/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const companyId = res.locals.companyId as string | null;
    const filter = companyId
      ? and(eq(staffTable.id, id), or(eq(staffTable.companyId, companyId), isNull(staffTable.companyId)))
      : eq(staffTable.id, id);

    const [row] = await db
      .select({ id: staffTable.id, role: staffTable.role })
      .from(staffTable)
      .where(filter)
      .limit(1);

    if (!row) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }
    if (row.role === "admin" || row.role === "super_admin") {
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

router.patch("/admin/staff/:id/profile", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const companyId = res.locals.companyId as string | null;
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

    const filter = companyId
      ? and(eq(staffTable.id, id), eq(staffTable.companyId, companyId), isNull(staffTable.deletedAt))
      : and(eq(staffTable.id, id), isNull(staffTable.deletedAt));

    const [row] = await db.select({ id: staffTable.id }).from(staffTable).where(filter).limit(1);
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

// ─── GET /api/admin/live-locations ─────────────────────────────────────────────

router.get("/admin/live-locations", requireAdmin, async (_req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const companyFilter = companyId ? eq(staffTable.companyId, companyId) : undefined;

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
      .where(and(companyFilter, isNull(staffTable.deletedAt)))
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

// ─── GET /api/admin/dashboard/stats ─────────────────────────────────────────
// Consolidated stats for the admin web panel dashboard.

router.get("/admin/dashboard/stats", requireAdmin, async (_req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const candFilter = companyId ? eq(candidatesTable.companyId, companyId) : undefined;
    const staffFilter = companyId ? eq(staffTable.companyId, companyId) : undefined;

    // Candidate counts by status
    const statusCounts = await db
      .select({
        status: candidatesTable.status,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(candidatesTable)
      .where(candFilter)
      .groupBy(candidatesTable.status);

    const candCounts: Record<string, number> = {};
    let totalCandidates = 0;
    for (const row of statusCounts) {
      candCounts[row.status] = row.count;
      totalCandidates += row.count;
    }

    // Today's registrations
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [todayRow] = await db
      .select({ count: sql<number>`count(*)::int`.as("count") })
      .from(candidatesTable)
      .where(and(candFilter, gte(candidatesTable.createdAt, todayStart), lt(candidatesTable.createdAt, tomorrow)));

    // This month's registrations
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [monthRow] = await db
      .select({ count: sql<number>`count(*)::int`.as("count") })
      .from(candidatesTable)
      .where(and(candFilter, gte(candidatesTable.createdAt, monthStart)));

    // Staff counts
    const staffCounts = await db
      .select({
        approvalStatus: staffTable.approvalStatus,
        disabledAt: staffTable.disabledAt,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(staffTable)
      .where(and(staffFilter, isNull(staffTable.deletedAt)))
      .groupBy(staffTable.approvalStatus, staffTable.disabledAt);

    let totalStaff = 0;
    let activeStaff = 0;
    let pendingApprovals = 0;
    for (const row of staffCounts) {
      totalStaff += row.count;
      if (row.approvalStatus === "approved" && !row.disabledAt) activeStaff += row.count;
      if (row.approvalStatus === "pending") pendingApprovals += row.count;
    }

    res.json({
      totalCandidates,
      pendingCandidates: candCounts["pending"] ?? 0,
      verifiedCandidates: candCounts["verified"] ?? 0,
      enrolledCandidates: candCounts["enrolled"] ?? 0,
      rejectedCandidates: candCounts["rejected"] ?? 0,
      todayRegistrations: todayRow?.count ?? 0,
      thisMonthRegistrations: monthRow?.count ?? 0,
      totalStaff,
      activeStaff,
      pendingApprovals,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/staff/:id/deactivate ───────────────────────────────────
// Deactivate (soft-disable) a staff member.

router.patch("/admin/staff/:id/deactivate", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = res.locals.companyId as string | null;

    const filter = companyId
      ? and(eq(staffTable.id, id), eq(staffTable.companyId, companyId), isNull(staffTable.deletedAt))
      : and(eq(staffTable.id, id), isNull(staffTable.deletedAt));

    const [row] = await db.select({ id: staffTable.id }).from(staffTable).where(filter).limit(1);
    if (!row) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

    await db.update(staffTable).set({ disabledAt: new Date() }).where(eq(staffTable.id, id));
    req.log.info({ staffId: id }, "Staff deactivated by admin");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/candidates/:id ─────────────────────────────────────────
// Allows admin to update any editable candidate field (phone, dob, parentMobile,
// pin, etc.) to fix blank / incorrect data from old registrations.

// ─── DELETE /api/admin/candidates/:id ────────────────────────────────────────
//
// Hard-deletes a candidate plus all related notification and audit-log rows.
// Available to both company admins (scoped to their own company) and super
// admins (no company filter). Useful for cleaning up demo records.
router.delete("/admin/candidates/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const companyId = res.locals.companyId as string | null;

    const [existing] = await db
      .select({
        id: candidatesTable.id,
        name: candidatesTable.name,
        companyId: candidatesTable.companyId,
      })
      .from(candidatesTable)
      .where(eq(candidatesTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ title: "Candidate not found", status: 404 });
      return;
    }
    // Company admins can only delete candidates that EXPLICITLY belong to
    // their own company. Orphan rows (company_id = NULL) are reserved for
    // super-admin cleanup — a tenant admin should not be able to wipe records
    // they cannot prove ownership of. (Stricter than the PATCH endpoint on
    // purpose: this is a destructive, irreversible operation.)
    if (companyId && existing.companyId !== companyId) {
      res.status(403).json({ title: "Forbidden", status: 403 });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(candidateAuditLogTable)
        .where(eq(candidateAuditLogTable.candidateId, id));
      await tx
        .delete(candidateNotificationsTable)
        .where(eq(candidateNotificationsTable.candidateId, id));
      await tx.delete(candidatesTable).where(eq(candidatesTable.id, id));
    });

    req.log.info(
      {
        candidateId: id,
        candidateName: existing.name,
        actorPhone: req.headers["x-admin-phone"],
      },
      "Candidate hard-deleted",
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/admin/candidates/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = res.locals.companyId as string | null;

    const [existing] = await db
      .select({ id: candidatesTable.id, companyId: candidatesTable.companyId })
      .from(candidatesTable)
      .where(eq(candidatesTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ title: "Candidate not found", status: 404 });
      return;
    }

    // Company admin can only edit candidates in their own company (or null companyId).
    if (companyId && existing.companyId && existing.companyId !== companyId) {
      res.status(403).json({ title: "Forbidden", status: 403 });
      return;
    }

    const body = req.body as {
      phone?: string | null;
      parentMobile?: string | null;
      dob?: string | null;
      pin?: string | null;
      email?: string | null;
      fatherName?: string | null;
      motherName?: string | null;
      gender?: string | null;
      maritalStatus?: string | null;
      religion?: string | null;
      caste?: string | null;
      address?: string | null;
      village?: string | null;
      policeStation?: string | null;
      postOffice?: string | null;
      district?: string | null;
      state?: string | null;
      bankAccount?: string | null;
      bankName?: string | null;
      bankBranch?: string | null;
      ifsc?: string | null;
      aadhaarNumber?: string | null;
      education?: string | null;
      yearOfPassing?: string | null;
      skillCentreName?: string | null;
    };

    // Validate phone if provided
    if (body.phone !== undefined && body.phone !== null && body.phone.trim()) {
      if (!/^\d{10}$/.test(body.phone.trim())) {
        res.status(400).json({ title: "Phone must be exactly 10 digits", status: 400 });
        return;
      }
    }
    // Validate parentMobile if provided
    if (body.parentMobile !== undefined && body.parentMobile !== null && body.parentMobile.trim()) {
      if (!/^\d{10}$/.test(body.parentMobile.trim())) {
        res.status(400).json({ title: "Parent mobile must be exactly 10 digits", status: 400 });
        return;
      }
    }
    // Validate pin if provided
    if (body.pin !== undefined && body.pin !== null && body.pin.trim()) {
      if (!/^\d{6}$/.test(body.pin.trim())) {
        res.status(400).json({ title: "PIN must be exactly 6 digits", status: 400 });
        return;
      }
    }

    const patch: Record<string, string | null> = {};
    const str = (v: string | null | undefined) =>
      v === undefined ? undefined : (v?.trim() || null);

    if (body.phone        !== undefined) { const v = str(body.phone);        if (v !== undefined) patch.phone = v; }
    if (body.parentMobile !== undefined) { const v = str(body.parentMobile); if (v !== undefined) patch.parentMobile = v; }
    if (body.dob          !== undefined) { const v = str(body.dob);          if (v !== undefined) patch.dob = v; }
    if (body.pin          !== undefined) { const v = str(body.pin);          if (v !== undefined) patch.pin = v; }
    if (body.email        !== undefined) { const v = str(body.email);        if (v !== undefined) patch.email = v; }
    if (body.fatherName   !== undefined) { const v = str(body.fatherName);   if (v !== undefined) patch.fatherName = v; }
    if (body.motherName   !== undefined) { const v = str(body.motherName);   if (v !== undefined) patch.motherName = v; }
    if (body.gender       !== undefined) { const v = str(body.gender);       if (v !== undefined) patch.gender = v; }
    if (body.maritalStatus!== undefined) { const v = str(body.maritalStatus);if (v !== undefined) patch.maritalStatus = v; }
    if (body.religion     !== undefined) { const v = str(body.religion);     if (v !== undefined) patch.religion = v; }
    if (body.caste        !== undefined) { const v = str(body.caste);        if (v !== undefined) patch.caste = v; }
    if (body.address      !== undefined) { const v = str(body.address);      if (v !== undefined) patch.address = v; }
    if (body.village      !== undefined) { const v = str(body.village);      if (v !== undefined) patch.village = v; }
    if (body.policeStation!== undefined) { const v = str(body.policeStation);if (v !== undefined) patch.policeStation = v; }
    if (body.postOffice   !== undefined) { const v = str(body.postOffice);   if (v !== undefined) patch.postOffice = v; }
    if (body.district     !== undefined) { const v = str(body.district);     if (v !== undefined) patch.district = v; }
    if (body.state        !== undefined) { const v = str(body.state);        if (v !== undefined) patch.state = v; }
    if (body.bankAccount  !== undefined) { const v = str(body.bankAccount);  if (v !== undefined) patch.bankAccount = v; }
    if (body.bankName     !== undefined) { const v = str(body.bankName);     if (v !== undefined) patch.bankName = v; }
    if (body.bankBranch   !== undefined) { const v = str(body.bankBranch);   if (v !== undefined) patch.bankBranch = v; }
    if (body.ifsc         !== undefined) { const v = str(body.ifsc);         if (v !== undefined) patch.ifsc = v; }
    if (body.aadhaarNumber!== undefined) { const v = str(body.aadhaarNumber);if (v !== undefined) patch.aadhaarNumber = v; }
    if (body.education    !== undefined) { const v = str(body.education);    if (v !== undefined) patch.education = v; }
    if (body.yearOfPassing!== undefined) { const v = str(body.yearOfPassing);if (v !== undefined) patch.yearOfPassing = v; }
    if (body.skillCentreName !== undefined) { const v = str(body.skillCentreName); if (v !== undefined) patch.skillCentreName = v; }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ title: "No fields to update", status: 400 });
      return;
    }

    const [updated] = await db
      .update(candidatesTable)
      .set(patch as Parameters<typeof candidatesTable.$inferInsert>[0])
      .where(eq(candidatesTable.id, id))
      .returning();

    res.json({ success: true, id: updated.id });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/company/subscription ──────────────────────────────────────
// Returns subscription details for the company admin's own company.
// Used by the admin dashboard to show expiry warnings.

router.get("/admin/company/subscription", requireAdmin, async (_req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    if (!companyId) {
      res.json({
        plan: null,
        subscriptionActive: true,
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        paymentStatus: null,
        isSubscriptionExpired: false,
        daysUntilExpiry: null,
      });
      return;
    }
    const [company] = await db
      .select({
        plan: companiesTable.plan,
        subscriptionActive: companiesTable.subscriptionActive,
        subscriptionStartDate: companiesTable.subscriptionStartDate,
        subscriptionEndDate: companiesTable.subscriptionEndDate,
        paymentStatus: companiesTable.paymentStatus,
      })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    if (!company) {
      res.status(404).json({ title: "Company not found", status: 404 });
      return;
    }

    const now = new Date();
    const endDate = company.subscriptionEndDate ? new Date(company.subscriptionEndDate) : null;
    const isExpired = endDate !== null && now > endDate;
    const daysUntilExpiry = endDate
      ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    res.json({
      plan: company.plan ?? null,
      subscriptionActive: company.subscriptionActive,
      subscriptionStartDate: company.subscriptionStartDate?.toISOString() ?? null,
      subscriptionEndDate: company.subscriptionEndDate?.toISOString() ?? null,
      paymentStatus: company.paymentStatus ?? null,
      isSubscriptionExpired: isExpired,
      daysUntilExpiry,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

