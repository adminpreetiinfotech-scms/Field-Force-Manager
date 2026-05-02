import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const companiesTable = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  adminName: text("admin_name"),
  phone: text("phone"),
  email: text("email"),
  state: text("state"),
  district: text("district"),
  projectName: text("project_name"),
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Company = typeof companiesTable.$inferSelect;
export type InsertCompany = typeof companiesTable.$inferInsert;
