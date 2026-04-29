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
  getGetTripReportQueryKey,
  useGetTripReport,
  useListStaff,
  type TripReportRow,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

// ─── Date helpers ────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}
function formatLocalTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── CSV builder ─────────────────────────────────────────────────────────────

function escCsv(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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

// ─── Platform export ─────────────────────────────────────────────────────────

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

// ─── Screen ──────────────────────────────────────────────────────────────────

type Preset = "today" | "7d" | "30d" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

function presetDates(p: Preset): { from: string; to: string } {
  const today = todayISO();
  if (p === "today") return { from: today, to: today };
  if (p === "7d") return { from: daysAgoISO(6), to: today };
  if (p === "30d") return { from: daysAgoISO(29), to: today };
  return { from: today, to: today };
}

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;

  // ── Filters ────────────────────────────────────────────────────────────────
  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState(daysAgoISO(29));
  const [customTo, setCustomTo] = useState(todayISO());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const dates = preset === "custom" ? { from: customFrom, to: customTo } : presetDates(preset);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const datesValid = DATE_RE.test(dates.from) && DATE_RE.test(dates.to) && dates.from <= dates.to;

  // ── Staff list (for filter chips) ─────────────────────────────────────────
  const { data: staffList } = useListStaff();

  // ── Trip data ─────────────────────────────────────────────────────────────
  const queryParams = {
    from: dates.from,
    to: dates.to,
    ...(selectedStaffId ? { staffId: selectedStaffId } : {}),
  };

  const {
    data: trips,
    isLoading,
    isError,
    refetch,
  } = useGetTripReport(queryParams, {
    query: {
      queryKey: getGetTripReportQueryKey(queryParams),
      enabled: datesValid,
      staleTime: 30_000,
    },
  });

  // ── Export handler ─────────────────────────────────────────────────────────
  const onExport = useCallback(async () => {
    if (!trips || trips.length === 0) return;
    setExporting(true);
    try {
      const csv = buildCsv(trips);
      const filename = `ride-report-${dates.from}-to-${dates.to}.csv`;
      await exportCsv(csv, filename);
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Could not export CSV.");
    } finally {
      setExporting(false);
    }
  }, [trips, dates]);

  const totalKm = trips?.reduce((s, r) => s + (r.distanceKm ?? 0), 0) ?? 0;

  // ── Render row ─────────────────────────────────────────────────────────────
  const renderTrip = useCallback(
    ({ item, index }: { item: TripReportRow; index: number }) => (
      <TripRow item={item} index={index} colors={colors} />
    ),
    [colors],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
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
          Ride Reports
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Export ride data as CSV
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Date range presets ─────────────────────────────────────────── */}
        <View style={[styles.section, { paddingTop: 16 }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            DATE RANGE
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {PRESETS.map((p) => {
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

          {/* Custom date inputs */}
          {preset === "custom" && (
            <View style={styles.customDateRow}>
              <DateField
                label="FROM"
                value={customFrom}
                onChange={setCustomFrom}
                colors={colors}
              />
              <View style={styles.dateArrow}>
                <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
              </View>
              <DateField
                label="TO"
                value={customTo}
                onChange={setCustomTo}
                colors={colors}
              />
            </View>
          )}

          {preset !== "custom" && (
            <Text style={[styles.dateRange, { color: colors.mutedForeground }]}>
              {dates.from === dates.to ? dates.from : `${dates.from} → ${dates.to}`}
            </Text>
          )}
        </View>

        {/* ── Staff filter ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
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
                  backgroundColor: !selectedStaffId ? colors.primary : colors.muted,
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
        </View>

        {/* ── Summary + Export ────────────────────────────────────────────── */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              marginHorizontal: 16,
              borderRadius: colors.radius + 2,
            },
          ]}
        >
          <View style={styles.summaryLeft}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : isError ? (
              <Text style={{ color: colors.destructive, fontSize: 13, fontFamily: "Inter_500Medium" }}>
                Failed to load
              </Text>
            ) : (
              <>
                <Text style={[styles.summaryCount, { color: colors.foreground }]}>
                  {trips?.length ?? 0}
                </Text>
                <Text style={[styles.summaryCountLabel, { color: colors.mutedForeground }]}>
                  {(trips?.length ?? 0) === 1 ? "trip" : "trips"} ·{" "}
                  {totalKm.toFixed(1)} km total
                </Text>
              </>
            )}
          </View>

          <Pressable
            onPress={onExport}
            disabled={!trips || trips.length === 0 || exporting}
            style={({ pressed }) => [
              styles.exportBtn,
              {
                backgroundColor:
                  !trips || trips.length === 0
                    ? colors.muted
                    : colors.primary,
                borderRadius: colors.radius,
                opacity:
                  pressed || exporting
                    ? 0.8
                    : !trips || trips.length === 0
                    ? 0.5
                    : 1,
              },
            ]}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather
                name="download"
                size={15}
                color={!trips || trips.length === 0 ? colors.mutedForeground : "#fff"}
              />
            )}
            <Text
              style={[
                styles.exportBtnText,
                {
                  color:
                    !trips || trips.length === 0 ? colors.mutedForeground : "#fff",
                },
              ]}
            >
              Export CSV
            </Text>
          </Pressable>
        </View>

        {/* ── Trip table ──────────────────────────────────────────────────── */}
        {!isLoading && !isError && trips && trips.length > 0 && (
          <View style={{ marginTop: 16 }}>
            {/* Column headers */}
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
              <Text style={[styles.thCell, styles.thName, { color: colors.mutedForeground }]}>
                STAFF
              </Text>
              <Text style={[styles.thCell, styles.thDate, { color: colors.mutedForeground }]}>
                DATE
              </Text>
              <Text style={[styles.thCell, styles.thTime, { color: colors.mutedForeground }]}>
                START
              </Text>
              <Text style={[styles.thCell, styles.thTime, { color: colors.mutedForeground }]}>
                END
              </Text>
              <Text style={[styles.thCell, styles.thKm, { color: colors.mutedForeground }]}>
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
        {!isLoading && !isError && trips?.length === 0 && (
          <View style={styles.emptyWrap}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: colors.muted, borderRadius: 999 },
              ]}
            >
              <Feather name="inbox" size={26} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No trips found
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Try a different date range or staff filter.
            </Text>
            <Pressable
              onPress={() => refetch()}
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
                Refresh
              </Text>
            </Pressable>
          </View>
        )}

        {/* Error state */}
        {isError && (
          <View style={styles.emptyWrap}>
            <Feather name="alert-circle" size={28} color={colors.destructive} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 12 }]}>
              Could not load trips
            </Text>
            <Pressable
              onPress={() => refetch()}
              style={({ pressed }) => [
                styles.retryBtn,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.8 : 1,
                  marginTop: 14,
                },
              ]}
            >
              <Feather name="refresh-cw" size={14} color={colors.foreground} />
              <Text style={[styles.retryText, { color: colors.foreground }]}>
                Retry
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
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
  const bg = index % 2 === 0 ? colors.background : colors.muted + "66";
  return (
    <View
      style={[
        styles.tableRow,
        { backgroundColor: bg, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.thName}>
        <Text style={[styles.tdName, { color: colors.foreground }]} numberOfLines={1}>
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
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>
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
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionLabel: {
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
  dateRange: {
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
    marginBottom: 0,
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
  tdCell: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  tdName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  tdPhone: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
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
  retryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
