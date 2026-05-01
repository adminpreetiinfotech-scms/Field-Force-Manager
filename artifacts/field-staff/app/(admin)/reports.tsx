import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getGetLeaderboardQueryKey,
  getGetRideCalendarQueryKey,
  getGetTripReportQueryKey,
  useGetLeaderboard,
  useGetRideCalendar,
  useGetTripReport,
  useListStaff,
  type LeaderboardEntry,
  type RideCalendarDay,
  type TripReportRow,
} from "@workspace/api-client-react";

import { ReportContextBar } from "@/components/ReportContextBar";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { buildCsv, exportCsvFile, formatLocalTime } from "@/utils/csvExport";
import { downloadXlsxFile } from "@/utils/xlsxExport";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const DAY_INITIALS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function daysInMonthCount(year: number, month: number) {
  return new Date(year, month, 0).getDate(); // month is 1-based
}

function firstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay(); // 0 = Sun
}

type CalCell = { day: number; date: string } | null;

function buildCalendarGrid(year: number, month: number): CalCell[][] {
  const total = daysInMonthCount(year, month);
  const start = firstDayOfWeek(year, month);
  const cells: CalCell[] = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= total; d++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ day: d, date: `${year}-${mm}-${dd}` });
  }
  // Pad to full rows of 7
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: CalCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// Heat-map: returns an opacity [0..1] for number of rides.
// We use 5 tiers: 0 / 1 / 2-3 / 4-6 / 7+
function heatOpacity(count: number, maxCount: number): number {
  if (count === 0) return 0;
  if (maxCount === 0) return 0;
  // Scale so 1 ride = 0.22 and maxCount = 1.0, with a floor
  const ratio = count / maxCount;
  return Math.max(0.18, Math.min(1.0, 0.18 + ratio * 0.82));
}

// ─── Constants ────────────────────────────────────────────────────────────────

type Period = "daily" | "weekly" | "monthly";
const PERIODS: { key: Period; label: string }[] = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "Week" },
  { key: "monthly", label: "Month" },
];

const MEDAL_COLORS = ["#F59E0B", "#94A3B8", "#B45309"] as const;

