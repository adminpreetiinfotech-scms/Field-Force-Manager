import { activityEventsTable, candidatesTable, companiesTable, db, staffTable } from "@workspace/db";
import { isCompanySubscriptionBlocked } from "./companies";
import { and, count, desc, eq, gt, gte, inArray, lt, or, sql } from "drizzle-orm";
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
  /** Vehicle odometer reading at check-in (km). */
  startOdometerKm?: number | null;
  /** Vehicle odometer reading at check-out (km). */
  endOdometerKm?: number | null;
  /** Photo of vehicle odometer meter. */
  vehicleMeterPhotoUri?: string | null;
  /** True if center staff checked in/out outside the company geo-fence radius. */
  outsideGeofence?: boolean | null;
  /** Straight-line distance in meters from the center geo-fence origin. */
  distanceFromCenterM?: number | null;
};

/** Haversine distance in meters between two lat/lng points. */
function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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
    startOdometerKm: p.startOdometerKm ?? null,
    endOdometerKm: p.endOdometerKm ?? null,
    vehicleMeterPhotoUri: p.vehicleMeterPhotoUri ?? null,
    outsideGeofence: p.outsideGeofence ?? null,
    distanceFromCenterM: p.distanceFromCenterM ?? null,
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
    // Optional company filter — admin passes their companyId to scope to their data
    const companyId = req.query.companyId as string | undefined;

    const conds = [] as ReturnType<typeof eq>[];
    if (companyId?.trim()) {
      conds.push(eq(activityEventsTable.companyId, companyId.trim()));
    }

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

