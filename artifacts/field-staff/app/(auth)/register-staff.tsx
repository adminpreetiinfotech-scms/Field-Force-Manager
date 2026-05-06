import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

// ── Scheme / Project options ──────────────────────────────────────────────────
const SCHEME_OPTIONS = [
  "DDU-GKY",
  "JSDMS",
  "PMKVY 3.0",
  "PMKVY STT",
  "ASDMS",
  "RSLDC",
  "MSDE",
  "State Scheme",
  "Other",
];

// ── Role lists ───────────────────────────────────────────────────────────────
const ACADEMIC_ROLES = [
  "Center Head",
  "MIS Executive",
  "Placement Incharge",
  "Trainer",
  "IT Trainer",
  "Soft Skills Trainer",
  "Receptionist",
  "Counselor",
  "Tele Caller",
  "Hostel Warden Male",
  "Hostel Warden Female",
];

const GROUND_ROLES = [
  "Office Boy",
  "Security Guard (Day)",
  "Security Guard (Night)",
  "Head Cook",
  "Assistant Cook",
  "Cook Helper",
  "Care Taker",
  "Sweeper",
  "Toilet Cleaner",
  "Other Staff",
];

const TRAINER_ROLES = ["Trainer"];

interface Center {
  id: string;
  name: string;
  tcId: string | null;
  state: string | null;
  district: string | null;
  block: string | null;
  courses: string[];
}

interface CenterSearchResult {
  id: string;
  name: string;
  tcId: string | null;
  state: string | null;
  district: string | null;
  block: string | null;
  companyId: string;
  companyName: string;
  projectName: string | null;
  courses: string[];
}

const API_BASE =
  Platform.OS === "web"
    ? ""
    : `https://${process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app"}`;

