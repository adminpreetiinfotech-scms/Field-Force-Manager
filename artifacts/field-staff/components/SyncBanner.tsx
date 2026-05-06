import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, Modal, ScrollView, TouchableOpacity } from "react-native";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function fmtCountdown(seconds: number | null): string {
  if (seconds === null) return "";
  if (seconds === 0)   return "retrying…";
  if (seconds < 60)   return `retry in ${seconds}s`;
  return `retry in ${Math.ceil(seconds / 60)}m`;
}

// ── Main Banner ───────────────────────────────────────────────────────────────

export function SyncBanner() {
  const colors = useColors();
  const { unsyncedCount, syncNow } = useApp();
  const sync = useSyncStatus();

  const total = Math.max(unsyncedCount, sync.pendingCount);

  // Animated opacity for show/hide
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: total > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [total, opacity]);

  // Success flash when queue fully clears
  const prevTotal = useRef(total);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prevTotal.current > 0 && total === 0) {
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(flashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
    prevTotal.current = total;
  }, [total, flashOpacity]);

  const [showDetail, setShowDetail] = useState(false);

  if (total === 0) {
    // Still render flash overlay even when banner is gone
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.flash, { backgroundColor: "#22c55e22", opacity: flashOpacity }]}
      >
        <View style={styles.flashRow}>
          <Feather name="check-circle" size={14} color="#16a34a" />
          <Text style={styles.flashText}>All records synced</Text>
        </View>
      </Animated.View>
    );
  }

  const statusText = !sync.isOnline
    ? "Device offline — data saved locally"
    : sync.draining
    ? "Syncing…"
    : sync.secondsUntilRetry !== null
    ? fmtCountdown(sync.secondsUntilRetry)
    : "Waiting to upload";

  const bannerBg = !sync.isOnline
    ? colors.mutedForeground + "18"
    : colors.warning + "14";
  const bannerBorder = !sync.isOnline
    ? colors.mutedForeground + "33"
    : colors.warning + "33";
  const dotColor = !sync.isOnline ? colors.mutedForeground : colors.warning;

  return (
    <>
      <Animated.View
        style={[
          styles.wrap,
          {
            backgroundColor: bannerBg,
            borderColor: bannerBorder,
            borderRadius: colors.radius,
            opacity,
          },
        ]}
      >
        <Pressable style={styles.left} onPress={() => setShowDetail(true)}>
          {/* Pulsing dot */}
          <PulsingDot color={dotColor} active={sync.draining} />
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {total} record{total === 1 ? "" : "s"} pending sync
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {statusText}
              {sync.isOnline && sync.pendingCount > 0 && !sync.draining && (
                <Text style={{ color: colors.mutedForeground }}> · tap for details</Text>
              )}
            </Text>
          </View>
        </Pressable>

        {/* Network badge */}
        {!sync.isOnline && (
          <View style={[styles.offlineBadge, { backgroundColor: colors.mutedForeground + "22" }]}>
            <Feather name="wifi-off" size={11} color={colors.mutedForeground} />
          </View>
        )}

        {/* Sync button */}
        {sync.isOnline && (
          <Pressable
            onPress={() => { sync.syncNowImmediate(); void syncNow(); }}
            disabled={sync.draining}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: sync.draining ? dotColor + "88" : dotColor,
                borderRadius: colors.radius - 4,
                opacity: pressed || sync.draining ? 0.7 : 1,
              },
            ]}
          >
            <Feather
              name={sync.draining ? "loader" : "refresh-cw"}
              size={13}
              color="#fff"
            />
            <Text style={styles.btnText}>
              {sync.draining ? "Syncing" : "Sync"}
            </Text>
          </Pressable>
        )}
      </Animated.View>

      {/* Detail sheet */}
      <SyncDetailSheet
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        sync={sync}
        onSyncNow={() => { sync.syncNowImmediate(); void syncNow(); }}
        colors={colors}
      />
    </>
  );
}

// ── Pulsing dot ───────────────────────────────────────────────────────────────

function PulsingDot({ color, active }: { color: string; active: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) { pulse.setValue(1); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active, pulse]);

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color, borderRadius: 999, opacity: pulse }]}
    />
  );
}

// ── Detail sheet ──────────────────────────────────────────────────────────────

