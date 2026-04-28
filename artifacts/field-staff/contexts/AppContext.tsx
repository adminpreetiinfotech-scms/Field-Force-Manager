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

export type Trip = {
  id: string;
  staffId: string;
  date: string;
  km: number;
  startedAt: number;
  endedAt: number | null;
  start: GeoPoint | null;
  end: GeoPoint | null;
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
  syncNow: () => Promise<void>;
  updateStaffLocation: (loc: GeoPoint) => void;
};

type AppContextValue = AppState & AppActions;

const STORAGE_KEY = "@field-staff/state-v1";

const seedAdminPhone = "9999999999";

function seedStaffLocations(): StaffLocation[] {
  // Mock peers shown on the live map for the admin role.
  const base = { latitude: 28.6139, longitude: 77.209 }; // New Delhi
  const rand = (offset: number) => (Math.random() - 0.5) * offset;
  return [
    {
      staffId: "S-2041",
      staffName: "Ramesh Kumar",
      empCode: "FS-2041",
      location: {
        latitude: base.latitude + rand(0.05),
        longitude: base.longitude + rand(0.05),
      },
      status: "in",
      updatedAt: Date.now() - 1000 * 60 * 6,
    },
    {
      staffId: "S-2042",
      staffName: "Sita Devi",
      empCode: "FS-2042",
      location: {
        latitude: base.latitude + rand(0.06),
        longitude: base.longitude + rand(0.06),
      },
      status: "in",
      updatedAt: Date.now() - 1000 * 60 * 12,
    },
    {
      staffId: "S-2043",
      staffName: "Arjun Singh",
      empCode: "FS-2043",
      location: {
        latitude: base.latitude + rand(0.04),
        longitude: base.longitude + rand(0.04),
      },
      status: "out",
      updatedAt: Date.now() - 1000 * 60 * 38,
    },
    {
      staffId: "S-2044",
      staffName: "Pooja Verma",
      empCode: "FS-2044",
      location: {
        latitude: base.latitude + rand(0.07),
        longitude: base.longitude + rand(0.07),
      },
      status: "in",
      updatedAt: Date.now() - 1000 * 60 * 3,
    },
  ];
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

  // Load on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setState((s) => ({
            ...s,
            ...parsed,
            staffLocations:
              parsed.staffLocations && parsed.staffLocations.length > 0
                ? parsed.staffLocations
                : seedStaffLocations(),
            bootstrapped: true,
          }));
        } else {
          setState((s) => ({
            ...s,
            staffLocations: seedStaffLocations(),
            bootstrapped: true,
          }));
        }
      } catch {
        setState((s) => ({
          ...s,
          staffLocations: seedStaffLocations(),
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
    const trip: Trip = {
      id: genId(),
      staffId: user?.id || "",
      date: new Date().toISOString().slice(0, 10),
      km: 0,
      startedAt: Date.now(),
      endedAt: null,
      start,
      end: null,
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
