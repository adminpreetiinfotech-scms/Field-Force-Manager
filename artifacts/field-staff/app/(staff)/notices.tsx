import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useNotices, type NoticeItem } from "@/hooks/useNotices";

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#DC2626",
  important: "#D97706",
  normal: "#0B2545",
};

const PRIORITY_BG: Record<string, string> = {
  urgent: "#FEF2F2",
  important: "#FFFBEB",
  normal: "#EFF6FF",
};

const PRIORITY_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  urgent: "alert-octagon",
  important: "alert-triangle",
  normal: "bell",
};

const TYPE_LABEL: Record<string, string> = {
  notice: "Notice",
  alert: "Alert",
  reminder: "Reminder",
};

// ─── Notice Card ──────────────────────────────────────────────────────────────

function NoticeCard({ notice, onRead }: { notice: NoticeItem; onRead: (id: string) => void }) {
  const colors  = useColors();
  const isUnread = !notice.readAt;
  const pColor  = PRIORITY_COLOR[notice.priority] ?? colors.primary;
  const pBg     = PRIORITY_BG[notice.priority]    ?? colors.muted;
  const pIcon   = PRIORITY_ICON[notice.priority]  ?? "bell";
  const typeLabel = TYPE_LABEL[notice.type] ?? notice.type;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isUnread ? pColor + "55" : colors.border,
          borderLeftWidth: isUnread ? 4 : 1,
        },
      ]}
    >
      {isUnread && <View style={[styles.unreadDot, { backgroundColor: pColor }]} />}
      <View style={styles.cardHead}>
        <View style={[styles.pBadge, { backgroundColor: pBg }]}>
          <Feather name={pIcon} size={12} color={pColor} />
          <Text style={[styles.pBadgeText, { color: pColor }]}>
            {notice.priority.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.typeText, { color: colors.mutedForeground }]}>{typeLabel}</Text>
        {notice.readAt && <Feather name="check-circle" size={14} color="#059669" />}
      </View>

      <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: isUnread ? "Inter_700Bold" : "Inter_600SemiBold" }]}>
        {notice.title}
      </Text>
      <Text style={[styles.cardMsg, { color: colors.mutedForeground }]}>{notice.message}</Text>
      <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
        🕐 {fmtDate(notice.createdAt)}
      </Text>

      {notice.readAt && (
        <Text style={[styles.readText, { color: "#059669" }]}>
          ✓ Read: {fmtDate(notice.readAt)}
        </Text>
      )}

      {isUnread && (
        <TouchableOpacity
          onPress={() => onRead(notice.id)}
          style={[styles.readBtn, { backgroundColor: pColor }]}
        >
          <Feather name="check" size={14} color="#fff" />
          <Text style={styles.readBtnText}>Mark as Read</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StaffNoticesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();

  const { notices, unreadCount, loading, markRead, refresh } = useNotices({
    phone: user?.phone,
    enabled: !!user?.phone,
    pollIntervalMs: 30_000,
  });

  const unread = notices.filter((n) => !n.readAt);
  const read   = notices.filter((n) => !!n.readAt);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, "#1E4080"]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View>
          <Text style={styles.headerTitle}>Notices & Alerts</Text>
          <Text style={styles.headerSub}>
            {unreadCount > 0 ? `${unreadCount} unread notice${unreadCount > 1 ? "s" : ""}` : "Sab notices padhli hain"}
          </Text>
        </View>
        <View style={[styles.bellBadge, { backgroundColor: unreadCount > 0 ? "#DC2626" : "#059669" }]}>
          <Feather name="bell" size={16} color="#fff" />
          <Text style={styles.bellBadgeText}>{unreadCount}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} colors={[colors.primary]} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
      >
        {/* Unread Section */}
        {unread.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <View style={[styles.sectionDot, { backgroundColor: "#DC2626" }]} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Unread ({unread.length})
              </Text>
            </View>
            {unread.map((n) => (
              <NoticeCard key={n.id} notice={n} onRead={markRead} />
            ))}
          </>
        )}

        {/* Read History */}
        {read.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <View style={[styles.sectionDot, { backgroundColor: "#059669" }]} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                Read History ({read.length})
              </Text>
            </View>
            {read.map((n) => (
              <NoticeCard key={n.id} notice={n} onRead={markRead} />
            ))}
          </>
        )}

        {/* Empty state */}
        {!loading && notices.length === 0 && (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="bell-off" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Koi notice nahi</Text>
            <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>
              Admin ki taraf se koi notice abhi nahi aaya hai.
            </Text>
          </View>
        )}

        {loading && notices.length === 0 && (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  bellBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bellBadgeText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  pBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  typeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  cardMsg: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  readText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 10,
  },
  readBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 48,
    alignItems: "center",
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginTop: 16,
  },
  emptyMsg: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
  },
});
