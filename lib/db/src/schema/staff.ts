import { boolean, doublePrecision, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const staffTable = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Null for super_admin who belongs to no company. */
  companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  empCode: text("emp_code").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: text("role", { enum: ["staff", "admin", "super_admin"] }).notNull().default("staff"),
  organization: text("organization"),
  centerName: text("center_name"),
  projectName: text("project_name"),
  email: text("email"),
  state: text("state"),
  district: text("district"),
  area: text("area"),
  adminCode: text("admin_code").unique(),
  notes: text("notes"),
  approvalStatus: text("approval_status", {
    enum: ["pending", "approved", "rejected"],
  })
    .notNull()
    .default("approved"),
  /** Legacy password hash for account settings (not used for login anymore). */
  passwordHash: text("password_hash"),
  /** Hashed MPIN used for login (scrypt). Null = MPIN not yet set. */
  mpinHash: text("mpin_hash"),
  /** Number of consecutive failed MPIN attempts. Reset on success. */
  failedMpinAttempts: integer("failed_mpin_attempts").notNull().default(0),
  /** If set, MPIN login is blocked until this time. */
  mpinBlockedUntil: timestamp("mpin_blocked_until", { withTimezone: true }),
  /** If set, staff is disabled and cannot login or submit data. */
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  /** If set, staff is soft-deleted. Old candidate records are preserved. */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  /** Last known GPS latitude (updated by ping-location endpoint). */
  lastLat: doublePrecision("last_lat"),
  /** Last known GPS longitude (updated by ping-location endpoint). */
  lastLng: doublePrecision("last_lng"),
  /** When the last GPS ping was received. */
  lastLocationAt: timestamp("last_location_at", { withTimezone: true }),
  /** True while staff has an active shift (check-in done, no checkout yet). */
  isOnShift: boolean("is_on_shift").notNull().default(false),
  /** Vehicle type used for field visits. Set once in profile. */
  vehicleType: text("vehicle_type", { enum: ["2-wheeler", "4-wheeler"] }),
  /** Vehicle registration number or identifier. */
  vehicleNumber: text("vehicle_number"),
  /** Staff category: field staff do field visits; center staff work at the training center. */
  staffCategory: text("staff_category", { enum: ["field", "center"] }).notNull().default("field"),
  /** Role label for center staff (e.g. trainer, centerHead, cook, securityGuard). */
  centerStaffRole: text("center_staff_role"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type InsertStaff = typeof staffTable.$inferInsert;
export type Staff = typeof staffTable.$inferSelect;
