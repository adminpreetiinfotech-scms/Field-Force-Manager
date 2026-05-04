import { doublePrecision, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const centersTable = pgTable("centers", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
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
