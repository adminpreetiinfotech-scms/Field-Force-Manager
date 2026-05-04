import cron from "node-cron";
import ExcelJS from "exceljs";
import {
  activityEventsTable,
  companiesTable,
  db,
  reportSchedulesTable,
  staffTable,
} from "@workspace/db";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { sendEmailWithAttachments } from "../lib/email";
import { logger } from "../lib/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY  = "FF1A3560";
const AMBER = "FFF59E0B";
const WHITE = "FFFFFFFF";
const LGRAY = "FFF3F4F6";
const DKGRAY = "FF374151";
const TEAL   = "FF0F766E";
const TEAL_DK = "FF0D9488";

export type ReportType = "attendance" | "rideReport" | "vehicleKm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIST(d: Date): string {
  const offset = 5.5 * 60 * 60 * 1000;
  const local = new Date(d.getTime() + offset);
  return local.toISOString().slice(0, 10);
}

function toISTTime(d: Date): string {
  const offset = 5.5 * 60 * 60 * 1000;
  const local  = new Date(d.getTime() + offset);
  return local.toISOString().slice(11, 16);
}

type ActivityPayload = {
  distanceKm?: number | null;
  origin?: { latitude: number; longitude: number } | null;
  destination?: { latitude: number; longitude: number } | null;
  startOdometerKm?: number | null;
  endOdometerKm?: number | null;
  vehicleMeterPhotoUri?: string | null;
};

// ─── Build attendance summary Excel buffer ────────────────────────────────────

export async function buildAttendanceSummaryXlsx(opts: {
  companyId: string | null;
  organization: string | null;
  from: string;
  to: string;
}): Promise<{ buffer: Buffer; filename: string }> {
  const { companyId, from, to } = opts;

  const startOfFrom = new Date(`${from}T00:00:00.000Z`);
  const endOfTo     = new Date(`${to}T23:59:59.999Z`);

  const conds = [
    eq(activityEventsTable.kind, "checkin"),
    gte(activityEventsTable.occurredAt, startOfFrom),
    lt(activityEventsTable.occurredAt, new Date(endOfTo.getTime() + 1)),
  ] as ReturnType<typeof eq>[];
  if (companyId) conds.push(eq(activityEventsTable.companyId, companyId));

  const checkinRows = await db
    .select({
      staffId:    activityEventsTable.staffId,
      staffName:  activityEventsTable.staffName,
      occurredAt: activityEventsTable.occurredAt,
    })
    .from(activityEventsTable)
    .where(and(...conds))
    .orderBy(activityEventsTable.occurredAt);

  type StaffSummary = { staffId: string; staffName: string; days: Set<string> };
  const staffMap = new Map<string, StaffSummary>();
  for (const row of checkinRows) {
    const date = toIST(new Date(row.occurredAt as Date));
    const existing = staffMap.get(row.staffId) ?? { staffId: row.staffId, staffName: row.staffName, days: new Set() };
    existing.days.add(date);
    staffMap.set(row.staffId, existing);
  }

  const staffIds = [...staffMap.keys()];
  const staffDetails = staffIds.length
    ? await db
        .select({ id: staffTable.id, empCode: staffTable.empCode })
        .from(staffTable)
        .where(inArray(staffTable.id, staffIds))
    : [];
  const empCodeMap = new Map(staffDetails.map(s => [s.id, s.empCode ?? ""]));

  const staffBreakdown = [...staffMap.values()]
    .map(s => ({
      staffName:   s.staffName,
      empCode:     empCodeMap.get(s.staffId) ?? "",
      checkInDays: s.days.size,
    }))
    .sort((a, b) => b.checkInDays - a.checkInDays || a.staffName.localeCompare(b.staffName));

  const totalCheckInDays = staffBreakdown.reduce((sum, s) => sum + s.checkInDays, 0);
  const uniqueStaff      = staffBreakdown.length;
  const avgDaysPerStaff  = uniqueStaff > 0 ? Math.round((totalCheckInDays / uniqueStaff) * 10) / 10 : 0;

  const wb = new ExcelJS.Workbook();
  wb.creator = "JSDMS Field Force Manager";
  wb.created = new Date();

  const A_COLS = 3;
  const ws = wb.addWorksheet("Attendance Summary", { properties: { tabColor: { argb: TEAL } } });
  ws.columns = [
    { width: 28 },
    { width: 14 },
    { width: 18 },
  ];

  const orgLine = opts.organization ?? "Jharkhand Skill Development Mission Society (JSDMS) / DDU-KK";

  const mergeHeader = (rowNum: number, text: string, fgArgb: string, textArgb: string, sz = 13) => {
    ws.mergeCells(rowNum, 1, rowNum, A_COLS);
    const cell = ws.getCell(rowNum, 1);
    cell.value = text;
    cell.font  = { bold: true, size: sz, color: { argb: textArgb }, name: "Calibri" };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: fgArgb } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(rowNum).height = sz >= 13 ? 26 : 18;
  };

  mergeHeader(1, orgLine, TEAL, WHITE, 13);
  mergeHeader(2, "STAFF-WISE ATTENDANCE SUMMARY", TEAL, AMBER, 14);
  mergeHeader(3, `Period: ${from}  →  ${to}   |   ${uniqueStaff} staff   |   ${totalCheckInDays} total check-in days`, TEAL_DK, WHITE, 10);

  ws.getRow(4).height = 8;
  const summaryItems = [
    ["Unique Staff", String(uniqueStaff)],
    ["Total Check-In Days", String(totalCheckInDays)],
    ["Avg Days / Staff", String(avgDaysPerStaff)],
  ];
  for (let i = 0; i < summaryItems.length; i++) {
    const rowNum = 5 + i;
    ws.getRow(rowNum).height = 18;
    const [label, value] = summaryItems[i]!;
    ws.getCell(rowNum, 1).value = label;
    ws.getCell(rowNum, 1).font  = { bold: true, size: 10, color: { argb: DKGRAY } };
    ws.getCell(rowNum, 1).fill  = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
    ws.getCell(rowNum, 1).alignment = { horizontal: "right" };
    ws.getCell(rowNum, 2).value = value;
    ws.getCell(rowNum, 2).font  = { bold: true, size: 11, color: { argb: TEAL } };
    ws.getCell(rowNum, 2).alignment = { horizontal: "left" };
  }

  ws.getRow(8).height = 8;

  const HDRS = ["Staff Name", "EMP ID", "Check-In Days"];
  const hRow = ws.getRow(9);
  hRow.height = 28;
  HDRS.forEach((h, ci) => {
    const cell = hRow.getCell(ci + 1);
    cell.value = h;
    cell.font  = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: AMBER } } };
  });

  const altFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
  let dataRowNum = 10;
  for (const [idx, s] of staffBreakdown.entries()) {
    const dr = ws.getRow(dataRowNum);
    dr.height = 16;
    const isAlt = idx % 2 === 1;
    [s.staffName, s.empCode, s.checkInDays].forEach((val, ci) => {
      const cell = dr.getCell(ci + 1);
      cell.value = val;
      cell.font  = { size: 9, name: "Calibri", color: { argb: "FF111827" } };
      cell.alignment = { horizontal: ci === 2 ? "center" : "left", vertical: "middle" };
      if (isAlt) cell.fill = altFill;
      cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
    });
    dataRowNum++;
  }

  const ftRow = ws.getRow(dataRowNum);
  ftRow.height = 18;
  const ftLabel = ftRow.getCell(1);
  ftLabel.value = `TOTAL  (${uniqueStaff} staff,  avg ${avgDaysPerStaff} days/staff)`;
  ftLabel.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
  ftLabel.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
  ftLabel.alignment = { horizontal: "left", vertical: "middle" };
  ftRow.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
  const ftDays = ftRow.getCell(3);
  ftDays.value = totalCheckInDays;
  ftDays.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
  ftDays.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
  ftDays.alignment = { horizontal: "center", vertical: "middle" };

  const buf = await wb.xlsx.writeBuffer() as unknown as Buffer;
  const filename = `attendance-summary-${from}-to-${to}.xlsx`;
  return { buffer: buf, filename };
}

