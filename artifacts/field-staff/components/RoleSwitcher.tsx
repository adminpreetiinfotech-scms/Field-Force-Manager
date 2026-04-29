import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export function RoleSwitcher() {
  const colors = useColors();
  const { user, switchRole } = useApp();
  const role = user?.role || "staff";

  const onPick = async (target: "admin" | "staff") => {
    if (target === role) return;
    const next = await switchRole(target);
    if (next.role === "admin") router.replace("/(admin)/dashboard");
    else router.replace("/(staff)/shift");
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius + 4,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: colors.accent + "33" },
          ]}
        >
          <Feather name="shuffle" size={14} color={colors.foreground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Switch role for demo
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Hop between admin and staff views without signing out.
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.segment,
          {
            backgroundColor: colors.muted,
            borderColor: colors.border,
            borderRadius: 999,
          },
        ]}
      >
        <SegOption
          label="Field staff"
          icon="user"
          active={role === "staff"}
          onPress={() => onPick("staff")}
          colors={colors}
        />
        <SegOption
          label="Admin"
          icon="shield"
          active={role === "admin"}
          onPress={() => onPick("admin")}
          colors={colors}
        />
      </View>

      <View style={styles.hintRow}>
        <Feather name="info" size={11} color={colors.mutedForeground} />
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {Platform.OS === "web"
            ? "Demo identities are kept separate so each side keeps its own data."
            : "Each role uses a fixed demo identity — your test data stays per role."}
        </Text>
      </View>
    </View>
  );
}

function SegOption({
  label,
  icon,
  active,
  onPress,
  colors,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.segOpt,
        {
          backgroundColor: active ? colors.primary : "transparent",
          borderRadius: 999,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Feather
        name={icon}
        size={14}
        color={active ? "#fff" : colors.foreground}
      />
      <Text
        style={{
          color: active ? "#fff" : colors.foreground,
          fontSize: 13,
          fontFamily: "Inter_700Bold",
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  segment: {
    flexDirection: "row",
    padding: 4,
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segOpt: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
});
