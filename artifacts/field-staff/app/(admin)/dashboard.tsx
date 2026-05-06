import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

import { CompanyBrand } from "@/components/CompanyBrand";
import { LeaderboardSection } from "@/components/admin/LeaderboardSection";
import { LiveActivityFeed } from "@/components/admin/LiveActivityFeed";
import { NoticePopup } from "@/components/NoticePopup";
import { PillarsRow } from "@/components/PillarBadge";
import { ReportContextBar } from "@/components/ReportContextBar";
import { StatCard } from "@/components/StatCard";
import { SyncBanner } from "@/components/SyncBanner";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useNotices } from "@/hooks/useNotices";

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

const _domain = process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app";
const API_BASE = _domain ? `https://${_domain}` : "";

function useCandidateStats() {
  const [stats, setStats] = useState<CandidateStats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const load = () => {
      fetch(`${API_BASE}/api/admin/candidate-stats`)
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
  const { user, attendance, staffLocations } = useApp();
  const { unreadCount, unreadNotices, markRead } = useNotices({
    phone: user?.phone,
    enabled: !!user?.phone,
    pollIntervalMs: 60_000,
  });
  const popupNotice = unreadNotices[0] ?? null;

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
    const synced = attendance.filter((a) => a.synced).length;
    const totalAccuracy =
      attendance.length === 0
        ? 100
        : Math.round((synced / attendance.length) * 100);
    return {
      checkInsToday,
      onShiftNow,
      accuracy: totalAccuracy,
    };
  }, [attendance, staffLocations]);

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
            <View style={{ flex: 1 }}>
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

          {/* ── Company Branding ─────────────────────────────────────── */}
          <View style={{ alignItems: "center", marginTop: 16, marginBottom: 4 }}>
            <CompanyBrand
              companyName={user?.companyName || user?.organization}
              companyLogoUrl={user?.companyLogoUrl}
              schemeName={user?.companySchemeName || user?.projectName}
              size="md"
              centered
            />
          </View>

          <ReportContextBar
            staffName={user?.name}
            reportType="daily"
          />

          <View style={[styles.heroCard, { borderRadius: 20 }]}>
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
                  Candidate Registration Details
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
              label="Check-in rate"
              value={
                staffLocations.length === 0
                  ? "0%"
                  : `${Math.round((stats.checkInsToday / Math.max(staffLocations.length, 1)) * 100)}%`
              }
              icon="clock"
              tint={colors.pillarDiscipline}
              trend={`${stats.checkInsToday} staff checked in today`}
            />
            <StatCard
              label="Audit accuracy"
              value={`${stats.accuracy}%`}
              icon="shield"
              tint={colors.pillarControl}
              trend={stats.accuracy === 100 ? "Sab synced" : "Kuch pending sync"}
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

          {/* Staff Leaderboard */}
          <LeaderboardSection companyId={user?.companyId} />

          {/* ── Center Staff Attendance ──────────────────────────── */}
          <CenterStaffAttendanceCard />

          {/* ── Leave & Holidays ──────────────────────────────────── */}
          <LeaveHolidaysCard />

          {/* ── Attendance Control ────────────────────────────────── */}
          <AttendanceControlCard />

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
            <LiveActivityFeed companyId={user?.companyId} />
          </View>

          <StaffManagementSection />
        </View>
      </ScrollView>

      <NoticePopup
        notice={popupNotice}
        totalUnread={unreadCount}
        onRead={markRead}
        noticesRoute="/(admin)/notices"
      />
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

type StaffItem = {
  id: string;
  empCode: string;
  name: string;
  phone: string;
  role: string;
  area: string | null;
  approvalStatus: string;
  disabledAt: string | null;
};