// ─── Shared data fetch for ride report + vehicle KM ──────────────────────────

async function fetchRideData(opts: {
  companyId: string | null;
  from: string;
  to: string;
}) {
  const { companyId, from, to } = opts;
  const startOfFrom = new Date(`${from}T00:00:00.000Z`);
  const endOfTo     = new Date(`${to}T23:59:59.999Z`);

  const tripConds = [
    inArray(activityEventsTable.kind, ["trip-start", "trip-end"]),
    gte(activityEventsTable.occurredAt, startOfFrom),
    lt(activityEventsTable.occurredAt, new Date(endOfTo.getTime() + 1)),
  ] as ReturnType<typeof eq>[];
  if (companyId) tripConds.push(eq(activityEventsTable.companyId, companyId));

  const tripRows = await db
    .select()
    .from(activityEventsTable)
    .where(and(...tripConds))
    .orderBy(activityEventsTable.occurredAt);

  const byRef = new Map<string, { start: typeof tripRows[0] | null; end: typeof tripRows[0] | null }>();
  for (const row of tripRows) {
    if (!row.tripRef) continue;
    let acc = byRef.get(row.tripRef);
    if (!acc) { acc = { start: null, end: null }; byRef.set(row.tripRef, acc); }
    if (row.kind === "trip-start") acc.start = row;
    if (row.kind === "trip-end")   acc.end   = row;
  }
  const completed = Array.from(byRef.values()).filter(v => v.start && v.end) as
    Array<{ start: typeof tripRows[0]; end: typeof tripRows[0] }>;

  const uniqueIds = [...new Set(completed.map(t => t.start.staffId))];
  const staffRows = uniqueIds.length
    ? await db
        .select({ id: staffTable.id, empCode: staffTable.empCode, phone: staffTable.phone, name: staffTable.name })
        .from(staffTable)
        .where(inArray(staffTable.id, uniqueIds))
    : [];
  const staffMap = new Map(staffRows.map(s => [s.id, s]));

  const attendConds = [
    inArray(activityEventsTable.kind, ["checkin", "checkout"]),
    gte(activityEventsTable.occurredAt, startOfFrom),
    lt(activityEventsTable.occurredAt, new Date(endOfTo.getTime() + 1)),
  ] as ReturnType<typeof eq>[];
  if (companyId) attendConds.push(eq(activityEventsTable.companyId, companyId));

  const attendRows = await db
    .select()
    .from(activityEventsTable)
    .where(and(...attendConds))
    .orderBy(activityEventsTable.occurredAt);

  type OdometerDay = {
    startOdometerKm: number | null;
    endOdometerKm: number | null;
    checkinPhotoUri: string | null;
    checkoutPhotoUri: string | null;
  };
  const odometerMap = new Map<string, OdometerDay>();
  for (const row of attendRows) {
    const key = `${row.staffId}::${toIST(new Date(row.occurredAt as Date))}`;
    const payload = (row.payload || {}) as ActivityPayload;
    const existing = odometerMap.get(key) ?? { startOdometerKm: null, endOdometerKm: null, checkinPhotoUri: null, checkoutPhotoUri: null };
    if (row.kind === "checkin") {
      if (payload.startOdometerKm != null) existing.startOdometerKm = payload.startOdometerKm;
      if (payload.vehicleMeterPhotoUri) existing.checkinPhotoUri = payload.vehicleMeterPhotoUri;
    }
    if (row.kind === "checkout") {
      if (payload.endOdometerKm != null) existing.endOdometerKm = payload.endOdometerKm;
      if (payload.vehicleMeterPhotoUri) existing.checkoutPhotoUri = payload.vehicleMeterPhotoUri;
    }
    odometerMap.set(key, existing);
  }

  const attendStaffIds = [...new Set(attendRows.map(r => r.staffId))].filter(id => !staffMap.has(id));
  if (attendStaffIds.length > 0) {
    const extraStaff = await db
      .select({ id: staffTable.id, empCode: staffTable.empCode, phone: staffTable.phone, name: staffTable.name })
      .from(staffTable)
      .where(inArray(staffTable.id, attendStaffIds));
    for (const s of extraStaff) staffMap.set(s.id, s);
  }

  return { completed, staffMap, odometerMap, from, to };
}

