import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getGetDistanceStatsQueryKey,
  useGetDistanceStats,
} from "@workspace/api-client-react";

import { Button } from "@/components/Button";
import { PillarsRow } from "@/components/PillarBadge";
import { StatCard } from "@/components/StatCard";
import { SyncBanner } from "@/components/SyncBanner";
import {
  AttendanceRecord,
  GeoPoint,
  useApp,
} from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function haversine(a: GeoPoint, b: GeoPoint) {
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

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export default function StaffHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    user,
    attendance,
    meterReadings,
    trips,
    activeTripId,
    addAttendance,
    startTrip,
    endTrip,
    updateActiveTripKm,
    appendTripPoint,
    updateStaffLocation,
  } = useApp();

  const myAttendance = useMemo(
    () => attendance.filter((a) => a.staffId === user?.id),
    [attendance, user?.id],
  );
  const lastEntry = myAttendance[0] as AttendanceRecord | undefined;
  const isCheckedIn = lastEntry?.type === "in";

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeTrip = trips.find((t) => t.id === activeTripId) || null;
  const lastPosRef = useRef<GeoPoint | null>(null);
  const totalKmRef = useRef(0);

  // GPS watcher while on shift.
  useEffect(() => {
    if (!isCheckedIn) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS === "web") return;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 8000,
          },
          (loc) => {
            if (cancelled) return;
            const p: GeoPoint = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            updateStaffLocation(p);
            appendTripPoint(p);
            if (lastPosRef.current) {
              const d = haversine(lastPosRef.current, p);
              if (d > 0.01 && d < 5) {
                totalKmRef.current += d;
                updateActiveTripKm(Number(totalKmRef.current.toFixed(2)));
              }
            }
            lastPosRef.current = p;
          },
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [isCheckedIn, updateActiveTripKm, updateStaffLocation]);

  const onCheckIn = () => {
    router.push("/attendance/check-in");
  };

  const onCheckOut = async () => {
    Alert.alert(
      "End shift?",
      "Your kilometers and attendance will be locked for the day.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End shift",
          style: "destructive",
          onPress: async () => {
            let loc: GeoPoint | null = null;
            try {
              if (Platform.OS !== "web") {
                const cur = await Location.getCurrentPositionAsync({});
                loc = {
                  latitude: cur.coords.latitude,
                  longitude: cur.coords.longitude,
                };
              }
            } catch {
              /* ignore */
            }
            await addAttendance({
              staffId: user!.id,
              staffName: user!.name,
              type: "out",
              timestamp: Date.now(),
              location: loc,
              selfieUri: null,
            });
            await endTrip(
              Number(totalKmRef.current.toFixed(2)),
              loc,
            );
            totalKmRef.current = 0;
            lastPosRef.current = null;
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              ).catch(() => {});
            }
          },
        },
      ],
    );
  };

  // When attendance flips to "in" from check-in screen, start a trip if one isn't active.
  useEffect(() => {
    if (isCheckedIn && !activeTripId && lastEntry) {
      startTrip(lastEntry.location);
      totalKmRef.current = 0;
      lastPosRef.current = null;
    }
  }, [isCheckedIn, activeTripId, lastEntry, startTrip]);

  const today = new Date().toISOString().slice(0, 10);
  const todayMeters = meterReadings.filter(
    (m) =>
      m.staffId === user?.id &&
      new Date(m.timestamp).toISOString().slice(0, 10) === today,
  ).length;

  const distanceParams = { date: today, staffId: user?.id ?? undefined };
  const {
    data: distanceData,
    isLoading: distanceLoading,
    isError: distanceError,
  } = useGetDistanceStats(distanceParams, {
    query: {
      queryKey: getGetDistanceStatsQueryKey(distanceParams),
      enabled: !!user?.id,
      refetchInterval: 30_000,
      staleTime: 15_000,
    },
  });

  // Use live GPS km while a trip is in progress; fall back to server total.
  const serverKm = distanceData?.totalKm ?? 0;
  const todayKm = activeTrip ? activeTrip.km : serverKm;

  const elapsed = isCheckedIn && lastEntry ? now - lastEntry.timestamp : 0;
  const hours = Math.floor(elapsed / 3600000);
  const mins = Math.floor((elapsed % 3600000) / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  const webBottomPad = Platform.OS === "web" ? 84 : 84;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBottomPad + 16,
        }}
      >
        {/* Hero */}
        <LinearGradient
          colors={[colors.primary, "#13325F"]}
          style={{
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
            paddingBottom: 28,
            paddingHorizontal: 22,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
          }}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greet}>{getGreeting()},</Text>
              <Text style={styles.name}>{user?.name || "Field Staff"}</Text>
            </View>
            <View
              style={[
                styles.empBadge,
                { backgroundColor: "rgba(255,255,255,0.12)" },
              ]}
            >
              <Feather name="hash" size={11} color="#FCD34D" />
              <Text style={styles.empText}>{user?.empCode}</Text>
            </View>
          </View>

          <View style={[styles.shiftCard, { borderRadius: 20 }]}>
            <View style={styles.shiftRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isCheckedIn ? "#34D399" : "#94A3B8" },
                ]}
              />
              <Text style={styles.shiftStatus}>
                {isCheckedIn ? "On shift" : "Off shift"}
              </Text>
              <Text style={styles.shiftDate}>· {formatDate(now)}</Text>
            </View>
            {isCheckedIn ? (
              <Text style={styles.timer}>
                {String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}
                :{String(secs).padStart(2, "0")}
              </Text>
            ) : (
              <Text style={styles.timerOff}>Ready to start</Text>
            )}
            <Text style={styles.shiftMeta}>
              {isCheckedIn && lastEntry
                ? `Checked in at ${formatTime(lastEntry.timestamp)}`
                : "Capture a selfie + GPS to begin"}
            </Text>

            <Pressable
              onPress={isCheckedIn ? onCheckOut : onCheckIn}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: isCheckedIn ? "#DC2626" : "#F59E0B",
                  borderRadius: 14,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Feather
                name={isCheckedIn ? "log-out" : "camera"}
                size={18}
                color={isCheckedIn ? "#fff" : "#1F1300"}
              />
              <Text
                style={[
                  styles.actionText,
                  { color: isCheckedIn ? "#fff" : "#1F1300" },
                ]}
              >
                {isCheckedIn ? "End shift" : "Check in with selfie"}
              </Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={{ padding: 18, gap: 14 }}>
          <SyncBanner />

          {/* Today's stats */}
          <View style={styles.row}>
            <StatCard
              label="Distance today"
              value={
                distanceError
                  ? "—"
                  : activeTrip
                    ? `${todayKm.toFixed(1)} km`
                    : distanceLoading && !distanceData
                      ? "..."
                      : todayKm === 0
                        ? "0 km"
                        : `${todayKm.toFixed(1)} km`
              }
              icon="navigation"
              tint={colors.pillarAccuracy}
              loading={!activeTrip && distanceLoading && !distanceData}
              error={distanceError}
              trend={
                distanceError
                  ? "Could not load"
                  : activeTrip
                    ? "Live GPS tracking"
                    : distanceData && distanceData.tripCount > 0
                      ? `${distanceData.tripCount} trip${distanceData.tripCount !== 1 ? "s" : ""} completed`
                      : undefined
              }
            />
            <StatCard
              label="Meter reads"
              value={`${todayMeters}`}
              icon="activity"
              tint={colors.pillarTransparency}
            />
          </View>

          {/* Quick actions */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius + 4,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Quick actions
            </Text>
            <View style={{ gap: 10, marginTop: 12 }}>
              <Button
                label="Capture meter reading"
                onPress={() => {
                  if (!isCheckedIn) {
                    Alert.alert(
                      "Shift not active",
                      "Please check in before capturing a reading.",
                    );
                    return;
                  }
                  router.push("/meter/add");
                }}
                size="lg"
                fullWidth
                icon={<Feather name="zap" size={18} color="#fff" />}
              />
              <Button
                label="View today's trips"
                onPress={() => router.push("/(staff)/trips")}
                variant="ghost"
                size="lg"
                fullWidth
                icon={
                  <Feather
                    name="map"
                    size={18}
                    color={colors.foreground}
                  />
                }
              />
            </View>
          </View>

          {/* Pillars */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius + 4,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Operating principles
            </Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Every action is signed, stamped, and traceable.
            </Text>
            <View style={{ marginTop: 12 }}>
              <PillarsRow />
            </View>
          </View>

          {/* Recent activity */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius + 4,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Recent activity
            </Text>
            {myAttendance.slice(0, 4).length === 0 ? (
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  marginTop: 8,
                }}
              >
                No activity yet — your first check-in will show here.
              </Text>
            ) : (
              myAttendance.slice(0, 4).map((a) => (
                <View
                  key={a.id}
                  style={[
                    styles.activityRow,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.activityIcon,
                      {
                        backgroundColor:
                          (a.type === "in" ? colors.success : colors.destructive) +
                          "1A",
                        borderRadius: 10,
                      },
                    ]}
                  >
                    <Feather
                      name={a.type === "in" ? "log-in" : "log-out"}
                      size={14}
                      color={a.type === "in" ? colors.success : colors.destructive}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 13,
                      }}
                    >
                      {a.type === "in" ? "Checked in" : "Checked out"}
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {formatTime(a.timestamp)}
                      {a.location
                        ? `  ·  ${a.location.latitude.toFixed(3)}, ${a.location.longitude.toFixed(3)}`
                        : "  ·  No GPS"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.syncDot,
                      {
                        backgroundColor: a.synced
                          ? colors.success
                          : colors.warning,
                      },
                    ]}
                  />
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const styles = StyleSheet.create({
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greet: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  name: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
    letterSpacing: -0.4,
  },
  empBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  empText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  shiftCard: {
    marginTop: 22,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  shiftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  shiftStatus: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  shiftDate: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  timer: {
    color: "#fff",
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
    marginTop: 10,
    fontVariant: ["tabular-nums"],
  },
  timerOff: {
    color: "#fff",
    fontSize: 30,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.5,
    marginTop: 10,
  },
  shiftMeta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  actionBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  actionText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  row: { flexDirection: "row", gap: 10 },
  section: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
});
