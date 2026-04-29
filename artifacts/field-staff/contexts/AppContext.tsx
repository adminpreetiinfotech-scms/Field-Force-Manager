import AsyncStorage from "@react-native-async-storage/async-storage";
import { listStaff, registerStaff } from "@workspace/api-client-react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  drainActivityQueue,
  enqueueActivity,
  initActivityQueue,
} from "@/services/activitySync";

export type UserRole = "staff" | "admin";

export type User = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  empCode: string;
};

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type AttendanceRecord = {
  id: string;
  staffId: string;
  staffName: string;
  type: "in" | "out";
  timestamp: number;
  location: GeoPoint | null;
  selfieUri: string | null;
  synced: boolean;
};

export type MeterReading = {
  id: string;
  staffId: string;
  staffName: string;
  consumerNo: string;
  reading: number;
  photoUri: string | null;
  location: GeoPoint | null;
  timestamp: number;
  synced: boolean;
  notes?: string;
};

export type TripPoint = {
  latitude: number;
  longitude: number;
  t: number;
};

export type Trip = {
  id: string;
  staffId: string;
  staffName?: string;
  date: string;
  km: number;
  startedAt: number;
  endedAt: number | null;
  start: GeoPoint | null;
  end: GeoPoint | null;
  path: TripPoint[];
  synced: boolean;
};

export type StaffLocation = {
  staffId: string;
  staffName: string;
  empCode: string;
  location: GeoPoint;
  status: "in" | "out";
  updatedAt: number;
};

export type RegisterData = {
  kind: "admin" | "staff";
  name: string;
  phone: string;
  organization?: string;
  empCode?: string;
  area?: string;
  adminCode?: string;
};

type AppState = {
  bootstrapped: boolean;
  user: User | null;
  /** Phone number waiting for OTP during a login flow. */
  pendingPhone: string | null;
  /** User record created during registration, waiting for OTP verification. */
  pendingRegistration: { user: User; approvalStatus: string } | null;
  attendance: AttendanceRecord[];
  meterReadings: MeterReading[];
  trips: Trip[];
  staffLocations: StaffLocation[];
  activeTripId: string | null;
  unsyncedCount: number;
};

type AppActions = {
  register: (data: RegisterData) => Promise<User>;
  requestOtp: (phone: string) => Promise<string>;
  verifyOtp: (otp: string) => Promise<User>;
  signOut: () => Promise<void>;
  addAttendance: (
    record: Omit<AttendanceRecord, "id" | "synced">,
  ) => Promise<AttendanceRecord>;
  addMeterReading: (
    reading: Omit<MeterReading, "id" | "synced">,
  ) => Promise<MeterReading>;
  startTrip: (start: GeoPoint | null) => Promise<Trip>;
  endTrip: (km: number, end: GeoPoint | null) => Promise<void>;
  updateActiveTripKm: (km: number) => void;
  appendTripPoint: (point: GeoPoint) => void;
  switchRole: (target: "admin" | "staff") => Promise<User>;
  syncNow: () => Promise<void>;
  updateStaffLocation: (loc: GeoPoint) => void;
};

type AppContextValue = AppState & AppActions;

const STORAGE_KEY = "@field-staff/state-v1";

const seedAdminPhone = "9999999999";

// Real UUIDs from the DB seed — must match lib/db/src/seed.ts.
// These map known demo phone numbers → server-side staff IDs so that
// POST /api/activity passes the server's UUID validation.
const KNOWN_STAFF_UUID: Record<string, string> = {
  "9999999999": "4d3dc022-5b1a-420e-8fab-e1e2c1a7ef32", // Anita Sharma (admin)
  "9876543210": "6243497b-3975-4d8b-a1e9-197254bdc949", // Demo Field Staff
  "9876500001": "0041da62-a0f0-445f-a7e2-b4275ed0bcc0", // Ramesh Kumar
  "9876500002": "6f0d246d-6983-44e3-b7d6-dab45d502290", // Sita Devi
  "9876500003": "d8459c20-9711-4dde-ab94-b7cb56ff411d", // Arjun Singh
  "9876500004": "48700257-8989-4de0-850e-3ff04fa679a2", // Pooja Verma
};

