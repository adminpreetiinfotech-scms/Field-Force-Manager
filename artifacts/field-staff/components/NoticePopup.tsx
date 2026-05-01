import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { NoticeItem } from "@/hooks/useNotices";

// ─── Priority config ──────────────────────────────────────────────────────────

type PriorityMeta = {
  color: string;
  bg: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
};

function usePriorityMeta(priority: string): PriorityMeta {
  const colors = useColors();
  const map: Record<string, PriorityMeta> = {
    urgent: { color: "#DC2626", bg: "#FEF2F2", icon: "alert-octagon", label: "URGENT" },
    important: { color: "#D97706", bg: "#FFFBEB", icon: "alert-triangle", label: "IMPORTANT" },
    normal: { color: colors.primary, bg: colors.secondary, icon: "bell", label: "NOTICE" },
  };
  return map[priority] ?? map.normal!;
}

// ─── Type Icon ────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  notice: "file-text",
  alert: "alert-circle",
  reminder: "clock",
};

// ─── Single Notice Sheet ──────────────────────────────────────────────────────

type NoticeSheetProps = {
  notice: NoticeItem;
  onRead: (id: string) => void;
  onViewAll: () => void;
  isUrgent: boolean;
  totalUnread: number;
};

function NoticeSheet({ notice, onRead, onViewAll, isUrgent, totalUnread }: NoticeSheetProps) {
  const colors = useColors();
  const meta   = usePriorityMeta(notice.priority);
  const slideAnim = React.useRef(new Animated.Value(isUrgent ? 0 : 300)).current;
  const fadeAnim  = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const fmtDate = (iso: string) => {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  const typeIcon = TYPE_ICON[notice.type] ?? "bell";

  if (isUrgent) {
    return (
      <Animated.View style={[styles.urgentContent, { backgroundColor: colors.card, opacity: fadeAnim }]}>
        {/* Red top strip */}
        <View style={[styles.urgentStrip, { backgroundColor: meta.color }]}>
          <Feather name="alert-octagon" size={28} color="#fff" />
          <Text style={styles.urgentStripLabel}>URGENT NOTICE</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: colors.foreground }]}>{notice.title}</Text>
          <Text style={[styles.dateLine, { color: colors.mutedForeground }]}>
            🕐 {fmtDate(notice.createdAt)}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.message, { color: colors.foreground }]}>{notice.message}</Text>
          {totalUnread > 1 && (
            <View style={[styles.moreBadge, { backgroundColor: "#FEF2F2", borderColor: meta.color }]}>
              <Text style={{ color: meta.color, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                +{totalUnread - 1} more unread notice{totalUnread - 1 > 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.actions, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: colors.border }]}
            onPress={onViewAll}
          >
            <Text style={[styles.btnSecText, { color: colors.mutedForeground }]}>View All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: meta.color }]}
            onPress={() => onRead(notice.id)}
          >
            <Feather name="check" size={16} color="#fff" />
            <Text style={styles.btnPrimaryText}>Acknowledge</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  // Normal / Important — bottom sheet style
  return (
    <Pressable style={styles.backdrop} onPress={() => onRead(notice.id)}>
      <Pressable onPress={(e) => e.stopPropagation()}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Priority badge */}
          <View style={[styles.priorityBadge, { backgroundColor: meta.bg }]}>
            <Feather name={meta.icon} size={14} color={meta.color} />
            <Text style={[styles.priorityLabel, { color: meta.color }]}>{meta.label}</Text>
            <View style={{ flex: 1 }} />
            <Feather name={typeIcon} size={14} color={colors.mutedForeground} />
            <Text style={[styles.typeLabel, { color: colors.mutedForeground }]}>
              {notice.type.charAt(0).toUpperCase() + notice.type.slice(1)}
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.foreground, paddingHorizontal: 20, marginTop: 14 }]}>
            {notice.title}
          </Text>
          <Text style={[styles.dateLine, { color: colors.mutedForeground, paddingHorizontal: 20 }]}>
            🕐 {fmtDate(notice.createdAt)}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border, marginHorizontal: 20 }]} />
          <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
            <Text style={[styles.message, { color: colors.foreground }]}>{notice.message}</Text>
          </ScrollView>

          {totalUnread > 1 && (
            <View style={[styles.moreBadge, { marginHorizontal: 20, backgroundColor: meta.bg, borderColor: meta.color + "55" }]}>
              <Text style={{ color: meta.color, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                +{totalUnread - 1} more unread notice{totalUnread - 1 > 1 ? "s" : ""}
              </Text>
            </View>
          )}

          <View style={[styles.actions, { borderTopColor: colors.border, paddingBottom: 32 }]}>
            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: colors.border }]}
              onPress={onViewAll}
            >
              <Text style={[styles.btnSecText, { color: colors.mutedForeground }]}>View All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: meta.color }]}
              onPress={() => onRead(notice.id)}
            >
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.btnPrimaryText}>Mark as Read</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </Pressable>
  );
}

// ─── Main Exported Component ──────────────────────────────────────────────────

type NoticePopupProps = {
  notice: NoticeItem | null;
  totalUnread: number;
  onRead: (id: string) => void;
  noticesRoute: string; // e.g. "/(admin)/notices" or "/(staff)/notices"
};

export function NoticePopup({ notice, totalUnread, onRead, noticesRoute }: NoticePopupProps) {
  const isUrgent = notice?.priority === "urgent";

  const handleViewAll = () => {
    // Mark current as read before navigating
    if (notice) onRead(notice.id);
    router.push(noticesRoute as never);
  };

  if (!notice) return null;

  return (
    <Modal
      visible
      transparent
      animationType={isUrgent ? "fade" : "none"}
      statusBarTranslucent
      onRequestClose={() => {
        if (!isUrgent) onRead(notice.id);
      }}
    >
      <NoticeSheet
        notice={notice}
        onRead={onRead}
        onViewAll={handleViewAll}
        isUrgent={isUrgent}
        totalUnread={totalUnread}
      />
    </Modal>
  );
}

// ─── Notification Bell ────────────────────────────────────────────────────────

type NotifBellProps = {
  count: number;
  onPress: () => void;
  light?: boolean;
};

export function NotifBell({ count, onPress, light = false }: NotifBellProps) {
  const colors = useColors();
  return (
    <TouchableOpacity onPress={onPress} style={styles.bellWrap} hitSlop={8}>
      <Feather name="bell" size={22} color={light ? "#fff" : colors.foreground} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : String(count)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  urgentContent: {
    flex: 1,
  },
  urgentStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  urgentStripLabel: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    alignSelf: "center",
    marginBottom: 16,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  priorityLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  typeLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    lineHeight: 26,
  },
  dateLine: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    marginBottom: 14,
  },
  message: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
    paddingBottom: 16,
  },
  moreBadge: {
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  btnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  btnSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  bellWrap: {
    position: "relative",
    padding: 4,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#DC2626",
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    lineHeight: 14,
  },
});
