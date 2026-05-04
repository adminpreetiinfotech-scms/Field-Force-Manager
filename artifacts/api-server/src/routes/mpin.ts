import { companiesTable, db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import crypto from "node:crypto";

function toLogoUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  if (filePath.startsWith("/objects/")) return `/api/storage${filePath}`;
  const rel = filePath.replace(/^.*\/uploads\//, "uploads/").replace(/\\/g, "/");
  return `/api/${rel}`;
}

const router = Router();

async function getCompanyBranding(companyId: string | null | undefined) {
  const empty = { companyName: null, companyLogoUrl: null, companySchemeName: null, companyTcId: null, companyCenterLat: null, companyCenterLng: null, companyCenterRadiusMeters: null as number | null };
  if (!companyId) return empty;
  try {
    const [co] = await db
      .select({
        name: companiesTable.name,
        logoPath: companiesTable.logoPath,
        projectName: companiesTable.projectName,
        tcId: companiesTable.tcId,
        centerLat: companiesTable.centerLat,
        centerLng: companiesTable.centerLng,
        centerRadiusMeters: companiesTable.centerRadiusMeters,
      })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);
    if (!co) return empty;
    return {
      companyName:             co.name ?? null,
      companyLogoUrl:          toLogoUrl(co.logoPath),
      companySchemeName:       co.projectName ?? null,
      companyTcId:             co.tcId ?? null,
      companyCenterLat:        co.centerLat ?? null,
      companyCenterLng:        co.centerLng ?? null,
      companyCenterRadiusMeters: co.centerRadiusMeters ?? 200,
    };
  } catch {
    return empty;
  }
}

