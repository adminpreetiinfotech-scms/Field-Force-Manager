import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

export default function OtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { verifyOtp, pendingPhone, requestOtp } = useApp();
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 3) inputs.current[i + 1]?.focus();
    if (next.every((d) => d.length === 1)) {
      onVerify(next.join(""));
    }
  };

  const onKeyPress = (i: number, key: string) => {
    if (key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const onVerify = async (code?: string) => {
    const otp = code || digits.join("");
    if (otp.length !== 4) {
      Alert.alert("Incomplete", "Enter all 4 digits.");
      return;
    }
    setLoading(true);
    try {
      const u = await verifyOtp(otp);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      }
      if (u.role === "admin") router.replace("/(admin)/dashboard");
      else router.replace("/(staff)");
    } catch (e: any) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
      }
      Alert.alert("Verification failed", e?.message || "Try again");
      setDigits(["", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (seconds > 0 || !pendingPhone) return;
    await requestOtp(pendingPhone);
    setSeconds(30);
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
            paddingBottom: insets.bottom + 24 + (Platform.OS === "web" ? 34 : 0),
            paddingHorizontal: 22,
          }}
          keyboardShouldPersistTaps="handled"
        >
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

          <View style={{ marginTop: 28 }}>
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
              <Feather name="lock" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Verify it's you
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Enter the 4-digit code sent to{" "}
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
                +91 {pendingPhone || "—"}
              </Text>
            </Text>
          </View>

          <View style={styles.row}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => {
                  inputs.current[i] = r;
                }}
                value={d}
                onChangeText={(v) => setDigit(i, v)}
                onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                style={[
                  styles.cell,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    borderColor: d ? colors.primary : colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              />
            ))}
          </View>

          <Button
            label="Verify & Continue"
            onPress={() => onVerify()}
            loading={loading}
            disabled={digits.join("").length !== 4}
            size="lg"
            fullWidth
            style={{ marginTop: 24 }}
          />

          <Pressable onPress={resend} disabled={seconds > 0} style={styles.resend}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
              Didn't get it?{" "}
            </Text>
            <Text
              style={{
                color: seconds > 0 ? colors.mutedForeground : colors.primary,
                fontSize: 13,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {seconds > 0 ? `Resend in ${seconds}s` : "Resend OTP"}
            </Text>
          </Pressable>

          <View
            style={[
              styles.hint,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Demo OTP: <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>1234</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

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
    marginBottom: 18,
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
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
  },
  cell: {
    flex: 1,
    height: 64,
    textAlign: "center",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    borderWidth: 1.5,
  },
  resend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginTop: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hintText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
