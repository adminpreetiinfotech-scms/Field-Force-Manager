import { candidatesTable, db, staffTable, activityEventsTable } from "@workspace/db";
import { eq, and, gte, lt, isNull, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import crypto from "node:crypto";

const router: IRouter = Router();

function toStaffDTO(r: typeof staffTable.$inferSelect) {
  return {
    id: r.id,
    empCode: r.empCode,
    name: r.name,
    phone: r.phone,
    role: r.role,
    organization: r.organization ?? null,
    area: r.area ?? null,
    adminCode: r.adminCode ?? null,
    approvalStatus: r.approvalStatus,
    createdAt: r.createdAt?.toISOString() ?? null,
  };
}

router.get("/staff", async (_req, res, next) => {
  try {
    const rows = await db.select().from(staffTable).orderBy(staffTable.name);
    res.json(rows.map(toStaffDTO));
  } catch (err) {
    next(err);
  }
});

router.post("/staff/register", async (req, res, next) => {
  try {
    const { kind, name, phone, organization, empCode, area, adminCode, adminRegistrationKey } =
      req.body as {
        kind?: string;
        name?: string;
        phone?: string;
        organization?: string | null;
        empCode?: string | null;
        area?: string | null;
        adminCode?: string | null;
        adminRegistrationKey?: string | null;
      };

    if (!kind || !["admin", "staff"].includes(kind)) {
      res.status(400).json({
        title: "Invalid kind",
        detail: "kind must be 'admin' or 'staff'",
        status: 400,
      });
      return;
    }
    if (!name || name.trim().length < 2) {
      res.status(400).json({
        title: "Invalid name",
        detail: "name must be at least 2 characters",
        status: 400,
      });
      return;
    }
    if (!phone || !/^\d{10}$/.test(phone.trim())) {
      res.status(400).json({
        title: "Invalid phone",
        detail: "phone must be exactly 10 digits",
        status: 400,
      });
      return;
    }
    if (kind === "admin" && (!organization || organization.trim().length < 2)) {
      res.status(400).json({
        title: "Organization required",
        detail: "organization name is required for admin accounts",
        status: 400,
      });
      return;
    }

    // Admin registration key check — only validate if key is provided in request
    // (old APK versions don't have the key field, so we allow them through)
    if (kind === "admin") {
      const requiredKey = process.env.ADMIN_REGISTRATION_KEY;
      if (requiredKey && adminRegistrationKey && adminRegistrationKey.trim() !== requiredKey.trim()) {
        res.status(403).json({
          title: "Invalid admin key",
          detail: "The secret key you entered is incorrect. Admin registration requires a valid key.",
          status: 403,
        });
        return;
      }
    }

    // Check for duplicate phone.
    const existing = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(eq(staffTable.phone, phone.trim()))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        title: "Phone already registered",
        detail: "An account with this phone number already exists. Please sign in.",
        status: 409,
      });
      return;
    }

    // Auto-generate an empCode if not supplied.
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const resolvedEmpCode =
      empCode?.trim() ||
      (kind === "admin" ? `ADM-${suffix}` : `FS-${suffix}`);

    // Admins get a freshly-generated unique invite code (admin_code).
    // Staff never own an admin_code; instead, if they supply one during
    // registration we use it to look up the admin's organization so we can
    // copy it onto the staff record.
    let resolvedOrganization = organization?.trim() || null;
    const resolvedAdminCode =
      kind === "admin"
        ? Math.random().toString(36).slice(2, 8).toUpperCase()
        : null; // staff never store an admin_code

    if (kind === "staff" && adminCode?.trim()) {
      const [adminRow] = await db
        .select({ organization: staffTable.organization })
        .from(staffTable)
        .where(
          and(
            eq(staffTable.adminCode, adminCode.trim().toUpperCase()),
            eq(staffTable.role, "admin"),
          ),
        )
        .limit(1);
      if (adminRow?.organization) {
        resolvedOrganization = adminRow.organization;
      }
    }

    const [inserted] = await db
      .insert(staffTable)
      .values({
        empCode: resolvedEmpCode,
        name: name.trim(),
        phone: phone.trim(),
        role: kind === "admin" ? "admin" : "staff",
        organization: resolvedOrganization,
        area: area?.trim() || null,
        adminCode: resolvedAdminCode,
        // Admins are immediately approved; new staff must wait for admin approval.
        approvalStatus: kind === "admin" ? "approved" : "pending",
      })
      .returning();

    res.status(201).json(toStaffDTO(inserted));
  } catch (err) {
    next(err);
  }
});