function hashMpin(mpin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(mpin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyMpin(mpin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const derived = crypto.scryptSync(mpin, salt, 64);
    return crypto.timingSafeEqual(derived, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

function toUserDTO(row: typeof staffTable.$inferSelect) {
  return {
    id: row.id,
    companyId: row.companyId ?? null,
    empCode: row.empCode,
    name: row.name,
    phone: row.phone,
    role: row.role,
    organization: row.organization ?? null,
    centerName: row.centerName ?? null,
    projectName: row.projectName ?? null,
    email: row.email ?? null,
    state: row.state ?? null,
    district: row.district ?? null,
    area: row.area ?? null,
    approvalStatus: row.approvalStatus,
    vehicleType: row.vehicleType ?? null,
    vehicleNumber: row.vehicleNumber ?? null,
    staffCategory: row.staffCategory ?? "field",
    centerStaffRole: row.centerStaffRole ?? null,
  };
}

// ─── POST /api/auth/check-phone ─────────────────────────────────────────────
// Returns whether the phone is registered, whether an MPIN is set, approvalStatus, and companyName.
router.post("/auth/check-phone", async (req, res, next) => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone) {
      res.status(400).json({ title: "Phone is required", status: 400 });
      return;
    }
    const rows = await db
      .select({
        id: staffTable.id,
        mpinHash: staffTable.mpinHash,
        approvalStatus: staffTable.approvalStatus,
        companyId: staffTable.companyId,
      })
      .from(staffTable)
      .where(eq(staffTable.phone, phone.trim()))
      .limit(1);

    if (rows.length === 0) {
      res.json({ exists: false, hasMpin: false, approvalStatus: null, companyName: null });
      return;
    }
    const row = rows[0]!;
    const branding = await getCompanyBranding(row.companyId);
    res.json({
      exists: true,
      hasMpin: !!row.mpinHash,
      approvalStatus: row.approvalStatus,
      companyName: branding.companyName,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/login-mpin ──────────────────────────────────────────────
// Verify MPIN and return the user object on success.
router.post("/auth/login-mpin", async (req, res, next) => {
  try {
    const { phone, mpin } = req.body as { phone?: string; mpin?: string };
    if (!phone || !mpin) {
      res.status(400).json({ title: "Phone and MPIN are required", status: 400 });
      return;
    }

    const rows = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.phone, phone.trim()))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ title: "Phone number not registered. Please register first.", status: 404 });
      return;
    }

    const row = rows[0]!;

    if (row.deletedAt) {
      res.status(403).json({ title: "This account no longer exists. Please contact admin.", status: 403 });
      return;
    }
    if (row.disabledAt) {
      res.status(403).json({ title: "Your account has been disabled by admin. Please contact your supervisor.", status: 403 });
      return;
    }
    if (row.approvalStatus === "pending") {
      res.status(403).json({ title: "Your account is pending admin approval.", status: 403 });
      return;
    }
    if (row.approvalStatus === "rejected") {
      res.status(403).json({ title: "Your account has been rejected. Please contact admin.", status: 403 });
      return;
    }

    // Check company status (super_admin has no company, skip)
    if (row.companyId) {
      const [company] = await db
        .select({
          status: companiesTable.status,
          subscriptionActive: companiesTable.subscriptionActive,
          subscriptionEndDate: companiesTable.subscriptionEndDate,
        })
        .from(companiesTable)
        .where(eq(companiesTable.id, row.companyId))
        .limit(1);
      if (company?.status === "inactive") {
        res.status(403).json({ title: "Your organization's account is currently inactive. Please contact support.", status: 403 });
        return;
      }
      if (company && !company.subscriptionActive) {
        res.status(403).json({ title: "Your organization's subscription is inactive. Please contact your admin.", status: 403 });
        return;
      }
      if (company?.subscriptionEndDate && new Date() > new Date(company.subscriptionEndDate)) {
        res.status(403).json({ title: "Subscription expired. Contact admin.", status: 403 });
        return;
      }
    }

    // Check block
    if (row.mpinBlockedUntil && new Date() < row.mpinBlockedUntil) {
      const secsLeft = Math.ceil((row.mpinBlockedUntil.getTime() - Date.now()) / 1000);
      const minsLeft = Math.ceil(secsLeft / 60);
      res.status(429).json({
        title: `Account locked due to too many failed attempts. Try again in ${minsLeft} minute(s).`,
        status: 429,
      });
      return;
    }

    if (!row.mpinHash) {
      res.status(400).json({
        title: "No MPIN set for this account. Please set your MPIN first.",
        status: 400,
      });
      return;
    }

    if (!verifyMpin(mpin, row.mpinHash)) {
      const newAttempts = (row.failedMpinAttempts ?? 0) + 1;
      const remaining = 3 - newAttempts;

      if (newAttempts >= 3) {
        const blockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await db
          .update(staffTable)
          .set({ failedMpinAttempts: newAttempts, mpinBlockedUntil: blockedUntil })
          .where(eq(staffTable.id, row.id));
        res.status(429).json({
          title: "Too many failed attempts. Account locked for 15 minutes.",
          status: 429,
        });
      } else {
        await db
          .update(staffTable)
          .set({ failedMpinAttempts: newAttempts })
          .where(eq(staffTable.id, row.id));
        res.status(401).json({
          title: `Incorrect MPIN. ${remaining} attempt(s) remaining.`,
          status: 401,
        });
      }
      return;
    }

    // Success — reset counters
    await db
      .update(staffTable)
      .set({ failedMpinAttempts: 0, mpinBlockedUntil: null })
      .where(eq(staffTable.id, row.id));

    // Fetch company branding for the response
    const branding = await getCompanyBranding(row.companyId);

    req.log.info({ phone }, "MPIN login successful");
    res.json({ user: { ...toUserDTO(row), ...branding } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/set-mpin ────────────────────────────────────────────────
// Set (or reset) the MPIN for a registered account.
router.post("/auth/set-mpin", async (req, res, next) => {
  try {
    const { phone, mpin } = req.body as { phone?: string; mpin?: string };
    if (!phone || !mpin) {
      res.status(400).json({ title: "Phone and MPIN are required", status: 400 });
      return;
    }
    if (!/^\d{4,6}$/.test(mpin)) {
      res.status(400).json({ title: "MPIN must be 4–6 digits only.", status: 400 });
      return;
    }

    const rows = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.phone, phone.trim()))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ title: "Phone number not registered.", status: 404 });
      return;
    }

    const row = rows[0]!;

    if (row.approvalStatus === "rejected") {
      res.status(403).json({ title: "Your account has been rejected. Please contact admin.", status: 403 });
      return;
    }

    const mpinHash = hashMpin(mpin);
    await db
      .update(staffTable)
      .set({ mpinHash, failedMpinAttempts: 0, mpinBlockedUntil: null })
      .where(eq(staffTable.id, row.id));

    const branding = await getCompanyBranding(row.companyId);
    req.log.info({ phone }, "MPIN set successfully");
    res.json({ user: { ...toUserDTO(row), ...branding } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/promote-super-admin ─────────────────────────────────────
// Promotes 9999999999 to super_admin. Requires correct MPIN for that account.
router.post("/auth/promote-super-admin", async (req, res, next) => {
  try {
    const { mpin } = req.body as { mpin?: string };
    if (!mpin) {
      res.status(400).json({ title: "MPIN required", status: 400 });
      return;
    }
    const [row] = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.phone, "9999999999"))
      .limit(1);
    if (!row) {
      res.status(404).json({ title: "Account not found", status: 404 });
      return;
    }
    if (!row.mpinHash || !verifyMpin(mpin, row.mpinHash)) {
      res.status(401).json({ title: "Incorrect MPIN", status: 401 });
      return;
    }
    const [updated] = await db
      .update(staffTable)
      .set({ role: "super_admin", approvalStatus: "approved", failedMpinAttempts: 0, mpinBlockedUntil: null })
      .where(eq(staffTable.phone, "9999999999"))
      .returning({ phone: staffTable.phone, role: staffTable.role, name: staffTable.name });
    res.json({ success: true, user: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
