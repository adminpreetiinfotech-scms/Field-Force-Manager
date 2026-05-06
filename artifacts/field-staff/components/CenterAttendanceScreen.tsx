import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CompanyBrand } from "@/components/CompanyBrand";
import { NotifBell } from "@/components/NoticePopup";
import { AttendanceRecord, GeoPoint, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useNotices } from "@/hooks/useNotices";

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtHours(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

type MonthStats = {
  presentCount: number;
  partialCount: number;
  absentCount: number;
  attendancePercent: number;
};

const ACCENT = "#1E3A5F";

export function CenterAttendanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, attendance } = useApp();
  const [now, setNow] = useState(Date.now());
  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = 84;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { unreadCount, refresh: refreshNotices } = useNotices({
    phone: user?.phone,
    enabled: !!user?.phone,
    pollIntervalMs: 30_000,
  });

  useFocusEffect(useCallback(() => { void refreshNotices(); }, [refreshNotices]));

  const [gpsPos, setGpsPos] = useState<GeoPoint | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);

  const fetchGps = useCallback(async () => {
    if (Platform.OS === "web") {
      setGpsPos({ latitude: 28.6139, longitude: 77.209 });
      setGpsLoading(false);
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setGpsLoading(false); return; }
      const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsPos({ latitude: cur.coords.latitude, longitude: cur.coords.longitude });
    } catch { } finally { setGpsLoading(false); }
  }, []);

  useEffect(() => { void fetchGps(); }, [fetchGps]);
  useFocusEffect(useCallback(() => { void fetchGps(); }, [fetchGps]));

  const geofence = useMemo(() => {
    if (!gpsPos || user?.companyCenterLat == null || user?.companyCenterLng == null || user?.companyCenterRadiusMeters == null) return null;
    const dist = haversineM(gpsPos.latitude, gpsPos.longitude, user.companyCenterLat, user.companyCenterLng);
    return { dist: Math.round(dist), inside: dist <= user.companyCenterRadiusMeters, radius: Math.round(user.companyCenterRadiusMeters) };
  }, [gpsPos, user?.companyCenterLat, user?.companyCenterLng, user?.companyCenterRadiusMeters]);

  const todayStr = new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
  const todayStart = new Date(todayStr).getTime();
  const todayEnd = todayStart + 86_400_000;

  const myAttendance = useMemo(
    () => attendance.filter(a => a.staffId === user?.id),
    [attendance, user?.id],
  );

  const todayRecords = useMemo(
    () => myAttendance.filter(a => a.timestamp >= todayStart && a.timestamp < todayEnd),
    [myAttendance, todayStart, todayEnd],
  );

  const checkInRecord = todayRecords.find(a => a.type === "in") as AttendanceRecord | undefined;
  const checkOutRecord = todayRecords.find(a => a.type === "out") as AttendanceRecord | undefined;
  const isCheckedIn = !!checkInRecord && !checkOutRecord;

  const hoursElapsed = useMemo(() => {
    if (!checkInRecord) return 0;
    return (checkOutRecord ? checkOutRecord.timestamp : now) - checkInRecord.timestamp;
  }, [checkInRecord, checkOutRecord, now]);

  const [monthStats, setMonthStats] = useState<MonthStats | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    const d = new Date();
    const base = getApiBase();
    fetch(`${base}/api/activity/attendance-calendar?staffId=${user.id}&year=${d.getFullYear()}&month=${d.getMonth() + 1}`)
      .then(r => r.json())
      .then((j: MonthStats) => setMonthStats(j))
      .catch(() => {});
  }, [user?.id]);

  const todayStatus = !checkInRecord ? "not-checked-in" : !checkOutRecord ? "checked-in" : "checked-out";

  const statusChip = {
    "not-checked-in": { label: "Not Yet", bg: "#F1F5F9", color: "#64748B" },
    "checked-in":     { label: "● Present", bg: "#DCFCE7", color: "#16A34A" },
    "checked-out":    { label: "✓ Day Done", bg: "#DBEAFE", color: "#1D4ED8" },
  }[todayStatus];

  const geofenceBg = gpsLoading
    ? "rgba(255,255,255,0.08)"
    : !geofence
    ? "rgba(255,255,255,0.08)"
    : geofence.inside
    ? "rgba(52,211,153,0.18)"
    : "rgba(239,68,68,0.18)";

  const geofenceIcon = !geofence ? "map-pin" : geofence.inside ? "check-circle" : "alert-circle";
  const geofenceColor = !geofence ? "rgba(255,255,255,0.6)" : geofence.inside ? "#34D399" : "#F87171";
  const geofenceText = gpsLoading
    ? "Locating you…"
    : !geofence
    ? "Geo-fence not configured for this center"
    : geofence.inside
    ? `Inside center · ${geofence.dist}m from entry`
    : `Outside center · ${geofence.dist}m away (radius: ${geofence.radius}m)`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + webBottomPad + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Gradient Header ─────────────────────────────────────── */}
        <LinearGradient
          colors={[ACCENT, "#0D2240"]}
          style={{
            paddingTop: insets.top + webTop + 16,
            paddingBottom: 28,
            paddingHorizontal: 22,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "Inter_400Regular" }}>
                {getGreeting()},
              </Text>
              <Text style={{ color: "#fff", fontSize: 21, fontFamily: "Inter_700Bold", marginTop: 2 }}>
                {user?.name || "Center Staff"}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                {user?.centerName || user?.organization} · {new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <NotifBell
                count={unreadCount}
                onPress={() => router.push("/(staff)/notices" as never)}
                light
              />
              <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="hash" size={11} color="#FCD34D" />
                <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{user?.empCode}</Text>
              </View>
            </View>
          </View>

          {/* ── Company Logo Strip ──────────────────────────────── */}
          {(user?.companyLogoUrl || user?.companyName) && (
            <View style={{ marginTop: 10, marginBottom: 2 }}>
              <CompanyBrand
                companyName={user?.companyName || user?.organization}
                companyLogoUrl={user?.companyLogoUrl}
                schemeName={user?.companySchemeName || user?.projectName}
                size="sm"
                centered={false}
                nameColor="#FFFFFF"
                schemeColor="rgba(255,255,255,0.65)"
                logoBackground="rgba(255,255,255,0.15)"
              />
            </View>
          )}

          {/* Geo-fence banner */}
          <View style={{ marginTop: 14, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: geofenceBg }}>
            {gpsLoading
              ? <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
              : <Feather name={geofenceIcon} size={16} color={geofenceColor} />
            }
            <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>{geofenceText}</Text>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 14 }}>
          {/* ── Today's Attendance Card ──────────────────────────── */}
          <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" }}>Today's Attendance</Text>
              <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: statusChip.bg }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: statusChip.color }}>{statusChip.label}</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { icon: "log-in" as const, label: "CHECK IN", value: checkInRecord ? fmtTime(checkInRecord.timestamp) : "—", color: "#16A34A" },
                { icon: "log-out" as const, label: "CHECK OUT", value: checkOutRecord ? fmtTime(checkOutRecord.timestamp) : "—", color: "#DC2626" },
                { icon: "clock" as const, label: "HOURS", value: hoursElapsed > 0 ? fmtHours(hoursElapsed) : "—", color: colors.primary },
              ].map(col => (
                <View key={col.label} style={{ flex: 1, backgroundColor: colors.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
                  <Feather name={col.icon} size={15} color={col.color} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 9, fontFamily: "Inter_500Medium", marginTop: 6, letterSpacing: 0.4 }}>{col.label}</Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_700Bold", marginTop: 2 }}>{col.value}</Text>
                </View>
              ))}
            </View>

            {checkInRecord?.selfieUri && (
              <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: "#F0FDF4", borderRadius: 10, borderWidth: 1, borderColor: "#BBF7D0" }}>
                <Feather name="camera" size={14} color="#16A34A" />
                <Text style={{ color: "#16A34A", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>Selfie proof captured</Text>
                <Feather name="check" size={14} color="#16A34A" />
              </View>
            )}
          </View>

          {/* ── Action Button ────────────────────────────────────── */}
          {todayStatus !== "checked-out" ? (
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                if (isCheckedIn) {
                  router.push("/attendance/check-out?gpsKm=0&vehicleType=" as never);
                } else {
                  router.push("/attendance/check-in");
                }
              }}
              style={({ pressed }) => ({ borderRadius: 16, opacity: pressed ? 0.88 : 1 })}
            >
              <LinearGradient
                colors={isCheckedIn ? ["#DC2626", "#B91C1C"] : ["#16A34A", "#15803D"]}
                style={{ paddingVertical: 20, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 12, borderRadius: 16 }}
              >
                <Feather name={isCheckedIn ? "log-out" : "camera"} size={22} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" }}>
                  {isCheckedIn ? "Check Out" : "Check In"}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={{ backgroundColor: "#F0FDF4", borderRadius: 16, padding: 20, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#BBF7D0" }}>
              <Feather name="check-circle" size={28} color="#16A34A" />
              <Text style={{ color: "#16A34A", fontSize: 16, fontFamily: "Inter_700Bold" }}>Attendance Complete</Text>
              <Text style={{ color: "#15803D", fontSize: 13, fontFamily: "Inter_400Regular" }}>Total: {fmtHours(hoursElapsed)} worked today</Text>
            </View>
          )}

          {/* ── Monthly Summary ──────────────────────────────────── */}
          <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_700Bold" }}>
                {new Date().toLocaleString("en-IN", { month: "long" })} Summary
              </Text>
              <Pressable onPress={() => router.push("/(staff)/attendance" as never)} hitSlop={8}>
                <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Full Calendar →</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { label: "Present", value: monthStats?.presentCount ?? "—", color: "#16A34A", bg: "#DCFCE7" },
                { label: "Partial", value: monthStats?.partialCount ?? "—", color: "#D97706", bg: "#FEF9C3" },
                { label: "Absent", value: monthStats?.absentCount ?? "—", color: "#DC2626", bg: "#FEE2E2" },
              ].map(s => (
                <View key={s.label} style={{ flex: 1, backgroundColor: s.bg, borderRadius: 12, padding: 12, alignItems: "center" }}>
                  <Text style={{ color: s.color, fontSize: 22, fontFamily: "Inter_700Bold" }}>{s.value}</Text>
                  <Text style={{ color: s.color, fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {monthStats != null && (
              <>
                <View style={{ marginTop: 10, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ width: `${monthStats.attendancePercent}%`, height: "100%", backgroundColor: "#16A34A", borderRadius: 3 }} />
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 5, textAlign: "right" }}>
                  {monthStats.attendancePercent}% attendance this month
                </Text>
              </>
            )}
          </View>

          {/* ── Quick Links ──────────────────────────────────────── */}
          <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
            {([
              {
                icon: "calendar" as const,
                label: "Attendance Calendar",
                sub: "Monthly view with daily details",
                onPress: () => router.push("/(staff)/attendance" as never),
              },
              {
                icon: "bell" as const,
                label: "Notices",
                sub: unreadCount > 0 ? `${unreadCount} unread notice${unreadCount > 1 ? "s" : ""}` : "All caught up",
                onPress: () => router.push("/(staff)/notices" as never),
              },
            ] as const).map((item, i, arr) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  gap: 12,
                  backgroundColor: pressed ? colors.border + "60" : "transparent",
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                })}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + "14", alignItems: "center", justifyContent: "center" }}>
                  <Feather name={item.icon} size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{item.label}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 }}>{item.sub}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
