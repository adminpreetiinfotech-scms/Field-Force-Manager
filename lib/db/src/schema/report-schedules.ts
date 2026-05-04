import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companiesTable } from "./companies";

export const reportSchedulesTable = pgTable(
  "report_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "cascade" }),
    frequency: text("frequency", { enum: ["daily", "weekly", "monthly"] }).notNull(),
    recipients: text("recipients").array().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    dayOfWeek: integer("day_of_week"),
    dayOfMonth: integer("day_of_month"),
    hourUtc: integer("hour_utc").notNull().default(2),
    reportTypes: text("report_types").array().notNull().default(sql`ARRAY['attendance']::text[]`),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("report_schedules_company_id_unique").on(
      sql`COALESCE(${table.companyId}::text, '__global__')`,
    ),
  ],
);

export type ReportSchedule = typeof reportSchedulesTable.$inferSelect;
export type InsertReportSchedule = typeof reportSchedulesTable.$inferInsert;

export const reportDeliveryLogsTable = pgTable("report_delivery_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  scheduleId: uuid("schedule_id").references(() => reportSchedulesTable.id, { onDelete: "set null" }),
  companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  reportTypes: text("report_types").array().notNull().default([]),
  recipients: text("recipients").array().notNull().default([]),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  triggeredBy: text("triggered_by", { enum: ["scheduler", "manual"] }).notNull().default("scheduler"),
});

export type ReportDeliveryLog = typeof reportDeliveryLogsTable.$inferSelect;
export type InsertReportDeliveryLog = typeof reportDeliveryLogsTable.$inferInsert;
