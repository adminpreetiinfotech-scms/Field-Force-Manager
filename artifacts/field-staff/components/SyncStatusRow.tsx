/**
 * SyncStatusRow — always-visible compact sync status strip.
 *
 * Shows:
 *   • Online / Offline indicator dot
 *   • Pending queue count badge (hidden when 0)
 *   • Last sync time ("Synced 2m ago" / "Never synced")
 *   • "Sync now" icon button while online
 */
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useColors } from "@/hooks/useColors";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SyncStatusRow() {
  const colors = useColors();
  const sync = useSyncStatus();

  // Tick every second so "last sync" time stays fresh
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Spin animation for the sync icon while draining
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!sync.draining) { spinAnim.setValue(0); return; }
    const anim = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [sync.draining, spinAnim]);
  const spinDeg = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // Colours based on state
  const isOffline = !sync.isOnline;
  const hasPending = sync.pendingCount > 0;

  const dotColor = isOffline
    ? colors.mutedForeground
    : hasPending
    ? colors.warning
    : colors.success;

  const labelColor = isOffline
    ? colors.mutedForeground
    : hasPending
    ? colors.warning
    : colors.success;

  const syncLabel = sync.lastSyncAt
    ? `Synced ${fmtAge(now - sync.lastSyncAt)}`
    : "Never synced";

  const statusLabel = isOffline
    ? "Offline"
    : sync.draining
    ? "Syncing…"
    : "Online";

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius - 2,
        },
      ]}
    >
      {/* Left — online dot + status */}
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={[styles.statusText, { color: labelColor }]}>
          {statusLabel}
        </Text>

        {/* Pending count badge */}
        {hasPending && (
          <View style={[styles.badge, { backgroundColor: colors.warning + "22", borderColor: colors.warning + "44" }]}>
            <Text style={[styles.badgeText, { color: colors.warning }]}>
              {sync.pendingCount} pending
            </Text>
          </View>
        )}
      </View>

      {/* Right — last sync time + sync button */}
      <View style={styles.right}>
        <Text style={[styles.lastSync, { color: colors.mutedForeground }]}>
          {syncLabel}
        </Text>

        {sync.isOnline && (
          <Pressable
            onPress={sync.syncNowImmediate}
            disabled={sync.draining}
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed || sync.draining ? 0.5 : 1 })}
          >
            <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
              <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
            </Animated.View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lastSync: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