router.get("/activity/ride-calendar", async (req, res, next) => {
  try {
    const rawYear = req.query.year as string | undefined;
    const rawMonth = req.query.month as string | undefined;
    const rawStaffId = req.query.staffId as string | undefined;

    const year = parseInt(rawYear ?? "", 10);
    const month = parseInt(rawMonth ?? "", 10); // 1-based

    if (!rawYear || isNaN(year) || year < 2000 || year > 2100) {
      res.status(400).json({
        title: "Invalid year",
        detail: "year must be a four-digit integer between 2000 and 2100",
        status: 400,
      });
      return;
    }
    if (!rawMonth || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({
        title: "Invalid month",
        detail: "month must be 1–12",
        status: 400,
      });
      return;
    }
    if (rawStaffId && !/^[0-9a-fA-F-]{36}$/.test(rawStaffId)) {
      res.status(400).json({
        title: "Invalid staffId",
        detail: "staffId must be a UUID",
        status: 400,
      });
      return;
    }

    // UTC window for the entire calendar month.
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 1)); // exclusive

    const conds = [
      eq(activityEventsTable.kind, "trip-end"),
      gte(activityEventsTable.occurredAt, periodStart),
      lt(activityEventsTable.occurredAt, periodEnd),
    ] as ReturnType<typeof eq>[];
    if (rawStaffId) {
      conds.push(eq(activityEventsTable.staffId, rawStaffId));
    }

    const rows = await db
      .select({
        occurredAt: activityEventsTable.occurredAt,
        payload: activityEventsTable.payload,
      })
      .from(activityEventsTable)
      .where(and(...conds));

    // Aggregate by IST calendar date (UTC+5:30).
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const dayMap = new Map<string, { rideCount: number; totalKm: number }>();

    for (const row of rows) {
      const local = new Date(
        (row.occurredAt as Date).getTime() + IST_OFFSET_MS,
      );
      const date = local.toISOString().slice(0, 10);
      const p = (row.payload || {}) as ActivityPayload;
      const km = typeof p.distanceKm === "number" ? p.distanceKm : 0;
      const acc = dayMap.get(date);
      if (acc) {
        acc.rideCount++;
        acc.totalKm += km;
      } else {
        dayMap.set(date, { rideCount: 1, totalKm: km });
      }
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;

    const days = Array.from(dayMap.entries())
      .map(([date, v]) => ({
        date,
        rideCount: v.rideCount,
        totalKm: round1(v.totalKm),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const maxRideCount = days.reduce((m, d) => Math.max(m, d.rideCount), 0);
    const totalKm = round1(days.reduce((s, d) => s + d.totalKm, 0));
    const totalRides = days.reduce((s, d) => s + d.rideCount, 0);

    res.json({ year, month, days, maxRideCount, totalKm, totalRides });
  } catch (err) {
    next(err);
  }
});

router.get("/activity/attendance-calendar", async (req, res, next) => {
  try {
    const rawStaffId = req.query.staffId as string | undefined;
    const rawYear = req.query.year as string | undefined;
    const rawMonth = req.query.month as string | undefined;

    if (!rawStaffId || !/^[0-9a-fA-F-]{36}$/.test(rawStaffId)) {
      res.status(400).json({ title: "Invalid staffId", detail: "staffId must be a UUID", status: 400 });
      return;
    }
    const year = parseInt(rawYear ?? "", 10);
    const month = parseInt(rawMonth ?? "", 10);
    if (!rawYear || isNaN(year) || year < 2000 || year > 2100) {
      res.status(400).json({ title: "Invalid year", detail: "year must be 2000–2100", status: 400 });
      return;
    }
    if (!rawMonth || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ title: "Invalid month", detail: "month must be 1–12", status: 400 });
      return;
    }

    // UTC window for the calendar month (IST = UTC+5:30, so we extend the window slightly)
    const periodStart = new Date(Date.UTC(year, month - 1, 1) - 5.5 * 3600_000);
    const periodEnd = new Date(Date.UTC(year, month, 1) + 0.5 * 3600_000); // +30 min buffer

    // Fetch checkin, checkout, and trip-end events for the month
    const rows = await db
      .select({
        kind: activityEventsTable.kind,
        occurredAt: activityEventsTable.occurredAt,
        payload: activityEventsTable.payload,
      })
      .from(activityEventsTable)
      .where(
        and(
          eq(activityEventsTable.staffId, rawStaffId),
          or(
            eq(activityEventsTable.kind, "checkin"),
            eq(activityEventsTable.kind, "checkout"),
            eq(activityEventsTable.kind, "trip-end"),
          ),
          gte(activityEventsTable.occurredAt, periodStart),
          lt(activityEventsTable.occurredAt, periodEnd),
        ),
      );

    // IST offset
    const IST_MS = 5.5 * 3600_000;

    type DayAcc = {
      checkinTimes: Date[];
      checkoutTimes: Date[];
      totalKm: number;
      tripCount: number;
    };
    const dayMap = new Map<string, DayAcc>();

    function getISTDate(d: Date): string {
      return new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
    }

    for (const row of rows) {
      const date = getISTDate(row.occurredAt as Date);
      // Only include dates that belong to the requested month
      const [y, m] = date.split("-").map(Number);
      if (y !== year || m !== month) continue;

      if (!dayMap.has(date)) {
        dayMap.set(date, { checkinTimes: [], checkoutTimes: [], totalKm: 0, tripCount: 0 });
      }
      const acc = dayMap.get(date)!;
      if (row.kind === "checkin") {
        acc.checkinTimes.push(row.occurredAt as Date);
      } else if (row.kind === "checkout") {
        acc.checkoutTimes.push(row.occurredAt as Date);
      } else if (row.kind === "trip-end") {
        const p = (row.payload || {}) as ActivityPayload;
        acc.totalKm += typeof p.distanceKm === "number" ? p.distanceKm : 0;
        acc.tripCount++;
      }
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;

    // Determine which past days to include (all days from 1 to today's date in IST)
    const todayIST = getISTDate(new Date());
    const [todayY, todayM, todayD] = todayIST.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    // Entirely future month → no days to evaluate
    const isFutureMonth = year > todayY || (year === todayY && month > todayM);
    const lastDay = isFutureMonth
      ? 0
      : year === todayY && month === todayM
        ? todayD
        : daysInMonth;

    const days = [];
    let presentCount = 0;
    let partialCount = 0;
    let absentCount = 0;
    let totalKmMonth = 0;

    // Count Mon–Sat working days (exclude Sundays) from day 1 to lastDay
    let totalWorkingDays = 0;
    for (let d = 1; d <= lastDay; d++) {
      const dow = new Date(year, month - 1, d).getDay(); // 0 = Sunday
      if (dow !== 0) totalWorkingDays++;
    }

    for (let d = 1; d <= lastDay; d++) {
      const mm = String(month).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const date = `${year}-${mm}-${dd}`;
      const acc = dayMap.get(date);

      let status: "present" | "partial" | "absent";
      let checkinTime: string | null = null;
      let checkoutTime: string | null = null;
      let km = 0;
      let trips = 0;

      if (acc && acc.checkinTimes.length > 0) {
        // Sort asc → first checkin
        acc.checkinTimes.sort((a, b) => a.getTime() - b.getTime());
        checkinTime = acc.checkinTimes[0].toISOString();
        if (acc.checkoutTimes.length > 0) {
          // Sort desc → last checkout
          acc.checkoutTimes.sort((a, b) => b.getTime() - a.getTime());
          checkoutTime = acc.checkoutTimes[0].toISOString();
          status = "present";
          presentCount++;
        } else {
          status = "partial";
          partialCount++;
        }
        km = round1(acc.totalKm);
        trips = acc.tripCount;
      } else {
        status = "absent";
        absentCount++;
      }

      totalKmMonth += km;
      days.push({ date, status, checkinTime, checkoutTime, totalKm: km, tripCount: trips });
    }

    const attendancePercent =
      totalWorkingDays > 0
        ? Math.round((presentCount / totalWorkingDays) * 1000) / 10
        : 0;

    res.json({
      year,
      month,
      days,
      presentCount,
      partialCount,
      absentCount,
      totalKm: round1(totalKmMonth),
      totalWorkingDays,
      attendancePercent,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/activity/leaderboard", async (req, res, next) => {
  try {
    const rawPeriod = req.query.period as string | undefined;
    if (!rawPeriod || !["daily", "weekly", "monthly"].includes(rawPeriod)) {
      res.status(400).json({
        title: "Invalid period",
        detail: "period must be daily, weekly, or monthly",
        status: 400,
      });
      return;
    }
    const period = rawPeriod as "daily" | "weekly" | "monthly";

    // Compute UTC window + human-readable label.
    const now = new Date();
    let periodStart: Date;
    let periodLabel: string;

    if (period === "daily") {
      // Start of today (UTC).
      periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      periodLabel = "Today";
    } else if (period === "weekly") {
      // Rolling 7 days ending now.
      periodStart = new Date(now.getTime() - 6 * 86_400_000);
      periodStart = new Date(
        Date.UTC(
          periodStart.getUTCFullYear(),
          periodStart.getUTCMonth(),
          periodStart.getUTCDate(),
        ),
      );
      periodLabel = "Last 7 days";
    } else {
      // Calendar month so far.
      periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      periodLabel = now.toLocaleString("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    }

    // Optional company filter — scopes leaderboard to a single company.
    const companyId = (req.query.companyId as string | undefined)?.trim() || null;

    // Pull all trip-end events in the window (distanceKm lives here).
    const rows = await db
      .select({
        staffId: activityEventsTable.staffId,
        staffName: activityEventsTable.staffName,
        payload: activityEventsTable.payload,
      })
      .from(activityEventsTable)
      .where(
        and(
          eq(activityEventsTable.kind, "trip-end"),
          gte(activityEventsTable.occurredAt, periodStart),
          lt(activityEventsTable.occurredAt, new Date(now.getTime() + 1)),
          companyId ? eq(activityEventsTable.companyId, companyId) : undefined,
        ),
      );

    // Aggregate per staff.
    type Acc = {
      staffId: string;
      staffName: string;
      totalKm: number;
      tripCount: number;
    };
    const staffMap = new Map<string, Acc>();
    for (const row of rows) {
      const p = (row.payload || {}) as ActivityPayload;
      const km = typeof p.distanceKm === "number" ? p.distanceKm : 0;
      const acc = staffMap.get(row.staffId);
      if (acc) {
        acc.totalKm += km;
        acc.tripCount++;
      } else {
        staffMap.set(row.staffId, {
          staffId: row.staffId,
          staffName: row.staffName,
          totalKm: km,
          tripCount: 1,
        });
      }
    }

    // Fetch empCodes, notes, phone for everyone in the result set.
    const ids = Array.from(staffMap.keys());
    const empMap = new Map<string, string>();
    const notesMap = new Map<string, boolean>();
    const phoneMap = new Map<string, string>(); // staffId → phone
    if (ids.length > 0) {
      const staffRows = await db
        .select({ id: staffTable.id, empCode: staffTable.empCode, notes: staffTable.notes, phone: staffTable.phone })
        .from(staffTable)
        .where(inArray(staffTable.id, ids));
      for (const s of staffRows) {
        empMap.set(s.id, s.empCode);
        notesMap.set(s.id, typeof s.notes === "string" && s.notes.trim().length > 0);
        phoneMap.set(s.id, s.phone);
      }
    }

    // Fetch candidate registration counts per mobilizer phone in the period.
    const candidateCountMap = new Map<string, number>(); // phone → count
    const phones = Array.from(phoneMap.values()).filter(Boolean);
    if (phones.length > 0) {
      const candRows = await db
        .select({
          phone: candidatesTable.submittedByPhone,
          cnt: count(candidatesTable.id),
        })
        .from(candidatesTable)
        .where(
          and(
            inArray(candidatesTable.submittedByPhone, phones),
            gte(candidatesTable.createdAt, periodStart),
            lt(candidatesTable.createdAt, new Date(now.getTime() + 1)),
          ),
        )
        .groupBy(candidatesTable.submittedByPhone);
      for (const row of candRows) {
        if (row.phone) candidateCountMap.set(row.phone, Number(row.cnt));
      }
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;

    const sorted = Array.from(staffMap.values())
      .sort((a, b) => b.totalKm - a.totalKm || b.tripCount - a.tripCount)
      .map((s, i) => {
        const phone = phoneMap.get(s.staffId) ?? "";
        return {
          rank: i + 1,
          staffId: s.staffId,
          staffName: s.staffName,
          empCode: empMap.get(s.staffId) ?? "—",
          totalKm: round1(s.totalKm),
          tripCount: s.tripCount,
          candidateCount: candidateCountMap.get(phone) ?? 0,
          periodLabel,
          hasNotes: notesMap.get(s.staffId) ?? false,
        };
      });

    res.json(sorted);
  } catch (err) {
    next(err);
  }
});

router.get("/activity/trip-report", async (req, res, next) => {
  try {
    const rawFrom = req.query.from as string | undefined;
    const rawTo = req.query.to as string | undefined;
    const rawStaffId = req.query.staffId as string | undefined;

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (!rawFrom || !DATE_RE.test(rawFrom) || !rawTo || !DATE_RE.test(rawTo)) {
      res.status(400).json({
        title: "Invalid query parameters",
        detail: "`from` and `to` are required and must be YYYY-MM-DD",
        status: 400,
      });
      return;
    }
    if (rawStaffId && !/^[0-9a-fA-F-]{36}$/.test(rawStaffId)) {
      res.status(400).json({
        title: "Invalid staffId",
        detail: "staffId must be a UUID",
        status: 400,
      });
      return;
    }

    const startOfFrom = new Date(`${rawFrom}T00:00:00.000Z`);
    const endOfTo = new Date(`${rawTo}T23:59:59.999Z`);

    // Pull all trip-start and trip-end events within the date window.
    const tripConds = [
      inArray(activityEventsTable.kind, ["trip-start", "trip-end"]),
      gte(activityEventsTable.occurredAt, startOfFrom),
      lt(activityEventsTable.occurredAt, new Date(endOfTo.getTime() + 1)),
    ] as ReturnType<typeof eq>[];
    if (rawStaffId) {
      tripConds.push(eq(activityEventsTable.staffId, rawStaffId));
    }

    // Also pull checkin/checkout events for the same window (for odometer photos).
    const attendConds = [
      inArray(activityEventsTable.kind, ["checkin", "checkout"]),
      gte(activityEventsTable.occurredAt, startOfFrom),
      lt(activityEventsTable.occurredAt, new Date(endOfTo.getTime() + 1)),
    ] as ReturnType<typeof eq>[];
    if (rawStaffId) {
      attendConds.push(eq(activityEventsTable.staffId, rawStaffId));
    }

    const [tripRows, attendRows] = await Promise.all([
      db
        .select()
        .from(activityEventsTable)
        .where(and(...tripConds))
        .orderBy(activityEventsTable.occurredAt),
      db
        .select({
          staffId: activityEventsTable.staffId,
          kind: activityEventsTable.kind,
          occurredAt: activityEventsTable.occurredAt,
          payload: activityEventsTable.payload,
        })
        .from(activityEventsTable)
        .where(and(...attendConds)),
    ]);

    // Group by tripRef: build a map of tripRef → { start, end } rows.
    type TripAccum = {
      start: (typeof tripRows)[0] | null;
      end: (typeof tripRows)[0] | null;
    };
    const byRef = new Map<string, TripAccum>();
    for (const row of tripRows) {
      if (!row.tripRef) continue;
      const ref = row.tripRef;
      let acc = byRef.get(ref);
      if (!acc) {
        acc = { start: null, end: null };
        byRef.set(ref, acc);
      }
      if (row.kind === "trip-start") acc.start = row;
      if (row.kind === "trip-end") acc.end = row;
    }

    // Keep only completed trips (have both start and end).
    const completed = Array.from(byRef.entries())
      .filter(([, v]) => v.start && v.end)
      .map(([ref, v]) => ({ tripRef: ref, start: v.start!, end: v.end! }));

    if (completed.length === 0) {
      res.json([]);
      return;
    }

    // Build staffId::date → { checkinPhotoUri, checkoutPhotoUri } from checkin/checkout events.
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const toISTDate = (d: Date) =>
      new Date(d.getTime() + IST_OFFSET).toISOString().slice(0, 10);

    type PhotoDay = { checkinPhotoUri: string | null; checkoutPhotoUri: string | null };
    const photoMap = new Map<string, PhotoDay>();
    for (const row of attendRows) {
      const key = `${row.staffId}::${toISTDate(row.occurredAt as Date)}`;
      const p = (row.payload || {}) as ActivityPayload;
      const existing = photoMap.get(key) ?? { checkinPhotoUri: null, checkoutPhotoUri: null };
      if (row.kind === "checkin" && p.vehicleMeterPhotoUri) {
        existing.checkinPhotoUri = p.vehicleMeterPhotoUri;
      }
      if (row.kind === "checkout" && p.vehicleMeterPhotoUri) {
        existing.checkoutPhotoUri = p.vehicleMeterPhotoUri;
      }
      photoMap.set(key, existing);
    }

    // Fetch phone numbers for each unique staffId in the results.
    const uniqueStaffIds = [
      ...new Set(completed.map((t) => t.start.staffId)),
    ];
    const staffRows = await db
      .select({ id: staffTable.id, phone: staffTable.phone })
      .from(staffTable)
      .where(inArray(staffTable.id, uniqueStaffIds));
    const phoneMap = new Map(staffRows.map((s) => [s.id, s.phone]));

    const formatCoords = (
      p: ActivityPayload | null,
      field: "origin" | "destination" | "location",
    ): string | null => {
      const geo = p?.[field];
      if (!geo) return null;
      return `${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}`;
    };

    const toIST = (d: Date): string => {
      // Return YYYY-MM-DD for a date shifted to IST (+05:30).
      const offset = 5.5 * 60 * 60 * 1000;
      const local = new Date(d.getTime() + offset);
      return local.toISOString().slice(0, 10);
    };

    const report = completed.map(({ tripRef, start, end }) => {
      const startPayload = (start.payload || {}) as ActivityPayload;
      const endPayload = (end.payload || {}) as ActivityPayload;
      const rideDate = toIST(start.occurredAt as Date);
      const photoKey = `${start.staffId}::${rideDate}`;
      const photos = photoMap.get(photoKey) ?? { checkinPhotoUri: null, checkoutPhotoUri: null };
      return {
        tripRef,
        staffId: start.staffId,
        staffName: start.staffName,
        staffPhone: phoneMap.get(start.staffId) ?? "",
        rideDate,
        startTime: start.occurredAt,
        endTime: end.occurredAt,
        startLocation:
          formatCoords(startPayload, "origin") ??
          formatCoords(startPayload, "location"),
        endLocation:
          formatCoords(endPayload, "destination") ??
          formatCoords(endPayload, "location"),
        distanceKm:
          typeof endPayload.distanceKm === "number"
            ? Math.round(endPayload.distanceKm * 10) / 10
            : null,
        checkinPhotoUrl: photos.checkinPhotoUri ?? null,
        checkoutPhotoUrl: photos.checkoutPhotoUri ?? null,
      };
    });

    // Sort by rideDate desc, then startTime desc.
    report.sort((a, b) => {
      const d = b.rideDate.localeCompare(a.rideDate);
      if (d !== 0) return d;
      return (
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    });

    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.get("/activity/distance-stats", async (req, res, next) => {
  try {
    const rawDate = req.query.date as string | undefined;
    const rawStaffId = req.query.staffId as string | undefined;

    const targetDate =
      rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : new Date().toISOString().slice(0, 10);

    if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      res.status(400).json({
        title: "Invalid date",
        detail: "date must be YYYY-MM-DD",
        status: 400,
      });
      return;
    }

    if (
      rawStaffId !== undefined &&
      !/^[0-9a-fA-F-]{36}$/.test(rawStaffId)
    ) {
      res.status(400).json({
        title: "Invalid staffId",
        detail: "staffId must be a UUID",
        status: 400,
      });
      return;
    }

    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const startOfNextDay = new Date(startOfDay.getTime() + 86_400_000);

    const conds = [
      eq(activityEventsTable.kind, "trip-end"),
      gte(activityEventsTable.occurredAt, startOfDay),
      lt(activityEventsTable.occurredAt, startOfNextDay),
    ] as ReturnType<typeof eq>[];

    if (rawStaffId) {
      conds.push(eq(activityEventsTable.staffId, rawStaffId));
    }

    const rows = await db
      .select({
        staffId: activityEventsTable.staffId,
        staffName: activityEventsTable.staffName,
        distanceKm: sql<number>`COALESCE((${activityEventsTable.payload}->>'distanceKm')::numeric, 0)`,
      })
      .from(activityEventsTable)
      .where(and(...conds));

    // Aggregate per staff in JS (simple, avoids complex GROUP BY in Drizzle).
    const perStaffMap = new Map<
      string,
      { staffId: string; staffName: string; totalKm: number; tripCount: number }
    >();
    let totalKm = 0;
    let tripCount = 0;

    for (const row of rows) {
      const km = Number(row.distanceKm) || 0;
      totalKm += km;
      tripCount++;
      const entry = perStaffMap.get(row.staffId);
      if (entry) {
        entry.totalKm += km;
        entry.tripCount++;
      } else {
        perStaffMap.set(row.staffId, {
          staffId: row.staffId,
          staffName: row.staffName,
          totalKm: km,
          tripCount: 1,
        });
      }
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;

    res.json({
      date: targetDate,
      totalKm: round1(totalKm),
      tripCount,
      perStaff: Array.from(perStaffMap.values()).map((s) => ({
        ...s,
        totalKm: round1(s.totalKm),
      })),
    });
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
      startOdometerKm: input.startOdometerKm ?? null,
      endOdometerKm: input.endOdometerKm ?? null,
      vehicleMeterPhotoUri: input.vehicleMeterPhotoUri ?? null,
    };

    // Look up the staff's company_id and staffCategory
    const [staffRow] = await db
      .select({ companyId: staffTable.companyId, staffCategory: staffTable.staffCategory })
      .from(staffTable)
      .where(eq(staffTable.id, input.staffId))
      .limit(1);
    const companyId = staffRow?.companyId ?? null;
    const staffCategory = staffRow?.staffCategory ?? "field";

    // Block check-in if company subscription is expired/inactive
    if (input.kind === "checkin" && companyId) {
      const [company] = await db
        .select({
          subscriptionActive: companiesTable.subscriptionActive,
          subscriptionEndDate: companiesTable.subscriptionEndDate,
          centerLat: companiesTable.centerLat,
          centerLng: companiesTable.centerLng,
          centerRadiusMeters: companiesTable.centerRadiusMeters,
        })
        .from(companiesTable)
        .where(eq(companiesTable.id, companyId))
        .limit(1);
      if (company && isCompanySubscriptionBlocked(company)) {
        res.status(403).json({ title: "Subscription expired. Contact admin.", status: 403 });
        return;
      }
      // Geo-fence check for center staff
      if (staffCategory === "center" && company?.centerLat != null && company?.centerLng != null) {
        const loc = input.location;
        if (loc) {
          const distM = haversineMeters(loc.latitude, loc.longitude, company.centerLat, company.centerLng);
          const radius = company.centerRadiusMeters ?? 200;
          payload.distanceFromCenterM = Math.round(distM);
          payload.outsideGeofence = distM > radius;
        }
      }
    }

    // Geo-fence check for center staff on checkout too
    if (input.kind === "checkout" && companyId && staffCategory === "center") {
      const [company] = await db
        .select({
          centerLat: companiesTable.centerLat,
          centerLng: companiesTable.centerLng,
          centerRadiusMeters: companiesTable.centerRadiusMeters,
        })
        .from(companiesTable)
        .where(eq(companiesTable.id, companyId))
        .limit(1);
      if (company?.centerLat != null && company?.centerLng != null) {
        const loc = input.location;
        if (loc) {
          const distM = haversineMeters(loc.latitude, loc.longitude, company.centerLat, company.centerLng);
          const radius = company.centerRadiusMeters ?? 200;
          payload.distanceFromCenterM = Math.round(distM);
          payload.outsideGeofence = distM > radius;
        }
      }
    }

    const [inserted] = await db
      .insert(activityEventsTable)
      .values({
        companyId,
        kind: input.kind,
        staffId: input.staffId,
        staffName: input.staffName,
        occurredAt,
        tripRef: input.tripRef ?? null,
        payload: payload as never,
        synced: true,
      })
      .returning();

    // Keep staff's shift status + live location in sync with activity events
    if (input.kind === "checkin") {
      const loc = input.location;
      await db
        .update(staffTable)
        .set({
          isOnShift: true,
          ...(loc ? { lastLat: loc.latitude, lastLng: loc.longitude, lastLocationAt: new Date() } : {}),
        })
        .where(eq(staffTable.id, input.staffId));
    } else if (input.kind === "checkout") {
      await db
        .update(staffTable)
        .set({ isOnShift: false })
        .where(eq(staffTable.id, input.staffId));
    }

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
