/**
 * QR Attendance Routes
 *
 * GET  /api/staff/:staffId/qr-token        — get staff's QR token (admin only)
 * POST /api/qr-attendance/checkin          — scan QR card to check in ground staff
 * POST /api/qr-attendance/checkout         — scan QR card to check out ground staff
 * GET  /api/admin/qr-attendance            — list QR attendance for a date (admin only)
 */

import { db, staffTable, qrAttendanceTable, centersTable, companiesTable } from "@workspace/db";
import { and, eq, isNull, desc } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAdmin } from "./admin";
import crypto from "node:crypto";

const router: IRouter = Router();

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Generate a deterministic QR token for a staff member.
 * Token = HMAC-SHA256(staffId, secret) — first 32 hex chars.
 * This is stable across requests so the printed card never expires.
 */
function makeQrToken(staffId: string): string {
  const secret = process.env.SESSION_SECRET ?? "scms-qr-secret";
  return crypto.createHmac("sha256", secret).update(staffId).digest("hex").slice(0, 32);
}

function decodeQrToken(token: string): string | null {
  // Token is not reversible — we store staffId encoded, so we brute-force lookup
  // by including staffId in the QR payload: "staffId:token"
  // QR format: "<staffId>:<token>"
  const parts = token.split(":");
  if (parts.length !== 2) return null;
  const [staffId, tok] = parts;
  if (!staffId || !tok) return null;
  const expected = makeQrToken(staffId);
  if (expected !== tok) return null;
  return staffId;
}

// ─── GET /api/staff/:staffId/qr-token ────────────────────────────────────────

router.get("/staff/:staffId/qr-token", requireAdmin, async (req, res, next) => {
  try {
    const staffId = String(req.params.staffId ?? "");
    const companyId = res.locals.companyId as string | null;

    if (!/^[0-9a-fA-F-]{36}$/.test(staffId)) {
      res.status(400).json({ title: "Invalid staffId", status: 400 });
      return;
    }

    const [staffRow] = await db
      .select({
        id: staffTable.id,
        name: staffTable.name,
        empCode: staffTable.empCode,
        centerStaffRole: staffTable.centerStaffRole,
        staffCategoryGroup: staffTable.staffCategoryGroup,
        companyId: staffTable.companyId,
        centerId: staffTable.centerId,
        centerName: staffTable.centerName,
        referencePhotoUrl: staffTable.referencePhotoUrl,
      })
      .from(staffTable)
      .where(
        companyId
          ? and(eq(staffTable.id, staffId), eq(staffTable.companyId, companyId), isNull(staffTable.deletedAt))
          : and(eq(staffTable.id, staffId), isNull(staffTable.deletedAt)),
      )
      .limit(1);

    if (!staffRow) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

    const token = makeQrToken(staffRow.id);
    const qrPayload = `${staffRow.id}:${token}`;

    res.json({
      staffId: staffRow.id,
      name: staffRow.name,
      empCode: staffRow.empCode,
      centerName: staffRow.centerName ?? null,
      role: staffRow.centerStaffRole ?? null,
      group: staffRow.staffCategoryGroup ?? null,
      referencePhotoUrl: staffRow.referencePhotoUrl ?? null,
      qrPayload,
    });
  } catch (err) { next(err); }
});

// ─── POST /api/qr-attendance/checkin ─────────────────────────────────────────

