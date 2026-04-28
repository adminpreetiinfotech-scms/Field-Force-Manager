import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "accent";
type Size = "sm" | "md" | "lg";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  fullWidth,
  icon,
  style,
  testID,
}: Props) {
  const colors = useColors();
  const heights: Record<Size, number> = { sm: 38, md: 48, lg: 56 };
  const fontSizes: Record<Size, number> = { sm: 14, md: 15, lg: 16 };

  const palette = (() => {
    switch (variant) {
      case "primary":
        return { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary };
      case "secondary":
        return { bg: colors.secondary, fg: colors.secondaryForeground, border: colors.secondary };
      case "ghost":
        return { bg: "transparent", fg: colors.foreground, border: colors.border };
      case "destructive":
        return { bg: colors.destructive, fg: colors.destructiveForeground, border: colors.destructive };
      case "accent":
        return { bg: colors.accent, fg: colors.accentForeground, border: colors.accent };
    }
  })();

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (disabled || loading) return;
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }
        onPress?.();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          height: heights[size],
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderRadius: colors.radius,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text
            style={{
              color: palette.fg,
              fontSize: fontSizes[size],
              fontFamily: "Inter_600SemiBold",
              letterSpacing: 0.2,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
