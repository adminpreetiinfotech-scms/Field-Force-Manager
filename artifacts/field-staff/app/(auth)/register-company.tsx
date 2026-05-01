import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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

const ACCENT = "#1E3A5F";
const GOLD = "#D4AF37";

const INDIA_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman & Nicobar","Chandigarh","Dadra & Nagar Haveli","Daman & Diu",
  "Delhi","Jammu & Kashmir","Ladakh","Lakshadweep","Puducherry",
];

const PROJECT_OPTIONS = ["DDU-KK", "JSDMS", "NULM", "PMKVY", "Other"];

export default function RegisterCompanyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { registerCompany } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;

  // Company fields
  const [companyName, setCompanyName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [companyState, setCompanyState] = useState("");
  const [companyDistrict, setCompanyDistrict] = useState("");

  // Admin personal fields
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [centerName, setCenterName] = useState("");
  const [adminKey, setAdminKey] = useState("");

  const [loading, setLoading] = useState(false);

  const companyNameRef = useRef<TextInput>(null);
  const projectRef = useRef<TextInput>(null);
  const stateRef = useRef<TextInput>(null);
  const districtRef = useRef<TextInput>(null);
  const adminNameRef = useRef<TextInput>(null);
  const adminPhoneRef = useRef<TextInput>(null);
  const adminEmailRef = useRef<TextInput>(null);
  const centerRef = useRef<TextInput>(null);
  const keyRef = useRef<TextInput>(null);

  const emailValid = !adminEmail.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim());

  const valid =
    companyName.trim().length >= 2 &&
    adminName.trim().length >= 2 &&
    adminPhone.replace(/\D/g, "").length === 10 &&
    emailValid &&
    adminKey.trim().length >= 4;

  const onRegister = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      await registerCompany({
        companyName: companyName.trim(),
        projectName: projectName.trim() || undefined,
        companyState: companyState.trim() || undefined,
        companyDistrict: companyDistrict.trim() || undefined,
        adminName: adminName.trim(),
        adminPhone: adminPhone.replace(/\D/g, ""),
        adminEmail: adminEmail.trim() || undefined,
        centerName: centerName.trim() || undefined,
        adminRegistrationKey: adminKey.trim(),
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      router.push({ pathname: "/(auth)/mpin", params: { mode: "setup" } });
    } catch (e: any) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      Alert.alert("Registration Failed", e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 16 + webTop,
            paddingBottom: insets.bottom + 48,
            paddingHorizontal: 22,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back */}
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.back, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            hitSlop={8}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>

          {/* Header */}
          <View style={{ marginTop: 24, marginBottom: 28 }}>
            <View style={styles.headerIcon}>
              <Feather name="briefcase" size={22} color="#D97706" />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Register New Company</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Create your organization account and set up the admin profile.
            </Text>
          </View>

          {/* ── Company Details ───────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: "#D97706" }]} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Organization Details</Text>
            </View>

            <Field label="Company / Organization Name *">
              <TextInput
                ref={companyNameRef}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="e.g. Nistha Skill Pvt. Ltd."
                placeholderTextColor={colors.mutedForeground}
                value={companyName}
                onChangeText={setCompanyName}
                returnKeyType="next"
                onSubmitEditing={() => projectRef.current?.focus()}
              />
            </Field>

            <Field label="Project / Scheme">
              <View style={styles.pillRow}>
                {PROJECT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setProjectName(opt === projectName ? "" : opt)}
                    style={[
                      styles.pill,
                      projectName === opt && { backgroundColor: ACCENT, borderColor: ACCENT },
                    ]}
                  >
                    <Text style={[styles.pillText, projectName === opt && { color: "#fff" }]}>{opt}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                ref={projectRef}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, marginTop: 8 }]}
                placeholder="Or type custom project name"
                placeholderTextColor={colors.mutedForeground}
                value={projectName}
                onChangeText={setProjectName}
                returnKeyType="next"
                onSubmitEditing={() => stateRef.current?.focus()}
              />
            </Field>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="State">
                  <TextInput
                    ref={stateRef}
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                    placeholder="e.g. Jharkhand"
                    placeholderTextColor={colors.mutedForeground}
                    value={companyState}
                    onChangeText={setCompanyState}
                    returnKeyType="next"
                    onSubmitEditing={() => districtRef.current?.focus()}
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="District">
                  <TextInput
                    ref={districtRef}
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                    placeholder="e.g. Ranchi"
                    placeholderTextColor={colors.mutedForeground}
                    value={companyDistrict}
                    onChangeText={setCompanyDistrict}
                    returnKeyType="next"
                    onSubmitEditing={() => adminNameRef.current?.focus()}
                  />
                </Field>
              </View>
            </View>
          </View>

          {/* ── Admin Details ───────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: ACCENT }]} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Admin Account</Text>
            </View>

            <Field label="Admin Full Name *">
              <TextInput
                ref={adminNameRef}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Full name of company admin"
                placeholderTextColor={colors.mutedForeground}
                value={adminName}
                onChangeText={setAdminName}
                returnKeyType="next"
                onSubmitEditing={() => adminPhoneRef.current?.focus()}
              />
            </Field>

            <Field label="Admin Phone *">
              <TextInput
                ref={adminPhoneRef}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.mutedForeground}
                value={adminPhone}
                onChangeText={setAdminPhone}
                keyboardType="phone-pad"
                maxLength={10}
                returnKeyType="next"
                onSubmitEditing={() => adminEmailRef.current?.focus()}
              />
            </Field>

            <Field label="Admin Email">
              <TextInput
                ref={adminEmailRef}
                style={[
                  styles.input,
                  { color: colors.foreground, borderColor: adminEmail.trim() && !emailValid ? "#DC2626" : colors.border, backgroundColor: colors.background },
                ]}
                placeholder="admin@company.com (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={adminEmail}
                onChangeText={setAdminEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => centerRef.current?.focus()}
              />
              {adminEmail.trim() && !emailValid && (
                <Text style={styles.fieldError}>Please enter a valid email address.</Text>
              )}
            </Field>

            <Field label="Training Center Name">
              <TextInput
                ref={centerRef}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="e.g. NSDC Ranchi Center (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={centerName}
                onChangeText={setCenterName}
                returnKeyType="next"
                onSubmitEditing={() => keyRef.current?.focus()}
              />
            </Field>
          </View>

          {/* ── Registration Key ─────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: "#7C3AED" }]} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Authorization</Text>
            </View>

            <View style={styles.keyHint}>
              <Feather name="lock" size={14} color="#7C3AED" />
              <Text style={styles.keyHintText}>
                A registration key is required to create a new company. Contact your system provider to obtain one.
              </Text>
            </View>

            <Field label="Admin Registration Key *">
              <TextInput
                ref={keyRef}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Enter the key provided to you"
                placeholderTextColor={colors.mutedForeground}
                value={adminKey}
                onChangeText={setAdminKey}
                secureTextEntry
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={valid ? onRegister : undefined}
              />
            </Field>
          </View>

          <Button
            title="Register Company"
            onPress={onRegister}
            loading={loading}
            disabled={!valid}
            style={{ marginTop: 8 }}
          />

          <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
            After registration, you'll be asked to set a 4-digit MPIN for secure login.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    lineHeight: 18,
  },

  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  fieldError: {
    color: "#DC2626",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },

  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#DDD",
    backgroundColor: "#F8F8F8",
  },
  pillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#555",
  },

  keyHint: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F5F3FF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  keyHintText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#555",
    lineHeight: 17,
  },

  footerNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 17,
  },
});
