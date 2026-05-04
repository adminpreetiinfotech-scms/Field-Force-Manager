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

const CENTER_ROLES = [
  "Center Head",
  "MIS Executive",
  "Trainer",
  "Co-Trainer",
  "Counselor",
  "Cook",
  "Security Guard",
  "Hostel Warden",
  "Lab Assistant",
  "Other",
];

export default function RegisterStaffScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useApp();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [centerName, setCenterName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [state, setState_] = useState("");
  const [district, setDistrict] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [staffCategory, setStaffCategory] = useState<"field" | "center">("field");
  const [centerStaffRole, setCenterStaffRole] = useState("");
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const centerRef = useRef<TextInput>(null);
  const projectRef = useRef<TextInput>(null);
  const stateRef = useRef<TextInput>(null);
  const districtRef = useRef<TextInput>(null);
  const adminCodeRef = useRef<TextInput>(null);

  const isValidEmail = (e: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const valid =
    name.trim().length >= 2 &&
    phone.replace(/\D/g, "").length === 10 &&
    isValidEmail(email) &&
    centerName.trim().length >= 2 &&
    projectName.trim().length >= 2 &&
    state.trim().length >= 2 &&
    district.trim().length >= 2 &&
    (staffCategory === "field" || centerStaffRole.trim().length >= 2);

  const onRegister = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      await register({
        kind: "staff",
        name: name.trim(),
        phone: phone.replace(/\D/g, ""),
        email: email.trim(),
        centerName: centerName.trim(),
        projectName: projectName.trim(),
        state: state.trim(),
        district: district.trim(),
        adminCode: adminCode.trim().toUpperCase() || undefined,
        staffCategory,
        centerStaffRole: staffCategory === "center" ? centerStaffRole.trim() : undefined,
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
      router.push({ pathname: "/(auth)/mpin", params: { mode: "setup" } });
    } catch (e: any) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        ).catch(() => {});
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
              Apna account banayein. Saari details sahi bharein.
            </Text>
          </View>

          {/* Section: Staff Type */}
          <SectionHeader label="STAFF TYPE" colors={colors} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={() => { setStaffCategory("field"); setCenterStaffRole(""); }}
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
                Trainer, MIS, Cook, etc.
              </Text>
            </Pressable>
          </View>

          {/* Center Role — only for center staff */}
          {staffCategory === "center" && (
            <>
              <SectionHeader label="CENTER ROLE *" colors={colors} />
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
                    {CENTER_ROLES.map((role) => (
                      <Pressable
                        key={role}
                        onPress={() => {
                          setCenterStaffRole(role);
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

          {/* Section: Personal Details */}
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
                <Text style={[styles.cc, { color: colors.foreground }]}>
                  +91
                </Text>
                <View
                  style={[
                    styles.divider,
                    { backgroundColor: colors.border },
                  ]}
                />
                <TextInput
                  ref={phoneRef}
                  value={phone}
                  onChangeText={(t) =>
                    setPhone(t.replace(/[^0-9]/g, "").slice(0, 10))
                  }
                  keyboardType="number-pad"
                  placeholder="98765 43210"
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
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
              label="EMAIL ID *"
              value={email}
              onChangeText={setEmail}
              placeholder="ramesh@example.com"
              returnKeyType="next"
              onSubmitEditing={() => centerRef.current?.focus()}
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

          {/* Section: Organization Details */}
          <SectionHeader label="ORGANIZATION DETAILS" colors={colors} />
          <View style={[styles.form]}>
            <FieldInput
              ref={centerRef}
              label="CENTER / BRANCH NAME *"
              value={centerName}
              onChangeText={setCenterName}
              placeholder="e.g. Ranchi Training Center"
              returnKeyType="next"
              onSubmitEditing={() => projectRef.current?.focus()}
              colors={colors}
              autoCapitalize="words"
            />

            <FieldInput
              ref={projectRef}
              label="SCHEME / PROJECT NAME *"
              value={projectName}
              onChangeText={setProjectName}
              placeholder="e.g. DDU-GKY, JSDMS"
              returnKeyType="next"
              onSubmitEditing={() => stateRef.current?.focus()}
              colors={colors}
              autoCapitalize="words"
            />
          </View>

          {/* Section: Location */}
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
              onSubmitEditing={() => adminCodeRef.current?.focus()}
              colors={colors}
              autoCapitalize="words"
            />
          </View>

          {/* Admin code */}
          <SectionHeader label="LINK TO ADMIN (OPTIONAL)" colors={colors} />
          <View style={[styles.form]}>
            <View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                ADMIN INVITE CODE
              </Text>
              <TextInput
                ref={adminCodeRef}
                value={adminCode}
                onChangeText={(t) =>
                  setAdminCode(t.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6))
                }
                placeholder="e.g. A3BZ90"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
                onSubmitEditing={onRegister}
                autoCapitalize="characters"
                style={[
                  styles.textField,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    backgroundColor: colors.background,
                    fontFamily: "Inter_500Medium",
                    letterSpacing: 3,
                  },
                ]}
              />
              <Text
                style={[styles.fieldHint, { color: colors.mutedForeground }]}
              >
                Admin ka 6-character invite code daalen apna account link karne ke liye.
              </Text>
            </View>
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
            Account banane ke baad aapko 4-digit MPIN set karna hoga. Aap GPS, camera aur movement logging ke liye consent dete hain.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
});
