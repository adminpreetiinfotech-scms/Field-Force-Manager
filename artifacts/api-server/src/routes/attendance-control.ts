/**
 * Attendance Control Routes
 *
 * GET  /api/admin/attendance-settings          — get shift timings + late rule
 * PATCH /api/admin/attendance-settings         — update shift timings + late rule
 * GET  /api/admin/attendance/corrections       — list corrections for a staff/date
 * POST /api/admin/attendance/correct           — submit a manual correction
 * GET  /api/admin/reports/monthly-attendance   — monthly attendance Excel report
 */

import {
  activityEventsTable,
  attendanceCorrectionsTable,
  companiesTable,
  db,
  holidaysTable,
  leavesTable,
  staffTable,
} from "@workspace/db";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import ExcelJS from "exceljs";
import { Router, type IRouter } from "express";
import { requireAdmin } from "./admin";

const router: IRouter = Router();

const PURPLE    = "FF4F46E5";
const PURPLE_DK = "FF3730A3";
const AMBER     = "FFF59E0B";
const WHITE     = "FFFFFFFF";
const LGRAY     = "FFF3F4F6";
const GREEN_BG  = "FFD1FAE5";
const RED_BG    = "FFFEE2E2";
const AMBER_BG  = "FFFEF3C7";

// ─── HH:MM validation helper ──────────────────────────────────────────────────

function isHHMM(v: unknown): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}

// ─── IST helpers ──────────────────────────────────────────────────────────────

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toISTDateStr(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function toISTTimeStr(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(11, 16);
}

// ─── GET /api/admin/attendance-settings ───────────────────────────────────────

router.get("/admin/attendance-settings", requireAdmin, async (_req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    if (!companyId) {
      res.json({
        fieldShiftStart: "09:00", fieldShiftEnd: "18:00",
        centerShiftStart: "09:00", centerShiftEnd: "18:00",
        lateGraceMinutes: 15,
      });
      return;
    }
    const [co] = await db
      .select({
        fieldShiftStart:  companiesTable.fieldShiftStart,
        fieldShiftEnd:    companiesTable.fieldShiftEnd,
        centerShiftStart: companiesTable.centerShiftStart,
        centerShiftEnd:   companiesTable.centerShiftEnd,
        lateGraceMinutes: companiesTable.lateGraceMinutes,
      })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    res.json({
      fieldShiftStart:  co?.fieldShiftStart  ?? "09:00",
      fieldShiftEnd:    co?.fieldShiftEnd    ?? "18:00",
      centerShiftStart: co?.centerShiftStart ?? "09:00",
      centerShiftEnd:   co?.centerShiftEnd   ?? "18:00",
      lateGraceMinutes: co?.lateGraceMinutes ?? 15,
    });
  } catch (err) { next(err); }
});

// ─── PATCH /api/admin/attendance-settings ─────────────────────────────────────

