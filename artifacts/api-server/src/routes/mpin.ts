import { centersTable, companiesTable, db, staffTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { Router } from "express";
import crypto from "node:crypto";
import { sendSmsSilent } from "../lib/twilio";

// ─── In-memory OTP store for MPIN reset ──────────────────────────────────────
// { phone → { otp, expiresAt, attempts } }
const otpStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

function toLogoUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  if (filePath.startsWith("/objects/")) return `/api/storage${filePath}`;
  const rel = filePath.replace(/^.*\/uploads\//, "uploads/").replace(/\\/g, "/");
  return `/api/${rel}`;
}

const router = Router();

async function getCompanyBranding(companyId: string | null | undefined, centerId?: string | null) {
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

    let geoLat: number | null = co.centerLat ?? null;
    let geoLng: number | null = co.centerLng ?? null;
    let geoRadius: number | null = co.centerRadiusMeters ?? 200;

    if (centerId) {
      try {
        const [center] = await db
          .select({ lat: centersTable.lat, lng: centersTable.lng, radiusMeters: centersTable.radiusMeters })
          .from(centersTable)
          .where(eq(centersTable.id, centerId))
          .limit(1);
        if (center?.lat != null && center?.lng != null) {
          geoLat = center.lat;
          geoLng = center.lng;
          geoRadius = center.radiusMeters ?? 200;
        }
      } catch {
        // fallback to company-level if center lookup fails
      }
    }

    return {
      companyName:               co.name ?? null,
      companyLogoUrl:            toLogoUrl(co.logoPath),
      companySchemeName:         co.projectName ?? null,
      companyTcId:               co.tcId ?? null,
      companyCenterLat:          geoLat,
      companyCenterLng:          geoLng,
      companyCenterRadiusMeters: geoRadius,
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
    centerId: row.centerId ?? null,
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
        centerId: staffTable.centerId,
      })
      .from(staffTable)
      .where(
        and(
          eq(staffTable.phone, phone.trim()),
          isNull(staffTable.deletedAt),
          isNull(staffTable.disabledAt),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      res.json({ exists: false, hasMpin: false, approvalStatus: null, companyName: null, centerId: null });
      return;
    }
    const row = rows[0]!;
    const branding = await getCompanyBranding(row.companyId);
    res.json({
      exists: true,
      hasMpin: !!row.mpinHash,
      approvalStatus: row.approvalStatus,
      companyName: branding.companyName,
      centerId: row.centerId ?? null,
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

    // Fetch company branding for the response (centerId overrides company-level geofence)
    const branding = await getCompanyBranding(row.companyId, row.centerId);

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

    if (row.deletedAt) {
      res.status(403).json({ title: "This account no longer exists. Please contact admin.", status: 403 });
      return;
    }
    if (row.disabledAt) {
      res.status(403).json({ title: "Your account has been disabled by admin. Please contact your supervisor.", status: 403 });
      return;
    }
    if (row.approvalStatus === "rejected") {
      res.status(403).json({ title: "Your account has been rejected. Please contact admin.", status: 403 });
      return;
    }

    const mpinHash = hashMpin(mpin);
    await db
      .update(staffTable)
      .set({ mpinHash, failedMpinAttempts: 0, mpinBlockedUntil: null })
      .where(eq(staffTable.id, row.id));

    const branding = await getCompanyBranding(row.companyId, row.centerId);
    req.log.info({ phone }, "MPIN set successfully");
    res.json({ user: { ...toUserDTO(row), ...branding } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/unlock-mpin ─────────────────────────────────────────────
// Emergency unlock for accounts locked due to too many failed MPIN attempts.
// Protected by ADMIN_REGISTRATION_KEY — no session required.
router.post("/auth/unlock-mpin", async (req, res, next) => {
  try {
    const { phone, key } = req.body as { phone?: string; key?: string };
    const requiredKey = process.env.ADMIN_REGISTRATION_KEY;
    if (!key || !requiredKey || key.trim() !== requiredKey.trim()) {
      res.status(403).json({ title: "Invalid key", status: 403 });
      return;
    }
    if (!phone) {
      res.status(400).json({ title: "Phone is required", status: 400 });
      return;
    }
    const result = await db
      .update(staffTable)
      .set({ failedMpinAttempts: 0, mpinBlockedUntil: null })
      .where(eq(staffTable.phone, phone.trim()))
      .returning({ id: staffTable.id, phone: staffTable.phone });
    if (result.length === 0) {
      res.status(404).json({ title: "Phone not found", status: 404 });
      return;
    }
    req.log.info({ phone }, "MPIN lock cleared via emergency unlock");
    res.json({ success: true, phone: result[0]!.phone });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/reset-mpin ───────────────────────────────────────────────
// Emergency MPIN reset — sets a new MPIN for any account.
// Protected by ADMIN_REGISTRATION_KEY — no session required.
router.post("/auth/reset-mpin", async (req, res, next) => {
  try {
    const { phone, key, newMpin } = req.body as { phone?: string; key?: string; newMpin?: string };
    const requiredKey = process.env.ADMIN_REGISTRATION_KEY;
    if (!key || !requiredKey || key.trim() !== requiredKey.trim()) {
      res.status(403).json({ title: "Invalid key", status: 403 });
      return;
    }
    if (!phone || !newMpin) {
      res.status(400).json({ title: "phone and newMpin are required", status: 400 });
      return;
    }
    if (!/^\d{4,6}$/.test(newMpin)) {
      res.status(400).json({ title: "MPIN must be 4-6 digits", status: 400 });
      return;
    }
    const mpinHash = hashMpin(newMpin);
    const result = await db
      .update(staffTable)
      .set({ mpinHash, failedMpinAttempts: 0, mpinBlockedUntil: null })
      .where(eq(staffTable.phone, phone.trim()))
      .returning({ id: staffTable.id, phone: staffTable.phone });
    if (result.length === 0) {
      res.status(404).json({ title: "Phone not found", status: 404 });
      return;
    }
    req.log.info({ phone }, "MPIN reset via emergency reset endpoint");
    res.json({ success: true, phone: result[0]!.phone });
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

// ─── POST /api/auth/forgot-mpin/send-otp ─────────────────────────────────────
// Sends a 6-digit OTP via Twilio SMS to verify admin identity before MPIN reset.
router.post("/auth/forgot-mpin/send-otp", async (req, res, next) => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone || !/^\d{10}$/.test(phone.trim())) {
      res.status(400).json({ title: "Valid 10-digit phone required", status: 400 });
      return;
    }

    const [row] = await db
      .select({ id: staffTable.id, role: staffTable.role, approvalStatus: staffTable.approvalStatus, deletedAt: staffTable.deletedAt, disabledAt: staffTable.disabledAt })
      .from(staffTable)
      .where(and(eq(staffTable.phone, phone.trim()), isNull(staffTable.deletedAt)))
      .limit(1);

    if (!row || (row.role !== "admin" && row.role !== "super_admin")) {
      res.status(404).json({ title: "Admin account not found for this phone number.", status: 404 });
      return;
    }
    if (row.disabledAt) {
      res.status(403).json({ title: "Your account has been disabled. Contact support.", status: 403 });
      return;
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(phone.trim(), { otp, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });

    const msg = `Your SCMS MPIN reset OTP is: ${otp}. Valid for 10 minutes. Do not share with anyone.`;
    await sendSmsSilent(phone.trim(), msg, (err) => req.log.warn({ err }, "OTP SMS failed"));

    req.log.info({ phone }, "Forgot MPIN OTP sent");
    res.json({ sent: true, maskedPhone: `XXXXXX${phone.trim().slice(-4)}` });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/forgot-mpin/verify-reset ─────────────────────────────────
// Verifies the OTP and sets the new MPIN.
router.post("/auth/forgot-mpin/verify-reset", async (req, res, next) => {
  try {
    const { phone, otp, newMpin } = req.body as { phone?: string; otp?: string; newMpin?: string };

    if (!phone || !/^\d{10}$/.test(phone.trim())) {
      res.status(400).json({ title: "Valid 10-digit phone required", status: 400 });
      return;
    }
    if (!otp || !/^\d{6}$/.test(otp.trim())) {
      res.status(400).json({ title: "OTP must be 6 digits", status: 400 });
      return;
    }
    if (!newMpin || !/^\d{4,6}$/.test(newMpin.trim())) {
      res.status(400).json({ title: "New MPIN must be 4–6 digits", status: 400 });
      return;
    }

    const entry = otpStore.get(phone.trim());
    if (!entry) {
      res.status(400).json({ title: "No OTP found. Please request a new OTP.", status: 400 });
      return;
    }
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(phone.trim());
      res.status(400).json({ title: "OTP has expired. Please request a new one.", status: 400 });
      return;
    }
    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
      otpStore.delete(phone.trim());
      res.status(429).json({ title: "Too many incorrect attempts. Please request a new OTP.", status: 429 });
      return;
    }
    if (entry.otp !== otp.trim()) {
      entry.attempts += 1;
      const remaining = OTP_MAX_ATTEMPTS - entry.attempts;
      res.status(401).json({ title: `Incorrect OTP. ${remaining} attempt(s) remaining.`, status: 401 });
      return;
    }

    otpStore.delete(phone.trim());

    const mpinHash = hashMpin(newMpin.trim());
    const updated = await db
      .update(staffTable)
      .set({ mpinHash, failedMpinAttempts: 0, mpinBlockedUntil: null })
      .where(and(eq(staffTable.phone, phone.trim()), isNull(staffTable.deletedAt)))
      .returning({ id: staffTable.id });

    if (updated.length === 0) {
      res.status(404).json({ title: "Account not found", status: 404 });
      return;
    }

    req.log.info({ phone }, "MPIN reset via OTP verification");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/push-token ────────────────────────────────────────────────
// Staff saves their Expo push token after login. Upserts into staff.expo_push_token.

router.post("/auth/push-token", async (req, res, next) => {
  try {
    const phone =
      (req.headers["x-staff-phone"] as string | undefined) ??
      (req.headers["x-admin-phone"] as string | undefined);
    if (!phone?.trim()) {
      res.status(401).json({ title: "Phone header required", status: 401 });
      return;
    }
    const { token } = req.body as { token?: string };
    if (
      !token ||
      (!token.startsWith("ExponentPushToken[") &&
        !token.startsWith("ExpoPushToken["))
    ) {
      res.status(400).json({ title: "Invalid Expo push token", status: 400 });
      return;
    }
    await db
      .update(staffTable)
      .set({ expoPushToken: token })
      .where(eq(staffTable.phone, phone.trim()));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
