import { db, reportSchedulesTable, companiesTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { Router } from "express";
import { requireAdmin } from "./admin";
import { isEmailConfigured } from "../lib/email";
import { buildAndSendAttendanceSummary } from "../services/reportScheduler";

const router = Router();

// ─── GET /api/admin/report-schedule ─────────────────────────────────────────
// Returns the current schedule config for this admin's company.

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
// Create or update the schedule for this company.

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
    } = req.body as {
      frequency?: "daily" | "weekly" | "monthly";
      recipients?: string[];
      enabled?: boolean;
      dayOfWeek?: number | null;
      dayOfMonth?: number | null;
      hourUtc?: number;
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
// Disable (soft-delete) the schedule.

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
// Manually trigger an immediate send for this company's schedule.

router.post("/admin/report-schedule/send-now", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { recipients } = req.body as { recipients?: string[] };

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

    // Resolve organization name
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

    // Last 30 days
    const to = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await buildAndSendAttendanceSummary({
      companyId,
      organization,
      from: fromDate,
      to,
      recipients,
    });

    res.json({ success: true, sentTo: recipients });
  } catch (err) {
    next(err);
  }
});

export default router;