router.patch("/admin/attendance-settings", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    if (!companyId) {
      res.status(403).json({ title: "Super admin cannot set company settings here", status: 403 });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    if ("fieldShiftStart" in body) {
      if (!isHHMM(body.fieldShiftStart)) {
        res.status(400).json({ title: "fieldShiftStart must be HH:MM", status: 400 });
        return;
      }
      update.fieldShiftStart = body.fieldShiftStart;
    }
    if ("fieldShiftEnd" in body) {
      if (!isHHMM(body.fieldShiftEnd)) {
        res.status(400).json({ title: "fieldShiftEnd must be HH:MM", status: 400 });
        return;
      }
      update.fieldShiftEnd = body.fieldShiftEnd;
    }
    if ("centerShiftStart" in body) {
      if (!isHHMM(body.centerShiftStart)) {
        res.status(400).json({ title: "centerShiftStart must be HH:MM", status: 400 });
        return;
      }
      update.centerShiftStart = body.centerShiftStart;
    }
    if ("centerShiftEnd" in body) {
      if (!isHHMM(body.centerShiftEnd)) {
        res.status(400).json({ title: "centerShiftEnd must be HH:MM", status: 400 });
        return;
      }
      update.centerShiftEnd = body.centerShiftEnd;
    }
    if ("lateGraceMinutes" in body) {
      const g = Number(body.lateGraceMinutes);
      if (!Number.isInteger(g) || g < 0 || g > 120) {
        res.status(400).json({ title: "lateGraceMinutes must be 0–120", status: 400 });
        return;
      }
      update.lateGraceMinutes = g;
    }

    if (Object.keys(update).length === 0) {
      res.status(400).json({ title: "No valid fields to update", status: 400 });
      return;
    }

    await db.update(companiesTable).set(update).where(eq(companiesTable.id, companyId));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── GET /api/admin/attendance/corrections ────────────────────────────────────
// ?staffId=&date=YYYY-MM-DD

router.get("/admin/attendance/corrections", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { staffId, date } = req.query as { staffId?: string; date?: string };

    const conds = [];
    if (companyId) conds.push(eq(attendanceCorrectionsTable.companyId, companyId));
    if (staffId)   conds.push(eq(attendanceCorrectionsTable.staffId, staffId));
    if (date)      conds.push(eq(attendanceCorrectionsTable.date, date));

    const rows = await db
      .select()
      .from(attendanceCorrectionsTable)
      .where(conds.length ? and(...(conds as [ReturnType<typeof eq>])) : undefined)
      .orderBy(desc(attendanceCorrectionsTable.createdAt))
      .limit(200);

    res.json(rows);
  } catch (err) { next(err); }
});

// ─── POST /api/admin/attendance/correct ───────────────────────────────────────

router.post("/admin/attendance/correct", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const adminPhone = (req.headers["x-admin-phone"] as string | undefined)?.trim() ?? "";

    const body = req.body as Record<string, unknown>;
    const staffId          = typeof body.staffId === "string" ? body.staffId.trim() : "";
    const date             = typeof body.date    === "string" ? body.date.trim()    : "";
    const correctedCheckin  = typeof body.correctedCheckin  === "string" ? body.correctedCheckin.trim()  : null;
    const correctedCheckout = typeof body.correctedCheckout === "string" ? body.correctedCheckout.trim() : null;
    const reason           = typeof body.reason  === "string" ? body.reason.trim() : "";

    if (!staffId || !/^[0-9a-fA-F-]{36}$/.test(staffId)) {
      res.status(400).json({ title: "staffId (UUID) is required", status: 400 });
      return;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ title: "date must be YYYY-MM-DD", status: 400 });
      return;
    }
    if (!reason) {
      res.status(400).json({ title: "reason is required", status: 400 });
      return;
    }
    if (correctedCheckin  && !isHHMM(correctedCheckin)) {
      res.status(400).json({ title: "correctedCheckin must be HH:MM", status: 400 });
      return;
    }
    if (correctedCheckout && !isHHMM(correctedCheckout)) {
      res.status(400).json({ title: "correctedCheckout must be HH:MM", status: 400 });
      return;
    }

    // Verify staff belongs to this company
    const [staffRow] = await db
      .select({ id: staffTable.id, companyId: staffTable.companyId, name: staffTable.name })
      .from(staffTable)
      .where(eq(staffTable.id, staffId))
      .limit(1);

    if (!staffRow) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }
    if (companyId && staffRow.companyId !== companyId) {
      res.status(403).json({ title: "Access denied: staff not in your company", status: 403 });
      return;
    }

    // Look up admin's staff ID for correctedBy
    const [adminRow] = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(eq(staffTable.phone, adminPhone))
      .limit(1);

    // Fetch original checkin/checkout for audit trail
    const fromUtc = new Date(`${date}T00:00:00+05:30`);
    const toUtc   = new Date(`${date}T23:59:59+05:30`);

    const events = await db
      .select({ kind: activityEventsTable.kind, occurredAt: activityEventsTable.occurredAt })
      .from(activityEventsTable)
      .where(
        and(
          eq(activityEventsTable.staffId, staffId),
          inArray(activityEventsTable.kind, ["checkin", "checkout"]),
          gte(activityEventsTable.occurredAt, fromUtc),
          lte(activityEventsTable.occurredAt, toUtc),
        ),
      )
      .orderBy(activityEventsTable.occurredAt);

    let originalCheckin: string | null = null;
    let originalCheckout: string | null = null;
    for (const ev of events) {
      if (ev.kind === "checkin" && !originalCheckin)  originalCheckin  = toISTTimeStr(ev.occurredAt as Date);
      if (ev.kind === "checkout") originalCheckout = toISTTimeStr(ev.occurredAt as Date);
    }

    const targetCompanyId = companyId ?? staffRow.companyId ?? "";
    if (!targetCompanyId) {
      res.status(400).json({ title: "Cannot determine company", status: 400 });
      return;
    }

    const [inserted] = await db
      .insert(attendanceCorrectionsTable)
      .values({
        companyId: targetCompanyId,
        staffId,
        date,
        originalCheckin,
        originalCheckout,
        correctedCheckin:  correctedCheckin  || null,
        correctedCheckout: correctedCheckout || null,
        reason,
        correctedBy: adminRow?.id ?? null,
      })
      .returning();

    res.status(201).json(inserted);
  } catch (err) { next(err); }
});

