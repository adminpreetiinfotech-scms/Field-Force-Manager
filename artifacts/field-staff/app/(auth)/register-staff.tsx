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

export default function RegisterStaffScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useApp();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [loading, setLoading] = useState(false);

  const phoneRef = useRef<TextInput>(null);
  const areaRef = useRef<TextInput>(null);
  const adminCodeRef = useRef<TextInput>(null);

  const valid =
    name.trim().length >= 2 && phone.replace(/\D/g, "").length === 10;

  const onRegister = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      await register({
        kind: "staff",
        name: name.trim(),
        phone: phone.replace(/\D/g, ""),
        area: area.trim() || undefined,
        adminCode: adminCode.trim().toUpperCase() || undefined,
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
      router.push("/(auth)/otp");
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
              Register as Staff
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Create your field staff account to log attendance, meter reads and
              trips.
            </Text>
          </View>

          {/* Form */}
          <View style={[styles.form, { marginTop: 28 }]}>
            <FieldInput
              label="FULL NAME"
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
                MOBILE NUMBER
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
                  onSubmitEditing={() => areaRef.current?.focus()}
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
              ref={areaRef}
              label="SERVICE AREA  (optional)"
              value={area}
              onChangeText={setArea}
              placeholder="e.g. Sector 14, Gurgaon"
              returnKeyType="next"
              onSubmitEditing={() => adminCodeRef.current?.focus()}
              colors={colors}
              autoCapitalize="words"
            />

            {/* Admin code */}
            <View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                ADMIN INVITE CODE  (optional)
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
                Ask your admin for their 6-character invite code to link your
                account to their organization.
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
            An OTP will be sent to verify your number. You consent to GPS,
            camera and movement logging during active shifts.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  legal: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 16,
    textAlign: "center",
  },
});
