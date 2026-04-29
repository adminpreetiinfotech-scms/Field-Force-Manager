import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const staffTable = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  empCode: text("emp_code").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: text("role", { enum: ["staff", "admin"] }).notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type InsertStaff = typeof staffTable.$inferInsert;
export type Staff = typeof staffTable.$inferSelect;
