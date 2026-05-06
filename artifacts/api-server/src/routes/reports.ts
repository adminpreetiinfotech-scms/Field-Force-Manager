import { activityEventsTable, companiesTable, db, staffTable } from "@workspace/db";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import ExcelJS from "exceljs";
import { Router } from "express";
import { requireAdmin } from "./admin";

const router = Router();

type ActivityPayload = {
  location?: { latitude: number; longitude: number } | null;
  reading?: number | null;
  consumerNo?: string | null;
  distanceKm?: number | null;
  durationSec?: number | null;
  origin?: { latitude: number; longitude: number } | null;
  destination?: { latitude: number; longitude: number } | null;
  startOdometerKm?: number | null;
  endOdometerKm?: number | null;
  vehicleMeterPhotoUri?: string | null;
  selfieUri?: string | null;
  photoUri?: string | null;
};

const NAVY  = "FF1A3560";
const AMBER = "FFF59E0B";
const WHITE = "FFFFFFFF";
const LGRAY = "FFF3F4F6";
const DKGRAY = "FF374151";

function toIST(d: Date): string {
  const offset = 5.5 * 60 * 60 * 1000;
  const local  = new Date(d.getTime() + offset);
  return local.toISOString().slice(0, 10);
}

function toISTTime(d: Date): string {
  const offset = 5.5 * 60 * 60 * 1000;
  const local  = new Date(d.getTime() + offset);
  return local.toISOString().slice(11, 16); // HH:MM
}

function coordStr(p: ActivityPayload | null, field: "origin" | "destination" | "location"): string {
  const geo = p?.[field];
  if (!geo) return "";
  return `${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}`;
}

// ─── GET /api/admin/reports/rides/xlsx ─────────────────────────────────────

