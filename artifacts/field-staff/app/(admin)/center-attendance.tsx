import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtHours(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return "—";
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string): string {
  const today = todayIST();
  const yesterday = shiftDate(today, -1);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

type AttendanceRow = {
  staffId: string;
  staffName: string;
  empCode: string | null;
  centerStaffRole: string | null;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: "present" | "partial" | "absent";
  checkInOutsideGeofence: boolean | null;
  checkOutOutsideGeofence: boolean | null;
  checkInDistanceM: number | null;
  checkOutDistanceM: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  partial: "On Shift",
  absent: "Absent",
};
const STATUS_BG: Record<string, string> = {
  present: "#DCFCE7",
  partial: "#FEF9C3",
  absent: "#FEE2E2",
};
const STATUS_COLOR: Record<string, string> = {
  present: "#16A34A",
  partial: "#D97706",
  absent: "#DC2626",
};

export default function CenterAttendanceAdmin() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const [date, setDate] = useState(todayIST());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = 84;

  const fetchData = useCallback(async (d: string, isRefresh = false) => {
    if (!user?.phone) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const base = getApiBase();
      const url = `${base}/api/admin/center-attendance?dateFrom=${d}&dateTo=${d}`;
      const res = await fetch(url, { headers: { "x-admin-phone": user.phone } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as AttendanceRow[];
      setRows(json);
    } catch (e) {
      Alert.alert("Error", "Could not load attendance data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.phone]);

  useEffect(() => { void fetchData(date); }, [date, fetchData]);

  const handleExport = async () => {
    if (!user?.phone) return;
    setExporting(true);
    try {
      const base = getApiBase();
      const url = `${base}/api/admin/center-attendance/xlsx?dateFrom=${date}&dateTo=${date}`;
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = url;
        a.download = `center-attendance-${date}.xlsx`;
        a.click();
        return;
      }
      const fsDir = (FileSystem as unknown as { documentDirectory?: string | null }).documentDirectory ?? "";
      const dest = `${fsDir}center-attendance-${date}.xlsx`;
      const res = await FileSystem.downloadAsync(
        url,
        dest,
        { headers: { "x-admin-phone": user.phone } },
      );
      if (res.status !== 200) throw new Error("Download failed");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", dialogTitle: "Center Staff Attendance" });
      }
    } catch {
      Alert.alert("Export failed", "Could not download the report.");
    } finally {
      setExporting(false);
    }
  };

  const presentCount = rows.filter(r => r.status === "present").length;
  const partialCount = rows.filter(r => r.status === "partial").length;
  const absentCount  = rows.filter(r => r.status === "absent").length;
  const totalCount   = rows.length;
  const violationCount = rows.filter(r => r.checkInOutsideGeofence === true).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#1E3A5F", "#0D2240"]}
        style={{
          paddingTop: insets.top + webTop + 14,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" }}>Center Staff Attendance</Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 }}>
              Selfie + GPS verified check-ins
            </Text>
          </View>
          <Pressable
            onPress={handleExport}
            disabled={exporting}
            style={({ pressed }) => ({
              backgroundColor: "rgba(255,255,255,0.12)",
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 7,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              opacity: pressed || exporting ? 0.7 : 1,
            })}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="download" size={14} color="#fff" />
            }
            <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Excel</Text>
          </Pressable>
        </View>

        {/* Date navigator */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 14, gap: 16 }}>
          <Pressable
            onPress={() => setDate(d => shiftDate(d, -1))}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: 6 })}
            hitSlop={8}
          >
            <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.8)" />
          </Pressable>
          <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold", minWidth: 120, textAlign: "center" }}>
            {formatDateLabel(date)}
          </Text>
          <Pressable
            onPress={() => setDate(d => shiftDate(d, 1))}
            disabled={date >= todayIST()}
            style={({ pressed }) => ({ opacity: (pressed || date >= todayIST()) ? 0.4 : 1, padding: 6 })}
            hitSlop={8}
          >
            <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + webBottomPad + 16, paddingTop: 16, gap: 12, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(date, true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary Cards ──────────────────────────────────────── */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { label: "Total", value: totalCount, color: colors.primary, bg: colors.primary + "14" },
            { label: "Present", value: presentCount, color: "#16A34A", bg: "#DCFCE7" },
            { label: "On Shift", value: partialCount, color: "#D97706", bg: "#FEF9C3" },
            { label: "Absent", value: absentCount, color: "#DC2626", bg: "#FEE2E2" },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: s.bg, borderRadius: 12, padding: 10, alignItems: "center" }}>
              {loading
                ? <ActivityIndicator size="small" color={s.color} />
                : <Text style={{ color: s.color, fontSize: 20, fontFamily: "Inter_700Bold" }}>{s.value}</Text>
              }
              <Text style={{ color: s.color, fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {violationCount > 0 && (
          <View style={{ backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#FECACA" }}>
            <Feather name="alert-triangle" size={16} color="#DC2626" />
            <Text style={{ color: "#DC2626", fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 }}>
              {violationCount} geo-fence violation{violationCount > 1 ? "s" : ""} today
            </Text>
          </View>
        )}

        {/* ── Attendance List ─────────────────────────────────────── */}
        {loading && rows.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : rows.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
            <Feather name="users" size={36} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14, textAlign: "center" }}>
              No center staff found for this date.
            </Text>
          </View>
        ) : (
          rows.map((row, i) => (
            <View
              key={`${row.staffId}|${i}`}
              style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}
            >
              {/* Name row */}
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_700Bold" }}>{row.staffName}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                    {row.centerStaffRole ? `${row.centerStaffRole} · ` : ""}{row.empCode ?? ""}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: STATUS_BG[row.status] }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: STATUS_COLOR[row.status] }}>
                    {STATUS_LABEL[row.status]}
                  </Text>
                </View>
              </View>

              {/* Time grid */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { icon: "log-in" as const, label: "Check In", value: fmtTime(row.checkInTime), color: "#16A34A" },
                  { icon: "log-out" as const, label: "Check Out", value: fmtTime(row.checkOutTime), color: "#DC2626" },
                  { icon: "clock" as const, label: "Hours", value: fmtHours(row.checkInTime, row.checkOutTime), color: colors.primary },
                ].map(col => (
                  <View key={col.label} style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
                    <Feather name={col.icon} size={13} color={col.color} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 9, fontFamily: "Inter_500Medium", marginTop: 5, letterSpacing: 0.3 }}>{col.label.toUpperCase()}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 2 }}>{col.value}</Text>
                  </View>
                ))}
              </View>

              {/* Geo-fence proof */}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                {row.checkInTime && (
                  <View style={{
                    flex: 1, flexDirection: "row", alignItems: "center", gap: 5, padding: 8, borderRadius: 8,
                    backgroundColor: row.checkInOutsideGeofence ? "#FEF2F2" : "#F0FDF4",
                    borderWidth: 1,
                    borderColor: row.checkInOutsideGeofence ? "#FECACA" : "#BBF7D0",
                  }}>
                    <Feather
                      name={row.checkInOutsideGeofence ? "alert-circle" : "check-circle"}
                      size={12}
                      color={row.checkInOutsideGeofence ? "#DC2626" : "#16A34A"}
                    />
                    <Text style={{ color: row.checkInOutsideGeofence ? "#DC2626" : "#16A34A", fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 }}>
                      {row.checkInOutsideGeofence
                        ? `CI outside · ${row.checkInDistanceM ?? "?"}m`
                        : `CI inside · ${row.checkInDistanceM ?? "—"}m`}
                    </Text>
                  </View>
                )}
                {row.checkOutTime && (
                  <View style={{
                    flex: 1, flexDirection: "row", alignItems: "center", gap: 5, padding: 8, borderRadius: 8,
                    backgroundColor: row.checkOutOutsideGeofence ? "#FEF2F2" : "#F0FDF4",
                    borderWidth: 1,
                    borderColor: row.checkOutOutsideGeofence ? "#FECACA" : "#BBF7D0",
                  }}>
                    <Feather
                      name={row.checkOutOutsideGeofence ? "alert-circle" : "check-circle"}
                      size={12}
                      color={row.checkOutOutsideGeofence ? "#DC2626" : "#16A34A"}
                    />
                    <Text style={{ color: row.checkOutOutsideGeofence ? "#DC2626" : "#16A34A", fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 }}>
                      {row.checkOutOutsideGeofence
                        ? `CO outside · ${row.checkOutDistanceM ?? "?"}m`
                        : `CO inside · ${row.checkOutDistanceM ?? "—"}m`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({});
