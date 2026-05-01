import { activityEventsTable, companiesTable, db, staffTable } from "@workspace/db";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import ExcelJS from "exceljs";
import { Router } from "express";

const router = Router();

type ActivityPayload = {
  location?: { latitude: number; longitude: number } | null;
  reading?: number | null;
  consumerNo?: string | null;
  distanceKm?: number | null;
  durationSec?: number | null;
  origin?: { latitude: number; longitude: number } | null;
  destination?: { latitude: number; longitude: number } | null;
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

router.get("/admin/reports/rides/xlsx", async (req, res, next) => {
  try {
    const rawFrom       = req.query.from         as string | undefined;
    const rawTo         = req.query.to           as string | undefined;
    const rawStaffId    = req.query.staffId      as string | undefined;
    const reportType    = (req.query.reportType  as string | undefined) ?? "daily";
    const rawCompanyId  = (req.query.companyId   as string | undefined)?.trim() || null;
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

    // ── 4. Fetch meter events for matching staff in range ─────────────────────
    const meterConds = [
      eq(activityEventsTable.kind, "meter"),
      gte(activityEventsTable.occurredAt, startOfFrom),
      lt(activityEventsTable.occurredAt, new Date(endOfTo.getTime() + 1)),
    ] as ReturnType<typeof eq>[];
    if (rawStaffId)   meterConds.push(eq(activityEventsTable.staffId, rawStaffId));
    else if (uniqueIds.length) meterConds.push(inArray(activityEventsTable.staffId, uniqueIds));
    if (rawCompanyId) meterConds.push(eq(activityEventsTable.companyId, rawCompanyId));

    const meterRows = completed.length
      ? await db
          .select()
          .from(activityEventsTable)
          .where(and(...meterConds))
          .orderBy(activityEventsTable.occurredAt)
      : [];

    // For each trip, find nearest meter event before start (start reading)
    // and nearest meter event after end (end reading) within 90 min window.
    const WINDOW_MS = 90 * 60 * 1000;

    // ── 5. Build rows ─────────────────────────────────────────────────────────
    type ReportRow = {
      staffName: string;
      empCode: string;
      mobile: string;
      date: string;
      startMeter: number | null;
      endMeter: number | null;
      totalKm: number | null;
      startTime: string;
      endTime: string;
      startLocation: string;
      endLocation: string;
      reportType: string;
    };

    const rows: ReportRow[] = [];

    for (const { start, end } of completed) {
      const startPayload = (start.payload || {}) as ActivityPayload;
      const endPayload   = (end.payload   || {}) as ActivityPayload;
      const staff        = staffMap.get(start.staffId);
      const startAt      = new Date(start.occurredAt as Date);
      const endAt        = new Date(end.occurredAt   as Date);

      const distanceKm = typeof endPayload.distanceKm === "number" ? endPayload.distanceKm : null;

      // Find nearest meter event for this staff BEFORE trip start (within window)
      const metersBefore = meterRows.filter(m =>
        m.staffId === start.staffId &&
        new Date(m.occurredAt as Date) <= startAt &&
        new Date(m.occurredAt as Date) >= new Date(startAt.getTime() - WINDOW_MS),
      ).sort((a, b) => new Date(b.occurredAt as Date).getTime() - new Date(a.occurredAt as Date).getTime());
      const startMeterEvent = metersBefore[0];
      const startMeter = startMeterEvent
        ? ((startMeterEvent.payload as ActivityPayload).reading ?? null)
        : null;

      // Find nearest meter event for this staff AFTER trip end (within window)
      const metersAfter = meterRows.filter(m =>
        m.staffId === start.staffId &&
        new Date(m.occurredAt as Date) >= endAt &&
        new Date(m.occurredAt as Date) <= new Date(endAt.getTime() + WINDOW_MS),
      ).sort((a, b) => new Date(a.occurredAt as Date).getTime() - new Date(b.occurredAt as Date).getTime());
      const endMeterEvent = metersAfter[0];
      const endMeter = endMeterEvent
        ? ((endMeterEvent.payload as ActivityPayload).reading ?? null)
        : null;

      // Validation: skip if both readings exist but end < start (invalid)
      if (startMeter !== null && endMeter !== null && endMeter < startMeter) continue;

      rows.push({
        staffName:     start.staffName,
        empCode:       staff?.empCode ?? "",
        mobile:        staff?.phone   ?? "",
        date:          toIST(startAt),
        startMeter,
        endMeter,
        totalKm:       distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
        startTime:     toISTTime(startAt),
        endTime:       toISTTime(endAt),
        startLocation: coordStr(startPayload, "origin") || coordStr(startPayload, "location"),
        endLocation:   coordStr(endPayload, "destination") || coordStr(endPayload, "location"),
        reportType:    reportType.charAt(0).toUpperCase() + reportType.slice(1),
      });
    }

    // Sort by date then staff name
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));

    // ── 6. Build summary ─────────────────────────────────────────────────────
    const totalStaff = new Set(rows.map(r => r.empCode || r.staffName)).size;
    const totalRides = rows.length;
    const totalKmAll = rows.reduce((s, r) => s + (r.totalKm ?? 0), 0);

    // Per-staff totals map: staffName → totalKm
    const staffTotals = new Map<string, { empCode: string; mobile: string; km: number; rides: number }>();
    for (const r of rows) {
      const key = r.staffName;
      const prev = staffTotals.get(key) ?? { empCode: r.empCode, mobile: r.mobile, km: 0, rides: 0 };
      staffTotals.set(key, { ...prev, km: prev.km + (r.totalKm ?? 0), rides: prev.rides + 1 });
    }

    // ── 7. Build Excel workbook ───────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "JSDMS Field Force Manager";
    wb.created = new Date();

    const ws = wb.addWorksheet("Ride Report", { properties: { tabColor: { argb: NAVY } } });

    // Column widths
    ws.columns = [
      { width: 22 }, // Staff Name
      { width: 13 }, // EMP ID
      { width: 14 }, // Mobile
      { width: 12 }, // Date
      { width: 16 }, // Start Meter
      { width: 16 }, // End Meter
      { width: 10 }, // Total KM
      { width: 12 }, // Start Time
      { width: 12 }, // End Time
      { width: 28 }, // Start Location
      { width: 28 }, // End Location
      { width: 12 }, // Report Type
    ];

    const COL_COUNT = 12;

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

    const staffPart = staffNameHdr ? `Staff: ${staffNameHdr}   |   ` : "";
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
      "Start Meter\nReading", "End Meter\nReading", "Total KM",
      "Ride Start\nTime", "Ride End\nTime",
      "Start Location", "End Location", "Report Type",
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

      const cells = [
        r.staffName,
        r.empCode,
        r.mobile,
        r.date,
        r.startMeter ?? "",
        r.endMeter   ?? "",
        r.totalKm !== null ? r.totalKm : "",
        r.startTime,
        r.endTime,
        r.startLocation,
        r.endLocation,
        r.reportType,
      ];
      cells.forEach((val, ci) => {
        const cell = dr.getCell(ci + 1);
        cell.value = val;
        cell.font  = { size: 9, name: "Calibri" };
        cell.alignment = { horizontal: ci >= 4 && ci <= 6 ? "center" : "left", vertical: "middle" };
        if (rowFill) cell.fill = rowFill;
        cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
      });
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

    // ── 8. Stream response ────────────────────────────────────────────────────
    const fname = `ride-report-${rawFrom}-to-${rawTo}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    next(err);
  }
});

export default router;
