import { boolean, doublePrecision, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const companiesTable = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  adminName: text("admin_name"),
  phone: text("phone"),
  email: text("email"),
  /** Contact person name (may differ from admin login name) */
  contactPersonName: text("contact_person_name"),
  state: text("state"),
  district: text("district"),
  /** Full head office address */
  officeAddress: text("office_address"),
  /** PIN code of head office */
  pinCode: text("pin_code"),
  projectName: text("project_name"),
  /** Approval status for new company registrations — Super Admin must approve */
  approvalStatus: text("approval_status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("approved"),
  logoPath: text("logo_path"),
  /** active | inactive */
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  subscriptionActive: boolean("subscription_active").notNull().default(true),
  /** basic | standard | premium */
  plan: text("plan", { enum: ["basic", "standard", "premium"] }),
  subscriptionStartDate: timestamp("subscription_start_date", { withTimezone: true }),
  subscriptionEndDate: timestamp("subscription_end_date", { withTimezone: true }),
  /** paid | pending | expired */
  paymentStatus: text("payment_status", { enum: ["paid", "pending", "expired"] }).default("paid"),
  centerName: text("center_name"),
  tcId: text("tc_id"),
  /** Geo-fence: latitude of training center (for center staff attendance). */
  centerLat: doublePrecision("center_lat"),
  /** Geo-fence: longitude of training center (for center staff attendance). */
  centerLng: doublePrecision("center_lng"),
  /** Geo-fence: radius in meters within which center staff check-in is valid (default 200m). */
  centerRadiusMeters: integer("center_radius_meters").default(200),
  /** Shift start time for field staff (HH:MM, IST, default 09:00). */
  fieldShiftStart: text("field_shift_start").default("09:00"),
  /** Shift end time for field staff (HH:MM, IST, default 18:00). */
  fieldShiftEnd: text("field_shift_end").default("18:00"),
  /** Shift start time for center staff (HH:MM, IST, default 09:00). */
  centerShiftStart: text("center_shift_start").default("09:00"),
  /** Shift end time for center staff (HH:MM, IST, default 18:00). */
  centerShiftEnd: text("center_shift_end").default("18:00"),
  /** Grace period in minutes after shift start before check-in is marked late (default 15). */
  lateGraceMinutes: integer("late_grace_minutes").default(15),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Company = typeof companiesTable.$inferSelect;
export type InsertCompany = typeof companiesTable.$inferInsert;
