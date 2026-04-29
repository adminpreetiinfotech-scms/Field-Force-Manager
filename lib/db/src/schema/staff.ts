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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type InsertStaff = typeof staffTable.$inferInsert;
export type Staff = typeof staffTable.$inferSelect;