router.post("/qr-attendance/checkin", async (req, res, next) => {
  try {
    const scannerPhone = (req.headers["x-staff-phone"] as string | undefined)?.trim() ?? "";
    if (!scannerPhone) {
      res.status(401).json({ title: "x-staff-phone header required", status: 401 });
      return;
    }

    const body = req.body as {
      qrPayload?: string;
      lat?: number;
      lng?: number;
      scannerSelfieBase64?: string;
    };

    const { qrPayload, lat, lng } = body;

    if (!qrPayload) {
      res.status(400).json({ title: "qrPayload is required", status: 400 });
      return;
    }

    // Decode QR
    const staffId = decodeQrToken(qrPayload);
    if (!staffId) {
      res.status(400).json({ title: "Invalid or tampered QR code", status: 400 });
      return;
    }

    // Fetch scanner
    const [scannerRow] = await db
      .select({ id: staffTable.id, name: staffTable.name, companyId: staffTable.companyId, approvalStatus: staffTable.approvalStatus, disabledAt: staffTable.disabledAt })
      .from(staffTable)
      .where(and(eq(staffTable.phone, scannerPhone), isNull(staffTable.deletedAt)))
      .limit(1);

    if (!scannerRow || scannerRow.approvalStatus !== "approved" || scannerRow.disabledAt) {
      res.status(403).json({ title: "Scanner not authorized", status: 403 });
      return;
    }

    // Fetch ground staff
    const [staffRow] = await db
      .select({ id: staffTable.id, name: staffTable.name, companyId: staffTable.companyId, centerId: staffTable.centerId, approvalStatus: staffTable.approvalStatus, disabledAt: staffTable.disabledAt })
      .from(staffTable)
      .where(and(eq(staffTable.id, staffId), isNull(staffTable.deletedAt)))
      .limit(1);

    if (!staffRow) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

    // Company isolation
    if (scannerRow.companyId && staffRow.companyId && scannerRow.companyId !== staffRow.companyId) {
      res.status(403).json({ title: "Staff not in your company", status: 403 });
      return;
    }

    // GPS geofence check — if center has coordinates, enforce 200m radius
    if (lat != null && lng != null && staffRow.centerId) {
      const [centerRow] = await db
        .select({ lat: centersTable.lat, lng: centersTable.lng, radiusMeters: centersTable.radiusMeters })
        .from(centersTable)
        .where(eq(centersTable.id, staffRow.centerId))
        .limit(1);

      if (centerRow?.lat != null && centerRow?.lng != null) {
        const radius = centerRow.radiusMeters ?? 200;
        const dist = haversineM(lat, lng, centerRow.lat, centerRow.lng);
        if (dist > radius) {
          res.status(422).json({
            title: "Outside geo-fence",
            detail: `You are ${Math.round(dist)}m from the center. Must be within ${radius}m to mark QR attendance.`,
            distanceM: Math.round(dist),
            radiusM: radius,
            status: 422,
          });
          return;
        }
      }
    }

    const date = todayIST();

    // Prevent duplicate check-in same day
    const existing = await db
      .select({ id: qrAttendanceTable.id })
      .from(qrAttendanceTable)
      .where(and(
        eq(qrAttendanceTable.staffId, staffId),
        eq(qrAttendanceTable.type, "checkin"),
        eq(qrAttendanceTable.date, date),
      ))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ title: "Already checked in today", status: 409 });
      return;
    }

    const [inserted] = await db.insert(qrAttendanceTable).values({
      companyId: staffRow.companyId ?? scannerRow.companyId,
      staffId: staffRow.id,
      staffName: staffRow.name,
      scannedById: scannerRow.id,
      scannedByName: scannerRow.name,
      type: "checkin",
      date,
      lat: lat ?? null,
      lng: lng ?? null,
      scannerSelfieUrl: null,
      occurredAt: new Date(),
    }).returning();

    res.status(201).json({
      id: inserted.id,
      staffName: staffRow.name,
      type: "checkin",
      date,
      occurredAt: inserted.occurredAt,
      scannedBy: scannerRow.name,
    });
  } catch (err) { next(err); }
});

// ─── POST /api/qr-attendance/checkout ────────────────────────────────────────

