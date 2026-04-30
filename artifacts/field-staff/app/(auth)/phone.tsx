import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
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
import { PillarsRow } from "@/components/PillarBadge";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

// Firebase requires a real DOM element to mount the invisible reCAPTCHA.
// It must exist in the component that calls signInWithPhoneNumber (this screen).
let RecaptchaDiv: React.FC | null = null;
if (Platform.OS === "web") {
  RecaptchaDiv = () => (
    <div id="recaptcha-container" style={{ position: "absolute", bottom: 0 }} />
  );
}

export default function PhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { requestOtp } = useApp();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const valid = phone.replace(/\D/g, "").length === 10;

  const onContinue = async () => {
    if (!valid) {
      Alert.alert("Invalid number", "Enter a valid 10-digit phone number.");
      return;
    }
    setLoading(true);
    try {
      await requestOtp(phone.replace(/\D/g, ""));
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      }
      router.push("/(auth)/otp");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Unknown error";
      Alert.alert("OTP Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.primary, "#13325F"]}
        style={[StyleSheet.absoluteFill, { height: 360 + insets.top + webTop }]}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 24 + webTop,
            paddingBottom: insets.bottom + 32 + (Platform.OS === "web" ? 34 : 0),
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back to welcome */}
          <View style={{ paddingHorizontal: 22, marginBottom: 4 }}>
            <Pressable
              onPress={() => router.replace("/(auth)/welcome")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
                opacity: pressed ? 0.7 : 1,
              })}
              hitSlop={8}
            >
              <Feather name="arrow-left" size={16} color="rgba(255,255,255,0.85)" />
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "Inter_500Medium" }}>
                Back
              </Text>
            </Pressable>
          </View>

          <View style={styles.headerWrap}>
            <View style={styles.brand}>
              <View
                style={[
                  styles.logoBadge,
                  { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14 },
                ]}
              >
                <Feather name="map-pin" size={20} color="#FCD34D" />
              </View>
              <View>
                <Text style={styles.brandTitle}>Field Staff Manager</Text>
                <Text style={styles.brandSub}>Operations command for the field</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>
              Sign in to start{"\n"}your shift
            </Text>
            <Text style={styles.heroSub}>
              Enter your registered phone number to receive an OTP.
            </Text>
            <View style={{ marginTop: 14 }}>
              <PillarsRow />
            </View>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius + 4,
                marginTop: 28,
              },
            ]}
          >
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
              <Text style={[styles.cc, { color: colors.foreground }]}>+91</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TextInput
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, "").slice(0, 10))}
                keyboardType="number-pad"
                placeholder="98765 43210"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  { color: colors.foreground, fontFamily: "Inter_500Medium" },
                ]}
                maxLength={10}
                autoFocus
              />
            </View>
            <Button
              label="Send OTP"
              onPress={onContinue}
              loading={loading}
              disabled={!valid}
              size="lg"
              fullWidth
              style={{ marginTop: 14 }}
              icon={<Feather name="arrow-right" size={18} color="#fff" />}
            />
            <Text style={[styles.legal, { color: colors.mutedForeground }]}>
              By continuing you agree to the field operations policy and consent to
              GPS, camera and movement logging during active shifts.
            </Text>
          </View>

          {/* Register link */}
          <Pressable
            onPress={() => router.replace("/(auth)/welcome")}
            style={({ pressed }) => ({
              marginHorizontal: 18,
              marginTop: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 12,
              borderRadius: colors.radius,
              backgroundColor: "rgba(255,255,255,0.08)",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Feather name="user-plus" size={14} color="rgba(255,255,255,0.85)" />
            <Text
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 13,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              New here? Register your account
            </Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
      {RecaptchaDiv && <RecaptchaDiv />}
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 22,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 36,
  },
  logoBadge: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  brandSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  heroSub: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 10,
    lineHeight: 20,
    maxWidth: 320,
  },
  card: {
    marginHorizontal: 18,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#0B2545",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
    height: 54,
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
    fontSize: 17,
    letterSpacing: 1.2,
  },
  legal: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 14,
  },
  demoCard: {
    marginHorizontal: 18,
    marginTop: 18,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
  },
  demoTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  demoText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 17,
  },
});
