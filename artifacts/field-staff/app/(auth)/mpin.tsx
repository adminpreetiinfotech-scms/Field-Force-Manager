import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

const PIN_LENGTH = 4;

export default function MpinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loginWithMpin, setupMpin, pendingPhone, pendingRegistration } = useApp();
  const params = useLocalSearchParams<{ mode?: string }>();

  const isSetup = params.mode === "setup";
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phase, setPhase] = useState<"enter" | "confirm">("enter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activePin = phase === "confirm" ? confirm : pin;

  const setActivePin = useCallback(
    (v: string) => {
      if (phase === "confirm") setConfirm(v);
      else setPin(v);
    },
    [phase],
  );

  const submit = useCallback(
    async (value: string) => {
      if (value.length < PIN_LENGTH) return;

      if (isSetup) {
        if (phase === "enter") {
          setPhase("confirm");
          setConfirm("");
          setError("");
          return;
        }
        if (value !== pin) {
          setError("MPINs don't match. Try again.");
          setConfirm("");
          return;
        }
        setLoading(true);
        try {
          const { user, approvalStatus } = await setupMpin(pendingPhone!, pin);
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
          if (approvalStatus !== "approved") {
            router.replace({
              pathname: "/(auth)/pending-approval",
              params: { name: user.name, phone: user.phone, role: user.role },
            });
          } else if (user.role === "admin") {
            router.replace("/(admin)/dashboard");
          } else {
            router.replace("/(staff)/shift");
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Failed to set MPIN.";
          setError(msg);
          setPin("");
          setConfirm("");
          setPhase("enter");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(true);
        try {
          const user = await loginWithMpin(pendingPhone!, value);
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
          if (user.role === "admin") router.replace("/(admin)/dashboard");
          else router.replace("/(staff)/shift");
        } catch (e: unknown) {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          }
          const msg = e instanceof Error ? e.message : "Incorrect MPIN.";
          setError(msg);
          setPin("");
        } finally {
          setLoading(false);
        }
      }
    },
    [isSetup, phase, pin, confirm, pendingPhone, loginWithMpin, setupMpin],
  );

  const handleKey = useCallback(
    (key: string) => {
      if (loading) return;
      setError("");
      if (key === "⌫") {
        setActivePin(activePin.slice(0, -1));
        return;
      }
      if (activePin.length >= PIN_LENGTH) return;
      const next = activePin + key;
      setActivePin(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => submit(next), 80);
      }
    },
    [loading, activePin, setActivePin, submit],
  );

  const title = isSetup
    ? phase === "enter"
      ? "Create Your MPIN"
      : "Confirm Your MPIN"
    : "Enter Your MPIN";

  const subtitle = isSetup
    ? phase === "enter"
      ? "Choose a 4-digit PIN to secure your account"
      : "Re-enter the MPIN to confirm"
    : "Enter your 4-digit PIN to continue";

  const webTop = Platform.OS === "web" ? 67 : 0;

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Back */}
      <View
        style={{
          paddingTop: insets.top + 16 + webTop,
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          onPress={() => {
            if (isSetup && phase === "confirm") {
              setPhase("enter");
              setConfirm("");
              setError("");
            } else {
              router.back();
            }
          }}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 999,
            backgroundColor: colors.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Header */}
      <View style={{ paddingHorizontal: 28, marginTop: 28 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: colors.primary + "14",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.primary + "30",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <Feather name="lock" size={22} color={colors.primary} />
        </View>

        <Text
          style={{
            fontSize: 26,
            fontFamily: "Inter_700Bold",
            color: colors.foreground,
            letterSpacing: -0.4,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_400Regular",
            color: colors.mutedForeground,
            marginTop: 6,
            lineHeight: 20,
          }}
        >
          {subtitle}
        </Text>
        {pendingPhone ? (
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Inter_600SemiBold",
              color: colors.primary,
              marginTop: 4,
            }}
          >
            +91 {pendingPhone}
          </Text>
        ) : null}
      </View>

      {/* PIN dots */}
      <View
        style={{
          flexDirection: "row",
          gap: 18,
          justifyContent: "center",
          marginTop: 40,
        }}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < activePin.length;
          return (
            <View
              key={i}
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: filled ? colors.primary : "transparent",
                borderWidth: 2,
                borderColor: filled ? colors.primary : colors.border,
              }}
            />
          );
        })}
      </View>

      {/* Error */}
      {error ? (
        <Text
          style={{
            color: "#EF4444",
            fontSize: 13,
            fontFamily: "Inter_500Medium",
            textAlign: "center",
            marginTop: 14,
            paddingHorizontal: 24,
          }}
        >
          {error}
        </Text>
      ) : (
        <View style={{ height: 33 }} />
      )}

      {/* Numeric keypad */}
      <View
        style={{
          paddingHorizontal: 28,
          marginTop: 8,
          gap: 10,
        }}
      >
        {[0, 1, 2, 3].map((row) => (
          <View key={row} style={{ flexDirection: "row", gap: 10 }}>
            {keys.slice(row * 3, row * 3 + 3).map((key, j) => {
              const isEmpty = key === "";
              const isDelete = key === "⌫";
              return (
                <Pressable
                  key={`${row}-${j}`}
                  onPress={() => !isEmpty && handleKey(key)}
                  disabled={isEmpty || loading}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 68,
                    borderRadius: colors.radius + 4,
                    backgroundColor: isEmpty
                      ? "transparent"
                      : isDelete
                        ? colors.background
                        : colors.card,
                    borderWidth:
                      isEmpty || isDelete ? 0 : StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed && !isEmpty ? 0.65 : 1,
                  })}
                >
                  {isDelete ? (
                    <Feather
                      name="delete"
                      size={22}
                      color={colors.foreground}
                    />
                  ) : !isEmpty ? (
                    <Text
                      style={{
                        fontSize: 24,
                        fontFamily: "Inter_600SemiBold",
                        color: colors.foreground,
                      }}
                    >
                      {key}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Forgot MPIN (login mode only) */}
      {!isSetup && (
        <Pressable
          onPress={() =>
            Alert.alert(
              "Forgot MPIN?",
              "Please contact your administrator to reset your MPIN.",
              [{ text: "OK" }],
            )
          }
          style={({ pressed }) => ({
            alignItems: "center",
            marginTop: 22,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 14,
              fontFamily: "Inter_500Medium",
            }}
          >
            Forgot MPIN?
          </Text>
        </Pressable>
      )}

      {/* Step indicator for setup */}
      {isSetup && (
        <View
          style={{
            flexDirection: "row",
            gap: 6,
            justifyContent: "center",
            marginTop: 22,
          }}
        >
          {["enter", "confirm"].map((p) => (
            <View
              key={p}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  phase === p ? colors.primary : colors.primary + "30",
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
