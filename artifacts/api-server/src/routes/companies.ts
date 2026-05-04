import { centersTable, companiesTable, db, staffTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { uploadLogoBuffer } from "../lib/logoStorage";
import { isValidUUID } from "../lib/validation";
import { getAdminCompanyId } from "./admin";

const router: IRouter = Router();

/**
 * Convert a base64-encoded logo string to a Buffer and upload to GCS.
 * Returns the GCS object path (/objects/logos/<companyId>.ext) or null.
 */
async function saveLogoToGCS(
  base64: string | null | undefined,
  mimeType: string | null | undefined,
  companyId: string,
): Promise<string | null> {
  if (!base64) return null;
  try {
    const buf = Buffer.from(base64, "base64");
    const mime = mimeType || "image/jpeg";
    return await uploadLogoBuffer(buf, mime, companyId);
  } catch (err) {
    console.error("[companies] logo upload failed:", err);
    return null;
  }
}

/**
 * Convert a DB logoPath to a URL that clients can fetch.
 *   - GCS paths  (/objects/logos/...)   → /api/storage/objects/logos/...
 *   - Legacy disk paths (/home/... or uploads/...) → /api/uploads/...
 *   - Already-correct /api/... paths   → returned as-is
 */
export function toLogoUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  // GCS object path stored in DB
  if (filePath.startsWith("/objects/")) {
    return `/api/storage${filePath}`;
  }
  // Legacy disk path (old data) — keep serving via /api/uploads
  if (filePath.startsWith("/") || filePath.startsWith("uploads/")) {
    const rel = filePath.replace(/^.*\/uploads\//, "uploads/").replace(/\\/g, "/");
    return `/api/${rel}`;
  }
  return null;
}

function toCompanyDTO(c: typeof companiesTable.$inferSelect) {
  const now = new Date();
  const endDate = c.subscriptionEndDate ? new Date(c.subscriptionEndDate) : null;
  const isDateExpired = endDate !== null && now > endDate;
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
    plan: c.plan ?? null,
    subscriptionStartDate: c.subscriptionStartDate?.toISOString() ?? null,
    subscriptionEndDate: c.subscriptionEndDate?.toISOString() ?? null,
    paymentStatus: c.paymentStatus ?? null,
    isSubscriptionExpired: isDateExpired,
    centerName: c.centerName ?? null,
    tcId: c.tcId ?? null,
    centerLat: c.centerLat ?? null,
    centerLng: c.centerLng ?? null,
    centerRadiusMeters: c.centerRadiusMeters ?? 200,
    createdAt: c.createdAt?.toISOString() ?? null,
  };
}

export function isCompanySubscriptionBlocked(company: {
  subscriptionActive: boolean;
  subscriptionEndDate: Date | null | string | undefined;
}): boolean {
  if (!company.subscriptionActive) return true;
  if (company.subscriptionEndDate) {
    return new Date() > new Date(company.subscriptionEndDate);
  }
  return false;
}

// ─── POST /api/companies/register ─────────────────────────────────────────────
// Creates a company + its first admin user atomically.

