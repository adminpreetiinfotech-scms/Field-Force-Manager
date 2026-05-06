import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  useApproveStaff,
  useRejectStaff,
} from "@workspace/api-client-react";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

const _domain =
  process.env.EXPO_PUBLIC_DOMAIN ||
  "field-force-manager-Mobilization.replit.app";
const API_BASE = Platform.OS === "web" ? "" : `https://${_domain}`;

type ApprovalStatus = "pending" | "approved" | "rejected";

type StaffMember = {
  id: string;
  name: string;
  phone: string;
  empCode: string;
  role: string;
  area: string | null;
  organization: string | null;
  centerName: string | null;
  projectName: string | null;
  approvalStatus: ApprovalStatus;
  disabledAt: string | null;
  createdAt: string | null;
};

function getStatusConfig(s: StaffMember) {
  if (s.disabledAt)
    return { label: "Disabled", color: "#6B7280", bg: "#F3F4F6" };
  if (s.approvalStatus === "pending")
    return { label: "Pending", color: "#D97706", bg: "#FEF3C7" };
  if (s.approvalStatus === "rejected")
    return { label: "Rejected", color: "#DC2626", bg: "#FEE2E2" };
  return { label: "Active", color: "#059669", bg: "#D1FAE5" };
}

function StaffCard({
  member,
  colors,
  onApprove,
  onReject,
  onDisable,
  onDelete,
  onViewRoute,
  onResetMpin,
}: {
  member: StaffMember;
  colors: ReturnType<typeof useColors>;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDisable: (id: string, name: string, disabled: boolean) => void;
  onDelete: (id: string, name: string) => void;
  onViewRoute: (id: string) => void;
  onResetMpin: (id: string, name: string) => void;
}) {
  const cfg = getStatusConfig(member);
  const isPending = member.approvalStatus === "pending" && !member.disabledAt;
  const isActive =
    member.approvalStatus === "approved" && !member.disabledAt;

  return (
    <View
      style={[
        ss.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={ss.cardTop}>
        <View
          style={[ss.avatar, { backgroundColor: colors.primary + "20" }]}
        >
          <Text style={[ss.avatarTxt, { color: colors.primary }]}>
            {(member.name ?? "?")[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={[ss.staffName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {member.name}
          </Text>
          <Text
            style={[ss.staffSub, { color: colors.mutedForeground }]}
          >
            {member.phone}  ·  {member.empCode}
          </Text>
          {member.area ? (
            <Text
              style={[ss.staffSub, { color: colors.mutedForeground }]}
            >
              {member.area}
            </Text>
          ) : null}
        </View>
        <View style={[ss.statusPill, { backgroundColor: cfg.bg }]}>
          <Text style={[ss.statusTxt, { color: cfg.color }]}>
            {cfg.label}
          </Text>
        </View>
      </View>

      <View style={[ss.divider, { backgroundColor: colors.border }]} />

      <View style={ss.actions}>
        {isPending && (
          <>
            <TouchableOpacity
              style={[ss.actionBtn, { backgroundColor: "#D1FAE5" }]}
              onPress={() => onApprove(member.id)}
            >
              <Feather name="check" size={14} color="#059669" />
              <Text style={[ss.actionTxt, { color: "#059669" }]}>
                Approve
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ss.actionBtn, { backgroundColor: "#FEE2E2" }]}
              onPress={() => onReject(member.id)}
            >
              <Feather name="x" size={14} color="#DC2626" />
              <Text style={[ss.actionTxt, { color: "#DC2626" }]}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
        {isActive && (
          <TouchableOpacity
            style={[ss.actionBtn, { backgroundColor: colors.muted }]}
            onPress={() => onViewRoute(member.id)}
          >
            <Feather name="map" size={14} color={colors.primary} />
            <Text style={[ss.actionTxt, { color: colors.primary }]}>
              Route
            </Text>
          </TouchableOpacity>
        )}
        {(isActive || !!member.disabledAt) && (
          <TouchableOpacity
            style={[ss.actionBtn, { backgroundColor: "#FEF3C7" }]}
            onPress={() => onResetMpin(member.id, member.name)}
          >
            <Feather name="key" size={14} color="#D97706" />
            <Text style={[ss.actionTxt, { color: "#D97706" }]}>
              Reset MPIN
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[ss.actionBtn, { backgroundColor: colors.muted }]}
          onPress={() =>
            onDisable(member.id, member.name, !!member.disabledAt)
          }
        >
          <Feather
            name={member.disabledAt ? "unlock" : "slash"}
            size={14}
            color={colors.mutedForeground}
          />
          <Text style={[ss.actionTxt, { color: colors.mutedForeground }]}>
            {member.disabledAt ? "Enable" : "Disable"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ss.actionBtn, { backgroundColor: "#FEE2E2" }]}
          onPress={() => onDelete(member.id, member.name)}
        >
          <Feather name="trash-2" size={14} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

type Tab = "all" | "pending" | "active" | "disabled";

const TAB_FILTERS: { label: string; value: Tab }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Disabled", value: "disabled" },
];

export default function AdminStaffScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Reset MPIN modal state
  const [resetMpinModal, setResetMpinModal] = useState<{ id: string; name: string } | null>(null);
  const [newMpin, setNewMpin] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleDownload = async () => {
    if (!user) return;
    setDownloading(true);
    try {
      const url = `${API_BASE}/api/admin/staff/export?adminPhone=${encodeURIComponent(user.phone)}`;
      const fileName = `staff-list-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Staff List Excel",
        });
      } else {
        Alert.alert("Downloaded", `File saved to:\n${uri}`);
      }
    } catch (e: any) {
      Alert.alert("Download failed", e?.message || "Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const approveStaff = useApproveStaff();
  const rejectStaff = useRejectStaff();

  const fetchStaff = React.useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/staff-list`, {
        headers: { "x-admin-phone": user.phone },
      });
      if (!res.ok) throw new Error("Failed to load staff");
      const data = (await res.json()) as StaffMember[];
      setStaffList(data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  React.useEffect(() => {
    void fetchStaff();
    const t = setInterval(() => void fetchStaff(), 60_000);
    return () => clearInterval(t);
  }, [fetchStaff]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchStaff();
  };

  const handleApprove = (id: string) => {
    Alert.alert("Approve Staff", "Approve this staff member?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          try {
            await approveStaff.mutateAsync({ staffId: id });
            void fetchStaff();
          } catch {
            Alert.alert("Error", "Failed to approve");
          }
        },
      },
    ]);
  };

  const handleReject = (id: string) => {
    Alert.alert("Reject Staff", "Reject this staff member?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            await rejectStaff.mutateAsync({ staffId: id });
            void fetchStaff();
          } catch {
            Alert.alert("Error", "Failed to reject");
          }
        },
      },
    ]);
  };

  const handleDisable = (id: string, name: string, isDisabled: boolean) => {
    const action = isDisabled ? "Enable" : "Disable";
    Alert.alert(
      `${action} ${name}`,
      `${action} this staff member's access?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action,
          style: isDisabled ? "default" : "destructive",
          onPress: async () => {
            try {
              const endpoint = isDisabled
                ? `${API_BASE}/api/admin/staff/${id}/enable`
                : `${API_BASE}/api/admin/staff/${id}/disable`;
              const res = await fetch(endpoint, {
                method: "PATCH",
                headers: { "x-admin-phone": user?.phone ?? "" },
              });
              if (!res.ok) throw new Error("Failed");
              void fetchStaff();
            } catch {
              Alert.alert("Error", `Failed to ${action.toLowerCase()}`);
            }
          },
        },
      ],
    );
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      `Remove ${name}`,
      "This will permanently remove this staff member. Their candidate records will be preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE}/api/admin/staff/${id}`, {
                method: "DELETE",
                headers: { "x-admin-phone": user?.phone ?? "" },
              });
              if (!res.ok) throw new Error("Failed");
              void fetchStaff();
            } catch {
              Alert.alert("Error", "Failed to remove staff");
            }
          },
        },
      ],
    );
  };

  const handleViewRoute = (id: string) => {
    router.push(`/route/${id}` as any);
  };

  const handleResetMpin = (id: string, name: string) => {
    setNewMpin("");
    setResetMpinModal({ id, name });
  };

  const confirmResetMpin = async () => {
    if (!resetMpinModal || !user) return;
    if (!/^\d{4,6}$/.test(newMpin.trim())) {
      Alert.alert("Validation", "MPIN 4 se 6 digits ka hona chahiye.");
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/staff/${resetMpinModal.id}/reset-mpin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-phone": user.phone },
        body: JSON.stringify({ newMpin: newMpin.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setResetMpinModal(null);
      Alert.alert("✅ MPIN Reset", `${resetMpinModal.name} ka naya MPIN set ho gaya.\nUnhe bata dein: ${newMpin.trim()}`);
    } catch {
      Alert.alert("Error", "MPIN reset nahi ho saka. Dobara try karein.");
    } finally {
      setResetLoading(false);
    }
  };

  const filtered = staffList.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.empCode.toLowerCase().includes(q);
    const matchesTab =
      tab === "all" ||
      (tab === "pending" && s.approvalStatus === "pending" && !s.disabledAt) ||
      (tab === "active" && s.approvalStatus === "approved" && !s.disabledAt) ||
      (tab === "disabled" && !!s.disabledAt);
    return matchesSearch && matchesTab;
  });

  const pendingCount = staffList.filter(
    (s) => s.approvalStatus === "pending" && !s.disabledAt,
  ).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Reset MPIN Modal ─────────────────────────────────────────── */}
      <Modal
        visible={!!resetMpinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setResetMpinModal(null)}
      >
        <View style={ss.modalOverlay}>
          <View style={[ss.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[ss.modalIconWrap, { backgroundColor: "#FEF3C7" }]}>
              <Feather name="key" size={22} color="#D97706" />
            </View>
            <Text style={[ss.modalTitle, { color: colors.foreground }]}>
              MPIN Reset
            </Text>
            <Text style={[ss.modalSub, { color: colors.mutedForeground }]}>
              {resetMpinModal?.name} ke liye naya MPIN set karein
            </Text>
            <TextInput
              value={newMpin}
              onChangeText={(t) => setNewMpin(t.replace(/\D/g, "").slice(0, 6))}
              placeholder="Naya MPIN (4–6 digits)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              style={[ss.mpinInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
            />
            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 }}>
              Reset ke baad staff ko yeh MPIN bata dein
            </Text>
            <View style={ss.modalBtns}>
              <TouchableOpacity
                style={[ss.modalBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => setResetMpinModal(null)}
                disabled={resetLoading}
              >
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ss.modalBtn, { backgroundColor: "#D97706", opacity: resetLoading ? 0.7 : 1 }]}
                onPress={() => { void confirmResetMpin(); }}
                disabled={resetLoading}
              >
                {resetLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Set MPIN</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[ss.title, { color: colors.foreground }]}>
            Staff Management
          </Text>
          <TouchableOpacity
            onPress={() => { void handleDownload(); }}
            disabled={downloading}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              backgroundColor: colors.primary + "15",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: colors.primary + "30",
            }}
          >
            {downloading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="download" size={14} color={colors.primary} />
            }
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
              {downloading ? "..." : "Excel"}
            </Text>
          </TouchableOpacity>
        </View>
        {pendingCount > 0 && (
          <Text style={[ss.pendingNote, { color: "#D97706" }]}>
            {pendingCount} pending approval
          </Text>
        )}

        <View
          style={[
            ss.searchBox,
            {
              backgroundColor: colors.muted,
              borderColor: colors.border,
              marginTop: 12,
            },
          ]}
        >
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, phone, code…"
            placeholderTextColor={colors.mutedForeground}
            style={[ss.searchInput, { color: colors.foreground }]}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 8 }}
        >
          {TAB_FILTERS.map((f) => {
            const active = tab === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                onPress={() => setTab(f.value)}
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
                  {f.value === "pending" && pendingCount > 0
                    ? ` (${pendingCount})`
                    : ""}
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
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : filtered.length === 0 ? (
          <View style={ss.emptyBox}>
            <Feather
              name="users"
              size={36}
              color={colors.mutedForeground}
            />
            <Text style={[ss.emptyTxt, { color: colors.mutedForeground }]}>
              {search || tab !== "all" ? "No matching staff" : "No staff yet"}
            </Text>
          </View>
        ) : (
          filtered.map((member) => (
            <StaffCard
              key={member.id}
              member={member}
              colors={colors}
              onApprove={handleApprove}
              onReject={handleReject}
              onDisable={handleDisable}
              onDelete={handleDelete}
              onViewRoute={handleViewRoute}
              onResetMpin={handleResetMpin}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  pendingNote: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
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
    alignItems: "center",
    padding: 14,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { fontSize: 18, fontFamily: "Inter_700Bold" },
  staffName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  staffSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  divider: { height: 1, marginHorizontal: 14 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyBox: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalBox: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  mpinInput: {
    width: "100%",
    height: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 8,
    marginTop: 4,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
});
