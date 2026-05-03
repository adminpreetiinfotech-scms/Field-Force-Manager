import AsyncStorage from "@react-native-async-storage/async-storage";
import { listStaff, registerStaff, setAdminPhoneGetter } from "@workspace/api-client-react";
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

export type UserRole = "staff" | "admin" | "super_admin";

export type User = {
  id: string;
  companyId?: string | null;
  name: string;
  phone: string;
  role: UserRole;
  empCode: string;
  organization?: string | null;
  centerName?: string | null;
  projectName?: string | null;
  email?: string | null;
  state?: string | null;
  district?: string | null;
  /** Company branding fields (set on login from DB) */
  companyName?: string | null;
  companyLogoUrl?: string | null;
  companySchemeName?: string | null;
  companyTcId?: string | null;
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
  centerName?: string;
  projectName?: string;
  email?: string;
  state?: string;
  district?: string;
  empCode?: string;
  area?: string;
  adminCode?: string;
  adminRegistrationKey?: string;
};

type AppState = {
  bootstrapped: boolean;
  user: User | null;
  /** Phone number being verified during login / MPIN setup flow. */
  pendingPhone: string | null;
  /** User record created during registration, waiting for MPIN setup. */
  pendingRegistration: { user: User; approvalStatus: string } | null;
  attendance: AttendanceRecord[];
  meterReadings: MeterReading[];
  trips: Trip[];
  staffLocations: StaffLocation[];
  activeTripId: string | null;
  unsyncedCount: number;
};

export type RegisterCompanyData = {
  companyName: string;
  companyState?: string;
  companyDistrict?: string;
  projectName?: string;
  adminName: string;
  adminPhone: string;
  adminEmail?: string;
  adminRegistrationKey: string;
  centerName?: string;
};

