import {
  activityEventsTable,
  candidateAuditLogTable,
  candidateNotificationsTable,
  candidatesTable,
  centersTable,
  companiesTable,
  db,
  noticesTable,
  staffTable,
} from "@workspace/db";
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { isValidUUID } from "../lib/validation";
import { toCompanyDTO } from "./companies";

const router: IRouter = Router();
const noticeRecipientsTable: any = {};
const sendSmsSilent = async () => {};
const sendPushSilent = async () => {};

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

// ─── POST /api/public/company-register ────────────────────────────────────────
// Public endpoint — no auth required. Training center self-registration.

router.post("/public/company-register", async (req, res, next) => {
  try {
    const {
      name, contactPersonName, phone, email,
      state, district, officeAddress, pinCode,
      projectName, plan, message: noteMsg,
    } = req.body as Record<string, string | undefined>;

    if (!name?.trim() || name.trim().length < 2) {
      res.status(400).json({ title: "Organization name is required (min 2 chars)", status: 400 });
      return;
    }
    if (!phone?.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      res.status(400).json({ title: "Valid 10-digit Indian phone number required", status: 400 });
      return;
    }
    if (!contactPersonName?.trim() || contactPersonName.trim().length < 2) {
      res.status(400).json({ title: "Contact person name is required", status: 400 });
      return;
    }
    if (!state?.trim()) {
      res.status(400).json({ title: "State is required", status: 400 });
      return;
    }
    if (!district?.trim()) {
      res.status(400).json({ title: "District is required", status: 400 });
      return;
    }

    // Check for duplicate phone
    const [existing] = await db
      .select({ id: companiesTable.id, approvalStatus: companiesTable.approvalStatus })
      .from(companiesTable)
      .where(eq(companiesTable.phone, phone.trim()))
      .limit(1);

    if (existing) {
      const msg = existing.approvalStatus === "pending"
        ? "Aapka application pehle se submit hai aur review mein hai."
        : existing.approvalStatus === "approved"
        ? "Is phone number se ek company pehle se registered hai."
        : "Is phone number se ek application pehle reject ho chuki hai. Naye number se apply karein.";
      res.status(409).json({ title: msg, status: 409 });
      return;
    }

    const validPlans = ["basic", "standard", "premium"];
    const chosenPlan = validPlans.includes(plan ?? "") ? (plan as "basic" | "standard" | "premium") : "basic";

    const [company] = await db
      .insert(companiesTable)
      .values({
        name: name.trim(),
        contactPersonName: contactPersonName.trim(),
        adminName: contactPersonName.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        state: state.trim(),
        district: district.trim(),
        officeAddress: officeAddress?.trim() || null,
        pinCode: pinCode?.trim() || null,
        projectName: projectName?.trim() || null,
        plan: chosenPlan,
        approvalStatus: "pending",
        status: "inactive",
        subscriptionActive: false,
      })
      .returning();

    // Send acknowledgement SMS to applicant
    const { sendSmsSilent } = await import("../lib/twilio");
    const ackSms = `Dhanyavaad ${contactPersonName.trim()}! Aapki SCMS registration request mil gayi hai. Hamare team review karke aapko 24-48 ghante mein contact karegi. -SCMS Platform`;
    await sendSmsSilent(phone.trim(), ackSms, (msg) =>
      req.log.warn({ phone: phone.trim(), msg }, "Ack SMS failed for self-registration"),
    );

    req.log.info({ companyId: company.id, name: company.name, phone: phone.trim() }, "Self-registration submitted");

    res.status(201).json({
      message: "Application submitted successfully",
      companyId: company.id,
      name: company.name,
      status: "pending",
    });
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
      .set({ approvalStatus: "approved", status: "active", subscriptionActive: true })
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

    // Send approval SMS if phone exists
    if (company.phone) {
      const { sendSmsSilent } = await import("../lib/twilio");
      const contactName = company.contactPersonName ?? company.adminName ?? "Team";
      const sms = `Badhai ho ${contactName}! Aapki ${company.name} ki SCMS registration approve ho gayi hai. Ab aap apne admin panel pe login kar sakte hain. Koi madad chahiye toh humse sampark karein. -SCMS Platform`;
      await sendSmsSilent(company.phone, sms, (msg) =>
        req.log.warn({ companyId: company.id, msg }, "Approval SMS failed"),
      );
    }

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

    // Send rejection SMS if phone exists
    if (company.phone) {
      const { sendSmsSilent } = await import("../lib/twilio");
      const contactName = company.contactPersonName ?? company.adminName ?? "Aapka";
      const sms = `${contactName}, afsos ke saath batana padh raha hai ki ${company.name} ki SCMS registration request abhi approve nahi ho saki. Adhik jaankari ke liye humse sampark karein. -SCMS Platform`;
      await sendSmsSilent(company.phone, sms, (msg) =>
        req.log.warn({ companyId: company.id, msg }, "Rejection SMS failed"),
      );
    }

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

// ─── POST /api/super-admin/centers/:id/reset-pending ──────────────────────────
// Reset an approved/rejected center back to pending for re-review.

router.post("/super-admin/centers/:id/reset-pending", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "Invalid center id", status: 400 });
      return;
    }
    const [center] = await db
      .update(centersTable)
      .set({ approvalStatus: "pending" })
      .where(eq(centersTable.id, id))
      .returning();
    if (!center) {
      res.status(404).json({ title: "Center not found", status: 404 });
      return;
    }
    res.json({ message: "Center reset to pending", centerId: center.id, name: center.name });
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

    const [centerCount] = await db
      .select({ count: count() })
      .from(centersTable)
      .where(eq(centersTable.companyId, id));

    res.json({
      company: toCompanyDTO(company),
      stats: {
        staffCount: Number(staffCount?.count ?? 0),
        candidateCount: Number(candidateCount?.count ?? 0),
        activityCount: Number(activityCount?.count ?? 0),
        centerCount: Number(centerCount?.count ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/super-admin/companies/:id/centers ────────────────────────────────
// List all training centers for a company (all approval statuses).

router.get("/super-admin/companies/:id/centers", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "Invalid company id", status: 400 });
      return;
    }
    const rows = await db
      .select({
        id: centersTable.id,
        companyId: centersTable.companyId,
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
      .where(eq(centersTable.companyId, id))
      .orderBy(centersTable.createdAt);
    res.json(rows.map((r) => ({
      ...r,
      courses: (r.courses as string[] | null) ?? [],
      createdAt: r.createdAt?.toISOString() ?? null,
    })));
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
      customMonthlyFee,
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
      customMonthlyFee?: number | null;
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
    if (customMonthlyFee !== undefined) {
      updates.customMonthlyFee = customMonthlyFee === null ? null : Math.max(0, Math.round(Number(customMonthlyFee)));
    }

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
// Reset the admin of a company.
// Body (optional): { newMpin: "4–6 digits" }
//   • If newMpin is provided → set that specific MPIN (hashed) and unblock.
//   • If newMpin is omitted  → clear MPIN hash (admin must re-setup on next login).

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

      const { newMpin } = req.body as { newMpin?: string };
      if (newMpin !== undefined && !/^\d{4,6}$/.test(newMpin.trim())) {
        res.status(400).json({ title: "Invalid MPIN", detail: "newMpin must be 4–6 digits", status: 400 });
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

      let mpinHash: string | null = null;
      if (newMpin) {
        const salt = crypto.randomBytes(16).toString("hex");
        const hash = crypto.scryptSync(newMpin.trim(), salt, 64).toString("hex");
        mpinHash = `${salt}:${hash}`;
      }

      await db
        .update(staffTable)
        .set({
          mpinHash,
          failedMpinAttempts: 0,
          mpinBlockedUntil: null,
          disabledAt: null,
        })
        .where(eq(staffTable.id, admin.id));

      req.log.info({ companyId: id, adminId: admin.id, hadNewMpin: !!newMpin }, "Admin MPIN reset by super-admin");
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

// ─── GET /api/super-admin/dashboard ───────────────────────────────────────────
// Global stats across ALL companies for the super admin overview.

router.get("/super-admin/dashboard", requireSuperAdmin, async (_req, res, next) => {
  try {
    const [totalCompanies] = await db.select({ count: count() }).from(companiesTable);
    const [activeCompanies] = await db.select({ count: count() }).from(companiesTable)
      .where(eq(companiesTable.status, "active"));
    const [totalStaff] = await db.select({ count: count() }).from(staffTable)
      .where(isNull(staffTable.deletedAt));
    const [totalCandidates] = await db.select({ count: count() }).from(candidatesTable);
    const recentCompanies = await db.select({
      id: companiesTable.id,
      name: companiesTable.name,
      status: companiesTable.status,
      subscriptionActive: companiesTable.subscriptionActive,
      plan: companiesTable.plan,
      createdAt: companiesTable.createdAt,
    }).from(companiesTable).orderBy(sql`${companiesTable.createdAt} desc`).limit(5);

    res.json({
      totalCompanies: Number(totalCompanies?.count ?? 0),
      activeCompanies: Number(activeCompanies?.count ?? 0),
      totalStaff: Number(totalStaff?.count ?? 0),
      totalCandidates: Number(totalCandidates?.count ?? 0),
      recentCompanies: recentCompanies.map((c) => ({
        ...c,
        createdAt: c.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (err) { next(err); }
});

// ─── POST /api/super-admin/companies ──────────────────────────────────────────
// Create a new company (and optionally its first admin account).

router.post("/super-admin/companies", requireSuperAdmin, async (req, res, next) => {
  try {
    const {
      name, adminName, phone, email, state, district,
      projectName, plan, subscriptionStartDate, subscriptionEndDate,
      adminPhone, adminInitialMpin,
    } = req.body as {
      name?: string;
      adminName?: string | null;
      phone?: string | null;
      email?: string | null;
      state?: string | null;
      district?: string | null;
      projectName?: string | null;
      plan?: "basic" | "standard" | "premium" | null;
      subscriptionStartDate?: string | null;
      subscriptionEndDate?: string | null;
      adminPhone?: string | null;
      adminInitialMpin?: string | null;
    };

    if (!name?.trim() || name.trim().length < 2) {
      res.status(400).json({ title: "Company name required (min 2 chars)", status: 400 });
      return;
    }

    const [company] = await db
      .insert(companiesTable)
      .values({
        name: name.trim(),
        adminName: adminName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        state: state?.trim() || null,
        district: district?.trim() || null,
        projectName: projectName?.trim() || null,
        plan: plan ?? "basic",
        subscriptionActive: true,
        status: "active",
        approvalStatus: "approved",
        subscriptionStartDate: subscriptionStartDate ? new Date(subscriptionStartDate) : null,
        subscriptionEndDate: subscriptionEndDate ? new Date(subscriptionEndDate) : null,
      })
      .returning();

    if (!company) {
      res.status(500).json({ title: "Failed to create company", status: 500 });
      return;
    }

    // Optionally create first admin account
    let admin = null;
    if (adminPhone?.trim() && /^[6-9]\d{9}$/.test(adminPhone.trim())) {
      const [existingStaff] = await db.select({ id: staffTable.id }).from(staffTable)
        .where(eq(staffTable.phone, adminPhone.trim())).limit(1);

      if (!existingStaff) {
        let mpinHash: string | null = null;
        if (adminInitialMpin && /^\d{4,6}$/.test(adminInitialMpin)) {
          const salt = crypto.randomBytes(16).toString("hex");
          const hash = crypto.scryptSync(adminInitialMpin, salt, 64).toString("hex");
          mpinHash = `${salt}:${hash}`;
        }
        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
        const adminCode = Math.random().toString(36).slice(2, 8).toUpperCase();
        const [createdAdmin] = await db.insert(staffTable).values({
          companyId: company.id,
          empCode: `ADM-${suffix}`,
          name: adminName?.trim() || "Admin",
          phone: adminPhone.trim(),
          role: "admin",
          email: email?.trim() || null,
          organization: company.name,
          projectName: company.projectName ?? null,
          state: company.state ?? null,
          district: company.district ?? null,
          adminCode,
          approvalStatus: "approved",
          mpinHash,
        }).returning();
        admin = createdAdmin ? {
          id: createdAdmin.id,
          empCode: createdAdmin.empCode,
          name: createdAdmin.name,
          phone: createdAdmin.phone,
          adminCode: createdAdmin.adminCode,
        } : null;
      }
    }

    req.log.info({ companyId: company.id }, "New company created by super-admin");
    res.status(201).json({ company: toCompanyDTO(company), admin });
  } catch (err) { next(err); }
});

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

    // If changing MPIN, verify current MPIN first (stored as scrypt hash)
    if (mpin) {
      if (!currentMpin) { res.status(400).json({ title: "Current MPIN required to change MPIN", status: 400 }); return; }
      const mpinOk = existing.mpinHash
        ? (() => {
            const [salt, hash] = existing.mpinHash.split(":");
            if (!salt || !hash) return false;
            try {
              const derived = crypto.scryptSync(currentMpin, salt, 64);
              return crypto.timingSafeEqual(derived, Buffer.from(hash, "hex"));
            } catch { return false; }
          })()
        : false;
      if (!mpinOk) { res.status(403).json({ title: "Current MPIN is incorrect", status: 403 }); return; }
      if (!/^\d{4,6}$/.test(mpin)) { res.status(400).json({ title: "New MPIN must be 4–6 digits", status: 400 }); return; }
    }

    const updates: Record<string, unknown> = {};
    if (name && name.trim().length >= 2) updates.name = name.trim();
    if (phone && phone.trim()) updates.phone = phone.trim();
    if (email !== undefined) updates.email = email?.trim() || null;
    if (mpin) {
      // Hash new MPIN with scrypt (same scheme as mpin.ts)
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync(mpin, salt, 64).toString("hex");
      updates.mpinHash = `${salt}:${hash}`;
    }

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

// ─── POST /api/super-admin/subscription-reminders/run ────────────────────────
// Manually trigger subscription reminder check (for testing or on-demand)

router.post("/super-admin/subscription-reminders/run", requireSuperAdmin, async (_req, res, next) => {
  try {
    const { runSubscriptionReminders } = await import("../services/subscriptionReminder");
    const result = await runSubscriptionReminders();
    res.json({ message: "Subscription reminder check completed", ...result });
  } catch (err) { next(err); }
});

// ─── GET /api/super-admin/subscription-reminders/status ──────────────────────
// Show companies expiring soon with their reminder status

router.get("/super-admin/subscription-reminders/status", requireSuperAdmin, async (_req, res, next) => {
  try {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        phone: companiesTable.phone,
        plan: companiesTable.plan,
        subscriptionEndDate: companiesTable.subscriptionEndDate,
        subscriptionReminderSentAt: companiesTable.subscriptionReminderSentAt,
        subscriptionActive: companiesTable.subscriptionActive,
        status: companiesTable.status,
      })
      .from(companiesTable)
      .where(isNotNull(companiesTable.subscriptionEndDate))
      .orderBy(companiesTable.subscriptionEndDate);

    const result = rows.map((r) => {
      const daysLeft = r.subscriptionEndDate
        ? Math.ceil((r.subscriptionEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: r.id,
        name: r.name,
        phone: r.phone ?? null,
        plan: r.plan ?? null,
        subscriptionEndDate: r.subscriptionEndDate?.toISOString() ?? null,
        subscriptionReminderSentAt: r.subscriptionReminderSentAt?.toISOString() ?? null,
        subscriptionActive: r.subscriptionActive,
        status: r.status,
        daysLeft,
        urgency: daysLeft === null ? "none"
          : daysLeft < 0 ? "expired"
          : daysLeft <= 1 ? "critical"
          : daysLeft <= 3 ? "urgent"
          : daysLeft <= 7 ? "warning"
          : daysLeft <= 30 ? "notice"
          : "ok",
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

// ─── GET /api/super-admin/revenue ─────────────────────────────────────────────
// Revenue dashboard: estimated MRR/ARR by plan, collection breakdown, monthly trend

const PLAN_PRICE_MONTHLY: Record<string, number> = {
  basic: 5000,
  standard: 10000,
  premium: 20000,
};

router.get("/super-admin/revenue", requireSuperAdmin, async (_req, res, next) => {
  try {
    const now = new Date();

    // All companies with subscription info
    const companies = await db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        phone: companiesTable.phone,
        plan: companiesTable.plan,
        paymentStatus: companiesTable.paymentStatus,
        subscriptionActive: companiesTable.subscriptionActive,
        subscriptionStartDate: companiesTable.subscriptionStartDate,
        subscriptionEndDate: companiesTable.subscriptionEndDate,
        status: companiesTable.status,
        createdAt: companiesTable.createdAt,
        customMonthlyFee: companiesTable.customMonthlyFee,
      })
      .from(companiesTable)
      .where(eq(companiesTable.approvalStatus, "approved"));

    // ── KPI calculations ──
    let totalMRR = 0;
    let collectedMRR = 0;
    let pendingMRR = 0;
    let expiredMRR = 0;

    const planRevenue: Record<string, { count: number; mrr: number; customCount: number }> = {
      basic: { count: 0, mrr: 0, customCount: 0 },
      standard: { count: 0, mrr: 0, customCount: 0 },
      premium: { count: 0, mrr: 0, customCount: 0 },
    };

    const pendingCompanies: Array<{
      id: string; name: string; phone: string | null;
      plan: string | null; paymentStatus: string | null;
      subscriptionEndDate: string | null; estimatedAmount: number;
      isCustomPrice: boolean;
    }> = [];

    for (const c of companies) {
      // Use custom fee if set, otherwise standard plan price
      const price = c.customMonthlyFee && c.customMonthlyFee > 0
        ? c.customMonthlyFee
        : PLAN_PRICE_MONTHLY[c.plan ?? ""] ?? 0;
      if (!c.plan || price === 0) continue;

      totalMRR += price;

      if (c.plan && planRevenue[c.plan]) {
        planRevenue[c.plan].count += 1;
        planRevenue[c.plan].mrr += price;
        if (c.customMonthlyFee && c.customMonthlyFee > 0) planRevenue[c.plan].customCount += 1;
      }

      if (c.paymentStatus === "paid") {
        collectedMRR += price;
      } else if (c.paymentStatus === "pending") {
        pendingMRR += price;
        pendingCompanies.push({
          id: c.id,
          name: c.name,
          phone: c.phone ?? null,
          plan: c.plan,
          paymentStatus: c.paymentStatus,
          subscriptionEndDate: c.subscriptionEndDate?.toISOString() ?? null,
          estimatedAmount: price,
          isCustomPrice: !!(c.customMonthlyFee && c.customMonthlyFee > 0),
        });
      } else if (c.paymentStatus === "expired") {
        expiredMRR += price;
      }
    }

    // ── Monthly subscription starts — last 12 months ──
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRows = await db
      .select({
        month: sql<string>`to_char(${companiesTable.subscriptionStartDate}, 'YYYY-MM')`,
        plan: companiesTable.plan,
        count: count(),
      })
      .from(companiesTable)
      .where(
        and(
          isNotNull(companiesTable.subscriptionStartDate),
          isNotNull(companiesTable.plan),
          sql`${companiesTable.subscriptionStartDate} >= ${twelveMonthsAgo.toISOString()}`,
          eq(companiesTable.approvalStatus, "approved"),
        ),
      )
      .groupBy(
        sql`to_char(${companiesTable.subscriptionStartDate}, 'YYYY-MM')`,
        companiesTable.plan,
      )
      .orderBy(sql`to_char(${companiesTable.subscriptionStartDate}, 'YYYY-MM')`);

    // Build full 12-month grid
    const monthGrid: Record<string, { month: string; basic: number; standard: number; premium: number; total: number; mrr: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthGrid[key] = { month: key, basic: 0, standard: 0, premium: 0, total: 0, mrr: 0 };
    }

    for (const r of monthlyRows) {
      if (!r.month || !monthGrid[r.month]) continue;
      const plan = r.plan ?? "";
      const n = Number(r.count);
      const price = PLAN_PRICE_MONTHLY[plan] ?? 0;
      if (plan === "basic") monthGrid[r.month].basic += n;
      if (plan === "standard") monthGrid[r.month].standard += n;
      if (plan === "premium") monthGrid[r.month].premium += n;
      monthGrid[r.month].total += n;
      monthGrid[r.month].mrr += n * price;
    }

    const monthlyTrend = Object.values(monthGrid);

    // ── Renewal forecast: subscriptions ending in next 30 / 60 / 90 days ──
    const in30 = new Date(now.getTime() + 30 * 864e5);
    const in60 = new Date(now.getTime() + 60 * 864e5);
    const in90 = new Date(now.getTime() + 90 * 864e5);

    let renewalIn30 = 0, renewalIn60 = 0, renewalIn90 = 0;
    let renewalMrrIn30 = 0, renewalMrrIn60 = 0, renewalMrrIn90 = 0;

    for (const c of companies) {
      if (!c.subscriptionEndDate || !c.plan) continue;
      const price = c.customMonthlyFee && c.customMonthlyFee > 0
        ? c.customMonthlyFee
        : PLAN_PRICE_MONTHLY[c.plan] ?? 0;
      const end = c.subscriptionEndDate;
      if (end >= now && end <= in30) { renewalIn30++; renewalMrrIn30 += price; }
      if (end >= now && end <= in60) { renewalIn60++; renewalMrrIn60 += price; }
      if (end >= now && end <= in90) { renewalIn90++; renewalMrrIn90 += price; }
    }

    res.json({
      planPrices: PLAN_PRICE_MONTHLY,
      kpi: {
        totalCompaniesWithPlan: companies.filter((c) => c.plan).length,
        totalMRR,
        totalARR: totalMRR * 12,
        collectedMRR,
        pendingMRR,
        expiredMRR,
        collectionRate: totalMRR > 0 ? Math.round((collectedMRR / totalMRR) * 100) : 0,
      },
      planRevenue,
      pendingCompanies,
      monthlyTrend,
      renewalForecast: {
        in30Days: { count: renewalIn30, mrr: renewalMrrIn30 },
        in60Days: { count: renewalIn60, mrr: renewalMrrIn60 },
        in90Days: { count: renewalIn90, mrr: renewalMrrIn90 },
      },
    });
  } catch (err) { next(err); }
});

// ─── GET /api/super-admin/analytics ──────────────────────────────────────────
// Detailed platform analytics: plan distribution, payment status, company growth

router.get("/super-admin/analytics", requireSuperAdmin, async (_req, res, next) => {
  try {
    const companies = await db
      .select({
        id: companiesTable.id,
        plan: companiesTable.plan,
        status: companiesTable.status,
        subscriptionActive: companiesTable.subscriptionActive,
        paymentStatus: companiesTable.paymentStatus,
        subscriptionEndDate: companiesTable.subscriptionEndDate,
        createdAt: companiesTable.createdAt,
      })
      .from(companiesTable)
      .orderBy(companiesTable.createdAt);

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const planDist: Record<string, number> = { basic: 0, standard: 0, premium: 0, none: 0 };
    const paymentDist: Record<string, number> = { paid: 0, pending: 0, expired: 0, none: 0 };
    let active = 0, inactive = 0, expiringCount = 0, expiredCount = 0;

    for (const c of companies) {
      planDist[c.plan ?? "none"] = (planDist[c.plan ?? "none"] ?? 0) + 1;
      paymentDist[c.paymentStatus ?? "none"] = (paymentDist[c.paymentStatus ?? "none"] ?? 0) + 1;
      if (c.status === "active") active++; else inactive++;
      if (c.subscriptionEndDate) {
        if (c.subscriptionEndDate < now) expiredCount++;
        else if (c.subscriptionEndDate < thirtyDaysLater) expiringCount++;
      }
    }

    // Monthly company registrations for last 6 months
    const monthly: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly[key] = 0;
    }
    for (const c of companies) {
      if (!c.createdAt) continue;
      const key = `${c.createdAt.getFullYear()}-${String(c.createdAt.getMonth() + 1).padStart(2, "0")}`;
      if (key in monthly) monthly[key]++;
    }

    res.json({
      total: companies.length,
      active,
      inactive,
      expiringIn30Days: expiringCount,
      expired: expiredCount,
      planDistribution: planDist,
      paymentDistribution: paymentDist,
      monthlyGrowth: Object.entries(monthly).map(([month, count]) => ({ month, count })),
    });
  } catch (err) { next(err); }
});

// ─── GET /api/super-admin/notices ────────────────────────────────────────────
// List all notices across all companies

router.get("/super-admin/notices", requireSuperAdmin, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: noticesTable.id,
        companyId: noticesTable.companyId,
        companyName: companiesTable.name,
        title: noticesTable.title,
        message: noticesTable.message,
        priority: noticesTable.priority,
        type: noticesTable.type,
        targetType: noticesTable.targetType,
        expiresAt: noticesTable.expiresAt,
        createdAt: noticesTable.createdAt,
      })
      .from(noticesTable)
      .leftJoin(companiesTable, eq(noticesTable.companyId, companiesTable.id))
      .orderBy(sql`${noticesTable.createdAt} DESC`)
      .limit(200);

    res.json(rows.map((r) => ({
      ...r,
      companyName: r.companyName ?? "Platform-wide",
      expiresAt: r.expiresAt?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString() ?? null,
    })));
  } catch (err) { next(err); }
});

// ─── POST /api/super-admin/notices ───────────────────────────────────────────
// Create a notice for a specific company (or platform-wide with companyId=null)

router.post("/super-admin/notices", requireSuperAdmin, async (req, res, next) => {
  try {
    const { title, message, priority, type, companyId, expiresAt } = req.body as {
      title?: string;
      message?: string;
      priority?: "normal" | "important" | "urgent";
      type?: "notice" | "alert" | "reminder";
      companyId?: string | null;
      expiresAt?: string | null;
    };

    if (!title?.trim() || !message?.trim()) {
      res.status(400).json({ title: "title and message are required", status: 400 });
      return;
    }

    if (companyId && !isValidUUID(companyId)) {
      res.status(400).json({ title: "Invalid companyId", status: 400 });
      return;
    }

    const [notice] = await db
      .insert(noticesTable)
      .values({
        title: title.trim(),
        message: message.trim(),
        priority: priority ?? "normal",
        type: type ?? "notice",
        targetType: "all",
        companyId: companyId ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    res.status(201).json({
      ...notice,
      expiresAt: notice.expiresAt?.toISOString() ?? null,
      createdAt: notice.createdAt?.toISOString() ?? null,
    });
  } catch (err) { next(err); }
});

// ─── POST /api/super-admin/notices/broadcast ─────────────────────────────────
// Bulk broadcast: send a notice + SMS + push to staff of selected companies.
// Body: { title, message, priority?, type?, companyIds: string[] | "all",
//         channels: { sms: bool, push: bool, inApp: bool },
//         adminOnly?: bool, expiresAt?: string }
// Returns per-company delivery summary synchronously; SMS/push fire-and-forget.

router.post("/super-admin/notices/broadcast", requireSuperAdmin, async (req, res, next) => {
  try {
    const {
      title, message, priority, type, companyIds, channels, adminOnly, expiresAt,
    } = req.body as {
      title?: string;
      message?: string;
      priority?: "normal" | "important" | "urgent";
      type?: "notice" | "alert" | "reminder";
      companyIds?: string[] | "all";
      channels?: { sms?: boolean; push?: boolean; inApp?: boolean };
      adminOnly?: boolean;
      expiresAt?: string | null;
    };

    if (!title?.trim() || !message?.trim()) {
      res.status(400).json({ title: "title and message are required", status: 400 });
      return;
    }
    if (!companyIds || (Array.isArray(companyIds) && companyIds.length === 0)) {
      res.status(400).json({ title: "companyIds is required", status: 400 });
      return;
    }

    const sendSms = channels?.sms !== false;
    const sendPush = channels?.push !== false;
    const sendInApp = channels?.inApp !== false;
    const priorityVal = (["normal", "important", "urgent"].includes(priority ?? "")) ? priority! : "normal";
    const typeVal = (["notice", "alert", "reminder"].includes(type ?? "")) ? type! : "notice";

    // Resolve company list
    let targetCompanyIds: string[];
    if (companyIds === "all") {
      const allCos = await db
        .select({ id: companiesTable.id })
        .from(companiesTable)
        .where(eq(companiesTable.approvalStatus, "approved"));
      targetCompanyIds = allCos.map((c) => c.id);
    } else {
      targetCompanyIds = companyIds.filter(isValidUUID);
    }

    if (targetCompanyIds.length === 0) {
      res.status(400).json({ title: "No valid companies found", status: 400 });
      return;
    }

    // Build SMS prefix
    const priorityTag = priorityVal === "urgent" ? "[URGENT] " : priorityVal === "important" ? "[IMPORTANT] " : "";
    const smsBody = `${priorityTag}SCMS Notice:\n${title!.trim()}\n${message!.trim()}`.slice(0, 320);

    // Per-company stats
    type CompanyResult = {
      companyId: string;
      companyName: string;
      staffCount: number;
      noticeId: string | null;
    };
    const results: CompanyResult[] = [];

    for (const cid of targetCompanyIds) {
      try {
        // Get company name
        const [co] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, cid)).limit(1);
        const companyName = co?.name ?? "Unknown";

        // Get staff for this company
        const roleFilter = adminOnly ? eq(staffTable.role, "admin") : undefined;
        const staffRows = await db
          .select({ id: staffTable.id, phone: staffTable.phone, expoPushToken: staffTable.expoPushToken })
          .from(staffTable)
          .where(and(
            eq(staffTable.companyId, cid),
            isNull(staffTable.deletedAt),
            isNull(staffTable.disabledAt),
            eq(staffTable.approvalStatus, "approved"),
            roleFilter,
          ));

        if (staffRows.length === 0) {
          results.push({ companyId: cid, companyName, staffCount: 0, noticeId: null });
          continue;
        }

        // Create in-app notice per company
        let noticeId: string | null = null;
        if (sendInApp) {
          const [notice] = await db
            .insert(noticesTable)
            .values({
              companyId: cid,
              title: title!.trim(),
              message: message!.trim(),
              priority: priorityVal,
              type: typeVal,
              targetType: "all",
              expiresAt: expiresAt ? new Date(expiresAt) : null,
            })
            .returning({ id: noticesTable.id });
          noticeId = notice.id;

          await db.insert(noticeRecipientsTable).values(
            staffRows.map((s) => ({ noticeId: notice.id, staffId: s.id })),
          );
        }

        results.push({ companyId: cid, companyName, staffCount: staffRows.length, noticeId });

        // Fire-and-forget SMS + push (capped per company at 100)
        const capped = staffRows.slice(0, 100);
        void (async () => {
          try {
            const tasks: Promise<unknown>[] = [];
            if (sendSms) {
              tasks.push(...capped.map((s) => sendSmsSilent(s.phone, smsBody)));
            }
            if (sendPush) {
              tasks.push(sendPushSilent(
                capped.map((s) => s.expoPushToken),
                title!.trim(),
                message!.trim().slice(0, 200),
                { type: "notice" },
              ));
            }
            await Promise.allSettled(tasks);
          } catch { /* swallow */ }
        })();
      } catch {
        // Skip company on error, continue broadcast
      }
    }

    const totalStaff = results.reduce((s, r) => s + r.staffCount, 0);
    const companiesReached = results.filter((r) => r.staffCount > 0).length;

    res.status(201).json({
      message: "Broadcast sent",
      summary: {
        totalCompanies: targetCompanyIds.length,
        companiesReached,
        totalStaff,
        channels: { sms: sendSms, push: sendPush, inApp: sendInApp },
      },
      results,
    });
  } catch (err) { next(err); }
});

// ─── DELETE /api/super-admin/notices/:id ─────────────────────────────────────

router.delete("/super-admin/notices/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "Invalid notice id", status: 400 });
      return;
    }
    await db.delete(noticesTable).where(eq(noticesTable.id, id));
    res.json({ message: "Notice deleted", id });
  } catch (err) { next(err); }
});

// ─── GET /api/super-admin/audit-logs ─────────────────────────────────────────
// Recent activity events across all companies

router.get("/super-admin/audit-logs", requireSuperAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const kind = req.query.kind as string | undefined;

    const rows = await db
      .select({
        id: activityEventsTable.id,
        companyId: activityEventsTable.companyId,
        companyName: companiesTable.name,
        kind: activityEventsTable.kind,
        staffId: activityEventsTable.staffId,
        staffName: activityEventsTable.staffName,
        occurredAt: activityEventsTable.occurredAt,
        receivedAt: activityEventsTable.receivedAt,
      })
      .from(activityEventsTable)
      .leftJoin(companiesTable, eq(activityEventsTable.companyId, companiesTable.id))
      .where(kind ? eq(activityEventsTable.kind, kind as "checkin" | "checkout" | "meter" | "trip-start" | "trip-end") : undefined)
      .orderBy(sql`${activityEventsTable.occurredAt} DESC`)
      .limit(limit);

    res.json(rows.map((r) => ({
      id: r.id,
      companyId: r.companyId ?? null,
      companyName: r.companyName ?? "Unknown",
      kind: r.kind,
      staffId: r.staffId,
      staffName: r.staffName,
      occurredAt: r.occurredAt?.toISOString() ?? null,
      receivedAt: r.receivedAt?.toISOString() ?? null,
    })));
  } catch (err) { next(err); }
});

// ─── GET /api/super-admin/center-attendance ────────────────────────────────────
// Daily attendance log for center staff across all (or one) company.
// Query params: date (YYYY-MM-DD, default today IST), companyId (optional)

router.get("/super-admin/center-attendance", requireSuperAdmin, async (req, res, next) => {
  try {
    const { date, companyId } = req.query as { date?: string; companyId?: string };

    // Parse date — default to today in IST (UTC+5:30)
    let targetDate: Date;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      targetDate = new Date(date + "T00:00:00+05:30");
    } else {
      const now = new Date();
      const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      targetDate = new Date(`${ist.toISOString().slice(0, 10)}T00:00:00+05:30`);
    }
    const dayStart = new Date(targetDate.getTime());
    const dayEnd = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    // Get all center staff for the filter
    const staffWhere = companyId && isValidUUID(companyId)
      ? and(eq(staffTable.staffCategory, "center"), eq(staffTable.companyId, companyId), isNull(staffTable.deletedAt))
      : and(eq(staffTable.staffCategory, "center"), isNull(staffTable.deletedAt));

    const centerStaff = await db
      .select({
        id: staffTable.id,
        name: staffTable.name,
        empCode: staffTable.empCode,
        companyId: staffTable.companyId,
        phone: staffTable.phone,
      })
      .from(staffTable)
      .where(staffWhere);

    if (centerStaff.length === 0) {
      res.json({ date: targetDate.toISOString().slice(0, 10), summary: { total: 0, present: 0, absent: 0, outsideFence: 0, complianceRate: 0 }, records: [] });
      return;
    }

    const staffIds = centerStaff.map((s) => s.id);

    // Get company names for all involved companies
    const companyIds = [...new Set(centerStaff.map((s) => s.companyId).filter(Boolean))] as string[];
    const companies = companyIds.length > 0
      ? await db.select({ id: companiesTable.id, name: companiesTable.name }).from(companiesTable).where(inArray(companiesTable.id, companyIds))
      : [];
    const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

    // Fetch checkin + checkout events for all center staff on this day
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
          inArray(activityEventsTable.kind, ["checkin", "checkout"]),
          gte(activityEventsTable.occurredAt, dayStart),
          lte(activityEventsTable.occurredAt, dayEnd),
        ),
      )
      .orderBy(desc(activityEventsTable.occurredAt));

    // Group by staffId — find first checkin and last checkout
    type StaffEvents = { checkin?: { time: Date; payload: Record<string, unknown> }; checkout?: { time: Date; payload: Record<string, unknown> } };
    const byStaff: Record<string, StaffEvents> = {};
    for (const e of events) {
      if (!byStaff[e.staffId]) byStaff[e.staffId] = {};
      const p = (e.payload ?? {}) as Record<string, unknown>;
      if (e.kind === "checkin") {
        // Keep earliest checkin
        const cur = byStaff[e.staffId].checkin;
        if (!cur || e.occurredAt < cur.time) byStaff[e.staffId].checkin = { time: e.occurredAt, payload: p };
      } else if (e.kind === "checkout") {
        // Keep latest checkout
        const cur = byStaff[e.staffId].checkout;
        if (!cur || e.occurredAt > cur.time) byStaff[e.staffId].checkout = { time: e.occurredAt, payload: p };
      }
    }

    // Build records
    let presentCount = 0;
    let outsideFenceCount = 0;

    const records = centerStaff.map((s) => {
      const ev = byStaff[s.id];
      const checkin = ev?.checkin ?? null;
      const checkout = ev?.checkout ?? null;
      const isPresent = !!checkin;
      if (isPresent) presentCount++;

      const outsideGeofence = !!(checkin?.payload?.outsideGeofence);
      const distanceFromCenterM = typeof checkin?.payload?.distanceFromCenterM === "number"
        ? checkin.payload.distanceFromCenterM
        : null;
      if (outsideGeofence) outsideFenceCount++;

      const durationMin = checkin && checkout
        ? Math.round((checkout.time.getTime() - checkin.time.getTime()) / 60000)
        : null;

      return {
        staffId: s.id,
        staffName: s.name,
        empCode: s.empCode ?? null,
        phone: s.phone ?? null,
        companyId: s.companyId ?? null,
        companyName: s.companyId ? (companyMap[s.companyId] ?? "Unknown") : "Unknown",
        status: isPresent ? (checkout ? "present" : "partial") : "absent",
        checkinTime: checkin?.time?.toISOString() ?? null,
        checkoutTime: checkout?.time?.toISOString() ?? null,
        durationMin,
        outsideGeofence,
        distanceFromCenterM,
      };
    });

    // Sort: present first, then partial, then absent; within each group sort by name
    const statusOrder: Record<string, number> = { present: 0, partial: 1, absent: 2 };
    records.sort((a, b) => {
      const so = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      if (so !== 0) return so;
      return a.staffName.localeCompare(b.staffName);
    });

    const total = centerStaff.length;
    const complianceRate = presentCount > 0
      ? Math.round(((presentCount - outsideFenceCount) / presentCount) * 100)
      : 100;

    res.json({
      date: targetDate.toISOString().slice(0, 10),
      summary: {
        total,
        present: presentCount,
        partial: records.filter((r) => r.status === "partial").length,
        absent: total - presentCount,
        outsideFence: outsideFenceCount,
        complianceRate,
        attendanceRate: total > 0 ? Math.round((presentCount / total) * 100) : 0,
      },
      records,
    });
  } catch (err) { next(err); }
});

export default router;
