import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
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
  getGetTripReportQueryKey,
  useGetLeaderboard,
  useGetTripReport,
  useListStaff,
  type LeaderboardEntry,
  type TripReportRow,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}
function formatLocalTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escCsv(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function buildCsv(rows: TripReportRow[]): string {
  const header = [
    "Staff Name",
    "Mobile Number",
    "Ride Date",
    "Start Time",
    "End Time",
    "Start Location",
    "End Location",
    "Distance (km)",
  ].join(",");
  const lines = rows.map((r) =>
    [
      escCsv(r.staffName),
      escCsv(r.staffPhone),
      escCsv(r.rideDate),
      escCsv(formatLocalTime(r.startTime)),
      escCsv(formatLocalTime(r.endTime)),
      escCsv(r.startLocation),
      escCsv(r.endLocation),
      escCsv(r.distanceKm ?? ""),
    ].join(","),
  );
  return [header, ...lines].join("\r\n");
}

async function exportCsv(csv: string, filename: string) {
  if (Platform.OS === "web") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    const path = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(path, {
        mimeType: "text/csv",
        dialogTitle: "Share Ride Report",
      });
    } else {
      Alert.alert("Saved", `Report saved to: ${path}`);
    }
  }
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
  const webTop = Platform.OS === "web" ? 67 : 0;

  // ── Leaderboard state ──────────────────────────────────────────────────────
  const [period, setPeriod] = useState<Period>("weekly");

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
      await exportCsv(
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

  const renderTrip = useCallback(
    ({ item, index }: { item: TripReportRow; index: number }) => (
      <TripRow item={item} index={index} colors={colors} />
    ),
    [colors],
  );

  const maxKm = board?.[0]?.totalKm ?? 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16 + webTop,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Reports
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Leaderboard &amp; CSV export
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
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
              Distance Leaderboard
            </Text>
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
                  onPress={() => setPeriod(p.key)}
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

          {/* Period label */}
          {board?.[0] && (
            <Text
              style={[styles.periodLabel, { color: colors.mutedForeground }]}
            >
              {board[0].periodLabel}
            </Text>
          )}

          {/* Board loading */}
          {boardLoading && (
            <View style={styles.centeredLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {/* Board empty */}
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

          {/* Board rows */}
          {!boardLoading &&
            board?.map((entry) => (
              <LeaderboardRow
                key={entry.staffId}
                entry={entry}
                maxKm={maxKm}
                colors={colors}
              />
            ))}
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
      </ScrollView>
    </View>
  );
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  maxKm,
  colors,
}: {
  entry: LeaderboardEntry;
  maxKm: number;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const barPct = maxKm > 0 ? entry.totalKm / maxKm : 0;
  const isTop3 = entry.rank <= 3;
  const medalColor = isTop3
    ? MEDAL_COLORS[entry.rank - 1]
    : colors.mutedForeground;

  return (
    <View
      style={[
        styles.boardRow,
        {
          backgroundColor: colors.card,
          borderColor: entry.rank === 1 ? "#F59E0B33" : colors.border,
          borderRadius: colors.radius + 2,
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

      {/* Stats */}
      <View style={styles.boardStats}>
        <Text style={[styles.boardKm, { color: colors.foreground }]}>
          {entry.totalKm} km
        </Text>
        <Text style={[styles.boardTrips, { color: colors.mutedForeground }]}>
          {entry.tripCount} {entry.tripCount === 1 ? "trip" : "trips"}
        </Text>
      </View>
    </View>
  );
}

// ─── Trip row ─────────────────────────────────────────────────────────────────

function TripRow({
  item,
  index,
  colors,
}: {
  item: TripReportRow;
  index: number;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View
      style={[
        styles.tableRow,
        {
          backgroundColor:
            index % 2 === 0 ? colors.background : colors.muted + "66",
          borderBottomColor: colors.border,
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
    </View>
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
});
