import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

const _domain =
  process.env.EXPO_PUBLIC_DOMAIN ||
  "field-force-manager-Mobilization.replit.app";
const API_BASE = Platform.OS === "web" ? "" : `https://${_domain}`;

type Center = {
  id: string;
  companyId: string;
  name: string;
  tcId: string | null;
  courses: string[];
  state: string | null;
  district: string | null;
  block: string | null;
  pinCode: string | null;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  createdAt: string | null;
};

type CenterForm = {
  name: string;
  tcId: string;
  state: string;
  district: string;
  block: string;
  pinCode: string;
  courses: string;
};

const BLANK_FORM: CenterForm = {
  name: "",
  tcId: "",
  state: "",
  district: "",
  block: "",
  pinCode: "",
  courses: "",
};

function adminFetch(path: string, phone: string, opts: RequestInit = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-admin-phone": phone,
      ...(opts.headers ?? {}),
    },
  });
}

export default function CentersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();

  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Center | null>(null);
  const [form, setForm] = useState<CenterForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  const companyId = user?.companyId ?? null;
  const phone = user?.phone ?? "";

  const loadCenters = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    try {
      const res = await adminFetch(`/api/companies/${companyId}/centers`, phone);
      if (res.ok) setCenters(await res.json());
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, phone]);

  useEffect(() => { loadCenters(); }, [loadCenters]);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK_FORM);
    setShowModal(true);
  };

  const openEdit = (c: Center) => {
    setEditing(c);
    setForm({
      name: c.name,
      tcId: c.tcId ?? "",
      state: c.state ?? "",
      district: c.district ?? "",
      block: c.block ?? "",
      pinCode: c.pinCode ?? "",
      courses: c.courses.join(", "),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !companyId) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        tcId: form.tcId.trim() || null,
        state: form.state.trim() || null,
        district: form.district.trim() || null,
        block: form.block.trim() || null,
        pinCode: form.pinCode.trim() || null,
        courses: form.courses
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      };

      let res: Response;
      if (editing) {
        res = await adminFetch(
          `/api/companies/${companyId}/centers/${editing.id}`,
          phone,
          { method: "PATCH", body: JSON.stringify(body) },
        );
      } else {
        res = await adminFetch(
          `/api/companies/${companyId}/centers`,
          phone,
          { method: "POST", body: JSON.stringify(body) },
        );
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).title || "Save failed");
      }

      setShowModal(false);
      await loadCenters();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (c: Center) => {
    Alert.alert(
      "Center Delete Karein?",
      `"${c.name}" ko hamesha ke liye delete kar diya jayega.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await adminFetch(
                `/api/companies/${companyId}/centers/${c.id}`,
                phone,
                { method: "DELETE" },
              );
              await loadCenters();
            } catch {
              Alert.alert("Error", "Delete nahi ho paya");
            }
          },
        },
      ],
    );
  };

  const webTop = Platform.OS === "web" ? 67 : 0;

  if (!companyId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular" }}>
          Company linked nahi hai
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16 + webTop,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadCenters(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: -0.4 }}>
              Training Centers
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>
              {centers.length} center{centers.length !== 1 ? "s" : ""} registered
            </Text>
          </View>
          <Pressable
            onPress={openCreate}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: colors.primary,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              Add Center
            </Text>
          </Pressable>
        </View>

        {/* Loading */}
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : centers.length === 0 ? (
          <View
            style={{
              paddingVertical: 48,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              borderStyle: "dashed",
            }}
          >
            <Feather name="home" size={32} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
              Koi center nahi mila
            </Text>
            <Text style={{ color: colors.mutedForeground, marginTop: 4, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              Pehla training center add karein
            </Text>
            <Pressable
              onPress={openCreate}
              style={({ pressed }) => ({
                marginTop: 16,
                backgroundColor: colors.primary,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 8,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>+ Center Add Karein</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {centers.map((c) => (
              <View
                key={c.id}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                  padding: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: colors.foreground }}>
                      {c.name}
                    </Text>
                    {c.tcId ? (
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: colors.primary, marginTop: 2 }}>
                        TC ID: {c.tcId}
                      </Text>
                    ) : null}
                    {(c.district || c.state) ? (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 4 }}>
                        <Feather name="map-pin" size={11} color={colors.mutedForeground} />{" "}
                        {[c.block, c.district, c.state].filter(Boolean).join(", ")}
                      </Text>
                    ) : null}
                    {c.courses.length > 0 ? (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 4 }}>
                        <Feather name="book-open" size={11} color={colors.mutedForeground} />{" "}
                        {c.courses.join(", ")}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => openEdit(c)}
                      style={({ pressed }) => ({
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        backgroundColor: colors.primary + "14",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Feather name="edit-2" size={15} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(c)}
                      style={({ pressed }) => ({
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        backgroundColor: "#FEE2E2",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Feather name="trash-2" size={15} color="#DC2626" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: insets.bottom + 16,
                maxHeight: "90%",
              }}
            >
              {/* Modal Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 20,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground }}>
                  {editing ? "Center Edit Karein" : "Naya Center Add Karein"}
                </Text>
                <Pressable onPress={() => setShowModal(false)} hitSlop={10}>
                  <Feather name="x" size={22} color={colors.foreground} />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={{ padding: 20, gap: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                <FormField
                  label="CENTER KA NAAM *"
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="e.g. Ranchi Training Center"
                  colors={colors}
                />
                <FormField
                  label="TC ID (optional)"
                  value={form.tcId}
                  onChangeText={(v) => setForm((f) => ({ ...f, tcId: v }))}
                  placeholder="e.g. JH-TC-001"
                  colors={colors}
                  autoCapitalize="characters"
                />
                <FormField
                  label="STATE"
                  value={form.state}
                  onChangeText={(v) => setForm((f) => ({ ...f, state: v }))}
                  placeholder="e.g. Jharkhand"
                  colors={colors}
                />
                <FormField
                  label="DISTRICT"
                  value={form.district}
                  onChangeText={(v) => setForm((f) => ({ ...f, district: v }))}
                  placeholder="e.g. Ranchi"
                  colors={colors}
                />
                <FormField
                  label="BLOCK (optional)"
                  value={form.block}
                  onChangeText={(v) => setForm((f) => ({ ...f, block: v }))}
                  placeholder="e.g. Namkum"
                  colors={colors}
                />
                <FormField
                  label="PIN CODE (optional)"
                  value={form.pinCode}
                  onChangeText={(v) => setForm((f) => ({ ...f, pinCode: v.replace(/\D/g, "").slice(0, 6) }))}
                  placeholder="e.g. 834001"
                  colors={colors}
                  keyboardType="number-pad"
                />
                <FormField
                  label="COURSES / TRADES (comma se alag karein)"
                  value={form.courses}
                  onChangeText={(v) => setForm((f) => ({ ...f, courses: v }))}
                  placeholder="e.g. Electrician, Welder, IT"
                  colors={colors}
                />

                <Pressable
                  onPress={handleSave}
                  disabled={saving || !form.name.trim()}
                  style={({ pressed }) => ({
                    backgroundColor: colors.primary,
                    borderRadius: 10,
                    paddingVertical: 14,
                    alignItems: "center",
                    marginTop: 8,
                    opacity: pressed || saving || !form.name.trim() ? 0.6 : 1,
                  })}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                      {editing ? "Changes Save Karein" : "Center Create Karein"}
                    </Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  autoCapitalize = "words",
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  colors: ReturnType<typeof useColors>;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "number-pad" | "email-address";
}) {
  return (
    <View>
      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.6, marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={{
          height: 48,
          paddingHorizontal: 14,
          fontSize: 15,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: 8,
          backgroundColor: colors.background,
          color: colors.foreground,
          fontFamily: "Inter_400Regular",
        }}
      />
    </View>
  );
}
