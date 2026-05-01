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

const INDIA_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman & Nicobar","Chandigarh","Dadra & Nagar Haveli","Daman & Diu",
  "Delhi","Jammu & Kashmir","Ladakh","Lakshadweep","Puducherry",
];

export default function RegisterAdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useApp();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [projectName, setProjectName] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);

  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const orgRef = useRef<TextInput>(null);
  const projectRef = useRef<TextInput>(null);
  const stateRef = useRef<TextInput>(null);
  const districtRef = useRef<TextInput>(null);
  const keyRef = useRef<TextInput>(null);

  const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const valid =
    name.trim().length >= 2 &&
    phone.replace(/\D/g, "").length === 10 &&
    emailValid &&
    adminKey.trim().length >= 4;

  const onRegister = async () => {
    if (!valid) return;
    if (email.trim() && !emailValid) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await register({
        kind: "admin",
        name: name.trim(),
        phone: phone.replace(/\D/g, ""),
        email: email.trim() || undefined,
        organization: organization.trim() || undefined,
        projectName: projectName.trim() || undefined,
        state: state.trim() || undefined,
        district: district.trim() || undefined,
        adminRegistrationKey: adminKey.trim(),
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
                  backgroundColor: colors.primary + "12",
                  borderColor: colors.primary + "22",
                  borderRadius: 999,
                },
              ]}
            >
              <Feather name="shield" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Register as Admin
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Apna admin account banayein apni field team manage karne ke liye.
            </Text>
          </View>

          {/* ── Section: Personal Info ── */}
          <SectionLabel label="PERSONAL INFORMATION" colors={colors} />

          <View style={[styles.form, { gap: 14 }]}>
            <FieldInput
              label="FULL NAME *"
              value={name}
              onChangeText={setName}
              placeholder="Anita Sharma"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              colors={colors}
            />

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
            </View>

            <FieldInput
              ref={emailRef}
              label="EMAIL ID (optional)"
              value={email}
              onChangeText={setEmail}
              placeholder="anita@example.com"
              returnKeyType="next"
              onSubmitEditing={() => orgRef.current?.focus()}
              colors={colors}
              autoCapitalize="none"
              keyboardType="email-address"
              error={email.trim() && !emailValid ? "Invalid email address" : undefined}
            />
          </View>

          {/* ── Section: Organization ── */}
          <SectionLabel label="ORGANIZATION DETAILS (optional)" colors={colors} />

          <View style={[styles.form, { gap: 14 }]}>
            <FieldInput
              ref={orgRef}
              label="COMPANY / ORGANIZATION NAME"
              value={organization}
              onChangeText={setOrganization}
              placeholder="e.g. JSDMS / DDU-KK"
              returnKeyType="next"
              onSubmitEditing={() => projectRef.current?.focus()}
              colors={colors}
            />

            <FieldInput
              ref={projectRef}
              label="SCHEME / PROJECT NAME"
              value={projectName}
              onChangeText={setProjectName}
              placeholder="e.g. Kaushal Vikas Yojana"
              returnKeyType="next"
              onSubmitEditing={() => stateRef.current?.focus()}
              colors={colors}
            />

            <FieldInput
              ref={stateRef}
              label="STATE"
              value={state}
              onChangeText={setState}
              placeholder="e.g. Jharkhand"
              returnKeyType="next"
              onSubmitEditing={() => districtRef.current?.focus()}
              colors={colors}
            />

            <FieldInput
              ref={districtRef}
              label="DISTRICT"
              value={district}
              onChangeText={setDistrict}
              placeholder="e.g. Ranchi"
              returnKeyType="next"
              onSubmitEditing={() => keyRef.current?.focus()}
              colors={colors}
            />
          </View>

          {/* ── Section: Security ── */}
          <SectionLabel label="SECURITY" colors={colors} />

          <View style={[styles.form, { gap: 14 }]}>
            <View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                SECRET ADMIN KEY *
              </Text>
              <Text style={[styles.keyHint, { color: colors.mutedForeground }]}>
                Aapke admin key ke bina registration nahi hogi. Yeh key sirf aapko pata hai.
              </Text>
              <TextInput
                ref={keyRef}
                value={adminKey}
                onChangeText={setAdminKey}
                placeholder="Enter secret key"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={onRegister}
                style={[
                  styles.textField,
                  {
                    color: colors.foreground,
                    borderColor: adminKey.length > 0 && adminKey.trim().length < 4
                      ? "#ef4444"
                      : colors.border,
                    borderRadius: colors.radius,
                    backgroundColor: colors.background,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              />
            </View>
          </View>

          <Button
            label="Create Admin Account"
            onPress={onRegister}
            loading={loading}
            disabled={!valid}
            size="lg"
            fullWidth
            style={{ marginTop: 28 }}
            icon={<Feather name="shield" size={18} color="#fff" />}
          />

          <Text style={[styles.legal, { color: colors.mutedForeground }]}>
            Aapko 4-digit MPIN set karna hoga account secure karne ke liye.
            Organization details baad mein settings mein edit ki ja sakti hain.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function SectionLabel({ label, colors }: { label: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 24, marginBottom: 12 }}>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
      <Text style={{ fontSize: 10, letterSpacing: 0.8, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
    </View>
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
  keyboardType?: "default" | "email-address" | "number-pad" | "phone-pad";
  error?: string;
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
      error,
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
            borderColor: error ? "#ef4444" : colors.border,
            borderRadius: colors.radius,
            backgroundColor: colors.background,
            fontFamily: "Inter_400Regular",
          },
        ]}
      />
      {!!error && (
        <Text style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: "Inter_400Regular" }}>
          {error}
        </Text>
      )}
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
  form: {},
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
  legal: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 16,
    textAlign: "center",
  },
  keyHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginBottom: 8,
  },
});
