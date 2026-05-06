import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
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

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

const API_BASE = getApiBase();

type LeaveBalance = {
  quota: number;
  used: number;
  available: number;
};

type LeaveRow = {
  id: string;
  leaveType: "casual" | "sick" | "other";
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  casual: "Casual Leave",
  sick: "Sick Leave",
  other: "Other / Unpaid",
};

const LEAVE_TYPE_COLOR: Record<string, string> = {
  casual: "#3B82F6",
  sick: "#F59E0B",
  other: "#8B5CF6",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "#D97706",
  approved: "#16A34A",
  rejected: "#DC2626",
};

const STATUS_BG: Record<string, string> = {
  pending: "#FFFBEB",
  approved: "#F0FDF4",
  rejected: "#FEF2F2",
};

const STATUS_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  pending: "clock",
  approved: "check-circle",
  rejected: "x-circle",
};

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function countDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  return Math.max(1, Math.floor((e.getTime() - s.getTime()) / 86400000) + 1);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function StaffLeaves() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();

  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [balance, setBalance] = useState<Record<string, LeaveBalance>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showApply, setShowApply] = useState(false);

  // Apply form state
  const [leaveType, setLeaveType] = useState<"casual" | "sick" | "other">("casual");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [applying, setApplying] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const phoneHeader: Record<string, string> = user?.role === "admin" || user?.role === "super_admin"
    ? { "x-admin-phone": user.phone }
    : { "x-staff-phone": user?.phone ?? "" };

  const load = useCallback(async () => {
    if (!user?.phone) return;
    try {
      const r = await fetch(`${API_BASE}/api/leaves/my`, { headers: phoneHeader });
      const d = await r.json() as { leaves: LeaveRow[]; balance: Record<string, LeaveBalance> };
      setLeaves(d.leaves ?? []);
      setBalance(d.balance ?? {});
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.phone]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); void load(); };

  const applyLeave = async () => {
    if (!startDate || !endDate) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      Alert.alert("Error", "End date cannot be before start date");
      return;
    }
    setApplying(true);
    try {
      const r = await fetch(`${API_BASE}/api/leaves/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...phoneHeader },
        body: JSON.stringify({ leaveType, startDate, endDate, reason: reason.trim() || undefined }),
      });
      const d = await r.json() as { title?: string; usedDays?: number; quota?: number };
      if (!r.ok) {
        let msg = d.title ?? "Failed to apply";
        if (d.usedDays !== undefined && d.quota !== undefined) {
          msg += `\nUsed: ${d.usedDays}/${d.quota} days`;
        }
        Alert.alert("Error", msg);
        return;
      }
      Alert.alert("Success", "Leave application submitted!");
      setShowApply(false);
      setReason("");
      setStartDate(todayISO());
      setEndDate(todayISO());
      void load();
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  const cancelLeave = (id: string) => {
    Alert.alert("Cancel Leave", "Cancel this leave application?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel", style: "destructive", onPress: async () => {
          try {
            await fetch(`${API_BASE}/api/leaves/${id}`, {
              method: "DELETE",
              headers: phoneHeader,
            });
            void load();
          } catch {
            Alert.alert("Error", "Failed to cancel leave");
          }
        },
      },
    ]);
  };

  const webTop = Platform.OS === "web" ? 67 : 0;
  const filteredLeaves = filterStatus === "all"
    ? leaves
    : leaves.filter((l) => l.status === filterStatus);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={["#1E3A5F", "#0B2545"]}
        style={{
          paddingTop: insets.top + webTop + 16,
          paddingBottom: 20,
          paddingHorizontal: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 20, color: "#FFFFFF" }}>
              My Leaves
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#93C5FD", marginTop: 2 }}>
              {new Date().getFullYear()} — Leave Management
            </Text>
          </View>
          <Pressable
            onPress={() => setShowApply(true)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: "#3B82F6", borderRadius: 10,
              paddingHorizontal: 14, paddingVertical: 8,
            }}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" }}>Apply</Text>
          </Pressable>
        </View>

        {/* Balance row */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
          {(["casual", "sick"] as const).map((lt) => {
            const b = balance[lt];
            return (
              <View
                key={lt}
                style={{
                  flex: 1, backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: 12,
                }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#93C5FD" }}>
                  {LEAVE_TYPE_LABEL[lt]}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" }}>
                    {b?.available ?? (lt === "casual" ? 12 : 6)}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#93C5FD" }}>
                    / {b?.quota ?? (lt === "casual" ? 12 : 6)} available
                  </Text>
                </View>
                <View style={{
                  height: 4, backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: 2, marginTop: 6,
                }}>
                  <View style={{
                    height: 4, borderRadius: 2,
                    backgroundColor: "#3B82F6",
                    width: `${Math.min(100, ((b?.used ?? 0) / (b?.quota ?? 1)) * 100)}%`,
                  }} />
                </View>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#93C5FD", marginTop: 3 }}>
                  {b?.used ?? 0} used
                </Text>
              </View>
            );
          })}
        </View>
      </LinearGradient>

      {/* Filter tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 18, paddingVertical: 10, gap: 8 }}>
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setFilterStatus(s)}
            style={{
              paddingHorizontal: 12, paddingVertical: 5,
              borderRadius: 20,
              backgroundColor: filterStatus === s ? colors.primary : colors.muted,
            }}
          >
            <Text style={{
              fontFamily: "Inter_600SemiBold", fontSize: 11,
              color: filterStatus === s ? "#fff" : colors.mutedForeground,
              textTransform: "capitalize",
            }}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Leave list */}
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : filteredLeaves.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 60, gap: 12 }}>
            <Feather name="calendar" size={48} color={colors.mutedForeground} />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: colors.mutedForeground }}>
              No leaves found
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>
              Tap "Apply" to submit a new leave request
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredLeaves.map((leave) => (
              <View
                key={leave.id}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: LEAVE_TYPE_COLOR[leave.leaveType] + "18",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Feather
                        name={leave.leaveType === "sick" ? "thermometer" : leave.leaveType === "casual" ? "sun" : "file-text"}
                        size={16}
                        color={LEAVE_TYPE_COLOR[leave.leaveType]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground }}>
                        {LEAVE_TYPE_LABEL[leave.leaveType]}
                      </Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>
                        {fmtDate(leave.startDate)}
                        {leave.startDate !== leave.endDate ? ` → ${fmtDate(leave.endDate)}` : ""}
                        {" · "}{leave.totalDays} day{leave.totalDays !== 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>
                  <View style={{
                    flexDirection: "row", alignItems: "center", gap: 4,
                    backgroundColor: STATUS_BG[leave.status],
                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
                  }}>
                    <Feather name={STATUS_ICON[leave.status]} size={11} color={STATUS_COLOR[leave.status]} />
                    <Text style={{
                      fontFamily: "Inter_700Bold", fontSize: 10,
                      color: STATUS_COLOR[leave.status], textTransform: "capitalize",
                    }}>
                      {leave.status}
                    </Text>
                  </View>
                </View>

                {leave.reason ? (
                  <Text style={{
                    fontFamily: "Inter_400Regular", fontSize: 12,
                    color: colors.mutedForeground, marginTop: 10,
                    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
                  }}>
                    {leave.reason}
                  </Text>
                ) : null}

                {leave.status === "rejected" && leave.rejectionReason ? (
                  <View style={{
                    marginTop: 8, backgroundColor: "#FEF2F2",
                    borderRadius: 8, padding: 8,
                  }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#DC2626" }}>
                      Rejection reason: {leave.rejectionReason}
                    </Text>
                  </View>
                ) : null}

                {leave.status === "pending" && (
                  <TouchableOpacity
                    onPress={() => cancelLeave(leave.id)}
                    style={{
                      marginTop: 10, alignSelf: "flex-start",
                      flexDirection: "row", alignItems: "center", gap: 5,
                      paddingHorizontal: 10, paddingVertical: 5,
                      backgroundColor: "#FEF2F2", borderRadius: 8,
                    }}
                  >
                    <Feather name="trash-2" size={13} color="#DC2626" />
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#DC2626" }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Apply Leave Modal */}
      <Modal visible={showApply} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 18, paddingTop: insets.top + 16, paddingBottom: 14,
            borderBottomWidth: 1, borderBottomColor: colors.border,
          }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground }}>
              Apply for Leave
            </Text>
            <Pressable onPress={() => setShowApply(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, gap: 18 }} showsVerticalScrollIndicator={false}>
            {/* Leave Type */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Leave Type *</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                {(["casual", "sick", "other"] as const).map((lt) => (
                  <Pressable
                    key={lt}
                    onPress={() => setLeaveType(lt)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: leaveType === lt
                        ? LEAVE_TYPE_COLOR[lt]
                        : colors.muted,
                      borderWidth: 1,
                      borderColor: leaveType === lt ? LEAVE_TYPE_COLOR[lt] : colors.border,
                    }}
                  >
                    <Text style={{
                      fontFamily: "Inter_600SemiBold", fontSize: 11,
                      color: leaveType === lt ? "#fff" : colors.mutedForeground,
                      textAlign: "center",
                    }}>
                      {lt === "casual" ? "Casual\n(12/yr)" : lt === "sick" ? "Sick\n(6/yr)" : "Other /\nUnpaid"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {leaveType !== "other" && balance[leaveType] && (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 6 }}>
                  Available: {balance[leaveType].available} day{balance[leaveType].available !== 1 ? "s" : ""}
                  {" "}(Used {balance[leaveType].used} of {balance[leaveType].quota})
                </Text>
              )}
            </View>

            {/* Start Date */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Start Date *</Text>
              <TextInput
                value={startDate}
                onChangeText={(v) => { setStartDate(v); if (v > endDate) setEndDate(v); }}
                placeholder="YYYY-MM-DD"
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            {/* End Date */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>End Date *</Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                maxLength={10}
              />
              {startDate && endDate && startDate <= endDate && (
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.primary, marginTop: 4 }}>
                  {countDays(startDate, endDate)} day{countDays(startDate, endDate) !== 1 ? "s" : ""}
                </Text>
              )}
            </View>

            {/* Reason */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Reason (optional)</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Briefly describe the reason..."
                multiline
                numberOfLines={3}
                style={[styles.input, {
                  backgroundColor: colors.muted, color: colors.foreground,
                  borderColor: colors.border, minHeight: 80, textAlignVertical: "top",
                }]}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <Pressable
              onPress={applyLeave}
              disabled={applying}
              style={{
                backgroundColor: colors.primary, borderRadius: 12,
                paddingVertical: 14, alignItems: "center",
                opacity: applying ? 0.6 : 1,
              }}
            >
              {applying
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" }}>
                    Submit Application
                  </Text>
              }
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
