/**
 * QR Attendance Admin View
 *
 * Shows today's ground staff QR attendance — who checked in/out, time, who scanned.
 * Date navigation allowed. PDF ID card download button also here.
 */

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

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
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
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

type QrRow = {
  id: string;
  staffId: string;
  staffName: string;
  scannedByName: string;
  type: "checkin" | "checkout";
  date: string;
  lat: number | null;
  lng: number | null;
  occurredAt: string;
};

type StaffSummary = {
  staffId: string;
  staffName: string;
  checkin: QrRow | null;
  checkout: QrRow | null;
};

function groupByStaff(rows: QrRow[]): StaffSummary[] {
  const map = new Map<string, StaffSummary>();
  for (const row of rows) {
    if (!map.has(row.staffId)) {
      map.set(row.staffId, { staffId: row.staffId, staffName: row.staffName, checkin: null, checkout: null });
    }
    const s = map.get(row.staffId)!;
    if (row.type === "checkin" && !s.checkin) s.checkin = row;
    if (row.type === "checkout" && !s.checkout) s.checkout = row;
  }
  return [...map.values()].sort((a, b) => a.staffName.localeCompare(b.staffName));
}

export default function QrAttendanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const [date, setDate] = useState(todayIST());
  const [rows, setRows] = useState<QrRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = 84;

  const fetchData = useCallback(async (d: string, isRefresh = false) => {
    if (!user?.phone) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/admin/qr-attendance?date=${d}`, {
        headers: { "x-admin-phone": user.phone },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as QrRow[];
      setRows(json);
    } catch {
      Alert.alert("Error", "Could not load QR attendance.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.phone]);

  useEffect(() => { void fetchData(date); }, [date, fetchData]);

  const handleDownloadIdCards = async () => {
    if (!user?.phone) return;
    setDownloading(true);
    try {
      const base = getApiBase();
      const url = `${base}/api/admin/staff/id-cards/pdf?group=ground`;
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = url;
        a.download = "ground-staff-id-cards.pdf";
        a.click();
        return;
      }
      const fsDir = (FileSystem as unknown as { documentDirectory?: string | null }).documentDirectory ?? "";
      const dest = `${fsDir}ground-staff-id-cards.pdf`;
      const dlRes = await FileSystem.downloadAsync(url, dest, { headers: { "x-admin-phone": user.phone } });
      if (dlRes.status !== 200) throw new Error("Download failed");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dlRes.uri, { mimeType: "application/pdf", dialogTitle: "Ground Staff ID Cards" });
      }
    } catch {
      Alert.alert("Error", "Could not download ID cards PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const summaries = groupByStaff(rows);
  const presentCount = summaries.filter(s => s.checkin).length;
  const checkoutCount = summaries.filter(s => s.checkout).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.primary, "#13325F"]}
        style={{
          paddingTop: insets.top + (Platform.OS === "web" ? webTop : 16),
          paddingBottom: 20,
          paddingHorizontal: 20,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginRight: 12, padding: 4 })}
            hitSlop={8}
          >
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" }}>QR Attendance</Text>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
              Ground staff — scanned by supervisor
            </Text>
          </View>
          {/* Download ID cards button */}
          <Pressable
            onPress={handleDownloadIdCards}
            disabled={downloading}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 5,
              paddingHorizontal: 12, paddingVertical: 8,
              backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8,
              opacity: pressed || downloading ? 0.7 : 1,
            })}
          >
            {downloading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="credit-card" size={14} color="#fff" />}
            <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
              {downloading ? "..." : "ID Cards"}
            </Text>
          </Pressable>
        </View>

        {/* Date navigation */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => setDate(d => shiftDate(d, -1))}
            style={({ pressed }) => [styles.dateArrow, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={8}
          >
            <Feather name="chevron-left" size={18} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>
              {formatDateLabel(date)}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{date}</Text>
          </View>
          <Pressable
            onPress={() => setDate(d => shiftDate(d, 1))}
            disabled={date >= todayIST()}
            style={({ pressed }) => [styles.dateArrow, { opacity: (pressed || date >= todayIST()) ? 0.4 : 1 }]}
            hitSlop={8}
          >
            <Feather name="chevron-right" size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          {[
            { label: "Checked In", value: presentCount, color: "#34D399", bg: "rgba(52,211,153,0.18)" },
            { label: "Checked Out", value: checkoutCount, color: "#60A5FA", bg: "rgba(96,165,250,0.18)" },
            { label: "Total Scans", value: rows.length, color: "#FCD34D", bg: "rgba(252,211,77,0.18)" },
          ].map(s => (
            <View key={s.label} style={[styles.statChip, { backgroundColor: s.bg }]}>
              <Text style={{ color: s.color, fontSize: 20, fontFamily: "Inter_700Bold" }}>{s.value}</Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontFamily: "Inter_500Medium" }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Quick action buttons */}
      <View style={{ flexDirection: "row", gap: 10, padding: 14 }}>
        <Pressable
          onPress={() => router.push({ pathname: "/attendance/qr-scan", params: { mode: "checkin" } } as never)}
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#16A34A", opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="log-in" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Scan Check-In</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: "/attendance/qr-scan", params: { mode: "checkout" } } as never)}
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#DC2626", opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="log-out" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Scan Check-Out</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + webBottomPad + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(date, true)} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : summaries.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="maximize" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No QR attendance yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {date === todayIST()
                ? "Scan a ground staff's QR card to mark attendance."
                : "No records for this date."}
            </Text>
          </View>
        ) : (
          summaries.map((s) => (
            <View key={s.staffId} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Staff name row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={{ color: colors.primary, fontSize: 14, fontFamily: "Inter_700Bold" }}>
                    {s.staffName.trim()[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
                <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 }}>
                  {s.staffName}
                </Text>
                {s.checkin && s.checkout ? (
                  <View style={[styles.statusPill, { backgroundColor: "#DCFCE7" }]}>
                    <Text style={{ color: "#16A34A", fontSize: 10, fontFamily: "Inter_700Bold" }}>Present</Text>
                  </View>
                ) : s.checkin ? (
                  <View style={[styles.statusPill, { backgroundColor: "#FEF9C3" }]}>
                    <Text style={{ color: "#D97706", fontSize: 10, fontFamily: "Inter_700Bold" }}>On Shift</Text>
                  </View>
                ) : null}
              </View>

              {/* Check-in row */}
              <View style={styles.timeRow}>
                <View style={[styles.timeDot, { backgroundColor: s.checkin ? "#16A34A" : "#D1D5DB" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium" }}>CHECK-IN</Text>
                  {s.checkin ? (
                    <>
                      <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                        {fmtTime(s.checkin.occurredAt)}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                        by {s.checkin.scannedByName}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>Not yet</Text>
                  )}
                </View>
                {s.checkin?.lat != null && s.checkin?.lng != null && (
                  <Feather name="map-pin" size={12} color="#16A34A" />
                )}
              </View>

              {/* Check-out row */}
              <View style={styles.timeRow}>
                <View style={[styles.timeDot, { backgroundColor: s.checkout ? "#DC2626" : "#D1D5DB" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium" }}>CHECK-OUT</Text>
                  {s.checkout ? (
                    <>
                      <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                        {fmtTime(s.checkout.occurredAt)}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                        by {s.checkout.scannedByName}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>Not yet</Text>
                  )}
                </View>
                {s.checkout?.lat != null && s.checkout?.lng != null && (
                  <Feather name="map-pin" size={12} color="#DC2626" />
                )}
              </View>

              {/* Duration */}
              {s.checkin && s.checkout && (
                <View style={[styles.durationRow, { backgroundColor: colors.muted }]}>
                  <Feather name="clock" size={11} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                    {(() => {
                      const ms = new Date(s.checkout.occurredAt).getTime() - new Date(s.checkin!.occurredAt).getTime();
                      const h = Math.floor(ms / 3600000);
                      const m = Math.floor((ms % 3600000) / 60000);
                      return h > 0 ? `${h}h ${m}m on shift` : `${m}m on shift`;
                    })()}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dateArrow: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  statChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  emptySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 18,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  timeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 14,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 2,
  },
});