router.get("/admin/reports/rides/xlsx", requireAdmin, async (req, res, next) => {
  try {
    const rawFrom       = req.query.from         as string | undefined;
    const rawTo         = req.query.to           as string | undefined;
    const rawStaffId    = req.query.staffId      as string | undefined;
    const reportType    = (req.query.reportType  as string | undefined) ?? "daily";
    const sheetFilter   = (req.query.sheet       as string | undefined) ?? null;
    // Use companyId from auth middleware (null = super admin, sees all)
    const rawCompanyId  = (res.locals.companyId as string | null) ?? null;
    let   organization  = (req.query.organization as string | undefined)?.trim() || null;
    const staffNameHdr  = (req.query.staffName   as string | undefined)?.trim()  || null;

    // Auto-resolve company name from DB when companyId is passed
    if (rawCompanyId && !organization) {
      try {
        const [co] = await db
          .select({ name: companiesTable.name, projectName: companiesTable.projectName })
          .from(companiesTable)
          .where(eq(companiesTable.id, rawCompanyId))
          .limit(1);
        if (co) {
          organization = co.projectName
            ? `${co.name} — ${co.projectName}`
            : co.name;
        }
      } catch { /* non-fatal */ }
    }

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (!rawFrom || !DATE_RE.test(rawFrom) || !rawTo || !DATE_RE.test(rawTo)) {
      res.status(400).json({ title: "`from` and `to` are required (YYYY-MM-DD)", status: 400 });
      return;
    }

    const startOfFrom = new Date(`${rawFrom}T00:00:00.000Z`);
    const endOfTo     = new Date(`${rawTo}T23:59:59.999Z`);

    // ── 1. Fetch all trip events in range ─────────────────────────────────────
    const tripConds = [
      inArray(activityEventsTable.kind, ["trip-start", "trip-end"]),
      gte(activityEventsTable.occurredAt, startOfFrom),
      lt(activityEventsTable.occurredAt, new Date(endOfTo.getTime() + 1)),
    ] as ReturnType<typeof eq>[];
    if (rawStaffId)   tripConds.push(eq(activityEventsTable.staffId, rawStaffId));
    if (rawCompanyId) tripConds.push(eq(activityEventsTable.companyId, rawCompanyId));

    const tripRows = await db
      .select()
      .from(activityEventsTable)
      .where(and(...tripConds))
      .orderBy(activityEventsTable.occurredAt);

    // ── 2. Pair trips by tripRef ──────────────────────────────────────────────
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

    // ── 3. Fetch staff info ───────────────────────────────────────────────────
    const uniqueIds = [...new Set(completed.map(t => t.start.staffId))];
    const staffRows = uniqueIds.length
      ? await db
          .select({ id: staffTable.id, empCode: staffTable.empCode, phone: staffTable.phone, name: staffTable.name })
          .from(staffTable)
          .where(inArray(staffTable.id, uniqueIds))
      : [];
    const staffMap = new Map(staffRows.map(s => [s.id, s]));

    // ── 4. Fetch checkin/checkout events in range (odometer data + attendance sheet) ───────────
    const attendConds = [
      inArray(activityEventsTable.kind, ["checkin", "checkout"]),
      gte(activityEventsTable.occurredAt, startOfFrom),
      lt(activityEventsTable.occurredAt, new Date(endOfTo.getTime() + 1)),
    ] as ReturnType<typeof eq>[];
    if (rawStaffId)   attendConds.push(eq(activityEventsTable.staffId, rawStaffId));
    if (rawCompanyId) attendConds.push(eq(activityEventsTable.companyId, rawCompanyId));

    const attendRows = await db
      .select()
      .from(activityEventsTable)
      .where(and(...attendConds))
      .orderBy(activityEventsTable.occurredAt);

    // Build: staffId → date (IST) → { startOdometerKm, endOdometerKm, checkinPhotoUri, checkoutPhotoUri }
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

    // Build attendance summary: staffId::date → { staffName, firstCheckin, lastCheckout }
    type AttendDay = {
      staffId: string;
      staffName: string;
      date: string;
      firstCheckin: Date | null;
      lastCheckout: Date | null;
    };
    const attendDayMap = new Map<string, AttendDay>();
    for (const row of attendRows) {
      const t = new Date(row.occurredAt as Date);
      const date = toIST(t);
      const key = `${row.staffId}::${date}`;
      const existing = attendDayMap.get(key) ?? { staffId: row.staffId, staffName: row.staffName, date, firstCheckin: null, lastCheckout: null };
      if (row.kind === "checkin") {
        if (!existing.firstCheckin || t < existing.firstCheckin) existing.firstCheckin = t;
      }
      if (row.kind === "checkout") {
        if (!existing.lastCheckout || t > existing.lastCheckout) existing.lastCheckout = t;
      }
      attendDayMap.set(key, existing);
    }

    // Ensure staffMap covers all staff appearing in attendance rows
    const attendStaffIds = [...new Set(attendRows.map(r => r.staffId))].filter(id => !staffMap.has(id));
    if (attendStaffIds.length > 0) {
      const extraStaff = await db
        .select({ id: staffTable.id, empCode: staffTable.empCode, phone: staffTable.phone, name: staffTable.name })
        .from(staffTable)
        .where(inArray(staffTable.id, attendStaffIds));
      for (const s of extraStaff) staffMap.set(s.id, s);
    }

    // ── 5. Build rows ─────────────────────────────────────────────────────────
    type ReportRow = {
      staffName: string;
      empCode: string;
      mobile: string;
      date: string;
      startOdometer: number | null;
      endOdometer: number | null;
      vehicleKm: number | null;
      gpsKm: number | null;
      variancePct: number | null;
      startTime: string;
      endTime: string;
      startLocation: string;
      endLocation: string;
      reportType: string;
      checkinPhotoUrl: string | null;
      checkoutPhotoUrl: string | null;
    };

    const rows: ReportRow[] = [];

    for (const { start, end } of completed) {
      const startPayload = (start.payload || {}) as ActivityPayload;
      const endPayload   = (end.payload   || {}) as ActivityPayload;
      const staff        = staffMap.get(start.staffId);
      const startAt      = new Date(start.occurredAt as Date);
      const endAt        = new Date(end.occurredAt   as Date);

      const gpsKm = typeof endPayload.distanceKm === "number"
        ? Math.round(endPayload.distanceKm * 10) / 10
        : null;

      // Look up odometer for this staff+date
      const dateKey = `${start.staffId}::${toIST(startAt)}`;
      const odo = odometerMap.get(dateKey) ?? { startOdometerKm: null, endOdometerKm: null, checkinPhotoUri: null, checkoutPhotoUri: null };
      const startOdometer = odo.startOdometerKm;
      const endOdometer   = odo.endOdometerKm;

      let vehicleKm: number | null = null;
      if (startOdometer != null && endOdometer != null && endOdometer >= startOdometer) {
        vehicleKm = Math.round((endOdometer - startOdometer) * 10) / 10;
      }

      let variancePct: number | null = null;
      if (vehicleKm != null && vehicleKm > 0) {
        // Calculate variance even when gpsKm = 0 (shows 100% discrepancy)
        variancePct = Math.round(Math.abs(vehicleKm - (gpsKm ?? 0)) / vehicleKm * 100 * 10) / 10;
      }

      rows.push({
        staffName:     start.staffName,
        empCode:       staff?.empCode ?? "",
        mobile:        staff?.phone   ?? "",
        date:          toIST(startAt),
        startOdometer,
        endOdometer,
        vehicleKm,
        gpsKm,
        variancePct,
        startTime:     toISTTime(startAt),
        endTime:       toISTTime(endAt),
        startLocation: coordStr(startPayload, "origin") || coordStr(startPayload, "location"),
        endLocation:   coordStr(endPayload, "destination") || coordStr(endPayload, "location"),
        reportType:    reportType.charAt(0).toUpperCase() + reportType.slice(1),
        checkinPhotoUrl:  odo.checkinPhotoUri  ?? null,
        checkoutPhotoUrl: odo.checkoutPhotoUri ?? null,
      });
    }

    // Sort by date then staff name
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));

    // ── 6. Build summary ─────────────────────────────────────────────────────
    const totalStaff = new Set(rows.map(r => r.empCode || r.staffName)).size;
    const totalRides = rows.length;
    const totalKmAll = rows.reduce((s, r) => s + (r.gpsKm ?? 0), 0);

    // Per-staff totals map: staffName → gpsKm
    const staffTotals = new Map<string, { empCode: string; mobile: string; km: number; rides: number }>();
    for (const r of rows) {
      const key = r.staffName;
      const prev = staffTotals.get(key) ?? { empCode: r.empCode, mobile: r.mobile, km: 0, rides: 0 };
      staffTotals.set(key, { ...prev, km: prev.km + (r.gpsKm ?? 0), rides: prev.rides + 1 });
    }

    // ── 7. Build Excel workbook ───────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "JSDMS Field Force Manager";
    wb.created = new Date();

    const staffPart = staffNameHdr ? `Staff: ${staffNameHdr}   |   ` : "";

    if (sheetFilter !== "vehicleKm") {
    const ws = wb.addWorksheet("Ride Report", { properties: { tabColor: { argb: NAVY } } });

    // Column widths
    ws.columns = [
      { width: 22 }, // Staff Name
      { width: 13 }, // EMP ID
      { width: 14 }, // Mobile
      { width: 12 }, // Date
      { width: 16 }, // Start Odometer
      { width: 16 }, // End Odometer
      { width: 12 }, // Vehicle KM
      { width: 10 }, // GPS KM
      { width: 12 }, // Variance %
      { width: 12 }, // Start Time
      { width: 12 }, // End Time
      { width: 28 }, // Start Location
      { width: 28 }, // End Location
      { width: 12 }, // Report Type
      { width: 30 }, // Check-In Photo
      { width: 30 }, // Check-Out Photo
    ];

    const COL_COUNT = 16;

    function mergeHeader(ws: ExcelJS.Worksheet, row: number, text: string, fgArgb: string, textArgb: string, sz = 13) {
      ws.mergeCells(row, 1, row, COL_COUNT);
      const cell = ws.getCell(row, 1);
      cell.value = text;
      cell.font  = { bold: true, size: sz, color: { argb: textArgb }, name: "Calibri" };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: fgArgb } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(row).height = sz === 13 ? 26 : 20;
    }

    // Header rows
    const orgLine = organization ?? "Jharkhand Skill Development Mission Society (JSDMS) / DDU-KK";
    mergeHeader(ws, 1, orgLine, NAVY, WHITE, 13);
    mergeHeader(ws, 2, "STAFF RIDE READING REPORT", NAVY, AMBER, 14);

    const rtLabel   = (rows[0]?.reportType ?? reportType.charAt(0).toUpperCase() + reportType.slice(1));
    mergeHeader(ws, 3, `${staffPart}Report: ${rawFrom}  →  ${rawTo}   |   Type: ${rtLabel}`, "FF1E3A5F", WHITE, 10);

    // Summary block (row 5-8)
    const summaryData = [
      ["Total Staff", totalStaff, "Total Rides", totalRides],
      ["Total KM", `${totalKmAll.toFixed(1)} km`, "Generated On", new Date().toLocaleDateString("en-IN")],
    ];
    for (let i = 0; i < summaryData.length; i++) {
      const rowNum = 5 + i;
      ws.getRow(rowNum).height = 18;
      const [l1, v1, l2, v2] = summaryData[i]!;
      // Label 1 (cols 1-2)
      ws.mergeCells(rowNum, 1, rowNum, 2);
      const lc1 = ws.getCell(rowNum, 1);
      lc1.value = l1; lc1.font = { bold: true, size: 10, color: { argb: DKGRAY } };
      lc1.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
      lc1.alignment = { horizontal: "right" };
      // Value 1 (cols 3-4)
      ws.mergeCells(rowNum, 3, rowNum, 4);
      const vc1 = ws.getCell(rowNum, 3);
      vc1.value = v1; vc1.font = { bold: true, size: 11, color: { argb: NAVY } };
      vc1.alignment = { horizontal: "left" };
      // Label 2 (cols 5-6)
      ws.mergeCells(rowNum, 5, rowNum, 6);
      const lc2 = ws.getCell(rowNum, 5);
      lc2.value = l2; lc2.font = { bold: true, size: 10, color: { argb: DKGRAY } };
      lc2.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
      lc2.alignment = { horizontal: "right" };
      // Value 2 (cols 7-8)
      ws.mergeCells(rowNum, 7, rowNum, 8);
      const vc2 = ws.getCell(rowNum, 7);
      vc2.value = v2; vc2.font = { bold: true, size: 11, color: { argb: NAVY } };
      vc2.alignment = { horizontal: "left" };
    }

    // Blank spacer row
    ws.getRow(7).height = 8;

    // Column headers (row 8)
    const HEADERS = [
      "Staff Name", "EMP ID", "Mobile No.", "Date",
      "Start Odometer\n(km)", "End Odometer\n(km)", "Vehicle KM",
      "GPS KM", "Variance %",
      "Ride Start\nTime", "Ride End\nTime",
      "Start Location", "End Location", "Report Type",
      "Check-In\nOdo Photo", "Check-Out\nOdo Photo",
    ];
    const hRow = ws.getRow(8);
    hRow.height = 32;
    HEADERS.forEach((h, ci) => {
      const cell = hRow.getCell(ci + 1);
      cell.value = h;
      cell.font  = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: AMBER } } };
    });

    // Data rows starting at row 9
    let dataRowNum = 9;
    const altFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };

    for (const [idx, r] of rows.entries()) {
      const dr = ws.getRow(dataRowNum);
      dr.height = 16;
      const isAlt = idx % 2 === 1;
      const rowFill = isAlt ? altFill : undefined;

      const cells: (string | number)[] = [
        r.staffName,
        r.empCode,
        r.mobile,
        r.date,
        r.startOdometer ?? "",
        r.endOdometer   ?? "",
        r.vehicleKm     !== null ? r.vehicleKm  : "",
        r.gpsKm         !== null ? r.gpsKm      : "",
        r.variancePct   !== null ? `${r.variancePct}%` : "",
        r.startTime,
        r.endTime,
        r.startLocation,
        r.endLocation,
        r.reportType,
      ];

      // Highlight rows with variance > 20% in orange
      const highVariance = r.variancePct !== null && r.variancePct > 20;
      const varianceFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } };

      cells.forEach((val, ci) => {
        const cell = dr.getCell(ci + 1);
        cell.value = val;
        cell.font  = { size: 9, name: "Calibri", color: { argb: highVariance && ci === 8 ? "FFB45309" : "FF111827" } };
        cell.alignment = { horizontal: ci >= 4 && ci <= 8 ? "center" : "left", vertical: "middle" };
        if (highVariance) cell.fill = varianceFill;
        else if (rowFill) cell.fill = rowFill;
        cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
      });

      // Check-In Photo (col 15)
      const ciPhotoCell = dr.getCell(15);
      if (r.checkinPhotoUrl) {
        ciPhotoCell.value = { text: "View Photo", hyperlink: r.checkinPhotoUrl };
        ciPhotoCell.font  = { size: 9, name: "Calibri", color: { argb: "FF1A3560" }, underline: true };
      } else {
        ciPhotoCell.value = "—";
        ciPhotoCell.font  = { size: 9, name: "Calibri", color: { argb: "FF9CA3AF" } };
      }
      ciPhotoCell.alignment = { horizontal: "center", vertical: "middle" };
      if (highVariance) ciPhotoCell.fill = varianceFill;
      else if (rowFill) ciPhotoCell.fill = rowFill;
      ciPhotoCell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };

      // Check-Out Photo (col 16)
      const coPhotoCell = dr.getCell(16);
      if (r.checkoutPhotoUrl) {
        coPhotoCell.value = { text: "View Photo", hyperlink: r.checkoutPhotoUrl };
        coPhotoCell.font  = { size: 9, name: "Calibri", color: { argb: "FF1A3560" }, underline: true };
      } else {
        coPhotoCell.value = "—";
        coPhotoCell.font  = { size: 9, name: "Calibri", color: { argb: "FF9CA3AF" } };
      }
      coPhotoCell.alignment = { horizontal: "center", vertical: "middle" };
      if (highVariance) coPhotoCell.fill = varianceFill;
      else if (rowFill) coPhotoCell.fill = rowFill;
      coPhotoCell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };

      dataRowNum++;
    }

    // Blank row before per-staff totals
    ws.getRow(dataRowNum).height = 10;
    dataRowNum++;

    // Per-staff subtotals
    const subtitleRow = ws.getRow(dataRowNum);
    ws.mergeCells(dataRowNum, 1, dataRowNum, COL_COUNT);
    const subtitleCell = subtitleRow.getCell(1);
    subtitleCell.value = "STAFF-WISE SUMMARY";
    subtitleCell.font  = { bold: true, size: 10, color: { argb: WHITE } };
    subtitleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
    subtitleCell.alignment = { horizontal: "center" };
    subtitleRow.height = 18;
    dataRowNum++;

    // Sub-header
    const subHdr = ws.getRow(dataRowNum);
    subHdr.height = 16;
    ["Staff Name", "EMP ID", "Mobile", "Total Rides", "Total KM"].forEach((h, ci) => {
      const cell = subHdr.getCell(ci + 1);
      cell.value = h;
      cell.font  = { bold: true, size: 9, color: { argb: DKGRAY } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
      cell.alignment = { horizontal: "center" };
    });
    dataRowNum++;

    for (const [name, info] of staffTotals.entries()) {
      const sr = ws.getRow(dataRowNum);
      sr.height = 16;
      [name, info.empCode, info.mobile, info.rides, `${info.km.toFixed(1)} km`].forEach((val, ci) => {
        const cell = sr.getCell(ci + 1);
        cell.value = val;
        cell.font  = { size: 9, name: "Calibri" };
        cell.alignment = { horizontal: ci >= 3 ? "center" : "left" };
        cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
      });
      dataRowNum++;
    }

    // Grand total row
    const gtRow = ws.getRow(dataRowNum);
    gtRow.height = 18;
    ws.mergeCells(dataRowNum, 1, dataRowNum, 3);
    const gtLabel = gtRow.getCell(1);
    gtLabel.value = `GRAND TOTAL  (${totalStaff} staff)`;
    gtLabel.font  = { bold: true, size: 10, color: { argb: WHITE } };
    gtLabel.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    gtLabel.alignment = { horizontal: "center" };
    const gtRides = gtRow.getCell(4);
    gtRides.value = totalRides;
    gtRides.font  = { bold: true, size: 10, color: { argb: WHITE } };
    gtRides.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    gtRides.alignment = { horizontal: "center" };
    const gtKm = gtRow.getCell(5);
    gtKm.value = `${totalKmAll.toFixed(1)} km`;
    gtKm.font  = { bold: true, size: 10, color: { argb: WHITE } };
    gtKm.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    gtKm.alignment = { horizontal: "center" };
    } // end if (sheetFilter !== "vehicleKm")

    // ── 8. Build "Daily Vehicle KM" sheet ────────────────────────────────────

    // Aggregate GPS KM per staffId+date from completed trips
    type DayKm = { gpsKm: number; tripCount: number; staffName: string; empCode: string; mobile: string };
    const gpsPerDay = new Map<string, DayKm>();
    for (const { start, end } of completed) {
      const endP = (end.payload || {}) as ActivityPayload;
      const gpsKm = typeof endP.distanceKm === "number" ? endP.distanceKm : 0;
      const dateStr = toIST(new Date(start.occurredAt as Date));
      const key = `${start.staffId}::${dateStr}`;
      const staff = staffMap.get(start.staffId);
      const acc = gpsPerDay.get(key) ?? { gpsKm: 0, tripCount: 0, staffName: start.staffName, empCode: staff?.empCode ?? "", mobile: staff?.phone ?? "" };
      acc.gpsKm   += gpsKm;
      acc.tripCount++;
      gpsPerDay.set(key, acc);
    }

    // Merge odometerMap + gpsPerDay into per-day rows
    type DayRow = {
      staffName: string; empCode: string; mobile: string; date: string;
      startOdometer: number | null; endOdometer: number | null;
      vehicleKm: number | null; gpsKm: number; tripCount: number; variancePct: number | null;
      checkinPhotoUri: string | null; checkoutPhotoUri: string | null;
    };

    const dayRows: DayRow[] = [];
    // Include all dates that have either odometer data or GPS trips
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
      if (vehicleKm != null && vehicleKm > 0) {
        // Calculate variance even when gpsKm = 0 (shows 100% discrepancy)
        variancePct = Math.round(Math.abs(vehicleKm - gps.gpsKm) / vehicleKm * 100 * 10) / 10;
      }

      dayRows.push({ staffName, empCode, mobile, date, startOdometer: odo.startOdometerKm, endOdometer: odo.endOdometerKm, vehicleKm, gpsKm: Math.round(gps.gpsKm * 10) / 10, tripCount: gps.tripCount, variancePct, checkinPhotoUri: odo.checkinPhotoUri ?? null, checkoutPhotoUri: odo.checkoutPhotoUri ?? null });
    }
    dayRows.sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));

    const ws2 = wb.addWorksheet("Daily Vehicle KM", { properties: { tabColor: { argb: "FF059669" } } });
    const D_COLS = 12;
    ws2.columns = [
      { width: 22 }, // Staff Name
      { width: 13 }, // EMP ID
      { width: 14 }, // Mobile
      { width: 12 }, // Date
      { width: 16 }, // Start Odometer
      { width: 16 }, // End Odometer
      { width: 12 }, // Vehicle KM
      { width: 14 }, // Sum GPS KM
      { width: 12 }, // Variance %
      { width: 14 }, // Flag
      { width: 20 }, // Check-In Photo
      { width: 20 }, // Check-Out Photo
    ];

    // Header rows for sheet 2
    ws2.mergeCells(1, 1, 1, D_COLS);
    const d1 = ws2.getCell(1, 1);
    d1.value = organization ?? "Jharkhand Skill Development Mission Society (JSDMS) / DDU-KK";
    d1.font  = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
    d1.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
    d1.alignment = { horizontal: "center", vertical: "middle" };
    ws2.getRow(1).height = 26;

    ws2.mergeCells(2, 1, 2, D_COLS);
    const d2 = ws2.getCell(2, 1);
    d2.value = "DAILY VEHICLE KM vs GPS KM REPORT";
    d2.font  = { bold: true, size: 14, color: { argb: AMBER }, name: "Calibri" };
    d2.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
    d2.alignment = { horizontal: "center", vertical: "middle" };
    ws2.getRow(2).height = 26;

    ws2.mergeCells(3, 1, 3, D_COLS);
    const d3 = ws2.getCell(3, 1);
    d3.value = `${staffPart}Period: ${rawFrom}  →  ${rawTo}   |   Rows highlighted in orange = variance > 20%`;
    d3.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    d3.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
    d3.alignment = { horizontal: "center", vertical: "middle" };
    ws2.getRow(3).height = 18;

    // Column headers row 5
    ws2.getRow(4).height = 8;
    const D_HDRS = [
      "Staff Name", "EMP ID", "Mobile No.", "Date",
      "Start Odometer\n(km)", "End Odometer\n(km)", "Vehicle KM",
      "Sum GPS KM\n(all trips)", "Variance %", "Flag",
      "Check-In Photo", "Check-Out Photo",
    ];
    const dhRow = ws2.getRow(5);
    dhRow.height = 32;
    D_HDRS.forEach((h, ci) => {
      const cell = dhRow.getCell(ci + 1);
      cell.value = h;
      cell.font  = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: AMBER } } };
    });

    // Data rows
    const dAltFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
    const dVarFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFED7AA" } };
    let dRowNum = 6;
    let totalVehicleKm = 0;
    let totalGpsKm     = 0;
    let flaggedCount   = 0;
    for (const [idx, r] of dayRows.entries()) {
      const dr = ws2.getRow(dRowNum);
      dr.height = 16;
      const highVar = r.variancePct !== null && r.variancePct > 20;
      const fill = highVar ? dVarFill : idx % 2 === 1 ? dAltFill : undefined;
      const cells = [
        r.staffName, r.empCode, r.mobile, r.date,
        r.startOdometer ?? "",
        r.endOdometer   ?? "",
        r.vehicleKm     !== null ? r.vehicleKm : "",
        r.gpsKm         > 0     ? r.gpsKm : "",
        r.variancePct   !== null ? `${r.variancePct}%` : "",
        highVar ? "⚠ >20% Variance" : "",
      ];
      cells.forEach((val, ci) => {
        const cell = dr.getCell(ci + 1);
        cell.value = val;
        const isVarCol  = ci === 8;
        const isFlagCol = ci === 9;
        cell.font  = {
          size: 9, name: "Calibri",
          bold: isFlagCol && highVar,
          color: { argb: highVar && (isVarCol || isFlagCol) ? "FFB45309" : "FF111827" },
        };
        cell.alignment = { horizontal: ci >= 4 ? "center" : "left", vertical: "middle" };
        if (fill) cell.fill = fill;
        cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
      });

      // Check-In Photo (col 11)
      const dCiPhotoCell = dr.getCell(11);
      if (r.checkinPhotoUri) {
        dCiPhotoCell.value = { text: "View Photo", hyperlink: r.checkinPhotoUri };
        dCiPhotoCell.font  = { size: 9, name: "Calibri", color: { argb: "FF1A3560" }, underline: true };
      } else {
        dCiPhotoCell.value = "—";
        dCiPhotoCell.font  = { size: 9, name: "Calibri", color: { argb: "FF9CA3AF" } };
      }
      dCiPhotoCell.alignment = { horizontal: "center", vertical: "middle" };
      if (fill) dCiPhotoCell.fill = fill;
      dCiPhotoCell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };

      // Check-Out Photo (col 12)
      const dCoPhotoCell = dr.getCell(12);
      if (r.checkoutPhotoUri) {
        dCoPhotoCell.value = { text: "View Photo", hyperlink: r.checkoutPhotoUri };
        dCoPhotoCell.font  = { size: 9, name: "Calibri", color: { argb: "FF1A3560" }, underline: true };
      } else {
        dCoPhotoCell.value = "—";
        dCoPhotoCell.font  = { size: 9, name: "Calibri", color: { argb: "FF9CA3AF" } };
      }
      dCoPhotoCell.alignment = { horizontal: "center", vertical: "middle" };
      if (fill) dCoPhotoCell.fill = fill;
      dCoPhotoCell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };

      if (r.vehicleKm !== null) totalVehicleKm += r.vehicleKm;
      totalGpsKm += r.gpsKm;
      if (highVar) flaggedCount++;
      dRowNum++;
    }

    // TOTALS footer row
    const dtRow = ws2.getRow(dRowNum);
    dtRow.height = 18;
    ws2.mergeCells(dRowNum, 1, dRowNum, 6);
    const dtLabel = dtRow.getCell(1);
    dtLabel.value = "TOTALS";
    dtLabel.font      = { bold: true, size: 10, name: "Calibri", color: { argb: WHITE } };
    dtLabel.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    dtLabel.alignment = { horizontal: "center", vertical: "middle" };
    const dtVehicle = dtRow.getCell(7);
    dtVehicle.value     = `${Math.round(totalVehicleKm * 10) / 10} km`;
    dtVehicle.font      = { bold: true, size: 10, name: "Calibri", color: { argb: WHITE } };
    dtVehicle.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    dtVehicle.alignment = { horizontal: "center", vertical: "middle" };
    const dtGps = dtRow.getCell(8);
    dtGps.value     = `${Math.round(totalGpsKm * 10) / 10} km`;
    dtGps.font      = { bold: true, size: 10, name: "Calibri", color: { argb: WHITE } };
    dtGps.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    dtGps.alignment = { horizontal: "center", vertical: "middle" };
    const dtVarCell = dtRow.getCell(9);
    dtVarCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    const dtFlag = dtRow.getCell(10);
    dtFlag.value     = flaggedCount > 0 ? `⚠ ${flaggedCount} flagged` : "—";
    dtFlag.font      = { bold: true, size: 10, name: "Calibri", color: { argb: WHITE } };
    dtFlag.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    dtFlag.alignment = { horizontal: "center", vertical: "middle" };
    // Fill photo columns in totals row
    for (const photoCol of [11, 12]) {
      const dtPhoto = dtRow.getCell(photoCol);
      dtPhoto.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    }

    // ── 9. Build "Attendance" sheet (only when data exists and not vehicleKm-only export) ──
    if (sheetFilter !== "vehicleKm" && attendDayMap.size > 0) {
      const PURPLE = "FF4F46E5";
      const PURPLE_DK = "FF3730A3";

      // Build sorted attendance rows
      type AttendRow = {
        staffName: string; empCode: string; mobile: string; date: string;
        checkIn: string; checkOut: string; durationHours: string;
      };
      const attendSheetRows: AttendRow[] = [];
      for (const a of attendDayMap.values()) {
        const staff = staffMap.get(a.staffId);
        const checkIn  = a.firstCheckin  ? toISTTime(a.firstCheckin)  : "";
        const checkOut = a.lastCheckout  ? toISTTime(a.lastCheckout)  : "";
        let durationHours = "";
        if (a.firstCheckin && a.lastCheckout && a.lastCheckout > a.firstCheckin) {
          const diffMs = a.lastCheckout.getTime() - a.firstCheckin.getTime();
          const hrs = diffMs / (1000 * 60 * 60);
          durationHours = `${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m`;
        }
        attendSheetRows.push({
          staffName:   a.staffName,
          empCode:     staff?.empCode ?? "",
          mobile:      staff?.phone   ?? "",
          date:        a.date,
          checkIn,
          checkOut,
          durationHours,
        });
      }
      attendSheetRows.sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));

      const A_COLS = 7;
      const ws3 = wb.addWorksheet("Attendance", { properties: { tabColor: { argb: PURPLE } } });
      ws3.columns = [
        { width: 24 }, // Staff Name
        { width: 13 }, // EMP ID
        { width: 14 }, // Mobile
        { width: 12 }, // Date
        { width: 14 }, // Check-In
        { width: 14 }, // Check-Out
        { width: 14 }, // Hours on Duty
      ];

      // Header rows
      ws3.mergeCells(1, 1, 1, A_COLS);
      const a1 = ws3.getCell(1, 1);
      a1.value = organization ?? "Jharkhand Skill Development Mission Society (JSDMS) / DDU-KK";
      a1.font  = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
      a1.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
      a1.alignment = { horizontal: "center", vertical: "middle" };
      ws3.getRow(1).height = 26;

      ws3.mergeCells(2, 1, 2, A_COLS);
      const a2 = ws3.getCell(2, 1);
      a2.value = "FIELD ATTENDANCE SUMMARY";
      a2.font  = { bold: true, size: 14, color: { argb: AMBER }, name: "Calibri" };
      a2.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
      a2.alignment = { horizontal: "center", vertical: "middle" };
      ws3.getRow(2).height = 26;

      ws3.mergeCells(3, 1, 3, A_COLS);
      const a3 = ws3.getCell(3, 1);
      a3.value = `${staffPart}Period: ${rawFrom}  →  ${rawTo}   |   ${attendSheetRows.length} attendance record(s)`;
      a3.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
      a3.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE_DK } };
      a3.alignment = { horizontal: "center", vertical: "middle" };
      ws3.getRow(3).height = 18;

      // Spacer
      ws3.getRow(4).height = 8;

      // Column headers (row 5)
      const A_HDRS = ["Staff Name", "EMP ID", "Mobile No.", "Date", "Check-In\nTime", "Check-Out\nTime", "Hours on\nDuty"];
      const ahRow = ws3.getRow(5);
      ahRow.height = 32;
      A_HDRS.forEach((h, ci) => {
        const cell = ahRow.getCell(ci + 1);
        cell.value = h;
        cell.font  = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = { bottom: { style: "thin", color: { argb: AMBER } } };
      });

      // Data rows
      const aAltFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
      const aPartialFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      let aRowNum = 6;
      for (const [idx, r] of attendSheetRows.entries()) {
        const ar = ws3.getRow(aRowNum);
        ar.height = 16;
        const isPartial = !r.checkIn || !r.checkOut;
        const fill = isPartial ? aPartialFill : idx % 2 === 1 ? aAltFill : undefined;
        const cells = [r.staffName, r.empCode, r.mobile, r.date, r.checkIn, r.checkOut, r.durationHours];
        cells.forEach((val, ci) => {
          const cell = ar.getCell(ci + 1);
          cell.value = val;
          cell.font  = { size: 9, name: "Calibri", color: { argb: "FF111827" } };
          cell.alignment = { horizontal: ci >= 4 ? "center" : "left", vertical: "middle" };
          if (fill) cell.fill = fill;
          cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
        });
        aRowNum++;
      }

      // Footer summary
      aRowNum++;
      const totalPresent = attendSheetRows.length;
      const totalWithCheckout = attendSheetRows.filter(r => r.checkIn && r.checkOut).length;
      ws3.mergeCells(aRowNum, 1, aRowNum, A_COLS);
      const aFooter = ws3.getCell(aRowNum, 1);
      aFooter.value = `Total: ${totalPresent} attendance record(s)   |   ${totalWithCheckout} with complete check-in/check-out   |   ${totalPresent - totalWithCheckout} check-out pending`;
      aFooter.font  = { bold: true, size: 9, color: { argb: WHITE } };
      aFooter.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
      aFooter.alignment = { horizontal: "center" };
      ws3.getRow(aRowNum).height = 18;
    }

    // ── 10. Stream response ───────────────────────────────────────────────────
    const fname = sheetFilter === "vehicleKm"
      ? `vehicle-km-summary-${rawFrom}-to-${rawTo}.xlsx`
      : `ride-report-${rawFrom}-to-${rawTo}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/reports/attendance-summary/xlsx ────────────────────────
// Downloads a styled Excel file with staff-wise check-in day counts + totals.
// Query params: from (YYYY-MM-DD), to (YYYY-MM-DD), staffId? (optional)
router.get("/admin/reports/attendance-summary/xlsx", requireAdmin, async (req, res, next) => {
  try {
    const rawFrom      = req.query.from    as string | undefined;
    const rawTo        = req.query.to      as string | undefined;
    const rawStaffId   = req.query.staffId as string | undefined;
    const rawCompanyId = (res.locals.companyId as string | null) ?? null;
    const staffNameHdr = (req.query.staffName as string | undefined)?.trim() || null;

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (!rawFrom || !DATE_RE.test(rawFrom) || !rawTo || !DATE_RE.test(rawTo)) {
      res.status(400).json({ title: "`from` and `to` are required (YYYY-MM-DD)", status: 400 });
      return;
    }

    // Auto-resolve organization name
    let organization: string | null = null;
    if (rawCompanyId) {
      try {
        const [co] = await db
          .select({ name: companiesTable.name, projectName: companiesTable.projectName })
          .from(companiesTable)
          .where(eq(companiesTable.id, rawCompanyId))
          .limit(1);
        if (co) {
          organization = co.projectName ? `${co.name} — ${co.projectName}` : co.name;
        }
      } catch { /* non-fatal */ }
    }

    const startOfFrom = new Date(`${rawFrom}T00:00:00.000Z`);
    const endOfTo     = new Date(`${rawTo}T23:59:59.999Z`);

    const conds = [
      eq(activityEventsTable.kind, "checkin"),
      gte(activityEventsTable.occurredAt, startOfFrom),
      lt(activityEventsTable.occurredAt, new Date(endOfTo.getTime() + 1)),
    ] as ReturnType<typeof eq>[];
    if (rawStaffId)   conds.push(eq(activityEventsTable.staffId, rawStaffId));
    if (rawCompanyId) conds.push(eq(activityEventsTable.companyId, rawCompanyId));

    const checkinRows = await db
      .select({
        staffId:    activityEventsTable.staffId,
        staffName:  activityEventsTable.staffName,
        occurredAt: activityEventsTable.occurredAt,
      })
      .from(activityEventsTable)
      .where(and(...conds))
      .orderBy(activityEventsTable.occurredAt);

    // Count distinct check-in days per staff (also track per-month)
    type StaffSummary = { staffId: string; staffName: string; days: Set<string>; monthDays: Map<string, Set<string>> };
    const staffMapLocal = new Map<string, StaffSummary>();
    for (const row of checkinRows) {
      const date  = toIST(new Date(row.occurredAt as Date));
      const month = date.slice(0, 7); // YYYY-MM
      const existing = staffMapLocal.get(row.staffId) ?? { staffId: row.staffId, staffName: row.staffName, days: new Set(), monthDays: new Map() };
      existing.days.add(date);
      const mDays = existing.monthDays.get(month) ?? new Set<string>();
      mDays.add(date);
      existing.monthDays.set(month, mDays);
      staffMapLocal.set(row.staffId, existing);
    }

    // Compute ordered list of calendar months covered by the selected range
    function getMonthsInRange(from: string, to: string): string[] {
      const months: string[] = [];
      let y = parseInt(from.slice(0, 4), 10);
      let mo = parseInt(from.slice(5, 7), 10);
      const toY  = parseInt(to.slice(0, 4), 10);
      const toMo = parseInt(to.slice(5, 7), 10);
      while (y < toY || (y === toY && mo <= toMo)) {
        months.push(`${y}-${String(mo).padStart(2, "0")}`);
        mo++;
        if (mo > 12) { mo = 1; y++; }
      }
      return months;
    }
    const monthsInRange = getMonthsInRange(rawFrom, rawTo);

    // Enrich with empCode
    const staffIds = [...staffMapLocal.keys()];
    const staffDetails = staffIds.length
      ? await db
          .select({ id: staffTable.id, empCode: staffTable.empCode })
          .from(staffTable)
          .where(inArray(staffTable.id, staffIds))
      : [];
    const empCodeMap = new Map(staffDetails.map(s => [s.id, s.empCode ?? ""]));

    const staffBreakdown = [...staffMapLocal.values()]
      .map(s => ({
        staffName:   s.staffName,
        empCode:     empCodeMap.get(s.staffId) ?? "",
        checkInDays: s.days.size,
        monthDays:   s.monthDays,
      }))
      .sort((a, b) => b.checkInDays - a.checkInDays || a.staffName.localeCompare(b.staffName));

    const totalCheckInDays = staffBreakdown.reduce((sum, s) => sum + s.checkInDays, 0);
    const uniqueStaff      = staffBreakdown.length;
    const avgDaysPerStaff  = uniqueStaff > 0 ? Math.round((totalCheckInDays / uniqueStaff) * 10) / 10 : 0;

    // ── Build Excel workbook ─────────────────────────────────────────────────
    const TEAL     = "FF0F766E";
    const TEAL_DK  = "FF0D9488";
    const A_COLS   = 3;

    const wb = new ExcelJS.Workbook();
    wb.creator = "JSDMS Field Force Manager";
    wb.created = new Date();

    const ws = wb.addWorksheet("Attendance Summary", { properties: { tabColor: { argb: TEAL } } });
    ws.columns = [
      { width: 28 }, // Staff Name
      { width: 14 }, // EMP ID
      { width: 18 }, // Check-In Days
    ];

    const staffPart = staffNameHdr ? `Staff: ${staffNameHdr}   |   ` : "";
    const orgLine   = organization ?? "Jharkhand Skill Development Mission Society (JSDMS) / DDU-KK";

    // Row 1 — Org header
    ws.mergeCells(1, 1, 1, A_COLS);
    const r1 = ws.getCell(1, 1);
    r1.value = orgLine;
    r1.font  = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
    r1.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    r1.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 26;

    // Row 2 — Report title
    ws.mergeCells(2, 1, 2, A_COLS);
    const r2 = ws.getCell(2, 1);
    r2.value = "STAFF-WISE ATTENDANCE SUMMARY";
    r2.font  = { bold: true, size: 14, color: { argb: AMBER }, name: "Calibri" };
    r2.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    r2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 26;

    // Row 3 — Period / filter info
    ws.mergeCells(3, 1, 3, A_COLS);
    const r3 = ws.getCell(3, 1);
    r3.value = `${staffPart}Period: ${rawFrom}  →  ${rawTo}   |   ${uniqueStaff} staff   |   ${totalCheckInDays} total check-in days`;
    r3.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    r3.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_DK } };
    r3.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(3).height = 18;

    // Row 4 — Summary stats block
    const summaryItems = [
      ["Unique Staff", String(uniqueStaff)],
      ["Total Check-In Days", String(totalCheckInDays)],
      ["Avg Days / Staff", String(avgDaysPerStaff)],
    ];
    ws.getRow(4).height = 8;
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

    // Spacer row
    ws.getRow(8).height = 8;

    // Row 9 — Column headers
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

    // Data rows starting at row 10
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

    // Totals footer
    const ftRow = ws.getRow(dataRowNum);
    ftRow.height = 18;
    const ftLabel = ftRow.getCell(1);
    ftLabel.value = `TOTAL  (${uniqueStaff} staff,  avg ${avgDaysPerStaff} days/staff)`;
    ftLabel.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    ftLabel.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    ftLabel.alignment = { horizontal: "left", vertical: "middle" };

    const ftEmp = ftRow.getCell(2);
    ftEmp.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };

    const ftDays = ftRow.getCell(3);
    ftDays.value = totalCheckInDays;
    ftDays.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    ftDays.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    ftDays.alignment = { horizontal: "center", vertical: "middle" };

    // ── Build "Monthly Breakdown" worksheet ──────────────────────────────────
    const TEAL_MB = "FF0F766E";
    const MB_COLS = 2 + monthsInRange.length + 1; // Staff Name + EMP ID + months + Total

    const wsM = wb.addWorksheet("Monthly Breakdown", { properties: { tabColor: { argb: TEAL_MB } } });

    // Column widths: Staff Name (28), EMP ID (14), one per month (12), Total (12)
    wsM.columns = [
      { width: 28 },
      { width: 14 },
      ...monthsInRange.map(() => ({ width: 12 })),
      { width: 12 },
    ];

    // Helper: format "YYYY-MM" → "Mon YYYY" (e.g. "2025-04" → "Apr 2025")
    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function fmtMonth(ym: string): string {
      const y = ym.slice(0, 4);
      const m = parseInt(ym.slice(5, 7), 10) - 1;
      return `${MONTH_NAMES[m]} ${y}`;
    }

    // Row 1 — Org header
    wsM.mergeCells(1, 1, 1, MB_COLS);
    const mr1 = wsM.getCell(1, 1);
    mr1.value = orgLine;
    mr1.font  = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
    mr1.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_MB } };
    mr1.alignment = { horizontal: "center", vertical: "middle" };
    wsM.getRow(1).height = 26;

    // Row 2 — Report title
    wsM.mergeCells(2, 1, 2, MB_COLS);
    const mr2 = wsM.getCell(2, 1);
    mr2.value = "STAFF ATTENDANCE — MONTHLY BREAKDOWN";
    mr2.font  = { bold: true, size: 14, color: { argb: AMBER }, name: "Calibri" };
    mr2.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_MB } };
    mr2.alignment = { horizontal: "center", vertical: "middle" };
    wsM.getRow(2).height = 26;

    // Row 3 — Period info
    wsM.mergeCells(3, 1, 3, MB_COLS);
    const mr3 = wsM.getCell(3, 1);
    mr3.value = `${staffPart}Period: ${rawFrom}  →  ${rawTo}   |   ${uniqueStaff} staff   |   ${monthsInRange.length} month(s)`;
    mr3.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    mr3.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };
    mr3.alignment = { horizontal: "center", vertical: "middle" };
    wsM.getRow(3).height = 18;

    // Spacer
    wsM.getRow(4).height = 8;

    // Row 5 — Column headers
    const mHRow = wsM.getRow(5);
    mHRow.height = 30;
    const mHeaders = ["Staff Name", "EMP ID", ...monthsInRange.map(fmtMonth), "Total"];
    mHeaders.forEach((h, ci) => {
      const cell = mHRow.getCell(ci + 1);
      cell.value = h;
      cell.font  = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_MB } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: AMBER } } };
    });

    // Data rows starting at row 6
    const mAltFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: LGRAY } };
    let mDataRow = 6;
    // Monthly column totals accumulator
    const monthTotals = new Array<number>(monthsInRange.length).fill(0);

    for (const [idx, s] of staffBreakdown.entries()) {
      const dr = wsM.getRow(mDataRow);
      dr.height = 16;
      const isAlt = idx % 2 === 1;

      // Staff Name (col 1)
      const nameCell = dr.getCell(1);
      nameCell.value = s.staffName;
      nameCell.font  = { size: 9, name: "Calibri", color: { argb: "FF111827" } };
      nameCell.alignment = { horizontal: "left", vertical: "middle" };
      if (isAlt) nameCell.fill = mAltFill;
      nameCell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };

      // EMP ID (col 2)
      const empCell = dr.getCell(2);
      empCell.value = s.empCode;
      empCell.font  = { size: 9, name: "Calibri", color: { argb: "FF111827" } };
      empCell.alignment = { horizontal: "center", vertical: "middle" };
      if (isAlt) empCell.fill = mAltFill;
      empCell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };

      // One column per month
      let rowTotal = 0;
      for (let mi = 0; mi < monthsInRange.length; mi++) {
        const month = monthsInRange[mi]!;
        const days  = s.monthDays.get(month)?.size ?? 0;
        rowTotal += days;
        monthTotals[mi]! += days;
        const mc = dr.getCell(3 + mi);
        mc.value = days > 0 ? days : "";
        mc.font  = { size: 9, name: "Calibri", color: { argb: days > 0 ? "FF111827" : "FFD1D5DB" } };
        mc.alignment = { horizontal: "center", vertical: "middle" };
        if (isAlt) mc.fill = mAltFill;
        mc.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
      }

      // Total (last col)
      const totalCol = 3 + monthsInRange.length;
      const totCell  = dr.getCell(totalCol);
      totCell.value  = rowTotal;
      totCell.font   = { bold: true, size: 9, name: "Calibri", color: { argb: TEAL_MB } };
      totCell.alignment = { horizontal: "center", vertical: "middle" };
      if (isAlt) totCell.fill = mAltFill;
      totCell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };

      mDataRow++;
    }

    // Footer totals row
    const ftMRow  = wsM.getRow(mDataRow);
    ftMRow.height = 18;

    // Label spanning cols 1-2
    wsM.mergeCells(mDataRow, 1, mDataRow, 2);
    const ftMLabel = ftMRow.getCell(1);
    ftMLabel.value = `MONTHLY TOTALS  (${uniqueStaff} staff)`;
    ftMLabel.font  = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
    ftMLabel.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_MB } };
    ftMLabel.alignment = { horizontal: "center", vertical: "middle" };

    // One total per month
    let grandTotal = 0;
    for (let mi = 0; mi < monthsInRange.length; mi++) {
      const mt = monthTotals[mi]!;
      grandTotal += mt;
      const mc = ftMRow.getCell(3 + mi);
      mc.value = mt;
      mc.font  = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
      mc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_MB } };
      mc.alignment = { horizontal: "center", vertical: "middle" };
    }

    // Grand total (last col)
    const ftGrandCell = ftMRow.getCell(3 + monthsInRange.length);
    ftGrandCell.value = grandTotal;
    ftGrandCell.font  = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
    ftGrandCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_MB } };
    ftGrandCell.alignment = { horizontal: "center", vertical: "middle" };

    // Stream response
    const suffix = staffNameHdr ? `-${staffNameHdr.replace(/\s+/g, "-")}` : "-all-staff";
    const fname  = `attendance-summary-${rawFrom}-to-${rawTo}${suffix}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/reports/attendance-summary ─────────────────────────────