async function searchCenters(q: string): Promise<CenterSearchResult[]> {
  try {
    const res = await fetch(`${API_BASE}/api/centers/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function fetchCentersByAdminCode(code: string): Promise<Center[]> {
  try {
    const res = await fetch(`${API_BASE}/api/centers?adminCode=${encodeURIComponent(code)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default function RegisterStaffScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useApp();

  // Personal details
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Staff category: field staff or center staff
  const [staffCategory, setStaffCategory] = useState<"field" | "center">("field");
  // Center staff sub-category
  const [staffCategoryGroup, setStaffCategoryGroup] = useState<"academic" | "ground" | null>(null);
  const [centerStaffRole, setCenterStaffRole] = useState("");
  const [designation, setDesignation] = useState("");
  const [showRolePicker, setShowRolePicker] = useState(false);

  // Organization fields
  const [centerName, setCenterName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [state, setState_] = useState("");
  const [district, setDistrict] = useState("");
  const [block, setBlock] = useState("");
  const [staffPinCode, setStaffPinCode] = useState("");

  // Center modal picker (primary flow)
  const [allCenters, setAllCenters] = useState<CenterSearchResult[]>([]);
  const [allCentersLoading, setAllCentersLoading] = useState(false);
  const [selectedCenterResult, setSelectedCenterResult] = useState<CenterSearchResult | null>(null);
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  // Course picker
  const [trainerCourse, setTrainerCourse] = useState("");
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseModalSearch, setCourseModalSearch] = useState("");

  // Admin code (fallback)
  const [adminCode, setAdminCode] = useState("");
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [centersLoading, setCentersLoading] = useState(false);
  const [showCenterPicker, setShowCenterPicker] = useState(false);
  const [centersLoaded, setCentersLoaded] = useState(false);

  const [loading, setLoading] = useState(false);

  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const designationRef = useRef<TextInput>(null);
  const centerRef = useRef<TextInput>(null);
  const stateRef = useRef<TextInput>(null);
  const districtRef = useRef<TextInput>(null);
  const blockRef = useRef<TextInput>(null);
  const pinCodeRef = useRef<TextInput>(null);
  const adminCodeRef = useRef<TextInput>(null);

  // ── Load all centers on mount ─────────────────────────────────────────────
  useEffect(() => {
    setAllCentersLoading(true);
    searchCenters("").then((data) => {
      setAllCenters(data);
      setAllCentersLoading(false);
    });
  }, []);

  const filteredModalCenters = allCenters.filter((c) => {
    const q = modalSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.companyName?.toLowerCase() ?? "").includes(q) ||
      (c.district?.toLowerCase() ?? "").includes(q) ||
      (c.state?.toLowerCase() ?? "").includes(q)
    );
  });

  const selectCenterResult = (c: CenterSearchResult) => {
    setSelectedCenterResult(c);
    setShowCenterModal(false);
    setModalSearchQuery("");
    setCenterName(c.name);
    if (c.state) setState_(c.state);
    if (c.district) setDistrict(c.district);
    if (c.block) setBlock(c.block);
    if (c.projectName && !projectName) setProjectName(c.projectName);
  };

  const clearCenterResult = () => {
    setSelectedCenterResult(null);
    setCenterName("");
    setState_("");
    setDistrict("");
    setBlock("");
    setTrainerCourse("");
  };

  // ── Fetch centers when admin code is 6 chars ─────────────────────────────
  useEffect(() => {
    if (selectedCenterResult) return;
    const code = adminCode.trim().toUpperCase();
    if (code.length !== 6) {
      if (centersLoaded) {
        setCenters([]);
        setCenterId(null);
        setCentersLoaded(false);
      }
      return;
    }
    let cancelled = false;
    setCentersLoading(true);
    fetchCentersByAdminCode(code).then((data) => {
      if (cancelled) return;
      setCenters(data);
      setCentersLoaded(true);
      setCentersLoading(false);
      setCenterId(null);
    });
    return () => { cancelled = true; };
  }, [adminCode, selectedCenterResult]);

  const selectedTcId = selectedCenterResult?.tcId
    ?? centers.find((c) => c.id === centerId)?.tcId
    ?? null;

  const isValidEmail = (e: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  // Center staff: need a role (from picker) or designation
  const centerRoleValid =
    staffCategory === "field" ||
    (staffCategory === "center" && staffCategoryGroup !== null && centerStaffRole.trim().length >= 2);

  const valid =
    name.trim().length >= 2 &&
    phone.replace(/\D/g, "").length === 10 &&
    (email.trim() === "" || isValidEmail(email)) &&
    centerName.trim().length >= 2 &&
    projectName.trim().length >= 2 &&
    state.trim().length >= 2 &&
    district.trim().length >= 2 &&
    centerRoleValid;

  // ── Which role list to show based on sub-category ─────────────────────────
  const activeRoles =
    staffCategoryGroup === "academic"
      ? ACADEMIC_ROLES
      : staffCategoryGroup === "ground"
      ? GROUND_ROLES
      : [];

  const onRegister = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      await register({
        kind: "staff",
        name: name.trim(),
        phone: phone.replace(/\D/g, ""),
        email: email.trim() || undefined,
        centerName: centerName.trim(),
        projectName: projectName.trim(),
        state: state.trim(),
        district: district.trim(),
        adminCode: adminCode.trim().toUpperCase() || undefined,
        staffCategory,
        centerStaffRole: staffCategory === "center" ? centerStaffRole.trim() : undefined,
        staffCategoryGroup: staffCategory === "center" ? (staffCategoryGroup ?? undefined) : undefined,
        designation: designation.trim() || undefined,
        block: block.trim() || undefined,
        staffPinCode: staffPinCode.trim() || undefined,
        centerId: selectedCenterResult?.id ?? centerId ?? undefined,
        trainerCourse: staffCategory === "center" ? (trainerCourse.trim() || undefined) : undefined,
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      router.push({ pathname: "/(auth)/mpin", params: { mode: "setup" } });
    } catch (e: any) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      Alert.alert(
        "Registration failed",
        e?.message || "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 16 + webTop,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: 22,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back */}
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.back,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: 999,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            hitSlop={8}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>

          {/* Header */}
          <View style={{ marginTop: 24 }}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: colors.pillarAccuracy + "12",
                  borderColor: colors.pillarAccuracy + "22",
                  borderRadius: 999,
                },
              ]}
            >
              <Feather name="user" size={22} color={colors.pillarAccuracy} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Staff Registration
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Apna account banayein. Admin approval ke baad login milega.
            </Text>
          </View>

          {/* ── Section: Staff Type ─────────────────────────────────────── */}
          <SectionHeader label="STAFF TYPE" colors={colors} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={() => {
                setStaffCategory("field");
                setStaffCategoryGroup(null);
                setCenterStaffRole("");
              }}
              style={[
                styles.categoryBtn,
                {
                  flex: 1,
                  borderColor: staffCategory === "field" ? colors.primary : colors.border,
                  backgroundColor: staffCategory === "field" ? colors.primary + "12" : colors.background,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="navigation"
                size={20}
                color={staffCategory === "field" ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.categoryLabel,
                  { color: staffCategory === "field" ? colors.primary : colors.mutedForeground },
                ]}
              >
                Field Staff
              </Text>
              <Text
                style={[
                  styles.categorySub,
                  { color: staffCategory === "field" ? colors.primary + "99" : colors.mutedForeground + "88" },
                ]}
              >
                Mobilizer, BDA, etc.
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStaffCategory("center")}
              style={[
                styles.categoryBtn,
                {
                  flex: 1,
                  borderColor: staffCategory === "center" ? colors.primary : colors.border,
                  backgroundColor: staffCategory === "center" ? colors.primary + "12" : colors.background,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="home"
                size={20}
                color={staffCategory === "center" ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.categoryLabel,
                  { color: staffCategory === "center" ? colors.primary : colors.mutedForeground },
                ]}
              >
                Center Staff
              </Text>
              <Text
                style={[
                  styles.categorySub,
                  { color: staffCategory === "center" ? colors.primary + "99" : colors.mutedForeground + "88" },
                ]}
              >
                Academic / Ground
              </Text>
            </Pressable>
          </View>

          {/* ── Center staff sub-categories ──────────────────────────────── */}
          {staffCategory === "center" && (
            <>
              <SectionHeader label="STAFF CATEGORY *" colors={colors} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                {/* Academic */}
                <Pressable
                  onPress={() => {
                    setStaffCategoryGroup("academic");
                    setCenterStaffRole("");
                    setTrainerCourse("");
                    setShowRolePicker(false);
                  }}
                  style={[
                    styles.categoryBtn,
                    {
                      flex: 1,
                      borderColor: staffCategoryGroup === "academic" ? "#2563EB" : colors.border,
                      backgroundColor: staffCategoryGroup === "academic" ? "#EFF6FF" : colors.background,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Feather
                    name="book-open"
                    size={20}
                    color={staffCategoryGroup === "academic" ? "#2563EB" : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      { color: staffCategoryGroup === "academic" ? "#2563EB" : colors.mutedForeground },
                    ]}
                  >
                    Academic
                  </Text>
                  <Text
                    style={[
                      styles.categorySub,
                      { color: staffCategoryGroup === "academic" ? "#2563EB99" : colors.mutedForeground + "88" },
                    ]}
                  >
                    Trainer, MIS, Counselor
                  </Text>
                </Pressable>

                {/* Ground */}
                <Pressable
                  onPress={() => {
                    setStaffCategoryGroup("ground");
                    setCenterStaffRole("");
                    setTrainerCourse("");
                    setShowRolePicker(false);
                  }}
                  style={[
                    styles.categoryBtn,
                    {
                      flex: 1,
                      borderColor: staffCategoryGroup === "ground" ? "#16A34A" : colors.border,
                      backgroundColor: staffCategoryGroup === "ground" ? "#F0FDF4" : colors.background,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Feather
                    name="tool"
                    size={20}
                    color={staffCategoryGroup === "ground" ? "#16A34A" : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      { color: staffCategoryGroup === "ground" ? "#16A34A" : colors.mutedForeground },
                    ]}
                  >
                    Ground
                  </Text>
                  <Text
                    style={[
                      styles.categorySub,
                      { color: staffCategoryGroup === "ground" ? "#16A34A99" : colors.mutedForeground + "88" },
                    ]}
                  >
                    Cook, Security, Other
                  </Text>
                </Pressable>
              </View>

              {/* ── Role picker (shown after sub-category is chosen) ─────── */}
              {staffCategoryGroup !== null && (
                <>
                  <SectionHeader label="DESIGNATION / ROLE *" colors={colors} />
                  <View style={{ gap: 8 }}>
                    <Pressable
                      onPress={() => setShowRolePicker((p) => !p)}
                      style={[
                        styles.roleSelector,
                        {
                          borderColor: centerStaffRole ? colors.primary : colors.border,
                          backgroundColor: colors.background,
                          borderRadius: colors.radius,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          flex: 1,
                          color: centerStaffRole ? colors.foreground : colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                          fontSize: 15,
                        }}
                      >
                        {centerStaffRole || "Role chunein..."}
                      </Text>
                      <Feather
                        name={showRolePicker ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={colors.mutedForeground}
                      />
                    </Pressable>

                    {showRolePicker && (
                      <View
                        style={[
                          styles.roleDropdown,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                            borderRadius: colors.radius,
                          },
                        ]}
                      >
                        {activeRoles.map((role) => (
                          <Pressable
                            key={role}
                            onPress={() => {
                              setCenterStaffRole(role);
                              setDesignation(role);
                              if (!TRAINER_ROLES.includes(role)) setTrainerCourse("");
                              setShowRolePicker(false);
                            }}
                            style={({ pressed }) => [
                              styles.roleOption,
                              {
                                backgroundColor:
                                  centerStaffRole === role
                                    ? colors.primary + "15"
                                    : pressed
                                    ? colors.border + "40"
                                    : "transparent",
                              },
                            ]}
                          >
                            {centerStaffRole === role && (
                              <Feather name="check" size={14} color={colors.primary} />
                            )}
                            <Text
                              style={{
                                color:
                                  centerStaffRole === role
                                    ? colors.primary
                                    : colors.foreground,
                                fontFamily:
                                  centerStaffRole === role
                                    ? "Inter_600SemiBold"
                                    : "Inter_400Regular",
                                fontSize: 14,
                                marginLeft: centerStaffRole === role ? 0 : 18,
                              }}
                            >
                              {role}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}
            </>
          )}

          {/* ── Section: Personal Details ─────────────────────────────────── */}
          <SectionHeader label="PERSONAL DETAILS" colors={colors} />
          <View style={[styles.form]}>
            <FieldInput
              label="STAFF NAME *"
              value={name}
              onChangeText={setName}
              placeholder="Ramesh Kumar"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              colors={colors}
            />

            {/* Phone */}
            <View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                MOBILE NUMBER *
              </Text>
              <View
                style={[
                  styles.inputRow,
                  {
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Text style={[styles.cc, { color: colors.foreground }]}>+91</Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <TextInput
                  ref={phoneRef}
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, "").slice(0, 10))}
                  keyboardType="number-pad"
                  placeholder="98765 43210"
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  style={[
                    styles.input,
                    { color: colors.foreground, fontFamily: "Inter_500Medium" },
                  ]}
                  maxLength={10}
                />
              </View>
              {phone.length > 0 && phone.replace(/\D/g, "").length !== 10 && (
                <Text style={[styles.fieldError, { color: colors.destructive ?? "#ef4444" }]}>
                  Mobile number 10 digits ka hona chahiye
                </Text>
              )}
            </View>

            <FieldInput
              ref={emailRef}
              label="EMAIL ID (optional)"
              value={email}
              onChangeText={setEmail}
              placeholder="ramesh@example.com"
              returnKeyType="next"
              onSubmitEditing={() => adminCodeRef.current?.focus()}
              colors={colors}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {email.length > 0 && !isValidEmail(email) && (
              <Text style={[styles.fieldError, { color: colors.destructive ?? "#ef4444" }]}>
                Valid email address daalen
              </Text>
            )}
          </View>

          {/* ── Section: Designation (optional override) ─────────────────── */}
          {staffCategory === "center" && staffCategoryGroup !== null && (
            <>
              <SectionHeader label="DESIGNATION (OPTIONAL OVERRIDE)" colors={colors} />
              <View style={[styles.form]}>
                <FieldInput
                  ref={designationRef}
                  label="DESIGNATION"
                  value={designation}
                  onChangeText={setDesignation}
                  placeholder="e.g. Senior Trainer, Head MIS"
                  returnKeyType="next"
                  onSubmitEditing={() => adminCodeRef.current?.focus()}
                  colors={colors}
                  autoCapitalize="words"
                />
                <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                  Role chunne par auto-fill hota hai — alag designation ho toh yahan likhen.
                </Text>
              </View>
            </>
          )}

          {/* ── Section: Scheme / Project ─────────────────────────────── */}
          <SectionHeader label="SCHEME / PROJECT *" colors={colors} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SCHEME_OPTIONS.map((scheme) => {
              const selected = projectName === scheme;
              return (
                <Pressable
                  key={scheme}
                  onPress={() => setProjectName(selected ? "" : scheme)}
                  style={[
                    styles.schemeChip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary + "15" : colors.background,
                      borderRadius: 999,
                    },
                  ]}
                >
                  {selected && <Feather name="check" size={12} color={colors.primary} />}
                  <Text
                    style={{
                      color: selected ? colors.primary : colors.mutedForeground,
                      fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular",
                      fontSize: 13,
                    }}
                  >
                    {scheme}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Section: Training Center ──────────────────────────────────── */}
          <SectionHeader label="TRAINING CENTER *" colors={colors} />
          <View style={[styles.form]}>

            {/* Center picker button */}
            <View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                TRAINING CENTER CHUNEIN *
              </Text>

              {selectedCenterResult ? (
                <View style={[styles.centerCard, { borderColor: colors.primary, backgroundColor: colors.primary + "0A", borderRadius: colors.radius }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{selectedCenterResult.name}</Text>
                    <Text style={{ color: colors.primary + "99", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                      {selectedCenterResult.companyName}
                      {selectedCenterResult.projectName ? ` • ${selectedCenterResult.projectName}` : ""}
                    </Text>
                    {selectedCenterResult.tcId && (
                      <Text style={{ color: colors.primary + "AA", fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 2 }}>
                        TC ID: {selectedCenterResult.tcId}
                      </Text>
                    )}
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                      {[selectedCenterResult.block, selectedCenterResult.district, selectedCenterResult.state].filter(Boolean).join(", ")}
                    </Text>
                  </View>
                  <Pressable onPress={clearCenterResult} hitSlop={8}>
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowCenterModal(true)}
                  style={[
                    styles.roleSelector,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  {allCentersLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                  ) : (
                    <Feather name="home" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                  )}
                  <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15 }}>
                    {allCentersLoading ? "Centers load ho rahe hain..." : `-- Center chunein${allCenters.length > 0 ? ` (${allCenters.length} available)` : ""} --`}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {/* TC ID — shown when a center with tcId is selected */}
            {selectedTcId ? (
              <View>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  TRAINING ID / TC ID
                </Text>
                <View
                  style={[
                    styles.textField,
                    {
                      borderColor: colors.primary + "44",
                      backgroundColor: colors.primary + "08",
                      borderRadius: colors.radius,
                      flexDirection: "row",
                      alignItems: "center",
                      height: 52,
                      paddingHorizontal: 14,
                      gap: 8,
                    },
                  ]}
                >
                  <Feather name="hash" size={14} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 }}>
                    {selectedTcId}
                  </Text>
                  <Text style={{ color: colors.primary + "88", fontFamily: "Inter_400Regular", fontSize: 11 }}>
                    auto-filled
                  </Text>
                </View>
                <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                  Selected center ke TC ID se auto-fill hua hai
                </Text>
              </View>
            ) : null}

          </View>

          {/* ── Section: Course (center staff only, trainer designation, shown after center selected) ── */}
          {staffCategory === "center" && selectedCenterResult &&
            staffCategoryGroup === "academic" && TRAINER_ROLES.includes(centerStaffRole) && (
            <>
              <SectionHeader label="COURSE / SUBJECT" colors={colors} />
              <View style={[styles.form]}>
                <View>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>
                    COURSE / SUBJECT (optional)
                  </Text>
                  {selectedCenterResult.courses && selectedCenterResult.courses.length > 0 ? (
                    <>
                      <Pressable
                        onPress={() => setShowCourseModal(true)}
                        style={[
                          styles.roleSelector,
                          {
                            borderColor: trainerCourse ? colors.primary : colors.border,
                            backgroundColor: trainerCourse ? colors.primary + "0A" : colors.background,
                            borderRadius: colors.radius,
                          },
                        ]}
                      >
                        <Feather name="book-open" size={16} color={trainerCourse ? colors.primary : colors.mutedForeground} style={{ marginRight: 8 }} />
                        <Text style={{ flex: 1, color: trainerCourse ? colors.primary : colors.mutedForeground, fontFamily: trainerCourse ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 15 }}>
                          {trainerCourse || "-- Course chunein --"}
                        </Text>
                        {trainerCourse ? (
                          <Pressable onPress={() => setTrainerCourse("")} hitSlop={8}>
                            <Feather name="x" size={16} color={colors.mutedForeground} />
                          </Pressable>
                        ) : (
                          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                        )}
                      </Pressable>
                      <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                        {selectedCenterResult.courses.length} courses available at this center
                      </Text>
                    </>
                  ) : (
                    <TextInput
                      value={trainerCourse}
                      onChangeText={setTrainerCourse}
                      placeholder="e.g. Computer Basics, Retail, Beauty & Wellness"
                      placeholderTextColor={colors.mutedForeground}
                      style={[
                        styles.inputRow,
                        styles.input,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          borderRadius: colors.radius,
                          color: colors.foreground,
                          paddingHorizontal: 14,
                          fontFamily: "Inter_400Regular",
                          fontSize: 15,
                        },
                      ]}
                      autoCapitalize="words"
                      returnKeyType="done"
                    />
                  )}
                </View>
              </View>
            </>
          )}

          {/* ── Section: Location ─────────────────────────────────────────── */}
          <SectionHeader label="LOCATION" colors={colors} />
          <View style={[styles.form]}>
            <FieldInput
              ref={stateRef}
              label="STATE *"
              value={state}
              onChangeText={setState_}
              placeholder="e.g. Jharkhand"
              returnKeyType="next"
              onSubmitEditing={() => districtRef.current?.focus()}
              colors={colors}
              autoCapitalize="words"
            />

            <FieldInput
              ref={districtRef}
              label="DISTRICT *"
              value={district}
              onChangeText={setDistrict}
              placeholder="e.g. Ranchi"
              returnKeyType="next"
              onSubmitEditing={() => blockRef.current?.focus()}
              colors={colors}
              autoCapitalize="words"
            />

            <FieldInput
              ref={blockRef}
              label="BLOCK (optional)"
              value={block}
              onChangeText={setBlock}
              placeholder="e.g. Namkum"
              returnKeyType="next"
              onSubmitEditing={() => pinCodeRef.current?.focus()}
              colors={colors}
              autoCapitalize="words"
            />

            <FieldInput
              ref={pinCodeRef}
              label="PIN CODE (optional)"
              value={staffPinCode}
              onChangeText={(t) => setStaffPinCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="e.g. 834001"
              returnKeyType="done"
              onSubmitEditing={onRegister}
              colors={colors}
              autoCapitalize="none"
              keyboardType="number-pad"
            />
          </View>

          <Button
            label="Create Staff Account"
            onPress={onRegister}
            loading={loading}
            disabled={!valid}
            size="lg"
            fullWidth
            style={{ marginTop: 28 }}
            icon={<Feather name="user-check" size={18} color="#fff" />}
          />

          <Text style={[styles.legal, { color: colors.mutedForeground }]}>
            Account banane ke baad aapko 4-digit MPIN set karna hoga. Admin approval milne ke baad aap login kar sakte hain.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Center Picker Modal ──────────────────────────────────────── */}
      <Modal
        visible={showCenterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowCenterModal(false); setModalSearchQuery(""); }}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            gap: 12,
          }}>
            <Pressable
              onPress={() => { setShowCenterModal(false); setModalSearchQuery(""); }}
              hitSlop={10}
              style={{ padding: 4 }}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={{ flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>
              Training Center Chunein
            </Text>
          </View>

          {/* Search bar */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            margin: 12,
            paddingHorizontal: 12,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            borderRadius: colors.radius,
            backgroundColor: colors.card,
            gap: 8,
          }}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={modalSearchQuery}
              onChangeText={setModalSearchQuery}
              placeholder="Center ka naam ya jila dhundein..."
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              returnKeyType="search"
              style={{ flex: 1, height: 44, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 15 }}
            />
            {modalSearchQuery.length > 0 && (
              <Pressable onPress={() => setModalSearchQuery("")} hitSlop={8}>
                <Feather name="x-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          {/* Center list */}
          {allCentersLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 12 }}>
                Centers load ho rahe hain...
              </Text>
            </View>
          ) : filteredModalCenters.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
              <Feather name="search" size={32} color={colors.mutedForeground + "66"} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15, marginTop: 12, textAlign: "center" }}>
                {modalSearchQuery ? `"${modalSearchQuery}" ke liye koi center nahi mila` : "Koi approved center nahi hai"}
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 8, marginLeft: 4 }}>
                {filteredModalCenters.length} center{filteredModalCenters.length !== 1 ? "s" : ""} available
              </Text>
              {filteredModalCenters.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => selectCenterResult(c)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                    marginBottom: 8,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    backgroundColor: pressed ? colors.primary + "10" : colors.card,
                    gap: 12,
                  })}
                >
                  <View style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    backgroundColor: colors.primary + "15",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Feather name="home" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{c.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                      {c.companyName}{c.projectName ? ` • ${c.projectName}` : ""}
                    </Text>
                    {(c.district || c.state) && (
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                        {[c.block, c.district, c.state].filter(Boolean).join(", ")}
                      </Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Course Picker Modal ────────────────────────────────────────── */}
      <Modal
        visible={showCourseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowCourseModal(false); setCourseModalSearch(""); }}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            gap: 12,
          }}>
            <Pressable
              onPress={() => { setShowCourseModal(false); setCourseModalSearch(""); }}
              hitSlop={10}
              style={{ padding: 4 }}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={{ flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>
              Course / Subject Chunein
            </Text>
          </View>

          <View style={{
            flexDirection: "row",
            alignItems: "center",
            margin: 12,
            paddingHorizontal: 12,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            borderRadius: colors.radius,
            backgroundColor: colors.card,
            gap: 8,
          }}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={courseModalSearch}
              onChangeText={setCourseModalSearch}
              placeholder="Course dhundein..."
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              returnKeyType="search"
              style={{ flex: 1, height: 44, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 15 }}
            />
            {courseModalSearch.length > 0 && (
              <Pressable onPress={() => setCourseModalSearch("")} hitSlop={8}>
                <Feather name="x-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {(selectedCenterResult?.courses ?? [])
              .filter((c) => !courseModalSearch.trim() || c.toLowerCase().includes(courseModalSearch.trim().toLowerCase()))
              .map((course) => (
                <Pressable
                  key={course}
                  onPress={() => {
                    setTrainerCourse(course);
                    setShowCourseModal(false);
                    setCourseModalSearch("");
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    marginBottom: 8,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: trainerCourse === course ? colors.primary : colors.border,
                    borderRadius: colors.radius,
                    backgroundColor: trainerCourse === course
                      ? colors.primary + "12"
                      : pressed ? colors.primary + "08" : colors.card,
                    gap: 12,
                  })}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: trainerCourse === course ? colors.primary + "20" : colors.muted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Feather name="book-open" size={15} color={trainerCourse === course ? colors.primary : colors.mutedForeground} />
                  </View>
                  <Text style={{
                    flex: 1,
                    color: trainerCourse === course ? colors.primary : colors.foreground,
                    fontFamily: trainerCourse === course ? "Inter_600SemiBold" : "Inter_400Regular",
                    fontSize: 15,
                  }}>
                    {course}
                  </Text>
                  {trainerCourse === course && (
                    <Feather name="check-circle" size={18} color={colors.primary} />
                  )}
                </Pressable>
              ))
            }
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function SectionHeader({ label, colors }: { label: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
      {label}
    </Text>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  returnKeyType?: "next" | "done" | "default";
  onSubmitEditing?: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "number-pad";
};

const FieldInput = React.forwardRef<TextInput, FieldProps>(
  (
    {
      label,
      value,
      onChangeText,
      placeholder,
      returnKeyType,
      onSubmitEditing,
      colors,
      autoCapitalize = "words",
      keyboardType = "default",
    },
    ref,
  ) => (
    <View>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={[
          styles.textField,
          {
            color: colors.foreground,
            borderColor: colors.border,
            borderRadius: colors.radius,
            backgroundColor: colors.background,
            fontFamily: "Inter_400Regular",
          },
        ]}
      />
    </View>
  ),
);
FieldInput.displayName = "FieldInput";

const styles = StyleSheet.create({
  back: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  sub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    lineHeight: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 12,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cc: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
  },
  input: {
    flex: 1,
    fontSize: 16,
    letterSpacing: 1,
  },
  textField: {
    height: 52,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 6,
  },
  fieldError: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  legal: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 16,
    textAlign: "center",
  },
  categoryBtn: {
    padding: 16,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 6,
  },
  categoryLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  categorySub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  roleSelector: {
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleDropdown: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  centerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1.5,
    gap: 10,
  },
  schemeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
  },
});