// ─── Build ride report Excel buffer ──────────────────────────────────────────

export async function buildRideReportXlsx(opts: {
  companyId: string | null;
  organization: string | null;
  from: string;
  to: string;
}): Promise<{ buffer: Buffer; filename: string }> {
  const { completed, staffMap, odometerMap, from, to } = await fetchRideData(opts);
  const organization = opts.organization;

  type ReportRow = {
    staffName: string; empCode: string; mobile: string; date: string;
    startOdometer: number | null; endOdometer: number | null;
    vehicleKm: number | null; gpsKm: number | null; variancePct: number | null;
    startTime: string; endTime: string;
    checkinPhotoUrl: string | null; checkoutPhotoUrl: string | null;
  };

  const rows: ReportRow[] = [];
  for (const { start, end } of completed) {
    const endPayload = (end.payload || {}) as ActivityPayload;
    const staff = staffMap.get(start.staffId);
    const startAt = new Date(start.occurredAt as Date);
    const endAt   = new Date(end.occurredAt   as Date);
    const gpsKm   = typeof endPayload.distanceKm === "number" ? Math.round(endPayload.distanceKm * 10) / 10 : null;
    const dateKey = `${start.staffId}::${toIST(startAt)}`;
    const odo = odometerMap.get(dateKey) ?? { startOdometerKm: null, endOdometerKm: null, checkinPhotoUri: null, checkoutPhotoUri: null };
    const startOdometer = odo.startOdometerKm;
    const endOdometer   = odo.endOdometerKm;
    let vehicleKm: number | null = null;
    if (startOdometer != null && endOdometer != null && endOdometer >= startOdometer) {
      vehicleKm = Math.round((endOdometer - startOdometer) * 10) / 10;
    }
    let variancePct: number | null = null;
    if (vehicleKm != null && gpsKm != null && vehicleKm > 0) {
      variancePct = Math.round(Math.abs(vehicleKm - gpsKm) / vehicleKm * 100 * 10) / 10;
    }
    rows.push({
      staffName: start.staffName, empCode: staff?.empCode ?? "", mobile: staff?.phone ?? "",
      date: toIST(startAt), startOdometer, endOdometer, vehicleKm, gpsKm, variancePct,
      startTime: toISTTime(startAt), endTime: toISTTime(endAt),
      checkinPhotoUrl: odo.checkinPhotoUri ?? null, checkoutPhotoUrl: odo.checkoutPhotoUri ?? null,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));

  const totalStaff = new Set(rows.map(r => r.empCode || r.staffName)).size;
  const totalRides = rows.length;
  const totalKmAll = rows.reduce((s, r) => s + (r.gpsKm ?? 0), 0);

  const staffTotals = new Map<string, { empCode: string; mobile: string; km: number; rides: number }>();
  for (const r of rows) {
    const prev = staffTotals.get(r.staffName) ?? { empCode: r.empCode, mobile: r.mobile, km: 0, rides: 0 };
    staffTotals.set(r.staffName, { ...prev, km: prev.km + (r.gpsKm ?? 0), rides: prev.rides + 1 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "JSDMS Field Force Manager";
  wb.created = new Date();

  const COL_COUNT = 14;
  const ws = wb.addWorksheet("Ride Report", { properties: { tabColor: { argb: NAVY } } });
  ws.columns = [
    { width: 22 }, { width: 13 }, { width: 14 }, { width: 12 },
    { width: 16 }, { width: 16 }, { width: 12 }, { width: 10 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 28 }, { width: 20 }, { width: 20 },
  ];

  const orgLine = organization ?? "Jharkhand Skill Development Mission Society (JSDMS) / DDU-KK";

  function mergeHdr(row: number, text: string, fgArgb: string, textArgb: string, sz = 13) {
    ws.mergeCells(row, 1, row, COL_COUNT);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.font  = { bold: true, size: sz, color: { argb: textArgb }, name: "Calibri" };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: fgArgb } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(row).height = sz === 13 ? 26 : 20;
  }

  mergeHdr(1, orgLine, NAVY, WHITE, 13);
  mergeHdr(2, "STAFF RIDE READING REPORT", NAVY, AMBER, 14);
  mergeHdr(3, `Report: ${from}  →  ${to}   |   ${totalStaff} staff   |   ${totalRides} rides`, "FF1E3A5F", WHITE, 10);

  const summaryData = [
    ["Total Staff", totalStaff, "Total Rides", totalRides],
    ["Total KM", `${totalKmAll.toFixed(1)} km`, "Generated On", new Date().toLocaleDateString("en-IN")],
  ];
  for (let i = 0; i < summaryData.length; i++) {
    const rowNum = 5 + i;
    ws.getRow(rowNum).height = 18;
    const [l1, v1, l2, v2] = summaryData[i]!;
    ws.mergeCells(rowNum, 1, rowNum, 2); const lc1 = ws.getCell(rowNum, 1);
    lc1.value = l1; lc1.font = { bold: true, size: 10, color: { argb: DKGRAY } };
    lc1.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } }; lc1.alignment = { horizontal: "right" };
    ws.mergeCells(rowNum, 3, rowNum, 4); const vc1 = ws.getCell(rowNum, 3);
    vc1.value = v1; vc1.font = { bold: true, size: 11, color: { argb: NAVY } }; vc1.alignment = { horizontal: "left" };
    ws.mergeCells(rowNum, 5, rowNum, 6); const lc2 = ws.getCell(rowNum, 5);
    lc2.value = l2; lc2.font = { bold: true, size: 10, color: { argb: DKGRAY } };
    lc2.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } }; lc2.alignment = { horizontal: "right" };
    ws.mergeCells(rowNum, 7, rowNum, 8); const vc2 = ws.getCell(rowNum, 7);
    vc2.value = v2; vc2.font = { bold: true, size: 11, color: { argb: NAVY } }; vc2.alignment = { horizontal: "left" };
  }
  ws.getRow(7).height = 8;

  const HEADERS = [
    "Staff Name", "EMP ID", "Mobile No.", "Date",
    "Start Odometer\n(km)", "End Odometer\n(km)", "Vehicle KM", "GPS KM", "Variance %",
    "Ride Start\nTime", "Ride End\nTime",
    "Report Type", "Check-In\nOdo Photo", "Check-Out\nOdo Photo",
  ];
  const hRow = ws.getRow(8);
  hRow.height = 32;
  HEADERS.forEach((h, ci) => {
    const cell = hRow.getCell(ci + 1);
    cell.value = h; cell.font = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: AMBER } } };
  });

  const altFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
  let dataRowNum = 9;
  for (const [idx, r] of rows.entries()) {
    const dr = ws.getRow(dataRowNum);
    dr.height = 16;
    const isAlt = idx % 2 === 1;
    const highVariance = r.variancePct !== null && r.variancePct > 20;
    const varFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } };
    const cells = [
      r.staffName, r.empCode, r.mobile, r.date,
      r.startOdometer ?? "", r.endOdometer ?? "",
      r.vehicleKm !== null ? r.vehicleKm : "",
      r.gpsKm     !== null ? r.gpsKm : "",
      r.variancePct !== null ? `${r.variancePct}%` : "",
      r.startTime, r.endTime, "Scheduled",
    ];
    cells.forEach((val, ci) => {
      const cell = dr.getCell(ci + 1);
      cell.value = val;
      cell.font  = { size: 9, name: "Calibri", color: { argb: highVariance && ci === 8 ? "FFB45309" : "FF111827" } };
      cell.alignment = { horizontal: ci >= 4 && ci <= 8 ? "center" : "left", vertical: "middle" };
      if (highVariance) cell.fill = varFill;
      else if (isAlt) cell.fill = altFill;
      cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
    });
    const ciCell = dr.getCell(13);
    if (r.checkinPhotoUrl) {
      ciCell.value = { text: "View Photo", hyperlink: r.checkinPhotoUrl };
      ciCell.font  = { size: 9, name: "Calibri", color: { argb: "FF1A3560" }, underline: true };
    } else { ciCell.value = "—"; ciCell.font = { size: 9, name: "Calibri", color: { argb: "FF9CA3AF" } }; }
    ciCell.alignment = { horizontal: "center", vertical: "middle" };
    if (highVariance) ciCell.fill = varFill; else if (isAlt) ciCell.fill = altFill;
    ciCell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
    const coCell = dr.getCell(14);
    if (r.checkoutPhotoUrl) {
      coCell.value = { text: "View Photo", hyperlink: r.checkoutPhotoUrl };
      coCell.font  = { size: 9, name: "Calibri", color: { argb: "FF1A3560" }, underline: true };
    } else { coCell.value = "—"; coCell.font = { size: 9, name: "Calibri", color: { argb: "FF9CA3AF" } }; }
    coCell.alignment = { horizontal: "center", vertical: "middle" };
    if (highVariance) coCell.fill = varFill; else if (isAlt) coCell.fill = altFill;
    coCell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
    dataRowNum++;
  }

  ws.getRow(dataRowNum).height = 10; dataRowNum++;

  ws.mergeCells(dataRowNum, 1, dataRowNum, COL_COUNT);
  const stRow = ws.getRow(dataRowNum);
  const stCell = stRow.getCell(1);
  stCell.value = "STAFF-WISE SUMMARY"; stCell.font = { bold: true, size: 10, color: { argb: WHITE } };
  stCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } }; stCell.alignment = { horizontal: "center" };
  stRow.height = 18; dataRowNum++;

  const subHdr = ws.getRow(dataRowNum); subHdr.height = 16;
  ["Staff Name", "EMP ID", "Mobile", "Total Rides", "Total KM"].forEach((h, ci) => {
    const cell = subHdr.getCell(ci + 1); cell.value = h;
    cell.font = { bold: true, size: 9, color: { argb: DKGRAY } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } }; cell.alignment = { horizontal: "center" };
  });
  dataRowNum++;

  for (const [name, info] of staffTotals.entries()) {
    const sr = ws.getRow(dataRowNum); sr.height = 16;
    [name, info.empCode, info.mobile, info.rides, `${info.km.toFixed(1)} km`].forEach((val, ci) => {
      const cell = sr.getCell(ci + 1); cell.value = val; cell.font = { size: 9, name: "Calibri" };
      cell.alignment = { horizontal: ci >= 3 ? "center" : "left" };
      cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
    });
    dataRowNum++;
  }

  const gtRow = ws.getRow(dataRowNum); gtRow.height = 18;
  ws.mergeCells(dataRowNum, 1, dataRowNum, 3);
  const gtLabel = gtRow.getCell(1);
  gtLabel.value = `GRAND TOTAL  (${totalStaff} staff)`; gtLabel.font = { bold: true, size: 10, color: { argb: WHITE } };
  gtLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; gtLabel.alignment = { horizontal: "center" };
  const gtRides = gtRow.getCell(4);
  gtRides.value = totalRides; gtRides.font = { bold: true, size: 10, color: { argb: WHITE } };
  gtRides.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; gtRides.alignment = { horizontal: "center" };
  const gtKm = gtRow.getCell(5);
  gtKm.value = `${totalKmAll.toFixed(1)} km`; gtKm.font = { bold: true, size: 10, color: { argb: WHITE } };
  gtKm.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; gtKm.alignment = { horizontal: "center" };

  const buf = await wb.xlsx.writeBuffer() as unknown as Buffer;
  return { buffer: buf, filename: `ride-report-${from}-to-${to}.xlsx` };
}