router.post("/companies/register", async (req, res, next) => {
  try {
    const {
      companyName,
      companyState,
      companyDistrict,
      projectName,
      logoBase64,
      logoMime,
      adminName,
      adminPhone,
      adminEmail,
      adminRegistrationKey,
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

    if (!companyName || companyName.trim().length < 2) {
      res.status(400).json({ title: "Company name required", status: 400 });
      return;
    }
    if (!adminName || adminName.trim().length < 2) {
      res.status(400).json({ title: "Admin name required (min 2 chars)", status: 400 });
      return;
    }
    if (!adminPhone || !/^\d{10}$/.test(adminPhone.trim())) {
      res.status(400).json({ title: "Admin phone must be exactly 10 digits", status: 400 });
      return;
    }
    const requiredKey = process.env.ADMIN_REGISTRATION_KEY;
    if (!adminRegistrationKey?.trim()) {
      res.status(403).json({ title: "Admin registration key required", status: 403 });
      return;
    }
    if (requiredKey && adminRegistrationKey.trim() !== requiredKey.trim()) {
      res.status(403).json({ title: "Invalid admin registration key", status: 403 });
      return;
    }
    if (adminEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
      res.status(400).json({ title: "Invalid admin email address", status: 400 });
      return;
    }
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

    // Create company row first (no logo yet)
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

    // Upload logo to GCS (async, after company row exists so we have an ID)
    if (logoBase64) {
      const logoPath = await saveLogoToGCS(logoBase64, logoMime, company.id);
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
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
    const { logoBase64, logoMime, adminPhone } = req.body as {
      logoBase64?: string | null;
      logoMime?: string | null;
      adminPhone?: string;
    };
    const phone =
      (req.headers["x-admin-phone"] as string | undefined) ?? adminPhone;
    if (!phone) {
      res.status(401).json({ title: "Unauthorized: admin phone required", status: 401 });
      return;
    }
    const adminInfo = await getAdminCompanyId(phone);
    if (!adminInfo) {
      res.status(403).json({ title: "Forbidden: admin access required", status: 403 });
      return;
    }
    if (adminInfo.role !== "super_admin" && adminInfo.companyId !== id) {
      res.status(403).json({ title: "Forbidden: not your company", status: 403 });
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
    const logoPath = await saveLogoToGCS(logoBase64, logoMime, id);
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
// Update company profile fields (name, adminName, email, state, district, projectName).

router.patch("/companies/:id/profile", async (req, res, next) => {
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
    const { name, adminName, email, state, district, projectName, centerName, tcId, adminPhone } = req.body as {
      name?: string;
      adminName?: string;
      email?: string | null;
      state?: string | null;
      district?: string | null;
      projectName?: string | null;
      centerName?: string | null;
      tcId?: string | null;
      adminPhone?: string;
    };
    const phone =
      (req.headers["x-admin-phone"] as string | undefined) ?? adminPhone;
    if (!phone) {
      res.status(401).json({ title: "Unauthorized: admin phone required", status: 401 });
      return;
    }
    const adminInfo = await getAdminCompanyId(phone);
    if (!adminInfo) {
      res.status(403).json({ title: "Forbidden: admin access required", status: 403 });
      return;
    }
    if (adminInfo.role !== "super_admin" && adminInfo.companyId !== id) {
      res.status(403).json({ title: "Forbidden: not your company", status: 403 });
      return;
    }
    const { centerLat, centerLng, centerRadiusMeters } = req.body as {
      centerLat?: number | null;
      centerLng?: number | null;
      centerRadiusMeters?: number | null;
    };

    const updates: Partial<typeof companiesTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (adminName !== undefined) updates.adminName = adminName.trim();
    if (email !== undefined) updates.email = email?.trim() || null;
    if (state !== undefined) updates.state = state?.trim() || null;
    if (district !== undefined) updates.district = district?.trim() || null;
    if (projectName !== undefined) updates.projectName = projectName?.trim() || null;
    if (centerName !== undefined) updates.centerName = centerName?.trim() || null;
    if (tcId !== undefined) updates.tcId = tcId?.trim() || null;
    if (centerLat !== undefined) {
      if (typeof centerLat === "number" && (centerLat < -90 || centerLat > 90)) {
        res.status(400).json({ title: "centerLat must be between -90 and 90", status: 400 });
        return;
      }
      updates.centerLat = typeof centerLat === "number" ? centerLat : null;
    }
    if (centerLng !== undefined) {
      if (typeof centerLng === "number" && (centerLng < -180 || centerLng > 180)) {
        res.status(400).json({ title: "centerLng must be between -180 and 180", status: 400 });
        return;
      }
      updates.centerLng = typeof centerLng === "number" ? centerLng : null;
    }
    if (centerRadiusMeters !== undefined) updates.centerRadiusMeters = typeof centerRadiusMeters === "number" ? Math.max(50, Math.round(centerRadiusMeters)) : 200;

    if (Object.keys(updates).length === 0) {
      const [existing] = await db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.id, id))
        .limit(1);
      if (!existing) {
        res.status(404).json({ title: "Company not found", status: 404 });
        return;
      }
      res.json(toCompanyDTO(existing));
      return;
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

// ─── Centers helper ────────────────────────────────────────────────────────────

function toCenterDTO(c: typeof centersTable.$inferSelect) {
  return {
    id: c.id,
    companyId: c.companyId,
    name: c.name,
    tcId: c.tcId ?? null,
    courses: (c.courses as string[] | null) ?? [],
    state: c.state ?? null,
    district: c.district ?? null,
    block: c.block ?? null,
    pinCode: c.pinCode ?? null,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
    radiusMeters: c.radiusMeters ?? 200,
    createdAt: c.createdAt?.toISOString() ?? null,
  };
}

// ─── GET /api/companies/:id/centers ────────────────────────────────────────────
// List all training centers for a company.

router.get("/companies/:id/centers", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) { res.status(400).json({ title: "Invalid company id", status: 400 }); return; }
    const centers = await db
      .select()
      .from(centersTable)
      .where(eq(centersTable.companyId, id))
      .orderBy(centersTable.createdAt);
    res.json(centers.map(toCenterDTO));
  } catch (err) { next(err); }
});

// ─── GET /api/centers/:centerId ────────────────────────────────────────────────
// Public endpoint: fetch a single center by its UUID (used by candidate form).

router.get("/centers/:centerId", async (req, res, next) => {
  try {
    const { centerId } = req.params;
    if (!isValidUUID(centerId)) { res.status(400).json({ title: "Invalid center id", status: 400 }); return; }
    const [center] = await db.select().from(centersTable).where(eq(centersTable.id, centerId)).limit(1);
    if (!center) { res.status(404).json({ title: "Center not found", status: 404 }); return; }
    res.json(toCenterDTO(center));
  } catch (err) { next(err); }
});

// ─── GET /api/centers?adminCode=XX ─────────────────────────────────────────────
// Public endpoint: mobile staff registration picks a center by admin code.

router.get("/centers", async (req, res, next) => {
  try {
    const { adminCode, companyId } = req.query as { adminCode?: string; companyId?: string };
    let resolvedCompanyId: string | null = null;
    if (companyId && isValidUUID(companyId)) {
      resolvedCompanyId = companyId;
    } else if (adminCode?.trim()) {
      const [admin] = await db
        .select({ companyId: staffTable.companyId })
        .from(staffTable)
        .where(and(eq(staffTable.adminCode, adminCode.trim().toUpperCase()), eq(staffTable.role, "admin")))
        .limit(1);
      resolvedCompanyId = admin?.companyId ?? null;
    }
    if (!resolvedCompanyId) { res.json([]); return; }
    const centers = await db
      .select()
      .from(centersTable)
      .where(eq(centersTable.companyId, resolvedCompanyId))
      .orderBy(centersTable.name);
    res.json(centers.map(toCenterDTO));
  } catch (err) { next(err); }
});

// ─── POST /api/companies/:id/centers ───────────────────────────────────────────
// Create a new training center for a company.

router.post("/companies/:id/centers", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) { res.status(400).json({ title: "Invalid company id", status: 400 }); return; }
    const phone = req.headers["x-admin-phone"] as string | undefined;
    if (!phone) { res.status(401).json({ title: "Unauthorized", status: 401 }); return; }
    const adminInfo = await getAdminCompanyId(phone);
    if (!adminInfo) { res.status(403).json({ title: "Forbidden", status: 403 }); return; }
    if (adminInfo.role !== "super_admin" && adminInfo.companyId !== id) {
      res.status(403).json({ title: "Forbidden: not your company", status: 403 }); return;
    }
    const { name, tcId, courses, state, district, block, pinCode, lat, lng, radiusMeters } = req.body as {
      name?: string;
      tcId?: string | null;
      courses?: string[];
      state?: string | null;
      district?: string | null;
      block?: string | null;
      pinCode?: string | null;
      lat?: number | null;
      lng?: number | null;
      radiusMeters?: number | null;
    };
    if (!name || name.trim().length < 2) {
      res.status(400).json({ title: "Center name required (min 2 chars)", status: 400 }); return;
    }
    const [inserted] = await db.insert(centersTable).values({
      companyId: id,
      name: name.trim(),
      tcId: tcId?.trim() || null,
      courses: Array.isArray(courses) ? courses.filter(Boolean).map(c => c.trim()) : [],
      state: state?.trim() || null,
      district: district?.trim() || null,
      block: block?.trim() || null,
      pinCode: pinCode?.trim() || null,
      lat: typeof lat === "number" ? lat : null,
      lng: typeof lng === "number" ? lng : null,
      radiusMeters: typeof radiusMeters === "number" ? Math.max(50, Math.round(radiusMeters)) : 200,
    }).returning();
    res.status(201).json(toCenterDTO(inserted));
  } catch (err) { next(err); }
});

// ─── PATCH /api/companies/:id/centers/:centerId ────────────────────────────────
// Update an existing training center.

router.patch("/companies/:id/centers/:centerId", async (req, res, next) => {
  try {
    const { id, centerId } = req.params;
    if (!isValidUUID(id) || !isValidUUID(centerId)) {
      res.status(400).json({ title: "Invalid id", status: 400 }); return;
    }
    const phone = req.headers["x-admin-phone"] as string | undefined;
    if (!phone) { res.status(401).json({ title: "Unauthorized", status: 401 }); return; }
    const adminInfo = await getAdminCompanyId(phone);
    if (!adminInfo) { res.status(403).json({ title: "Forbidden", status: 403 }); return; }
    if (adminInfo.role !== "super_admin" && adminInfo.companyId !== id) {
      res.status(403).json({ title: "Forbidden: not your company", status: 403 }); return;
    }
    const { name, tcId, courses, state, district, block, pinCode, lat, lng, radiusMeters } = req.body as {
      name?: string;
      tcId?: string | null;
      courses?: string[];
      state?: string | null;
      district?: string | null;
      block?: string | null;
      pinCode?: string | null;
      lat?: number | null;
      lng?: number | null;
      radiusMeters?: number | null;
    };
    const updates: Partial<typeof centersTable.$inferInsert> = {};
    if (name !== undefined) {
      if (!name.trim() || name.trim().length < 2) {
        res.status(400).json({ title: "Center name required (min 2 chars)", status: 400 }); return;
      }
      updates.name = name.trim();
    }
    if (tcId !== undefined) updates.tcId = tcId?.trim() || null;
    if (courses !== undefined) updates.courses = Array.isArray(courses) ? courses.filter(Boolean).map(c => c.trim()) : [];
    if (state !== undefined) updates.state = state?.trim() || null;
    if (district !== undefined) updates.district = district?.trim() || null;
    if (block !== undefined) updates.block = block?.trim() || null;
    if (pinCode !== undefined) updates.pinCode = pinCode?.trim() || null;
    if (lat !== undefined) updates.lat = typeof lat === "number" ? lat : null;
    if (lng !== undefined) updates.lng = typeof lng === "number" ? lng : null;
    if (radiusMeters !== undefined) updates.radiusMeters = typeof radiusMeters === "number" ? Math.max(50, Math.round(radiusMeters)) : 200;

    if (Object.keys(updates).length === 0) {
      const [existing] = await db.select().from(centersTable).where(and(eq(centersTable.id, centerId), eq(centersTable.companyId, id))).limit(1);
      if (!existing) { res.status(404).json({ title: "Center not found", status: 404 }); return; }
      res.json(toCenterDTO(existing)); return;
    }
    const [updated] = await db.update(centersTable).set(updates)
      .where(and(eq(centersTable.id, centerId), eq(centersTable.companyId, id)))
      .returning();
    if (!updated) { res.status(404).json({ title: "Center not found", status: 404 }); return; }
    res.json(toCenterDTO(updated));
  } catch (err) { next(err); }
});

// ─── DELETE /api/companies/:id/centers/:centerId ────────────────────────────────

router.delete("/companies/:id/centers/:centerId", async (req, res, next) => {
  try {
    const { id, centerId } = req.params;
    if (!isValidUUID(id) || !isValidUUID(centerId)) {
      res.status(400).json({ title: "Invalid id", status: 400 }); return;
    }
    const phone = req.headers["x-admin-phone"] as string | undefined;
    if (!phone) { res.status(401).json({ title: "Unauthorized", status: 401 }); return; }
    const adminInfo = await getAdminCompanyId(phone);
    if (!adminInfo) { res.status(403).json({ title: "Forbidden", status: 403 }); return; }
    if (adminInfo.role !== "super_admin" && adminInfo.companyId !== id) {
      res.status(403).json({ title: "Forbidden: not your company", status: 403 }); return;
    }
    const deleted = await db.delete(centersTable)
      .where(and(eq(centersTable.id, centerId), eq(centersTable.companyId, id)))
      .returning({ id: centersTable.id });
    if (!deleted.length) { res.status(404).json({ title: "Center not found", status: 404 }); return; }
    res.json({ success: true, id: deleted[0]!.id });
  } catch (err) { next(err); }
});

export { toCompanyDTO };
export default router;
