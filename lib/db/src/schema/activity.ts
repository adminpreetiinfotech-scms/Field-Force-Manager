import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Unified activity event log. Single table backs the live feed, detail
 * views, and audit trail. Designed for cursor pagination and `since` delta
 * polling at scale — the (occurred_at DESC, id DESC) index handles both.
 */
export const activityEventsTable = pgTable(
  "activity_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind", {
      enum: ["checkin", "checkout", "meter", "trip-start", "trip-end"],
    }).notNull(),
    staffId: uuid("staff_id").notNull(),
    staffName: text("staff_name").notNull(),
    /** Domain-specific payload — see ActivityPayload union below. */
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    /**
     * For trip-start / trip-end events, links them to the same logical trip
     * so the detail view can show a single trip's start, end, distance, etc.
     */
    tripRef: uuid("trip_ref"),
    /** When the field event actually happened (drives the feed ordering). */
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When the event landed in the server (after offline sync). */
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    synced: boolean("synced").notNull().default(true),
  },
  (t) => [
    // Composite index for efficient cursor pagination + since polling.
    index("activity_events_occurred_at_id_idx").on(
      t.occurredAt.desc(),
      t.id.desc(),
    ),
    index("activity_events_staff_id_idx").on(t.staffId),
    index("activity_events_trip_ref_idx").on(t.tripRef),
  ],
);

export type InsertActivityEvent = typeof activityEventsTable.$inferInsert;
export type ActivityEvent = typeof activityEventsTable.$inferSelect;

export const ACTIVITY_KINDS = [
  "checkin",
  "checkout",
  "meter",
  "trip-start",
  "trip-end",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
