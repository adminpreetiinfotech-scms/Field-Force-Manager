import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

type AppState = {
  bootstrapped: boolean;
  user: User | null;
  pendingPhone: string | null;
  attendance: AttendanceRecord[];
  meterReadings: MeterReading[];
  trips: Trip[];
  staffLocations: StaffLocation[];
  activeTripId: string | null;
  unsyncedCount: number;
};

type AppActions = {
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
  attendance: [],
  meterReadings: [],
  trips: [],
  staffLocations: [],
  activeTripId: null,
  unsyncedCount: 0,
};

const AppContext = createContext<AppContextValue | null>(null);

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

  const requestOtp = useCallback(async (phone: string) => {
    setState((s) => ({ ...s, pendingPhone: phone }));
    // Demo: OTP is always 1234. Real impl would call an SMS provider.
    return "1234";
  }, []);

  const verifyOtp = useCallback(async (otp: string) => {
    if (otp !== "1234") {
      throw new Error("Invalid OTP. Use 1234 for demo.");
    }
    const phone = stateRef.current.pendingPhone || "";
    const isAdmin = phone === seedAdminPhone;
    const user: User = {
      id: isAdmin ? "A-001" : "S-" + phone.slice(-4),
      name: isAdmin ? "Anita Sharma" : "Staff " + phone.slice(-4),
      phone,
      role: isAdmin ? "admin" : "staff",
      empCode: isAdmin ? "ADM-001" : "FS-" + phone.slice(-4),
    };
    setState((s) => ({ ...s, user, pendingPhone: null }));
    return user;
  }, []);

  const signOut = useCallback(async () => {
    setState((s) => ({ ...s, user: null, pendingPhone: null, activeTripId: null }));
  }, []);

  const switchRole = useCallback(async (target: "admin" | "staff") => {
    const cur = stateRef.current.user;
    let next: User;
    if (target === "admin") {
      next = {
        id: "A-001",
        name: "Anita Sharma",
        phone: seedAdminPhone,
        role: "admin",
        empCode: "ADM-001",
      };
    } else if (cur && cur.role === "staff") {
      // Already staff — no-op identity, just normalize.
      next = cur;
    } else {
      // Switching from admin to staff → use a fixed demo staff identity so the
      // toggle is reproducible across sessions.
      next = {
        id: "S-3210",
        name: "Demo Field Staff",
        phone: "9876543210",
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
      return full;
    },
    [],
  );

  const addMeterReading = useCallback(
    async (reading: Omit<MeterReading, "id" | "synced">) => {
      const full: MeterReading = { ...reading, id: genId(), synced: false };
      setState((s) => ({ ...s, meterReadings: [full, ...s.meterReadings] }));
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
    return trip;
  }, []);

  const endTrip = useCallback(async (km: number, end: GeoPoint | null) => {
    setState((s) => {
      if (!s.activeTripId) return s;
      return {
        ...s,
        activeTripId: null,
        trips: s.trips.map((t) =>
          t.id === s.activeTripId
            ? { ...t, km, end, endedAt: Date.now() }
            : t,
        ),
      };
    });
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
