import { activityEventsTable, db, staffTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

type SeedStaff = {
  empCode: string;
  name: string;
  phone: string;
  role: "staff" | "admin";
};

const SEED_STAFF: SeedStaff[] = [
  { empCode: "ADM-001", name: "Anita Sharma", phone: "9999999999", role: "admin" },
  { empCode: "FS-3210", name: "Demo Field Staff", phone: "9876543210", role: "staff" },
  { empCode: "FS-1002", name: "Ramesh Kumar", phone: "9876500001", role: "staff" },
  { empCode: "FS-1003", name: "Sita Devi", phone: "9876500002", role: "staff" },
  { empCode: "FS-1004", name: "Arjun Singh", phone: "9876500003", role: "staff" },
  { empCode: "FS-1005", name: "Pooja Verma", phone: "9876500004", role: "staff" },
];

const DELHI: [number, number] = [28.6139, 77.209];

function jitter(base: number, range: number) {
  return base + (Math.random() - 0.5) * range;
}

function pickPoint(): { latitude: number; longitude: number; accuracy: number } {
  return {
    latitude: jitter(DELHI[0], 0.04),
    longitude: jitter(DELHI[1], 0.04),
    accuracy: 5 + Math.random() * 10,
  };
}

export async function ensureSeed() {
  // Upsert staff so codes/phones stay in sync across restarts.
  const inserted = await db
    .insert(staffTable)
    .values(SEED_STAFF)
    .onConflictDoNothing({ target: staffTable.empCode })
    .returning();

  if (inserted.length > 0) {
    logger.info({ count: inserted.length }, "seeded staff rows");
  }

  // If there are zero activity events, generate a believable history so the
  // feed has something to display on first boot.
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(activityEventsTable);

  if ((c ?? 0) > 0) return;

  const allStaff = await db.select().from(staffTable);
  const staff = allStaff.filter((s) => s.role === "staff");
  if (staff.length === 0) return;

  const now = Date.now();
  const events: (typeof activityEventsTable.$inferInsert)[] = [];

  // Generate ~36 events spread across the last 6 hours.
  for (let i = 0; i < 36; i++) {
    const s = staff[i % staff.length];
    const ts = new Date(now - i * 9 * 60 * 1000 - Math.floor(Math.random() * 60_000));
    const r = Math.random();

    if (r < 0.4) {
      events.push({
        kind: i % 8 === 0 ? "checkout" : "checkin",
        staffId: s.id,
        staffName: s.name,
        occurredAt: ts,
        synced: true,
        payload: { location: pickPoint() } as never,
      });
    } else if (r < 0.75) {
      events.push({
        kind: "meter",
        staffId: s.id,
        staffName: s.name,
        occurredAt: ts,
        synced: true,
        payload: {
          location: pickPoint(),
          consumerNo: String(218000 + Math.floor(Math.random() * 999)),
          reading: 1500 + Math.floor(Math.random() * 4500),
        } as never,
      });
    } else {
      const tripRef = crypto.randomUUID();
      const startedAt = new Date(ts.getTime() - 50 * 60 * 1000);
      const km = 4 + Math.random() * 14;
      const durationSec = Math.floor(km * 240); // ~4 min/km
      events.push({
        kind: "trip-start",
        staffId: s.id,
        staffName: s.name,
        occurredAt: startedAt,
        tripRef,
        synced: true,
        payload: { origin: pickPoint() } as never,
      });
      events.push({
        kind: "trip-end",
        staffId: s.id,
        staffName: s.name,
        occurredAt: ts,
        tripRef,
        synced: true,
        payload: {
          origin: pickPoint(),
          destination: pickPoint(),
          distanceKm: km,
          durationSec,
        } as never,
      });
    }
  }

  await db.insert(activityEventsTable).values(events);
  logger.info({ count: events.length }, "seeded activity events");
}

/**
 * Generates one synthetic event every ~12s so the live feed has motion
 * even when no real users are posting. Kept intentionally lightweight.
 */
export function startDemoPulse() {
  if (process.env.DISABLE_DEMO_PULSE === "1") return;

  setInterval(async () => {
    try {
      const allStaff = await db
        .select()
        .from(staffTable)
        .where(sql`${staffTable.role} = 'staff'`);
      if (allStaff.length === 0) return;
      const s = allStaff[Math.floor(Math.random() * allStaff.length)];
      const r = Math.random();
      const now = new Date();

      if (r < 0.5) {
        await db.insert(activityEventsTable).values({
          kind: "meter",
          staffId: s.id,
          staffName: s.name,
          occurredAt: now,
          synced: true,
          payload: {
            location: pickPoint(),
            consumerNo: String(218000 + Math.floor(Math.random() * 999)),
            reading: 1500 + Math.floor(Math.random() * 4500),
          } as never,
        });
      } else if (r < 0.8) {
        await db.insert(activityEventsTable).values({
          kind: r < 0.7 ? "checkin" : "checkout",
          staffId: s.id,
          staffName: s.name,
          occurredAt: now,
          synced: true,
          payload: { location: pickPoint() } as never,
        });
      } else {
        const tripRef = crypto.randomUUID();
        await db.insert(activityEventsTable).values({
          kind: "trip-start",
          staffId: s.id,
          staffName: s.name,
          occurredAt: now,
          tripRef,
          synced: true,
          payload: { origin: pickPoint() } as never,
        });
      }
    } catch (err) {
      logger.warn({ err }, "demo pulse insert failed");
    }
  }, 12_000);
}
