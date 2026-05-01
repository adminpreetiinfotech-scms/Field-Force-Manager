import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ListCandidatesStatus, useListCandidates } from "@workspace/api-client-react";
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
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
  { label: "Enrolled", value: "enrolled" },
];

type VerifyPayload = { status: "verified" | "rejected" | "enrolled"; remarks: string };

export default function CandidateListScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mobileFilter, setMobileFilter] = useState("");

  const params = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter ? { status: statusFilter as ListCandidatesStatus } : {}),
  };

  const { data: candidates, isLoading, refetch, isRefetching } = useListCandidates(params);

  // Verify modal
  const [verifyModal, setVerifyModal] = useState<{ id: string; name: string } | null>(null);
  const [newStatus, setNewStatus] = useState<"verified" | "rejected" | "enrolled">("verified");
  const [remarks, setRemarks] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const openVerify = (id: string, name: string) => {
    setVerifyModal({ id, name });
    setNewStatus("verified");
    setRemarks("");
  };

  const handleVerify = async () => {
    if (!verifyModal) return;
    setVerifyLoading(true);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/admin/candidates/${verifyModal.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, remarks: remarks.trim() || null, verifiedBy: user?.name ?? null, verifiedByPhone: user?.phone ?? null }),
      });
      if (!res.ok) {
        const d = await res.json() as { title?: string };
        throw new Error(d.title ?? "Failed to update status");
      }
      setVerifyModal(null);
      await refetch();
    } catch (e) {
      const err = e as Error;
      alert(err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleDownloadPdf = (pdfUrl: string | null | undefined) => {
    if (!pdfUrl) return;
    const base = `${getApiBase()}${pdfUrl}`;
    const params = new URLSearchParams();
    // Backend auto-fetches company branding from DB via candidate.companyId;
    // only pass staffName for the report context strip.
    if (user?.name) params.set("staffName", user.name);
    const query = params.toString();
    void Linking.openURL(query ? `${base}?${query}` : base);
  };

  const handleExportCsv = () => {
    const q = statusFilter ? `?status=${statusFilter}` : "";
    void Linking.openURL(`${getApiBase()}/api/admin/candidates/csv${q}`);
  };

  // Filter by mobilizer/phone locally (for quick results without extra API call)
  const filtered = (candidates ?? []).filter((c) => {
    if (!mobileFilter.trim()) return true;
    const q = mobileFilter.trim().toLowerCase();
    return (
      (c.submittedBy ?? "").toLowerCase().includes(q) ||
      (c.submittedByPhone ?? "").includes(q) ||
      (c.village ?? "").toLowerCase().includes(q) ||
      (c.course ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[ss.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + webTop }]}>
        <Pressable onPress={() => router.back()} style={ss.iconBtn} hitSlop={12}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[ss.headerTitle, { color: colors.foreground }]}>
          Candidates {isLoading ? "" : `(${filtered.length})`}
        </Text>
        <Pressable onPress={handleExportCsv} style={ss.iconBtn} hitSlop={8}>
          <Feather name="download" size={18} color={colors.primary} />
        </Pressable>
        <Pressable onPress={() => router.push("/candidate/register")} style={ss.iconBtn} hitSlop={8}>
          <Feather name="user-plus" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={[ss.searchWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[ss.searchBar, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or phone…"
            placeholderTextColor={colors.mutedForeground + "88"}
            style={[ss.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        <View style={[ss.searchBar, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius, marginTop: 6 }]}>
          <Feather name="filter" size={14} color={colors.mutedForeground} />
          <TextInput
            value={mobileFilter}
            onChangeText={setMobileFilter}
            placeholder="Filter by mobilizer, village, course…"
            placeholderTextColor={colors.mutedForeground + "88"}
            style={[ss.searchInput, { color: colors.foreground }]}
          />
          {mobileFilter ? (
            <Pressable onPress={() => setMobileFilter("")} hitSlop={8}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[ss.filterRow, { borderBottomColor: colors.border }]}
        style={{ backgroundColor: colors.card }}
      >
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value;
          const cfg = f.value ? STATUS_CONFIG[f.value as Status] : null;
          return (
            <Pressable
              key={f.value}
              onPress={() => setStatusFilter(f.value)}
              style={[ss.filterChip, {
                backgroundColor: active ? (cfg?.bg ?? colors.primary + "18") : colors.muted,
                borderColor: active ? (cfg?.color ?? colors.primary) : colors.border,
                borderRadius: colors.radius,
              }]}
            >
              <Text style={[ss.filterChipText, { color: active ? (cfg?.color ?? colors.primary) : colors.mutedForeground }]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <View style={ss.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[ss.loadingText, { color: colors.mutedForeground }]}>Loading candidates…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[ss.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={ss.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={[ss.emptyTitle, { color: colors.foreground }]}>
                {search || statusFilter || mobileFilter ? "No matching candidates" : "No candidates yet"}
              </Text>
              <Text style={[ss.emptySub, { color: colors.mutedForeground }]}>
                {search || statusFilter || mobileFilter
                  ? "Try adjusting your search or filters."
                  : "Register the first candidate to get started."}
              </Text>
            </View>
          ) : (
            filtered.map((c) => (
              <View key={c.id} style={[ss.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 2 }]}>
                {/* Card header */}
                <View style={ss.cardTop}>
                  <View style={[ss.avatar, { backgroundColor: colors.primary + "18", borderRadius: 24 }]}>
                    <Text style={[ss.avatarText, { color: colors.primary }]}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[ss.cardName, { color: colors.foreground }]}>{c.name}</Text>
                    <Text style={[ss.cardPhone, { color: colors.mutedForeground }]}>
                      {c.phone}{c.area ? ` · ${c.area}` : ""}
                    </Text>
                    {(c as any).parentMobile ? <Text style={[ss.cardSub, { color: colors.mutedForeground }]}>Parent: {(c as any).parentMobile}</Text> : null}
                    {c.village ? <Text style={[ss.cardSub, { color: colors.mutedForeground }]}>Village: {c.village}</Text> : null}
                    {c.course ? <Text style={[ss.cardSub, { color: colors.mutedForeground }]}>Course: {c.course}</Text> : null}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <StatusBadge status={c.status ?? "pending"} />
                    <Text style={[ss.cardDate, { color: colors.mutedForeground }]}>{formatDate(c.createdAt)}</Text>
                  </View>
                </View>

                {/* Meta chips */}
                {(c.education || c.caste || c.gender) ? (
                  <View style={ss.cardMeta}>
                    {c.education ? <View style={[ss.metaChip, { backgroundColor: colors.muted, borderRadius: 6 }]}><Text style={[ss.metaChipText, { color: colors.mutedForeground }]}>{c.education}</Text></View> : null}
                    {c.caste ? <View style={[ss.metaChip, { backgroundColor: colors.muted, borderRadius: 6 }]}><Text style={[ss.metaChipText, { color: colors.mutedForeground }]}>{c.caste}</Text></View> : null}
                    {c.gender ? <View style={[ss.metaChip, { backgroundColor: colors.muted, borderRadius: 6 }]}><Text style={[ss.metaChipText, { color: colors.mutedForeground }]}>{c.gender}</Text></View> : null}
                  </View>
                ) : null}

                {/* Submitter */}
                {c.submittedBy ? (
                  <Text style={[ss.submittedBy, { color: colors.mutedForeground }]}>
                    Mobilizer: {c.submittedBy} {c.submittedByPhone ? `(${c.submittedByPhone})` : ""}
                  </Text>
                ) : null}

                {/* Verification info */}
                {c.verifiedBy ? (
                  <Text style={[ss.verifiedBy, { color: colors.mutedForeground }]}>
                    {(c.status ?? "") === "rejected" ? "Rejected" : "Verified"} by {c.verifiedBy}
                    {c.verifiedAt ? ` on ${formatDate(c.verifiedAt)}` : ""}
                  </Text>
                ) : null}
                {c.verificationRemarks ? (
                  <View style={[ss.remarksBox, { backgroundColor: colors.muted, borderRadius: 6 }]}>
                    <Text style={[ss.remarksText, { color: colors.foreground }]}>Remarks: {c.verificationRemarks}</Text>
                  </View>
                ) : null}

                {/* Document previews */}
                {(() => {
                  const apiBase = getApiBase();
                  const docs = [
                    { label: "Photo", url: c.photoUrl },
                    { label: "Aadhaar F", url: c.aadhaarFrontUrl },
                    { label: "Aadhaar B", url: c.aadhaarBackUrl },
                    { label: "Education", url: c.educationCertUrl },
                    { label: "Passbook", url: c.bankPassbookUrl },
                    { label: "Caste", url: c.casteCertUrl },
                  ].filter((d) => d.url);
                  if (docs.length === 0) return null;
                  return (
                    <View>
                      <Text style={[ss.docSectionLabel, { color: colors.mutedForeground }]}>Documents</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.docRow}>
                        {docs.map((d) => (
                          <TouchableOpacity
                            key={d.label}
                            onPress={() => setPreviewUrl(`${apiBase}${d.url}`)}
                            style={[ss.docThumbWrap, { borderColor: colors.border, borderRadius: 8 }]}
                          >
                            <Image source={{ uri: `${apiBase}${d.url}` }} style={ss.docThumb} />
                            <Text style={[ss.docThumbLabel, { color: colors.mutedForeground, backgroundColor: colors.card }]}>
                              {d.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  );
                })()}

                {/* Actions */}
                <View style={ss.actions}>
                  <Pressable
                    onPress={() => openVerify(c.id, c.name)}
                    style={({ pressed }) => [ss.actionBtn, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "44", borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Feather name="shield" size={14} color={colors.primary} />
                    <Text style={[ss.actionBtnText, { color: colors.primary }]}>Verify</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDownloadPdf(c.pdfUrl)}
                    disabled={!c.pdfUrl}
                    style={({ pressed }) => [ss.actionBtn, {
                      backgroundColor: c.pdfUrl ? "#1E3A5F14" : colors.muted,
                      borderColor: c.pdfUrl ? "#1E3A5F44" : colors.border,
                      borderRadius: colors.radius,
                      opacity: pressed ? 0.8 : 1,
                    }]}
                  >
                    <Feather name="download" size={14} color={c.pdfUrl ? "#1E3A5F" : colors.mutedForeground} />
                    <Text style={[ss.actionBtnText, { color: c.pdfUrl ? "#1E3A5F" : colors.mutedForeground }]}>PDF</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Verify Modal */}
      <Modal visible={!!verifyModal} transparent animationType="slide" onRequestClose={() => setVerifyModal(null)}>
        <View style={ss.modalOverlay}>
          <View style={[ss.modalSheet, { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20 }]}>
            <View style={[ss.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[ss.modalTitle, { color: colors.foreground }]}>Verify Candidate</Text>
            <Text style={[ss.modalSub, { color: colors.mutedForeground }]}>{verifyModal?.name}</Text>

            <Text style={[ss.fieldLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>Status</Text>
            <View style={ss.chipRow}>
              {(["verified", "rejected", "enrolled"] as const).map((s) => {
                const cfg = STATUS_CONFIG[s];
                const active = newStatus === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setNewStatus(s)}
                    style={[ss.chip, { backgroundColor: active ? cfg.bg : colors.muted, borderColor: active ? cfg.color : colors.border, borderRadius: colors.radius }]}
                  >
                    <Text style={[ss.chipText, { color: active ? cfg.color : colors.mutedForeground }]}>{cfg.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[ss.fieldLabel, { color: colors.mutedForeground, marginTop: 16, marginBottom: 8 }]}>Remarks (optional)</Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Add remarks or reason…"
              placeholderTextColor={colors.mutedForeground + "88"}
              multiline
              style={[ss.remarksInput, {
                color: colors.foreground,
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: colors.radius,
              }]}
            />

            <View style={ss.modalActions}>
              <Pressable
                onPress={() => setVerifyModal(null)}
                style={[ss.modalCancelBtn, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}
              >
                <Text style={[ss.modalCancelText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleVerify()}
                disabled={verifyLoading}
                style={[ss.modalConfirmBtn, {
                  backgroundColor: STATUS_CONFIG[newStatus].color,
                  borderRadius: colors.radius,
                  opacity: verifyLoading ? 0.7 : 1,
                }]}
              >
                {verifyLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={ss.modalConfirmText}>
                    Mark as {STATUS_CONFIG[newStatus].label}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Document Preview Modal */}
      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <View style={ss.previewOverlay}>
          <Pressable style={ss.previewClose} onPress={() => setPreviewUrl(null)}>
            <Feather name="x" size={24} color="#fff" />
          </Pressable>
          {previewUrl ? (
            <Image
              source={{ uri: previewUrl }}
              style={ss.previewImage}
              resizeMode="contain"
            />
          ) : null}
          <Pressable style={ss.previewDownloadBtn} onPress={() => { if (previewUrl) void Linking.openURL(previewUrl); }}>
            <Feather name="download" size={18} color="#fff" />
            <Text style={ss.previewDownloadText}>Download</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const ss = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3, textAlign: "center" },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, height: 38, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  scrollContent: { padding: 16, gap: 12 },
  card: { padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  cardName: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  cardPhone: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  cardDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip: { paddingHorizontal: 8, paddingVertical: 3 },
  metaChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  submittedBy: { fontSize: 11, fontFamily: "Inter_400Regular" },
  verifiedBy: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  remarksBox: { padding: 8 },
  remarksText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  docSectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  docRow: { flexDirection: "row", gap: 8 },
  docThumbWrap: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth },
  docThumb: { width: 64, height: 64, borderRadius: 6 },
  docThumbLabel: { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center", paddingVertical: 2, paddingHorizontal: 4, width: 64 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 36, borderWidth: StyleSheet.hairlineWidth },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 260 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: { padding: 24, paddingBottom: 40, gap: 8 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  remarksInput: { height: 80, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular", borderWidth: StyleSheet.hairlineWidth, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  modalCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalConfirmBtn: { flex: 2, height: 44, alignItems: "center", justifyContent: "center" },
  modalConfirmText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  // Preview
  previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  previewClose: { position: "absolute", top: 48, right: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center", zIndex: 10 },
  previewImage: { width: "90%", height: "75%" },
  previewDownloadBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8 },
  previewDownloadText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