type CsvPreset = "today" | "7d" | "30d" | "custom";
const CSV_PRESETS: { key: CsvPreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

function csvPresetDates(p: CsvPreset): { from: string; to: string } {
  const t = todayISO();
  if (p === "today") return { from: t, to: t };
  if (p === "7d") return { from: daysAgoISO(6), to: t };
  if (p === "30d") return { from: daysAgoISO(29), to: t };
  return { from: t, to: t };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const { user } = useApp();

  // ── Calendar state ─────────────────────────────────────────────────────────
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1); // 1-based
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const calParams = { year: calYear, month: calMonth };
  const { data: calData, isLoading: calLoading } = useGetRideCalendar(calParams, {
    query: {
      queryKey: getGetRideCalendarQueryKey(calParams),
      staleTime: 60_000,
    },
  });

  const calDayMap = React.useMemo(() => {
    const m = new Map<string, RideCalendarDay>();
    calData?.days.forEach((d) => m.set(d.date, d));
    return m;
  }, [calData]);

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

  // ── Leaderboard state ──────────────────────────────────────────────────────
  const [period, setPeriod] = useState<Period>("weekly");
  const [boardSearch, setBoardSearch] = useState("");
  const [sortBy, setSortBy] = useState<"km" | "rides">("km");

  // Clear search when switching periods so stale filter doesn't linger.
  const handlePeriodChange = useCallback(
    (p: Period) => {
      setPeriod(p);
      setBoardSearch("");
    },
    [],
  );

  const { data: board, isLoading: boardLoading } = useGetLeaderboard(
    { period },
    {
      query: {
        queryKey: getGetLeaderboardQueryKey({ period }),
        refetchInterval: 60_000,
        staleTime: 30_000,
      },
    },
  );

  // ── CSV export state ───────────────────────────────────────────────────────
  const [preset, setPreset] = useState<CsvPreset>("30d");
  const [customFrom, setCustomFrom] = useState(daysAgoISO(29));
  const [customTo, setCustomTo] = useState(todayISO());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const dates =
    preset === "custom"
      ? { from: customFrom, to: customTo }
      : csvPresetDates(preset);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const datesValid =
    DATE_RE.test(dates.from) &&
    DATE_RE.test(dates.to) &&
    dates.from <= dates.to;

  const { data: staffList } = useListStaff();

  const queryParams = {
    from: dates.from,
    to: dates.to,
    ...(selectedStaffId ? { staffId: selectedStaffId } : {}),
  };
  const {
    data: trips,
    isLoading: tripsLoading,
    isError: tripsError,
    refetch,
  } = useGetTripReport(queryParams, {
    query: {
      queryKey: getGetTripReportQueryKey(queryParams),
      enabled: datesValid,
      staleTime: 30_000,
    },
  });

  const onExport = useCallback(async () => {
    if (!trips?.length) return;
    setExporting(true);
    try {
      await exportCsvFile(
        buildCsv(trips),
        `ride-report-${dates.from}-to-${dates.to}.csv`,
      );
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Could not export CSV.");
    } finally {
      setExporting(false);
    }
  }, [trips, dates]);

  const totalKm = trips?.reduce((s, r) => s + (r.distanceKm ?? 0), 0) ?? 0;

  // ── Excel export state ──────────────────────────────────────────────────────
  const [xlPreset, setXlPreset] = useState<CsvPreset>("30d");
  const [xlCustomFrom, setXlCustomFrom] = useState(daysAgoISO(29));
  const [xlCustomTo, setXlCustomTo] = useState(todayISO());
  const [xlStaffId, setXlStaffId] = useState<string | null>(null);
  const [xlReportType, setXlReportType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [xlDownloading, setXlDownloading] = useState(false);

  const xlDates =
    xlPreset === "custom"
      ? { from: xlCustomFrom, to: xlCustomTo }
      : csvPresetDates(xlPreset);

  const onExportXlsx = useCallback(async () => {
    setXlDownloading(true);
    try {
      await downloadXlsxFile({
        from: xlDates.from,
        to: xlDates.to,
        staffId: xlStaffId,
        reportType: xlReportType,
        organization: user?.organization ?? undefined,
        staffName: user?.name ?? undefined,
      });
    } catch (e: any) {
      Alert.alert("Download Failed", e?.message || "Could not download Excel report.");
    } finally {
      setXlDownloading(false);
    }
  }, [xlDates, xlStaffId, xlReportType]);

  const renderTrip = useCallback(
    ({ item, index }: { item: TripReportRow; index: number }) => (
      <TripRow
        item={item}
        index={index}
        colors={colors}
        onPress={() => router.push(`/(admin)/mobilizer/${item.staffId}`)}
      />
    ),
    [colors, router],
  );

  // Re-sort and re-rank client-side based on the chosen sort metric.
  const sortedBoard = React.useMemo(
    () =>
      board
        ? [...board]
            .sort((a, b) =>
              sortBy === "km"
                ? b.totalKm - a.totalKm || b.tripCount - a.tripCount
                : b.tripCount - a.tripCount || b.totalKm - a.totalKm,
            )
            .map((e, i) => ({ ...e, rank: i + 1 }))
        : board,
    [board, sortBy],
  );

  // Max value for the proportional bar in each row.
  const maxVal =
    sortBy === "km"
      ? sortedBoard?.[0]?.totalKm ?? 1
      : sortedBoard?.[0]?.tripCount ?? 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16 + webTop,
            paddingBottom: 14,
            backgroundColor: colors.primary,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: "#fff" }]}>
          Reports
        </Text>
        <Text style={[styles.headerSub, { color: "rgba(255,255,255,0.72)" }]}>
          Calendar · Leaderboard · Export
        </Text>
        <ReportContextBar
          organization={user?.organization}
          staffName={user?.name}
          from={dates.from}
          to={dates.to}
          textColor="#fff"
          subColor="rgba(255,255,255,0.72)"
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 0 — RIDE HISTORY CALENDAR                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionGroup, { paddingTop: 20 }]}>
          {/* Section title row */}
          <View style={styles.sectionTitleRow}>
            <View
              style={[
                styles.sectionTitleIcon,
                { backgroundColor: "#22c55e22", borderRadius: 8 },
              ]}
            >
              <Feather name="calendar" size={15} color="#16a34a" />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Ride History
            </Text>
          </View>

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

          {/* Month summary */}
          {!calLoading && calData && (
            <View style={[styles.calSummaryRow, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
              <View style={styles.calSummaryItem}>
                <Text style={[styles.calSummaryNum, { color: "#16a34a" }]}>
                  {calData.totalRides}
                </Text>
                <Text style={[styles.calSummaryLabel, { color: colors.mutedForeground }]}>
                  rides
                </Text>
              </View>
              <View style={[styles.calSummaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.calSummaryItem}>
                <Text style={[styles.calSummaryNum, { color: colors.foreground }]}>
                  {calData.totalKm}
                </Text>
                <Text style={[styles.calSummaryLabel, { color: colors.mutedForeground }]}>
                  km
                </Text>
              </View>
              <View style={[styles.calSummaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.calSummaryItem}>
                <Text style={[styles.calSummaryNum, { color: colors.foreground }]}>
                  {calData.days.length}
                </Text>
                <Text style={[styles.calSummaryLabel, { color: colors.mutedForeground }]}>
                  active days
                </Text>
              </View>
            </View>
          )}

          {/* Day-of-week headers */}
          <View style={styles.calDayHeaders}>
            {DAY_INITIALS.map((d) => (
              <Text
                key={d}
                style={[styles.calDayHeader, { color: colors.mutedForeground }]}
              >
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar grid */}
          {calLoading ? (
            <View style={styles.centeredLoader}>
              <ActivityIndicator color="#16a34a" />
            </View>
          ) : (
            <View style={styles.calGrid}>
              {calGrid.map((row, ri) => (
                <View key={ri} style={styles.calRow}>
                  {row.map((cell, ci) => {
                    if (!cell) {
                      return <View key={ci} style={styles.calCell} />;
                    }
                    const dayData = calDayMap.get(cell.date);
                    const count = dayData?.rideCount ?? 0;
                    const maxCount = calData?.maxRideCount ?? 1;
                    const opacity = heatOpacity(count, maxCount);
                    const isSelected = selectedDate === cell.date;
                    const isToday = cell.date === todayISO();
                    return (
                      <Pressable
                        key={ci}
                        onPress={() =>
                          setSelectedDate(
                            isSelected ? null : cell.date,
                          )
                        }
                        style={({ pressed }) => [
                          styles.calCell,
                          styles.calCellActive,
                          {
                            backgroundColor:
                              opacity > 0
                                ? `rgba(34,197,94,${opacity})`
                                : colors.muted,
                            borderRadius: colors.radius - 2,
                            borderWidth: isSelected ? 2 : isToday ? 1.5 : 0,
                            borderColor: isSelected
                              ? "#16a34a"
                              : isToday
                                ? colors.primary
                                : "transparent",
                            opacity: pressed ? 0.75 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.calDayNum,
                            {
                              color:
                                opacity > 0.55
                                  ? "#fff"
                                  : isToday
                                    ? colors.primary
                                    : colors.foreground,
                              fontFamily:
                                isToday
                                  ? "Inter_700Bold"
                                  : "Inter_400Regular",
                            },
                          ]}
                        >
                          {cell.day}
                        </Text>
                        {count > 0 && (
                          <Text
                            style={[
                              styles.calRideDot,
                              {
                                color:
                                  opacity > 0.55
                                    ? "rgba(255,255,255,0.8)"
                                    : "#16a34a",
                              },
                            ]}
                          >
                            {count}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {/* Selected day detail card */}
          {selectedDate && (() => {
            const d = calDayMap.get(selectedDate);
            return (
              <View
                style={[
                  styles.calDetailCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: "#22c55e55",
                    borderRadius: colors.radius + 2,
                  },
                ]}
              >
                <Feather name="calendar" size={14} color="#16a34a" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.calDetailDate, { color: colors.foreground }]}>
                    {selectedDate}
                  </Text>
                  {d ? (
                    <Text style={[styles.calDetailStats, { color: colors.mutedForeground }]}>
                      {d.rideCount} {d.rideCount === 1 ? "ride" : "rides"} · {d.totalKm} km
                    </Text>
                  ) : (
                    <Text style={[styles.calDetailStats, { color: colors.mutedForeground }]}>
                      No rides recorded
                    </Text>
                  )}
                </View>
                <Pressable onPress={() => setSelectedDate(null)} hitSlop={8}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            );
          })()}

          {/* Heat-map legend */}
          <View style={styles.calLegend}>
            <Text style={[styles.calLegendLabel, { color: colors.mutedForeground }]}>
              Less
            </Text>
            {[0, 0.18, 0.38, 0.62, 0.88, 1.0].map((op, i) => (
              <View
                key={i}
                style={[
                  styles.calLegendBox,
                  {
                    backgroundColor:
                      op === 0
                        ? colors.muted
                        : `rgba(34,197,94,${op})`,
                    borderRadius: 3,
                  },
                ]}
              />
            ))}
            <Text style={[styles.calLegendLabel, { color: colors.mutedForeground }]}>
              More
            </Text>
          </View>
        </View>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1 — LEADERBOARD                                           */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionGroup, { paddingTop: 20 }]}>
          {/* Section title row */}
          <View style={styles.sectionTitleRow}>
            <View
              style={[
                styles.sectionTitleIcon,
                { backgroundColor: "#F59E0B22", borderRadius: 8 },
              ]}
            >
              <Feather name="award" size={15} color="#F59E0B" />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Leaderboard
            </Text>
            {/* Sort toggle */}
            <View
              style={[
                styles.sortToggle,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  borderRadius: colors.radius + 2,
                },
              ]}
            >
              {(["km", "rides"] as const).map((opt) => {
                const active = sortBy === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setSortBy(opt)}
                    style={[
                      styles.sortOption,
                      active && {
                        backgroundColor: colors.card,
                        shadowColor: "#000",
                        shadowOpacity: 0.07,
                        shadowRadius: 3,
                        shadowOffset: { width: 0, height: 1 },
                        elevation: 1,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <Feather
                      name={opt === "km" ? "map" : "repeat"}
                      size={10}
                      color={active ? colors.foreground : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.sortOptionText,
                        {
                          color: active ? colors.foreground : colors.mutedForeground,
                          fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                        },
                      ]}
                    >
                      {opt === "km" ? "km" : "rides"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Period tabs */}
          <View
            style={[
              styles.segmented,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: colors.radius + 2,
              },
            ]}
          >
            {PERIODS.map((p) => {
              const active = period === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => handlePeriodChange(p.key)}
                  style={[
                    styles.segment,
                    active && {
                      backgroundColor: colors.card,
                      shadowColor: "#000",
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 1 },
                      elevation: 2,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: active
                          ? colors.foreground
                          : colors.mutedForeground,
                        fontFamily: active
                          ? "Inter_700Bold"
                          : "Inter_500Medium",
                      },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Search box */}
          {!boardLoading && (board?.length ?? 0) > 0 && (
            <View
              style={[
                styles.boardSearchWrap,
                {
                  backgroundColor: colors.card,
                  borderColor: boardSearch.length > 0 ? colors.primary : colors.border,
                  borderRadius: colors.radius + 2,
                },
              ]}
            >
              <Feather name="search" size={14} color={boardSearch.length > 0 ? colors.primary : colors.mutedForeground} />
              <TextInput
                value={boardSearch}
                onChangeText={setBoardSearch}
                placeholder="Search mobilizer..."
                placeholderTextColor={colors.mutedForeground}
                style={[styles.boardSearchInput, { color: colors.foreground }]}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              {boardSearch.length > 0 && (
                <Pressable onPress={() => setBoardSearch("")} hitSlop={8}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
          )}

          {/* Period label */}
          {sortedBoard?.[0] && (
            <Text
              style={[styles.periodLabel, { color: colors.mutedForeground }]}
            >
              {sortedBoard[0].periodLabel}
            </Text>
          )}

          {/* Board loading */}
          {boardLoading && (
            <View style={styles.centeredLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {/* Board empty — no data for period */}
          {!boardLoading && board?.length === 0 && (
            <View style={styles.boardEmpty}>
              <Feather name="award" size={28} color={colors.mutedForeground} />
              <Text
                style={[styles.boardEmptyText, { color: colors.mutedForeground }]}
              >
                No trips recorded yet for this period
              </Text>
            </View>
          )}

          {/* Board rows — filtered by search, sorted by sortBy */}
          {!boardLoading &&
            sortedBoard
              ?.filter((e) =>
                boardSearch.trim().length === 0
                  ? true
                  : e.staffName
                      .toLowerCase()
                      .includes(boardSearch.trim().toLowerCase()),
              )
              .map((entry) => (
                <LeaderboardRow
                  key={entry.staffId}
                  entry={entry}
                  maxVal={maxVal}
                  sortBy={sortBy}
                  colors={colors}
                  onPress={() =>
                    router.push(`/(admin)/mobilizer/${entry.staffId}`)
                  }
                  onAddNote={() =>
                    router.push(
                      `/(admin)/mobilizer/${entry.staffId}?editNotes=1`,
                    )
                  }
                />
              ))}

          {/* No search results */}
          {!boardLoading &&
            (sortedBoard?.length ?? 0) > 0 &&
            boardSearch.trim().length > 0 &&
            sortedBoard?.filter((e) =>
              e.staffName
                .toLowerCase()
                .includes(boardSearch.trim().toLowerCase()),
            ).length === 0 && (
              <View style={styles.boardEmpty}>
                <Feather
                  name="search"
                  size={24}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.boardEmptyText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  No mobilizer matches "{boardSearch.trim()}"
                </Text>
              </View>
            )}
        </View>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <View
          style={[styles.divider, { backgroundColor: colors.border }]}
        />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2 — CSV EXPORT                                             */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionGroup}>
          {/* Section title */}
          <View style={styles.sectionTitleRow}>
            <View
              style={[
                styles.sectionTitleIcon,
                { backgroundColor: colors.primary + "18", borderRadius: 8 },
              ]}
            >
              <Feather name="download" size={15} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Export Ride Report
            </Text>
          </View>

          {/* Date range presets */}
          <Text
            style={[styles.filterLabel, { color: colors.mutedForeground }]}
          >
            DATE RANGE
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {CSV_PRESETS.map((p) => {
              const active = preset === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => setPreset(p.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.muted,
                      borderColor: active ? colors.primary : colors.border,
                      borderRadius: 999,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? "#fff" : colors.foreground },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {preset === "custom" ? (
            <View style={styles.customDateRow}>
              <DateField
                label="FROM"
                value={customFrom}
                onChange={setCustomFrom}
                colors={colors}
              />
              <View style={styles.dateArrow}>
                <Feather
                  name="arrow-right"
                  size={14}
                  color={colors.mutedForeground}
                />
              </View>
              <DateField
                label="TO"
                value={customTo}
                onChange={setCustomTo}
                colors={colors}
              />
            </View>
          ) : (
            <Text
              style={[styles.dateRangeText, { color: colors.mutedForeground }]}
            >
              {dates.from === dates.to
                ? dates.from
                : `${dates.from} → ${dates.to}`}
            </Text>
          )}

          {/* Staff filter */}
          <Text
            style={[
              styles.filterLabel,
              { color: colors.mutedForeground, marginTop: 16 },
            ]}
          >
            STAFF FILTER
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable
              onPress={() => setSelectedStaffId(null)}
              style={[
                styles.chip,
                {
                  backgroundColor: !selectedStaffId
                    ? colors.primary
                    : colors.muted,
                  borderColor: !selectedStaffId ? colors.primary : colors.border,
                  borderRadius: 999,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: !selectedStaffId ? "#fff" : colors.foreground },
                ]}
              >
                All Staff
              </Text>
            </Pressable>
            {(staffList ?? [])
              .filter((s) => s.role === "staff")
              .map((s) => {
                const active = selectedStaffId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSelectedStaffId(active ? null : s.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                        borderRadius: 999,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? "#fff" : colors.foreground },
                      ]}
                    >
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
          </ScrollView>

          {/* Summary + export button */}
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius + 2,
                marginTop: 14,
              },
            ]}
          >
            <View style={styles.summaryLeft}>
              {tripsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : tripsError ? (
                <Text
                  style={{
                    color: colors.destructive,
                    fontSize: 13,
                    fontFamily: "Inter_500Medium",
                  }}
                >
                  Failed to load
                </Text>
              ) : (
                <>
                  <Text
                    style={[styles.summaryCount, { color: colors.foreground }]}
                  >
                    {trips?.length ?? 0}
                  </Text>
                  <Text
                    style={[
                      styles.summaryCountLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {(trips?.length ?? 0) === 1 ? "trip" : "trips"} ·{" "}
                    {totalKm.toFixed(1)} km
                  </Text>
                </>
              )}
            </View>

            <Pressable
              onPress={onExport}
              disabled={!trips?.length || exporting}
              style={({ pressed }) => [
                styles.exportBtn,
                {
                  backgroundColor: !trips?.length
                    ? colors.muted
                    : colors.primary,
                  borderRadius: colors.radius,
                  opacity:
                    pressed || exporting ? 0.8 : !trips?.length ? 0.5 : 1,
                },
              ]}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather
                  name="download"
                  size={15}
                  color={!trips?.length ? colors.mutedForeground : "#fff"}
                />
              )}
              <Text
                style={[
                  styles.exportBtnText,
                  {
                    color: !trips?.length ? colors.mutedForeground : "#fff",
                  },
                ]}
              >
                Export CSV
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Trip table ─────────────────────────────────────────────────────── */}
        {!tripsLoading && !tripsError && (trips?.length ?? 0) > 0 && (
          <View style={{ marginTop: 12 }}>
            <View
              style={[
                styles.tableHeader,
                {
                  backgroundColor: colors.muted,
                  borderTopColor: colors.border,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.thCell,
                  styles.thName,
                  { color: colors.mutedForeground },
                ]}
              >
                STAFF
              </Text>
              <Text
                style={[
                  styles.thCell,
                  styles.thDate,
                  { color: colors.mutedForeground },
                ]}
              >
                DATE
              </Text>
              <Text
                style={[
                  styles.thCell,
                  styles.thTime,
                  { color: colors.mutedForeground },
                ]}
              >
                START
              </Text>
              <Text
                style={[
                  styles.thCell,
                  styles.thTime,
                  { color: colors.mutedForeground },
                ]}
              >
                END
              </Text>
              <Text
                style={[
                  styles.thCell,
                  styles.thKm,
                  { color: colors.mutedForeground },
                ]}
              >
                KM
              </Text>
            </View>
            <FlatList
              data={trips}
              keyExtractor={(item) => item.tripRef}
              renderItem={renderTrip}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Empty state */}
        {!tripsLoading && !tripsError && trips?.length === 0 && (
          <EmptyState
            icon="inbox"
            title="No trips found"
            sub="Try a different date range or staff filter."
            onRetry={() => refetch()}
            colors={colors}
          />
        )}

        {/* Error state */}
        {tripsError && (
          <EmptyState
            icon="alert-circle"
            title="Could not load trips"
            onRetry={() => refetch()}
            colors={colors}
            isError
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3 — EXCEL EXPORT                                          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionGroup, { marginTop: 20 }]}>
          {/* Section title */}
          <View style={styles.sectionTitleRow}>
            <View
              style={[
                styles.sectionTitleIcon,
                { backgroundColor: "#16A34A18", borderRadius: 8 },
              ]}
            >
              <Feather name="file-text" size={15} color="#16A34A" />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Export Excel Report
            </Text>
          </View>

          {/* Report Type */}
          <Text
            style={[styles.filterLabel, { color: colors.mutedForeground }]}
          >
            REPORT TYPE
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {(["daily", "weekly", "monthly"] as const).map((rt) => {
              const active = xlReportType === rt;
              return (
                <Pressable
                  key={rt}
                  onPress={() => setXlReportType(rt)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? "#16A34A" : colors.muted,
                      borderColor: active ? "#16A34A" : colors.border,
                      borderRadius: 999,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? "#fff" : colors.foreground },
                    ]}
                  >
                    {rt.charAt(0).toUpperCase() + rt.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Date range presets */}
          <Text
            style={[
              styles.filterLabel,
              { color: colors.mutedForeground, marginTop: 14 },
            ]}
          >
            DATE RANGE
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {CSV_PRESETS.map((p) => {
              const active = xlPreset === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => setXlPreset(p.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? "#16A34A" : colors.muted,
                      borderColor: active ? "#16A34A" : colors.border,
                      borderRadius: 999,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? "#fff" : colors.foreground },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {xlPreset === "custom" ? (
            <View style={styles.customDateRow}>
              <DateField
                label="FROM"
                value={xlCustomFrom}
                onChange={setXlCustomFrom}
                colors={colors}
              />
              <View style={styles.dateArrow}>
                <Feather
                  name="arrow-right"
                  size={14}
                  color={colors.mutedForeground}
                />
              </View>
              <DateField
                label="TO"
                value={xlCustomTo}
                onChange={setXlCustomTo}
                colors={colors}
              />
            </View>
          ) : (
            <Text
              style={[styles.dateRangeText, { color: colors.mutedForeground }]}
            >
              {xlDates.from === xlDates.to
                ? xlDates.from
                : `${xlDates.from} → ${xlDates.to}`}
            </Text>
          )}

          {/* Staff filter */}
          <Text
            style={[
              styles.filterLabel,
              { color: colors.mutedForeground, marginTop: 16 },
            ]}
          >
            STAFF FILTER
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable
              onPress={() => setXlStaffId(null)}
              style={[
                styles.chip,
                {
                  backgroundColor: !xlStaffId ? "#16A34A" : colors.muted,
                  borderColor: !xlStaffId ? "#16A34A" : colors.border,
                  borderRadius: 999,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: !xlStaffId ? "#fff" : colors.foreground },
                ]}
              >
                All Staff
              </Text>
            </Pressable>
            {(staffList ?? [])
              .filter((s) => s.role === "staff")
              .map((s) => {
                const active = xlStaffId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setXlStaffId(active ? null : s.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? "#16A34A" : colors.muted,
                        borderColor: active ? "#16A34A" : colors.border,
                        borderRadius: 999,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? "#fff" : colors.foreground },
                      ]}
                    >
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
          </ScrollView>

          {/* Download button */}
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius + 2,
                marginTop: 14,
              },
            ]}
          >
            <View style={styles.summaryLeft}>
              <Text
                style={[styles.summaryCount, { color: colors.foreground }]}
              >
                .xlsx
              </Text>
              <Text
                style={[
                  styles.summaryCountLabel,
                  { color: colors.mutedForeground },
                ]}
              >
                {xlReportType} · {xlDates.from === xlDates.to ? xlDates.from : `${xlDates.from} → ${xlDates.to}`}
              </Text>
            </View>

            <Pressable
              onPress={onExportXlsx}
              disabled={xlDownloading}
              style={({ pressed }) => [
                styles.exportBtn,
                {
                  backgroundColor: "#16A34A",
                  borderRadius: colors.radius,
                  opacity: pressed || xlDownloading ? 0.75 : 1,
                },
              ]}
            >
              {xlDownloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="download" size={15} color="#fff" />
              )}
              <Text style={[styles.exportBtnText, { color: "#fff" }]}>
                {xlDownloading ? "Generating…" : "Download Excel"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  maxVal,
  sortBy,
  colors,
  onPress,
  onAddNote,
}: {
  entry: LeaderboardEntry;
  maxVal: number;
  sortBy: "km" | "rides";
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onPress?: () => void;
  onAddNote?: () => void;
}) {
  const activeVal = sortBy === "km" ? entry.totalKm : entry.tripCount;
  const barPct = maxVal > 0 ? activeVal / maxVal : 0;
  const isTop3 = entry.rank <= 3;
  const medalColor = isTop3
    ? MEDAL_COLORS[entry.rank - 1]
    : colors.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.boardRow,
        {
          backgroundColor: colors.card,
          borderColor: entry.rank === 1 ? "#F59E0B33" : colors.border,
          borderRadius: colors.radius + 2,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      {/* Rank badge */}
      <View
        style={[
          styles.rankBadge,
          {
            backgroundColor: isTop3 ? medalColor + "22" : colors.muted,
            borderRadius: 999,
          },
        ]}
      >
        <Text
          style={[
            styles.rankText,
            { color: isTop3 ? medalColor : colors.mutedForeground },
          ]}
        >
          {entry.rank}
        </Text>
      </View>

      {/* Name + code + bar */}
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.boardNameRow}>
          <Text
            style={[styles.boardName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {entry.staffName}
          </Text>
          <Text style={[styles.boardCode, { color: colors.mutedForeground }]}>
            {entry.empCode}
          </Text>
          {entry.hasNotes && (
            <View
              style={[
                styles.notesBadge,
                { backgroundColor: "#0ea5e920", borderColor: "#0ea5e940" },
              ]}
            >
              <Feather name="file-text" size={9} color="#0ea5e9" />
              <Text style={[styles.notesBadgeText, { color: "#0ea5e9" }]}>
                Notes
              </Text>
            </View>
          )}
        </View>

        {/* Distance bar */}
        <View
          style={[styles.barTrack, { backgroundColor: colors.muted }]}
        >
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.round(barPct * 100)}%`,
                backgroundColor: isTop3 ? medalColor : colors.primary,
                borderRadius: 999,
              },
            ]}
          />
        </View>
      </View>

      {/* Stats — active sort metric is emphasised */}
      <View style={styles.boardStats}>
        <Text
          style={[
            styles.boardKm,
            {
              color: sortBy === "km" ? colors.foreground : colors.mutedForeground,
              fontFamily: sortBy === "km" ? "Inter_700Bold" : "Inter_500Medium",
            },
          ]}
        >
          {entry.totalKm} km
        </Text>
        <Text
          style={[
            styles.boardTrips,
            {
              color: sortBy === "rides" ? colors.foreground : colors.mutedForeground,
              fontFamily: sortBy === "rides" ? "Inter_700Bold" : "Inter_400Regular",
            },
          ]}
        >
          {entry.tripCount} {entry.tripCount === 1 ? "trip" : "trips"}
        </Text>
      </View>
      {/* "+ Note" shortcut or chevron */}
      {!entry.hasNotes && onAddNote ? (
        <Pressable
          onPress={onAddNote}
          style={[
            styles.addNoteBtn,
            {
              backgroundColor: "#f0fdf4",
              borderColor: "#bbf7d0",
              borderRadius: 999,
            },
          ]}
          hitSlop={6}
        >
          <Feather name="plus" size={10} color="#16a34a" />
          <Text style={[styles.addNoteBtnText, { color: "#16a34a" }]}>
            Note
          </Text>
        </Pressable>
      ) : (
        <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

// ─── Trip row ─────────────────────────────────────────────────────────────────

function TripRow({
  item,
  index,
  colors,
  onPress,
}: {
  item: TripReportRow;
  index: number;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tableRow,
        {
          backgroundColor:
            index % 2 === 0 ? colors.background : colors.muted + "66",
          borderBottomColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.thName}>
        <Text
          style={[styles.tdName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {item.staffName}
        </Text>
        <Text style={[styles.tdPhone, { color: colors.mutedForeground }]}>
          {item.staffPhone}
        </Text>
      </View>
      <Text style={[styles.tdCell, styles.thDate, { color: colors.foreground }]}>
        {item.rideDate}
      </Text>
      <Text style={[styles.tdCell, styles.thTime, { color: colors.foreground }]}>
        {formatLocalTime(item.startTime)}
      </Text>
      <Text style={[styles.tdCell, styles.thTime, { color: colors.foreground }]}>
        {formatLocalTime(item.endTime)}
      </Text>
      <Text
        style={[
          styles.tdCell,
          styles.thKm,
          {
            color:
              (item.distanceKm ?? 0) > 0
                ? colors.pillarAccuracy
                : colors.mutedForeground,
            fontFamily: "Inter_600SemiBold",
          },
        ]}
      >
        {item.distanceKm != null ? `${item.distanceKm}` : "—"}
      </Text>
      <Feather name="chevron-right" size={12} color={colors.mutedForeground} style={{ marginLeft: 2 }} />
    </Pressable>
  );
}

// ─── Date field ───────────────────────────────────────────────────────────────

function DateField({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={[
          styles.filterLabel,
          { color: colors.mutedForeground, marginBottom: 6 },
        ]}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        style={[
          styles.dateInput,
          {
            color: colors.foreground,
            borderColor: valid ? colors.border : colors.destructive,
            borderRadius: colors.radius,
            backgroundColor: colors.background,
            fontFamily: "Inter_500Medium",
          },
        ]}
      />
    </View>
  );
}

// ─── Empty / error state ──────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  sub,
  onRetry,
  colors,
  isError = false,
}: {
  icon: string;
  title: string;
  sub?: string;
  onRetry: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  isError?: boolean;
}) {
  return (
    <View style={styles.emptyWrap}>
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: isError
              ? colors.destructive + "18"
              : colors.muted,
            borderRadius: 999,
          },
        ]}
      >
        <Feather
          name={icon as any}
          size={26}
          color={isError ? colors.destructive : colors.mutedForeground}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {sub && (
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
          {sub}
        </Text>
      )}
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          styles.retryBtn,
          {
            backgroundColor: colors.muted,
            borderColor: colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Feather name="refresh-cw" size={14} color={colors.foreground} />
        <Text style={[styles.retryText, { color: colors.foreground }]}>
          {isError ? "Retry" : "Refresh"}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
  },
  sectionGroup: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionTitleIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  // Leaderboard
  segmented: {
    flexDirection: "row",
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  segmentText: {
    fontSize: 13,
  },
  periodLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  centeredLoader: {
    paddingVertical: 32,
    alignItems: "center",
  },
  boardEmpty: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  boardEmptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  boardSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  boardSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  boardRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    gap: 12,
  },
  rankBadge: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  boardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  boardName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  boardCode: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  notesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  notesBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  addNoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
  },
  addNoteBtnText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  // Sort toggle
  sortToggle: {
    flexDirection: "row",
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sortOptionText: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  barTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: {
    height: 5,
    minWidth: 4,
  },
  boardStats: {
    alignItems: "flex-end",
    minWidth: 62,
  },
  boardKm: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  boardTrips: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  // CSV section
  filterLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  customDateRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  dateArrow: {
    paddingBottom: 14,
  },
  dateInput: {
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateRangeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 8,
  },
  summaryCard: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryLeft: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  summaryCount: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  summaryCountLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  exportBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thCell: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },
  thName: { flex: 2, paddingRight: 6 },
  thDate: { flex: 1.5, paddingRight: 4 },
  thTime: { flex: 1.2, paddingRight: 4 },
  thKm: { width: 44, textAlign: "right" },
  tdCell: { fontSize: 13, fontFamily: "Inter_400Regular" },
  tdName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tdPhone: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  // Empty/error
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  // ── Calendar ────────────────────────────────────────────────────────────────
  calNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  calMonthLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  calSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  calSummaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  calSummaryNum: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  calSummaryLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  calSummaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    marginHorizontal: 4,
  },
  calDayHeaders: {
    flexDirection: "row",
    marginBottom: 6,
  },
  calDayHeader: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  calGrid: {
    gap: 4,
  },
  calRow: {
    flexDirection: "row",
    gap: 4,
  },
  calCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calCellActive: {
    gap: 1,
  },
  calDayNum: {
    fontSize: 13,
    lineHeight: 16,
  },
  calRideDot: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    lineHeight: 11,
  },
  calDetailCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
  },
  calDetailDate: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  calDetailStats: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  calLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 12,
  },
  calLegendLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  calLegendBox: {
    width: 14,
    height: 14,
  },
});