function StaffManagementSection() {
  const colors = useColors();
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffItem | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/staff-list`);
      if (res.ok) {
        const data = (await res.json()) as StaffItem[];
        setStaff(data.filter((s) => s.role !== "admin"));
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleDisableToggle = async (item: StaffItem) => {
    const action = item.disabledAt ? "enable" : "disable";
    const label = item.disabledAt ? "Enable" : "Disable";
    Alert.alert(
      `${label} Staff`,
      `${label} ${item.name}? ${!item.disabledAt ? "They will not be able to login or submit data." : "They will regain access to the app."}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: label,
          style: item.disabledAt ? "default" : "destructive",
          onPress: async () => {
            setActionLoading(item.id);
            try {
              const res = await fetch(`/api/admin/staff/${item.id}/${action}`, { method: "PATCH" });
              if (!res.ok) {
                const err = await res.json().catch(() => ({})) as Record<string, unknown>;
                Alert.alert("Error", String(err["title"] ?? "Action failed"));
              } else {
                await load();
              }
            } catch {
              Alert.alert("Error", "Network error. Please try again.");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleDelete = async (item: StaffItem) => {
    setDeleteTarget(null);
    setActionLoading(item.id);
    try {
      const res = await fetch(`/api/admin/staff/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        Alert.alert("Error", String(err["title"] ?? "Delete failed"));
      } else {
        await load();
      }
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      {/* Delete confirmation modal */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setDeleteTarget(null)}
        >
          <Pressable
            style={{
              backgroundColor: colors.card,
              borderRadius: 18,
              padding: 24,
              width: "85%",
              maxWidth: 360,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 24,
              elevation: 12,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: "#FEE2E2",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Feather name="trash-2" size={22} color="#DC2626" />
            </View>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 8 }}>
              Delete Staff Account
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 20 }}>
              Are you sure you want to delete{" "}
              <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{deleteTarget?.name}</Text>?
              {"\n\n"}Their login access will be removed. Old candidate records will be preserved for reports.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <Pressable
                onPress={() => setDeleteTarget(null)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => deleteTarget && handleDelete(deleteTarget)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: "#DC2626",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View
        style={[
          styles.section,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius + 4,
            marginTop: 4,
          },
        ]}
      >
        <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ backgroundColor: "#1E3A5F14", borderRadius: 8, padding: 6 }}>
              <Feather name="users" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Staff Management</Text>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                {loading ? "Loading..." : `${staff.length} field staff`}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => { setLoading(true); void load(); }} hitSlop={8}>
            <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 24 }} />
        ) : staff.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", paddingVertical: 16 }}>
            No field staff registered yet.
          </Text>
        ) : (
          staff.map((item, idx) => {
            const isDisabled = !!item.disabledAt;
            const isBusy = actionLoading === item.id;
            return (
              <View
                key={item.id}
                style={{
                  paddingVertical: 13,
                  borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                  opacity: isDisabled ? 0.7 : 1,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: isDisabled ? "#F3F4F6" : "#1E3A5F14",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="user" size={16} color={isDisabled ? "#9CA3AF" : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                        {item.name}
                      </Text>
                      {isDisabled && (
                        <View style={{ backgroundColor: "#FEE2E2", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#DC2626" }}>DISABLED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                      {item.empCode} · +91 {item.phone}
                      {item.area ? ` · ${item.area}` : ""}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 10, marginLeft: 46 }}>
                  <Pressable
                    onPress={() => handleDisableToggle(item)}
                    disabled={isBusy}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isDisabled ? "#16A34A33" : "#F59E0B33",
                      backgroundColor: isDisabled ? "#F0FDF4" : "#FFFBEB",
                      opacity: pressed || isBusy ? 0.7 : 1,
                    })}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color={isDisabled ? "#16A34A" : "#D97706"} />
                    ) : (
                      <Feather
                        name={isDisabled ? "check-circle" : "slash"}
                        size={13}
                        color={isDisabled ? "#16A34A" : "#D97706"}
                      />
                    )}
                    <Text style={{
                      fontSize: 12,
                      fontFamily: "Inter_600SemiBold",
                      color: isDisabled ? "#16A34A" : "#D97706",
                    }}>
                      {isDisabled ? "Enable" : "Disable"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setDeleteTarget(item)}
                    disabled={isBusy}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#DC262633",
                      backgroundColor: "#FEF2F2",
                      opacity: pressed || isBusy ? 0.7 : 1,
                    })}
                  >
                    <Feather name="trash-2" size={13} color="#DC2626" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#DC2626" }}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
    </>
  );
}

// ─── Center Staff Attendance Quick-Access Card ─────────────────────────────────

function CenterStaffAttendanceCard() {
  const colors = useColors();
  const { user } = useApp();
  const [cStats, setCStats] = useState<{
    totalCenterStaff: number;
    centerPresentToday: number;
    centerAbsentToday: number;
    centerViolationsToday: number;
  } | null>(null);
  const [cLoading, setCLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.phone) return;
      try {
        const res = await fetch(`${API_BASE}/api/admin/dashboard/stats`, {
          headers: { "x-admin-phone": user.phone },
        });
        if (!res.ok) return;
        const d = await res.json() as {
          totalCenterStaff?: number;
          centerPresentToday?: number;
          centerAbsentToday?: number;
          centerViolationsToday?: number;
        };
        if (mounted) setCStats({
          totalCenterStaff: d.totalCenterStaff ?? 0,
          centerPresentToday: d.centerPresentToday ?? 0,
          centerAbsentToday: d.centerAbsentToday ?? 0,
          centerViolationsToday: d.centerViolationsToday ?? 0,
        });
      } catch { /* ignore */ } finally {
        if (mounted) setCLoading(false);
      }
    };
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => { mounted = false; clearInterval(t); };
  }, [user?.phone]);

  if (!cLoading && (cStats?.totalCenterStaff ?? 0) === 0) return null;

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: colors.card,
          borderColor: "#1E3A5F33",
          borderRadius: colors.radius + 4,
        },
      ]}
    >
      <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: "#1E3A5F22", borderRadius: 8, padding: 5 }}>
            <Feather name="check-square" size={14} color="#1E3A5F" />
          </View>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Center Staff Attendance
            </Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Today's check-in status
            </Text>
          </View>
        </View>
        <Pressable onPress={() => router.push("/(admin)/center-attendance" as never)} hitSlop={8}>
          <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
            View all →
          </Text>
        </Pressable>
      </View>

      {cLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
      ) : cStats ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { label: "Total", value: cStats.totalCenterStaff, color: "#1E3A5F", bg: "#1E3A5F14" },
            { label: "Present", value: cStats.centerPresentToday, color: "#16A34A", bg: "#DCFCE7" },
            { label: "Absent", value: cStats.centerAbsentToday, color: "#DC2626", bg: "#FEE2E2" },
            { label: "Violations", value: cStats.centerViolationsToday, color: "#D97706", bg: "#FEF9C3" },
          ].map(s => (
            <Pressable
              key={s.label}
              onPress={() => router.push("/(admin)/center-attendance" as never)}
              style={({ pressed }) => ({
                flex: 1, backgroundColor: s.bg, borderRadius: 10, padding: 10,
                alignItems: "center", opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: s.color, fontSize: 20, fontFamily: "Inter_700Bold" }}>{s.value}</Text>
              <Text style={{ color: s.color, fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2, textAlign: "center" }}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── Attendance Control Quick-Access Card ─────────────────────────────────────

function AttendanceControlCard() {
  const colors = useColors();
  const [shiftInfo, setShiftInfo] = useState<{ fieldShiftStart: string; centerShiftStart: string; lateGraceMinutes: number } | null>(null);
  const { user } = useApp();

  useEffect(() => {
    if (!user?.phone) return;
    let mounted = true;
    fetch(`${API_BASE}/api/admin/attendance-settings`, { headers: { "x-admin-phone": user.phone } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (mounted && d) setShiftInfo(d); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [user?.phone]);

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: colors.card,
          borderColor: "#6366F133",
          borderRadius: colors.radius + 4,
        },
      ]}
    >
      <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: "#6366F118", borderRadius: 8, padding: 5 }}>
            <Feather name="sliders" size={14} color="#6366F1" />
          </View>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Attendance Control
            </Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Shift timings, late rules & corrections
            </Text>
          </View>
        </View>
        <Pressable onPress={() => router.push("/(admin)/attendance-control" as never)} hitSlop={8}>
          <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
            Manage →
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => router.push("/(admin)/attendance-control" as never)}
          style={({ pressed }) => ({ flex: 1, backgroundColor: "#EEF2FF", borderRadius: 10, padding: 10, opacity: pressed ? 0.8 : 1 })}
        >
          <Text style={{ color: "#6366F1", fontSize: 10, fontFamily: "Inter_500Medium" }}>Field Shift</Text>
          <Text style={{ color: "#4F46E5", fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 2 }}>
            {shiftInfo?.fieldShiftStart ?? "09:00"}
          </Text>
          <Text style={{ color: "#6366F1", fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 }}>start time</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/(admin)/attendance-control" as never)}
          style={({ pressed }) => ({ flex: 1, backgroundColor: "#F0FDF4", borderRadius: 10, padding: 10, opacity: pressed ? 0.8 : 1 })}
        >
          <Text style={{ color: "#059669", fontSize: 10, fontFamily: "Inter_500Medium" }}>Center Shift</Text>
          <Text style={{ color: "#047857", fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 2 }}>
            {shiftInfo?.centerShiftStart ?? "09:00"}
          </Text>
          <Text style={{ color: "#059669", fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 }}>start time</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/(admin)/attendance-control" as never)}
          style={({ pressed }) => ({ flex: 1, backgroundColor: "#FFFBEB", borderRadius: 10, padding: 10, opacity: pressed ? 0.8 : 1 })}
        >
          <Text style={{ color: "#D97706", fontSize: 10, fontFamily: "Inter_500Medium" }}>Late Grace</Text>
          <Text style={{ color: "#B45309", fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 2 }}>
            {shiftInfo?.lateGraceMinutes ?? 15} min
          </Text>
          <Text style={{ color: "#D97706", fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 }}>grace period</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Leave & Holidays Quick-Access Card ───────────────────────────────────────

function LeaveHolidaysCard() {
  const colors = useColors();
  const { user } = useApp();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [nextHoliday, setNextHoliday] = useState<{ name: string; date: string } | null>(null);

  useEffect(() => {
    if (!user?.phone) return;
    let mounted = true;
    const load = async () => {
      try {
        const [lr, hr] = await Promise.all([
          fetch(`${API_BASE}/api/admin/leaves?status=pending`, { headers: { "x-admin-phone": user.phone } }),
          fetch(`${API_BASE}/api/holidays`, { headers: { "x-admin-phone": user.phone } }),
        ]);
        if (lr.ok) {
          const ld = await lr.json() as { leaves: { id: string }[] };
          if (mounted) setPendingCount(ld.leaves?.length ?? 0);
        }
        if (hr.ok) {
          const hd = await hr.json() as { holidays: { name: string; date: string }[] };
          const today = new Date().toISOString().slice(0, 10);
          const upcoming = (hd.holidays ?? []).find((h) => h.date >= today);
          if (mounted) setNextHoliday(upcoming ?? null);
        }
      } catch { /* silent */ }
    };
    void load();
    return () => { mounted = false; };
  }, [user?.phone]);

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: colors.card,
          borderColor: "#16A34A33",
          borderRadius: colors.radius + 4,
        },
      ]}
    >
      <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: "#16A34A18", borderRadius: 8, padding: 5 }}>
            <Feather name="calendar" size={14} color="#16A34A" />
          </View>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Leave & Holidays
            </Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Leave requests and upcoming holidays
            </Text>
          </View>
        </View>
        <Pressable onPress={() => router.push("/(admin)/leaves" as never)} hitSlop={8}>
          <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
            Manage →
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => router.push("/(admin)/leaves" as never)}
          style={({ pressed }) => ({
            flex: 1, backgroundColor: pendingCount ? "#FEF9C3" : "#F0FDF4",
            borderRadius: 10, padding: 10, alignItems: "center",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{
              color: pendingCount ? "#D97706" : "#16A34A",
              fontSize: 20, fontFamily: "Inter_700Bold",
            }}>
              {pendingCount ?? "—"}
            </Text>
            {(pendingCount ?? 0) > 0 && (
              <Feather name="alert-circle" size={14} color="#D97706" />
            )}
          </View>
          <Text style={{
            color: pendingCount ? "#D97706" : "#16A34A",
            fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2,
          }}>
            Pending
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(admin)/leaves" as never)}
          style={({ pressed }) => ({
            flex: 2, backgroundColor: "#EFF6FF",
            borderRadius: 10, padding: 10,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: "#3B82F6", fontSize: 10, fontFamily: "Inter_500Medium" }}>
            Next Holiday
          </Text>
          {nextHoliday ? (
            <>
              <Text style={{ color: "#1D4ED8", fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 2 }}>
                {nextHoliday.name}
              </Text>
              <Text style={{ color: "#3B82F6", fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 }}>
                {new Date(nextHoliday.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </Text>
            </>
          ) : (
            <Text style={{ color: "#93C5FD", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 }}>
              No upcoming holidays
            </Text>
          )}
        </Pressable>
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