// ─── Staff notes ──────────────────────────────────────────────────────────────

router.patch("/staff/:staffId/notes", async (req, res, next) => {
  try {
    const { staffId } = req.params;

    if (!/^[0-9a-fA-F-]{36}$/.test(staffId)) {
      res.status(400).json({ title: "Invalid staffId", status: 400 });
      return;
    }

    const { notes } = req.body as { notes?: string | null };

    // Ensure the staff member exists.
    const [existing] = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(eq(staffTable.id, staffId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

    const cleanNotes =
      typeof notes === "string" && notes.trim().length > 0
        ? notes.trim()
        : null;

    await db
      .update(staffTable)
      .set({ notes: cleanNotes })
      .where(eq(staffTable.id, staffId));

    res.json({ staffId, notes: cleanNotes });
  } catch (err) {
    next(err);
  }
});

// ─── Staff profile stats ──────────────────────────────────────────────────────

router.get("/staff/:staffId/profile-stats", async (req, res, next) => {
  try {
    const { staffId } = req.params;

    if (!/^[0-9a-fA-F-]{36}$/.test(staffId)) {
      res.status(400).json({ title: "Invalid staffId", status: 400 });
      return;
    }

    const [staffRow] = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.id, staffId))
      .limit(1);

    if (!staffRow) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

    // Fetch all trip-end events for this staff member.
    const events = await db
      .select({
        occurredAt: activityEventsTable.occurredAt,
        payload: activityEventsTable.payload,
        tripRef: activityEventsTable.tripRef,
        kind: activityEventsTable.kind,
      })
      .from(activityEventsTable)
      .where(
        and(
          eq(activityEventsTable.staffId, staffId),
          eq(activityEventsTable.kind, "trip-end"),
        ),
      );

    // Also fetch trip-start events for start time + location of recent trips.
    const startEvents = await db
      .select({
        tripRef: activityEventsTable.tripRef,
        occurredAt: activityEventsTable.occurredAt,
        payload: activityEventsTable.payload,
      })
      .from(activityEventsTable)
      .where(
        and(
          eq(activityEventsTable.staffId, staffId),
          eq(activityEventsTable.kind, "trip-start"),
        ),
      );

    const startByRef = new Map(
      startEvents.map((e) => [e.tripRef, e]),
    );

    const IST = 5.5 * 60 * 60 * 1000;
    const now = Date.now();
    const nowIST = new Date(now + IST);

    // Today window (IST midnight → now)
    const istToday = new Date(nowIST);
    istToday.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(istToday.getTime() - IST);

    // This month window (IST 1st of month → now)
    const istMonth = new Date(nowIST);
    istMonth.setUTCDate(1);
    istMonth.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(istMonth.getTime() - IST);

    const r7Start = new Date(now - 7 * 86_400_000);
    const r30Start = new Date(now - 30 * 86_400_000);

    type PeriodAcc = { rides: number; km: number };
    const periToday: PeriodAcc = { rides: 0, km: 0 };
    const periLast7: PeriodAcc = { rides: 0, km: 0 };
    const periLast30: PeriodAcc = { rides: 0, km: 0 };
    const periMonth: PeriodAcc = { rides: 0, km: 0 };

    const dayMap = new Map<string, { rideCount: number; totalKm: number }>();
    const monthMap = new Map<string, { year: number; month: number; rides: number; km: number }>();

    const round1 = (n: number) => Math.round(n * 10) / 10;

    let totalKm = 0;
    let firstRideDate: string | null = null;

    for (const ev of events) {
      const t = (ev.occurredAt as Date).getTime();
      const local = new Date(t + IST);
      const dateStr = local.toISOString().slice(0, 10);
      const p = (ev.payload || {}) as { distanceKm?: number };
      const km = typeof p.distanceKm === "number" ? p.distanceKm : 0;

      totalKm += km;

      // Day map
      const dayAcc = dayMap.get(dateStr);
      if (dayAcc) { dayAcc.rideCount++; dayAcc.totalKm += km; }
      else dayMap.set(dateStr, { rideCount: 1, totalKm: km });

      // Month map
      const mKey = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
      const mAcc = monthMap.get(mKey);
      if (mAcc) { mAcc.rides++; mAcc.km += km; }
      else monthMap.set(mKey, { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, rides: 1, km });

      // Period stats
      const occAt = ev.occurredAt as Date;
      if (occAt >= todayStart) { periToday.rides++; periToday.km += km; }
      if (occAt >= r7Start) { periLast7.rides++; periLast7.km += km; }
      if (occAt >= r30Start) { periLast30.rides++; periLast30.km += km; }
      if (occAt >= monthStart) { periMonth.rides++; periMonth.km += km; }

      // First ride
      if (!firstRideDate || dateStr < firstRideDate) firstRideDate = dateStr;
    }

    // Best day
    let bestDay: { date: string; rideCount: number; totalKm: number } | null = null;
    for (const [date, v] of dayMap.entries()) {
      if (!bestDay || v.rideCount > bestDay.rideCount) {
        bestDay = { date, rideCount: v.rideCount, totalKm: round1(v.totalKm) };
      }
    }

    // Monthly breakdown: last 6 calendar months (oldest first).
    const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthly: { year: number; month: number; label: string; rides: number; km: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      // Use day=1 to avoid month-overflow (e.g. April 29 → Feb 29 → March)
      const d = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth() - i, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const acc = monthMap.get(key) ?? { year: y, month: m, rides: 0, km: 0 };
      monthly.push({
        year: acc.year,
        month: acc.month,
        label: `${MONTH_LABELS[m - 1]} ${y}`,
        rides: acc.rides,
        km: round1(acc.km),
      });
    }

    // Recent 10 trips (newest first)
    const sorted = [...events].sort(
      (a, b) =>
        (b.occurredAt as Date).getTime() - (a.occurredAt as Date).getTime(),
    );
    const recentTrips = sorted.slice(0, 10).map((ev) => {
      const t = (ev.occurredAt as Date).getTime();
      const local = new Date(t + IST);
      const dateStr = local.toISOString().slice(0, 10);
      const endP = (ev.payload || {}) as {
        distanceKm?: number;
        location?: { latitude: number; longitude: number } | null;
      };
      const startEv = startByRef.get(ev.tripRef ?? "");
      const startP = startEv
        ? ((startEv.payload || {}) as {
            location?: { latitude: number; longitude: number } | null;
          })
        : null;
      const fmtLoc = (loc?: { latitude: number; longitude: number } | null) =>
        loc ? `${loc.latitude.toFixed(3)}, ${loc.longitude.toFixed(3)}` : null;
      return {
        tripRef: ev.tripRef ?? "",
        rideDate: dateStr,
        startTime: startEv
          ? (startEv.occurredAt as Date).toISOString()
          : (ev.occurredAt as Date).toISOString(),
        endTime: (ev.occurredAt as Date).toISOString(),
        distanceKm:
          typeof endP.distanceKm === "number" ? endP.distanceKm : null,
        startLocation: fmtLoc(startP?.location),
        endLocation: fmtLoc(endP.location),
      };
    });

    const lifetimeTotalRides = events.length;
    const lifetimeTotalKm = round1(totalKm);
    const lifetimeAvgKmPerRide =
      lifetimeTotalRides > 0 ? round1(totalKm / lifetimeTotalRides) : 0;

    res.json({
      staffId: staffRow.id,
      name: staffRow.name,
      empCode: staffRow.empCode,
      phone: staffRow.phone,
      role: staffRow.role,
      organization: staffRow.organization ?? null,
      area: staffRow.area ?? null,
      notes: staffRow.notes ?? null,
      lifetimeTotalRides,
      lifetimeTotalKm,
      lifetimeAvgKmPerRide,
      lifetimeActiveDays: dayMap.size,
      firstRideDate,
      periodToday: { rides: periToday.rides, km: round1(periToday.km) },
      periodLast7Days: { rides: periLast7.rides, km: round1(periLast7.km) },
      periodLast30Days: { rides: periLast30.rides, km: round1(periLast30.km) },
      periodThisMonth: { rides: periMonth.rides, km: round1(periMonth.km) },
      bestDay,
      monthly,
      recentTrips,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Admin approval workflow ───────────────────────────────────────────────────

router.get("/admin/pending-staff", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.approvalStatus, "pending"))
      .orderBy(staffTable.createdAt);
    res.json(rows.map(toStaffDTO));
  } catch (err) {
    next(err);
  }
});

router.patch("/admin/staff/:staffId/approve", async (req, res, next) => {
  try {
    const { staffId } = req.params;
    if (!/^[0-9a-fA-F-]{36}$/.test(staffId)) {
      res.status(400).json({ title: "Invalid staffId", status: 400 });
      return;
    }
    const [updated] = await db
      .update(staffTable)
      .set({ approvalStatus: "approved" })
      .where(eq(staffTable.id, staffId))
      .returning();
    if (!updated) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }
    res.json(toStaffDTO(updated));
  } catch (err) {
    next(err);
  }
});

