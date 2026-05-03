import { candidatesTable, companiesTable, db, staffTable, activityEventsTable } from "@workspace/db";
import { eq, and, gte, lt, isNull, sql, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { requireAdmin } from "./admin";

const router: IRouter = Router();

export function toStaffDTO(r: typeof staffTable.$inferSelect) {
  return {
    id: r.id,
    companyId: r.companyId ?? null,
    empCode: r.empCode,
    name: r.name,
    phone: r.phone,
    role: r.role,
    organization: r.organization ?? null,
    centerName: r.centerName ?? null,
    projectName: r.projectName ?? null,
    email: r.email ?? null,
    state: r.state ?? null,
    district: r.district ?? null,
    area: r.area ?? null,
    adminCode: r.adminCode ?? null,
    approvalStatus: r.approvalStatus,
    createdAt: r.createdAt?.toISOString() ?? null,
    vehicleType: r.vehicleType ?? null,
    vehicleNumber: r.vehicleNumber ?? null,
    disabledAt: r.disabledAt?.toISOString() ?? null,
    staffCategory: r.staffCategory ?? "field",
    centerStaffRole: r.centerStaffRole ?? null,
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
    const {
      kind, name, phone, organization, centerName, projectName, email, state, district,
      empCode, area, adminCode, adminRegistrationKey, companyId,
    } = req.body as {
      kind?: string;
      name?: string;
      phone?: string;
      organization?: string | null;
      centerName?: string | null;
      projectName?: string | null;
      email?: string | null;
      state?: string | null;
      district?: string | null;
      empCode?: string | null;
      area?: string | null;
      adminCode?: string | null;
      adminRegistrationKey?: string | null;
      companyId?: string | null;
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
    // Admin registration key — always required and always validated
    if (kind === "admin") {
      const requiredKey = process.env.ADMIN_REGISTRATION_KEY;
      if (!adminRegistrationKey || !adminRegistrationKey.trim()) {
        res.status(403).json({
          title: "Secret key required",
          detail: "Admin registration ke liye secret key zaroori hai.",
          status: 403,
        });
        return;
      }
      if (requiredKey && adminRegistrationKey.trim() !== requiredKey.trim()) {
        res.status(403).json({
          title: "Galat secret key",
          detail: "Aapne jo secret key daali woh galat hai. Sahi key daalen.",
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
    // Validate email if provided
    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({
        title: "Invalid email",
        detail: "Please enter a valid email address",
        status: 400,
      });
      return;
    }

    let resolvedOrganization = organization?.trim() || null;
    let resolvedCompanyId: string | null = companyId?.trim() || null;
    const resolvedAdminCode =
      kind === "admin"
        ? Math.random().toString(36).slice(2, 8).toUpperCase()
        : null; // staff never store an admin_code

    if (kind === "staff" && adminCode?.trim()) {
      // Look up admin by adminCode — copy their organization AND company_id
      const [adminRow] = await db
        .select({ organization: staffTable.organization, companyId: staffTable.companyId })
        .from(staffTable)
        .where(
          and(
            eq(staffTable.adminCode, adminCode.trim().toUpperCase()),
            eq(staffTable.role, "admin"),
          ),
        )
        .limit(1);
      if (adminRow?.organization) resolvedOrganization = adminRow.organization;
      if (adminRow?.companyId) resolvedCompanyId = adminRow.companyId;
    }

    // If admin registration and no companyId, auto-create a company
    if (kind === "admin" && !resolvedCompanyId) {
      const [newCompany] = await db
        .insert(companiesTable)
        .values({
          name: resolvedOrganization || name.trim(),
          adminName: name.trim(),
          phone: phone.trim(),
          email: email?.trim() || null,
          state: state?.trim() || null,
          district: district?.trim() || null,
          projectName: projectName?.trim() || null,
        })
        .returning();
      resolvedCompanyId = newCompany.id;
    }

    const [inserted] = await db
      .insert(staffTable)
      .values({
        companyId: resolvedCompanyId,
        empCode: resolvedEmpCode,
        name: name.trim(),
        phone: phone.trim(),
        role: kind === "admin" ? "admin" : "staff",
        organization: resolvedOrganization,
        centerName: centerName?.trim() || null,
        projectName: projectName?.trim() || null,
        email: email?.trim() || null,
        state: state?.trim() || null,
        district: district?.trim() || null,
        area: area?.trim() || null,
        adminCode: resolvedAdminCode,
        approvalStatus: "pending",
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

    // Fetch checkin/checkout events to get odometer photo URIs (keyed by date)
    const attendEvents = await db
      .select({
        kind: activityEventsTable.kind,
        occurredAt: activityEventsTable.occurredAt,
        payload: activityEventsTable.payload,
      })
      .from(activityEventsTable)
      .where(
        and(
          eq(activityEventsTable.staffId, staffId),
          inArray(activityEventsTable.kind, ["checkin", "checkout"]),
        ),
      );

    // Build: dateStr (IST) → { checkinPhotoUri, checkoutPhotoUri }
    const IST_MS = 5.5 * 60 * 60 * 1000;
    type DayPhotos = { checkinPhotoUri: string | null; checkoutPhotoUri: string | null };
    const photoByDate = new Map<string, DayPhotos>();
    for (const ev of attendEvents) {
      const dateStr = new Date((ev.occurredAt as Date).getTime() + IST_MS).toISOString().slice(0, 10);
      const p = (ev.payload || {}) as { vehicleMeterPhotoUri?: string | null };
      const existing = photoByDate.get(dateStr) ?? { checkinPhotoUri: null, checkoutPhotoUri: null };
      if (ev.kind === "checkin" && p.vehicleMeterPhotoUri) {
        existing.checkinPhotoUri = p.vehicleMeterPhotoUri;
      }
      if (ev.kind === "checkout" && p.vehicleMeterPhotoUri) {
        existing.checkoutPhotoUri = p.vehicleMeterPhotoUri;
      }
      photoByDate.set(dateStr, existing);
    }

    const startByRef = new Map(
      startEvents.map((e) => [e.tripRef, e]),
    );

    const IST = IST_MS;
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
      const photos = photoByDate.get(dateStr) ?? { checkinPhotoUri: null, checkoutPhotoUri: null };
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
        checkinMeterPhotoUri: photos.checkinPhotoUri,
        checkoutMeterPhotoUri: photos.checkoutPhotoUri,
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
      approvalStatus: staffRow.approvalStatus ?? "pending",
      organization: staffRow.organization ?? null,
      centerName: staffRow.centerName ?? null,
      projectName: staffRow.projectName ?? null,
      email: staffRow.email ?? null,
      state: staffRow.state ?? null,
      district: staffRow.district ?? null,
      area: staffRow.area ?? null,
      vehicleType: staffRow.vehicleType ?? null,
      vehicleNumber: staffRow.vehicleNumber ?? null,
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

// ─── GET /api/staff/km-history ────────────────────────────────────────────────
// Returns last N days of daily vehicle KM vs GPS KM for a staff member.
// Query: staffId (uuid, required), days (integer, default 30)

router.get("/staff/km-history", async (req, res, next) => {
  try {
    const rawStaffId = req.query.staffId as string | undefined;
    const rawDays    = req.query.days    as string | undefined;

    if (!rawStaffId || !/^[0-9a-fA-F-]{36}$/.test(rawStaffId)) {
      res.status(400).json({ title: "Invalid staffId", status: 400 });
      return;
    }

    const days = Math.min(90, Math.max(1, parseInt(rawDays ?? "30", 10) || 30));
    const since = new Date(Date.now() - days * 86_400_000);
    const IST_MS = 5.5 * 60 * 60 * 1000;

    // Fetch checkin/checkout events in window
    const attendRows = await db
      .select({ kind: activityEventsTable.kind, occurredAt: activityEventsTable.occurredAt, payload: activityEventsTable.payload })
      .from(activityEventsTable)
      .where(
        and(
          eq(activityEventsTable.staffId, rawStaffId),
          inArray(activityEventsTable.kind, ["checkin", "checkout"]),
          gte(activityEventsTable.occurredAt, since),
        ),
      );

    // Fetch trip-end events for GPS KM
    const tripRows = await db
      .select({ occurredAt: activityEventsTable.occurredAt, payload: activityEventsTable.payload })
      .from(activityEventsTable)
      .where(
        and(
          eq(activityEventsTable.staffId, rawStaffId),
          eq(activityEventsTable.kind, "trip-end"),
          gte(activityEventsTable.occurredAt, since),
        ),
      );

    // Build per-day odometer map
    type OdoDay = { startOdometerKm: number | null; endOdometerKm: number | null };
    const odoMap = new Map<string, OdoDay>();
    for (const row of attendRows) {
      const dateStr = new Date((row.occurredAt as Date).getTime() + IST_MS).toISOString().slice(0, 10);
      const p = (row.payload || {}) as { startOdometerKm?: number | null; endOdometerKm?: number | null };
      const existing = odoMap.get(dateStr) ?? { startOdometerKm: null, endOdometerKm: null };
      if (row.kind === "checkin"  && p.startOdometerKm != null) existing.startOdometerKm = p.startOdometerKm;
      if (row.kind === "checkout" && p.endOdometerKm   != null) existing.endOdometerKm   = p.endOdometerKm;
      odoMap.set(dateStr, existing);
    }

    // Build per-day GPS KM map
    type GpsDay = { gpsKm: number; tripCount: number };
    const gpsMap = new Map<string, GpsDay>();
    for (const row of tripRows) {
      const dateStr = new Date((row.occurredAt as Date).getTime() + IST_MS).toISOString().slice(0, 10);
      const p = (row.payload || {}) as { distanceKm?: number | null };
      const km = typeof p.distanceKm === "number" ? p.distanceKm : 0;
      const acc = gpsMap.get(dateStr) ?? { gpsKm: 0, tripCount: 0 };
      acc.gpsKm += km;
      acc.tripCount++;
      gpsMap.set(dateStr, acc);
    }

    // Merge into entries (all dates that have any data)
    const allDates = new Set([...odoMap.keys(), ...gpsMap.keys()]);
    const round1 = (n: number) => Math.round(n * 10) / 10;

    const entries = Array.from(allDates).sort((a, b) => b.localeCompare(a)).map((date) => {
      const odo = odoMap.get(date) ?? { startOdometerKm: null, endOdometerKm: null };
      const gps = gpsMap.get(date) ?? { gpsKm: 0, tripCount: 0 };

      let vehicleKm: number | null = null;
      if (odo.startOdometerKm != null && odo.endOdometerKm != null && odo.endOdometerKm >= odo.startOdometerKm) {
        vehicleKm = round1(odo.endOdometerKm - odo.startOdometerKm);
      }

      let variancePct: number | null = null;
      if (vehicleKm != null && gps.gpsKm > 0) {
        variancePct = round1(Math.abs(vehicleKm - gps.gpsKm) / vehicleKm * 100);
      }

      return {
        date,
        startOdometerKm: odo.startOdometerKm,
        endOdometerKm:   odo.endOdometerKm,
        vehicleKm,
        tripCount: gps.tripCount,
        gpsKm:     round1(gps.gpsKm),
        variancePct,
      };
    });

    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

// ─── Admin approval workflow ───────────────────────────────────────────────────

router.get("/admin/pending-staff", requireAdmin, async (_req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const adminRole = res.locals.adminRole as string;
    // Regular admin: see pending staff (role="staff") in their company only
    // Super admin: see pending admins (role="admin") across all companies
    const rows = await db
      .select()
      .from(staffTable)
      .where(
        companyId
          ? and(
              eq(staffTable.approvalStatus, "pending"),
              eq(staffTable.companyId, companyId),
              eq(staffTable.role, "staff"),
            )
          : and(
              eq(staffTable.approvalStatus, "pending"),
              eq(staffTable.role, adminRole === "super_admin" ? "admin" : "staff"),
            ),
      )
      .orderBy(staffTable.createdAt);
    res.json(rows.map(toStaffDTO));
  } catch (err) {
    next(err);
  }
});

router.patch("/admin/staff/:staffId/approve", requireAdmin, async (req, res, next) => {
  try {
    const rawId = String(req.params.staffId ?? "");
    const companyId = res.locals.companyId as string | null;
    if (!/^[0-9a-fA-F-]{36}$/.test(rawId)) {
      res.status(400).json({ title: "Invalid staffId", status: 400 });
      return;
    }
    const [updated] = await db
      .update(staffTable)
      .set({ approvalStatus: "approved" })
      .where(
        companyId
          ? and(eq(staffTable.id, rawId), eq(staffTable.companyId, companyId))
          : eq(staffTable.id, rawId),
      )
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

router.patch("/admin/staff/:staffId/reject", requireAdmin, async (req, res, next) => {
  try {
    const rawId = String(req.params.staffId ?? "");
    const companyId = res.locals.companyId as string | null;
    if (!/^[0-9a-fA-F-]{36}$/.test(rawId)) {
      res.status(400).json({ title: "Invalid staffId", status: 400 });
      return;
    }
    const [updated] = await db
      .update(staffTable)
      .set({ approvalStatus: "rejected" })
      .where(
        companyId
          ? and(eq(staffTable.id, rawId), eq(staffTable.companyId, companyId))
          : eq(staffTable.id, rawId),
      )
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

// ─── PATCH /api/staff/profile ─────────────────────────────────────────────────
// Update admin/staff profile fields
// Body: { phone, name?, email?, organization?, centerName?, projectName?, state?, district? }
router.patch("/staff/profile", async (req, res, next) => {
  try {
    const { phone, name, email, organization, centerName, projectName, state, district, vehicleType, vehicleNumber } =
      req.body as {
        phone?: string;
        name?: string;
        email?: string | null;
        organization?: string | null;
        centerName?: string | null;
        projectName?: string | null;
        state?: string | null;
        district?: string | null;
        vehicleType?: "2-wheeler" | "4-wheeler" | null;
        vehicleNumber?: string | null;
      };

    if (!phone || !/^\d{10}$/.test(phone.trim())) {
      res.status(400).json({ title: "Invalid phone", status: 400 });
      return;
    }

    if (name !== undefined && name.trim().length < 2) {
      res.status(400).json({ title: "Name too short", detail: "Name must be at least 2 characters", status: 400 });
      return;
    }

    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ title: "Invalid email", detail: "Please enter a valid email address", status: 400 });
      return;
    }

    const [existing] = await db
      .select({ id: staffTable.id, staffCategory: staffTable.staffCategory, centerStaffRole: staffTable.centerStaffRole })
      .from(staffTable)
      .where(and(eq(staffTable.phone, phone.trim()), isNull(staffTable.deletedAt)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ title: "Staff not found", status: 404 });
      return;
    }

    const { staffCategory, centerStaffRole } = req.body as {
      staffCategory?: "field" | "center" | null;
      centerStaffRole?: string | null;
    };

    const updates: Partial<typeof staffTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email?.trim() || null;
    if (organization !== undefined) updates.organization = organization?.trim() || null;
    if (centerName !== undefined) updates.centerName = centerName?.trim() || null;
    if (projectName !== undefined) updates.projectName = projectName?.trim() || null;
    if (state !== undefined) updates.state = state?.trim() || null;
    if (district !== undefined) updates.district = district?.trim() || null;
    if (vehicleType !== undefined) updates.vehicleType = vehicleType ?? null;
    if (vehicleNumber !== undefined) updates.vehicleNumber = vehicleNumber?.trim() || null;
    if (staffCategory !== undefined && (staffCategory === "field" || staffCategory === "center")) {
      updates.staffCategory = staffCategory;
    }
    if (centerStaffRole !== undefined) updates.centerStaffRole = centerStaffRole?.trim() || null;
    // Enforce: center staff must have a role — reject explicit role clear when category is center
    if ((updates.staffCategory ?? existing.staffCategory) === "center") {
      const finalRole = updates.centerStaffRole ?? existing.centerStaffRole;
      if (!finalRole?.trim()) {
        res.status(400).json({ title: "centerStaffRole is required when staffCategory is center", status: 400 });
        return;
      }
    }

    const [updated] = await db
      .update(staffTable)
      .set(updates)
      .where(eq(staffTable.id, existing.id))
      .returning();

    res.json(toStaffDTO(updated));
  } catch (err) {
    next(err);
  }
});

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
