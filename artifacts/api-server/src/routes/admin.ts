import {
  activityEventsTable,
  candidateAuditLogTable,
  candidatesTable,
  candidateNotificationsTable,
  companiesTable,
  db,
  staffTable,
} from "@workspace/db";
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { isValidUUID } from "../lib/validation";

const PURPLE    = "FF4F46E5";
const PURPLE_DK = "FF3730A3";
const AMBER     = "FFF59E0B";
const WHITE     = "FFFFFFFF";
const LGRAY     = "FFF3F4F6";

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

    if (candidateId?.trim() && !isValidUUID(candidateId.trim())) {
      res.status(400).json({ title: "Invalid candidateId: must be a valid UUID", status: 400 });
      return;
    }

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
      ? and(
          ne(staffTable.role, "super_admin"),
          eq(staffTable.companyId, companyId),
        )
      : ne(staffTable.role, "super_admin");

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
          staffCategory: r.staffCategory ?? "field",
          centerStaffRole: r.centerStaffRole ?? null,
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
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
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
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
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
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
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
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
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
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
    const companyId = res.locals.companyId as string | null;
    const { name, email, organization, centerName, projectName, state, district, area, staffCategory, centerStaffRole } = req.body as {
      name?: string;
      email?: string | null;
      organization?: string | null;
      centerName?: string | null;
      projectName?: string | null;
      state?: string | null;
      district?: string | null;
      area?: string | null;
      staffCategory?: "field" | "center" | null;
      centerStaffRole?: string | null;
    };

    const filter = companyId
      ? and(eq(staffTable.id, id), eq(staffTable.companyId, companyId), isNull(staffTable.deletedAt))
      : and(eq(staffTable.id, id), isNull(staffTable.deletedAt));

    const [row] = await db
      .select({ id: staffTable.id, staffCategory: staffTable.staffCategory, centerStaffRole: staffTable.centerStaffRole })
      .from(staffTable).where(filter).limit(1);
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
    if (staffCategory !== undefined && (staffCategory === "field" || staffCategory === "center")) {
      updates.staffCategory = staffCategory;
    }
    if (centerStaffRole !== undefined) updates.centerStaffRole = centerStaffRole?.trim() || null;
    // Enforce: whenever effective final category is "center", role must be non-empty
    const effectiveCategory = updates.staffCategory ?? row.staffCategory ?? "field";
    const effectiveRole = (updates.centerStaffRole !== undefined ? updates.centerStaffRole : row.centerStaffRole)?.trim();
    if (effectiveCategory === "center" && !effectiveRole) {
      res.status(400).json({ title: "centerStaffRole is required when staffCategory is center", status: 400 });
      return;
    }

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
      staffCategory: updated.staffCategory ?? "field",
      centerStaffRole: updated.centerStaffRole ?? null,
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

    // ── Company geofence configuration ────────────────────────────────────────
    // Super-admin has no single company, so the hint is not meaningful — default true.
    let geofenceConfigured = companyId == null;
    if (companyId) {
      const [companyRow] = await db
        .select({ centerLat: companiesTable.centerLat, centerLng: companiesTable.centerLng })
        .from(companiesTable)
        .where(eq(companiesTable.id, companyId));
      geofenceConfigured = companyRow?.centerLat != null && companyRow?.centerLng != null;
    }

    // ── Center staff attendance summary for today (IST) ──────────────────────
    // IST = UTC + 5h30m
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
    const dayStartIST = new Date(todayIST + "T00:00:00+05:30");
    const dayEndIST   = new Date(todayIST + "T23:59:59+05:30");

    const centerStaffFilter = companyId
      ? and(eq(staffTable.companyId, companyId), eq(staffTable.staffCategory, "center"), eq(staffTable.role, "staff"), isNull(staffTable.deletedAt))
      : and(eq(staffTable.staffCategory, "center"), eq(staffTable.role, "staff"), isNull(staffTable.deletedAt));

    const centerStaffList = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(centerStaffFilter);

    let centerPresentToday = 0;
    let centerAbsentToday = 0;
    let centerViolationsToday = 0;

    if (centerStaffList.length > 0) {
      const centerStaffIds = centerStaffList.map((s) => s.id);

      const todayCheckins = await db
        .select({
          staffId: activityEventsTable.staffId,
          payload: activityEventsTable.payload,
        })
        .from(activityEventsTable)
        .where(
          and(
            inArray(activityEventsTable.staffId, centerStaffIds),
            eq(activityEventsTable.kind, "checkin"),
            gte(activityEventsTable.occurredAt, dayStartIST),
            lt(activityEventsTable.occurredAt, new Date(dayEndIST.getTime() + 1000)),
          ),
        );

      const checkedInIds = new Set<string>();
      for (const ev of todayCheckins) {
        const payload = (ev.payload ?? {}) as Record<string, unknown>;
        if (!checkedInIds.has(ev.staffId)) {
          checkedInIds.add(ev.staffId);
          if (payload.outsideGeofence === true) {
            centerViolationsToday += 1;
          }
        }
      }

      centerPresentToday = checkedInIds.size;
      centerAbsentToday = centerStaffList.length - centerPresentToday;
    }

    // ── Field staff attendance summary for today (IST) ────────────────────────
    const fieldStaffFilter = companyId
      ? and(eq(staffTable.companyId, companyId), eq(staffTable.staffCategory, "field"), eq(staffTable.role, "staff"), isNull(staffTable.deletedAt))
      : and(eq(staffTable.staffCategory, "field"), eq(staffTable.role, "staff"), isNull(staffTable.deletedAt));

    const fieldStaffList = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(fieldStaffFilter);

    let fieldPresentToday = 0;
    let fieldAbsentToday = 0;
    let fieldPartialToday = 0;

    if (fieldStaffList.length > 0) {
      const fieldStaffIds = fieldStaffList.map((s) => s.id);

      const todayFieldEvents = await db
        .select({
          staffId: activityEventsTable.staffId,
          kind: activityEventsTable.kind,
        })
        .from(activityEventsTable)
        .where(
          and(
            inArray(activityEventsTable.staffId, fieldStaffIds),
            inArray(activityEventsTable.kind, ["checkin", "checkout"]),
            gte(activityEventsTable.occurredAt, dayStartIST),
            lt(activityEventsTable.occurredAt, new Date(dayEndIST.getTime() + 1000)),
          ),
        );

      const checkedInField = new Set<string>();
      const checkedOutField = new Set<string>();
      for (const ev of todayFieldEvents) {
        if (ev.kind === "checkin") checkedInField.add(ev.staffId);
        if (ev.kind === "checkout") checkedOutField.add(ev.staffId);
      }

      for (const { id } of fieldStaffList) {
        if (!checkedInField.has(id)) {
          fieldAbsentToday += 1;
        } else if (checkedOutField.has(id)) {
          fieldPresentToday += 1;
        } else {
          fieldPartialToday += 1;
        }
      }
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
      centerPresentToday,
      centerAbsentToday,
      centerViolationsToday,
      totalCenterStaff: centerStaffList.length,
      totalFieldStaff: fieldStaffList.length,
      geofenceConfigured,
      fieldPresentToday,
      fieldAbsentToday,
      fieldPartialToday,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/staff/:id/deactivate ───────────────────────────────────
// Deactivate (soft-disable) a staff member.

router.patch("/admin/staff/:id/deactivate", requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!id || typeof id !== "string" || id.trim() === "") {
      res.status(400).json({ title: "Missing or invalid staff id", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
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
    if (!id || typeof id !== "string" || id.trim() === "") {
      res.status(400).json({ title: "Missing or invalid candidate id", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
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
    const id = req.params.id as string;
    if (!id || typeof id !== "string" || id.trim() === "") {
      res.status(400).json({ title: "Missing or invalid candidate id", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
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
      .set(patch as Partial<typeof candidatesTable.$inferInsert>)
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

// ─── GET /api/admin/center-attendance ─────────────────────────────────────────
// Returns per-staff, per-day attendance rows for center staff in a date range.

router.get("/admin/center-attendance", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { dateFrom, dateTo, staffId } = req.query as {
      dateFrom?: string;
      dateTo?: string;
      staffId?: string;
    };

    // Default to today in IST when not provided (matches OpenAPI optional contract)
    const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const resolvedDateFrom = dateFrom || todayIST;
    const resolvedDateTo = dateTo || todayIST;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedDateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(resolvedDateTo)) {
      res.status(400).json({ title: "Dates must be in YYYY-MM-DD format", status: 400 });
      return;
    }

    const normalizedStaffId = staffId?.trim() || undefined;
    if (normalizedStaffId && !isValidUUID(normalizedStaffId)) {
      res.status(400).json({ title: "Invalid staffId: must be a valid UUID", status: 400 });
      return;
    }

    // Fetch center staff
    const companyFilter = companyId
      ? and(eq(staffTable.companyId, companyId), eq(staffTable.staffCategory, "center"), eq(staffTable.role, "staff"))
      : and(eq(staffTable.staffCategory, "center"), eq(staffTable.role, "staff"));
    const staffFilter = normalizedStaffId
      ? and(companyFilter, eq(staffTable.id, normalizedStaffId))
      : companyFilter;

    const centerStaff = await db
      .select({
        id: staffTable.id,
        name: staffTable.name,
        empCode: staffTable.empCode,
        centerStaffRole: staffTable.centerStaffRole,
      })
      .from(staffTable)
      .where(and(staffFilter, isNull(staffTable.deletedAt)));

    if (centerStaff.length === 0) {
      res.json([]);
      return;
    }

    // IST = UTC + 5:30 = UTC + 19800 seconds
    // resolvedDateFrom 00:00 IST = resolvedDateFrom 00:00:00 - 5h30m UTC = resolvedDateFrom-1 18:30 UTC
    const fromUtc = new Date(resolvedDateFrom + "T00:00:00+05:30");
    const toUtc = new Date(resolvedDateTo + "T23:59:59+05:30");

    const staffIds = centerStaff.map((s) => s.id);

    // Fetch all checkin/checkout events for center staff in the date range
    const events = await db
      .select({
        staffId: activityEventsTable.staffId,
        kind: activityEventsTable.kind,
        occurredAt: activityEventsTable.occurredAt,
        payload: activityEventsTable.payload,
      })
      .from(activityEventsTable)
      .where(
        and(
          inArray(activityEventsTable.staffId, staffIds),
          or(
            eq(activityEventsTable.kind, "checkin"),
            eq(activityEventsTable.kind, "checkout"),
          ),
          gte(activityEventsTable.occurredAt, fromUtc),
          lt(activityEventsTable.occurredAt, new Date(toUtc.getTime() + 1000)),
        ),
      )
      .orderBy(activityEventsTable.occurredAt);

    // Generate all dates in range — use explicit UTC midnight to avoid locale drift
    const dates: string[] = [];
    const cur = new Date(resolvedDateFrom + "T00:00:00Z");
    const end = new Date(resolvedDateTo + "T00:00:00Z");
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    const IST_OFFSET = 5.5 * 60 * 60 * 1000;

    // Group events by staffId + IST date — first check-in, last check-out per day
    type EventEntry = { occurredAt: Date; payload: Record<string, unknown> };
    const eventMap = new Map<string, { checkin?: EventEntry; checkout?: EventEntry }>();
    for (const ev of events) {
      const istDate = new Date(ev.occurredAt.getTime() + IST_OFFSET).toISOString().slice(0, 10);
      const key = `${ev.staffId}|${istDate}`;
      if (!eventMap.has(key)) eventMap.set(key, {});
      const entry = eventMap.get(key)!;
      const payload = (ev.payload ?? {}) as Record<string, unknown>;
      if (ev.kind === "checkin") {
        // Keep first check-in of the day
        if (!entry.checkin) entry.checkin = { occurredAt: ev.occurredAt, payload };
      } else if (ev.kind === "checkout") {
        // Keep last check-out of the day (overwrite on each occurrence)
        entry.checkout = { occurredAt: ev.occurredAt, payload };
      }
    }

    // Build result rows
    const today = new Date(new Date().getTime() + IST_OFFSET).toISOString().slice(0, 10);
    const rows: object[] = [];

    for (const staff of centerStaff) {
      for (const date of dates) {
        const key = `${staff.id}|${date}`;
        const entry = eventMap.get(key);
        const isPast = date < today;

        const checkInTime = entry?.checkin?.occurredAt?.toISOString() ?? null;
        const checkOutTime = entry?.checkout?.occurredAt?.toISOString() ?? null;
        const ciPayload = entry?.checkin?.payload ?? {};
        const coPayload = entry?.checkout?.payload ?? {};

        let status: "present" | "partial" | "absent" = "absent";
        if (checkInTime && checkOutTime) status = "present";
        else if (checkInTime) status = "partial";

        // Skip future dates (after today) with no activity; include today and past dates
        if (status === "absent" && date > today) continue;

        rows.push({
          staffId: staff.id,
          staffName: staff.name,
          empCode: staff.empCode,
          centerStaffRole: staff.centerStaffRole ?? null,
          date,
          checkInTime,
          checkOutTime,
          status,
          checkInOutsideGeofence: (ciPayload.outsideGeofence as boolean | null) ?? null,
          checkOutOutsideGeofence: (coPayload.outsideGeofence as boolean | null) ?? null,
          checkInDistanceM: (ciPayload.distanceFromCenterM as number | null) ?? null,
          checkOutDistanceM: (coPayload.distanceFromCenterM as number | null) ?? null,
        });
      }
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/center-attendance/xlsx ────────────────────────────────────
// Generates a styled ExcelJS attendance workbook for center staff.

router.get("/admin/center-attendance/xlsx", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { dateFrom, dateTo, staffId, status: statusFilter } = req.query as {
      dateFrom?: string;
      dateTo?: string;
      staffId?: string;
      status?: string;
    };

    const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const resolvedDateFrom = dateFrom || todayIST;
    const resolvedDateTo   = dateTo   || todayIST;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedDateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(resolvedDateTo)) {
      res.status(400).json({ title: "Dates must be in YYYY-MM-DD format", status: 400 });
      return;
    }

    // Resolve organization name
    let organization: string | null = null;
    if (companyId) {
      try {
        const [co] = await db
          .select({ name: companiesTable.name, projectName: companiesTable.projectName })
          .from(companiesTable)
          .where(eq(companiesTable.id, companyId))
          .limit(1);
        if (co) {
          organization = co.projectName ? `${co.name} — ${co.projectName}` : co.name;
        }
      } catch { /* non-fatal */ }
    }

    const normalizedStaffId = staffId?.trim() || undefined;
    if (normalizedStaffId && !isValidUUID(normalizedStaffId)) {
      res.status(400).json({ title: "Invalid staffId: must be a valid UUID", status: 400 });
      return;
    }

    const companyFilter = companyId
      ? and(eq(staffTable.companyId, companyId), eq(staffTable.staffCategory, "center"), eq(staffTable.role, "staff"))
      : and(eq(staffTable.staffCategory, "center"), eq(staffTable.role, "staff"));
    const staffFilter = normalizedStaffId
      ? and(companyFilter, eq(staffTable.id, normalizedStaffId))
      : companyFilter;

    const centerStaff = await db
      .select({ id: staffTable.id, name: staffTable.name, empCode: staffTable.empCode, centerStaffRole: staffTable.centerStaffRole })
      .from(staffTable)
      .where(and(staffFilter, isNull(staffTable.deletedAt)));

    const fromUtc = new Date(resolvedDateFrom + "T00:00:00+05:30");
    const toUtc   = new Date(resolvedDateTo   + "T23:59:59+05:30");
    const staffIds = centerStaff.map((s) => s.id);

    const events = staffIds.length > 0
      ? await db
          .select({ staffId: activityEventsTable.staffId, kind: activityEventsTable.kind, occurredAt: activityEventsTable.occurredAt, payload: activityEventsTable.payload })
          .from(activityEventsTable)
          .where(and(
            inArray(activityEventsTable.staffId, staffIds),
            or(eq(activityEventsTable.kind, "checkin"), eq(activityEventsTable.kind, "checkout")),
            gte(activityEventsTable.occurredAt, fromUtc),
            lt(activityEventsTable.occurredAt, new Date(toUtc.getTime() + 1000)),
          ))
          .orderBy(activityEventsTable.occurredAt)
      : [];

    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    type EventEntry = { occurredAt: Date; payload: Record<string, unknown> };
    const eventMap = new Map<string, { checkin?: EventEntry; checkout?: EventEntry }>();
    for (const ev of events) {
      const istDate = new Date(ev.occurredAt.getTime() + IST_OFFSET).toISOString().slice(0, 10);
      const key = `${ev.staffId}|${istDate}`;
      if (!eventMap.has(key)) eventMap.set(key, {});
      const entry = eventMap.get(key)!;
      const payload = (ev.payload ?? {}) as Record<string, unknown>;
      if (ev.kind === "checkin") { if (!entry.checkin) entry.checkin = { occurredAt: ev.occurredAt, payload }; }
      else if (ev.kind === "checkout") { entry.checkout = { occurredAt: ev.occurredAt, payload }; }
    }

    function toISTTime(d: Date): string {
      const local = new Date(d.getTime() + IST_OFFSET);
      return local.toISOString().slice(11, 16);
    }

    function fmtRole(role: string | null | undefined): string {
      if (!role) return "";
      return role.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
    }

    const dates: string[] = [];
    const cur = new Date(resolvedDateFrom + "T00:00:00Z");
    const end = new Date(resolvedDateTo   + "T00:00:00Z");
    while (cur <= end) { dates.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }

    const today = new Date(Date.now() + IST_OFFSET).toISOString().slice(0, 10);

    type AttendRow = {
      staffName: string; empCode: string; role: string; date: string;
      checkIn: string; checkOut: string; durationHours: string;
      geoIn: string; geoOut: string;
    };
    const attendRows: AttendRow[] = [];

    for (const staff of centerStaff) {
      for (const date of dates) {
        const entry = eventMap.get(`${staff.id}|${date}`);
        const hasCheckin  = !!entry?.checkin;
        const hasCheckout = !!entry?.checkout;
        if (!hasCheckin && !hasCheckout && date > today) continue;

        let rowStatus: "present" | "partial" | "absent" = "absent";
        if (hasCheckin && hasCheckout) rowStatus = "present";
        else if (hasCheckin) rowStatus = "partial";

        const ciPayload = entry?.checkin?.payload ?? {};
        const coPayload = entry?.checkout?.payload ?? {};
        const ciOutside = (ciPayload.outsideGeofence as boolean | null) ?? null;
        const coOutside = (coPayload.outsideGeofence as boolean | null) ?? null;
        const ciDist    = (ciPayload.distanceFromCenterM as number | null) ?? null;
        const coDist    = (coPayload.distanceFromCenterM as number | null) ?? null;

        // Apply status filter (including "violations")
        if (statusFilter === "violations") {
          if (ciOutside !== true && coOutside !== true) continue;
        } else if (statusFilter && rowStatus !== statusFilter) {
          continue;
        }

        const checkIn  = hasCheckin  ? toISTTime(entry!.checkin!.occurredAt)  : "";
        const checkOut = hasCheckout ? toISTTime(entry!.checkout!.occurredAt) : "";
        let durationHours = "";
        if (hasCheckin && hasCheckout && entry!.checkout!.occurredAt > entry!.checkin!.occurredAt) {
          const diffMs = entry!.checkout!.occurredAt.getTime() - entry!.checkin!.occurredAt.getTime();
          const hrs    = diffMs / (1000 * 60 * 60);
          durationHours = `${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m`;
        }

        const fmtGeo = (outside: boolean | null, distM: number | null) => {
          if (outside === null) return "N/A";
          return outside ? `Outside${distM != null ? ` (${distM}m)` : ""}` : `Inside${distM != null ? ` (${distM}m)` : ""}`;
        };

        attendRows.push({
          staffName: staff.name,
          empCode: staff.empCode ?? "",
          role: fmtRole(staff.centerStaffRole),
          date,
          checkIn,
          checkOut,
          durationHours,
          geoIn:  fmtGeo(ciOutside, ciDist),
          geoOut: fmtGeo(coOutside, coDist),
        });
      }
    }
    attendRows.sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));

    // Build ExcelJS workbook
    const wb = new ExcelJS.Workbook();
    wb.creator  = "Nistha Skill";
    wb.modified = new Date();

    const A_COLS = 9;
    const ws = wb.addWorksheet("Attendance", { properties: { tabColor: { argb: PURPLE } } });
    ws.columns = [
      { width: 24 }, { width: 13 }, { width: 18 },
      { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 16 }, { width: 16 },
    ];

    // Row 1 — organization
    ws.mergeCells(1, 1, 1, A_COLS);
    const r1 = ws.getCell(1, 1);
    r1.value     = organization ?? "Jharkhand Skill Development Mission Society (JSDMS) / DDU-KK";
    r1.font      = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
    r1.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
    r1.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 26;

    // Row 2 — title
    ws.mergeCells(2, 1, 2, A_COLS);
    const r2 = ws.getCell(2, 1);
    r2.value     = "CENTER ATTENDANCE SUMMARY";
    r2.font      = { bold: true, size: 14, color: { argb: AMBER }, name: "Calibri" };
    r2.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
    r2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 26;

    // Row 3 — period
    const staffPart = staffId && centerStaff.length === 1 ? `Staff: ${centerStaff[0].name}   |   ` : "";
    ws.mergeCells(3, 1, 3, A_COLS);
    const r3 = ws.getCell(3, 1);
    r3.value     = `${staffPart}Period: ${resolvedDateFrom}  →  ${resolvedDateTo}   |   ${attendRows.length} attendance record(s)`;
    r3.font      = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    r3.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE_DK } };
    r3.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(3).height = 18;

    // Row 4 — spacer
    ws.getRow(4).height = 8;

    // Row 5 — column headers
    const A_HDRS = ["Staff Name", "EMP ID", "Role", "Date", "Check-In\nTime", "Check-Out\nTime", "Hours on\nDuty", "Geo\nCheck-In", "Geo\nCheck-Out"];
    const hdr = ws.getRow(5);
    hdr.height = 32;
    A_HDRS.forEach((h, ci) => {
      const cell = hdr.getCell(ci + 1);
      cell.value     = h;
      cell.font      = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border    = { bottom: { style: "thin", color: { argb: AMBER } } };
    });

    // Data rows
    const altFill:     ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
    const partialFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    const violFill:    ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
    let rowNum = 6;
    for (const [idx, r] of attendRows.entries()) {
      const dr = ws.getRow(rowNum);
      dr.height = 16;
      const isViolation = r.geoIn.startsWith("Outside") || r.geoOut.startsWith("Outside");
      const isPartial   = !r.checkIn || !r.checkOut;
      const fill = isViolation ? violFill : isPartial ? partialFill : idx % 2 === 1 ? altFill : undefined;
      [r.staffName, r.empCode, r.role, r.date, r.checkIn, r.checkOut, r.durationHours, r.geoIn, r.geoOut].forEach((val, ci) => {
        const cell = dr.getCell(ci + 1);
        cell.value     = val;
        cell.font      = { size: 9, name: "Calibri", color: { argb: "FF111827" } };
        cell.alignment = { horizontal: ci >= 4 ? "center" : "left", vertical: "middle" };
        if (fill) cell.fill = fill;
        cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
      });
      rowNum++;
    }

    // Footer
    rowNum++;
    const totalPresent = attendRows.filter((r) => r.checkIn && r.checkOut).length;
    const totalPartial = attendRows.filter((r) => r.checkIn && !r.checkOut).length;
    const totalAbsent  = attendRows.filter((r) => !r.checkIn).length;
    const totalViol    = attendRows.filter((r) => r.geoIn.startsWith("Outside") || r.geoOut.startsWith("Outside")).length;
    ws.mergeCells(rowNum, 1, rowNum, A_COLS);
    const footer = ws.getCell(rowNum, 1);
    footer.value     = `Total: ${attendRows.length} record(s)   |   ${totalPresent} present   |   ${totalPartial} check-out pending   |   ${totalAbsent} absent   |   ${totalViol} geofence violation(s)`;
    footer.font      = { bold: true, size: 9, color: { argb: WHITE } };
    footer.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
    footer.alignment = { horizontal: "center" };
    ws.getRow(rowNum).height = 18;

    const fname = `center-attendance-${resolvedDateFrom}-to-${resolvedDateTo}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/field-attendance ──────────────────────────────────────────
// Returns per-staff, per-day attendance rows for field staff in a date range.

router.get("/admin/field-attendance", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { dateFrom, dateTo, staffId } = req.query as {
      dateFrom?: string;
      dateTo?: string;
      staffId?: string;
    };

    const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const resolvedDateFrom = dateFrom || todayIST;
    const resolvedDateTo = dateTo || todayIST;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedDateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(resolvedDateTo)) {
      res.status(400).json({ title: "Dates must be in YYYY-MM-DD format", status: 400 });
      return;
    }

    const normalizedStaffId = staffId?.trim() || undefined;
    if (normalizedStaffId && !isValidUUID(normalizedStaffId)) {
      res.status(400).json({ title: "Invalid staffId: must be a valid UUID", status: 400 });
      return;
    }

    const companyFilter = companyId
      ? and(eq(staffTable.companyId, companyId), eq(staffTable.staffCategory, "field"), eq(staffTable.role, "staff"))
      : and(eq(staffTable.staffCategory, "field"), eq(staffTable.role, "staff"));
    const staffFilter = normalizedStaffId
      ? and(companyFilter, eq(staffTable.id, normalizedStaffId))
      : companyFilter;

    const fieldStaff = await db
      .select({
        id: staffTable.id,
        name: staffTable.name,
        empCode: staffTable.empCode,
      })
      .from(staffTable)
      .where(and(staffFilter, isNull(staffTable.deletedAt)));

    if (fieldStaff.length === 0) {
      res.json([]);
      return;
    }

    const fromUtc = new Date(resolvedDateFrom + "T00:00:00+05:30");
    const toUtc = new Date(resolvedDateTo + "T23:59:59+05:30");
    const staffIds = fieldStaff.map((s) => s.id);

    const events = await db
      .select({
        staffId: activityEventsTable.staffId,
        kind: activityEventsTable.kind,
        occurredAt: activityEventsTable.occurredAt,
      })
      .from(activityEventsTable)
      .where(
        and(
          inArray(activityEventsTable.staffId, staffIds),
          or(
            eq(activityEventsTable.kind, "checkin"),
            eq(activityEventsTable.kind, "checkout"),
          ),
          gte(activityEventsTable.occurredAt, fromUtc),
          lt(activityEventsTable.occurredAt, new Date(toUtc.getTime() + 1000)),
        ),
      )
      .orderBy(activityEventsTable.occurredAt);

    const dates: string[] = [];
    const cur = new Date(resolvedDateFrom + "T00:00:00Z");
    const end = new Date(resolvedDateTo + "T00:00:00Z");
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const eventMap = new Map<string, { checkin?: Date; checkout?: Date }>();
    for (const ev of events) {
      const istDate = new Date(ev.occurredAt.getTime() + IST_OFFSET).toISOString().slice(0, 10);
      const key = `${ev.staffId}|${istDate}`;
      if (!eventMap.has(key)) eventMap.set(key, {});
      const entry = eventMap.get(key)!;
      if (ev.kind === "checkin") {
        if (!entry.checkin) entry.checkin = ev.occurredAt;
      } else if (ev.kind === "checkout") {
        entry.checkout = ev.occurredAt;
      }
    }

    const today = new Date(new Date().getTime() + IST_OFFSET).toISOString().slice(0, 10);
    const rows: object[] = [];

    for (const staff of fieldStaff) {
      for (const date of dates) {
        const key = `${staff.id}|${date}`;
        const entry = eventMap.get(key);

        const checkInTime = entry?.checkin?.toISOString() ?? null;
        const checkOutTime = entry?.checkout?.toISOString() ?? null;

        let status: "present" | "partial" | "absent" = "absent";
        if (checkInTime && checkOutTime) status = "present";
        else if (checkInTime) status = "partial";

        if (status === "absent" && date > today) continue;

        rows.push({
          staffId: staff.id,
          staffName: staff.name,
          empCode: staff.empCode,
          date,
          checkInTime,
          checkOutTime,
          status,
        });
      }
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/field-attendance/xlsx ─────────────────────────────────────
// Generates a styled ExcelJS attendance workbook for field staff.

router.get("/admin/field-attendance/xlsx", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { dateFrom, dateTo, staffId, status: statusFilter, category: categoryFilter } = req.query as {
      dateFrom?: string;
      dateTo?: string;
      staffId?: string;
      status?: string;
      category?: string;
    };

    const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const resolvedDateFrom = dateFrom || todayIST;
    const resolvedDateTo   = dateTo   || todayIST;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedDateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(resolvedDateTo)) {
      res.status(400).json({ title: "Dates must be in YYYY-MM-DD format", status: 400 });
      return;
    }

    // Resolve organization name
    let organization: string | null = null;
    if (companyId) {
      try {
        const [co] = await db
          .select({ name: companiesTable.name, projectName: companiesTable.projectName })
          .from(companiesTable)
          .where(eq(companiesTable.id, companyId))
          .limit(1);
        if (co) {
          organization = co.projectName ? `${co.name} — ${co.projectName}` : co.name;
        }
      } catch { /* non-fatal */ }
    }

    const normalizedStaffId = staffId?.trim() || undefined;
    if (normalizedStaffId && !isValidUUID(normalizedStaffId)) {
      res.status(400).json({ title: "Invalid staffId: must be a valid UUID", status: 400 });
      return;
    }

    const companyFilter = companyId
      ? and(eq(staffTable.companyId, companyId), eq(staffTable.staffCategory, "field"), eq(staffTable.role, "staff"))
      : and(eq(staffTable.staffCategory, "field"), eq(staffTable.role, "staff"));
    const staffFilter = normalizedStaffId
      ? and(companyFilter, eq(staffTable.id, normalizedStaffId))
      : companyFilter;

    const fieldStaff = await db
      .select({ id: staffTable.id, name: staffTable.name, empCode: staffTable.empCode, phone: staffTable.phone, staffCategory: staffTable.staffCategory })
      .from(staffTable)
      .where(and(staffFilter, isNull(staffTable.deletedAt)));

    const fromUtc = new Date(resolvedDateFrom + "T00:00:00+05:30");
    const toUtc   = new Date(resolvedDateTo   + "T23:59:59+05:30");
    const staffIds = fieldStaff.map((s) => s.id);

    const events = staffIds.length > 0
      ? await db
          .select({ staffId: activityEventsTable.staffId, kind: activityEventsTable.kind, occurredAt: activityEventsTable.occurredAt })
          .from(activityEventsTable)
          .where(and(
            inArray(activityEventsTable.staffId, staffIds),
            or(eq(activityEventsTable.kind, "checkin"), eq(activityEventsTable.kind, "checkout")),
            gte(activityEventsTable.occurredAt, fromUtc),
            lt(activityEventsTable.occurredAt, new Date(toUtc.getTime() + 1000)),
          ))
          .orderBy(activityEventsTable.occurredAt)
      : [];

    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const eventMap = new Map<string, { checkin?: Date; checkout?: Date }>();
    for (const ev of events) {
      const istDate = new Date(ev.occurredAt.getTime() + IST_OFFSET).toISOString().slice(0, 10);
      const key = `${ev.staffId}|${istDate}`;
      if (!eventMap.has(key)) eventMap.set(key, {});
      const entry = eventMap.get(key)!;
      if (ev.kind === "checkin") { if (!entry.checkin) entry.checkin = ev.occurredAt; }
      else if (ev.kind === "checkout") { entry.checkout = ev.occurredAt; }
    }

    function toISTTime(d: Date): string {
      const local = new Date(d.getTime() + IST_OFFSET);
      return local.toISOString().slice(11, 16);
    }

    const dates: string[] = [];
    const cur = new Date(resolvedDateFrom + "T00:00:00Z");
    const end = new Date(resolvedDateTo   + "T00:00:00Z");
    while (cur <= end) { dates.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }

    const today = new Date(Date.now() + IST_OFFSET).toISOString().slice(0, 10);

    type AttendRow = { staffName: string; empCode: string; mobile: string; date: string; checkIn: string; checkOut: string; durationHours: string; };
    const attendRows: AttendRow[] = [];

    const staffCategoryMap = new Map(fieldStaff.map((s) => [s.id, s.staffCategory ?? ""]));

    for (const staff of fieldStaff) {
      // Apply category filter: skip staff whose category doesn't match
      if (categoryFilter && staffCategoryMap.get(staff.id) !== categoryFilter) continue;

      for (const date of dates) {
        const entry = eventMap.get(`${staff.id}|${date}`);
        const hasCheckin  = !!entry?.checkin;
        const hasCheckout = !!entry?.checkout;
        if (!hasCheckin && !hasCheckout && date > today) continue;

        // Compute row status for filter matching
        let rowStatus: "present" | "partial" | "absent" = "absent";
        if (hasCheckin && hasCheckout) rowStatus = "present";
        else if (hasCheckin) rowStatus = "partial";

        // Apply status filter
        if (statusFilter && rowStatus !== statusFilter) continue;

        const checkIn  = hasCheckin  ? toISTTime(entry!.checkin!)  : "";
        const checkOut = hasCheckout ? toISTTime(entry!.checkout!) : "";
        let durationHours = "";
        if (hasCheckin && hasCheckout && entry!.checkout! > entry!.checkin!) {
          const diffMs = entry!.checkout!.getTime() - entry!.checkin!.getTime();
          const hrs    = diffMs / (1000 * 60 * 60);
          durationHours = `${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m`;
        }
        attendRows.push({ staffName: staff.name, empCode: staff.empCode ?? "", mobile: staff.phone ?? "", date, checkIn, checkOut, durationHours });
      }
    }
    attendRows.sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));

    // Build ExcelJS workbook
    const wb = new ExcelJS.Workbook();
    wb.creator  = "Nistha Skill";
    wb.modified = new Date();

    const A_COLS = 7;
    const ws = wb.addWorksheet("Attendance", { properties: { tabColor: { argb: PURPLE } } });
    ws.columns = [
      { width: 24 }, { width: 13 }, { width: 14 },
      { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 },
    ];

    // Row 1 — organization
    ws.mergeCells(1, 1, 1, A_COLS);
    const r1 = ws.getCell(1, 1);
    r1.value     = organization ?? "Jharkhand Skill Development Mission Society (JSDMS) / DDU-KK";
    r1.font      = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
    r1.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
    r1.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 26;

    // Row 2 — title
    ws.mergeCells(2, 1, 2, A_COLS);
    const r2 = ws.getCell(2, 1);
    r2.value     = "FIELD ATTENDANCE SUMMARY";
    r2.font      = { bold: true, size: 14, color: { argb: AMBER }, name: "Calibri" };
    r2.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
    r2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 26;

    // Row 3 — period
    const staffPart = staffId && fieldStaff.length === 1 ? `Staff: ${fieldStaff[0].name}   |   ` : "";
    ws.mergeCells(3, 1, 3, A_COLS);
    const r3 = ws.getCell(3, 1);
    r3.value     = `${staffPart}Period: ${resolvedDateFrom}  →  ${resolvedDateTo}   |   ${attendRows.length} attendance record(s)`;
    r3.font      = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    r3.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE_DK } };
    r3.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(3).height = 18;

    // Row 4 — spacer
    ws.getRow(4).height = 8;

    // Row 5 — column headers
    const A_HDRS = ["Staff Name", "EMP ID", "Mobile No.", "Date", "Check-In\nTime", "Check-Out\nTime", "Hours on\nDuty"];
    const hdr = ws.getRow(5);
    hdr.height = 32;
    A_HDRS.forEach((h, ci) => {
      const cell = hdr.getCell(ci + 1);
      cell.value     = h;
      cell.font      = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border    = { bottom: { style: "thin", color: { argb: AMBER } } };
    });

    // Data rows
    const altFill:     ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
    const partialFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    let rowNum = 6;
    for (const [idx, r] of attendRows.entries()) {
      const dr = ws.getRow(rowNum);
      dr.height = 16;
      const isPartial = !r.checkIn || !r.checkOut;
      const fill = isPartial ? partialFill : idx % 2 === 1 ? altFill : undefined;
      [r.staffName, r.empCode, r.mobile, r.date, r.checkIn, r.checkOut, r.durationHours].forEach((val, ci) => {
        const cell = dr.getCell(ci + 1);
        cell.value     = val;
        cell.font      = { size: 9, name: "Calibri", color: { argb: "FF111827" } };
        cell.alignment = { horizontal: ci >= 4 ? "center" : "left", vertical: "middle" };
        if (fill) cell.fill = fill;
        cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
      });
      rowNum++;
    }

    // Footer
    rowNum++;
    const totalPresent = attendRows.filter((r) => r.checkIn && r.checkOut).length;
    const totalPartial = attendRows.filter((r) => r.checkIn && !r.checkOut).length;
    const totalAbsent  = attendRows.filter((r) => !r.checkIn).length;
    ws.mergeCells(rowNum, 1, rowNum, A_COLS);
    const footer = ws.getCell(rowNum, 1);
    footer.value     = `Total: ${attendRows.length} record(s)   |   ${totalPresent} present   |   ${totalPartial} check-out pending   |   ${totalAbsent} absent`;
    footer.font      = { bold: true, size: 9, color: { argb: WHITE } };
    footer.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
    footer.alignment = { horizontal: "center" };
    ws.getRow(rowNum).height = 18;

    const fname = `field-attendance-${resolvedDateFrom}-to-${resolvedDateTo}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/hints ─────────────────────────────────────────────────────
// Returns the list of dismissed dashboard hint keys for the authenticated admin.

router.get("/admin/hints", requireAdmin, async (req, res, next) => {
  try {
    const phone =
      (req.headers["x-admin-phone"] as string | undefined) ??
      (req.query.adminPhone as string | undefined);
    if (!phone) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }
    const [row] = await db
      .select({ dismissedHints: staffTable.dismissedHints })
      .from(staffTable)
      .where(eq(staffTable.phone, phone.trim()))
      .limit(1);
    let hints: string[] = [];
    if (row?.dismissedHints) {
      try { hints = JSON.parse(row.dismissedHints); } catch { hints = []; }
    }
    res.json({ dismissedHints: hints });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/hints/dismiss ────────────────────────────────────────────
// Adds a hint key to the dismissed list for the authenticated admin.

router.post("/admin/hints/dismiss", requireAdmin, async (req, res, next) => {
  try {
    const phone =
      (req.headers["x-admin-phone"] as string | undefined) ??
      (req.query.adminPhone as string | undefined);
    if (!phone) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }
    const { key } = req.body as { key?: string };
    if (!key?.trim()) {
      res.status(400).json({ title: "key is required", status: 400 });
      return;
    }
    const [row] = await db
      .select({ dismissedHints: staffTable.dismissedHints })
      .from(staffTable)
      .where(eq(staffTable.phone, phone.trim()))
      .limit(1);
    let hints: string[] = [];
    if (row?.dismissedHints) {
      try { hints = JSON.parse(row.dismissedHints); } catch { hints = []; }
    }
    if (!hints.includes(key.trim())) {
      hints = [...hints, key.trim()];
      await db
        .update(staffTable)
        .set({ dismissedHints: JSON.stringify(hints) })
        .where(eq(staffTable.phone, phone.trim()));
    }
    res.json({ dismissedHints: hints });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/hints/restore ───────────────────────────────────────────
// Removes a single hint key from the dismissed list for the authenticated admin.

router.post("/admin/hints/restore", requireAdmin, async (req, res, next) => {
  try {
    const phone =
      (req.headers["x-admin-phone"] as string | undefined) ??
      (req.query.adminPhone as string | undefined);
    if (!phone) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }
    const { key } = req.body as { key?: string };
    if (!key?.trim()) {
      res.status(400).json({ title: "key is required", status: 400 });
      return;
    }
    const [row] = await db
      .select({ dismissedHints: staffTable.dismissedHints })
      .from(staffTable)
      .where(eq(staffTable.phone, phone.trim()))
      .limit(1);
    let hints: string[] = [];
    if (row?.dismissedHints) {
      try { hints = JSON.parse(row.dismissedHints); } catch { hints = []; }
    }
    const filtered = hints.filter((h) => h !== key.trim());
    if (filtered.length !== hints.length) {
      await db
        .update(staffTable)
        .set({ dismissedHints: filtered.length > 0 ? JSON.stringify(filtered) : null })
        .where(eq(staffTable.phone, phone.trim()));
    }
    res.json({ dismissedHints: filtered });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/hints ──────────────────────────────────────────────────
// Clears all dismissed hint keys for the authenticated admin.

router.delete("/admin/hints", requireAdmin, async (req, res, next) => {
  try {
    const phone =
      (req.headers["x-admin-phone"] as string | undefined) ??
      (req.query.adminPhone as string | undefined);
    if (!phone) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }
    await db
      .update(staffTable)
      .set({ dismissedHints: null })
      .where(eq(staffTable.phone, phone.trim()));
    res.json({ dismissedHints: [] });
  } catch (err) {
    next(err);
  }
});

export default router;
