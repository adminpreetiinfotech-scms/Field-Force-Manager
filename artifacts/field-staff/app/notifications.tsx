import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

type Notification = {
  id: string;
  candidateId: string;
  candidateName: string;
  message: string;
  isRead: boolean;
  createdAt: string | null;
};

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user?.phone) return;
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/notifications?phone=${encodeURIComponent(user.phone)}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json() as Notification[];
      setNotifications(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [user?.phone]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }, [fetchNotifications]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const markRead = async (id: string) => {
    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch {
      // non-fatal
    }
  };

  const markAllRead = async () => {
    if (!user?.phone) return;
    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/api/notifications/read-all`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: user.phone }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // non-fatal
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getNotifIcon = (message: string) => {
    if (message.includes("approved") || message.includes("verified")) return "check-circle";
    if (message.includes("rejected")) return "x-circle";
    if (message.includes("enrolled")) return "award";
    return "bell";
  };

  const getNotifColor = (message: string, isRead: boolean) => {
    if (isRead) return colors.mutedForeground;
    if (message.includes("approved") || message.includes("verified")) return "#059669";
    if (message.includes("rejected")) return "#DC2626";
    if (message.includes("enrolled")) return "#7C3AED";
    return colors.primary;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[ss.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + webTop }]}>
        <Pressable onPress={() => router.back()} style={ss.iconBtn} hitSlop={12}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[ss.headerTitle, { color: colors.foreground }]}>
          Notifications{unreadCount > 0 ? ` (${unreadCount} new)` : ""}
        </Text>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead} style={ss.iconBtn} hitSlop={8}>
            <Feather name="check-square" size={18} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {loading ? (
        <View style={ss.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[ss.loadingText, { color: colors.mutedForeground }]}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={ss.center}>
          <Feather name="alert-circle" size={36} color="#EF4444" />
          <Text style={[ss.errorText, { color: "#EF4444" }]}>{error}</Text>
          <Pressable onPress={handleRefresh} style={[ss.retryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
            <Text style={ss.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[ss.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {notifications.length === 0 ? (
            <View style={ss.empty}>
              <Feather name="bell-off" size={40} color={colors.mutedForeground} />
              <Text style={[ss.emptyTitle, { color: colors.foreground }]}>No notifications</Text>
              <Text style={[ss.emptySub, { color: colors.mutedForeground }]}>
                You'll be notified when your candidates are approved or rejected.
              </Text>
            </View>
          ) : (
            notifications.map((n) => {
              const iconColor = getNotifColor(n.message, n.isRead);
              const iconName = getNotifIcon(n.message);
              return (
                <Pressable
                  key={n.id}
                  onPress={() => { if (!n.isRead) void markRead(n.id); }}
                  style={({ pressed }) => [ss.notifCard, {
                    backgroundColor: n.isRead ? colors.card : (iconColor + "08"),
                    borderColor: n.isRead ? colors.border : (iconColor + "33"),
                    borderRadius: colors.radius + 2,
                    opacity: pressed ? 0.85 : 1,
                  }]}
                >
                  <View style={[ss.notifIcon, { backgroundColor: iconColor + "18", borderRadius: 20 }]}>
                    <Feather name={iconName as "check-circle"} size={20} color={iconColor} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[ss.notifCandidate, { color: n.isRead ? colors.mutedForeground : colors.foreground }]}>
                      {n.candidateName}
                    </Text>
                    <Text style={[ss.notifMessage, { color: n.isRead ? colors.mutedForeground : colors.foreground }]}>
                      {n.message}
                    </Text>
                    <Text style={[ss.notifDate, { color: colors.mutedForeground }]}>
                      {formatDate(n.createdAt)}
                    </Text>
                  </View>
                  {!n.isRead && (
                    <View style={[ss.unreadDot, { backgroundColor: iconColor }]} />
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3, textAlign: "center" },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 16, gap: 10 },
  notifCard: { flexDirection: "row", alignItems: "flex-start", padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  notifIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginTop: 2 },
  notifCandidate: { fontSize: 13, fontFamily: "Inter_700Bold" },
  notifMessage: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  notifDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 280 },
});
