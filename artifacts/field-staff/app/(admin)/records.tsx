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
import { SyncBanner } from "@/components/SyncBanner";
import { AttendanceRecord, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function AdminRecords() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { attendance } = useApp();

  const data = useMemo<AttendanceRecord[]>(() => {
    return [...attendance].sort((a, b) => b.timestamp - a.timestamp);
  }, [attendance]);

  const webBottomPad = Platform.OS === "web" ? 84 : 84;
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top + 12 + webTop,
          paddingHorizontal: 22,
          paddingBottom: 12,
        }}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Records</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Tamper-resistant audit trail of every field event.
        </Text>


        <View style={{ marginTop: 14 }}>
          <SyncBanner />
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + webBottomPad + 16,
          gap: 8,
        }}
        ListEmptyComponent={
          <EmptyState
            icon="file-text"
            title="No attendance yet"
            subtitle="As staff log activity in the field, entries will appear here in real time."
          />
        }
        renderItem={({ item: a }) => (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius + 2,
              },
            ]}
          >
            <View
              style={[
                styles.icon,
                {
                  backgroundColor:
                    (a.type === "in" ? colors.success : colors.destructive) +
                    "1A",
                  borderRadius: 10,
                },
              ]}
            >
              <Feather
                name={a.type === "in" ? "log-in" : "log-out"}
                size={15}
                color={a.type === "in" ? colors.success : colors.destructive}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 13,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {a.staffName} · {a.type === "in" ? "Check in" : "Check out"}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                  marginTop: 2,
                }}
              >
                {new Date(a.timestamp).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {a.location
                  ? `  ·  ${a.location.latitude.toFixed(3)}, ${a.location.longitude.toFixed(3)}`
                  : "  ·  No GPS"}
              </Text>
            </View>
            <SyncDot synced={a.synced} />
          </View>
        )}
      />
    </View>
  );
}

function SyncDot({ synced }: { synced: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        backgroundColor: synced ? colors.success : colors.warning,
      }}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
});