// ─── Build vehicle KM summary Excel buffer ────────────────────────────────────

export async function buildVehicleKmXlsx(opts: {
  companyId: string | null;
  organization: string | null;
  from: string;
  to: string;
}): Promise<{ buffer: Buffer; filename: string }> {
  const { completed, staffMap, odometerMap, from, to } = await fetchRideData(opts);
  const organization = opts.organization;

  const GREEN    = "FF059669";
  const GREEN_DK = "FF047857";

  type DayKm = { gpsKm: number; tripCount: number; staffName: string; empCode: string; mobile: string };
  const gpsPerDay = new Map<string, DayKm>();
  for (const { start, end } of completed) {
    const endP = (end.payload || {}) as ActivityPayload;
    const gpsKm = typeof endP.distanceKm === "number" ? endP.distanceKm : 0;
    const dateStr = toIST(new Date(start.occurredAt as Date));
    const key = `${start.staffId}::${dateStr}`;
    const staff = staffMap.get(start.staffId);
    const acc = gpsPerDay.get(key) ?? { gpsKm: 0, tripCount: 0, staffName: start.staffName, empCode: staff?.empCode ?? "", mobile: staff?.phone ?? "" };
    acc.gpsKm += gpsKm;
    acc.tripCount++;
    gpsPerDay.set(key, acc);
  }

  type DayRow = {
    staffName: string; empCode: string; mobile: string; date: string;
    startOdometer: number | null; endOdometer: number | null;
    vehicleKm: number | null; gpsKm: number; tripCount: number; variancePct: number | null;
    checkinPhotoUri: string | null; checkoutPhotoUri: string | null;
  };

  const dayRows: DayRow[] = [];
  const allDayKeys = new Set([...odometerMap.keys(), ...gpsPerDay.keys()]);
  for (const key of allDayKeys) {
    const [staffId, date] = key.split("::");
    if (!staffId || !date) continue;
    const odo   = odometerMap.get(key) ?? { startOdometerKm: null, endOdometerKm: null, checkinPhotoUri: null, checkoutPhotoUri: null };
    const gps   = gpsPerDay.get(key) ?? { gpsKm: 0, tripCount: 0, staffName: "", empCode: "", mobile: "" };
    const staff = staffMap.get(staffId);
    const staffName = gps.staffName || staff?.name || staffId;
    const empCode   = (gps.empCode   || staff?.empCode) ?? "";
    const mobile    = (gps.mobile    || staff?.phone)   ?? "";
    let vehicleKm: number | null = null;
    if (odo.startOdometerKm != null && odo.endOdometerKm != null && odo.endOdometerKm >= odo.startOdometerKm) {
      vehicleKm = Math.round((odo.endOdometerKm - odo.startOdometerKm) * 10) / 10;
    }
    let variancePct: number | null = null;
    if (vehicleKm != null && gps.gpsKm > 0) {
      variancePct = Math.round(Math.abs(vehicleKm - gps.gpsKm) / vehicleKm * 100 * 10) / 10;
    }
    dayRows.push({ staffName, empCode, mobile, date, startOdometer: odo.startOdometerKm, endOdometer: odo.endOdometerKm, vehicleKm, gpsKm: Math.round(gps.gpsKm * 10) / 10, tripCount: gps.tripCount, variancePct, checkinPhotoUri: odo.checkinPhotoUri ?? null, checkoutPhotoUri: odo.checkoutPhotoUri ?? null });
  }
  dayRows.sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));

  const wb = new ExcelJS.Workbook();
  wb.creator = "JSDMS Field Force Manager";
  wb.created = new Date();

  const D_COLS = 12;
  const ws = wb.addWorksheet("Daily Vehicle KM", { properties: { tabColor: { argb: GREEN } } });
  ws.columns = [
    { width: 22 }, { width: 13 }, { width: 14 }, { width: 12 },
    { width: 16 }, { width: 16 }, { width: 12 }, { width: 14 }, { width: 12 },
    { width: 14 }, { width: 20 }, { width: 20 },
  ];

  const orgLine = organization ?? "Jharkhand Skill Development Mission Society (JSDMS) / DDU-KK";

  ws.mergeCells(1, 1, 1, D_COLS); const d1 = ws.getCell(1, 1);
  d1.value = orgLine; d1.font = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
  d1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } }; d1.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, D_COLS); const d2 = ws.getCell(2, 1);
  d2.value = "DAILY VEHICLE KM vs GPS KM REPORT"; d2.font = { bold: true, size: 14, color: { argb: AMBER }, name: "Calibri" };
  d2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } }; d2.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 26;

  ws.mergeCells(3, 1, 3, D_COLS); const d3 = ws.getCell(3, 1);
  d3.value = `Period: ${from}  →  ${to}   |   Rows highlighted in orange = variance > 20%`;
  d3.font = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
  d3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_DK } }; d3.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height = 18;

  ws.getRow(4).height = 8;
  const D_HDRS = [
    "Staff Name", "EMP ID", "Mobile No.", "Date",
    "Start Odometer\n(km)", "End Odometer\n(km)", "Vehicle KM",
    "Sum GPS KM\n(all trips)", "Variance %", "Flag",
    "Check-In Photo", "Check-Out Photo",
  ];
  const dhRow = ws.getRow(5); dhRow.height = 32;
  D_HDRS.forEach((h, ci) => {
    const cell = dhRow.getCell(ci + 1); cell.value = h;
    cell.font = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: AMBER } } };
  });

  const dAltFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
  const dVarFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFED7AA" } };
  let dRowNum = 6;
  let totalVehicleKm = 0;
  let totalGpsKm     = 0;
  let flaggedCount   = 0;

  for (const [idx, r] of dayRows.entries()) {
    const dr = ws.getRow(dRowNum); dr.height = 16;
    const highVar = r.variancePct !== null && r.variancePct > 20;
    const fill = highVar ? dVarFill : idx % 2 === 1 ? dAltFill : undefined;
    const cells = [
      r.staffName, r.empCode, r.mobile, r.date,
      r.startOdometer ?? "", r.endOdometer ?? "",
      r.vehicleKm !== null ? r.vehicleKm : "",
      r.gpsKm     > 0     ? r.gpsKm : "",
      r.variancePct !== null ? `${r.variancePct}%` : "",
      highVar ? "⚠ >20% Variance" : "",
    ];
    cells.forEach((val, ci) => {
      const cell = dr.getCell(ci + 1); cell.value = val;
      const isVarCol = ci === 8; const isFlagCol = ci === 9;
      cell.font = { size: 9, name: "Calibri", bold: isFlagCol && highVar, color: { argb: highVar && (isVarCol || isFlagCol) ? "FFB45309" : "FF111827" } };
      cell.alignment = { horizontal: ci >= 4 ? "center" : "left", vertical: "middle" };
      if (fill) cell.fill = fill;
      cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
    });

    const dCiCell = dr.getCell(11);
    if (r.checkinPhotoUri) { dCiCell.value = { text: "View Photo", hyperlink: r.checkinPhotoUri }; dCiCell.font = { size: 9, name: "Calibri", color: { argb: "FF1A3560" }, underline: true }; }
    else { dCiCell.value = "—"; dCiCell.font = { size: 9, name: "Calibri", color: { argb: "FF9CA3AF" } }; }
    dCiCell.alignment = { horizontal: "center", vertical: "middle" };
    if (fill) dCiCell.fill = fill;
    dCiCell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };

    const dCoCell = dr.getCell(12);
    if (r.checkoutPhotoUri) { dCoCell.value = { text: "View Photo", hyperlink: r.checkoutPhotoUri }; dCoCell.font = { size: 9, name: "Calibri", color: { argb: "FF1A3560" }, underline: true }; }
    else { dCoCell.value = "—"; dCoCell.font = { size: 9, name: "Calibri", color: { argb: "FF9CA3AF" } }; }
    dCoCell.alignment = { horizontal: "center", vertical: "middle" };
    if (fill) dCoCell.fill = fill;
    dCoCell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };

    if (r.vehicleKm !== null) totalVehicleKm += r.vehicleKm;
    totalGpsKm += r.gpsKm;
    if (highVar) flaggedCount++;
    dRowNum++;
  }

  const dtRow = ws.getRow(dRowNum); dtRow.height = 18;
  ws.mergeCells(dRowNum, 1, dRowNum, 6);
  const dtLabel = dtRow.getCell(1);
  dtLabel.value = "TOTALS"; dtLabel.font = { bold: true, size: 10, name: "Calibri", color: { argb: WHITE } };
  dtLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; dtLabel.alignment = { horizontal: "center", vertical: "middle" };
  const dtVehicle = dtRow.getCell(7);
  dtVehicle.value = `${Math.round(totalVehicleKm * 10) / 10} km`; dtVehicle.font = { bold: true, size: 10, name: "Calibri", color: { argb: WHITE } };
  dtVehicle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; dtVehicle.alignment = { horizontal: "center", vertical: "middle" };
  const dtGps = dtRow.getCell(8);
  dtGps.value = `${Math.round(totalGpsKm * 10) / 10} km`; dtGps.font = { bold: true, size: 10, name: "Calibri", color: { argb: WHITE } };
  dtGps.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; dtGps.alignment = { horizontal: "center", vertical: "middle" };
  dtRow.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  const dtFlag = dtRow.getCell(10);
  dtFlag.value = flaggedCount > 0 ? `⚠ ${flaggedCount} flagged` : "—"; dtFlag.font = { bold: true, size: 10, name: "Calibri", color: { argb: WHITE } };
  dtFlag.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; dtFlag.alignment = { horizontal: "center", vertical: "middle" };
  for (const pc of [11, 12]) { dtRow.getCell(pc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; }

  const buf = await wb.xlsx.writeBuffer() as unknown as Buffer;
  return { buffer: buf, filename: `vehicle-km-summary-${from}-to-${to}.xlsx` };
}

