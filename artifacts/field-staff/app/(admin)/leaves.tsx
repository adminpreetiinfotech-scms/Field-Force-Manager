import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
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
  staffId: string;
  staffName: string;
  staffEmpCode: string;
  staffPhone: string;
};

type HolidayRow = {
  id: string;
  name: string;
  date: string;
  type: "national" | "regional" | "company";
  description: string | null;
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  casual: "Casual",
  sick: "Sick",
  other: "Other",
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

const TYPE_COLOR: Record<string, string> = {
  national: "#DC2626",
  regional: "#D97706",
  company: "#3B82F6",
};

const TYPE_LABEL: Record<string, string> = {
  national: "National",
  regional: "Regional",
  company: "Company",
};

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminLeaves() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();

  const [tab, setTab] = useState<"leaves" | "holidays">("leaves");
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  // Holiday add form
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [hName, setHName] = useState("");
  const [hDate, setHDate] = useState(todayISO());
  const [hType, setHType] = useState<"national" | "regional" | "company">("company");
  const [hDesc, setHDesc] = useState("");
  const [addingHoliday, setAddingHoliday] = useState(false);

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ id: string; staffName: string } | null>(null);
  const [rejReason, setRejReason] = useState("");
  const [actioning, setActioning] = useState(false);

  const adminHeader = { "x-admin-phone": user?.phone ?? "" };

  const loadLeaves = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/leaves?status=${filterStatus}`, { headers: adminHeader });
      const d = await r.json() as { leaves: LeaveRow[] };
      setLeaves(d.leaves ?? []);
    } catch { /* silent */ }
  }, [user?.phone, filterStatus]);

  const loadHolidays = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/holidays`, { headers: adminHeader });
      const d = await r.json() as { holidays: HolidayRow[] };
      setHolidays(d.holidays ?? []);
    } catch { /* silent */ }
  }, [user?.phone]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadLeaves(), loadHolidays()]);
    setLoading(false);
    setRefreshing(false);
  }, [loadLeaves, loadHolidays]);

  useFocusEffect(useCallback(() => { void loadAll(); }, [loadAll]));

  const onRefresh = () => { setRefreshing(true); void loadAll(); };

  const reviewLeave = async (id: string, action: "approve" | "reject", rejectionReason?: string) => {
    setActioning(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...adminHeader },
        body: JSON.stringify({ action, rejectionReason }),
      });
      const d = await r.json() as { title?: string };
      if (!r.ok) {
        Alert.alert("Error", d.title ?? "Failed to review leave");
        return;
      }
      void loadLeaves();
      setRejectModal(null);
      setRejReason("");
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setActioning(false);
    }
  };

  const addHoliday = async () => {
    if (!hName.trim() || !hDate) {
      Alert.alert("Error", "Name and date are required");
      return;
    }
    setAddingHoliday(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/holidays`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeader },
        body: JSON.stringify({ name: hName.trim(), date: hDate, type: hType, description: hDesc.trim() || undefined }),
      });
      const d = await r.json() as { title?: string };
      if (!r.ok) {
        Alert.alert("Error", d.title ?? "Failed to add holiday");
        return;
      }
      Alert.alert("Success", "Holiday added!");
      setShowAddHoliday(false);
      setHName(""); setHDate(todayISO()); setHType("company"); setHDesc("");
      void loadHolidays();
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setAddingHoliday(false);
    }
  };

  const deleteHoliday = (id: string, name: string) => {
    Alert.alert("Delete Holiday", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await fetch(`${API_BASE}/api/admin/holidays/${id}`, {
              method: "DELETE", headers: adminHeader,
            });
            void loadHolidays();
          } catch { Alert.alert("Error", "Failed to delete"); }
        },
      },
    ]);
  };

  const webTop = Platform.OS === "web" ? 67 : 0;
  const pendingCount = leaves.filter((l) => l.status === "pending").length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={["#1E3A5F", "#0B2545"]}
        style={{
          paddingTop: insets.top + webTop + 16,
          paddingBottom: 16,
          paddingHorizontal: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>
            <View>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" }}>
                Leave & Holidays
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#93C5FD" }}>
                Manage staff leaves and company holidays
              </Text>
            </View>
          </View>
          {tab === "holidays" && (
            <Pressable
              onPress={() => setShowAddHoliday(true)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                backgroundColor: "#3B82F6", borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 7,
              }}
            >
              <Feather name="plus" size={15} color="#fff" />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" }}>Add</Text>
            </Pressable>
          )}
        </View>

        {/* Tab switcher */}
        <View style={{
          flexDirection: "row", marginTop: 14,
          backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: 3,
        }}>
          {(["leaves", "holidays"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 8,
                backgroundColor: tab === t ? "#fff" : "transparent",
                alignItems: "center",
                flexDirection: "row", justifyContent: "center", gap: 5,
              }}
            >
              <Feather
                name={t === "leaves" ? "calendar" : "sun"}
                size={13}
                color={tab === t ? "#1E3A5F" : "#93C5FD"}
              />
              <Text style={{
                fontFamily: "Inter_600SemiBold", fontSize: 13,
                color: tab === t ? "#1E3A5F" : "#93C5FD",
              }}>
                {t === "leaves" ? "Leaves" : "Holidays"}
              </Text>
              {t === "leaves" && pendingCount > 0 && (
                <View style={{
                  backgroundColor: "#DC2626", borderRadius: 999,
                  minWidth: 16, height: 16, alignItems: "center", justifyContent: "center",
                  paddingHorizontal: 3,
                }}>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 9, color: "#fff" }}>
                    {pendingCount}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* Leaves tab */}
      {tab === "leaves" && (
        <>
          {/* Filter */}
          <View style={{ flexDirection: "row", paddingHorizontal: 18, paddingVertical: 10, gap: 8 }}>
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setFilterStatus(s)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
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

          <ScrollView
            contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: insets.bottom + 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : leaves.length === 0 ? (
              <View style={{ alignItems: "center", marginTop: 60, gap: 12 }}>
                <Feather name="check-circle" size={48} color={colors.mutedForeground} />
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: colors.mutedForeground }}>
                  No {filterStatus !== "all" ? filterStatus : ""} leaves
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {leaves.map((leave) => (
                  <View
                    key={leave.id}
                    style={{
                      backgroundColor: colors.card, borderRadius: 14,
                      padding: 14, borderWidth: 1, borderColor: colors.border,
                    }}
                  >
                    {/* Staff info row */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{
                          width: 34, height: 34, borderRadius: 17,
                          backgroundColor: colors.primary + "20",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.primary }}>
                            {leave.staffName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground }}>
                            {leave.staffName}
                          </Text>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}>
                            {leave.staffEmpCode} · {leave.staffPhone}
                          </Text>
                        </View>
                      </View>
                      <View style={{
                        backgroundColor: STATUS_BG[leave.status],
                        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
                        flexDirection: "row", alignItems: "center", gap: 4,
                      }}>
                        <Feather
                          name={leave.status === "approved" ? "check-circle" : leave.status === "rejected" ? "x-circle" : "clock"}
                          size={10}
                          color={STATUS_COLOR[leave.status]}
                        />
                        <Text style={{
                          fontFamily: "Inter_700Bold", fontSize: 10,
                          color: STATUS_COLOR[leave.status], textTransform: "capitalize",
                        }}>
                          {leave.status}
                        </Text>
                      </View>
                    </View>

                    {/* Leave details */}
                    <View style={{
                      flexDirection: "row", gap: 8,
                      paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
                    }}>
                      <View style={{
                        flex: 1, backgroundColor: LEAVE_TYPE_COLOR[leave.leaveType] + "15",
                        borderRadius: 8, padding: 8, alignItems: "center",
                      }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: colors.mutedForeground }}>
                          Type
                        </Text>
                        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: LEAVE_TYPE_COLOR[leave.leaveType] }}>
                          {LEAVE_TYPE_LABEL[leave.leaveType]}
                        </Text>
                      </View>
                      <View style={{
                        flex: 2, backgroundColor: colors.muted,
                        borderRadius: 8, padding: 8,
                      }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: colors.mutedForeground }}>
                          Dates
                        </Text>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.foreground }}>
                          {fmtDate(leave.startDate)}
                          {leave.startDate !== leave.endDate ? ` → ${fmtDate(leave.endDate)}` : ""}
                        </Text>
                      </View>
                      <View style={{
                        flex: 1, backgroundColor: colors.muted,
                        borderRadius: 8, padding: 8, alignItems: "center",
                      }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: colors.mutedForeground }}>
                          Days
                        </Text>
                        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground }}>
                          {leave.totalDays}
                        </Text>
                      </View>
                    </View>

                    {leave.reason ? (
                      <Text style={{
                        fontFamily: "Inter_400Regular", fontSize: 12,
                        color: colors.mutedForeground, marginTop: 8,
                      }}>
                        Reason: {leave.reason}
                      </Text>
                    ) : null}

                    {leave.status === "rejected" && leave.rejectionReason ? (
                      <View style={{ marginTop: 8, backgroundColor: "#FEF2F2", borderRadius: 8, padding: 8 }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#DC2626" }}>
                          Rejection: {leave.rejectionReason}
                        </Text>
                      </View>
                    ) : null}

                    {/* Action buttons for pending */}
                    {leave.status === "pending" && (
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                        <TouchableOpacity
                          onPress={() => reviewLeave(leave.id, "approve")}
                          disabled={actioning}
                          style={{
                            flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                            gap: 6, backgroundColor: "#F0FDF4",
                            borderWidth: 1, borderColor: "#BBF7D0",
                            borderRadius: 10, paddingVertical: 10,
                          }}
                        >
                          <Feather name="check" size={14} color="#16A34A" />
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#16A34A" }}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setRejectModal({ id: leave.id, staffName: leave.staffName })}
                          disabled={actioning}
                          style={{
                            flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                            gap: 6, backgroundColor: "#FEF2F2",
                            borderWidth: 1, borderColor: "#FECACA",
                            borderRadius: 10, paddingVertical: 10,
                          }}
                        >
                          <Feather name="x" size={14} color="#DC2626" />
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#DC2626" }}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </>
      )}

      {/* Holidays tab */}
      {tab === "holidays" && (
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : holidays.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 60, gap: 12 }}>
              <Feather name="sun" size={48} color={colors.mutedForeground} />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: colors.mutedForeground }}>
                No holidays yet
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>
                Tap "Add" to create a holiday for your staff
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {holidays.map((h) => (
                <View
                  key={h.id}
                  style={{
                    backgroundColor: colors.card, borderRadius: 12, padding: 12,
                    borderLeftWidth: 4, borderLeftColor: TYPE_COLOR[h.type],
                    borderWidth: 1, borderColor: colors.border,
                    flexDirection: "row", alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground }}>
                      {h.name}
                    </Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                      {fmtDate(h.date)} · {TYPE_LABEL[h.type]}
                    </Text>
                    {h.description ? (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground, marginTop: 3 }}>
                        {h.description}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteHoliday(h.id, h.name)}
                    style={{ padding: 8 }}
                  >
                    <Feather name="trash-2" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Reject modal */}
      <Modal visible={!!rejectModal} animationType="fade" transparent>
        <View style={{
          flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center", alignItems: "center", padding: 24,
        }}>
          <View style={{
            backgroundColor: colors.card, borderRadius: 16,
            padding: 20, width: "100%", maxWidth: 380,
          }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground, marginBottom: 4 }}>
              Reject Leave
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, marginBottom: 14 }}>
              Rejecting leave for {rejectModal?.staffName}
            </Text>
            <TextInput
              value={rejReason}
              onChangeText={setRejReason}
              placeholder="Reason for rejection (optional)"
              multiline
              numberOfLines={3}
              style={[styles.input, {
                backgroundColor: colors.muted, color: colors.foreground,
                borderColor: colors.border, minHeight: 70, textAlignVertical: "top",
              }]}
              placeholderTextColor={colors.mutedForeground}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => { setRejectModal(null); setRejReason(""); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => rejectModal && reviewLeave(rejectModal.id, "reject", rejReason)}
                disabled={actioning}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 10,
                  backgroundColor: "#DC2626", alignItems: "center",
                  opacity: actioning ? 0.6 : 1,
                }}
              >
                {actioning
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" }}>Reject</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Holiday Modal */}
      <Modal visible={showAddHoliday} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 18, paddingTop: insets.top + 16, paddingBottom: 14,
            borderBottomWidth: 1, borderBottomColor: colors.border,
          }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground }}>
              Add Holiday
            </Text>
            <Pressable onPress={() => setShowAddHoliday(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }} showsVerticalScrollIndicator={false}>
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Holiday Name *</Text>
              <TextInput
                value={hName}
                onChangeText={setHName}
                placeholder="e.g. Republic Day"
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Date *</Text>
              <TextInput
                value={hDate}
                onChangeText={setHDate}
                placeholder="YYYY-MM-DD"
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Type *</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                {(["national", "regional", "company"] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setHType(t)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: hType === t ? TYPE_COLOR[t] : colors.muted,
                      borderWidth: 1,
                      borderColor: hType === t ? TYPE_COLOR[t] : colors.border,
                    }}
                  >
                    <Text style={{
                      fontFamily: "Inter_600SemiBold", fontSize: 11,
                      color: hType === t ? "#fff" : colors.mutedForeground,
                    }}>
                      {TYPE_LABEL[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Description (optional)</Text>
              <TextInput
                value={hDesc}
                onChangeText={setHDesc}
                placeholder="Brief description..."
                multiline
                numberOfLines={2}
                style={[styles.input, {
                  backgroundColor: colors.muted, color: colors.foreground,
                  borderColor: colors.border, minHeight: 60, textAlignVertical: "top",
                }]}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <Pressable
              onPress={addHoliday}
              disabled={addingHoliday}
              style={{
                backgroundColor: colors.primary, borderRadius: 12,
                paddingVertical: 14, alignItems: "center",
                opacity: addingHoliday ? 0.6 : 1, marginTop: 6,
              }}
            >
              {addingHoliday
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" }}>Add Holiday</Text>
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
