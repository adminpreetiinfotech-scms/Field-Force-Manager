import { doublePrecision, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const centersTable = pgTable("centers", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  /** Human-readable training center name */
  name: text("name").notNull(),
  /** Training Center ID / TC ID (e.g. JH-RAN-001) */
  tcId: text("tc_id"),
  /** Courses offered at this center — stored as a JSON string array */
  courses: jsonb("courses").$type<string[]>().default([]),
  /** State where center is located */
  state: text("state"),
  /** District where center is located */
  district: text("district"),
  /** Block / Taluka */
  block: text("block"),
  /** PIN code */
  pinCode: text("pin_code"),
  /** Geo-fence latitude */
  lat: doublePrecision("lat"),
  /** Geo-fence longitude */
  lng: doublePrecision("lng"),
  /** Geo-fence radius in meters (default 200) */
  radiusMeters: integer("radius_meters").default(200),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Center = typeof centersTable.$inferSelect;
export type InsertCenter = typeof centersTable.$inferInsert;
