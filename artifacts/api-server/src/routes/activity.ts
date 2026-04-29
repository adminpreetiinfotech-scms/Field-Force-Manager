import { activityEventsTable, db, staffTable } from "@workspace/db";
import { and, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateActivityBody,
  ListActivityQueryParams,
} from "@workspace/api-zod";
import type {
  ActivityDetail,
  ActivityEvent as ActivityEventDTO,
  ActivityKind,
  ActivityPage,
} from "@workspace/api-zod";

const router: IRouter = Router();

const ALLOWED_KINDS: readonly ActivityKind[] = [
  "checkin",
  "checkout",
  "meter",
  "trip-start",
  "trip-end",
];

type ActivityPayload = {
  location?: { latitude: number; longitude: number; accuracy?: number } | null;
  consumerNo?: string | null;
  reading?: number | null;
  photoUri?: string | null;
  selfieUri?: string | null;
  notes?: string | null;
  distanceKm?: number | null;
  durationSec?: number | null;
  origin?: { latitude: number; longitude: number; accuracy?: number } | null;
  destination?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
};

function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`, "utf8").toString(
    "base64url",
  );
}

function decodeCursor(
  cursor: string,
): { occurredAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const [iso, id] = decoded.split("|");
    if (!iso || !id) return null;
    const occurredAt = new Date(iso);
    if (Number.isNaN(occurredAt.getTime())) return null;
    return { occurredAt, id };
  } catch {
    return null;
  }
}

function summarize(
  kind: ActivityKind,
  staffName: string,
  payload: ActivityPayload,
): string {
  switch (kind) {
    case "checkin":
      return `${staffName} checked in`;
    case "checkout":
      return `${staffName} checked out`;
    case "meter": {
      const reading =
        payload.reading != null
          ? payload.reading.toLocaleString("en-IN")
          : "—";
      return `${staffName} read ${reading} kWh`;
    }
    case "trip-start":
      return `${staffName} started a trip`;
    case "trip-end": {
      const km = payload.distanceKm?.toFixed(1) ?? "0.0";
      return `${staffName} ended a trip · ${km} km`;
    }
  }
}

function rowToDTO(row: {
  id: string;
  kind: ActivityKind;
  staffId: string;
  staffName: string;
  occurredAt: Date;
  receivedAt: Date;
  synced: boolean;
  tripRef: string | null;
  payload: unknown;
}): ActivityEventDTO {
  const payload = (row.payload || {}) as ActivityPayload;
  return {
    id: row.id,
    kind: row.kind,
    staffId: row.staffId,
    staffName: row.staffName,
    occurredAt: row.occurredAt,
    receivedAt: row.receivedAt,
    synced: row.synced,
    tripRef: row.tripRef,
    summary: summarize(row.kind, row.staffName, payload),
  };
}

function rowToDetail(row: {
  id: string;
  kind: ActivityKind;
  staffId: string;
  staffName: string;
  occurredAt: Date;
  receivedAt: Date;
  synced: boolean;
  tripRef: string | null;
  payload: unknown;
}): ActivityDetail {
  const base = rowToDTO(row);
  const p = (row.payload || {}) as ActivityPayload;
  return {
    ...base,
    location: p.location ?? null,
    consumerNo: p.consumerNo ?? null,
    reading: p.reading ?? null,
    photoUri: p.photoUri ?? null,
    selfieUri: p.selfieUri ?? null,
    notes: p.notes ?? null,
    distanceKm: p.distanceKm ?? null,
    durationSec: p.durationSec ?? null,
    origin: p.origin ?? null,
    destination: p.destination ?? null,
  };
}

router.get("/activity", async (req, res, next) => {
  try {
    const parsed = ListActivityQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        title: "Invalid query parameters",
        detail: parsed.error.issues.map((i) => i.message).join("; "),
        status: 400,
      });
      return;
    }
    const { limit, cursor, since, kinds } = parsed.data;

    const conds = [] as ReturnType<typeof eq>[];

    if (kinds) {
      const list = kinds
        .split(",")
        .map((k) => k.trim())
        .filter((k): k is ActivityKind =>
          (ALLOWED_KINDS as readonly string[]).includes(k),
        );
      if (list.length > 0) {
        conds.push(inArray(activityEventsTable.kind, list));
      }
    }

    if (since) {
      conds.push(gt(activityEventsTable.occurredAt, since));
    }

    if (cursor) {
      const c = decodeCursor(cursor);
      if (!c) {
        res.status(400).json({
          title: "Invalid cursor",
          detail: "The cursor could not be decoded.",
          status: 400,
        });
        return;
      }
      // (occurred_at, id) < (cursor.occurredAt, cursor.id) for stable
      // descending pagination across ties on occurred_at.
      conds.push(
        or(
          lt(activityEventsTable.occurredAt, c.occurredAt),
          and(
            eq(activityEventsTable.occurredAt, c.occurredAt),
            lt(activityEventsTable.id, c.id),
          ),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(activityEventsTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(
        desc(activityEventsTable.occurredAt),
        desc(activityEventsTable.id),
      )
      .limit(limit + 1);

    const items = rows.slice(0, limit).map((r) => rowToDTO(r as never));
    const last = rows[limit - 1];
    const nextCursor =
      rows.length > limit && last
        ? encodeCursor(last.occurredAt as Date, last.id as string)
        : null;

    const page: ActivityPage = {
      items,
      nextCursor,
      serverTime: new Date(),
    };

    // Short-cache hint for proxies; deliberately tiny because the feed is hot.
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.json(page);
  } catch (err) {
    next(err);
  }
});

router.get("/activity/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      res
        .status(400)
        .json({ title: "Invalid id", detail: "Expected uuid", status: 400 });
      return;
    }
    const [row] = await db
      .select()
      .from(activityEventsTable)
      .where(eq(activityEventsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({
        title: "Activity not found",
        detail: `No event with id ${id}`,
        status: 404,
      });
      return;
    }
    res.json(rowToDetail(row as never));
  } catch (err) {
    next(err);
  }
});

router.post("/activity", async (req, res, next) => {
  try {
    const parsed = CreateActivityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        title: "Invalid payload",
        detail: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
        status: 400,
      });
      return;
    }
    const input = parsed.data;
    const occurredAt = input.occurredAt ?? new Date();

    const payload: ActivityPayload = {
      location: input.location ?? null,
      consumerNo: input.consumerNo ?? null,
      reading: input.reading ?? null,
      photoUri: input.photoUri ?? null,
      selfieUri: input.selfieUri ?? null,
      notes: input.notes ?? null,
      distanceKm: input.distanceKm ?? null,
      durationSec: input.durationSec ?? null,
      origin: input.origin ?? null,
      destination: input.destination ?? null,
    };

    const [inserted] = await db
      .insert(activityEventsTable)
      .values({
        kind: input.kind,
        staffId: input.staffId,
        staffName: input.staffName,
        occurredAt,
        tripRef: input.tripRef ?? null,
        payload: payload as never,
        synced: true,
      })
      .returning();

    req.log.info(
      { kind: inserted.kind, staffId: inserted.staffId },
      "activity event ingested",
    );

    res.status(201).json(rowToDTO(inserted as never));
  } catch (err) {
    next(err);
  }
});

// Demo helper — used by the seeder and dev pulse generator below.
export async function insertEventDirect(values: {
  kind: ActivityKind;
  staffId: string;
  staffName: string;
  occurredAt: Date;
  tripRef?: string | null;
  payload: ActivityPayload;
  synced?: boolean;
}) {
  await db.insert(activityEventsTable).values({
    kind: values.kind,
    staffId: values.staffId,
    staffName: values.staffName,
    occurredAt: values.occurredAt,
    tripRef: values.tripRef ?? null,
    payload: values.payload as never,
    synced: values.synced ?? true,
  });
}

// Returns the count of staff so the seeder can decide whether to bootstrap.
export async function countStaff(): Promise<number> {
  const r = await db.select({ c: sql<number>`count(*)::int` }).from(staffTable);
  return r[0]?.c ?? 0;
}

export default router;
