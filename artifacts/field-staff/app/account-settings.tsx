import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useLanguage } from "@/contexts/LanguageContext";

const _domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = _domain ? `https://${_domain}` : "";

const ACCENT        = "#1E3A5F";
const SUCCESS_GREEN = "#16A34A";
const ERROR_RED     = "#DC2626";
const BORDER        = "#D1D5DB";
const MUTED         = "#6B7280";
const BG            = "#F3F4F6";

type SectionKey = "profile" | "password";

async function apiHasPassword(phone: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/staff/has-password?phone=${encodeURIComponent(phone)}`);
    if (!res.ok) return false;
    const data = await res.json() as { hasPassword: boolean };
    return data.hasPassword;
  } catch {
    return false;
  }
}

async function apiChangePassword(
  phone: string,
  currentPassword: string | undefined,
  newPassword: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/staff/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, currentPassword: currentPassword || undefined, newPassword }),
    });
    const data = await res.json() as { message?: string; title?: string };
    if (!res.ok) return { ok: false, message: data.title ?? "Error updating password" };
    return { ok: true, message: data.message ?? "Password updated" };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

function Field({
  label, value, onChangeText, secure, placeholder, error, keyboardType, editable = true,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  secure?: boolean; placeholder?: string; error?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  editable?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={fldStyles.wrap}>
      <Text style={fldStyles.label}>{label}</Text>
      <View style={[fldStyles.inputRow, error ? fldStyles.inputError : null, !editable && fldStyles.inputDisabled]}>
        <TextInput
          style={fldStyles.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !show}
          placeholder={placeholder}
          placeholderTextColor="#BBB"
          autoCapitalize="none"
          keyboardType={keyboardType}
          editable={editable}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShow((s) => !s)} style={fldStyles.eyeBtn}>
            <Feather name={show ? "eye-off" : "eye"} size={16} color={MUTED} />
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={fldStyles.errorText}>{error}</Text>}
    </View>
  );
}

const fldStyles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 5 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  inputDisabled: { backgroundColor: "#F9FAFB" },
  inputError: { borderColor: ERROR_RED },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#111",
  },
  eyeBtn: { paddingHorizontal: 10 },
  errorText: { fontSize: 11, color: ERROR_RED, marginTop: 3, fontFamily: "Inter_400Regular" },
});

export default function AccountSettingsScreen() {
  const { t, lang } = useLanguage();
  const { user, updateProfile } = useApp();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const isAdmin = user?.role === "admin";
  const [activeSection, setActiveSection] = useState<SectionKey>(isAdmin ? "profile" : "password");

  // ── Profile section state (admin only)
  const [profName, setProfName] = useState(user?.name ?? "");
  const [profEmail, setProfEmail] = useState(user?.email ?? "");
  const [profOrg, setProfOrg] = useState(user?.organization ?? "");
  const [profCenter, setProfCenter] = useState(user?.centerName ?? "");
  const [profProject, setProfProject] = useState(user?.projectName ?? "");
  const [profState, setProfState] = useState(user?.state ?? "");
  const [profDistrict, setProfDistrict] = useState(user?.district ?? "");
  const [profErrors, setProfErrors] = useState<Record<string, string>>({});
  const [profSaving, setProfSaving] = useState(false);
  const [profSuccess, setProfSuccess] = useState("");

  useEffect(() => {
    if (user) {
      setProfName(user.name ?? "");
      setProfEmail(user.email ?? "");
      setProfOrg(user.organization ?? "");
      setProfCenter(user.centerName ?? "");
      setProfProject(user.projectName ?? "");
      setProfState(user.state ?? "");
      setProfDistrict(user.district ?? "");
    }
  }, [user]);

  async function handleSaveProfile() {
    const errs: Record<string, string> = {};
    if (!profName.trim() || profName.trim().length < 2) errs.name = "Name must be at least 2 characters";
    if (profEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profEmail.trim())) {
      errs.email = "Please enter a valid email address";
    }
    setProfErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setProfSaving(true);
    setProfSuccess("");
    try {
      await updateProfile({
        name: profName.trim(),
        email: profEmail.trim() || null,
        organization: profOrg.trim() || null,
        centerName: profCenter.trim() || null,
        projectName: profProject.trim() || null,
        state: profState.trim() || null,
        district: profDistrict.trim() || null,
      });
      setProfSuccess("Profile updated successfully!");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update profile. Please try again.");
    } finally {
      setProfSaving(false);
    }
  }

  // ── Password section state
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");

  useEffect(() => {
    if (user?.phone) {
      apiHasPassword(user.phone).then(setHasPassword);
    }
  }, [user?.phone]);

  async function handleChangePassword() {
    const errs: Record<string, string> = {};
    if (hasPassword && !currentPw.trim()) errs.currentPw = t("required");
    if (!newPw.trim() || newPw.length < 4) errs.newPw = t("passwordTooShort");
    if (newPw !== confirmPw) errs.confirmPw = t("passwordMismatch");
    setPwErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPwSaving(true);
    setPwSuccess("");
    const result = await apiChangePassword(
      user!.phone,
      hasPassword ? currentPw : undefined,
      newPw,
    );
    setPwSaving(false);
    if (result.ok) {
      setPwSuccess(t("passwordChanged"));
      setHasPassword(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setPwErrors({});
    } else {
      if (result.message.includes("incorrect") || result.message.includes("Current")) {
        setPwErrors({ currentPw: t("wrongPassword") });
      } else if (result.message.includes("4 char")) {
        setPwErrors({ newPw: t("passwordTooShort") });
      } else {
        Alert.alert(t("error"), result.message);
      }
    }
  }

  if (!user) return null;

  const roleLabel = user.role === "admin"
    ? (lang === "hi" ? "एडमिन" : "Admin")
    : (lang === "hi" ? "मोबिलाइज़र / स्टाफ" : "Staff / Mobilizer");

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.root, { backgroundColor: BG }]}>

        {/* Nav header */}
        <View style={[styles.header, { paddingTop: insets.top + webTop }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>{t("accountSettings")}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

          {/* ── User info card */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {user.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user.name}</Text>
              {!!(user.companyName || user.centerName || user.organization || user.projectName) && (
                <Text style={styles.profileOrg} numberOfLines={1}>
                  {user.companyName || [user.centerName || user.organization, user.projectName].filter(Boolean).join(" · ")}
                </Text>
              )}
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{roleLabel}</Text>
              </View>
            </View>
          </View>

          {/* ── Static info rows */}
          <View style={styles.infoCard}>
            <InfoRow icon="phone" label={t("phone")} value={user.phone} />
            <InfoRow icon="tag" label={t("empCode")} value={user.empCode} />
            <InfoRow icon="briefcase" label={t("role")} value={roleLabel} />
            {!!user.centerName && (
              <InfoRow icon="home" label="Center" value={user.centerName} />
            )}
            {!!(user.state || user.district) && (
              <InfoRow
                icon="map-pin"
                label="Location"
                value={[user.district, user.state].filter(Boolean).join(", ")}
              />
            )}
            {!!user.email && (
              <InfoRow icon="mail" label="Email" value={user.email} last />
            )}
          </View>

          {/* ── Tab bar */}
          <View style={styles.tabBar}>
            {isAdmin && (
              <TouchableOpacity
                style={[styles.tab, activeSection === "profile" && styles.tabActive]}
                onPress={() => setActiveSection("profile")}
              >
                <Feather name="user" size={14} color={activeSection === "profile" ? ACCENT : MUTED} />
                <Text style={[styles.tabText, activeSection === "profile" && styles.tabTextActive]}>
                  Profile
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.tab, activeSection === "password" && styles.tabActive]}
              onPress={() => setActiveSection("password")}
            >
              <Feather name="lock" size={14} color={activeSection === "password" ? ACCENT : MUTED} />
              <Text style={[styles.tabText, activeSection === "password" && styles.tabTextActive]}>
                {t("changePassword")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Profile section (admin only) */}
          {activeSection === "profile" && isAdmin && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal & Organization Info</Text>
              <Text style={styles.sectionSub}>
                Yeh details PDF/Excel reports ke header mein dikhenge.
              </Text>

              <View style={{ height: 16 }} />

              <Field
                label="FULL NAME *"
                value={profName}
                onChangeText={setProfName}
                placeholder="Anita Sharma"
                error={profErrors.name}
              />

              <Field
                label="EMAIL ID"
                value={profEmail}
                onChangeText={setProfEmail}
                placeholder="anita@example.com"
                keyboardType="email-address"
                error={profErrors.email}
              />

              <View style={[styles.dividerLine, { marginVertical: 14 }]} />
              <Text style={styles.subHeading}>ORGANIZATION</Text>

              <Field
                label="COMPANY / ORGANIZATION NAME"
                value={profOrg}
                onChangeText={setProfOrg}
                placeholder="e.g. JSDMS / DDU-GKY"
              />

              <Field
                label="CENTER / BRANCH NAME"
                value={profCenter}
                onChangeText={setProfCenter}
                placeholder="e.g. Ranchi Training Center"
              />

              <Field
                label="SCHEME / PROJECT NAME"
                value={profProject}
                onChangeText={setProfProject}
                placeholder="e.g. Kaushal Vikas Yojana"
              />

              <View style={[styles.dividerLine, { marginVertical: 14 }]} />
              <Text style={styles.subHeading}>LOCATION</Text>

              <Field
                label="STATE"
                value={profState}
                onChangeText={setProfState}
                placeholder="e.g. Jharkhand"
              />

              <Field
                label="DISTRICT"
                value={profDistrict}
                onChangeText={setProfDistrict}
                placeholder="e.g. Ranchi"
              />

              {!!profSuccess && (
                <View style={styles.successBanner}>
                  <Feather name="check-circle" size={15} color={SUCCESS_GREEN} />
                  <Text style={styles.successText}>{profSuccess}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, profSaving && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={profSaving}
              >
                {profSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <>
                      <Feather name="save" size={16} color="#fff" />
                      <Text style={styles.saveBtnText}>Save Profile</Text>
                    </>
                  )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Password section */}
          {activeSection === "password" && (
            <View style={styles.section}>
              {hasPassword === null ? (
                <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} />
              ) : (
                <>
                  {!hasPassword && (
                    <View style={styles.noPasswordBanner}>
                      <Feather name="info" size={14} color="#B45309" />
                      <Text style={styles.noPasswordText}>{t("noPasswordSet")}</Text>
                    </View>
                  )}

                  {hasPassword && (
                    <Field
                      label={t("currentPassword")}
                      value={currentPw}
                      onChangeText={setCurrentPw}
                      secure
                      error={pwErrors.currentPw}
                    />
                  )}
                  <Field
                    label={t("newPassword")}
                    value={newPw}
                    onChangeText={setNewPw}
                    secure
                    placeholder="Min 4 characters"
                    error={pwErrors.newPw}
                  />
                  <Field
                    label={t("confirmPassword")}
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    secure
                    error={pwErrors.confirmPw}
                  />

                  {!!pwSuccess && (
                    <View style={styles.successBanner}>
                      <Feather name="check-circle" size={15} color={SUCCESS_GREEN} />
                      <Text style={styles.successText}>{pwSuccess}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.saveBtn, pwSaving && { opacity: 0.7 }]}
                    onPress={handleChangePassword}
                    disabled={pwSaving}
                  >
                    {pwSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : (
                        <>
                          <Feather name="check" size={16} color="#fff" />
                          <Text style={styles.saveBtnText}>
                            {hasPassword ? t("saveChanges") : t("setPasswordFirst")}
                          </Text>
                        </>
                      )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Feather name={icon as any} size={15} color={MUTED} style={{ width: 20 }} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },

  profileCard: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    margin: 16,
    borderRadius: 14,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  profileName: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111", marginBottom: 2 },
  profileOrg: { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED, marginBottom: 6 },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: ACCENT + "18",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleBadgeText: { color: ACCENT, fontSize: 11, fontFamily: "Inter_600SemiBold" },

  infoCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  infoLabel: { fontSize: 13, color: MUTED, fontFamily: "Inter_400Regular", flex: 1 },
  infoValue: { fontSize: 13, color: "#111", fontFamily: "Inter_600SemiBold", maxWidth: "55%" },

  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#E8EEF6",
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 13, color: MUTED, fontFamily: "Inter_500Medium" },
  tabTextActive: { color: ACCENT, fontFamily: "Inter_600SemiBold" },

  section: {
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 14,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111", marginBottom: 4 },
  sectionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED, lineHeight: 18 },
  subHeading: { fontSize: 11, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", color: MUTED, marginBottom: 12 },
  dividerLine: { height: StyleSheet.hairlineWidth, backgroundColor: "#E5E7EB" },

  noPasswordBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 14,
  },
  noPasswordText: { flex: 1, fontSize: 12, color: "#92400E", fontFamily: "Inter_400Regular", lineHeight: 18 },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: 12,
  },
  successText: { flex: 1, fontSize: 13, color: SUCCESS_GREEN, fontFamily: "Inter_500Medium" },
  saveBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