// ─── Build and send all selected reports ─────────────────────────────────────

export async function buildAndSendScheduledReports(opts: {
  companyId: string | null;
  organization: string | null;
  from: string;
  to: string;
  recipients: string[];
  reportTypes: ReportType[];
}): Promise<void> {
  const { reportTypes } = opts;
  const orgName = opts.organization ?? "JSDMS";

  const attachments: Array<{ buffer: Buffer; filename: string }> = [];
  const reportLabels: string[] = [];

  if (reportTypes.includes("attendance")) {
    const result = await buildAttendanceSummaryXlsx(opts);
    attachments.push(result);
    reportLabels.push("Attendance Summary");
  }
  if (reportTypes.includes("rideReport")) {
    const result = await buildRideReportXlsx(opts);
    attachments.push(result);
    reportLabels.push("Staff Ride Report");
  }
  if (reportTypes.includes("vehicleKm")) {
    const result = await buildVehicleKmXlsx(opts);
    attachments.push(result);
    reportLabels.push("Vehicle KM Summary");
  }

  if (attachments.length === 0) return;

  const reportList = reportLabels.join(", ");
  const subject = `Scheduled Reports — ${opts.from} to ${opts.to} | ${orgName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; max-width: 600px; margin: 0 auto;">
      <div style="background: #0F766E; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #fff; margin: 0; font-size: 18px;">Scheduled Reports</h2>
        <p style="color: #A7F3D0; margin: 4px 0 0; font-size: 13px;">${orgName}</p>
      </div>
      <div style="background: #F9FAFB; padding: 20px 24px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 12px; font-size: 14px;">
          Please find the following report(s) attached for the period
          <strong>${opts.from}</strong> to <strong>${opts.to}</strong>:
        </p>
        <ul style="margin: 0 0 12px; padding-left: 20px; font-size: 14px;">
          ${reportLabels.map(l => `<li><strong>${l}</strong></li>`).join("")}
        </ul>
        <p style="margin: 0 0 12px; font-size: 13px; color: #6B7280;">
          These reports were automatically generated and sent by the JSDMS Field Force Manager.
        </p>
        <p style="margin: 0; font-size: 13px; color: #9CA3AF;">
          Generated on ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} at ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST
        </p>
      </div>
    </div>
  `;

  await sendEmailWithAttachments({
    to: opts.recipients,
    subject,
    html,
    attachments: attachments.map(a => ({ buffer: a.buffer, filename: a.filename })),
  });

  logger.info({ recipients: opts.recipients, reports: reportList, from: opts.from, to: opts.to }, "Scheduled reports email sent");
}