// ─── GET /api/admin/reports/monthly-attendance ────────────────────────────────
// ?year=YYYY&month=M  → JSON array (or ?format=xlsx for Excel download)

type MonthlyAttRow = {
  staffId: string;
  staffName: string;
  empCode: string | null;
  phone: string | null;
  staffCategory: string | null;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  avgCheckin: string | null;
  avgCheckout: string | null;
  totalGpsKm: number;
  casualUsed: number;
  sickUsed: number;
  casualBalance: number;
  sickBalance: number;
};

async function buildMonthlyAttReport(
  companyId: string | null,
  year: number,
  month: number,
  shiftStart: string,
  centerShiftStart: string,
  graceMinutes: number,
): Promise<MonthlyAttRow[]> {

  const staffFilter = companyId
    ? and(
        eq(staffTable.companyId, companyId),
        eq(staffTable.role, "staff"),
        isNull(staffTable.deletedAt),
      )
    : and(eq(staffTable.role, "staff"), isNull(staffTable.deletedAt));

  const allStaff = await db
    .select({
      id: staffTable.id,
      name: staffTable.name,
      empCode: staffTable.empCode,
      phone: staffTable.phone,
      staffCategory: staffTable.staffCategory,
    })
    .from(staffTable)
    .where(staffFilter);

  if (allStaff.length === 0) return [];

  const staffIds = allStaff.map((s) => s.id);

  // Month date range in IST
  const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`);
  const nextMonth  = month === 12
    ? new Date(`${year + 1}-01-01T00:00:00+05:30`)
    : new Date(`${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00+05:30`);

  // Working days in the month (exclude Sundays; company holidays handled later)
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  // Fetch all activity events for the month for these staff
  const events = await db
    .select({
      staffId:    activityEventsTable.staffId,
      kind:       activityEventsTable.kind,
      occurredAt: activityEventsTable.occurredAt,
      payload:    activityEventsTable.payload,
    })
    .from(activityEventsTable)
    .where(
      and(
        inArray(activityEventsTable.staffId, staffIds),
        inArray(activityEventsTable.kind, ["checkin", "checkout", "trip-end"]),
        gte(activityEventsTable.occurredAt, monthStart),
        lt(activityEventsTable.occurredAt, nextMonth),
      ),
    )
    .orderBy(activityEventsTable.occurredAt);

  // Fetch approved leaves in this month
  const approvedLeaves = await db
    .select({
      staffId:   leavesTable.staffId,
      startDate: leavesTable.startDate,
      endDate:   leavesTable.endDate,
      leaveType: leavesTable.leaveType,
    })
    .from(leavesTable)
    .where(
      and(
        inArray(leavesTable.staffId, staffIds),
        eq(leavesTable.status, "approved"),
        lte(leavesTable.startDate, `${year}-${String(month).padStart(2, "0")}-${String(totalDaysInMonth).padStart(2, "0")}`),
        gte(leavesTable.endDate,   `${year}-${String(month).padStart(2, "0")}-01`),
      ),
    );

  // Fetch leave balance (full year) — casual + sick used
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;
  const yearLeaves = await db
    .select({
      staffId:   leavesTable.staffId,
      leaveType: leavesTable.leaveType,
      startDate: leavesTable.startDate,
      endDate:   leavesTable.endDate,
    })
    .from(leavesTable)
    .where(
      and(
        inArray(leavesTable.staffId, staffIds),
        eq(leavesTable.status, "approved"),
        gte(leavesTable.startDate, yearStart),
        lte(leavesTable.endDate, yearEnd),
      ),
    );

  // Build per-staff leave days used (year)
  function countDays(start: string, end: string): number {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.round((e - s) / 86400000) + 1;
  }

  const yearLeaveMap = new Map<string, { casual: number; sick: number }>();
  for (const lv of yearLeaves) {
    const cur = yearLeaveMap.get(lv.staffId) ?? { casual: 0, sick: 0 };
    const days = countDays(lv.startDate, lv.endDate);
    if (lv.leaveType === "casual") cur.casual += days;
    if (lv.leaveType === "sick")   cur.sick   += days;
    yearLeaveMap.set(lv.staffId, cur);
  }

  // Build leave day set per staff (days off this month)
  const leaveDayMap = new Map<string, Set<string>>();
  for (const lv of approvedLeaves) {
    const set = leaveDayMap.get(lv.staffId) ?? new Set<string>();
    let cur = new Date(lv.startDate);
    const end = new Date(lv.endDate);
    while (cur <= end) {
      const d = cur.toISOString().slice(0, 10);
      if (d >= `${year}-${String(month).padStart(2, "0")}-01`) {
        set.add(d);
      }
      cur = new Date(cur.getTime() + 86400000);
    }
    leaveDayMap.set(lv.staffId, set);
  }

  // Group events by staff
  type DayAcc = {
    checkinTime: Date | null;
    checkoutTime: Date | null;
    gpsKm: number;
  };
  const staffDayMap = new Map<string, Map<string, DayAcc>>();

  for (const ev of events) {
    const date = toISTDateStr(ev.occurredAt as Date);
    let dayMap = staffDayMap.get(ev.staffId);
    if (!dayMap) { dayMap = new Map(); staffDayMap.set(ev.staffId, dayMap); }
    let acc = dayMap.get(date);
    if (!acc) { acc = { checkinTime: null, checkoutTime: null, gpsKm: 0 }; dayMap.set(date, acc); }

    if (ev.kind === "checkin" && !acc.checkinTime) acc.checkinTime = ev.occurredAt as Date;
    if (ev.kind === "checkout") acc.checkoutTime = ev.occurredAt as Date;
    if (ev.kind === "trip-end") {
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      if (typeof p.distanceKm === "number") acc.gpsKm += p.distanceKm;
    }
  }

  // Parse HH:MM to minutes
  function hhmToMin(hh: string): number {
    const [h, m] = hh.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }

  const fieldShiftMin  = hhmToMin(shiftStart);
  const centerShiftMin = hhmToMin(centerShiftStart);

  return allStaff.map((s) => {
    const dayMap   = staffDayMap.get(s.id) ?? new Map<string, DayAcc>();
    const leaveSet = leaveDayMap.get(s.id) ?? new Set<string>();
    const shiftMin = s.staffCategory === "center" ? centerShiftMin : fieldShiftMin;
    const lateThresholdMin = shiftMin + graceMinutes;

    let presentDays = 0;
    let lateDays    = 0;
    let leaveDays   = leaveSet.size;
    let totalCheckinMin  = 0;
    let totalCheckoutMin = 0;
    let checkinCount  = 0;
    let checkoutCount = 0;
    let totalGpsKm    = 0;

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const acc     = dayMap.get(dateStr);
      if (!acc) continue;
      if (acc.checkinTime) {
        presentDays++;
        // Checkin minute in IST
        const istCheckin = new Date(acc.checkinTime.getTime() + IST_OFFSET_MS);
        const checkinMin = istCheckin.getHours() * 60 + istCheckin.getMinutes();
        if (checkinMin > lateThresholdMin) lateDays++;
        totalCheckinMin += checkinMin;
        checkinCount++;
      }
      if (acc.checkoutTime) {
        const istCheckout = new Date(acc.checkoutTime.getTime() + IST_OFFSET_MS);
        const checkoutMin = istCheckout.getHours() * 60 + istCheckout.getMinutes();
        totalCheckoutMin += checkoutMin;
        checkoutCount++;
      }
      totalGpsKm += acc.gpsKm;
    }

    const absentDays = totalDaysInMonth - presentDays - leaveDays;

    function minToHHMM(m: number): string {
      const h = Math.floor(m / 60);
      const mn = Math.round(m % 60);
      return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
    }

    const avgCheckin  = checkinCount  > 0 ? minToHHMM(totalCheckinMin  / checkinCount)  : null;
    const avgCheckout = checkoutCount > 0 ? minToHHMM(totalCheckoutMin / checkoutCount) : null;

    const usedLeaves = yearLeaveMap.get(s.id) ?? { casual: 0, sick: 0 };

    return {
      staffId:        s.id,
      staffName:      s.name,
      empCode:        s.empCode,
      phone:          s.phone,
      staffCategory:  s.staffCategory,
      presentDays,
      lateDays,
      absentDays:     Math.max(0, absentDays),
      leaveDays,
      avgCheckin,
      avgCheckout,
      totalGpsKm:     Math.round(totalGpsKm * 10) / 10,
      casualUsed:     usedLeaves.casual,
      sickUsed:       usedLeaves.sick,
      casualBalance:  Math.max(0, 12 - usedLeaves.casual),
      sickBalance:    Math.max(0, 6  - usedLeaves.sick),
    };
  });
}

// ─── GET /api/admin/reports/monthly-attendance (JSON) ─────────────────────────

router.get("/admin/reports/monthly-attendance", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { year: rawYear, month: rawMonth } = req.query as { year?: string; month?: string };

    const now = new Date(Date.now() + IST_OFFSET_MS);
    const year  = rawYear  ? parseInt(rawYear,  10) : now.getFullYear();
    const month = rawMonth ? parseInt(rawMonth, 10) : now.getMonth() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ title: "year and month (1–12) are required", status: 400 });
      return;
    }

    let fieldShiftStart = "09:00";
    let centerShiftStart = "09:00";
    let lateGraceMinutes = 15;

    if (companyId) {
      const [co] = await db
        .select({ fieldShiftStart: companiesTable.fieldShiftStart, centerShiftStart: companiesTable.centerShiftStart, lateGraceMinutes: companiesTable.lateGraceMinutes })
        .from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
      if (co) {
        fieldShiftStart  = co.fieldShiftStart  ?? "09:00";
        centerShiftStart = co.centerShiftStart ?? "09:00";
        lateGraceMinutes = co.lateGraceMinutes ?? 15;
      }
    }

    const rows = await buildMonthlyAttReport(companyId, year, month, fieldShiftStart, centerShiftStart, lateGraceMinutes);
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── GET /api/admin/reports/monthly-attendance/xlsx ───────────────────────────

router.get("/admin/reports/monthly-attendance/xlsx", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { year: rawYear, month: rawMonth } = req.query as { year?: string; month?: string };

    const now = new Date(Date.now() + IST_OFFSET_MS);
    const year  = rawYear  ? parseInt(rawYear,  10) : now.getFullYear();
    const month = rawMonth ? parseInt(rawMonth, 10) : now.getMonth() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ title: "year and month (1–12) are required", status: 400 });
      return;
    }

    let fieldShiftStart  = "09:00";
    let centerShiftStart = "09:00";
    let lateGraceMinutes = 15;
    let organization: string | null = null;

    if (companyId) {
      const [co] = await db
        .select({
          name:             companiesTable.name,
          projectName:      companiesTable.projectName,
          fieldShiftStart:  companiesTable.fieldShiftStart,
          centerShiftStart: companiesTable.centerShiftStart,
          lateGraceMinutes: companiesTable.lateGraceMinutes,
        })
        .from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
      if (co) {
        fieldShiftStart  = co.fieldShiftStart  ?? "09:00";
        centerShiftStart = co.centerShiftStart ?? "09:00";
        lateGraceMinutes = co.lateGraceMinutes ?? 15;
        organization = co.projectName ? `${co.name} — ${co.projectName}` : co.name;
      }
    }

    const rows = await buildMonthlyAttReport(companyId, year, month, fieldShiftStart, centerShiftStart, lateGraceMinutes);

    const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

    const COLS = 16;
    const wb = new ExcelJS.Workbook();
    wb.creator = "SCMS"; wb.modified = new Date();
    const ws = wb.addWorksheet("Monthly Attendance", { properties: { tabColor: { argb: PURPLE } } });

    ws.columns = [
      { width: 5 },  { width: 22 }, { width: 12 }, { width: 14 }, { width: 10 },
      { width: 8 },  { width: 8 },  { width: 8 },  { width: 8 },
      { width: 11 }, { width: 11 }, { width: 10 },
      { width: 8 },  { width: 8 },  { width: 8 },  { width: 8 },
    ];

    // Row 1 — organization header
    ws.mergeCells(1, 1, 1, COLS);
    const r1 = ws.getCell(1, 1);
    r1.value = organization ?? "Monthly Attendance Report";
    r1.font = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
    r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
    r1.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 26;

    // Row 2 — report title
    ws.mergeCells(2, 1, 2, COLS);
    const r2 = ws.getCell(2, 1);
    r2.value = `MONTHLY ATTENDANCE REPORT — ${monthLabel.toUpperCase()}`;
    r2.font = { bold: true, size: 14, color: { argb: AMBER }, name: "Calibri" };
    r2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
    r2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 28;

    // Row 3 — sub-header: shift info
    ws.mergeCells(3, 1, 3, COLS);
    const r3 = ws.getCell(3, 1);
    r3.value = `Field Shift: ${fieldShiftStart} | Center Shift: ${centerShiftStart} | Late after: ${lateGraceMinutes} min grace`;
    r3.font = { italic: true, size: 10, color: { argb: AMBER }, name: "Calibri" };
    r3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
    r3.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(3).height = 18;

    // Row 4 — column headers
    const headers = [
      "S.No", "Staff Name", "Emp Code", "Mobile", "Type",
      "Present", "Late", "Absent", "Leave",
      "Avg Check-In", "Avg Check-Out", "GPS KM (Total)",
      "Casual Used", "Casual Bal", "Sick Used", "Sick Bal",
    ];
    ws.getRow(4).values = headers;
    ws.getRow(4).height = 28;
    ws.getRow(4).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE_DK } };
      cell.font = { color: { argb: WHITE }, bold: true, size: 10, name: "Calibri" };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    const altFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };

    rows.forEach((r, idx) => {
      const dataRow = ws.addRow([
        idx + 1,
        r.staffName,
        r.empCode ?? "",
        r.phone ?? "",
        r.staffCategory === "center" ? "Center" : "Field",
        r.presentDays,
        r.lateDays,
        r.absentDays,
        r.leaveDays,
        r.avgCheckin  ?? "",
        r.avgCheckout ?? "",
        r.totalGpsKm,
        r.casualUsed,
        r.casualBalance,
        r.sickUsed,
        r.sickBalance,
      ]);
      dataRow.height = 20;
      dataRow.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "hair" }, right: { style: "hair" } };
        if (idx % 2 === 1) cell.fill = altFill;
      });

      // Color: present green, absent red, late amber
      const presentCell = dataRow.getCell(6);
      presentCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: r.presentDays > 0 ? GREEN_BG : RED_BG } };

      if (r.lateDays > 0) {
        const lateCell = dataRow.getCell(7);
        lateCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_BG } };
        lateCell.font = { bold: true, color: { argb: "FFB45309" }, name: "Calibri" };
      }

      if (r.absentDays > 0) {
        const absentCell = dataRow.getCell(8);
        absentCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } };
        absentCell.font = { bold: true, color: { argb: "FFB91C1C" }, name: "Calibri" };
      }
    });

    ws.autoFilter = { from: "A4", to: { row: 4, column: COLS } };

    const fname = `monthly-attendance-${year}-${String(month).padStart(2, "0")}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await wb.xlsx.write(res);
  } catch (err) { next(err); }
});

export default router;
