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
import { sendEmailWithAttachment } from "../lib/email";
import { logger } from "../lib/logger";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toIST(d: Date): string {
  const offset = 5.5 * 60 * 60 * 1000;
  const local = new Date(d.getTime() + offset);
  return local.toISOString().slice(0, 10);
}

// ─── Build attendance summary Excel buffer ────────────────────────────────────

export async function buildAttendanceSummaryXlsx(opts: {
  companyId: string | null;
  organization: string | null;
  from: string;
  to: string;
}): Promise<{ buffer: Buffer; filename: string }> {
  const { companyId, from, to } = opts;

  const NAVY  = "FF1A3560";
  const AMBER = "FFF59E0B";
  const WHITE = "FFFFFFFF";
  const LGRAY = "FFF3F4F6";
  const DKGRAY = "FF374151";
  const TEAL   = "FF0F766E";
  const TEAL_DK = "FF0D9488";

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

// ─── Build and send ───────────────────────────────────────────────────────────

export async function buildAndSendAttendanceSummary(opts: {
  companyId: string | null;
  organization: string | null;
  from: string;
  to: string;
  recipients: string[];
}): Promise<void> {
  const { buffer, filename } = await buildAttendanceSummaryXlsx(opts);

  const orgName = opts.organization ?? "JSDMS";
  const subject = `Attendance Summary Report — ${opts.from} to ${opts.to} | ${orgName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; max-width: 600px; margin: 0 auto;">
      <div style="background: #0F766E; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #fff; margin: 0; font-size: 18px;">Attendance Summary Report</h2>
        <p style="color: #A7F3D0; margin: 4px 0 0; font-size: 13px;">${orgName}</p>
      </div>
      <div style="background: #F9FAFB; padding: 20px 24px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 12px; font-size: 14px;">
          Please find the <strong>Attendance Summary</strong> report attached for the period
          <strong>${opts.from}</strong> to <strong>${opts.to}</strong>.
        </p>
        <p style="margin: 0 0 12px; font-size: 13px; color: #6B7280;">
          This report was automatically generated and sent by the JSDMS Field Force Manager.
        </p>
        <p style="margin: 0; font-size: 13px; color: #9CA3AF;">
          Generated on ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} at ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST
        </p>
      </div>
    </div>
  `;

  await sendEmailWithAttachment({
    to: opts.recipients,
    subject,
    html,
    attachmentBuffer: buffer,
    attachmentFilename: filename,
  });
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

  // monthly — last 30 days
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { from: monthAgo, to: today };
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

export function startReportScheduler(): void {
  // Run at the top of every hour
  cron.schedule("0 * * * *", async () => {
    const nowUtc = new Date();
    const currentHourUtc = nowUtc.getUTCHours();
    const currentDow = nowUtc.getUTCDay(); // 0 = Sun
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

          // Resolve company name
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

          // Optimistic-lock: only proceed if lastSentAt hasn't changed since we read it.
          // This prevents duplicate sends when multiple server instances run the cron.
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

          try {
            await buildAndSendAttendanceSummary({
              companyId: schedule.companyId ?? null,
              organization,
              from,
              to,
              recipients: schedule.recipients,
            });

            logger.info(
              { scheduleId: schedule.id, recipients: schedule.recipients, from, to },
              "Scheduled attendance report sent",
            );
          } catch (sendErr) {
            // Roll back the claim so it can retry next hour
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