type AppActions = {
  register: (data: RegisterData) => Promise<User>;
  /** Register a new company + its admin in one call. Sets pendingPhone/pendingRegistration. */
  registerCompany: (data: RegisterCompanyData) => Promise<User>;
  /** Set pendingPhone explicitly (used by phone screen before navigating to MPIN). */
  setPendingPhone: (phone: string) => void;
  /** Check if a phone number is registered and whether an MPIN is set. */
  checkPhone: (phone: string) => Promise<{ exists: boolean; hasMpin: boolean }>;
  /** Log in an existing user with their MPIN. */
  loginWithMpin: (phone: string, mpin: string) => Promise<User>;
  /** Set the MPIN for a registered user (first-time or after registration). */
  setupMpin: (phone: string, mpin: string) => Promise<User>;
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
  updateProfile: (fields: {
    name?: string;
    email?: string | null;
    organization?: string | null;
    centerName?: string | null;
    projectName?: string | null;
    state?: string | null;
    district?: string | null;
  }) => Promise<User>;
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

const _domain = process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app";
const API_BASE = `https://${_domain}`;

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

  // Register admin phone getter so generated API client includes x-admin-phone header.
  useEffect(() => {
    setAdminPhoneGetter(() => state.user?.phone ?? null);
  }, [state.user]);

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
      centerName: data.centerName ?? null,
      projectName: data.projectName ?? null,
      email: data.email ?? null,
      state: data.state ?? null,
      district: data.district ?? null,
      empCode: data.empCode ?? null,
      area: data.area ?? null,
      adminCode: data.adminCode ?? null,
      adminRegistrationKey: data.adminRegistrationKey ?? null,
    } as Parameters<typeof registerStaff>[0]);
    const user: User = {
      id: staff.id,
      companyId: (staff as any).companyId ?? null,
      name: staff.name,
      phone: staff.phone,
      role: staff.role as UserRole,
      empCode: staff.empCode,
      organization: (staff as any).organization ?? null,
      centerName: (staff as any).centerName ?? null,
      projectName: (staff as any).projectName ?? null,
      email: (staff as any).email ?? null,
      state: (staff as any).state ?? null,
      district: (staff as any).district ?? null,
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

  const registerCompany = useCallback(async (data: RegisterCompanyData) => {
    const res = await fetch(`${API_BASE}/api/companies/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: data.companyName,
        companyState: data.companyState ?? null,
        companyDistrict: data.companyDistrict ?? null,
        projectName: data.projectName ?? null,
        adminName: data.adminName,
        adminPhone: data.adminPhone,
        adminEmail: data.adminEmail ?? null,
        adminRegistrationKey: data.adminRegistrationKey,
        centerName: data.centerName ?? null,
      }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      throw new Error((err["title"] as string) || "Registration failed. Please try again.");
    }
    const { admin } = (await res.json()) as {
      company: unknown;
      admin: {
        id: string;
        companyId: string | null;
        empCode: string;
        name: string;
        phone: string;
        role: string;
        approvalStatus: string;
        organization?: string | null;
        centerName?: string | null;
        projectName?: string | null;
        email?: string | null;
        state?: string | null;
        district?: string | null;
      };
    };
    const user: User = {
      id: admin.id,
      companyId: admin.companyId ?? null,
      name: admin.name,
      phone: admin.phone,
      role: admin.role as UserRole,
      empCode: admin.empCode,
      organization: admin.organization ?? null,
      centerName: admin.centerName ?? null,
      projectName: admin.projectName ?? null,
      email: admin.email ?? null,
      state: admin.state ?? null,
      district: admin.district ?? null,
    };
    setState((s) => ({
      ...s,
      pendingPhone: data.adminPhone,
      pendingRegistration: { user, approvalStatus: admin.approvalStatus },
    }));
    return user;
  }, []);

  const setPendingPhone = useCallback((phone: string) => {
    setState((s) => ({ ...s, pendingPhone: phone }));
  }, []);

  const checkPhone = useCallback(
    async (phone: string): Promise<{ exists: boolean; hasMpin: boolean }> => {
      const res = await fetch(`${API_BASE}/api/auth/check-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error((err["title"] as string) || "Failed to check phone.");
      }
      return res.json() as Promise<{ exists: boolean; hasMpin: boolean }>;
    },
    [],
  );

  const loginWithMpin = useCallback(async (phone: string, mpin: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login-mpin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, mpin }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      throw new Error((err["title"] as string) || "Login failed. Please try again.");
    }
    const { user: dto } = (await res.json()) as {
      user: {
        id: string;
        companyId?: string | null;
        name: string;
        phone: string;
        role: string;
        empCode: string;
        organization?: string | null;
        centerName?: string | null;
        projectName?: string | null;
        email?: string | null;
        state?: string | null;
        district?: string | null;
        companyName?: string | null;
        companyLogoUrl?: string | null;
        companySchemeName?: string | null;
      };
    };
    const user: User = {
      id: dto.id,
      companyId: dto.companyId ?? null,
      name: dto.name,
      phone: dto.phone,
      role: dto.role as UserRole,
      empCode: dto.empCode,
      organization: dto.organization ?? null,
      centerName: dto.centerName ?? null,
      projectName: dto.projectName ?? null,
      email: dto.email ?? null,
      state: dto.state ?? null,
      district: dto.district ?? null,
      companyName: dto.companyName ?? null,
      companyLogoUrl: dto.companyLogoUrl ?? null,
      companySchemeName: dto.companySchemeName ?? null,
      companyTcId: (dto as any).companyTcId ?? null,
    };
    setState((s) => ({ ...s, user, pendingPhone: null, pendingRegistration: null }));
    return user;
  }, []);

  const setupMpin = useCallback(async (phone: string, mpin: string) => {
    const res = await fetch(`${API_BASE}/api/auth/set-mpin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, mpin }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      throw new Error((err["title"] as string) || "Failed to set MPIN. Please try again.");
    }
    const { user: dto } = (await res.json()) as {
      user: {
        id: string;
        companyId?: string | null;
        name: string;
        phone: string;
        role: string;
        empCode: string;
        organization?: string | null;
        centerName?: string | null;
        projectName?: string | null;
        email?: string | null;
        state?: string | null;
        district?: string | null;
        companyName?: string | null;
        companyLogoUrl?: string | null;
        companySchemeName?: string | null;
      };
    };
    // For the registration flow: if pendingRegistration is set, use that user
    const pending = stateRef.current.pendingRegistration;
    const user: User = pending
      ? pending.user
      : {
          id: dto.id,
          companyId: dto.companyId ?? null,
          name: dto.name,
          phone: dto.phone,
          role: dto.role as UserRole,
          empCode: dto.empCode,
          organization: dto.organization ?? null,
          centerName: dto.centerName ?? null,
          projectName: dto.projectName ?? null,
          email: dto.email ?? null,
          state: dto.state ?? null,
          district: dto.district ?? null,
          companyName: dto.companyName ?? null,
          companyLogoUrl: dto.companyLogoUrl ?? null,
          companySchemeName: dto.companySchemeName ?? null,
          companyTcId: (dto as any).companyTcId ?? null,
        };
    setState((s) => ({ ...s, user, pendingPhone: null, pendingRegistration: null }));
    return user;
  }, []);

  // ── Legacy demo login fallback (offline) ─────────────────────────────────────
  // Keep a stub so existing switchRole / demo logic still compiles.
  const _resolveDemoUser = useCallback((phone: string): User | null => {
    const knownId = KNOWN_STAFF_UUID[phone];
    if (!knownId) return null;
    const isAdmin = phone === seedAdminPhone;
    return {
      id: knownId,
      name: isAdmin ? "Anita Sharma" : "Staff " + phone.slice(-4),
      phone,
      role: isAdmin ? "admin" : "staff",
      empCode: isAdmin ? "ADM-001" : "FS-" + phone.slice(-4),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  void _resolveDemoUser; // suppress unused-variable warning

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

  const updateProfile = useCallback(
    async (fields: {
      name?: string;
      email?: string | null;
      organization?: string | null;
      centerName?: string | null;
      projectName?: string | null;
      state?: string | null;
      district?: string | null;
    }): Promise<User> => {
      const currentUser = stateRef.current.user;
      if (!currentUser) throw new Error("Not logged in");
      const res = await fetch(`${API_BASE}/api/staff/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: currentUser.phone, ...fields }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error((err["title"] as string) || "Failed to update profile");
      }
      const dto = (await res.json()) as {
        id: string; name: string; phone: string; role: string; empCode: string;
        organization?: string | null; centerName?: string | null; projectName?: string | null;
        email?: string | null; state?: string | null; district?: string | null;
      };
      const updated: User = {
        ...currentUser,
        name: dto.name,
        organization: dto.organization ?? null,
        centerName: dto.centerName ?? null,
        projectName: dto.projectName ?? null,
        email: dto.email ?? null,
        state: dto.state ?? null,
        district: dto.district ?? null,
      };
      setState((s) => ({ ...s, user: updated }));
      return updated;
    },
    [],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      register,
      registerCompany,
      setPendingPhone,
      checkPhone,
      loginWithMpin,
      setupMpin,
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
      updateProfile,
    }),
    [
      state,
      register,
      registerCompany,
      setPendingPhone,
      checkPhone,
      loginWithMpin,
      setupMpin,
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
      updateProfile,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