router.post("/qr-attendance/checkout", async (req, res, next) => {
  try {
    const scannerPhone = (req.headers["x-staff-phone"] as string | undefined)?.trim() ?? "";
    if (!scannerPhone) {
      res.status(401).json({ title: "x-staff-phone header required", status: 401 });
      return;
    }

    const body = req.body as { qrPayload?: string; lat?: number; lng?: number; };
    const { qrPayload, lat, lng } = body;

    if (!qrPayload) {
      res.status(400).json({ title: "qrPayload is required", status: 400 });
      return;
    }

    const staffId = decodeQrToken(qrPayload);
    if (!staffId) {
      res.status(400).json({ title: "Invalid or tampered QR code", status: 400 });
      return;
    }

    const [scannerRow] = await db
      .select({ id: staffTable.id, name: staffTable.name, companyId: staffTable.companyId, approvalStatus: staffTable.approvalStatus, disabledAt: staffTable.disabledAt })
      .from(staffTable)
      .where(and(eq(staffTable.phone, scannerPhone), isNull(staffTable.deletedAt)))
      .limit(1);

    if (!scannerRow || scannerRow.approvalStatus !== "approved" || scannerRow.disabledAt) {
      res.status(403).json({ title: "Scanner not authorized", status: 403 });
      return;
    }

    const [staffRow] = await db
      .select({ id: staffTable.id, name: staffTable.name, companyId: staffTable.companyId, centerId: staffTable.centerId })
      .from(staffTable)
      .where(and(eq(staffTable.id, staffId), isNull(staffTable.deletedAt)))
      .limit(1);

    if (!staffRow) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

    if (scannerRow.companyId && staffRow.companyId && scannerRow.companyId !== staffRow.companyId) {
      res.status(403).json({ title: "Staff not in your company", status: 403 });
      return;
    }

    // GPS geofence check
    if (lat != null && lng != null && staffRow.centerId) {
      const [centerRow] = await db
        .select({ lat: centersTable.lat, lng: centersTable.lng, radiusMeters: centersTable.radiusMeters })
        .from(centersTable)
        .where(eq(centersTable.id, staffRow.centerId))
        .limit(1);

      if (centerRow?.lat != null && centerRow?.lng != null) {
        const radius = centerRow.radiusMeters ?? 200;
        const dist = haversineM(lat, lng, centerRow.lat, centerRow.lng);
        if (dist > radius) {
          res.status(422).json({
            title: "Outside geo-fence",
            detail: `You are ${Math.round(dist)}m from the center.`,
            distanceM: Math.round(dist),
            status: 422,
          });
          return;
        }
      }
    }

    const date = todayIST();

    // Must have checked in first
    const checkin = await db
      .select({ id: qrAttendanceTable.id })
      .from(qrAttendanceTable)
      .where(and(
        eq(qrAttendanceTable.staffId, staffId),
        eq(qrAttendanceTable.type, "checkin"),
        eq(qrAttendanceTable.date, date),
      ))
      .limit(1);

    if (checkin.length === 0) {
      res.status(422).json({ title: "No check-in found for today", detail: "Please check in first before checking out.", status: 422 });
      return;
    }

    // Prevent duplicate checkout
    const existingOut = await db
      .select({ id: qrAttendanceTable.id })
      .from(qrAttendanceTable)
      .where(and(
        eq(qrAttendanceTable.staffId, staffId),
        eq(qrAttendanceTable.type, "checkout"),
        eq(qrAttendanceTable.date, date),
      ))
      .limit(1);

    if (existingOut.length > 0) {
      res.status(409).json({ title: "Already checked out today", status: 409 });
      return;
    }

    const [inserted] = await db.insert(qrAttendanceTable).values({
      companyId: staffRow.companyId ?? scannerRow.companyId,
      staffId: staffRow.id,
      staffName: staffRow.name,
      scannedById: scannerRow.id,
      scannedByName: scannerRow.name,
      type: "checkout",
      date,
      lat: lat ?? null,
      lng: lng ?? null,
      scannerSelfieUrl: null,
      occurredAt: new Date(),
    }).returning();

    res.status(201).json({
      id: inserted.id,
      staffName: staffRow.name,
      type: "checkout",
      date,
      occurredAt: inserted.occurredAt,
      scannedBy: scannerRow.name,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/admin/qr-attendance ────────────────────────────────────────────
// ?date=YYYY-MM-DD (defaults to today)

router.get("/admin/qr-attendance", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const date = (req.query.date as string | undefined) ?? todayIST();

    const conds = [eq(qrAttendanceTable.date, date)];
    if (companyId) conds.push(eq(qrAttendanceTable.companyId, companyId));

    const rows = await db
      .select()
      .from(qrAttendanceTable)
      .where(and(...(conds as [ReturnType<typeof eq>])))
      .orderBy(desc(qrAttendanceTable.occurredAt));

    res.json(rows);
  } catch (err) { next(err); }
});

// ─── GET /api/admin/staff/id-cards/pdf ───────────────────────────────────────
// Download PDF with QR ID cards for ground staff.
// ?staffIds=uuid1,uuid2,... or ?group=ground (all ground staff in company)

router.get("/admin/staff/id-cards/pdf", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const rawIds = (req.query.staffIds as string | undefined)?.trim();
    const group  = (req.query.group as string | undefined)?.trim();

    let staffRows: {
      id: string;
      name: string;
      empCode: string;
      centerStaffRole: string | null;
      centerName: string | null;
      companyId: string | null;
      staffCategoryGroup: string | null;
    }[];

    if (rawIds) {
      const ids = rawIds.split(",").map(s => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        res.status(400).json({ title: "No staffIds provided", status: 400 });
        return;
      }
      const { inArray } = await import("drizzle-orm");
      staffRows = await db
        .select({
          id: staffTable.id,
          name: staffTable.name,
          empCode: staffTable.empCode,
          centerStaffRole: staffTable.centerStaffRole,
          centerName: staffTable.centerName,
          companyId: staffTable.companyId,
          staffCategoryGroup: staffTable.staffCategoryGroup,
        })
        .from(staffTable)
        .where(
          companyId
            ? and(eq(staffTable.companyId, companyId), isNull(staffTable.deletedAt), inArray(staffTable.id, ids))
            : and(isNull(staffTable.deletedAt), inArray(staffTable.id, ids)),
        )
        .orderBy(staffTable.name);
    } else {
      // "ground" group maps to staffCategory='center' in this schema
      const conds = [isNull(staffTable.deletedAt)];
      if (companyId) conds.push(eq(staffTable.companyId, companyId));
      if (group === "ground") conds.push(eq(staffTable.staffCategory, "center"));

      staffRows = await db
        .select({
          id: staffTable.id,
          name: staffTable.name,
          empCode: staffTable.empCode,
          centerStaffRole: staffTable.centerStaffRole,
          centerName: staffTable.centerName,
          companyId: staffTable.companyId,
          staffCategoryGroup: staffTable.staffCategoryGroup,
        })
        .from(staffTable)
        .where(and(...(conds as [ReturnType<typeof eq>])))
        .orderBy(staffTable.name);
    }

    if (staffRows.length === 0) {
      res.status(404).json({ title: "No staff found", status: 404 });
      return;
    }

    // Fetch company name
    let companyName: string | null = null;
    if (companyId) {
      const [co] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
      companyName = co?.name ?? null;
    }

    const { generateIdCardsPdf } = await import("../services/qrIdCard");

    const idCardStaff = staffRows.map(s => ({
      staffId: s.id,
      name: s.name,
      empCode: s.empCode,
      role: s.centerStaffRole ?? null,
      centerName: s.centerName ?? null,
      companyName,
      photoBuffer: null as Buffer | null,
    }));

    const pdfBuf = await generateIdCardsPdf(idCardStaff);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ground-staff-id-cards.pdf"`,
      "Content-Length": String(pdfBuf.length),
    });
    res.end(pdfBuf);
  } catch (err) { next(err); }
});

export default router;