function SyncDetailSheet({
  visible, onClose, sync, onSyncNow, colors,
}: {
  visible: boolean;
  onClose: () => void;
  sync: ReturnType<typeof useSyncStatus>;
  onSyncNow: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const now = Date.now();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
            Pending Sync Queue
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Network status */}
        <View style={[styles.networkRow, { backgroundColor: sync.isOnline ? "#22c55e18" : "#f9731618", borderColor: sync.isOnline ? "#22c55e33" : "#f9731633" }]}>
          <Feather
            name={sync.isOnline ? "wifi" : "wifi-off"}
            size={13}
            color={sync.isOnline ? "#16a34a" : "#ea580c"}
          />
          <Text style={[styles.networkText, { color: sync.isOnline ? "#16a34a" : "#ea580c" }]}>
            {sync.isOnline ? "Network reachable" : "Device offline — retrying when online"}
          </Text>
        </View>

        {/* Items list */}
        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {sync.queueItems.length === 0 ? (
            <View style={styles.emptySheet}>
              <Feather name="check-circle" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Queue is empty</Text>
            </View>
          ) : (
            sync.queueItems.map((item) => (
              <View
                key={item.id}
                style={[styles.itemRow, { borderColor: colors.border, backgroundColor: colors.background }]}
              >
                <View style={[styles.kindBadge, { backgroundColor: kindColor(item.body.kind) + "22" }]}>
                  <Text style={[styles.kindText, { color: kindColor(item.body.kind) }]}>
                    {item.body.kind}
                  </Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemAge, { color: colors.mutedForeground }]}>
                    Queued {fmtAge(now - item.queuedAt)} · attempt {item.attempts}/{10}
                  </Text>
                  {item.lastError && (
                    <Text style={[styles.itemError, { color: "#dc2626" }]} numberOfLines={2}>
                      {item.lastError}
                    </Text>
                  )}
                  {item.nextRetryAt > now && (
                    <Text style={[styles.itemRetry, { color: colors.mutedForeground }]}>
                      Next retry in {Math.ceil((item.nextRetryAt - now) / 1000)}s
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.sheetFooter}>
          {sync.lastSyncAt && (
            <Text style={[styles.lastSync, { color: colors.mutedForeground }]}>
              Last sync: {fmtAge(now - sync.lastSyncAt)}
            </Text>
          )}
          <TouchableOpacity
            onPress={() => { onSyncNow(); onClose(); }}
            disabled={sync.draining || !sync.isOnline}
            style={[
              styles.syncBtn,
              {
                backgroundColor: sync.isOnline ? colors.primary ?? "#6366f1" : colors.mutedForeground,
                opacity: (sync.draining || !sync.isOnline) ? 0.6 : 1,
              },
            ]}
          >
            <Feather name="refresh-cw" size={14} color="#fff" />
            <Text style={styles.syncBtnText}>
              {sync.draining ? "Syncing…" : "Retry Now"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function kindColor(kind: string): string {
  switch (kind) {
    case "checkin":    return "#0284c7";
    case "checkout":   return "#7c3aed";
    case "trip-start": return "#059669";
    case "trip-end":   return "#d97706";
    case "meter":      return "#db2777";
    default:           return "#64748b";
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  left:     { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  textCol:  { flex: 1 },
  dot:      { width: 8, height: 8, flexShrink: 0 },
  title:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sub:      { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  offlineBadge: { padding: 6, borderRadius: 6 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Flash
  flash:    { position: "absolute", top: 0, left: 0, right: 0, padding: 10, zIndex: 999 },
  flashRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  flashText:{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#16a34a" },

  // Modal
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: "#00000044" },
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  networkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  networkText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sheetList:  { paddingHorizontal: 16 },
  emptySheet: { alignItems: "center", justifyContent: "center", paddingVertical: 32, gap: 10 },
  emptyText:  { fontSize: 14, fontFamily: "Inter_400Regular" },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  kindBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  kindText:  { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  itemInfo:  { flex: 1, gap: 2 },
  itemAge:   { fontSize: 11, fontFamily: "Inter_400Regular" },
  itemError: { fontSize: 11, fontFamily: "Inter_400Regular" },
  itemRetry: { fontSize: 10, fontFamily: "Inter_400Regular" },
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  lastSync:   { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  syncBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
