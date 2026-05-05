import {
  activityEventsTable,
  candidateAuditLogTable,
  candidateNotificationsTable,
  candidatesTable,
  centersTable,
  companiesTable,
  db,
  staffTable,
} from "@workspace/db";
import { and, count, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { isValidUUID } from "../lib/validation";
import { toCompanyDTO } from "./companies";

const router: IRouter = Router();

// ─── Super admin auth helpers ──────────────────────────────────────────────────

export async function isSuperAdmin(phone: string): Promise<boolean> {
  if (!phone?.trim()) return false;
  const [row] = await db
    .select({ role: staffTable.role })
    .from(staffTable)
    .where(and(eq(staffTable.phone, phone.trim()), isNull(staffTable.deletedAt)))
    .limit(1);
  return row?.role === "super_admin";
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const phone =
    (req.headers["x-admin-phone"] as string | undefined) ??
    (req.query.adminPhone as string | undefined) ??
    (req.body as Record<string, string>)?.adminPhone;

  if (!phone) {
    res.status(401).json({ title: "Unauthorized: phone required", status: 401 });
    return;
  }
  isSuperAdmin(phone)
    .then((ok) => {
      if (!ok) {
        res.status(403).json({ title: "Forbidden: super admin only", status: 403 });
        return;
      }
      next();
    })
    .catch(next);
}

// ─── POST /api/super-admin/seed ───────────────────────────────────────────────
// Create the first super admin. Protected by SUPER_ADMIN_KEY env var.

router.post("/super-admin/seed", async (req, res, next) => {
  try {
    const { name, phone, email, superAdminKey } = req.body as {
      name?: string;
      phone?: string;
      email?: string | null;
      superAdminKey?: string | null;
    };

    const requiredKey = process.env.SUPER_ADMIN_KEY;
    if (!requiredKey) {
      res.status(503).json({ title: "Super admin seeding is not configured on this server", status: 503 });
      return;
    }
    if (!superAdminKey || superAdminKey.trim() !== requiredKey.trim()) {
      res.status(403).json({ title: "Invalid super admin key", status: 403 });
      return;
    }

    if (!name || name.trim().length < 2) {
      res.status(400).json({ title: "Name required (min 2 chars)", status: 400 });
      return;
    }
    if (!phone || !/^\d{10}$/.test(phone.trim())) {
      res.status(400).json({ title: "Phone must be 10 digits", status: 400 });
      return;
    }

    // Upsert: if phone already exists, upgrade role to super_admin
    const [existing] = await db
      .select({ id: staffTable.id, role: staffTable.role })
      .from(staffTable)
      .where(eq(staffTable.phone, phone.trim()))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(staffTable)
        .set({ role: "super_admin", companyId: null })
        .where(eq(staffTable.id, existing.id))
        .returning();
      res.json({
        message: "Super admin role granted to existing user",
        id: updated.id,
        phone: updated.phone,
        role: updated.role,
      });
      return;
    }

    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const [inserted] = await db
      .insert(staffTable)
      .values({
        companyId: null,
        empCode: `SA-${suffix}`,
        name: name.trim(),
        phone: phone.trim(),
        role: "super_admin",
        email: email?.trim() || null,
        approvalStatus: "approved",
      })
      .returning();

    res.status(201).json({
      message: "Super admin created",
      id: inserted.id,
      phone: inserted.phone,
      empCode: inserted.empCode,
      role: inserted.role,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/super-admin/companies ───────────────────────────────────────────

router.get("/super-admin/companies", requireSuperAdmin, async (_req, res, next) => {
  try {
    const companies = await db.select().from(companiesTable).orderBy(companiesTable.createdAt);
    res.json(companies.map(toCompanyDTO));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/super-admin/pending-companies ────────────────────────────────────
// List companies with approvalStatus = 'pending'

router.get("/super-admin/pending-companies", requireSuperAdmin, async (_req, res, next) => {
  try {
    const companies = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.approvalStatus, "pending"))
      .orderBy(companiesTable.createdAt);
    res.json(companies.map(toCompanyDTO));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super-admin/companies/:id/approve ──────────────────────────────
// Approve a pending company and its admin(s).

router.post("/super-admin/companies/:id/approve", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "Invalid company id", status: 400 });
      return;
    }
    const [company] = await db
      .update(companiesTable)
      .set({ approvalStatus: "approved" })
      .where(eq(companiesTable.id, id))
      .returning();
    if (!company) {
      res.status(404).json({ title: "Company not found", status: 404 });
      return;
    }
    // Also approve all pending admins for this company
    await db
      .update(staffTable)
      .set({ approvalStatus: "approved" })
      .where(and(eq(staffTable.companyId, id), eq(staffTable.role, "admin"), eq(staffTable.approvalStatus, "pending")));
    res.json({ message: "Company approved successfully", company: toCompanyDTO(company) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super-admin/companies/:id/reject ───────────────────────────────
// Reject a pending company.

router.post("/super-admin/companies/:id/reject", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "Invalid company id", status: 400 });
      return;
    }
    const [company] = await db
      .update(companiesTable)
      .set({ approvalStatus: "rejected" })
      .where(eq(companiesTable.id, id))
      .returning();
    if (!company) {
      res.status(404).json({ title: "Company not found", status: 404 });
      return;
    }
    await db
      .update(staffTable)
      .set({ approvalStatus: "rejected" })
      .where(and(eq(staffTable.companyId, id), eq(staffTable.role, "admin"), eq(staffTable.approvalStatus, "pending")));
    res.json({ message: "Company rejected", company: toCompanyDTO(company) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/super-admin/pending-centers ─────────────────────────────────────
// List training centers with approvalStatus = 'pending'

router.get("/super-admin/pending-centers", requireSuperAdmin, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: centersTable.id,
        companyId: centersTable.companyId,
        companyName: companiesTable.name,
        name: centersTable.name,
        tcId: centersTable.tcId,
        state: centersTable.state,
        district: centersTable.district,
        block: centersTable.block,
        pinCode: centersTable.pinCode,
        courses: centersTable.courses,
        approvalStatus: centersTable.approvalStatus,
        createdAt: centersTable.createdAt,
      })
      .from(centersTable)
      .leftJoin(companiesTable, eq(centersTable.companyId, companiesTable.id))
      .where(eq(centersTable.approvalStatus, "pending"))
      .orderBy(centersTable.createdAt);
    res.json(rows.map((r) => ({
      ...r,
      companyName: r.companyName ?? null,
      courses: (r.courses as string[] | null) ?? [],
      createdAt: r.createdAt?.toISOString() ?? null,
    })));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super-admin/centers/:id/approve ────────────────────────────────
// Approve a pending training center.

router.post("/super-admin/centers/:id/approve", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "Invalid center id", status: 400 });
      return;
    }
    const [center] = await db
      .update(centersTable)
      .set({ approvalStatus: "approved" })
      .where(eq(centersTable.id, id))
      .returning();
    if (!center) {
      res.status(404).json({ title: "Center not found", status: 404 });
      return;
    }
    res.json({ message: "Center approved successfully", centerId: center.id, name: center.name });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super-admin/centers/:id/reject ─────────────────────────────────
// Reject a pending training center.

router.post("/super-admin/centers/:id/reject", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "Invalid center id", status: 400 });
      return;
    }
    const [center] = await db
      .update(centersTable)
      .set({ approvalStatus: "rejected" })
      .where(eq(centersTable.id, id))
      .returning();
    if (!center) {
      res.status(404).json({ title: "Center not found", status: 404 });
      return;
    }
    res.json({ message: "Center rejected", centerId: center.id, name: center.name });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/super-admin/companies/:id/stats ─────────────────────────────────

router.get("/super-admin/companies/:id/stats", requireSuperAdmin, async (req, res, next) => {
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
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, id))
      .limit(1);
    if (!company) {
      res.status(404).json({ title: "Company not found", status: 404 });
      return;
    }

    const [staffCount] = await db
      .select({ count: count() })
      .from(staffTable)
      .where(and(eq(staffTable.companyId, id), isNull(staffTable.deletedAt)));

    const [candidateCount] = await db
      .select({ count: count() })
      .from(candidatesTable)
      .where(eq(candidatesTable.companyId, id));

    const [activityCount] = await db
      .select({ count: count() })
      .from(activityEventsTable)
      .where(eq(activityEventsTable.companyId, id));

    res.json({
      company: toCompanyDTO(company),
      stats: {
        staffCount: Number(staffCount?.count ?? 0),
        candidateCount: Number(candidateCount?.count ?? 0),
        activityCount: Number(activityCount?.count ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/super-admin/companies/:id ─────────────────────────────────────

router.patch("/super-admin/companies/:id", requireSuperAdmin, async (req, res, next) => {
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
    const {
      status, subscriptionActive, name, projectName, state, district,
      plan, subscriptionStartDate, subscriptionEndDate, paymentStatus,
    } = req.body as {
      status?: "active" | "inactive";
      subscriptionActive?: boolean;
      name?: string;
      projectName?: string | null;
      state?: string | null;
      district?: string | null;
      plan?: "basic" | "standard" | "premium" | null;
      subscriptionStartDate?: string | null;
      subscriptionEndDate?: string | null;
      paymentStatus?: "paid" | "pending" | "expired" | null;
    };

    const updates: Partial<typeof companiesTable.$inferInsert> = {};
    if (status !== undefined) updates.status = status;
    if (subscriptionActive !== undefined) updates.subscriptionActive = subscriptionActive;
    if (name !== undefined) updates.name = name.trim();
    if (projectName !== undefined) updates.projectName = projectName?.trim() || null;
    if (state !== undefined) updates.state = state?.trim() || null;
    if (district !== undefined) updates.district = district?.trim() || null;
    if (plan !== undefined) updates.plan = plan ?? undefined;
    if (subscriptionStartDate !== undefined) {
      updates.subscriptionStartDate = subscriptionStartDate ? new Date(subscriptionStartDate) : null;
    }
    if (subscriptionEndDate !== undefined) {
      updates.subscriptionEndDate = subscriptionEndDate ? new Date(subscriptionEndDate) : null;
    }
    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus ?? undefined;

    const [updated] = await db
      .update(companiesTable)
      .set(updates)
      .where(eq(companiesTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ title: "Company not found", status: 404 });
      return;
    }
    res.json(toCompanyDTO(updated));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super-admin/companies/:id/reset-admin ──────────────────────────
// Reset the admin of a company (clear their MPIN so they must re-setup).

router.post(
  "/super-admin/companies/:id/reset-admin",
  requireSuperAdmin,
  async (req, res, next) => {
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
      // Find admin user for this company
      const [admin] = await db
        .select({ id: staffTable.id, name: staffTable.name, phone: staffTable.phone })
        .from(staffTable)
        .where(and(eq(staffTable.companyId, id), eq(staffTable.role, "admin"), isNull(staffTable.deletedAt)))
        .limit(1);

      if (!admin) {
        res.status(404).json({ title: "No admin found for this company", status: 404 });
        return;
      }

      // Clear MPIN hash (forces them to re-setup)
      await db
        .update(staffTable)
        .set({
          mpinHash: null,
          failedMpinAttempts: 0,
          mpinBlockedUntil: null,
          disabledAt: null,
        })
        .where(eq(staffTable.id, admin.id));

      res.json({ message: "Admin MPIN reset successfully", adminId: admin.id, phone: admin.phone });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/super-admin/staff ───────────────────────────────────────────────
// List all staff across all companies (for super admin view).

router.get("/super-admin/staff", requireSuperAdmin, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: staffTable.id,
        name: staffTable.name,
        phone: staffTable.phone,
        email: staffTable.email,
        role: staffTable.role,
        empCode: staffTable.empCode,
        companyId: staffTable.companyId,
        companyName: companiesTable.name,
        approvalStatus: staffTable.approvalStatus,
        disabledAt: staffTable.disabledAt,
        createdAt: staffTable.createdAt,
        centerName: staffTable.centerName,
        projectName: staffTable.projectName,
        state: staffTable.state,
        district: staffTable.district,
        area: staffTable.area,
        organization: staffTable.organization,
        lastLocationAt: staffTable.lastLocationAt,
        isOnShift: staffTable.isOnShift,
      })
      .from(staffTable)
      .leftJoin(companiesTable, eq(staffTable.companyId, companiesTable.id))
      .where(isNull(staffTable.deletedAt))
      .orderBy(staffTable.createdAt);
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email ?? null,
        role: r.role,
        empCode: r.empCode,
        companyId: r.companyId ?? null,
        companyName: r.companyName ?? null,
        approvalStatus: r.approvalStatus,
        disabledAt: r.disabledAt?.toISOString() ?? null,
        createdAt: r.createdAt?.toISOString() ?? null,
        centerName: r.centerName ?? null,
        projectName: r.projectName ?? null,
        state: r.state ?? null,
        district: r.district ?? null,
        area: r.area ?? null,
        organization: r.organization ?? null,
        lastLocationAt: r.lastLocationAt?.toISOString() ?? null,
        isOnShift: r.isOnShift,
      })),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/super-admin/production-setup
 * One-time production setup: removes seed/demo data and registers the primary company.
 * Protected by x-setup-key matching ADMIN_REGISTRATION_KEY.
 */
router.post("/super-admin/production-setup", async (req, res, next) => {
  try {
    const key = req.headers["x-setup-key"];
    const expected = process.env.ADMIN_REGISTRATION_KEY;
    if (!expected || key !== expected) {
      res.status(403).json({ title: "Forbidden", status: 403 });
      return;
    }

    // Phones to delete (seed / demo data)
    const SEED_PHONES = [
      "9999999999", // Anita Sharma (demo admin)
      "9876543210", // Demo Field Staff
      "9876500001", // Ramesh Kumar (seed)
      "9876500002", // Sita Devi (seed)
      "9876500003", // Arjun Singh (seed)
      "9876500004", // Pooja Verma (seed)
    ];

    // 1. Get IDs of seed staff
    const seedStaff = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(inArray(staffTable.phone, SEED_PHONES));
    const seedIds = seedStaff.map((s) => s.id);

    let deletedActivities = 0;
    let deletedCandidates = 0;
    let deletedStaff = 0;

    if (seedIds.length > 0) {
      // Delete activity events for seed staff
      const delActs = await db
        .delete(activityEventsTable)
        .where(inArray(activityEventsTable.staffId, seedIds));
      deletedActivities = Number((delActs as { rowCount?: number }).rowCount ?? 0);

      // Delete candidate notifications for seed phones
      await db
        .delete(candidateNotificationsTable)
        .where(inArray(candidateNotificationsTable.staffPhone, SEED_PHONES));

      // Delete candidates submitted by seed phones
      const seedCands = await db
        .select({ id: candidatesTable.id })
        .from(candidatesTable)
        .where(inArray(candidatesTable.submittedByPhone, SEED_PHONES));
      if (seedCands.length > 0) {
        const candIds = seedCands.map((c) => c.id);
        await db.delete(candidateAuditLogTable).where(inArray(candidateAuditLogTable.candidateId, candIds));
        await db.delete(candidateNotificationsTable).where(inArray(candidateNotificationsTable.candidateId, candIds));
        const delCands = await db.delete(candidatesTable).where(inArray(candidatesTable.id, candIds));
        deletedCandidates = Number((delCands as { rowCount?: number }).rowCount ?? 0);
      }

      // Hard-delete seed staff rows
      const delStaff = await db.delete(staffTable).where(inArray(staffTable.id, seedIds));
      deletedStaff = Number((delStaff as { rowCount?: number }).rowCount ?? 0);
    }

    // 2. Create primary company if not already present
    const { companyName, companyPhone, companyProject, companyState } = req.body as {
      companyName?: string;
      companyPhone?: string;
      companyProject?: string;
      companyState?: string;
    };

    let company = null;
    const existing = await db.select().from(companiesTable).limit(1);
    if (existing.length === 0 && companyName) {
      const [created] = await db
        .insert(companiesTable)
        .values({
          name: companyName,
          phone: companyPhone ?? null,
          projectName: companyProject ?? null,
          state: companyState ?? null,
          status: "active",
          subscriptionActive: true,
        })
        .returning();
      company = created;

      // 3. Assign all staff with NULL company_id to this company
      await db
        .update(staffTable)
        .set({ companyId: created.id })
        .where(sql`company_id IS NULL`);
    } else if (existing.length > 0) {
      company = existing[0];
      // Update project name if provided
      if (companyProject) {
        const [updated] = await db
          .update(companiesTable)
          .set({ projectName: companyProject })
          .where(eq(companiesTable.id, company.id))
          .returning();
        if (updated) company = updated;
      }
    }

    res.json({
      success: true,
      deletedSeedStaff: deletedStaff,
      deletedActivities,
      deletedCandidates,
      company: company ? { id: company.id, name: company.name } : null,
      message: company
        ? `Cleanup done. Company "${company.name}" is set up.`
        : "Cleanup done. No company created (no companyName provided or already exists).",
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super-admin/company-admin ──────────────────────────────────────
// Super Admin creates a new company admin for an existing company.

router.post("/super-admin/company-admin", requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, phone, email, companyId, initialMpin } = req.body as {
      name?: string;
      phone?: string;
      email?: string | null;
      companyId?: string;
      initialMpin?: string | null;
    };

    if (!name?.trim()) {
      res.status(400).json({ title: "Name is required", status: 400 });
      return;
    }
    if (!phone?.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      res.status(400).json({ title: "Valid 10-digit Indian mobile number required", status: 400 });
      return;
    }
    if (!companyId?.trim()) {
      res.status(400).json({ title: "Company is required", status: 400 });
      return;
    }
    if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ title: "Invalid email address", status: 400 });
      return;
    }
    if (initialMpin && !/^\d{4,6}$/.test(initialMpin)) {
      res.status(400).json({ title: "MPIN must be 4–6 digits", status: 400 });
      return;
    }

    // Check company exists
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId.trim()))
      .limit(1);
    if (!company) {
      res.status(404).json({ title: "Company not found", status: 404 });
      return;
    }

    // Check phone not already registered
    const [existingStaff] = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(eq(staffTable.phone, phone.trim()))
      .limit(1);
    if (existingStaff) {
      res.status(409).json({
        title: "Phone already registered",
        detail: "An account with this mobile number already exists.",
        status: 409,
      });
      return;
    }

    // Hash MPIN if provided — same scrypt scheme as mpin.ts
    let mpinHash: string | null = null;
    if (initialMpin) {
      const crypto = await import("node:crypto");
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync(initialMpin, salt, 64).toString("hex");
      mpinHash = `${salt}:${hash}`;
    }

    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const adminCode = Math.random().toString(36).slice(2, 8).toUpperCase();

    const [admin] = await db
      .insert(staffTable)
      .values({
        companyId: companyId.trim(),
        empCode: `ADM-${suffix}`,
        name: name.trim(),
        phone: phone.trim(),
        role: "admin",
        email: email?.trim() || null,
        organization: company.name,
        projectName: company.projectName ?? null,
        state: company.state ?? null,
        district: company.district ?? null,
        adminCode,
        approvalStatus: "approved",
        mpinHash,
      })
      .returning();

    res.status(201).json({
      message: "Company admin created successfully",
      admin: {
        id: admin.id,
        empCode: admin.empCode,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
        companyId: admin.companyId,
        adminCode: admin.adminCode,
        email: admin.email,
        createdAt: admin.createdAt?.toISOString() ?? null,
      },
      company: {
        id: company.id,
        name: company.name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super-admin/wipe-all ───────────────────────────────────────────
// Deletes ALL companies, staff (except 9999999999), and candidates.
// Protected by verifying the super admin's MPIN.
router.post("/super-admin/wipe-all", async (req, res, next) => {
  try {
    const { mpin } = req.body as { mpin?: string };
    if (!mpin) {
      res.status(400).json({ title: "MPIN required", status: 400 });
      return;
    }

    // Verify super admin MPIN
    const [row] = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.phone, "9999999999"))
      .limit(1);
    if (!row) {
      res.status(404).json({ title: "Super admin not found", status: 404 });
      return;
    }

    const { scryptSync, timingSafeEqual } = await import("node:crypto");
    let mpinOk = false;
    if (row.mpinHash) {
      const [salt, stored] = row.mpinHash.split(":");
      if (salt && stored) {
        const derived = scryptSync(mpin, salt, 64).toString("hex");
        mpinOk = timingSafeEqual(Buffer.from(derived), Buffer.from(stored));
      }
    }
    if (!mpinOk) {
      res.status(401).json({ title: "Incorrect MPIN", status: 401 });
      return;
    }

    // Delete in dependency order
    await db.delete(candidateAuditLogTable);
    await db.delete(candidateNotificationsTable);
    await db.delete(candidatesTable);
    await db.delete(activityEventsTable);
    // Delete all staff except super admin
    await db.delete(staffTable).where(
      sql`phone != '9999999999'`
    );
    // Hard delete super admin's company link but keep the row
    await db
      .update(staffTable)
      .set({ companyId: null })
      .where(eq(staffTable.phone, "9999999999"));
    await db.delete(companiesTable);

    res.json({ success: true, message: "All companies, admins, and staff wiped. Super admin preserved." });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super-admin/companies/:id/backfill-orphans ─────────────────────
// Assigns all candidates and staff (excluding super_admin) that currently have
// company_id = NULL to this company. Used to recover legacy data created before
// the multi-tenant migration was rolled out.

router.post(
  "/super-admin/companies/:id/backfill-orphans",
  requireSuperAdmin,
  async (req, res, next) => {
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

      const [company] = await db
        .select({ id: companiesTable.id, name: companiesTable.name })
        .from(companiesTable)
        .where(eq(companiesTable.id, id))
        .limit(1);
      if (!company) {
        res.status(404).json({ title: "Company not found", status: 404 });
        return;
      }

      // Run both UPDATEs in a single transaction so the operation is atomic —
      // either both candidate and staff backfills succeed, or neither does.
      const { candidatesUpdated, staffUpdated } = await db.transaction(
        async (tx) => {
          // Backfill candidates with NULL company_id.
          const candRes = await tx
            .update(candidatesTable)
            .set({ companyId: id })
            .where(isNull(candidatesTable.companyId));

          // Backfill staff with NULL company_id, using an EXPLICIT ALLOWLIST
          // of tenant-scoped roles. Super-admins are intentionally
          // cross-company; any future role we add must be opted in here.
          const staffRes = await tx
            .update(staffTable)
            .set({ companyId: id })
            .where(
              and(
                isNull(staffTable.companyId),
                or(eq(staffTable.role, "staff"), eq(staffTable.role, "admin")),
              ),
            );

          return {
            candidatesUpdated: Number(
              (candRes as { rowCount?: number }).rowCount ?? 0,
            ),
            staffUpdated: Number(
              (staffRes as { rowCount?: number }).rowCount ?? 0,
            ),
          };
        },
      );

      req.log.info(
        {
          actorPhone: req.headers["x-admin-phone"],
          targetCompanyId: id,
          targetCompanyName: company.name,
          candidatesUpdated,
          staffUpdated,
        },
        "super-admin backfilled orphan records",
      );

      res.json({
        message: "Orphan records backfilled",
        companyId: id,
        companyName: company.name,
        candidatesUpdated,
        staffUpdated,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /api/super-admin/companies/:id ────────────────────────────────────
//
// Hard-deletes a company and ALL its scoped data: candidates, candidate audit
// logs, candidate notifications, activity events, and non-super-admin staff.
// Notices are removed automatically by the FK ON DELETE CASCADE on
// notices.company_id. Useful for cleaning up demo/test tenants.
//
// Super-admin staff are never deleted — they are intentionally cross-company.
router.delete(
  "/super-admin/companies/:id",
  requireSuperAdmin,
  async (req, res, next) => {
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

      const [company] = await db
        .select({ id: companiesTable.id, name: companiesTable.name })
        .from(companiesTable)
        .where(eq(companiesTable.id, id))
        .limit(1);
      if (!company) {
        res.status(404).json({ title: "Company not found", status: 404 });
        return;
      }

      const result = await db.transaction(async (tx) => {
        // Collect candidate ids first — audit log / notifications use a plain
        // text candidate_id without an FK, so we have to clean them by id.
        const candRows = await tx
          .select({ id: candidatesTable.id })
          .from(candidatesTable)
          .where(eq(candidatesTable.companyId, id));
        const candIds = candRows.map((r) => r.id);

        if (candIds.length > 0) {
          await tx
            .delete(candidateAuditLogTable)
            .where(inArray(candidateAuditLogTable.candidateId, candIds));
          await tx
            .delete(candidateNotificationsTable)
            .where(inArray(candidateNotificationsTable.candidateId, candIds));
        }
        // Also wipe any remaining notifications/audit rows scoped only by
        // company_id (e.g. notifications for staff that no longer have
        // candidate links).
        await tx
          .delete(candidateAuditLogTable)
          .where(eq(candidateAuditLogTable.companyId, id));
        await tx
          .delete(candidateNotificationsTable)
          .where(eq(candidateNotificationsTable.companyId, id));

        const candDel = await tx
          .delete(candidatesTable)
          .where(eq(candidatesTable.companyId, id));

        // Collect tenant staff ids first so we can also wipe any activity
        // events that reference them via staff_id (no FK there, so they would
        // otherwise become dangling refs after the staff rows are deleted).
        const staffRows = await tx
          .select({ id: staffTable.id })
          .from(staffTable)
          .where(
            and(
              eq(staffTable.companyId, id),
              or(eq(staffTable.role, "staff"), eq(staffTable.role, "admin")),
            ),
          );
        const staffIds = staffRows.map((r) => r.id);

        const evDel = await tx
          .delete(activityEventsTable)
          .where(eq(activityEventsTable.companyId, id));
        if (staffIds.length > 0) {
          await tx
            .delete(activityEventsTable)
            .where(inArray(activityEventsTable.staffId, staffIds));
        }

        // Hard-delete tenant staff. Allowlist: never touch super_admin.
        const staffDel = await tx
          .delete(staffTable)
          .where(
            and(
              eq(staffTable.companyId, id),
              or(eq(staffTable.role, "staff"), eq(staffTable.role, "admin")),
            ),
          );

        // Finally, the company. Notices cascade via FK.
        await tx.delete(companiesTable).where(eq(companiesTable.id, id));

        return {
          candidatesDeleted: Number(
            (candDel as { rowCount?: number }).rowCount ?? 0,
          ),
          staffDeleted: Number(
            (staffDel as { rowCount?: number }).rowCount ?? 0,
          ),
          eventsDeleted: Number(
            (evDel as { rowCount?: number }).rowCount ?? 0,
          ),
        };
      });

      req.log.info(
        {
          actorPhone: req.headers["x-admin-phone"],
          deletedCompanyId: id,
          deletedCompanyName: company.name,
          ...result,
        },
        "super-admin hard-deleted company",
      );

      res.json({
        message: "Company deleted",
        companyId: id,
        companyName: company.name,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/super-admin/profile ─────────────────────────────────────────────
// Get current super admin's own profile

router.get("/super-admin/profile", requireSuperAdmin, async (req, res, next) => {
  try {
    const phone = req.headers["x-admin-phone"] as string;
    const [row] = await db
      .select({ id: staffTable.id, name: staffTable.name, phone: staffTable.phone, email: staffTable.email, empCode: staffTable.empCode })
      .from(staffTable)
      .where(and(eq(staffTable.phone, phone.trim()), isNull(staffTable.deletedAt)))
      .limit(1);
    if (!row) { res.status(404).json({ title: "Profile not found", status: 404 }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

// ─── PATCH /api/super-admin/profile ───────────────────────────────────────────
// Update super admin's own name, phone, email, MPIN

router.patch("/super-admin/profile", requireSuperAdmin, async (req, res, next) => {
  try {
    const currentPhone = req.headers["x-admin-phone"] as string;
    const { name, phone, email, mpin, currentMpin } = req.body as {
      name?: string;
      phone?: string;
      email?: string | null;
      mpin?: string;
      currentMpin?: string;
    };

    const [existing] = await db
      .select()
      .from(staffTable)
      .where(and(eq(staffTable.phone, currentPhone.trim()), isNull(staffTable.deletedAt)))
      .limit(1);

    if (!existing) { res.status(404).json({ title: "Profile not found", status: 404 }); return; }

    // If changing phone, check it's not taken
    if (phone && phone.trim() !== currentPhone.trim()) {
      if (!/^\d{10}$/.test(phone.trim())) {
        res.status(400).json({ title: "Phone must be 10 digits", status: 400 }); return;
      }
      const [conflict] = await db
        .select({ id: staffTable.id })
        .from(staffTable)
        .where(and(eq(staffTable.phone, phone.trim()), isNull(staffTable.deletedAt)))
        .limit(1);
      if (conflict) { res.status(409).json({ title: "This phone number is already in use", status: 409 }); return; }
    }

    // If changing MPIN, verify current MPIN first
    if (mpin) {
      if (!currentMpin) { res.status(400).json({ title: "Current MPIN required to change MPIN", status: 400 }); return; }
      if (existing.mpin !== currentMpin) { res.status(403).json({ title: "Current MPIN is incorrect", status: 403 }); return; }
      if (!/^\d{4,6}$/.test(mpin)) { res.status(400).json({ title: "New MPIN must be 4–6 digits", status: 400 }); return; }
    }

    const updates: Record<string, unknown> = {};
    if (name && name.trim().length >= 2) updates.name = name.trim();
    if (phone && phone.trim()) updates.phone = phone.trim();
    if (email !== undefined) updates.email = email?.trim() || null;
    if (mpin) updates.mpin = mpin;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ title: "No valid fields to update", status: 400 }); return;
    }

    const [updated] = await db
      .update(staffTable)
      .set(updates)
      .where(eq(staffTable.id, existing.id))
      .returning({ id: staffTable.id, name: staffTable.name, phone: staffTable.phone, email: staffTable.email, empCode: staffTable.empCode });

    res.json({ message: "Profile updated", ...updated });
  } catch (err) { next(err); }
});

export default router;
