import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceDay = {
  date: string;
  status: "present" | "partial" | "absent";
  checkinTime: string | null;
  checkoutTime: string | null;
  totalKm: number;
  tripCount: number;
};

type AttendanceMonth = {
  year: number;
  month: number;
  days: AttendanceDay[];
  presentCount: number;
  partialCount: number;
  absentCount: number;
  totalKm: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const DAY_INITIALS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

const STATUS_COLOR = {
  present: "#16A34A",
  partial: "#D97706",
  absent: "#EF4444",
} as const;

const STATUS_BG = {
  present: "#DCFCE7",
  partial: "#FEF9C3",
  absent: "#FEE2E2",
} as const;

const STATUS_LABEL = {
  present: "Present",
  partial: "Partial",
  absent: "Absent",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCalendarGrid(year: number, month: number): (null | { day: number; date: string })[][] {
  const total = new Date(year, month, 0).getDate();
  const start = new Date(year, month - 1, 1).getDay();
  const cells: (null | { day: number; date: string })[] = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= total; d++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ day: d, date: `${year}-${mm}-${dd}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (null | { day: number; date: string })[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function fmtDayLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });
}

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN || "";
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AttendanceCalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [data, setData] = useState<AttendanceMonth | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCalendar = useCallback(async (staffId: string, year: number, month: number) => {
    setIsLoading(true);
    try {
      const base = getApiBase();
      const url = `${base}/api/activity/attendance-calendar?staffId=${encodeURIComponent(staffId)}&year=${year}&month=${month}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as AttendanceMonth;
      setData(json);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      void fetchCalendar(user.id, calYear, calMonth);
    }
  }, [user?.id, calYear, calMonth, fetchCalendar]);

  function navigateMonth(delta: number) {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setCalMonth(m);
    setCalYear(y);
    setSelectedDate(null);
  }

  const calGrid = React.useMemo(
    () => buildCalendarGrid(calYear, calMonth),
    [calYear, calMonth],
  );

  const dayMap = React.useMemo(() => {
    const m = new Map<string, AttendanceDay>();
    data?.days.forEach((d) => m.set(d.date, d));
    return m;
  }, [data]);

  const today = todayIST();
  const selectedDay = selectedDate ? (dayMap.get(selectedDate) ?? null) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16 + webTop,
            paddingBottom: 18,
            backgroundColor: colors.primary,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.headerTitle}>Attendance Calendar</Text>
            <Text style={styles.headerSub}>{user?.name ?? "Field Staff"}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary strip ─────────────────────────────────────────────── */}
        <View
          style={[
            styles.summaryStrip,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <SummaryPill
            color="#16A34A"
            label="Present"
            value={data ? String(data.presentCount) : "—"}
          />
          <View style={[styles.pillSep, { backgroundColor: colors.border }]} />
          <SummaryPill
            color="#D97706"
            label="Partial"
            value={data ? String(data.partialCount) : "—"}
          />
          <View style={[styles.pillSep, { backgroundColor: colors.border }]} />
          <SummaryPill
            color="#EF4444"
            label="Absent"
            value={data ? String(data.absentCount) : "—"}
          />
          <View style={[styles.pillSep, { backgroundColor: colors.border }]} />
          <SummaryPill
            color="#0D6EAE"
            label="Km"
            value={data ? String(data.totalKm) : "—"}
          />
        </View>

        {/* ── Calendar ──────────────────────────────────────────────────── */}
        <View style={[styles.calSection, { paddingTop: 20 }]}>
          {/* Month navigator */}
          <View style={styles.calNavRow}>
            <Pressable
              onPress={() => navigateMonth(-1)}
              style={({ pressed }) => [
                styles.calNavBtn,
                { backgroundColor: colors.muted, borderRadius: colors.radius, opacity: pressed ? 0.7 : 1 },
              ]}
              hitSlop={8}
            >
              <Feather name="chevron-left" size={18} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.calMonthLabel, { color: colors.foreground }]}>
              {MONTH_NAMES[calMonth - 1]} {calYear}
            </Text>
            <Pressable
              onPress={() => navigateMonth(1)}
              style={({ pressed }) => [
                styles.calNavBtn,
                { backgroundColor: colors.muted, borderRadius: colors.radius, opacity: pressed ? 0.7 : 1 },
              ]}
              hitSlop={8}
            >
              <Feather name="chevron-right" size={18} color={colors.foreground} />
            </Pressable>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {(["present", "partial", "absent"] as const).map((s) => (
              <View key={s} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR[s] }]} />
                <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>
                  {STATUS_LABEL[s]}
                </Text>
              </View>
            ))}
          </View>

          {/* Day-of-week headers */}
          <View style={styles.calDayHeaders}>
            {DAY_INITIALS.map((d) => (
              <Text key={d} style={[styles.calDayHeader, { color: colors.mutedForeground }]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar grid */}
          {isLoading ? (
            <View style={styles.centeredLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.calGrid}>
              {calGrid.map((row, ri) => (
                <View key={ri} style={styles.calRow}>
                  {row.map((cell, ci) => {
                    if (!cell) return <View key={ci} style={styles.calCell} />;

                    const dayData = dayMap.get(cell.date);
                    const isSelected = selectedDate === cell.date;
                    const isToday = cell.date === today;
                    const isFuture = cell.date > today;
                    const status = dayData?.status;

                    const bgColor = isSelected
                      ? colors.primary
                      : status
                        ? STATUS_BG[status]
                        : isFuture
                          ? "transparent"
                          : colors.muted;

                    const textColor = isSelected
                      ? "#fff"
                      : isFuture
                        ? colors.mutedForeground
                        : status
                          ? STATUS_COLOR[status]
                          : colors.mutedForeground;

                    return (
                      <Pressable
                        key={ci}
                        onPress={() => {
                          if (isFuture) return;
                          setSelectedDate(isSelected ? null : cell.date);
                        }}
                        style={({ pressed }) => [
                          styles.calCell,
                          styles.calCellActive,
                          {
                            backgroundColor: bgColor,
                            borderRadius: colors.radius - 2,
                            borderWidth: isToday || isSelected ? 2 : 0,
                            borderColor: colors.primary,
                            opacity: pressed && !isFuture ? 0.75 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.calDayNum,
                            {
                              color: textColor,
                              fontFamily: isToday ? "Inter_700Bold" : "Inter_400Regular",
                            },
                          ]}
                        >
                          {cell.day}
                        </Text>
                        {status && (
                          <View
                            style={[
                              styles.statusDot,
                              {
                                backgroundColor: isSelected ? "#fff" : STATUS_COLOR[status],
                              },
                            ]}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {/* Selected day detail */}
          {selectedDate && (
            <View
              style={[
                styles.detailCard,
                {
                  backgroundColor: colors.card,
                  borderColor: selectedDay
                    ? STATUS_COLOR[selectedDay.status] + "44"
                    : colors.border,
                  borderRadius: colors.radius + 2,
                },
              ]}
            >
              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailDate, { color: colors.foreground }]}>
                    {fmtDayLabel(selectedDate)}
                  </Text>
                  {selectedDay && (
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: STATUS_BG[selectedDay.status],
                          borderColor: STATUS_COLOR[selectedDay.status] + "55",
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDotLg,
                          { backgroundColor: STATUS_COLOR[selectedDay.status] },
                        ]}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Inter_600SemiBold",
                          color: STATUS_COLOR[selectedDay.status],
                        }}
                      >
                        {STATUS_LABEL[selectedDay.status]}
                      </Text>
                    </View>
                  )}
                </View>
                <Pressable onPress={() => setSelectedDate(null)} hitSlop={8}>
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {selectedDay ? (
                <View style={styles.detailGrid}>
                  <DetailStat
                    icon="log-in"
                    label="Check-in"
                    value={fmtTime(selectedDay.checkinTime)}
                    color="#16A34A"
                    colors={colors}
                  />
                  <DetailStat
                    icon="log-out"
                    label="Check-out"
                    value={fmtTime(selectedDay.checkoutTime)}
                    color="#6B7280"
                    colors={colors}
                  />
                  <DetailStat
                    icon="map"
                    label="Trips"
                    value={String(selectedDay.tripCount)}
                    color="#7C3AED"
                    colors={colors}
                  />
                  <DetailStat
                    icon="navigation"
                    label="Distance"
                    value={`${selectedDay.totalKm.toFixed(1)} km`}
                    color="#0D6EAE"
                    colors={colors}
                  />
                </View>
              ) : (
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 13,
                    fontFamily: "Inter_400Regular",
                    marginTop: 8,
                  }}
                >
                  No attendance data for this day.
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryPill({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function DetailStat({
  icon, label, value, color, colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  color: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.detailStat,
        { backgroundColor: color + "10", borderColor: color + "28" },
      ]}
    >
      <Feather name={icon} size={15} color={color} />
      <Text style={[styles.detailStatValue, { color }]}>{value}</Text>
      <Text style={[styles.detailStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  headerSub: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryPill: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  summaryLabel: {
    fontSize: 10, fontFamily: "Inter_500Medium", color: "#9CA3AF",
    marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4,
  },
  pillSep: { width: StyleSheet.hairlineWidth, height: 30 },
  calSection: { paddingHorizontal: 16 },
  calNavRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  calNavBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  calMonthLabel: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  legend: { flexDirection: "row", gap: 16, marginBottom: 12, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  calDayHeaders: { flexDirection: "row", marginBottom: 6 },
  calDayHeader: {
    flex: 1, textAlign: "center", fontSize: 11,
    fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3,
  },
  calGrid: { gap: 4 },
  calRow: { flexDirection: "row", gap: 4 },
  calCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  calCellActive: { padding: 2 },
  calDayNum: { fontSize: 14 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  centeredLoader: { paddingVertical: 40, alignItems: "center" },
  detailCard: { marginTop: 16, padding: 16, borderWidth: 1.5 },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  detailDate: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.2, marginBottom: 6 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, borderWidth: 1,
  },
  statusDotLg: { width: 6, height: 6, borderRadius: 3 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailStat: {
    width: "47%", flexGrow: 1, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10,
    paddingHorizontal: 12, alignItems: "center", gap: 3,
  },
  detailStatValue: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  detailStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
