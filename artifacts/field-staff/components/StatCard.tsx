import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  label: string;
  value: string;
  icon?: keyof typeof Feather.glyphMap;
  trend?: string;
  tint?: string;
  loading?: boolean;
  error?: boolean;
};

export function StatCard({
  label,
  value,
  icon,
  trend,
  tint,
  loading,
  error,
}: Props) {
  const colors = useColors();
  const accent = tint || colors.primary;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        {icon ? (
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: accent + "1A",
                borderRadius: colors.radius - 4,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <Feather name={icon} size={14} color={error ? colors.destructive : accent} />
            )}
          </View>
        ) : null}
      </View>

      {loading ? (
        <View
          style={[
            styles.skeleton,
            { backgroundColor: colors.mutedForeground + "22" },
          ]}
        />
      ) : (
        <Text
          style={[
            styles.value,
            { color: error ? colors.mutedForeground : colors.foreground },
          ]}
        >
          {value}
        </Text>
      )}

      {!loading && trend ? (
        <Text
          style={[
            styles.trend,
            { color: error ? colors.destructive : accent },
          ]}
        >
          {trend}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  skeleton: {
    height: 28,
    borderRadius: 6,
    marginTop: 2,
  },
  trend: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
