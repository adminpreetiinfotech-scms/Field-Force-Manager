import { companiesTable, db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";

const router: IRouter = Router();

const UPLOADS_BASE = path.join(process.cwd(), "uploads");
const COMPANIES_DIR = path.join(UPLOADS_BASE, "companies");
fs.mkdirSync(COMPANIES_DIR, { recursive: true });

// Expose uploads directory (shared with candidates route, but that one already serves /api/uploads).
// No duplicate needed here — just use the same static middleware from candidates.

function saveLogoBase64(
  base64: string | null | undefined,
  mimeType: string | null | undefined,
  companyId: string,
): string | null {
  if (!base64) return null;
  const ext = (mimeType || "image/jpeg").includes("png") ? "png" : "jpg";
  const filepath = path.join(COMPANIES_DIR, `${companyId}.${ext}`);
  try {
    fs.writeFileSync(filepath, Buffer.from(base64, "base64"));
    return filepath;
  } catch {
    return null;
  }
}

function toLogoUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const rel = path.relative(UPLOADS_BASE, filePath).replace(/\\/g, "/");
  return `/api/uploads/${rel}`;
}

function toCompanyDTO(c: typeof companiesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    adminName: c.adminName ?? null,
    phone: c.phone ?? null,
    email: c.email ?? null,
    state: c.state ?? null,
    district: c.district ?? null,
    projectName: c.projectName ?? null,
    logoUrl: toLogoUrl(c.logoPath),
    status: c.status,
    subscriptionActive: c.subscriptionActive,
    createdAt: c.createdAt?.toISOString() ?? null,
  };
}

// ─── POST /api/companies/register ─────────────────────────────────────────────
// Creates a company + its first admin user atomically.

router.post("/companies/register", async (req, res, next) => {
  try {
    const {
      // Company fields
      companyName,
      companyState,
      companyDistrict,
      projectName,
      logoBase64,
      logoMime,
      // Admin personal fields
      adminName,
      adminPhone,
      adminEmail,
      adminRegistrationKey,
      // Admin location/center (stored on staff row)
      centerName,
      state,
      district,
    } = req.body as {
      companyName?: string;
      companyState?: string;
      companyDistrict?: string;
      projectName?: string;
      logoBase64?: string | null;
      logoMime?: string | null;
      adminName?: string;
      adminPhone?: string;
      adminEmail?: string | null;
      adminRegistrationKey?: string | null;
      centerName?: string | null;
      state?: string | null;
      district?: string | null;
    };

    // Validate company name
    if (!companyName || companyName.trim().length < 2) {
      res.status(400).json({ title: "Company name required", status: 400 });
      return;
    }
    // Validate admin name
    if (!adminName || adminName.trim().length < 2) {
      res.status(400).json({ title: "Admin name required (min 2 chars)", status: 400 });
      return;
    }
    // Validate admin phone
    if (!adminPhone || !/^\d{10}$/.test(adminPhone.trim())) {
      res.status(400).json({ title: "Admin phone must be exactly 10 digits", status: 400 });
      return;
    }
    // Validate admin registration key
    const requiredKey = process.env.ADMIN_REGISTRATION_KEY;
    if (!adminRegistrationKey?.trim()) {
      res.status(403).json({ title: "Admin registration key required", status: 403 });
      return;
    }
    if (requiredKey && adminRegistrationKey.trim() !== requiredKey.trim()) {
      res.status(403).json({ title: "Invalid admin registration key", status: 403 });
      return;
    }
    // Validate admin email if provided
    if (adminEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
      res.status(400).json({ title: "Invalid admin email address", status: 400 });
      return;
    }
    // Check duplicate admin phone
    const [existingStaff] = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(eq(staffTable.phone, adminPhone.trim()))
      .limit(1);
    if (existingStaff) {
      res.status(409).json({
        title: "Phone already registered",
        detail: "An account with this phone number already exists.",
        status: 409,
      });
      return;
    }

    // Create company
    const [company] = await db
      .insert(companiesTable)
      .values({
        name: companyName.trim(),
        adminName: adminName.trim(),
        phone: adminPhone.trim(),
        email: adminEmail?.trim() || null,
        state: companyState?.trim() || null,
        district: companyDistrict?.trim() || null,
        projectName: projectName?.trim() || null,
        status: "active",
        subscriptionActive: true,
      })
      .returning();

    // Save logo if provided
    if (logoBase64) {
      const logoPath = saveLogoBase64(logoBase64, logoMime, company.id);
      if (logoPath) {
        await db
          .update(companiesTable)
          .set({ logoPath })
          .where(eq(companiesTable.id, company.id));
        company.logoPath = logoPath;
      }
    }

    // Create admin user linked to company
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const adminCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const [admin] = await db
      .insert(staffTable)
      .values({
        companyId: company.id,
        empCode: `ADM-${suffix}`,
        name: adminName.trim(),
        phone: adminPhone.trim(),
        role: "admin",
        organization: companyName.trim(),
        centerName: centerName?.trim() || null,
        projectName: projectName?.trim() || null,
        email: adminEmail?.trim() || null,
        state: state?.trim() || companyState?.trim() || null,
        district: district?.trim() || companyDistrict?.trim() || null,
        adminCode,
        approvalStatus: "approved",
      })
      .returning();

    res.status(201).json({
      company: toCompanyDTO({ ...company }),
      admin: {
        id: admin.id,
        empCode: admin.empCode,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
        companyId: admin.companyId,
        adminCode: admin.adminCode,
        organization: admin.organization,
        projectName: admin.projectName,
        email: admin.email,
        state: admin.state,
        district: admin.district,
        centerName: admin.centerName,
        approvalStatus: admin.approvalStatus,
        createdAt: admin.createdAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/companies/:id/branding ──────────────────────────────────────────
// Public: returns name, logo, project, state, district for a company.

router.get("/companies/:id/branding", async (req, res, next) => {
  try {
    const { id } = req.params;
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, id))
      .limit(1);
    if (!company) {
      res.status(404).json({ title: "Company not found", status: 404 });
      return;
    }
    res.json(toCompanyDTO(company));
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/companies/:id/logo ────────────────────────────────────────────
// Update company logo (admin of that company or super admin).

router.patch("/companies/:id/logo", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { logoBase64, logoMime } = req.body as {
      logoBase64?: string | null;
      logoMime?: string | null;
    };
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, id))
      .limit(1);
    if (!company) {
      res.status(404).json({ title: "Company not found", status: 404 });
      return;
    }
    const logoPath = saveLogoBase64(logoBase64, logoMime, id);
    const [updated] = await db
      .update(companiesTable)
      .set({ logoPath: logoPath ?? company.logoPath })
      .where(eq(companiesTable.id, id))
      .returning();
    res.json(toCompanyDTO(updated));
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/companies/:id/profile ─────────────────────────────────────────
// Update company profile fields.

router.patch("/companies/:id/profile", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, adminName, email, state, district, projectName } = req.body as {
      name?: string;
      adminName?: string;
      email?: string | null;
      state?: string | null;
      district?: string | null;
      projectName?: string | null;
    };
    const updates: Partial<typeof companiesTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (adminName !== undefined) updates.adminName = adminName.trim();
    if (email !== undefined) updates.email = email?.trim() || null;
    if (state !== undefined) updates.state = state?.trim() || null;
    if (district !== undefined) updates.district = district?.trim() || null;
    if (projectName !== undefined) updates.projectName = projectName?.trim() || null;

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

export { toCompanyDTO, toLogoUrl };
export default router;
