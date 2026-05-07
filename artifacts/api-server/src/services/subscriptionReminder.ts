import cron from "node-cron";
import { companiesTable, db, staffTable } from "@workspace/db";
import { and, eq, isNull, isNotNull, lte, gte, sql } from "drizzle-orm";
import { sendSmsSilent } from "../lib/twilio";
import { logger } from "../lib/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

const REMINDER_DAYS = [7, 3, 1];

// ─── Core reminder logic ──────────────────────────────────────────────────────

export async function runSubscriptionReminders(): Promise<{
  checked: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  const now = new Date();

  // Find companies with a subscriptionEndDate in the future (not yet expired)
  // and phone number set, and subscriptionActive = true
  const companies = await db
    .select({
      id: companiesTable.id,
      name: companiesTable.name,
      phone: companiesTable.phone,
      plan: companiesTable.plan,
      subscriptionEndDate: companiesTable.subscriptionEndDate,
      subscriptionReminderSentAt: companiesTable.subscriptionReminderSentAt,
    })
    .from(companiesTable)
    .where(
      and(
        isNotNull(companiesTable.subscriptionEndDate),
        isNotNull(companiesTable.phone),
        eq(companiesTable.subscriptionActive, true),
        eq(companiesTable.status, "active"),
      ),
    );

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const company of companies) {
    try {
      if (!company.subscriptionEndDate || !company.phone) {
        skipped++;
        continue;
      }

      const daysLeft = Math.ceil(
        (company.subscriptionEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Only send for configured reminder days (7, 3, 1)
      if (!REMINDER_DAYS.includes(daysLeft)) {
        skipped++;
        continue;
      }

      // Check if we already sent a reminder for this exact day window
      // to avoid duplicate SMS if the scheduler runs more than once per day
      if (company.subscriptionReminderSentAt) {
        const lastSentDaysAgo = Math.floor(
          (now.getTime() - company.subscriptionReminderSentAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (lastSentDaysAgo < 1) {
          skipped++;
          continue;
        }
      }

      // Also try to get the admin's phone number for the company
      const [admin] = await db
        .select({ phone: staffTable.phone, name: staffTable.name })
        .from(staffTable)
        .where(
          and(
            eq(staffTable.companyId, company.id),
            eq(staffTable.role, "admin"),
            isNull(staffTable.deletedAt),
            isNull(staffTable.disabledAt),
          ),
        )
        .limit(1);

      const planLabel = company.plan
        ? company.plan.charAt(0).toUpperCase() + company.plan.slice(1)
        : "Current";

      const expireDate = company.subscriptionEndDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const smsBody =
        `SCMS Alert: ${company.name} ka ${planLabel} plan ${daysLeft} din mein expire hoga (${expireDate}). ` +
        `Renewal ke liye apne SCMS Ops admin se contact karein. -SCMS Platform`;

      // Send to company phone
      await sendSmsSilent(company.phone, smsBody, (msg) =>
        logger.warn({ companyId: company.id, msg }, "SMS to company phone failed"),
      );

      // Also send to admin phone if different
      if (admin?.phone && admin.phone !== company.phone) {
        const adminSms =
          `SCMS Alert: Aapki company ${company.name} ka subscription ${daysLeft} din mein expire ho raha hai (${expireDate}). ` +
          `Renewal ke liye super admin se sampark karein.`;
        await sendSmsSilent(admin.phone, adminSms, (msg) =>
          logger.warn({ companyId: company.id, adminPhone: admin.phone, msg }, "SMS to admin phone failed"),
        );
      }

      // Mark reminder as sent
      await db
        .update(companiesTable)
        .set({ subscriptionReminderSentAt: now })
        .where(eq(companiesTable.id, company.id));

      logger.info(
        {
          companyId: company.id,
          companyName: company.name,
          daysLeft,
          phone: company.phone,
          adminPhone: admin?.phone ?? null,
        },
        "Subscription reminder SMS sent",
      );

      sent++;
    } catch (err) {
      logger.error({ err, companyId: company.id }, "Failed to send subscription reminder");
      errors++;
    }
  }

  return { checked: companies.length, sent, skipped, errors };
}

// ─── Scheduler: runs daily at 9 AM UTC (2:30 PM IST) ────────────────────────

export function startSubscriptionReminderScheduler(): void {
  // Run at 9:00 AM UTC every day
  cron.schedule("0 9 * * *", async () => {
    logger.info("Subscription reminder check started");
    try {
      const result = await runSubscriptionReminders();
      logger.info(result, "Subscription reminder check completed");
    } catch (err) {
      logger.error({ err }, "Subscription reminder scheduler error");
    }
  });

  logger.info("Subscription reminder scheduler started (daily at 09:00 UTC)");
}
