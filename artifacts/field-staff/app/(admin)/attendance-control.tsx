import { Feather } from "@expo/vector-icons";
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

type ShiftSettings = {
  fieldShiftStart: string;
  fieldShiftEnd: string;
  centerShiftStart: string;
  centerShiftEnd: string;
  lateGraceMinutes: number;
};

type StaffRow = {
  id: string;
  name: string;
  empCode: string;
  phone: string;
  staffCategory: string | null;
};

type CorrectionRow = {
  id: string;
  staffId: string;
  date: string;
  originalCheckin: string | null;
  originalCheckout: string | null;
  correctedCheckin: string | null;
  correctedCheckout: string | null;
  reason: string;
  createdAt: string;
};

function isHHMM(v: string): boolean {
  return /^\d{2}:\d{2}$/.test(v);
}

// ─── Time input component ─────────────────────────────────────────────────────

function TimeInput({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const valid = isHHMM(value);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 4 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        style={{
          borderWidth: 1,
          borderColor: valid ? colors.border : "#DC2626",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 9,
          fontSize: 15,
          fontFamily: "Inter_600SemiBold",
          color: colors.foreground,
          backgroundColor: colors.background,
          textAlign: "center",
        }}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AttendanceControlScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const [tab, setTab] = useState<"settings" | "corrections">("settings");

  // ── Shift Settings state ──────────────────────────────────────────────────
  const [settings, setSettings] = useState<ShiftSettings>({
    fieldShiftStart: "09:00",
    fieldShiftEnd: "18:00",
    centerShiftStart: "09:00",
    centerShiftEnd: "18:00",
    lateGraceMinutes: 15,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsEdited, setSettingsEdited] = useState(false);

  // ── Corrections state ─────────────────────────────────────────────────────
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [corrLoading, setCorrLoading] = useState(false);
  const [filterStaffId, setFilterStaffId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [showCorrModal, setShowCorrModal] = useState(false);

  // Correction form
  const [corrStaffId, setCorrStaffId] = useState("");
  const [corrDate, setCorrDate] = useState(new Date().toISOString().slice(0, 10));
  const [corrCheckin, setCorrCheckin] = useState("");
  const [corrCheckout, setCorrCheckout] = useState("");
  const [corrReason, setCorrReason] = useState("");
  const [corrSubmitting, setCorrSubmitting] = useState(false);
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");

  const adminPhone = user?.phone ?? "";

  // ── Load settings ─────────────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/attendance-settings`, {
        headers: { "x-admin-phone": adminPhone },
      });
      if (resp.ok) {
        const data = await resp.json() as ShiftSettings;
        setSettings(data);
        setSettingsEdited(false);
      }
    } catch { /* silent */ }
    finally { setSettingsLoading(false); }
  }, [adminPhone]);

  // ── Load corrections ──────────────────────────────────────────────────────
  const loadCorrections = useCallback(async () => {
    setCorrLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStaffId) params.set("staffId", filterStaffId);
      if (filterDate)    params.set("date", filterDate);
      const resp = await fetch(`${API_BASE}/api/admin/attendance/corrections?${params}`, {
        headers: { "x-admin-phone": adminPhone },
      });
      if (resp.ok) setCorrections(await resp.json());
    } catch { /* silent */ }
    finally { setCorrLoading(false); }
  }, [adminPhone, filterStaffId, filterDate]);

  // ── Load staff list ───────────────────────────────────────────────────────
  const loadStaff = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/admin/staff?limit=200&approvalStatus=approved`, {
        headers: { "x-admin-phone": adminPhone },
      });
      if (resp.ok) {
        const data = await resp.json() as { staff: StaffRow[] };
        setStaffList(data.staff ?? []);
      }
    } catch { /* silent */ }
  }, [adminPhone]);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
      void loadStaff();
      void loadCorrections();
    }, [loadSettings, loadStaff, loadCorrections]),
  );

  React.useEffect(() => {
    void loadCorrections();
  }, [loadCorrections]);

  // ── Save settings ─────────────────────────────────────────────────────────
  async function saveSettings() {
    const fields = [settings.fieldShiftStart, settings.fieldShiftEnd, settings.centerShiftStart, settings.centerShiftEnd];
    if (fields.some((f) => !isHHMM(f))) {
      Alert.alert("Validation", "All times must be in HH:MM format (e.g. 09:00).");
      return;
    }
    if (settings.lateGraceMinutes < 0 || settings.lateGraceMinutes > 120) {
      Alert.alert("Validation", "Grace period must be 0–120 minutes.");
      return;
    }
    setSettingsSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/attendance-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-phone": adminPhone },
        body: JSON.stringify(settings),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setSettingsEdited(false);
      Alert.alert("Saved", "Attendance settings updated successfully.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save settings.");
    } finally { setSettingsSaving(false); }
  }

  function updateSetting<K extends keyof ShiftSettings>(key: K, value: ShiftSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSettingsEdited(true);
  }

  // ── Submit correction ─────────────────────────────────────────────────────
  async function submitCorrection() {
    if (!corrStaffId) { Alert.alert("Validation", "Please select a staff member."); return; }
    if (!corrDate || !/^\d{4}-\d{2}-\d{2}$/.test(corrDate)) { Alert.alert("Validation", "Date must be YYYY-MM-DD."); return; }
    if (!corrReason.trim()) { Alert.alert("Validation", "Reason is required."); return; }
    if (corrCheckin && !isHHMM(corrCheckin)) { Alert.alert("Validation", "Check-in time must be HH:MM."); return; }
    if (corrCheckout && !isHHMM(corrCheckout)) { Alert.alert("Validation", "Check-out time must be HH:MM."); return; }
    if (!corrCheckin && !corrCheckout) { Alert.alert("Validation", "Provide at least one corrected time."); return; }

    setCorrSubmitting(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/attendance/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-phone": adminPhone },
        body: JSON.stringify({
          staffId: corrStaffId,
          date: corrDate,
          correctedCheckin: corrCheckin || null,
          correctedCheckout: corrCheckout || null,
          reason: corrReason.trim(),
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as { title?: string };
        throw new Error(err.title || `HTTP ${resp.status}`);
      }
      setShowCorrModal(false);
      setCorrStaffId(""); setCorrDate(new Date().toISOString().slice(0, 10));
      setCorrCheckin(""); setCorrCheckout(""); setCorrReason("");
      void loadCorrections();
      Alert.alert("Done", "Attendance correction recorded successfully.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not submit correction.");
    } finally { setCorrSubmitting(false); }
  }

  const filteredStaff = staffList.filter((s) =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.empCode.toLowerCase().includes(staffSearch.toLowerCase()),
  );

  const selectedStaff = staffList.find((s) => s.id === corrStaffId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 14 + webTop,
          paddingHorizontal: 20,
          paddingBottom: 14,
          backgroundColor: "#1E293B",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <View>
            <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.3 }}>
              Attendance Control
            </Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              Shift timings · Late marks · Manual corrections
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["settings", "corrections"] as const).map((t) => {
            const active = tab === t;
            const labels = { settings: "Shift Settings", corrections: "Corrections" };
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7,
                  backgroundColor: active ? "#fff" : "rgba(255,255,255,0.12)",
                  borderRadius: 20,
                }}
              >
                <Text style={{
                  fontSize: 13, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                  color: active ? "#1E293B" : "rgba(255,255,255,0.8)",
                }}>
                  {labels[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── TAB: Settings ─────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 80 }}>
          {settingsLoading ? (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              {/* Field Staff Shift */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <View style={{ backgroundColor: "#4F46E522", borderRadius: 8, padding: 6 }}>
                    <Feather name="truck" size={14} color="#4F46E5" />
                  </View>
                  <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                    Field Staff Shift
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TimeInput
                    label="Start Time"
                    value={settings.fieldShiftStart}
                    onChange={(v) => updateSetting("fieldShiftStart", v)}
                    colors={colors}
                  />
                  <TimeInput
                    label="End Time"
                    value={settings.fieldShiftEnd}
                    onChange={(v) => updateSetting("fieldShiftEnd", v)}
                    colors={colors}
                  />
                </View>
              </View>

              {/* Center Staff Shift */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <View style={{ backgroundColor: "#06966622", borderRadius: 8, padding: 6 }}>
                    <Feather name="home" size={14} color="#059669" />
                  </View>
                  <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                    Center Staff Shift
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TimeInput
                    label="Start Time"
                    value={settings.centerShiftStart}
                    onChange={(v) => updateSetting("centerShiftStart", v)}
                    colors={colors}
                  />
                  <TimeInput
                    label="End Time"
                    value={settings.centerShiftEnd}
                    onChange={(v) => updateSetting("centerShiftEnd", v)}
                    colors={colors}
                  />
                </View>
              </View>

              {/* Late Mark Rule */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <View style={{ backgroundColor: "#D9770622", borderRadius: 8, padding: 6 }}>
                    <Feather name="clock" size={14} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                      Late Mark Rule
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
                      Check-in after shift start + grace = marked Late
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>Grace period:</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => updateSetting("lateGraceMinutes", Math.max(0, settings.lateGraceMinutes - 5))}
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
                    >
                      <Feather name="minus" size={16} color={colors.foreground} />
                    </TouchableOpacity>
                    <TextInput
                      value={String(settings.lateGraceMinutes)}
                      onChangeText={(v) => {
                        const n = parseInt(v, 10);
                        if (!isNaN(n) && n >= 0 && n <= 120) updateSetting("lateGraceMinutes", n);
                      }}
                      keyboardType="numeric"
                      maxLength={3}
                      style={{
                        width: 56, textAlign: "center",
                        borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                        paddingVertical: 8,
                        fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground,
                        backgroundColor: colors.background,
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => updateSetting("lateGraceMinutes", Math.min(120, settings.lateGraceMinutes + 5))}
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
                    >
                      <Feather name="plus" size={16} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>min</Text>
                </View>

                {/* Preview */}
                <View style={{ marginTop: 14, backgroundColor: "#FEF3C7", borderRadius: 8, padding: 12 }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#92400E" }}>
                    Field: Check-in after {(() => {
                      const [h, m] = settings.fieldShiftStart.split(":").map(Number);
                      const total = (h ?? 9) * 60 + (m ?? 0) + settings.lateGraceMinutes;
                      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                    })()} = Late
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#92400E", marginTop: 4 }}>
                    Center: Check-in after {(() => {
                      const [h, m] = settings.centerShiftStart.split(":").map(Number);
                      const total = (h ?? 9) * 60 + (m ?? 0) + settings.lateGraceMinutes;
                      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                    })()} = Late
                  </Text>
                </View>
              </View>

              {/* Save button */}
              <Pressable
                onPress={saveSettings}
                disabled={settingsSaving || !settingsEdited}
                style={({ pressed }) => ({
                  backgroundColor: settingsEdited ? "#4F46E5" : colors.muted,
                  borderRadius: 10, padding: 14, alignItems: "center",
                  flexDirection: "row", justifyContent: "center", gap: 8,
                  marginTop: 4, opacity: pressed ? 0.8 : 1,
                })}
              >
                {settingsSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="save" size={18} color={settingsEdited ? "#fff" : colors.mutedForeground} />
                )}
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: settingsEdited ? "#fff" : colors.mutedForeground }}>
                  {settingsSaving ? "Saving…" : "Save Settings"}
                </Text>
              </Pressable>

              {!settingsEdited && (
                <Text style={{ textAlign: "center", marginTop: 8, fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                  Make changes above to enable save
                </Text>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── TAB: Corrections ──────────────────────────────────────────────── */}
      {tab === "corrections" && (
        <>
          {/* Filter bar */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Pressable
                onPress={() => setShowStaffPicker(true)}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.background }}
              >
                <Feather name="user" size={13} color={colors.mutedForeground} />
                <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: filterStaffId ? colors.foreground : colors.mutedForeground }} numberOfLines={1}>
                  {filterStaffId ? (staffList.find((s) => s.id === filterStaffId)?.name ?? "Staff") : "All staff"}
                </Text>
                {filterStaffId && (
                  <Pressable onPress={() => setFilterStaffId(null)} hitSlop={8}>
                    <Feather name="x" size={12} color={colors.mutedForeground} />
                  </Pressable>
                )}
              </Pressable>
              <TextInput
                value={filterDate}
                onChangeText={setFilterDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={{
                  width: 115, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 8,
                  fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground,
                  backgroundColor: colors.background,
                }}
              />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
            refreshControl={<RefreshControl refreshing={corrLoading} onRefresh={loadCorrections} />}
          >
            {corrLoading && corrections.length === 0 && (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}

            {!corrLoading && corrections.length === 0 && (
              <View style={{ paddingVertical: 40, alignItems: "center", gap: 8 }}>
                <Feather name="edit-2" size={28} color={colors.mutedForeground} />
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                  No corrections recorded
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>
                  Tap + to add a manual attendance correction
                </Text>
              </View>
            )}

            {corrections.map((c) => {
              const staff = staffList.find((s) => s.id === c.staffId);
              return (
                <View
                  key={c.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: "#6366F130" }]}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                        {staff?.name ?? "Unknown Staff"}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                        {staff?.empCode} · {c.date}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: "#6366F115", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#6366F1" }}>CORRECTED</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                    <View style={{ flex: 1, backgroundColor: colors.muted, borderRadius: 8, padding: 8 }}>
                      <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>ORIGINAL</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginTop: 2 }}>
                        In: {c.originalCheckin ?? "—"}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginTop: 1 }}>
                        Out: {c.originalCheckout ?? "—"}
                      </Text>
                    </View>
                    <View style={{ alignSelf: "center" }}>
                      <Feather name="arrow-right" size={16} color="#6366F1" />
                    </View>
                    <View style={{ flex: 1, backgroundColor: "#EDE9FE", borderRadius: 8, padding: 8 }}>
                      <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: "#6366F1" }}>CORRECTED</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#4F46E5", marginTop: 2 }}>
                        In: {c.correctedCheckin ?? "—"}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#4F46E5", marginTop: 1 }}>
                        Out: {c.correctedCheckout ?? "—"}
                      </Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: "#FFFBEB", borderRadius: 6, padding: 8 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#92400E" }}>
                      Reason: {c.reason}
                    </Text>
                  </View>

                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 6 }}>
                    {new Date(c.createdAt).toLocaleString("en-IN")}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          {/* FAB */}
          <Pressable
            onPress={() => setShowCorrModal(true)}
            style={({ pressed }) => ({
              position: "absolute",
              bottom: insets.bottom + 24,
              right: 20,
              width: 56, height: 56,
              borderRadius: 28,
              backgroundColor: "#6366F1",
              alignItems: "center", justifyContent: "center",
              shadowColor: "#6366F1", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
              elevation: 8, opacity: pressed ? 0.85 : 1,
            })}
          >
            <Feather name="plus" size={24} color="#fff" />
          </Pressable>
        </>
      )}

      {/* ── Add Correction Modal ──────────────────────────────────────────── */}
      <Modal visible={showCorrModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCorrModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Modal header */}
          <View style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>
              Add Manual Correction
            </Text>
            <Pressable onPress={() => setShowCorrModal(false)} hitSlop={8}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* Staff picker */}
            <View>
              <Text style={styles.fieldLabel}>Staff Member *</Text>
              <Pressable
                onPress={() => setShowStaffPicker(true)}
                style={{ borderWidth: 1, borderColor: corrStaffId ? colors.border : "#DC2626", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.background }}
              >
                <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: corrStaffId ? colors.foreground : colors.mutedForeground }}>
                  {corrStaffId ? `${selectedStaff?.name ?? "—"} (${selectedStaff?.empCode ?? ""})` : "Select staff member"}
                </Text>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Date */}
            <View>
              <Text style={styles.fieldLabel}>Date (YYYY-MM-DD) *</Text>
              <TextInput
                value={corrDate}
                onChangeText={setCorrDate}
                placeholder="2024-01-15"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={[styles.input, { color: colors.foreground, borderColor: /^\d{4}-\d{2}-\d{2}$/.test(corrDate) ? colors.border : "#DC2626", backgroundColor: colors.background }]}
              />
            </View>

            {/* Times */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Corrected Check-In (HH:MM)</Text>
                <TextInput
                  value={corrCheckin}
                  onChangeText={setCorrCheckin}
                  placeholder="09:15"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, textAlign: "center" }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Corrected Check-Out (HH:MM)</Text>
                <TextInput
                  value={corrCheckout}
                  onChangeText={setCorrCheckout}
                  placeholder="18:30"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, textAlign: "center" }]}
                />
              </View>
            </View>

            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: -8 }}>
              Leave blank to keep original. Provide at least one.
            </Text>

            {/* Reason */}
            <View>
              <Text style={styles.fieldLabel}>Reason for Correction *</Text>
              <TextInput
                value={corrReason}
                onChangeText={setCorrReason}
                placeholder="e.g. Network issue, device problem, biometric failure"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                style={[styles.input, { color: colors.foreground, borderColor: corrReason.trim() ? colors.border : "#DC2626", backgroundColor: colors.background, minHeight: 80, textAlignVertical: "top", paddingTop: 10 }]}
              />
            </View>

            {/* Submit */}
            <Pressable
              onPress={submitCorrection}
              disabled={corrSubmitting}
              style={({ pressed }) => ({
                backgroundColor: "#6366F1", borderRadius: 10, padding: 14,
                alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8,
                marginTop: 8, opacity: pressed || corrSubmitting ? 0.75 : 1,
              })}
            >
              {corrSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="check" size={18} color="#fff" />}
              <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" }}>
                {corrSubmitting ? "Submitting…" : "Submit Correction"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Staff Picker Modal ────────────────────────────────────────────── */}
      <Modal visible={showStaffPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowStaffPicker(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>Select Staff</Text>
            <Pressable onPress={() => setShowStaffPicker(false)} hitSlop={8}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.background }}>
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput
                value={staffSearch}
                onChangeText={setStaffSearch}
                placeholder="Search by name or code…"
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground, paddingVertical: 0 }}
                autoFocus
              />
            </View>
          </View>

          {/* All staff option */}
          <Pressable
            onPress={() => { setFilterStaffId(null); setShowStaffPicker(false); }}
            style={({ pressed }) => ({ paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primary }}>All Staff</Text>
          </Pressable>

          <ScrollView>
            {filteredStaff.map((s) => {
              const isSelected = tab === "corrections" ? corrStaffId === s.id : filterStaffId === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    if (showCorrModal) setCorrStaffId(s.id);
                    else setFilterStaffId(s.id);
                    setShowStaffPicker(false);
                    setStaffSearch("");
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 18, paddingVertical: 14,
                    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
                    backgroundColor: isSelected ? colors.primary + "15" : colors.background,
                    opacity: pressed ? 0.7 : 1,
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  })}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{s.name}</Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
                      {s.empCode} · {s.staffCategory === "center" ? "Center" : "Field"}
                    </Text>
                  </View>
                  {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
