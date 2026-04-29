import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const staffTable = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  empCode: text("emp_code").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: text("role", { enum: ["staff", "admin"] }).notNull().default("staff"),
  /** Organization / company name (set by admin on registration). */
  organization: text("organization"),
  /** Assigned territory or area (set by staff on registration). */
  area: text("area"),
  /** Short invite code generated for admin orgs so staff can link to them. */
  adminCode: text("admin_code").unique(),
  /** Admin performance notes / area assignment text for this staff member. */
  notes: text("notes"),
  /**
   * Approval workflow status.
   * - 'pending'  — newly registered staff, not yet approved by admin
   * - 'approved' — admin approved; staff can log in
   * - 'rejected' — admin rejected; staff cannot log in
   * Admins are always 'approved' on registration.
   */
  approvalStatus: text("approval_status", {
    enum: ["pending", "approved", "rejected"],
  })
    .notNull()
    .default("approved"),
  /**
   * Optional bcrypt-style PIN/password hash.
   * Null means no password is set (OTP-only login).
   */
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type InsertStaff = typeof staffTable.$inferInsert;
export type Staff = typeof staffTable.$inferSelect;