router.patch("/admin/staff/:staffId/reject", async (req, res, next) => {
  try {
    const { staffId } = req.params;
    if (!/^[0-9a-fA-F-]{36}$/.test(staffId)) {
      res.status(400).json({ title: "Invalid staffId", status: 400 });
      return;
    }
    const [updated] = await db
      .update(staffTable)
      .set({ approvalStatus: "rejected" })
      .where(eq(staffTable.id, staffId))
      .returning();
    if (!updated) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }
    res.json(toStaffDTO(updated));
  } catch (err) {
    next(err);
  }
});

// ─── Password helpers (scrypt, no extra deps) ─────────────────────────────────
function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(plain, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(hash));
}

// ─── POST /api/staff/change-password ─────────────────────────────────────────
// Body: { phone, currentPassword?, newPassword }
// If currentPassword is omitted and no password is set yet, this sets the first password.
// Otherwise, currentPassword must match the stored hash.
router.post("/staff/change-password", async (req, res, next) => {
  try {
    const { phone, currentPassword, newPassword } = req.body as {
      phone?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    if (!phone?.trim() || !newPassword?.trim()) {
      res.status(400).json({ title: "phone and newPassword are required", status: 400 });
      return;
    }
    if (newPassword.trim().length < 4) {
      res.status(400).json({ title: "Password must be at least 4 characters", status: 400 });
      return;
    }

    const [row] = await db
      .select({ id: staffTable.id, passwordHash: staffTable.passwordHash })
      .from(staffTable)
      .where(eq(staffTable.phone, phone.trim()))
      .limit(1);

    if (!row) {
      res.status(404).json({ title: "Account not found", status: 404 });
      return;
    }

    // If a password is already set, require the current one.
    if (row.passwordHash) {
      if (!currentPassword) {
        res.status(401).json({ title: "Current password required", status: 401 });
        return;
      }
      if (!verifyPassword(currentPassword, row.passwordHash)) {
        res.status(401).json({ title: "Current password is incorrect", status: 401 });
        return;
      }
    }

    const newHash = hashPassword(newPassword.trim());
    await db
      .update(staffTable)
      .set({ passwordHash: newHash })
      .where(eq(staffTable.id, row.id));

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/staff/has-password?phone=xxx ────────────────────────────────────
// Returns whether this phone number has a password set.
router.get("/staff/has-password", async (req, res, next) => {
  try {
    const phone = (req.query["phone"] as string | undefined)?.trim();
    if (!phone) {
      res.status(400).json({ title: "phone query required", status: 400 });
      return;
    }
    const [row] = await db
      .select({ passwordHash: staffTable.passwordHash })
      .from(staffTable)
      .where(eq(staffTable.phone, phone))
      .limit(1);

    res.json({ hasPassword: !!(row?.passwordHash) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/staff/daily-report?staffId=...&date=YYYY-MM-DD ─────────────────
// Returns today's field summary for a staff member (for WhatsApp share).

router.get("/staff/daily-report", async (req, res, next) => {
  try {
    const { staffId, date } = req.query as { staffId?: string; date?: string };
    if (!staffId) {
      res.status(400).json({ title: "staffId required", status: 400 });
      return;
    }

    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${targetDate}T00:00:00Z`);
    const dayEnd = new Date(`${targetDate}T23:59:59.999Z`);

    // Staff details
    const [staffRow] = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.id, staffId))
      .limit(1);

    if (!staffRow) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

    // Today's activity events for this staff
    const events = await db
      .select()
      .from(activityEventsTable)
      .where(
        and(
          eq(activityEventsTable.staffId, staffId),
          gte(activityEventsTable.occurredAt, dayStart),
          lt(activityEventsTable.occurredAt, dayEnd),
        ),
      )
      .orderBy(activityEventsTable.occurredAt);

    const checkIn = events.find((e) => e.kind === "checkin");
    const checkOut = events.find((e) => e.kind === "checkout");
    const tripEnds = events.filter((e) => e.kind === "trip-end");
    const tripCount = tripEnds.length;

    let totalKm = 0;
    for (const te of tripEnds) {
      const p = te.payload as Record<string, unknown>;
      const km = typeof p["km"] === "number" ? p["km"] : parseFloat(String(p["km"] ?? 0));
      if (!isNaN(km)) totalKm += km;
    }

    // Candidates submitted by this staff today
    const [candRow] = await db
      .select({ count: sql<number>`count(*)::int`.as("count") })
      .from(candidatesTable)
      .where(
        and(
          eq(candidatesTable.submittedByPhone, staffRow.phone),
          gte(candidatesTable.createdAt, dayStart),
          lt(candidatesTable.createdAt, dayEnd),
        ),
      );

    const totalCandidates = candRow?.count ?? 0;

    // Pending/verified for this staff (all time totals too)
    const candStatusRows = await db
      .select({
        status: candidatesTable.status,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(candidatesTable)
      .where(eq(candidatesTable.submittedByPhone, staffRow.phone))
      .groupBy(candidatesTable.status);

    const candByStatus: Record<string, number> = {};
    for (const r of candStatusRows) {
      candByStatus[r.status] = r.count;
    }

    res.json({
      staffName: staffRow.name,
      empCode: staffRow.empCode,
      phone: staffRow.phone,
      date: targetDate,
      checkInTime: checkIn?.occurredAt?.toISOString() ?? null,
      checkOutTime: checkOut?.occurredAt?.toISOString() ?? null,
      totalCandidatesToday: totalCandidates,
      tripCount,
      totalKm: parseFloat(totalKm.toFixed(2)),
      candPending: candByStatus["pending"] ?? 0,
      candVerified: candByStatus["verified"] ?? 0,
      candEnrolled: candByStatus["enrolled"] ?? 0,
      candRejected: candByStatus["rejected"] ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Real-time location ping ────────────────────────────────────────────────
// Staff device calls this every ~30 s while checked in to update their live
// position on the admin map.
router.post("/staff/ping-location", async (req, res, next) => {
  try {
    const { staffId, lat, lng } = req.body as {
      staffId?: unknown;
      lat?: unknown;
      lng?: unknown;
    };
    if (
      typeof staffId !== "string" ||
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !staffId.trim()
    ) {
      res.status(400).json({ title: "staffId (string), lat and lng (numbers) required", status: 400 });
      return;
    }
    await db
      .update(staffTable)
      .set({ lastLat: lat, lastLng: lng, lastLocationAt: new Date() })
      .where(eq(staffTable.id, staffId));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