type SeedPeer = {
  staffId: string;
  staffName: string;
  empCode: string;
  status: "in" | "out";
  startedMinutesAgo: number;
  endedMinutesAgo: number | null;
  origin: GeoPoint;
  pointCount: number;
  jitter: number;
};

const SEED_PEERS: SeedPeer[] = [
  {
    staffId: "S-2041",
    staffName: "Ramesh Kumar",
    empCode: "FS-2041",
    status: "in",
    startedMinutesAgo: 220,
    endedMinutesAgo: null,
    origin: { latitude: 28.6139, longitude: 77.209 },
    pointCount: 36,
    jitter: 0.001,
  },
  {
    staffId: "S-2042",
    staffName: "Sita Devi",
    empCode: "FS-2042",
    status: "in",
    startedMinutesAgo: 195,
    endedMinutesAgo: null,
    origin: { latitude: 28.605, longitude: 77.2 },
    pointCount: 32,
    jitter: 0.0009,
  },
  {
    staffId: "S-2043",
    staffName: "Arjun Singh",
    empCode: "FS-2043",
    status: "out",
    startedMinutesAgo: 320,
    endedMinutesAgo: 38,
    origin: { latitude: 28.622, longitude: 77.218 },
    pointCount: 42,
    jitter: 0.0011,
  },
  {
    staffId: "S-2044",
    staffName: "Pooja Verma",
    empCode: "FS-2044",
    status: "in",
    startedMinutesAgo: 165,
    endedMinutesAgo: null,
    origin: { latitude: 28.618, longitude: 77.2 },
    pointCount: 28,
    jitter: 0.0008,
  },
];

function haversineKm(a: GeoPoint, b: GeoPoint) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Deterministic pseudo-random so each peer always has the same demo trail.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPath(
  origin: GeoPoint,
  startedAt: number,
  endedAt: number,
  count: number,
  jitter: number,
  seed: number,
): TripPoint[] {
  const rand = mulberry32(seed);
  const span = endedAt - startedAt;
  const radius = jitter * 18; // overall route reach
  const points: TripPoint[] = [];
  // Walk along a wandering loop so the trail looks like a real shift route.
  let lat = origin.latitude;
  let lng = origin.longitude;
  let heading = rand() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const progress = i / Math.max(1, count - 1);
    heading += (rand() - 0.5) * 0.9;
    const step = jitter * (0.6 + rand() * 0.9);
    lat += Math.cos(heading) * step;
    lng += Math.sin(heading) * step;
    // Gently pull back toward origin so the path stays around the area
    lat += (origin.latitude - lat) * 0.04 * progress;
    lng += (origin.longitude - lng) * 0.04 * progress;
    // Light final convergence near route end (so end pin sits inside a cluster)
    const drift = (rand() - 0.5) * jitter * 0.4;
    points.push({
      latitude: lat + drift,
      longitude: lng + drift,
      t: startedAt + Math.floor(span * progress),
    });
    // small bound check
    if (Math.abs(lat - origin.latitude) > radius) lat = origin.latitude + (rand() - 0.5) * radius;
    if (Math.abs(lng - origin.longitude) > radius) lng = origin.longitude + (rand() - 0.5) * radius;
  }
  return points;
}

