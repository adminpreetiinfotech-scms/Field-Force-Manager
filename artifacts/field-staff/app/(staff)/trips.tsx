import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { Trip, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function TripsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, trips } = useApp();

  const mine = useMemo(
    () =>
      trips
        .filter((t) => t.staffId === user?.id)
        .sort((a, b) => b.startedAt - a.startedAt),
    [trips, user?.id],
  );

  const today = new Date().toISOString().slice(0, 10);
  const todayKm = mine
    .filter((t) => t.date === today)
    .reduce((s, t) => s + t.km, 0);
  const weekKm = mine
    .filter((t) => Date.now() - t.startedAt < 7 * 86400000)
    .reduce((s, t) => s + t.km, 0);

  const webBottomPad = Platform.OS === "web" ? 84 : 84;
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top + 12 + webTop,
          paddingHorizontal: 22,
          paddingBottom: 14,
        }}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Trips</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Auto-tracked using GPS while you're on shift.
        </Text>
        <View style={[styles.row, { marginTop: 14 }]}>
          <StatCard
            label="Today"
            value={`${todayKm.toFixed(1)} km`}
            icon="navigation"
            tint={colors.pillarAccuracy}
          />
          <StatCard
            label="This week"
            value={`${weekKm.toFixed(1)} km`}
            icon="trending-up"
            tint={colors.pillarTransparency}
          />
        </View>
      </View>

      <FlatList<Trip>
        data={mine}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + webBottomPad + 16,
          gap: 10,
        }}
        ListEmptyComponent={
          <EmptyState
            icon="map"
            title="No trips logged"
            subtitle="Trips will appear here automatically once you check in for a shift."
          />
        }
        renderItem={({ item }) => {
          const isActive = item.endedAt === null;
          const duration = (item.endedAt || Date.now()) - item.startedAt;
          const hours = Math.floor(duration / 3600000);
          const minutes = Math.floor((duration % 3600000) / 60000);
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
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor:
                        (isActive ? colors.success : colors.primary) + "1A",
                      borderRadius: 12,
                    },
                  ]}
                >
                  <Feather
                    name="navigation"
                    size={16}
                    color={isActive ? colors.success : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 18,
                      fontFamily: "Inter_700Bold",
                      letterSpacing: -0.4,
                    }}
                  >
                    {item.km.toFixed(2)} km
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 12,
                      fontFamily: "Inter_400Regular",
                      marginTop: 1,
                    }}
                  >
                    {new Date(item.startedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      weekday: "short",
                    })}
                    {"  ·  "}
                    {hours}h {minutes}m
                  </Text>
                </View>
                {isActive ? (
                  <View
                    style={[
                      styles.liveBadge,
                      { backgroundColor: colors.success + "1F" },
                    ]}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        backgroundColor: colors.success,
                        borderRadius: 999,
                      }}
                    />
                    <Text
                      style={{
                        color: colors.success,
                        fontSize: 10,
                        fontFamily: "Inter_700Bold",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Live
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.syncBadge,
                      {
                        backgroundColor:
                          (item.synced ? colors.success : colors.warning) + "1F",
                      },
                    ]}
                  >
                    <Feather
                      name={item.synced ? "check" : "upload-cloud"}
                      size={11}
                      color={item.synced ? colors.success : colors.warning}
                    />
                  </View>
                )}
              </View>
              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />
              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 11,
                      fontFamily: "Inter_500Medium",
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    Started
                  </Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 13,
                      fontFamily: "Inter_600SemiBold",
                      marginTop: 2,
                    }}
                  >
                    {new Date(item.startedAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                <View
                  style={[styles.dottedLine, { borderColor: colors.border }]}
                />
                <View style={[styles.timeCol, { alignItems: "flex-end" }]}>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 11,
                      fontFamily: "Inter_500Medium",
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    Ended
                  </Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 13,
                      fontFamily: "Inter_600SemiBold",
                      marginTop: 2,
                    }}
                  >
                    {item.endedAt
                      ? new Date(item.endedAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Active"}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  row: { flexDirection: "row", gap: 10 },
  card: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  liveBadge: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  syncBadge: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  divider: { height: StyleSheet.hairlineWidth },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeCol: { flex: 0 },
  dottedLine: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
});
