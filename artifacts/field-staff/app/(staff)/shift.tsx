import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KmDayDetailSheet, ReportStatBox, getApiBase } from "@/components/KmDayDetailSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getGetDistanceStatsQueryKey,
  useGetDistanceStats,
  useGetStaffKmHistory,
} from "@workspace/api-client-react";

import { Button } from "@/components/Button";
import { NoticePopup, NotifBell } from "@/components/NoticePopup";
import { PillarsRow } from "@/components/PillarBadge";
import { ReportContextBar } from "@/components/ReportContextBar";
import { StatCard } from "@/components/StatCard";
import { SyncBanner } from "@/components/SyncBanner";
import {
  AttendanceRecord,
  GeoPoint,
  Trip,
  useApp,
} from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useCandidateNotifCount } from "@/hooks/useCandidateNotifCount";
import { useNotices } from "@/hooks/useNotices";

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

  const [showReport, setShowReport] = useState(false);
  const [selectedKmDay, setSelectedKmDay] = useState<string | null>(null);

  const {
    unreadCount,
    unreadNotices,
    markRead,
    refresh: refreshNotices,
  } = useNotices({ phone: user?.phone, enabled: !!user?.phone, pollIntervalMs: 30_000 });

  const {
    unreadCount: candidateNotifCount,
    refresh: refreshCandidateNotifs,
  } = useCandidateNotifCount({ phone: user?.phone, enabled: !!user?.phone, pollIntervalMs: 60_000 });

  const popupNotice = unreadNotices[0] ?? null;

  useFocusEffect(
    useCallback(() => {
      void refreshNotices();
      void refreshCandidateNotifs();
    }, [refreshNotices, refreshCandidateNotifs]),
  );

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Track current GPS position for center-staff geo-fence banner
  const [currentGpsPos, setCurrentGpsPos] = useState<GeoPoint | null>(null);

  const activeTrip = trips.find((t) => t.id === activeTripId) || null;
  const lastPosRef = useRef<GeoPoint | null>(null);
  const totalKmRef = useRef(0);
  const lastPingRef = useRef<number>(0);

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
            setCurrentGpsPos(p);
            // Ping server every 30 s so admin map shows real-time location
            const nowMs = Date.now();
            if (user && nowMs - lastPingRef.current >= 30_000) {
              lastPingRef.current = nowMs;
              const base = getApiBase();
              fetch(`${base}/api/staff/ping-location`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ staffId: user.id, lat: p.latitude, lng: p.longitude }),
              }).catch(() => {});
            }
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
    // Center staff and field staff with a vehicle (profile OR selected at check-in) go through the check-out screen
    const checkinVehicleType = lastEntry?.checkinVehicleType;
    const hasVehicle = !!(checkinVehicleType || user?.vehicleType);
    if (hasVehicle || user?.staffCategory === "center") {
      const vt = checkinVehicleType ?? user?.vehicleType ?? "";
      router.push(
        `/attendance/check-out?gpsKm=${totalKmRef.current.toFixed(2)}&vehicleType=${encodeURIComponent(vt)}` as never
      );
      return;
    }
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
                loc = { latitude: cur.coords.latitude, longitude: cur.coords.longitude };
              }
            } catch { /* ignore */ }
            await addAttendance({
              staffId: user!.id,
              staffName: user!.name,
              type: "out",
              timestamp: Date.now(),
              location: loc,
              selfieUri: null,
            });
            await endTrip(Number(totalKmRef.current.toFixed(2)), loc);
            totalKmRef.current = 0;
            lastPosRef.current = null;
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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

  const kmHistoryParams = { staffId: user?.id ?? "", days: 7 };
  const {
    data: kmHistoryData,
    isLoading: kmHistoryLoading,
  } = useGetStaffKmHistory(kmHistoryParams, {
    query: {
      enabled: !!user?.id,
      staleTime: 60_000,
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <NotifBell
                count={unreadCount}
                onPress={() => router.push("/(staff)/notices" as never)}
                light
              />
              <View style={[styles.empBadge, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
                <Feather name="hash" size={11} color="#FCD34D" />
                <Text style={styles.empText}>{user?.empCode}</Text>
              </View>
            </View>
          </View>

          <ReportContextBar
            organization={user?.companyName || user?.centerName || user?.organization}
            staffName={user?.name}
            reportType="daily"
          />

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
          {/* Geo-fence live banner for center staff */}
          {(() => {
            if (user?.staffCategory !== "center") return null;
            if (!isCheckedIn) return null;
            if (user?.companyCenterLat == null || user?.companyCenterLng == null) return null;
            if (!currentGpsPos) return null;
            const R = 6371000;
            const dLat = ((currentGpsPos.latitude - user.companyCenterLat) * Math.PI) / 180;
            const dLon = ((currentGpsPos.longitude - user.companyCenterLng) * Math.PI) / 180;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos((user.companyCenterLat * Math.PI) / 180) * Math.cos((currentGpsPos.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
            const distM = Math.round(2 * R * Math.asin(Math.sqrt(a)));
            const radius = user.companyCenterRadiusMeters ?? 200;
            const outside = distM > radius;
            return (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 10,
                backgroundColor: outside ? "#FEF2F2" : "#F0FDF4",
                borderWidth: 1, borderColor: outside ? "#FECACA" : "#BBF7D0",
                borderRadius: 12, padding: 12,
              }}>
                <Feather name={outside ? "alert-triangle" : "check-circle"} size={16} color={outside ? "#DC2626" : "#16A34A"} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: outside ? "#DC2626" : "#15803D" }}>
                    {outside ? `Outside geo-fence (${distM}m from center)` : `Inside geo-fence (${distM}m from center)`}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: outside ? "#B91C1C" : "#166534", marginTop: 1 }}>
                    {outside ? `You are ${distM - radius}m beyond the ${radius}m allowed radius` : `Within the allowed ${radius}m radius`}
                  </Text>
                </View>
              </View>
            );
          })()}

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
              label="Check-ins"
              value={`${myAttendance.filter((a) => a.type === "in").length}`}
              icon="log-in"
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
              <Button
                label="Register a candidate"
                onPress={() => router.push("/candidate/register")}
                variant="ghost"
                size="lg"
                fullWidth
                icon={
                  <Feather
                    name="user-plus"
                    size={18}
                    color={colors.foreground}
                  />
                }
              />
              <Button
                label="My candidates"
                onPress={() => router.push("/candidate/my-candidates")}
                variant="ghost"
                size="lg"
                fullWidth
                icon={
                  <Feather
                    name="users"
                    size={18}
                    color={colors.foreground}
                  />
                }
              />
              <Button
                label={candidateNotifCount > 0 ? `Candidate Updates (${candidateNotifCount} new)` : "Candidate Updates"}
                onPress={() => router.push("/notifications")}
                variant="ghost"
                size="lg"
                fullWidth
                icon={
                  <Feather
                    name="bell"
                    size={18}
                    color={candidateNotifCount > 0 ? "#D97706" : colors.foreground}
                  />
                }
              />
              <Button
                label="Daily Outcome Report"
                onPress={() => setShowReport(true)}
                variant="ghost"
                size="lg"
                fullWidth
                icon={<Feather name="share-2" size={18} color="#16A34A" />}
                style={{ borderColor: "#16A34A33", backgroundColor: "#F0FDF4" }}
              />
            </View>
          </View>

          <DailyReportModal
            visible={showReport}
            onClose={() => setShowReport(false)}
            userId={user?.id ?? ""}
            userName={user?.name ?? ""}
            empCode={user?.empCode ?? ""}
            organization={user?.companyName || user?.organization}
            centerName={user?.centerName}
            projectName={user?.companySchemeName || user?.projectName}
            state={user?.state}
            district={user?.district}
            myAttendance={myAttendance}
            trips={trips}
            todayKm={todayKm}
          />

          <KmDayDetailSheet
            visible={selectedKmDay != null}
            date={selectedKmDay ?? ""}
            staffId={user?.id ?? ""}
            vehicleType={user?.vehicleType}
            kmEntry={
              selectedKmDay != null
                ? (kmHistoryData?.entries ?? []).find((e) => e.date === selectedKmDay) ?? null
                : null
            }
            onClose={() => setSelectedKmDay(null)}
          />

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

          {/* KM History — shown for all staff who have trips */}
          {(kmHistoryData?.entries?.length ?? 0) > 0 && (
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Feather name="activity" size={15} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  KM History
                </Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground, marginBottom: 12 }]}>
                {user?.vehicleType
                  ? "Last 7 days of odometer readings"
                  : "Last 7 days of GPS trip distance"}
              </Text>

              {/* Header row */}
              {user?.vehicleType ? (
                <View style={[kmStyles.headerRow, { borderBottomColor: colors.border }]}>
                  <Text style={[kmStyles.colDate, { color: colors.mutedForeground }]}>Date</Text>
                  <Text style={[kmStyles.colOdo, { color: colors.mutedForeground }]}>Start km</Text>
                  <Text style={[kmStyles.colOdo, { color: colors.mutedForeground }]}>End km</Text>
                  <Text style={[kmStyles.colKm, { color: colors.mutedForeground }]}>Vehicle km</Text>
                </View>
              ) : (
                <View style={[kmStyles.headerRow, { borderBottomColor: colors.border }]}>
                  <Text style={[kmStyles.colDate, { color: colors.mutedForeground }]}>Date</Text>
                  <Text style={[kmStyles.colOdo, { color: colors.mutedForeground }]}>Trips</Text>
                  <Text style={[kmStyles.colKm, { color: colors.mutedForeground }]}>GPS km</Text>
                </View>
              )}

              {kmHistoryLoading ? (
                <View style={{ paddingVertical: 16, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : user?.vehicleType ? (
                <>
                  {(kmHistoryData?.entries ?? []).map((entry, idx) => {
                    const entries = kmHistoryData?.entries ?? [];
                    const isLast = idx === entries.length - 1;
                    const vehicleKm = entry.vehicleKm;
                    const hasReading = entry.startOdometerKm != null || entry.endOdometerKm != null;
                    return (
                      <Pressable
                        key={entry.date}
                        onPress={() => setSelectedKmDay(entry.date)}
                        style={({ pressed }) => [
                          kmStyles.dataRow,
                          {
                            borderBottomColor: colors.border,
                            borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={[kmStyles.colDate, { color: colors.foreground }]}>
                          {formatShortDate(entry.date)}
                        </Text>
                        <Text style={[kmStyles.colOdo, { color: hasReading ? colors.foreground : colors.mutedForeground }]}>
                          {entry.startOdometerKm != null ? entry.startOdometerKm.toLocaleString("en-IN") : "—"}
                        </Text>
                        <Text style={[kmStyles.colOdo, { color: hasReading ? colors.foreground : colors.mutedForeground }]}>
                          {entry.endOdometerKm != null ? entry.endOdometerKm.toLocaleString("en-IN") : "—"}
                        </Text>
                        <View style={[kmStyles.colKm, { alignItems: "flex-end", gap: 4, flexDirection: "row", justifyContent: "flex-end" }]}>
                          {vehicleKm != null ? (
                            <View style={{
                              backgroundColor: colors.primary + "18",
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}>
                              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                                {vehicleKm.toFixed(1)} km
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>—</Text>
                          )}
                          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                        </View>
                      </Pressable>
                    );
                  })}
                  {/* 7-day total footer */}
                  <View style={[kmStyles.dataRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, marginTop: 2 }]}>
                    <Text style={[kmStyles.colDate, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      Total
                    </Text>
                    <Text style={[kmStyles.colOdo, { color: colors.mutedForeground }]}>{""}</Text>
                    <Text style={[kmStyles.colOdo, { color: colors.mutedForeground }]}>{""}</Text>
                    <View style={[kmStyles.colKm, { alignItems: "flex-end" }]}>
                      <View style={{ backgroundColor: colors.primary + "18", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                          {(kmHistoryData?.entries ?? []).reduce((sum, e) => sum + (e.vehicleKm ?? 0), 0).toFixed(1)} km
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {(kmHistoryData?.entries ?? []).map((entry, idx) => {
                    const entries = kmHistoryData?.entries ?? [];
                    const isLast = idx === entries.length - 1;
                    return (
                      <Pressable
                        key={entry.date}
                        onPress={() => setSelectedKmDay(entry.date)}
                        style={({ pressed }) => [
                          kmStyles.dataRow,
                          {
                            borderBottomColor: colors.border,
                            borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={[kmStyles.colDate, { color: colors.foreground }]}>
                          {formatShortDate(entry.date)}
                        </Text>
                        <Text style={[kmStyles.colOdo, { color: entry.tripCount > 0 ? colors.foreground : colors.mutedForeground }]}>
                          {entry.tripCount > 0 ? entry.tripCount : "—"}
                        </Text>
                        <View style={[kmStyles.colKm, { alignItems: "flex-end", gap: 4, flexDirection: "row", justifyContent: "flex-end" }]}>
                          {entry.gpsKm > 0 ? (
                            <View style={{
                              backgroundColor: colors.primary + "18",
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}>
                              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                                {entry.gpsKm.toFixed(1)} km
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>—</Text>
                          )}
                          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                        </View>
                      </Pressable>
                    );
                  })}
                  {/* 7-day total footer */}
                  <View style={[kmStyles.dataRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, marginTop: 2 }]}>
                    <Text style={[kmStyles.colDate, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      Total
                    </Text>
                    <Text style={[kmStyles.colOdo, { color: colors.mutedForeground }]}>{""}</Text>
                    <View style={[kmStyles.colKm, { alignItems: "flex-end" }]}>
                      <View style={{ backgroundColor: colors.primary + "18", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                          {(kmHistoryData?.entries ?? []).reduce((sum, e) => sum + e.gpsKm, 0).toFixed(1)} km
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Notice Popup */}
      <NoticePopup
        notice={popupNotice}
        totalUnread={unreadCount}
        onRead={markRead}
        noticesRoute="/(staff)/notices"
      />
    </View>
  );
}

type DailyReport = {
  staffName: string;
  empCode: string;
  phone: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalCandidatesToday: number;
  tripCount: number;
  totalKm: number;
  candPending: number;
  candVerified: number;
  candEnrolled: number;
  candRejected: number;
};

type DailyReportModalProps = {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  empCode: string;
  organization?: string | null;
  centerName?: string | null;
  projectName?: string | null;
  state?: string | null;
  district?: string | null;
  myAttendance: AttendanceRecord[];
  trips: Trip[];
  todayKm: number;
};

function DailyReportModal({ visible, onClose, userId, todayKm, trips, myAttendance, organization, centerName, projectName, state, district }: DailyReportModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { unsyncedCount } = useApp();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const todayCheckin = myAttendance
    .filter((a) => new Date(a.timestamp).toISOString().slice(0, 10) === today && a.type === "in")
    .sort((a, b) => a.timestamp - b.timestamp)[0];

  const todayCheckout = myAttendance
    .filter((a) => new Date(a.timestamp).toISOString().slice(0, 10) === today && a.type === "out")
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  const todayTrips = trips.filter((t) => t.date === today);

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    fetch(`/api/staff/daily-report?staffId=${encodeURIComponent(userId)}&date=${today}`)
      .then((r) => r.json() as Promise<DailyReport>)
      .then((data) => setReport(data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [visible, userId, today]);

  const fmtTime = (iso: string | null | undefined) => {
    if (!iso) return null;
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const fmtDate = (d: string) => {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const checkinTime = report?.checkInTime
    ? fmtTime(report.checkInTime)
    : todayCheckin
    ? formatTime(todayCheckin.timestamp)
    : null;

  const checkoutTime = report?.checkOutTime
    ? fmtTime(report.checkOutTime)
    : todayCheckout
    ? formatTime(todayCheckout.timestamp)
    : null;

  const totalTrips = report?.tripCount ?? todayTrips.length;
  const totalDist = report?.totalKm ?? todayKm;
  const candidates = report?.totalCandidatesToday ?? 0;
  const pending = report?.candPending ?? 0;
  const verified = report?.candVerified ?? 0;
  const name = report?.staffName ?? "Field Staff";

  const orgLine       = organization?.trim() || null;
  const centerLine    = centerName?.trim() || null;
  const projectLine   = projectName?.trim() || null;
  const stateLine     = state?.trim() || null;
  const districtLine  = district?.trim() || null;
  const dateStr       = fmtDate(today);

  const buildReportText = () => {
    const SEP = `━━━━━━━━━━━━━━━━━━━━━`;
    const lines: string[] = [
      SEP,
      `📋 DAILY FIELD REPORT`,
      SEP,
    ];

    if (centerLine) lines.push(`🏢 Center / Branch: ${centerLine}`);
    else if (orgLine) lines.push(`🏢 Organization: ${orgLine}`);
    if (projectLine) lines.push(`📌 Scheme / Project: ${projectLine}`);
    if (stateLine || districtLine) {
      lines.push(`📍 Location: ${[districtLine, stateLine].filter(Boolean).join(", ")}`);
    }
    lines.push(`👤 Staff Name: ${name}`);
    lines.push(`🗓️ Date: ${dateStr}`);
    lines.push(``);

    lines.push(`⏰ Check-in: ${checkinTime ?? "Not checked in"}`);
    lines.push(`⏱️ Check-out: ${checkoutTime ?? "Not checked out"}`);
    lines.push(``);

    lines.push(`📊 Candidate Registrations`);
    lines.push(`   Today: ${candidates}`);
    lines.push(``);

    lines.push(`🚗 Trips Today: ${totalTrips}`);
    lines.push(`📏 Distance Covered: ${totalDist.toFixed(1)} km`);
    if (unsyncedCount > 0) {
      lines.push(``);
      lines.push(`⏳ Pending Sync: ${unsyncedCount} item${unsyncedCount !== 1 ? "s" : ""} (will sync when online)`);
    }
    lines.push(``);

    lines.push(SEP);
    lines.push(`Report Generated By:`);
    if (centerLine) lines.push(centerLine);
    else if (orgLine) lines.push(orgLine);
    if (projectLine) lines.push(projectLine);
    lines.push(`Staff: ${name}`);
    lines.push(`Date: ${dateStr}`);
    lines.push(SEP);

    return lines.join("\n");
  };

  const shareOnWhatsApp = async () => {
    const text = buildReportText();
    const encoded = encodeURIComponent(text);

    // Web: open WhatsApp Web directly
    if (Platform.OS === "web") {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
      return;
    }

    // Native: try WhatsApp deep link first
    const waUrl = `whatsapp://send?text=${encoded}`;
    const canOpenWa = await Linking.canOpenURL(waUrl).catch(() => false);
    if (canOpenWa) {
      await Linking.openURL(waUrl).catch(() => {});
      return;
    }

    // Fallback: system share sheet
    try {
      await Share.share({ message: text });
    } catch (e: any) {
      if (e?.message !== "The user did not share") {
        Alert.alert(
          "Could not share",
          "WhatsApp is not installed. Please share the report manually.",
        );
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: insets.bottom + 28,
            maxHeight: "88%",
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ backgroundColor: "#16A34A14", borderRadius: 10, padding: 8 }}>
                <Feather name="bar-chart-2" size={18} color="#16A34A" />
              </View>
              <View>
                <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                  Daily Outcome Report
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>
                  {fmtDate(today)}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#16A34A" />
              <Text style={{ marginTop: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }}>
                Loading report…
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12 }}>
                {/* Attendance */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                  }}
                >
                  <ReportStatBox
                    icon="clock"
                    label="Check-in"
                    value={checkinTime ?? "—"}
                    color="#1E3A5F"
                  />
                  <ReportStatBox
                    icon="log-out"
                    label="Check-out"
                    value={checkoutTime ?? "—"}
                    color="#6B7280"
                  />
                </View>

                {/* Candidates */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    padding: 16,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Feather name="users" size={16} color="#0D6EAE" />
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                      Candidate Registrations
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <ReportStatBox icon="user-plus" label="Today" value={String(candidates)} color="#0D6EAE" small />
                    <ReportStatBox icon="clock" label="Pending" value={String(pending)} color="#D97706" small />
                    <ReportStatBox icon="check-circle" label="Verified" value={String(verified)} color="#16A34A" small />
                  </View>
                </View>

                {/* Trips & Distance */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <ReportStatBox icon="map" label="Trips Today" value={String(totalTrips)} color="#7C3AED" />
                  <ReportStatBox icon="navigation" label="Distance" value={`${totalDist.toFixed(1)} km`} color="#0D6EAE" />
                </View>

                {/* Share button */}
                <Pressable
                  onPress={shareOnWhatsApp}
                  style={({ pressed }) => ({
                    marginTop: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    height: 54,
                    borderRadius: 14,
                    backgroundColor: "#25D366",
                    opacity: pressed ? 0.88 : 1,
                  })}
                >
                  <Feather name="message-circle" size={20} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" }}>
                    Share on WhatsApp
                  </Text>
                </Pressable>

                <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_400Regular", marginTop: 2 }}>
                  Opens WhatsApp with a pre-filled message. You can choose who to send it to.
                </Text>
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
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
  notifBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
});

const kmStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
  },
  colDate: {
    flex: 2,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  colOdo: {
    flex: 2,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  colKm: {
    flex: 2,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
});
