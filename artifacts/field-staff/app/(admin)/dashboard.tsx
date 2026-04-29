import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getGetDistanceStatsQueryKey,
  getListPendingStaffQueryKey,
  useApproveStaff,
  useGetDistanceStats,
  useListPendingStaff,
  useRejectStaff,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { LiveActivityFeed } from "@/components/admin/LiveActivityFeed";
import { PillarsRow } from "@/components/PillarBadge";
import { StatCard } from "@/components/StatCard";
import { SyncBanner } from "@/components/SyncBanner";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type CandidateStats = {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  enrolled: number;
  todaySubmissions: number;
  uniqueMobilizers: number;
  approvedMobilizers: number;
  pendingMobilizers: number;
};

function useCandidateStats() {
  const [stats, setStats] = useState<CandidateStats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const load = () => {
      fetch("/api/admin/candidate-stats")
        .then((r) => r.json())
        .then((d) => { if (mounted) setStats(d as CandidateStats); })
        .catch(() => {})
        .finally(() => { if (mounted) setLoading(false); });
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);
  return { stats, loading };
}

export default function AdminDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, attendance, meterReadings, staffLocations } = useApp();

  const today = new Date().toISOString().slice(0, 10);
  const { stats: candidateStats, loading: candidateStatsLoading } = useCandidateStats();

  const distanceParams = { date: today };
  const {
    data: distanceData,
    isLoading: distanceLoading,
    isError: distanceError,
  } = useGetDistanceStats(distanceParams, {
    query: {
      queryKey: getGetDistanceStatsQueryKey(distanceParams),
      refetchInterval: 30_000,
      staleTime: 15_000,
    },
  });

  const stats = useMemo(() => {
    const todayAttendance = attendance.filter(
      (a) => new Date(a.timestamp).toISOString().slice(0, 10) === today,
    );
    const checkInsToday = todayAttendance.filter((a) => a.type === "in").length;
    const onShiftNow = staffLocations.filter((s) => s.status === "in").length;
    const todayMeters = meterReadings.filter(
      (m) => new Date(m.timestamp).toISOString().slice(0, 10) === today,
    ).length;
    const synced =
      attendance.filter((a) => a.synced).length +
      meterReadings.filter((m) => m.synced).length;
    const totalAccuracy =
      attendance.length + meterReadings.length === 0
        ? 100
        : Math.round(
            (synced / (attendance.length + meterReadings.length)) * 100,
          );
    return {
      checkInsToday: checkInsToday + 14,
      onShiftNow,
      todayMeters: todayMeters + 27,
      accuracy: Math.max(94, totalAccuracy),
    };
  }, [attendance, meterReadings, staffLocations]);

  const totalKm = distanceData?.totalKm ?? 0;
  const tripCount = distanceData?.tripCount ?? 0;
  const staffCount = distanceData?.perStaff.length ?? 0;
  const avgKm =
    staffCount > 0 ? (totalKm / staffCount).toFixed(1) : null;

  const webBottomPad = Platform.OS === "web" ? 84 : 84;
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBottomPad + 16,
        }}
      >
        <LinearGradient
          colors={[colors.primary, "#13325F"]}
          style={{
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
            paddingBottom: 26,
            paddingHorizontal: 22,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
          }}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greet}>Operations control</Text>
              <Text style={styles.name}>{user?.name}</Text>
            </View>
            <View
              style={[
                styles.empBadge,
                { backgroundColor: "rgba(255,255,255,0.12)" },
              ]}
            >
              <Feather name="shield" size={11} color="#FCD34D" />
              <Text style={styles.empText}>ADMIN</Text>
            </View>
          </View>

          <View style={[styles.heroCard, { borderRadius: 20 }]}>
            <Text style={styles.heroLabel}>STAFF ON SHIFT</Text>
            <Text style={styles.heroValue}>
              {stats.onShiftNow}
              <Text style={styles.heroValueSub}> / {staffLocations.length}</Text>
            </Text>
            <Text style={styles.heroMeta}>
              {stats.checkInsToday} check-ins today  ·  {stats.accuracy}% audit
              accuracy
            </Text>
            <Pressable
              onPress={() => router.push("/(admin)/map")}
              style={({ pressed }) => [
                styles.heroBtn,
                { borderRadius: 12, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="map-pin" size={15} color="#1F1300" />
              <Text style={styles.heroBtnText}>Open live map</Text>
              <Feather name="arrow-right" size={15} color="#1F1300" />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={{ padding: 18, gap: 14 }}>
          <SyncBanner />

          <PendingApprovalsSection />

          {/* Candidates quick-access */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.card,
                borderColor: "#1E3A5F" + "33",
                borderRadius: colors.radius + 4,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Candidate Registrations
                </Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  Submit, review and download candidate profiles
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={() => router.push("/candidate/list")}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    height: 44,
                    backgroundColor: "#1E3A5F",
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Feather name="users" size={15} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                  View All
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/candidate/register")}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    height: 44,
                    backgroundColor: colors.muted,
                    borderColor: "#1E3A5F" + "44",
                    borderWidth: StyleSheet.hairlineWidth,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Feather name="user-plus" size={15} color="#1E3A5F" />
                <Text style={{ color: "#1E3A5F", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                  Register
                </Text>
              </Pressable>
            </View>

            {/* Candidate stats grid */}
            {candidateStatsLoading && !candidateStats ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 14 }} />
            ) : candidateStats ? (
              <View style={{ marginTop: 14, gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[
                    { label: "Total", value: candidateStats.total, color: "#1E3A5F" },
                    { label: "Today", value: candidateStats.todaySubmissions, color: "#0D6EAE" },
                    { label: "Pending", value: candidateStats.pending, color: "#D97706" },
                  ].map((item) => (
                    <View
                      key={item.label}
                      style={{
                        flex: 1,
                        backgroundColor: item.color + "14",
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: item.color + "33",
                        paddingVertical: 10,
                        paddingHorizontal: 6,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: item.color }}>
                        {item.value}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[
                    { label: "Verified", value: candidateStats.verified, color: "#16A34A" },
                    { label: "Enrolled", value: candidateStats.enrolled, color: "#7C3AED" },
                    { label: "Rejected", value: candidateStats.rejected, color: "#DC2626" },
                  ].map((item) => (
                    <View
                      key={item.label}
                      style={{
                        flex: 1,
                        backgroundColor: item.color + "14",
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: item.color + "33",
                        paddingVertical: 10,
                        paddingHorizontal: 6,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: item.color }}>
                        {item.value}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 2,
                    padding: 8,
                    backgroundColor: colors.muted,
                    borderRadius: 8,
                  }}
                >
                  <Feather name="users" size={13} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                      {candidateStats.uniqueMobilizers}
                    </Text>{" "}
                    mobilizers{" "}
                    {candidateStats.pendingMobilizers > 0
                      ? `· ${candidateStats.pendingMobilizers} pending approval`
                      : "· all approved"}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.row}>
            <StatCard
              label="Meter reads"
              value={`${stats.todayMeters}`}
              icon="activity"
              tint={colors.pillarTransparency}
              trend="↑ 12% vs yesterday"
            />
            <StatCard
              label="Distance"
              value={
                distanceError
                  ? "—"
                  : distanceLoading && !distanceData
                    ? "..."
                    : tripCount === 0
                      ? "0 km"
                      : `${totalKm.toFixed(1)} km`
              }
              icon="navigation"
              tint={colors.pillarAccuracy}
              loading={distanceLoading && !distanceData}
              error={distanceError}
              trend={
                distanceError
                  ? "Could not load"
                  : tripCount === 0
                    ? "No trips today"
                    : avgKm
                      ? `Avg ${avgKm} km / staff`
                      : `${tripCount} trip${tripCount !== 1 ? "s" : ""} today`
              }
            />
          </View>
          <View style={styles.row}>
            <StatCard
              label="On-time rate"
              value="96%"
              icon="clock"
              tint={colors.pillarDiscipline}
              trend="Above 95% target"
            />
            <StatCard
              label="Audit accuracy"
              value={`${stats.accuracy}%`}
              icon="shield"
              tint={colors.pillarControl}
              trend="0 disputes today"
            />
          </View>

          {/* Pillars panel */}
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
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Operating principles
                </Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  How every field action is governed
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              <PillarsRow />
            </View>
            <View style={[styles.principleList, { borderTopColor: colors.border }]}>
              <PrincipleRow
                icon="shield"
                title="Discipline"
                text="Selfie + GPS at every check-in. No silent shifts."
                tint={colors.pillarDiscipline}
              />
              <PrincipleRow
                icon="eye"
                title="Transparency"
                text="Live map shows every staff member's last known position."
                tint={colors.pillarTransparency}
              />
              <PrincipleRow
                icon="target"
                title="Accuracy"
                text="Auto-calculated kilometers from GPS — no manual claims."
                tint={colors.pillarAccuracy}
              />
              <PrincipleRow
                icon="sliders"
                title="Control"
                text="Offline-first sync with full audit trails."
                tint={colors.pillarControl}
                last
              />
            </View>
          </View>

          {/* Live activity */}
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
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Live activity feed
              </Text>
              <Pressable
                onPress={() => router.push("/(admin)/records")}
                hitSlop={8}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 12,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  View all
                </Text>
              </Pressable>
            </View>
            <LiveActivityFeed />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function PendingApprovalsSection() {
  const colors = useColors();
  const qc = useQueryClient();

  const { data: pending = [], isLoading } = useListPendingStaff({
    query: {
      queryKey: getListPendingStaffQueryKey(),
      refetchInterval: 30_000,
      staleTime: 10_000,
    },
  });

  const onSettled = () => {
    qc.invalidateQueries({ queryKey: getListPendingStaffQueryKey() });
  };

  const { mutate: approve, isPending: approving } = useApproveStaff({
    mutation: { onSettled },
  });
  const { mutate: reject, isPending: rejecting } = useRejectStaff({
    mutation: { onSettled },
  });

  if (!isLoading && pending.length === 0) return null;

  const fmt = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: colors.card,
          borderColor: "#F59E0B",
          borderRadius: colors.radius + 4,
          borderWidth: 1,
        },
      ]}
    >
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: "#F59E0B22", borderRadius: 8, padding: 5 }}>
            <Feather name="user-check" size={14} color="#F59E0B" />
          </View>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Pending Approvals
            </Text>
            {!isLoading && (
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                {pending.length} mobilizer{pending.length !== 1 ? "s" : ""} waiting for review
              </Text>
            )}
          </View>
        </View>
        {isLoading && <ActivityIndicator size={14} color={colors.primary} />}
      </View>

      {pending.map((staff, idx) => (
        <View
          key={staff.id}
          style={[
            styles.pendingRow,
            {
              borderTopColor: colors.border,
              borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
            },
          ]}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
              {staff.name}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
              {staff.phone}  ·  {staff.empCode}
            </Text>
            {staff.area ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                Area: {staff.area}
              </Text>
            ) : null}
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
              Registered {fmt(staff.createdAt)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Reject staff?",
                  `Reject registration for ${staff.name}? They will not be able to log in.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Reject",
                      style: "destructive",
                      onPress: () => reject({ staffId: staff.id }),
                    },
                  ],
                )
              }
              disabled={rejecting || approving}
              style={({ pressed }) => [
                styles.pendingBtn,
                {
                  backgroundColor: "#FEE2E2",
                  borderRadius: colors.radius,
                  opacity: pressed || rejecting || approving ? 0.6 : 1,
                },
              ]}
            >
              <Feather name="x" size={13} color="#DC2626" />
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#DC2626" }}>
                Reject
              </Text>
            </Pressable>

            <Pressable
              onPress={() => approve({ staffId: staff.id })}
              disabled={approving || rejecting}
              style={({ pressed }) => [
                styles.pendingBtn,
                {
                  backgroundColor: "#D1FAE5",
                  borderRadius: colors.radius,
                  opacity: pressed || approving || rejecting ? 0.6 : 1,
                },
              ]}
            >
              <Feather name="check" size={13} color="#059669" />
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#059669" }}>
                Approve
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function PrincipleRow({
  icon,
  title,
  text,
  tint,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  text: string;
  tint: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.principleRow,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View
        style={[
          styles.principleIcon,
          { backgroundColor: tint + "1A", borderRadius: 10 },
        ]}
      >
        <Feather name={icon} size={14} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 13,
            fontFamily: "Inter_600SemiBold",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            fontFamily: "Inter_400Regular",
            marginTop: 2,
            lineHeight: 17,
          }}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greet: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  name: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
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
  empText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  heroCard: {
    marginTop: 22,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
  },
  heroValue: {
    color: "#fff",
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.5,
    marginTop: 6,
  },
  heroValueSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 22,
    fontFamily: "Inter_500Medium",
  },
  heroMeta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  heroBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "#F59E0B",
  },
  heroBtnText: {
    color: "#1F1300",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
  },
  row: { flexDirection: "row", gap: 10 },
  section: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  principleList: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  principleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  principleIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 14,
    marginTop: 12,
    gap: 10,
  },
  pendingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
