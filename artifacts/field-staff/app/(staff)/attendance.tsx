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
  startOdometer: number | null;
  endOdometer: number | null;
  odometerKm: number | null;
  vehicleType: string | null;
};

type AttendanceMonth = {
  year: number;
  month: number;
  days: AttendanceDay[];
  presentCount: number;
  partialCount: number;
  absentCount: number;
  totalKm: number;
  totalWorkingDays: number;
  attendancePercent: number;
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
        {/* ── Attendance Summary Card ───────────────────────────────────── */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {/* Card title row */}
          <View style={styles.summaryCardHeader}>
            <Text style={[styles.summaryCardTitle, { color: colors.foreground }]}>
              Attendance Summary
            </Text>
            <Text style={[styles.summaryCardSub, { color: colors.mutedForeground }]}>
              {MONTH_NAMES[calMonth - 1]} {calYear}
            </Text>
          </View>

          {/* Attendance % hero */}
          <View style={styles.percentHero}>
            <View
              style={[
                styles.percentCircle,
                {
                  borderColor:
                    !data
                      ? colors.border
                      : data.attendancePercent >= 75
                        ? "#16A34A"
                        : data.attendancePercent >= 50
                          ? "#D97706"
                          : "#EF4444",
                },
              ]}
            >
              <Text
                style={[
                  styles.percentValue,
                  {
                    color: !data
                      ? colors.mutedForeground
                      : data.attendancePercent >= 75
                        ? "#16A34A"
                        : data.attendancePercent >= 50
                          ? "#D97706"
                          : "#EF4444",
                  },
                ]}
              >
                {data ? `${data.attendancePercent}%` : "—"}
              </Text>
              <Text style={[styles.percentLabel, { color: colors.mutedForeground }]}>
                Attendance
              </Text>
            </View>

            {/* Right-side stats column */}
            <View style={styles.percentStats}>
              <SummaryRow
                dot="#6B7280"
                label="Working Days"
                value={data ? String(data.totalWorkingDays) : "—"}
                colors={colors}
              />
              <View style={[styles.summaryRowSep, { backgroundColor: colors.border }]} />
              <SummaryRow
                dot="#16A34A"
                label="Present"
                value={data ? String(data.presentCount) : "—"}
                colors={colors}
                valueColor="#16A34A"
              />
              <View style={[styles.summaryRowSep, { backgroundColor: colors.border }]} />
              <SummaryRow
                dot="#D97706"
                label="Partial"
                value={data ? String(data.partialCount) : "—"}
                colors={colors}
                valueColor="#D97706"
              />
              <View style={[styles.summaryRowSep, { backgroundColor: colors.border }]} />
              <SummaryRow
                dot="#EF4444"
                label="Absent"
                value={data ? String(data.absentCount) : "—"}
                colors={colors}
                valueColor="#EF4444"
              />
            </View>
          </View>
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
                <>
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
                      label="GPS Distance"
                      value={`${selectedDay.totalKm.toFixed(1)} km`}
                      color="#0D6EAE"
                      colors={colors}
                    />
                  </View>
                  {selectedDay.odometerKm != null && (
                    <View style={{
                      marginTop: 14,
                      borderRadius: 12,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      overflow: "hidden",
                    }}>
                      <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: "rgba(16,122,64,0.08)",
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}>
                        <Feather name="activity" size={13} color="#16A34A" />
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.foreground, letterSpacing: 0.3 }}>
                          Odometer vs GPS
                          {selectedDay.vehicleType ? `  ·  ${selectedDay.vehicleType === "2-wheeler" ? "🏍️ 2-W" : "🚗 4-W"}` : ""}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row" }}>
                        <View style={{ flex: 1, padding: 10, alignItems: "center", gap: 2 }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Start Odo</Text>
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground }}>
                            {selectedDay.startOdometer != null ? `${selectedDay.startOdometer} km` : "—"}
                          </Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: colors.border }} />
                        <View style={{ flex: 1, padding: 10, alignItems: "center", gap: 2 }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>End Odo</Text>
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground }}>
                            {selectedDay.endOdometer != null ? `${selectedDay.endOdometer} km` : "—"}
                          </Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: colors.border }} />
                        <View style={{ flex: 1, padding: 10, alignItems: "center", gap: 2 }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Odo KM</Text>
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#7C3AED" }}>
                            {`${selectedDay.odometerKm.toFixed(1)} km`}
                          </Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: colors.border }} />
                        <View style={{ flex: 1, padding: 10, alignItems: "center", gap: 2 }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>GPS KM</Text>
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#0D6EAE" }}>
                            {`${selectedDay.totalKm.toFixed(1)} km`}
                          </Text>
                        </View>
                      </View>
                      {selectedDay.odometerKm > 0 && selectedDay.totalKm > 0 && (() => {
                        const diff = Math.abs(selectedDay.odometerKm - selectedDay.totalKm);
                        const pct = Math.round((diff / selectedDay.odometerKm) * 100);
                        const ok = pct <= 15;
                        return (
                          <View style={{
                            flexDirection: "row", alignItems: "center", gap: 6,
                            paddingHorizontal: 12, paddingVertical: 7,
                            borderTopWidth: 1, borderTopColor: colors.border,
                            backgroundColor: ok ? "rgba(16,163,74,0.06)" : "rgba(220,38,38,0.07)",
                          }}>
                            <Feather name={ok ? "check-circle" : "alert-triangle"} size={12} color={ok ? "#16A34A" : "#DC2626"} />
                            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: ok ? "#16A34A" : "#DC2626" }}>
                              {ok
                                ? `Variance ${pct}% — within acceptable range`
                                : `Variance ${pct}% — GPS & odometer mismatch`}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  )}
                </>
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

function SummaryRow({
  dot, label, value, colors, valueColor,
}: {
  dot: string;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  valueColor?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.summaryRowDot, { backgroundColor: dot }]} />
      <Text style={[styles.summaryRowLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.summaryRowValue, { color: valueColor ?? colors.foreground }]}>
        {value}
      </Text>
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
  summaryCard: {
    margin: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  summaryCardHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  summaryCardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  summaryCardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  percentHero: { flexDirection: "row", alignItems: "center", gap: 16 },
  percentCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  percentValue: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  percentLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 1 },
  percentStats: { flex: 1, gap: 4 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 3 },
  summaryRowDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  summaryRowLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  summaryRowValue: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  summaryRowSep: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
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
