import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { staffTable } from "./staff";

export const attendanceCorrectionsTable = pgTable("attendance_corrections", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staffTable.id, { onDelete: "cascade" }),
  /** YYYY-MM-DD date of the attendance being corrected */
  date: text("date").notNull(),
  originalCheckin: text("original_checkin"),
  originalCheckout: text("original_checkout"),
  correctedCheckin: text("corrected_checkin"),
  correctedCheckout: text("corrected_checkout"),
  reason: text("reason").notNull(),
  correctedBy: uuid("corrected_by").references(() => staffTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AttendanceCorrection = typeof attendanceCorrectionsTable.$inferSelect;
export type InsertAttendanceCorrection = typeof attendanceCorrectionsTable.$inferInsert;
