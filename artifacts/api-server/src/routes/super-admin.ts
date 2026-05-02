import {
  activityEventsTable,
  candidateAuditLogTable,
  candidateNotificationsTable,
  candidatesTable,
  companiesTable,
  db,
  staffTable,
} from "@workspace/db";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
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

// ─── GET /api/super-admin/companies/:id/stats ─────────────────────────────────

router.get("/super-admin/companies/:id/stats", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
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

export default router;
