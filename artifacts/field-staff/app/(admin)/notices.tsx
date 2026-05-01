import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

const _domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = _domain ? `https://${_domain}` : "";

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffOption = { id: string; name: string; phone: string; empCode: string; area?: string | null };

type NoticeRow = {
  id: string;
  title: string;
  message: string;
  priority: string;
  type: string;
  targetType: string;
  createdAt: string;
  expiresAt: string | null;
  creatorName: string | null;
  totalRecipients: number;
  readCount: number;
};

type TrackDetail = {
  staffId: string;
  staffName: string | null;
  staffPhone: string | null;
  deliveredAt: string;
  readAt: string | null;
  acknowledged: boolean;
};

// ─── Priority & Type maps ─────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#DC2626",
  important: "#D97706",
  normal: "#0B2545",
};

const PRIORITY_BG: Record<string, string> = {
  urgent: "#FEF2F2",
  important: "#FFFBEB",
  normal: "#EFF6FF",
};

const PRIORITY_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  urgent: "alert-octagon",
  important: "alert-triangle",
  normal: "bell",
};

// ─── TrackModal ───────────────────────────────────────────────────────────────

function TrackModal({
  notice,
  onClose,
  adminPhone,
}: {
  notice: NoticeRow;
  onClose: () => void;
  adminPhone: string;
}) {
  const colors = useColors();
  const [recipients, setRecipients] = useState<TrackDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/notices/admin/${notice.id}`, {
      headers: { "x-admin-phone": adminPhone },
    })
      .then((r) => r.json())
      .then((d: { recipients: TrackDetail[] }) => setRecipients(d.recipients ?? []))
      .catch(() => setRecipients([]))
      .finally(() => setLoading(false));
  }, [notice.id]);

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("en-IN", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
        })
      : "—";

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient colors={[colors.primary, "#1E4080"]} style={styles.trackHeader}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.trackHeaderTitle} numberOfLines={1}>{notice.title}</Text>
          <View style={{ width: 30 }} />
        </LinearGradient>

        {/* Summary */}
        <View style={[styles.trackSummary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SummaryPill label="Total" value={notice.totalRecipients} color={colors.primary} />
          <SummaryPill label="Read" value={notice.readCount} color="#059669" />
          <SummaryPill label="Unread" value={notice.totalRecipients - notice.readCount} color="#DC2626" />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {recipients.map((r) => (
              <View key={r.staffId} style={[styles.trackRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.trackDot, { backgroundColor: r.readAt ? "#059669" : "#DC2626" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground, fontSize: 14 }}>
                    {r.staffName ?? "Unknown"}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                    {r.staffPhone}
                  </Text>
                  {r.readAt && (
                    <Text style={{ color: "#059669", fontSize: 11, marginTop: 2 }}>
                      ✓ Read: {fmtDate(r.readAt)}
                    </Text>
                  )}
                  {!r.readAt && (
                    <Text style={{ color: "#DC2626", fontSize: 11, marginTop: 2 }}>
                      ✗ Not read yet
                    </Text>
                  )}
                </View>
              </View>
            ))}
            {recipients.length === 0 && (
              <Text style={{ textAlign: "center", color: colors.mutedForeground, marginTop: 40 }}>
                No recipients found
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color }}>{value}</Text>
      <Text style={{ fontSize: 12, color: "#64748B", fontFamily: "Inter_500Medium" }}>{label}</Text>
    </View>
  );
}

// ─── Notice Card ──────────────────────────────────────────────────────────────

function NoticeCard({
  notice,
  onTrack,
  onDelete,
}: {
  notice: NoticeRow;
  onTrack: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const pColor = PRIORITY_COLOR[notice.priority] ?? colors.primary;
  const pBg    = PRIORITY_BG[notice.priority]    ?? colors.muted;
  const pIcon  = PRIORITY_ICON[notice.priority]  ?? "bell";
  const unread = notice.totalRecipients - notice.readCount;
  const readPct = notice.totalRecipients > 0 ? notice.readCount / notice.totalRecipients : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Priority stripe */}
      <View style={[styles.cardStripe, { backgroundColor: pColor }]} />
      <View style={{ flex: 1, padding: 14 }}>
        <View style={styles.cardRow}>
          <View style={[styles.pBadge, { backgroundColor: pBg }]}>
            <Feather name={pIcon} size={12} color={pColor} />
            <Text style={[styles.pBadgeText, { color: pColor }]}>
              {notice.priority.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.cardType, { color: colors.mutedForeground }]}>
            {notice.type} · {notice.targetType === "all" ? "All Staff" : "Specific"}
          </Text>
        </View>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
          {notice.title}
        </Text>
        <Text style={[styles.cardMessage, { color: colors.mutedForeground }]} numberOfLines={2}>
          {notice.message}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 6 }}>
          {new Date(notice.createdAt).toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: true,
          })}
        </Text>

        {/* Progress bar */}
        <View style={{ marginTop: 10 }}>
          <View style={styles.progressRow}>
            <Text style={{ fontSize: 12, color: "#059669", fontFamily: "Inter_600SemiBold" }}>
              {notice.readCount} read
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              {unread} unread / {notice.totalRecipients} total
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
            <View
              style={[styles.progressFill, { width: `${readPct * 100}%`, backgroundColor: "#059669" }]}
            />
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.cardBtn, { borderColor: colors.border }]} onPress={onTrack}>
            <Feather name="users" size={13} color={colors.primary} />
            <Text style={[styles.cardBtnText, { color: colors.primary }]}>Track</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardBtn, { borderColor: "#FCA5A5" }]}
            onPress={onDelete}
          >
            <Feather name="trash-2" size={13} color="#DC2626" />
            <Text style={[styles.cardBtnText, { color: "#DC2626" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Staff Picker Modal ───────────────────────────────────────────────────────

function StaffPickerModal({
  visible,
  staff,
  selected,
  onToggle,
  onDone,
}: {
  visible: boolean;
  staff: StaffOption[];
  selected: string[];
  onToggle: (id: string) => void;
  onDone: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDone}>
      <View style={[styles.pickerOverlay]}>
        <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
          <View style={styles.pickerHeader}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Select Staff</Text>
            <TouchableOpacity onPress={onDone} style={[styles.pickerDoneBtn, { backgroundColor: colors.primary }]}>
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Done ({selected.length})</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            {staff.map((s) => {
              const checked = selected.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => onToggle(s.id)}
                  style={[styles.staffRow, {
                    backgroundColor: checked ? colors.primary + "12" : colors.background,
                    borderColor: checked ? colors.primary : colors.border,
                  }]}
                >
                  <View style={[styles.checkbox, {
                    backgroundColor: checked ? colors.primary : "transparent",
                    borderColor: checked ? colors.primary : colors.border,
                  }]}>
                    {checked && <Feather name="check" size={12} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{s.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{s.empCode} · {s.phone}</Text>
                  </View>
                </Pressable>
              );
            })}
            {staff.length === 0 && (
              <Text style={{ textAlign: "center", color: colors.mutedForeground, marginTop: 24 }}>
                No staff found
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminNoticesScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useApp();
  const phone   = user?.phone ?? "";

  const [notices, setNotices]   = useState<NoticeRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [trackNotice, setTrack] = useState<NoticeRow | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle]       = useState("");
  const [message, setMessage]   = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [type, setType]         = useState<"notice" | "alert" | "reminder">("notice");
  const [targetType, setTgt]    = useState<"all" | "specific">("all");
  const [selectedStaff, setSel] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [sending, setSending]   = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/notices/admin/list`, {
        headers: { "x-admin-phone": phone },
      });
      const data = (await res.json()) as { notices: NoticeRow[] };
      setNotices(data.notices ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notices/admin/staff-list`, {
        headers: { "x-admin-phone": phone },
      });
      const data = (await res.json()) as { staff: StaffOption[] };
      setStaffList(data.staff ?? []);
    } catch {
      // ignore
    }
  }, [phone]);

  useEffect(() => {
    void fetchNotices();
    void fetchStaff();
  }, [fetchNotices, fetchStaff]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert("Incomplete", "Title aur Message dono bharna zaroori hai.");
      return;
    }
    if (targetType === "specific" && selectedStaff.length === 0) {
      Alert.alert("No Staff Selected", "Specific target ke liye staff select karein.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/notices/admin/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-phone": phone },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          priority,
          type,
          targetType,
          targetStaffIds: targetType === "specific" ? selectedStaff : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { recipientCount: number };
      Alert.alert("Sent! ✓", `Notice ${data.recipientCount} staff ko bhej diya gaya.`);
      setTitle(""); setMessage(""); setPriority("normal"); setType("notice");
      setTgt("all"); setSel([]);
      setShowForm(false);
      void fetchNotices();
    } catch {
      Alert.alert("Error", "Notice send nahi ho saka. Please retry.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Notice", "Kya aap is notice ko delete karna chahte hain?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await fetch(`${API_BASE}/api/notices/admin/${id}`, {
            method: "DELETE",
            headers: { "x-admin-phone": phone },
          });
          void fetchNotices();
        },
      },
    ]);
  };

  const toggleStaff = (id: string) => {
    setSel((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, "#1E4080"]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notice & Alert System</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)} hitSlop={8}>
          <Feather name={showForm ? "chevron-up" : "plus-circle"} size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchNotices} colors={[colors.primary]} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
      >
        {/* Create Form */}
        {showForm && (
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formSectionTitle, { color: colors.foreground }]}>
              📢 New Notice Create करें
            </Text>

            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Notice ka title..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />

            <Text style={styles.fieldLabel}>Message *</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Pura message likhein..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              style={[styles.input, styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />

            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.chipRow}>
              {(["normal", "important", "urgent"] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[styles.chip, {
                    backgroundColor: priority === p ? PRIORITY_COLOR[p] : colors.muted,
                    borderColor: PRIORITY_COLOR[p] ?? colors.border,
                  }]}
                >
                  <Text style={[styles.chipText, { color: priority === p ? "#fff" : PRIORITY_COLOR[p] }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.chipRow}>
              {(["notice", "alert", "reminder"] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[styles.chip, {
                    backgroundColor: type === t ? colors.primary : colors.muted,
                    borderColor: colors.primary,
                  }]}
                >
                  <Text style={[styles.chipText, { color: type === t ? "#fff" : colors.primary }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Target Audience</Text>
            <View style={styles.chipRow}>
              {(["all", "specific"] as const).map((tgt) => (
                <Pressable
                  key={tgt}
                  onPress={() => setTgt(tgt)}
                  style={[styles.chip, {
                    backgroundColor: targetType === tgt ? colors.primary : colors.muted,
                    borderColor: colors.primary,
                  }]}
                >
                  <Text style={[styles.chipText, { color: targetType === tgt ? "#fff" : colors.primary }]}>
                    {tgt === "all" ? "All Staff" : "Specific Staff"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {targetType === "specific" && (
              <TouchableOpacity
                onPress={() => setShowPicker(true)}
                style={[styles.staffPickerBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
              >
                <Feather name="users" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
                  {selectedStaff.length === 0
                    ? "Staff Select करें"
                    : `${selectedStaff.length} staff selected`}
                </Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleSend}
              disabled={sending}
              style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: sending ? 0.6 : 1 }]}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="send" size={16} color="#fff" />
                  <Text style={styles.sendBtnText}>Send Notice</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Notices list */}
        <Text style={[styles.sectionHead, { color: colors.mutedForeground }]}>
          Sent Notices ({notices.length})
        </Text>
        {loading && notices.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : notices.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="bell-off" size={32} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_500Medium" }}>
              Koi notice nahi bheja gaya abhi tak
            </Text>
          </View>
        ) : (
          notices.map((n) => (
            <NoticeCard
              key={n.id}
              notice={n}
              onTrack={() => setTrack(n)}
              onDelete={() => handleDelete(n.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Track Modal */}
      {trackNotice && (
        <TrackModal
          notice={trackNotice}
          onClose={() => setTrack(null)}
          adminPhone={phone}
        />
      )}

      {/* Staff Picker */}
      <StaffPickerModal
        visible={showPicker}
        staff={staffList}
        selected={selectedStaff}
        onToggle={toggleStaff}
        onDone={() => setShowPicker(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  formSectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#64748B",
    marginBottom: 6,
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  textarea: {
    height: 100,
    textAlignVertical: "top",
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  staffPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 12,
    height: 50,
    marginTop: 20,
  },
  sendBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHead: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    overflow: "hidden",
  },
  cardStripe: {
    width: 5,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  pBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  cardType: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
  },
  cardMessage: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginTop: 4,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressBar: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  cardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cardBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  emptyBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 40,
    alignItems: "center",
    marginTop: 12,
  },
  trackHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  trackHeaderTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  trackSummary: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  trackDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  pickerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  pickerDoneBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  staffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