// ─── Backward-compat shim (kept for any existing call sites) ─────────────────

export async function buildAndSendAttendanceSummary(opts: {
  companyId: string | null;
  organization: string | null;
  from: string;
  to: string;
  recipients: string[];
}): Promise<void> {
  return buildAndSendScheduledReports({ ...opts, reportTypes: ["attendance"] });
}

// ─── Date range helpers ───────────────────────────────────────────────────────

function getDateRangeForFrequency(
  frequency: "daily" | "weekly" | "monthly",
): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (frequency === "daily") {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return { from: yesterday, to: yesterday };
  }

  if (frequency === "weekly") {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return { from: weekAgo, to: today };
  }

  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { from: monthAgo, to: today };
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

export function startReportScheduler(): void {
  cron.schedule("0 * * * *", async () => {
    const nowUtc = new Date();
    const currentHourUtc = nowUtc.getUTCHours();
    const currentDow = nowUtc.getUTCDay();
    const currentDom = nowUtc.getUTCDate();

    logger.info({ currentHourUtc }, "Report scheduler tick");

    try {
      const schedules = await db
        .select()
        .from(reportSchedulesTable)
        .where(eq(reportSchedulesTable.enabled, true));

      for (const schedule of schedules) {
        try {
          if (schedule.hourUtc !== currentHourUtc) continue;

          if (schedule.frequency === "weekly") {
            if (schedule.dayOfWeek !== currentDow) continue;
          } else if (schedule.frequency === "monthly") {
            if (schedule.dayOfMonth !== currentDom) continue;
          }

          let organization: string | null = null;
          if (schedule.companyId) {
            try {
              const [co] = await db
                .select({ name: companiesTable.name, projectName: companiesTable.projectName })
                .from(companiesTable)
                .where(eq(companiesTable.id, schedule.companyId))
                .limit(1);
              if (co) {
                organization = co.projectName
                  ? `${co.name} — ${co.projectName}`
                  : co.name;
              }
            } catch { /* non-fatal */ }
          }

          const { from, to } = getDateRangeForFrequency(schedule.frequency as "daily" | "weekly" | "monthly");

          const sentAtCondition = schedule.lastSentAt
            ? eq(reportSchedulesTable.lastSentAt, schedule.lastSentAt)
            : isNull(reportSchedulesTable.lastSentAt);

          const claimTs = new Date();
          const [claimed] = await db
            .update(reportSchedulesTable)
            .set({ lastSentAt: claimTs })
            .where(and(eq(reportSchedulesTable.id, schedule.id), sentAtCondition))
            .returning({ id: reportSchedulesTable.id });

          if (!claimed) {
            logger.info({ scheduleId: schedule.id }, "Report schedule already claimed by another instance, skipping");
            continue;
          }

          const reportTypes = (schedule.reportTypes ?? ["attendance"]) as ReportType[];

          try {
            await buildAndSendScheduledReports({
              companyId: schedule.companyId ?? null,
              organization,
              from,
              to,
              recipients: schedule.recipients,
              reportTypes,
            });

            logger.info(
              { scheduleId: schedule.id, recipients: schedule.recipients, from, to, reportTypes },
              "Scheduled reports sent",
            );
          } catch (sendErr) {
            await db
              .update(reportSchedulesTable)
              .set({ lastSentAt: schedule.lastSentAt ?? null })
              .where(eq(reportSchedulesTable.id, schedule.id));
            throw sendErr;
          }
        } catch (err) {
          logger.error({ err, scheduleId: schedule.id }, "Failed to send scheduled report");
        }
      }
    } catch (err) {
      logger.error({ err }, "Report scheduler error");
    }
  });

  logger.info("Report scheduler started (hourly tick)");
}
