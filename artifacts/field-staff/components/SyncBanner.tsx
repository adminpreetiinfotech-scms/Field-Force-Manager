import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import {
  subscribeActivityQueueLength,
} from "@/services/activitySync";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export function SyncBanner() {
  const colors = useColors();
  const { unsyncedCount, syncNow } = useApp();
  const [apiPending, setApiPending] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = subscribeActivityQueueLength(setApiPending);
    return unsub;
  }, []);

  const total = Math.max(unsyncedCount, apiPending);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: total > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [total, opacity]);

  if (total === 0) return null;

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
            {total} record{total === 1 ? "" : "s"} pending sync
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {apiPending > 0
              ? "Waiting to upload — tap to retry now"
              : "Saved locally — will upload when online"}
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