function pathDistanceKm(points: TripPoint[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total;
}

function seedDemoData(): { staffLocations: StaffLocation[]; trips: Trip[] } {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const staffLocations: StaffLocation[] = [];
  const trips: Trip[] = [];
  SEED_PEERS.forEach((peer, idx) => {
    const startedAt = now - peer.startedMinutesAgo * 60_000;
    const endedAt =
      peer.endedMinutesAgo !== null ? now - peer.endedMinutesAgo * 60_000 : now;
    const path = buildPath(
      peer.origin,
      startedAt,
      endedAt,
      peer.pointCount,
      peer.jitter,
      idx * 9973 + 7,
    );
    const last = path[path.length - 1] || { latitude: peer.origin.latitude, longitude: peer.origin.longitude };
    staffLocations.push({
      staffId: peer.staffId,
      staffName: peer.staffName,
      empCode: peer.empCode,
      location: { latitude: last.latitude, longitude: last.longitude },
      status: peer.status,
      updatedAt: peer.endedMinutesAgo !== null ? now - peer.endedMinutesAgo * 60_000 : now - (idx + 1) * 60_000,
    });
    trips.push({
      id: `demo-trip-${peer.staffId}`,
      staffId: peer.staffId,
      staffName: peer.staffName,
      date: today,
      km: Number(pathDistanceKm(path).toFixed(2)),
      startedAt,
      endedAt: peer.endedMinutesAgo !== null ? endedAt : null,
      start: path[0]
        ? { latitude: path[0].latitude, longitude: path[0].longitude }
        : null,
      end:
        peer.endedMinutesAgo !== null && path.length > 0
          ? { latitude: last.latitude, longitude: last.longitude }
          : null,
      path,
      synced: peer.endedMinutesAgo !== null,
    });
  });
  return { staffLocations, trips };
}

const defaultState: AppState = {
  bootstrapped: false,
  user: null,
  pendingPhone: null,
  pendingRegistration: null,
  attendance: [],
  meterReadings: [],
  trips: [],
  staffLocations: [],
  activeTripId: null,
  unsyncedCount: 0,
};

const AppContext = createContext<AppContextValue | null>(null);

function genId() {
  // RFC 4122 UUID v4 — safe on all Expo/React Native targets.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist to AsyncStorage on changes.
  useEffect(() => {
    if (!state.bootstrapped) return;
    const toPersist = {
      user: state.user,
      attendance: state.attendance,
      meterReadings: state.meterReadings,
      trips: state.trips,
      activeTripId: state.activeTripId,
      staffLocations: state.staffLocations,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist)).catch(() => {});
  }, [
    state.bootstrapped,
    state.user,
    state.attendance,
    state.meterReadings,
    state.trips,
    state.activeTripId,
    state.staffLocations,
  ]);

  // Initialise the offline activity queue on mount.
  useEffect(() => {
    initActivityQueue().catch(() => {});
  }, []);

  // Load on mount. Demo trips/locations are re-seeded each session so the
  // route replay always shows fresh "today" data even after midnight.
  useEffect(() => {
    (async () => {
      const seeded = seedDemoData();
      const today = new Date().toISOString().slice(0, 10);
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Drop any stale demo trips and replace with fresh seed trips for today.
          const userTrips = (parsed.trips || []).filter(
            (t: Trip) => !t.id.startsWith("demo-trip-") || t.date !== today,
          );
          setState((s) => ({
            ...s,
            ...parsed,
            trips: [...seeded.trips, ...userTrips],
            staffLocations:
              parsed.staffLocations && parsed.staffLocations.length > 0
                ? parsed.staffLocations.map((sl: StaffLocation) => {
                    const fresh = seeded.staffLocations.find(
                      (s2) => s2.staffId === sl.staffId,
                    );
                    return fresh || sl;
                  })
                : seeded.staffLocations,
            bootstrapped: true,
          }));
        } else {
          setState((s) => ({
            ...s,
            staffLocations: seeded.staffLocations,
            trips: seeded.trips,
            bootstrapped: true,
          }));
        }
      } catch {
        setState((s) => ({
          ...s,
          staffLocations: seeded.staffLocations,
          trips: seeded.trips,
          bootstrapped: true,
        }));
      }
    })();
  }, []);

  // Auto-sync after a short delay whenever new unsynced items appear (mocked).
  useEffect(() => {
    const unsynced =
      state.attendance.filter((a) => !a.synced).length +
      state.meterReadings.filter((m) => !m.synced).length +
      state.trips.filter((t) => !t.synced && t.endedAt !== null).length;
    setState((s) => (s.unsyncedCount === unsynced ? s : { ...s, unsyncedCount: unsynced }));
    if (unsynced === 0) return;
    const t = setTimeout(() => {
      setState((s) => ({
        ...s,
        attendance: s.attendance.map((a) => ({ ...a, synced: true })),
        meterReadings: s.meterReadings.map((m) => ({ ...m, synced: true })),
        trips: s.trips.map((tr) =>
          tr.endedAt !== null ? { ...tr, synced: true } : tr,
        ),
        unsyncedCount: 0,
      }));
    }, 4000);
    return () => clearTimeout(t);
  }, [state.attendance, state.meterReadings, state.trips]);

  const register = useCallback(async (data: RegisterData) => {
    const staff = await registerStaff({
      kind: data.kind,
      name: data.name,
      phone: data.phone,
      organization: data.organization ?? null,
      empCode: data.empCode ?? null,
      area: data.area ?? null,
      adminCode: data.adminCode ?? null,
    });
    const user: User = {
      id: staff.id,
      name: staff.name,
      phone: staff.phone,
      role: staff.role as UserRole,
      empCode: staff.empCode,
    };
    // Store the freshly-created user and set pendingPhone so the OTP screen
    // can display the number. OTP verification will use pendingRegistration.
    setState((s) => ({
      ...s,
      pendingPhone: data.phone,
      pendingRegistration: { user, approvalStatus: staff.approvalStatus },
    }));
    return user;
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    setState((s) => ({ ...s, pendingPhone: phone, pendingRegistration: null }));
    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error((err["title"] as string) || "Failed to send OTP. Please try again.");
    }
  }, []);

  const verifyOtp = useCallback(async (otp: string) => {
    const phone = stateRef.current.pendingPhone || "";
    const res = await fetch("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error((err["title"] as string) || "Invalid OTP. Please try again.");
    }

    // Registration flow: the user was just created — check approval status.
    const pending = stateRef.current.pendingRegistration;
    if (pending) {
      if (pending.approvalStatus === "pending") {
        // Clear pending state so they don't get stuck, but don't log them in.
        setState((s) => ({ ...s, pendingPhone: null, pendingRegistration: null }));
        throw new Error(
          "Your account is pending admin approval. Please wait for your admin to review your registration.",
        );
      }
      if (pending.approvalStatus === "rejected") {
        setState((s) => ({ ...s, pendingPhone: null, pendingRegistration: null }));
        throw new Error(
          "Your registration was rejected. Please contact admin.",
        );
      }
      setState((s) => ({
        ...s,
        user: pending.user,
        pendingPhone: null,
        pendingRegistration: null,
      }));
      return pending.user;
    }

    // Login flow: resolve the user by looking up the phone on the server.
    let user: User | null = null;
    try {
      const staff = await listStaff();
      const found = staff.find((s) => s.phone === phone);
      if (found) {
        // Block unapproved staff from logging in.
        if (found.approvalStatus === "pending") {
          throw new Error(
            "Your account is pending admin approval. Please contact your admin.",
          );
        }
        if (found.approvalStatus === "rejected") {
          throw new Error(
            "Your registration was rejected. Please contact admin.",
          );
        }
        user = {
          id: found.id,
          name: found.name,
          phone: found.phone,
          role: found.role as UserRole,
          empCode: found.empCode,
        };
      }
    } catch (err) {
      // Re-throw approval errors; swallow network/offline errors.
      const msg = (err as Error)?.message ?? "";
      if (msg.includes("pending") || msg.includes("rejected")) throw err;
      /* offline — fall through to demo fallback */
    }

    // Demo fallback: known seed phone numbers still work offline.
    if (!user) {
      const knownId = KNOWN_STAFF_UUID[phone];
      if (knownId) {
        const isAdmin = phone === seedAdminPhone;
        user = {
          id: knownId,
          name: isAdmin ? "Anita Sharma" : "Staff " + phone.slice(-4),
          phone,
          role: isAdmin ? "admin" : "staff",
          empCode: isAdmin ? "ADM-001" : "FS-" + phone.slice(-4),
        };
      }
    }

    if (!user) {
      throw new Error(
        "Phone number not registered. Please register first or use a demo number.",
      );
    }

    setState((s) => ({ ...s, user, pendingPhone: null }));
    return user;
  }, []);

  const signOut = useCallback(async () => {
    setState((s) => ({ ...s, user: null, pendingPhone: null, activeTripId: null }));
  }, []);

  const switchRole = useCallback(async (target: "admin" | "staff") => {
    const cur = stateRef.current.user;

    // Try to use the real staff record from the server for correct UUIDs.
    let serverStaff: Awaited<ReturnType<typeof listStaff>> = [];
    try {
      serverStaff = await listStaff();
    } catch {
      /* offline */
    }

    let next: User;
    if (target === "admin") {
      const found = serverStaff.find((s) => s.role === "admin");
      next = found
        ? { id: found.id, name: found.name, phone: found.phone, role: "admin", empCode: found.empCode }
        : {
            id: KNOWN_STAFF_UUID[seedAdminPhone] ?? "A-001",
            name: "Anita Sharma",
            phone: seedAdminPhone,
            role: "admin",
            empCode: "ADM-001",
          };
    } else if (cur && cur.role === "staff") {
      next = cur;
    } else {
      const demoPhone = "9876543210";
      const found = serverStaff.find((s) => s.phone === demoPhone);
      next = found
        ? { id: found.id, name: found.name, phone: found.phone, role: "staff", empCode: found.empCode }
        : {
            id: KNOWN_STAFF_UUID[demoPhone] ?? "S-3210",
            name: "Demo Field Staff",
            phone: demoPhone,
            role: "staff",
            empCode: "FS-3210",
          };
    }
    setState((s) => ({ ...s, user: next, activeTripId: null }));
    return next;
  }, []);

  const addAttendance = useCallback(
    async (record: Omit<AttendanceRecord, "id" | "synced">) => {
      const full: AttendanceRecord = { ...record, id: genId(), synced: false };
      setState((s) => ({ ...s, attendance: [full, ...s.attendance] }));

      // Fire-and-forget sync to API — queue handles retry if offline.
      enqueueActivity({
        kind: record.type === "in" ? "checkin" : "checkout",
        staffId: record.staffId,
        staffName: record.staffName,
        occurredAt: new Date(record.timestamp).toISOString(),
        location: record.location,
        selfieUri: record.type === "in" ? record.selfieUri : null,
      }).catch(() => {});

      return full;
    },
    [],
  );

  const addMeterReading = useCallback(
    async (reading: Omit<MeterReading, "id" | "synced">) => {
      const full: MeterReading = { ...reading, id: genId(), synced: false };
      setState((s) => ({ ...s, meterReadings: [full, ...s.meterReadings] }));

      enqueueActivity({
        kind: "meter",
        staffId: reading.staffId,
        staffName: reading.staffName,
        occurredAt: new Date(reading.timestamp).toISOString(),
        location: reading.location,
        consumerNo: reading.consumerNo,
        reading: reading.reading,
        photoUri: reading.photoUri,
        notes: reading.notes,
      }).catch(() => {});

      return full;
    },
    [],
  );

  const startTrip = useCallback(async (start: GeoPoint | null) => {
    const user = stateRef.current.user;
    const now = Date.now();
    const trip: Trip = {
      id: genId(),
      staffId: user?.id || "",
      staffName: user?.name,
      date: new Date().toISOString().slice(0, 10),
      km: 0,
      startedAt: now,
      endedAt: null,
      start,
      end: null,
      path: start
        ? [{ latitude: start.latitude, longitude: start.longitude, t: now }]
        : [],
      synced: false,
    };
    setState((s) => ({ ...s, trips: [trip, ...s.trips], activeTripId: trip.id }));

    if (user?.id) {
      enqueueActivity({
        kind: "trip-start",
        staffId: user.id,
        staffName: user.name,
        occurredAt: new Date(now).toISOString(),
        tripRef: trip.id,
        origin: start,
      }).catch(() => {});
    }

    return trip;
  }, []);

  const endTrip = useCallback(async (km: number, end: GeoPoint | null) => {
    const { activeTripId, trips, user } = stateRef.current;
    const activeTrip = trips.find((t) => t.id === activeTripId) ?? null;
    const endedAt = Date.now();

    setState((s) => {
      if (!s.activeTripId) return s;
      return {
        ...s,
        activeTripId: null,
        trips: s.trips.map((t) =>
          t.id === s.activeTripId
            ? { ...t, km, end, endedAt }
            : t,
        ),
      };
    });

    if (user?.id && activeTripId) {
      const durationSec = activeTrip
        ? Math.round((endedAt - activeTrip.startedAt) / 1000)
        : undefined;
      enqueueActivity({
        kind: "trip-end",
        staffId: user.id,
        staffName: user.name,
        occurredAt: new Date(endedAt).toISOString(),
        tripRef: activeTripId,
        destination: end,
        distanceKm: km,
        durationSec,
      }).catch(() => {});
    }
  }, []);

  const updateActiveTripKm = useCallback((km: number) => {
    setState((s) => {
      if (!s.activeTripId) return s;
      return {
        ...s,
        trips: s.trips.map((t) =>
          t.id === s.activeTripId ? { ...t, km } : t,
        ),
      };
    });
  }, []);

  const appendTripPoint = useCallback((point: GeoPoint) => {
    setState((s) => {
      if (!s.activeTripId) return s;
      const stamp: TripPoint = {
        latitude: point.latitude,
        longitude: point.longitude,
        t: Date.now(),
      };
      return {
        ...s,
        trips: s.trips.map((t) =>
          t.id === s.activeTripId
            ? { ...t, path: [...(t.path || []), stamp] }
            : t,
        ),
      };
    });
  }, []);

  const syncNow = useCallback(async () => {
    // Drain any queued API events first.
    await drainActivityQueue().catch(() => {});
    // Mark local records synced so the SyncBanner clears.
    setState((s) => ({
      ...s,
      attendance: s.attendance.map((a) => ({ ...a, synced: true })),
      meterReadings: s.meterReadings.map((m) => ({ ...m, synced: true })),
      trips: s.trips.map((t) =>
        t.endedAt !== null ? { ...t, synced: true } : t,
      ),
      unsyncedCount: 0,
    }));
  }, []);

  const updateStaffLocation = useCallback((loc: GeoPoint) => {
    setState((s) => {
      if (!s.user || s.user.role !== "staff") return s;
      const exists = s.staffLocations.find((l) => l.staffId === s.user!.id);
      const next: StaffLocation = {
        staffId: s.user.id,
        staffName: s.user.name,
        empCode: s.user.empCode,
        location: loc,
        status: "in",
        updatedAt: Date.now(),
      };
      return {
        ...s,
        staffLocations: exists
          ? s.staffLocations.map((l) => (l.staffId === s.user!.id ? next : l))
          : [next, ...s.staffLocations],
      };
    });
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      register,
      requestOtp,
      verifyOtp,
      signOut,
      addAttendance,
      addMeterReading,
      startTrip,
      endTrip,
      updateActiveTripKm,
      appendTripPoint,
      switchRole,
      syncNow,
      updateStaffLocation,
    }),
    [
      state,
      register,
      requestOtp,
      verifyOtp,
      signOut,
      addAttendance,
      addMeterReading,
      startTrip,
      endTrip,
      updateActiveTripKm,
      appendTripPoint,
      switchRole,
      syncNow,
      updateStaffLocation,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
