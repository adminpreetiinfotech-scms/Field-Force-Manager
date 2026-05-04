import { db, reportSchedulesTable, reportDeliveryLogsTable, companiesTable } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Router } from "express";
import { requireAdmin } from "./admin";
import { isEmailConfigured } from "../lib/email";
import { buildAndSendScheduledReports, type ReportType } from "../services/reportScheduler";

const router = Router();

const VALID_REPORT_TYPES: ReportType[] = ["attendance", "rideReport", "vehicleKm"];

// ─── GET /api/admin/report-schedule ─────────────────────────────────────────

router.get("/admin/report-schedule", requireAdmin, async (_req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;

    const cond = companyId
      ? eq(reportSchedulesTable.companyId, companyId)
      : isNull(reportSchedulesTable.companyId);

    const [row] = await db
      .select()
      .from(reportSchedulesTable)
      .where(cond)
      .limit(1);

    res.json({
      schedule: row ?? null,
      emailConfigured: isEmailConfigured(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/admin/report-schedule ─────────────────────────────────────────

router.put("/admin/report-schedule", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;

    const {
      frequency,
      recipients,
      enabled,
      dayOfWeek,
      dayOfMonth,
      hourUtc,
      reportTypes,
    } = req.body as {
      frequency?: "daily" | "weekly" | "monthly";
      recipients?: string[];
      enabled?: boolean;
      dayOfWeek?: number | null;
      dayOfMonth?: number | null;
      hourUtc?: number;
      reportTypes?: string[];
    };

    if (!frequency || !["daily", "weekly", "monthly"].includes(frequency)) {
      res.status(400).json({ title: "frequency must be daily, weekly, or monthly", status: 400 });
      return;
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ title: "at least one recipient email is required", status: 400 });
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const r of recipients) {
      if (!emailRe.test(r.trim())) {
        res.status(400).json({ title: `Invalid email: ${r}`, status: 400 });
        return;
      }
    }
    if (hourUtc !== undefined && (hourUtc < 0 || hourUtc > 23)) {
      res.status(400).json({ title: "hourUtc must be 0–23", status: 400 });
      return;
    }
    if (frequency === "weekly" && (dayOfWeek === undefined || dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6)) {
      res.status(400).json({ title: "dayOfWeek (0–6) required for weekly frequency", status: 400 });
      return;
    }
    if (frequency === "monthly" && (dayOfMonth === undefined || dayOfMonth === null || dayOfMonth < 1 || dayOfMonth > 28)) {
      res.status(400).json({ title: "dayOfMonth (1–28) required for monthly frequency", status: 400 });
      return;
    }

    const resolvedReportTypes: ReportType[] = Array.isArray(reportTypes) && reportTypes.length > 0
      ? reportTypes.filter((t): t is ReportType => VALID_REPORT_TYPES.includes(t as ReportType))
      : ["attendance"];

    if (resolvedReportTypes.length === 0) {
      res.status(400).json({ title: "at least one report type must be selected", status: 400 });
      return;
    }

    const cond = companyId
      ? eq(reportSchedulesTable.companyId, companyId)
      : isNull(reportSchedulesTable.companyId);

    const [existing] = await db
      .select({ id: reportSchedulesTable.id })
      .from(reportSchedulesTable)
      .where(cond)
      .limit(1);

    const values = {
      frequency,
      recipients: recipients.map((r) => r.trim()),
      enabled: enabled ?? true,
      dayOfWeek: frequency === "weekly" ? (dayOfWeek ?? null) : null,
      dayOfMonth: frequency === "monthly" ? (dayOfMonth ?? null) : null,
      hourUtc: hourUtc ?? 2,
      reportTypes: resolvedReportTypes,
      updatedAt: new Date(),
    };

    let row;
    if (existing) {
      [row] = await db
        .update(reportSchedulesTable)
        .set(values)
        .where(eq(reportSchedulesTable.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(reportSchedulesTable)
        .values({ ...values, companyId: companyId ?? undefined })
        .returning();
    }

    res.json({ schedule: row });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/report-schedule ───────────────────────────────────────

router.delete("/admin/report-schedule", requireAdmin, async (_req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const cond = companyId
      ? eq(reportSchedulesTable.companyId, companyId)
      : isNull(reportSchedulesTable.companyId);

    await db
      .update(reportSchedulesTable)
      .set({ enabled: false, updatedAt: new Date() })
      .where(cond);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/report-schedule/send-now ────────────────────────────────

router.post("/admin/report-schedule/send-now", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { recipients, reportTypes } = req.body as {
      recipients?: string[];
      reportTypes?: string[];
    };

    if (!isEmailConfigured()) {
      res.status(503).json({
        title: "Email not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.",
        status: 503,
      });
      return;
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ title: "recipients required", status: 400 });
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const r of recipients) {
      if (!emailRe.test(r.trim())) {
        res.status(400).json({ title: `Invalid email: ${r}`, status: 400 });
        return;
      }
    }

    const resolvedReportTypes: ReportType[] = Array.isArray(reportTypes) && reportTypes.length > 0
      ? reportTypes.filter((t): t is ReportType => VALID_REPORT_TYPES.includes(t as ReportType))
      : ["attendance"];

    if (resolvedReportTypes.length === 0) {
      res.status(400).json({ title: "At least one valid report type is required", status: 400 });
      return;
    }

    let organization: string | null = null;
    if (companyId) {
      try {
        const [co] = await db
          .select({ name: companiesTable.name, projectName: companiesTable.projectName })
          .from(companiesTable)
          .where(eq(companiesTable.id, companyId))
          .limit(1);
        if (co) {
          organization = co.projectName ? `${co.name} — ${co.projectName}` : co.name;
        }
      } catch { /* non-fatal */ }
    }

    const to = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const cond = companyId
      ? eq(reportSchedulesTable.companyId, companyId)
      : isNull(reportSchedulesTable.companyId);
    const [existingSchedule] = await db
      .select({ id: reportSchedulesTable.id })
      .from(reportSchedulesTable)
      .where(cond)
      .limit(1);

    await buildAndSendScheduledReports({
      companyId,
      organization,
      from: fromDate,
      to,
      recipients,
      reportTypes: resolvedReportTypes,
      scheduleId: existingSchedule?.id ?? null,
      triggeredBy: "manual",
    });

    res.json({ success: true, sentTo: recipients, reportTypes: resolvedReportTypes });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/report-schedule/delivery-history ─────────────────────────

router.get("/admin/report-schedule/delivery-history", requireAdmin, async (_req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;

    const cond = companyId
      ? eq(reportDeliveryLogsTable.companyId, companyId)
      : isNull(reportDeliveryLogsTable.companyId);

    const rows = await db
      .select()
      .from(reportDeliveryLogsTable)
      .where(cond)
      .orderBy(desc(reportDeliveryLogsTable.sentAt))
      .limit(10);

    res.json({ history: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
