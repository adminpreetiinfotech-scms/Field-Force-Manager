import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export function SyncBanner() {
  const colors = useColors();
  const { unsyncedCount, syncNow } = useApp();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: unsyncedCount > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [unsyncedCount, opacity]);

  if (unsyncedCount === 0) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.warning + "14",
          borderColor: colors.warning + "33",
          borderRadius: colors.radius,
          opacity,
        },
      ]}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.dot,
            { backgroundColor: colors.warning, borderRadius: 999 },
          ]}
        />
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {unsyncedCount} record{unsyncedCount === 1 ? "" : "s"} pending sync
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Saved locally — will upload when online
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => syncNow()}
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: colors.warning,
            borderRadius: colors.radius - 4,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Feather name="refresh-cw" size={13} color="#fff" />
        <Text style={styles.btnText}>Sync</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dot: { width: 8, height: 8 },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
