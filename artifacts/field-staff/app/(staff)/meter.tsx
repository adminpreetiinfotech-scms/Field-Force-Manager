import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { SyncBanner } from "@/components/SyncBanner";
import { MeterReading, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function MeterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, meterReadings } = useApp();

  const mine = useMemo(
    () =>
      meterReadings
        .filter((m) => m.staffId === user?.id)
        .sort((a, b) => b.timestamp - a.timestamp),
    [meterReadings, user?.id],
  );

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = mine.filter(
    (m) => new Date(m.timestamp).toISOString().slice(0, 10) === today,
  ).length;

  const webBottomPad = Platform.OS === "web" ? 84 : 84;
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top + 12 + webTop,
          paddingHorizontal: 22,
          paddingBottom: 14,
          backgroundColor: colors.background,
        }}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Meter readings
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {todayCount} today  ·  {mine.length} total
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/meter/add")}
            style={({ pressed }) => [
              styles.fab,
              {
                backgroundColor: colors.primary,
                borderRadius: 999,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            hitSlop={6}
          >
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        </View>
        <View style={{ marginTop: 12 }}>
          <SyncBanner />
        </View>
      </View>

      <FlatList<MeterReading>
        data={mine}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + webBottomPad + 16,
          gap: 10,
        }}
        ListEmptyComponent={
          <EmptyState
            icon="activity"
            title="No readings yet"
            subtitle="Tap the + button to capture your first meter reading with photo proof."
          />
        }
        renderItem={({ item }) => (
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
            <View style={styles.cardLeft}>
              {item.photoUri ? (
                <Image
                  source={{ uri: item.photoUri }}
                  style={[styles.thumb, { borderRadius: colors.radius - 2 }]}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.thumb,
                    {
                      backgroundColor: colors.muted,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: colors.radius - 2,
                    },
                  ]}
                >
                  <Feather
                    name="image"
                    size={20}
                    color={colors.mutedForeground}
                  />
                </View>
              )}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.titleRow}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 15,
                    fontFamily: "Inter_700Bold",
                  }}
                >
                  {item.reading} kWh
                </Text>
                <View
                  style={[
                    styles.syncBadge,
                    {
                      backgroundColor:
                        (item.synced ? colors.success : colors.warning) + "1F",
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: item.synced
                        ? colors.success
                        : colors.warning,
                    }}
                  />
                  <Text
                    style={{
                      color: item.synced ? colors.success : colors.warning,
                      fontSize: 10,
                      fontFamily: "Inter_600SemiBold",
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                    }}
                  >
                    {item.synced ? "Synced" : "Queued"}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 12,
                  fontFamily: "Inter_500Medium",
                }}
              >
                Consumer #{item.consumerNo}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {new Date(item.timestamp).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {item.location
                  ? `  ·  ${item.location.latitude.toFixed(3)}, ${item.location.longitude.toFixed(3)}`
                  : ""}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  fab: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0B2545",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  card: {
    flexDirection: "row",
    padding: 12,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardLeft: {},
  thumb: {
    width: 64,
    height: 64,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
