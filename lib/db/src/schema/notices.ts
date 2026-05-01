import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { companiesTable } from "./companies";
import { staffTable } from "./staff";

export const noticesTable = pgTable("notices", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: text("priority", {
    enum: ["normal", "important", "urgent"],
  }).notNull().default("normal"),
  type: text("type", {
    enum: ["notice", "alert", "reminder"],
  }).notNull().default("notice"),
  targetType: text("target_type", {
    enum: ["all", "specific"],
  }).notNull().default("all"),
  createdBy: uuid("created_by").references(() => staffTable.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const noticeRecipientsTable = pgTable("notice_recipients", {
  id: uuid("id").defaultRandom().primaryKey(),
  noticeId: uuid("notice_id")
    .notNull()
    .references(() => noticesTable.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staffTable.id, { onDelete: "cascade" }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
  acknowledged: boolean("acknowledged").notNull().default(false),
});

export type Notice = typeof noticesTable.$inferSelect;
export type InsertNotice = typeof noticesTable.$inferInsert;
export type NoticeRecipient = typeof noticeRecipientsTable.$inferSelect;
