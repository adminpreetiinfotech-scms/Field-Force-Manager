import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
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

import {
  getGetStaffProfileStatsQueryKey,
  useGetStaffProfileStats,
  type MonthStat,
  type RecentTrip,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function fmtTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MobilizerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 0 : 0;

  const { data, isLoading, isError, refetch } = useGetStaffProfileStats(
    id ?? "",
    {
      query: {
        queryKey: getGetStaffProfileStatsQueryKey(id ?? ""),
        enabled: !!id,
        staleTime: 60_000,
      },
    },
  );

  if (isLoading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top + 80 },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={[
            styles.loadingText,
            { color: colors.mutedForeground, marginTop: 14 },
          ]}
        >
          Loading profile…
        </Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top + 80 },
        ]}
      >
        <Feather name="alert-circle" size={36} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          Could not load profile
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={[
            styles.retryBtn,
            { backgroundColor: colors.muted, borderRadius: colors.radius },
          ]}
        >
          <Text style={[styles.retryText, { color: colors.foreground }]}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  const maxMonthlyKm = Math.max(...data.monthly.map((m) => m.km), 1);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 12 + webTop,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            {
              backgroundColor: colors.muted,
              borderRadius: colors.radius,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text
          style={[styles.topBarTitle, { color: colors.foreground }]}
          numberOfLines={1}
        >
          Mobilizer Profile
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Identity card ───────────────────────────────────────────── */}
        <View
          style={[
            styles.identityCard,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          {/* Avatar */}
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primary + "22" },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {initials(data.name)}
            </Text>
          </View>

          <Text style={[styles.staffName, { color: colors.foreground }]}>
            {data.name}
          </Text>
          <Text style={[styles.empCode, { color: colors.mutedForeground }]}>
            {data.empCode}  ·  {data.phone}
          </Text>

          {/* Chips row */}
          <View style={styles.chipsRow}>
            <InfoChip
              icon="briefcase"
              label={data.role === "admin" ? "Admin" : "Field Staff"}
              color={colors.primary}
              bgColor={colors.primary + "18"}
              colors={colors}
            />
            {data.organization && (
              <InfoChip
                icon="home"
                label={data.organization}
                color={colors.foreground}
                bgColor={colors.muted}
                colors={colors}
              />
            )}
            {data.area && (
              <InfoChip
                icon="map-pin"
                label={data.area}
                color={colors.foreground}
                bgColor={colors.muted}
                colors={colors}
              />
            )}
          </View>

          {data.firstRideDate && (
            <Text
              style={[styles.memberSince, { color: colors.mutedForeground }]}
            >
              First ride: {fmtDate(data.firstRideDate)}
            </Text>
          )}
        </View>

        {/* ── Lifetime stats grid ─────────────────────────────────────── */}
        <View style={[styles.section, { paddingTop: 20 }]}>
          <SectionHeader
            icon="activity"
            title="Lifetime Stats"
            colors={colors}
          />
          <View style={styles.statsGrid}>
            <StatTile
              label="Total Rides"
              value={String(data.lifetimeTotalRides)}
              sub="all time"
              accent={colors.primary}
              colors={colors}
            />
            <StatTile
              label="Total km"
              value={`${data.lifetimeTotalKm}`}
              sub="all time"
              accent="#16a34a"
              colors={colors}
            />
            <StatTile
              label="Avg km/ride"
              value={`${data.lifetimeAvgKmPerRide}`}
              sub="lifetime avg"
              accent="#8B5CF6"
              colors={colors}
            />
            <StatTile
              label="Active Days"
              value={String(data.lifetimeActiveDays)}
              sub="with rides"
              accent="#F59E0B"
              colors={colors}
            />
          </View>
        </View>

        {/* ── Period breakdown ────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            icon="calendar"
            title="Period Breakdown"
            colors={colors}
          />
          <View style={styles.periodRow}>
            <PeriodCard
              label="Today"
              rides={data.periodToday.rides}
              km={data.periodToday.km}
              colors={colors}
            />
            <PeriodCard
              label="7 Days"
              rides={data.periodLast7Days.rides}
              km={data.periodLast7Days.km}
              colors={colors}
            />
            <PeriodCard
              label="30 Days"
              rides={data.periodLast30Days.rides}
              km={data.periodLast30Days.km}
              colors={colors}
            />
            <PeriodCard
              label="This Month"
              rides={data.periodThisMonth.rides}
              km={data.periodThisMonth.km}
              colors={colors}
            />
          </View>
        </View>

        {/* ── Best day ────────────────────────────────────────────────── */}
        {data.bestDay && (
          <View style={styles.section}>
            <SectionHeader icon="star" title="Best Day" colors={colors} />
            <View
              style={[
                styles.bestDayCard,
                {
                  backgroundColor: "#F59E0B11",
                  borderColor: "#F59E0B44",
                  borderRadius: colors.radius + 2,
                },
              ]}
            >
              <Feather name="star" size={20} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.bestDayDate, { color: colors.foreground }]}
                >
                  {fmtDate(data.bestDay.date)}
                </Text>
                <Text
                  style={[
                    styles.bestDaySub,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {data.bestDay.rideCount}{" "}
                  {data.bestDay.rideCount === 1 ? "ride" : "rides"} ·{" "}
                  {data.bestDay.totalKm} km
                </Text>
              </View>
              <Text style={[styles.bestDayKm, { color: "#F59E0B" }]}>
                {data.bestDay.totalKm} km
              </Text>
            </View>
          </View>
        )}

        {/* ── Monthly bar chart ───────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            icon="bar-chart-2"
            title="Monthly History"
            colors={colors}
          />
          <MonthlyBars
            data={data.monthly}
            maxKm={maxMonthlyKm}
            colors={colors}
          />
        </View>

        {/* ── Recent trips ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            icon="navigation"
            title="Recent Trips"
            sub="Last 10"
            colors={colors}
          />
          {data.recentTrips.length === 0 ? (
            <View style={styles.emptyTrips}>
              <Feather
                name="navigation"
                size={22}
                color={colors.mutedForeground}
              />
              <Text
                style={[
                  styles.emptyTripsText,
                  { color: colors.mutedForeground },
                ]}
              >
                No trips recorded yet
              </Text>
            </View>
          ) : (
            data.recentTrips.map((trip, i) => (
              <RecentTripRow
                key={trip.tripRef}
                trip={trip}
                index={i}
                colors={colors}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  sub,
  colors,
}: {
  icon: string;
  title: string;
  sub?: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Feather name={icon as any} size={15} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {sub && (
        <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
          {sub}
        </Text>
      )}
    </View>
  );
}

function InfoChip({
  icon,
  label,
  color,
  bgColor,
  colors,
}: {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: bgColor, borderRadius: 999 },
      ]}
    >
      <Feather name={icon as any} size={11} color={color} />
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent,
  colors,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View
      style={[
        styles.statTile,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius + 2,
        },
      ]}
    >
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.foreground }]}>
        {label}
      </Text>
      <Text style={[styles.statSub, { color: colors.mutedForeground }]}>
        {sub}
      </Text>
    </View>
  );
}

function PeriodCard({
  label,
  rides,
  km,
  colors,
}: {
  label: string;
  rides: number;
  km: number;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View
      style={[
        styles.periodCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius + 2,
        },
      ]}
    >
      <Text style={[styles.periodLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.periodRides, { color: colors.primary }]}>
        {rides}
      </Text>
      <Text style={[styles.periodRidesLabel, { color: colors.mutedForeground }]}>
        rides
      </Text>
      <Text style={[styles.periodKm, { color: colors.foreground }]}>
        {km} km
      </Text>
    </View>
  );
}

function MonthlyBars({
  data,
  maxKm,
  colors,
}: {
  data: MonthStat[];
  maxKm: number;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View
      style={[
        styles.barChart,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius + 2,
        },
      ]}
    >
      {data.map((m) => {
        const pct = maxKm > 0 ? m.km / maxKm : 0;
        return (
          <View key={m.label} style={styles.barCol}>
            <Text style={[styles.barKmLabel, { color: colors.mutedForeground }]}>
              {m.km > 0 ? `${m.km}` : ""}
            </Text>
            <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    height: `${Math.max(pct * 100, m.km > 0 ? 4 : 0)}%`,
                    backgroundColor:
                      pct > 0.7
                        ? "#16a34a"
                        : pct > 0.35
                          ? "#4ade80"
                          : "#86efac",
                    borderRadius: 3,
                  },
                ]}
              />
            </View>
            <Text style={[styles.barMonthLabel, { color: colors.mutedForeground }]}>
              {m.label.slice(0, 3)}
            </Text>
            <Text style={[styles.barRidesLabel, { color: colors.mutedForeground }]}>
              {m.rides > 0 ? `${m.rides}` : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function RecentTripRow({
  trip,
  index,
  colors,
}: {
  trip: RecentTrip;
  index: number;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View
      style={[
        styles.tripRow,
        {
          backgroundColor: index % 2 === 0 ? colors.card : colors.muted + "55",
          borderColor: colors.border,
          borderRadius: index === 0 ? colors.radius : 0,
        },
      ]}
    >
      <View
        style={[
          styles.tripIndex,
          { backgroundColor: colors.muted, borderRadius: 999 },
        ]}
      >
        <Text style={[styles.tripIndexText, { color: colors.mutedForeground }]}>
          {index + 1}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tripDate, { color: colors.foreground }]}>
          {fmtDate(trip.rideDate)}
        </Text>
        <Text style={[styles.tripTimes, { color: colors.mutedForeground }]}>
          {fmtTime(trip.startTime)} → {fmtTime(trip.endTime)}
        </Text>
      </View>
      {trip.distanceKm != null && (
        <Text style={[styles.tripKm, { color: "#16a34a" }]}>
          {trip.distanceKm} km
        </Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  // Identity card
  identityCard: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  staffName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  empCode: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  memberSince: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  // Section
  section: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statTile: {
    width: "47%",
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-start",
    gap: 2,
  },
  statValue: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  statSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  // Period breakdown
  periodRow: {
    flexDirection: "row",
    gap: 8,
  },
  periodCard: {
    flex: 1,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 2,
  },
  periodLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  periodRides: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  periodRidesLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  periodKm: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  // Best day
  bestDayCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  bestDayDate: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  bestDaySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  bestDayKm: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  // Monthly bars
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    height: 160,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    gap: 4,
  },
  barKmLabel: {
    fontSize: 8,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    height: 12,
    lineHeight: 12,
  },
  barTrack: {
    flex: 1,
    width: "80%",
    justifyContent: "flex-end",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
  },
  barMonthLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  barRidesLabel: {
    fontSize: 8,
    fontFamily: "Inter_400Regular",
  },
  // Recent trips
  emptyTrips: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  emptyTripsText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  tripIndex: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  tripIndexText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  tripDate: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  tripTimes: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  tripKm: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
});
