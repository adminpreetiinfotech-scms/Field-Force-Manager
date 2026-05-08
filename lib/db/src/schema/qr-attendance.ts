import { pgTable, uuid, text, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { staffTable } from "./staff";

/**
 * QR-based attendance for ground staff who don't have personal smartphones.
 * A supervisor/trainer/MIS scans the ground staff's printed QR card.
 * Check-in and check-out are separate rows with type = "checkin" | "checkout".
 */
export const qrAttendanceTable = pgTable("qr_attendance", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** The company this record belongs to. */
  companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "set null" }),

  /** Ground staff whose attendance is being marked. */
  staffId: uuid("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  staffName: text("staff_name").notNull(),

  /** Staff who performed the scan (supervisor / trainer / MIS etc.). */
  scannedById: uuid("scanned_by_id").notNull().references(() => staffTable.id, { onDelete: "set null" }),
  scannedByName: text("scanned_by_name").notNull(),

  /** "checkin" or "checkout" */
  type: text("type", { enum: ["checkin", "checkout"] }).notNull(),

  /** IST date string YYYY-MM-DD — used for daily grouping. */
  date: text("date").notNull(),

  /** GPS coordinates at the time of scan (from scanner's phone). */
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),

  /** GCS path of the scanner's selfie (anti-fraud proof). */
  scannerSelfieUrl: text("scanner_selfie_url"),

  /** When the scan occurred. */
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QrAttendance = typeof qrAttendanceTable.$inferSelect;
export type InsertQrAttendance = typeof qrAttendanceTable.$inferInsert;
