import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const STATUS_CONFIG = {
  pending:  { label: "Pending",  color: "#D97706", bg: "#FEF3C7" },
  verified: { label: "Verified", color: "#059669", bg: "#D1FAE5" },
  rejected: { label: "Rejected", color: "#DC2626", bg: "#FEE2E2" },
  enrolled: { label: "Enrolled", color: "#7C3AED", bg: "#EDE9FE" },
} as const;

type Status = keyof typeof STATUS_CONFIG;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as Status] ?? STATUS_CONFIG.pending;
  return (
    <View style={[ss.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[ss.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

type Candidate = {
  id: string;
  name: string;
  phone: string;
  status: string;
  village?: string | null;
  course?: string | null;
  area?: string | null;
  education?: string | null;
  verificationRemarks?: string | null;
  verifiedBy?: string | null;
  pdfUrl?: string | null;
  createdAt?: string | null;
};

export default function MyCandidatesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyCandidates = useCallback(async () => {
    if (!user?.phone) return;
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/candidates/my?phone=${encodeURIComponent(user.phone)}`);
      if (!res.ok) throw new Error("Failed to fetch candidates");
      const data = await res.json() as Candidate[];
      setCandidates(data);
      setError(null);
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    }
  }, [user?.phone]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchMyCandidates().finally(() => setLoading(false));
    }, [fetchMyCandidates]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMyCandidates();
    setRefreshing(false);
  };

  const handleDownloadPdf = (pdfUrl: string | null | undefined) => {
    if (!pdfUrl) return;
    void Linking.openURL(`${getApiBase()}${pdfUrl}`);
  };

  const counts = {
    pending: candidates.filter((c) => c.status === "pending").length,
    verified: candidates.filter((c) => c.status === "verified").length,
    rejected: candidates.filter((c) => c.status === "rejected").length,
    enrolled: candidates.filter((c) => c.status === "enrolled").length,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[ss.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + webTop }]}>
        <Pressable onPress={() => router.back()} style={ss.iconBtn} hitSlop={12}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[ss.headerTitle, { color: colors.foreground }]}>My Candidates</Text>
        <Pressable onPress={() => router.push("/candidate/register")} style={ss.iconBtn} hitSlop={8}>
          <Feather name="user-plus" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Summary chips */}
      {!loading && candidates.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: colors.card }} contentContainerStyle={ss.summaryRow}>
          {(Object.entries(counts) as [Status, number][]).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <View key={status} style={[ss.summaryChip, { backgroundColor: cfg.bg, borderColor: cfg.color + "66" }]}>
                <Text style={[ss.summaryCount, { color: cfg.color }]}>{count}</Text>
                <Text style={[ss.summaryLabel, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={ss.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[ss.loadingText, { color: colors.mutedForeground }]}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={ss.center}>
          <Feather name="alert-circle" size={36} color="#EF4444" />
          <Text style={[ss.errorText, { color: "#EF4444" }]}>{error}</Text>
          <Pressable onPress={handleRefresh} style={[ss.retryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
            <Text style={ss.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[ss.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {candidates.length === 0 ? (
            <View style={ss.empty}>
              <Feather name="user-x" size={40} color={colors.mutedForeground} />
              <Text style={[ss.emptyTitle, { color: colors.foreground }]}>No candidates yet</Text>
              <Text style={[ss.emptySub, { color: colors.mutedForeground }]}>
                Candidates you register will appear here.
              </Text>
              <Pressable
                onPress={() => router.push("/candidate/register")}
                style={({ pressed }) => [ss.emptyBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 }]}
              >
                <Feather name="user-plus" size={16} color="#fff" />
                <Text style={ss.emptyBtnText}>Register Candidate</Text>
              </Pressable>
            </View>
          ) : (
            candidates.map((c) => (
              <View key={c.id} style={[ss.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 2 }]}>
                <View style={ss.cardTop}>
                  <View style={[ss.avatar, { backgroundColor: colors.primary + "18", borderRadius: 24 }]}>
                    <Text style={[ss.avatarText, { color: colors.primary }]}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[ss.cardName, { color: colors.foreground }]}>{c.name}</Text>
                    <Text style={[ss.cardPhone, { color: colors.mutedForeground }]}>
                      {c.phone}{c.area ? ` · ${c.area}` : ""}
                    </Text>
                    {c.village ? <Text style={[ss.cardSub, { color: colors.mutedForeground }]}>Village: {c.village}</Text> : null}
                    {c.course ? <Text style={[ss.cardSub, { color: colors.mutedForeground }]}>Course: {c.course}</Text> : null}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <StatusBadge status={c.status ?? "pending"} />
                    <Text style={[ss.cardDate, { color: colors.mutedForeground }]}>{formatDate(c.createdAt)}</Text>
                  </View>
                </View>

                {c.education ? (
                  <View style={ss.cardMeta}>
                    <View style={[ss.metaChip, { backgroundColor: colors.muted, borderRadius: 6 }]}>
                      <Text style={[ss.metaChipText, { color: colors.mutedForeground }]}>{c.education}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Verification info */}
                {c.verifiedBy ? (
                  <Text style={[ss.verifiedBy, { color: colors.mutedForeground }]}>
                    {c.status === "rejected" ? "Rejected" : "Verified"} by {c.verifiedBy}
                  </Text>
                ) : null}
                {c.verificationRemarks ? (
                  <View style={[ss.remarksBox, {
                    backgroundColor: c.status === "rejected" ? "#FEE2E2" : (c.status === "verified" ? "#D1FAE5" : colors.muted),
                    borderRadius: 6,
                  }]}>
                    <Text style={[ss.remarksText, {
                      color: c.status === "rejected" ? "#DC2626" : (c.status === "verified" ? "#059669" : colors.foreground),
                    }]}>
                      Remark: {c.verificationRemarks}
                    </Text>
                  </View>
                ) : null}

                {c.pdfUrl ? (
                  <Pressable
                    onPress={() => handleDownloadPdf(c.pdfUrl)}
                    style={({ pressed }) => [ss.pdfBtn, { backgroundColor: "#1E3A5F", borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Feather name="download" size={14} color="#fff" />
                    <Text style={ss.pdfBtnText}>Download PDF</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3, textAlign: "center" },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryChip: { alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  summaryCount: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  scrollContent: { padding: 16, gap: 12 },
  card: { padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  cardName: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  cardPhone: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  cardDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardMeta: { flexDirection: "row", gap: 6 },
  metaChip: { paddingHorizontal: 8, paddingVertical: 3 },
  metaChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  verifiedBy: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  remarksBox: { padding: 8 },
  remarksText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  pdfBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 36 },
  pdfBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 260 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
