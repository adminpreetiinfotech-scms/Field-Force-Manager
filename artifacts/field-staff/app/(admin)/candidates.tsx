import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

import {
  type ListCandidatesStatus,
  useListCandidates,
} from "@workspace/api-client-react";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain =
    process.env.EXPO_PUBLIC_DOMAIN ||
    "field-force-manager-Mobilization.replit.app";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
  { label: "Enrolled", value: "enrolled" },
];

type VerifyPayload = {
  status: "verified" | "rejected" | "enrolled";
  remarks: string;
};

export default function AdminCandidatesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mobileFilter, setMobileFilter] = useState("");
  const [verifyModal, setVerifyModal] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [newStatus, setNewStatus] = useState<
    "verified" | "rejected" | "enrolled"
  >("verified");
  const [remarks, setRemarks] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);

  const params = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter ? { status: statusFilter as ListCandidatesStatus } : {}),
  };

  const {
    data: candidates,
    isLoading,
    refetch,
    isRefetching,
  } = useListCandidates(params);

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
      const res = await fetch(
        `${apiBase}/api/admin/candidates/${verifyModal.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-phone": user?.phone ?? "",
          },
          body: JSON.stringify({
            status: newStatus,
            remarks: remarks.trim() || null,
            verifiedBy: user?.name ?? null,
            verifiedByPhone: user?.phone ?? null,
          }),
        },
      );
      if (!res.ok) {
        const d = (await res.json()) as { title?: string };
        throw new Error(d.title ?? "Failed to update status");
      }
      setVerifyModal(null);
      await refetch();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleDownloadPdf = (
    pdfUrl: string | null | undefined,
    cName: string,
  ) => {
    if (!pdfUrl) return;
    const base = `${getApiBase()}${pdfUrl}`;
    const params = new URLSearchParams();
    if (user?.name) params.set("staffName", user.name);
    const query = params.toString();
    void Linking.openURL(query ? `${base}?${query}` : base);
  };

  const handleExportCsv = () => {
    const q = statusFilter ? `?status=${statusFilter}` : "";
    void Linking.openURL(`${getApiBase()}/api/admin/candidates/csv${q}`);
  };

  const filtered = (candidates ?? []).filter((c) => {
    if (!mobileFilter.trim()) return true;
    return (
      c.phone?.includes(mobileFilter.trim()) ||
      ((c as any).parentMobile as string | undefined)?.includes(
        mobileFilter.trim(),
      )
    );
  });

  const pendingCount = (candidates ?? []).filter(
    (c) => c.status === "pending",
  ).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top + 12 + webTop,
          paddingHorizontal: 20,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <View style={ss.headerRow}>
          <View>
            <Text style={[ss.title, { color: colors.foreground }]}>
              Candidates
            </Text>
            {pendingCount > 0 && (
              <Text style={[ss.sub, { color: "#D97706" }]}>
                {pendingCount} pending review
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[ss.exportBtn, { borderColor: colors.border }]}
            onPress={handleExportCsv}
          >
            <Feather name="download" size={14} color={colors.primary} />
            <Text style={[ss.exportTxt, { color: colors.primary }]}>CSV</Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            ss.searchBox,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name / Aadhaar…"
            placeholderTextColor={colors.mutedForeground}
            style={[ss.searchInput, { color: colors.foreground }]}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View
          style={[
            ss.searchBox,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Feather name="phone" size={15} color={colors.mutedForeground} />
          <TextInput
            value={mobileFilter}
            onChangeText={setMobileFilter}
            placeholder="Filter by mobile number…"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            style={[ss.searchInput, { color: colors.foreground }]}
          />
          {mobileFilter ? (
            <TouchableOpacity onPress={() => setMobileFilter("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 8 }}
        >
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                onPress={() => setStatusFilter(f.value)}
                style={[
                  ss.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.muted,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    ss.filterTxt,
                    { color: active ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : filtered.length === 0 ? (
          <View style={ss.emptyBox}>
            <Feather name="users" size={36} color={colors.mutedForeground} />
            <Text style={[ss.emptyTxt, { color: colors.mutedForeground }]}>
              {search || statusFilter || mobileFilter
                ? "No matching candidates"
                : "No candidates yet"}
            </Text>
          </View>
        ) : (
          filtered.map((c) => (
            <View
              key={c.id}
              style={[
                ss.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={ss.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[ss.candidateName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  <Text
                    style={[ss.candidateSub, { color: colors.mutedForeground }]}
                  >
                    {c.phone ?? "—"}
                    {c.village ? `  ·  ${c.village}` : ""}
                  </Text>
                  {c.verifiedBy && (
                    <Text
                      style={[
                        ss.verifiedBy,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {c.status === "rejected" ? "Rejected" : "Verified"} by{" "}
                      {c.verifiedBy}
                    </Text>
                  )}
                </View>
                <StatusBadge status={c.status ?? "pending"} />
              </View>

              <View
                style={[ss.divider, { backgroundColor: colors.border }]}
              />

              <View style={ss.cardBottom}>
                <Text
                  style={[ss.dateText, { color: colors.mutedForeground }]}
                >
                  <Feather
                    name="calendar"
                    size={11}
                    color={colors.mutedForeground}
                  />{" "}
                  {formatDate(c.createdAt)}
                  {(c as any).mobilizer ? `  ·  ${(c as any).mobilizer}` : ""}
                </Text>
                <View style={ss.actions}>
                  {(c as any).pdfPath && (
                    <TouchableOpacity
                      style={ss.iconBtn}
                      onPress={() => handleDownloadPdf((c as any).pdfPath, c.name ?? "")}
                    >
                      <Feather
                        name="file-text"
                        size={16}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      ss.verifyBtn,
                      { backgroundColor: colors.primary + "15" },
                    ]}
                    onPress={() => openVerify(c.id, c.name ?? "Candidate")}
                  >
                    <Feather name="check-circle" size={14} color={colors.primary} />
                    <Text style={[ss.verifyTxt, { color: colors.primary }]}>
                      Review
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!verifyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setVerifyModal(null)}
      >
        <View style={ss.modalOverlay}>
          <View
            style={[ss.modalBox, { backgroundColor: colors.card }]}
          >
            <Text style={[ss.modalTitle, { color: colors.foreground }]}>
              Review Candidate
            </Text>
            <Text
              style={[ss.modalSub, { color: colors.mutedForeground }]}
            >
              {verifyModal?.name}
            </Text>

            <Text
              style={[ss.modalLabel, { color: colors.mutedForeground }]}
            >
              Set Status
            </Text>
            <View style={ss.statusRow}>
              {(
                ["verified", "rejected", "enrolled"] as const
              ).map((s) => {
                const cfg = STATUS_CONFIG[s];
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setNewStatus(s)}
                    style={[
                      ss.statusChip,
                      {
                        backgroundColor:
                          newStatus === s ? cfg.bg : colors.muted,
                        borderColor:
                          newStatus === s ? cfg.color : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        ss.statusChipTxt,
                        {
                          color:
                            newStatus === s ? cfg.color : colors.mutedForeground,
                        },
                      ]}
                    >
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text
              style={[
                ss.modalLabel,
                { color: colors.mutedForeground, marginTop: 12 },
              ]}
            >
              Remarks (optional)
            </Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Enter remarks…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              style={[
                ss.remarksInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            />

            <View style={ss.modalActions}>
              <Pressable
                onPress={() => setVerifyModal(null)}
                style={[
                  ss.cancelBtn,
                  { borderColor: colors.border },
                ]}
              >
                <Text
                  style={[ss.cancelTxt, { color: colors.mutedForeground }]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleVerify}
                disabled={verifyLoading}
                style={[
                  ss.confirmBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: verifyLoading ? 0.7 : 1,
                  },
                ]}
              >
                {verifyLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={ss.confirmTxt}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ss = StyleSheet.create({
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  exportTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 2,
  },
  filterTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 10,
  },
  candidateName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  candidateSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  verifiedBy: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  divider: { height: 1, marginHorizontal: 14 },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { padding: 6 },
  verifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verifyTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyBox: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalBox: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16 },
  modalLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  statusRow: { flexDirection: "row", gap: 8 },
  statusChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  statusChipTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  remarksInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 72,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  confirmBtn: {
    flex: 2,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 10,
  },
  confirmTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