// Returns a lightweight staff-wise attendance count summary (no Excel needed).
// Query params: from (YYYY-MM-DD), to (YYYY-MM-DD), staffId? (optional)
router.get("/admin/reports/attendance-summary", requireAdmin, async (req, res, next) => {
  try {
    const rawFrom    = req.query.from    as string | undefined;
    const rawTo      = req.query.to      as string | undefined;
    const rawStaffId = req.query.staffId as string | undefined;
    const rawCompanyId = (res.locals.companyId as string | null) ?? null;

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (!rawFrom || !DATE_RE.test(rawFrom) || !rawTo || !DATE_RE.test(rawTo)) {
      res.status(400).json({ title: "`from` and `to` are required (YYYY-MM-DD)", status: 400 });
      return;
    }

    const startOfFrom = new Date(`${rawFrom}T00:00:00.000Z`);
    const endOfTo     = new Date(`${rawTo}T23:59:59.999Z`);

    const conds = [
      eq(activityEventsTable.kind, "checkin"),
      gte(activityEventsTable.occurredAt, startOfFrom),
      lt(activityEventsTable.occurredAt, new Date(endOfTo.getTime() + 1)),
    ] as ReturnType<typeof eq>[];
    if (rawStaffId)   conds.push(eq(activityEventsTable.staffId, rawStaffId));
    if (rawCompanyId) conds.push(eq(activityEventsTable.companyId, rawCompanyId));

    const checkinRows = await db
      .select({
        staffId:   activityEventsTable.staffId,
        staffName: activityEventsTable.staffName,
        occurredAt: activityEventsTable.occurredAt,
      })
      .from(activityEventsTable)
      .where(and(...conds))
      .orderBy(activityEventsTable.occurredAt);

    // Count distinct check-in days per staff
    type StaffSummary = { staffId: string; staffName: string; days: Set<string> };
    const staffMap = new Map<string, StaffSummary>();
    for (const row of checkinRows) {
      const date = toIST(new Date(row.occurredAt as Date));
      const existing = staffMap.get(row.staffId) ?? { staffId: row.staffId, staffName: row.staffName, days: new Set() };
      existing.days.add(date);
      staffMap.set(row.staffId, existing);
    }

    // Enrich with empCode from staff table
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
        staffId:   s.staffId,
        staffName: s.staffName,
        empCode:   empCodeMap.get(s.staffId) ?? "",
        checkInDays: s.days.size,
      }))
      .sort((a, b) => b.checkInDays - a.checkInDays || a.staffName.localeCompare(b.staffName));

    const totalCheckInDays = staffBreakdown.reduce((sum, s) => sum + s.checkInDays, 0);
    const uniqueStaff      = staffBreakdown.length;
    const avgDaysPerStaff  = uniqueStaff > 0
      ? Math.round((totalCheckInDays / uniqueStaff) * 10) / 10
      : 0;

    res.json({
      from:           rawFrom,
      to:             rawTo,
      uniqueStaff,
      totalCheckInDays,
      avgDaysPerStaff,
      staffBreakdown,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
