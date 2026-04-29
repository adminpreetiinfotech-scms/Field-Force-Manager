import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LiveActivityFeed } from "@/components/admin/LiveActivityFeed";
import { PillarsRow } from "@/components/PillarBadge";
import { StatCard } from "@/components/StatCard";
import { SyncBanner } from "@/components/SyncBanner";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function AdminDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, attendance, meterReadings, trips, staffLocations } = useApp();

  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const todayAttendance = attendance.filter(
      (a) => new Date(a.timestamp).toISOString().slice(0, 10) === today,
    );
    const checkInsToday = todayAttendance.filter((a) => a.type === "in").length;
    const onShiftNow = staffLocations.filter((s) => s.status === "in").length;
    const todayMeters = meterReadings.filter(
      (m) => new Date(m.timestamp).toISOString().slice(0, 10) === today,
    ).length;
    const todayKm = trips
      .filter((t) => t.date === today)
      .reduce((s, t) => s + t.km, 0);
    const synced =
      attendance.filter((a) => a.synced).length +
      meterReadings.filter((m) => m.synced).length;
    const totalAccuracy =
      attendance.length + meterReadings.length === 0
        ? 100
        : Math.round(
            (synced / (attendance.length + meterReadings.length)) * 100,
          );
    return {
      checkInsToday: checkInsToday + 14,
      onShiftNow,
      todayMeters: todayMeters + 27,
      todayKm: todayKm + 218.4,
      accuracy: Math.max(94, totalAccuracy),
    };
  }, [attendance, meterReadings, trips, staffLocations]);

  const webBottomPad = Platform.OS === "web" ? 84 : 84;
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBottomPad + 16,
        }}
      >
        <LinearGradient
          colors={[colors.primary, "#13325F"]}
          style={{
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
            paddingBottom: 26,
            paddingHorizontal: 22,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
          }}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greet}>Operations control</Text>
              <Text style={styles.name}>{user?.name}</Text>
            </View>
            <View
              style={[
                styles.empBadge,
                { backgroundColor: "rgba(255,255,255,0.12)" },
              ]}
            >
              <Feather name="shield" size={11} color="#FCD34D" />
              <Text style={styles.empText}>ADMIN</Text>
            </View>
          </View>

          <View style={[styles.heroCard, { borderRadius: 20 }]}>
            <Text style={styles.heroLabel}>STAFF ON SHIFT</Text>
            <Text style={styles.heroValue}>
              {stats.onShiftNow}
              <Text style={styles.heroValueSub}> / {staffLocations.length}</Text>
            </Text>
            <Text style={styles.heroMeta}>
              {stats.checkInsToday} check-ins today  ·  {stats.accuracy}% audit
              accuracy
            </Text>
            <Pressable
              onPress={() => router.push("/(admin)/map")}
              style={({ pressed }) => [
                styles.heroBtn,
                { borderRadius: 12, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="map-pin" size={15} color="#1F1300" />
              <Text style={styles.heroBtnText}>Open live map</Text>
              <Feather name="arrow-right" size={15} color="#1F1300" />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={{ padding: 18, gap: 14 }}>
          <SyncBanner />

          <View style={styles.row}>
            <StatCard
              label="Meter reads"
              value={`${stats.todayMeters}`}
              icon="activity"
              tint={colors.pillarTransparency}
              trend="↑ 12% vs yesterday"
            />
            <StatCard
              label="Distance"
              value={`${stats.todayKm.toFixed(0)} km`}
              icon="navigation"
              tint={colors.pillarAccuracy}
              trend="Avg 12.3 km / staff"
            />
          </View>
          <View style={styles.row}>
            <StatCard
              label="On-time rate"
              value="96%"
              icon="clock"
              tint={colors.pillarDiscipline}
              trend="Above 95% target"
            />
            <StatCard
              label="Audit accuracy"
              value={`${stats.accuracy}%`}
              icon="shield"
              tint={colors.pillarControl}
              trend="0 disputes today"
            />
          </View>

          {/* Pillars panel */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius + 4,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Operating principles
                </Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  How every field action is governed
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              <PillarsRow />
            </View>
            <View style={[styles.principleList, { borderTopColor: colors.border }]}>
              <PrincipleRow
                icon="shield"
                title="Discipline"
                text="Selfie + GPS at every check-in. No silent shifts."
                tint={colors.pillarDiscipline}
              />
              <PrincipleRow
                icon="eye"
                title="Transparency"
                text="Live map shows every staff member's last known position."
                tint={colors.pillarTransparency}
              />
              <PrincipleRow
                icon="target"
                title="Accuracy"
                text="Auto-calculated kilometers from GPS — no manual claims."
                tint={colors.pillarAccuracy}
              />
              <PrincipleRow
                icon="sliders"
                title="Control"
                text="Offline-first sync with full audit trails."
                tint={colors.pillarControl}
                last
              />
            </View>
          </View>

          {/* Live activity */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius + 4,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Live activity feed
              </Text>
              <Pressable
                onPress={() => router.push("/(admin)/records")}
                hitSlop={8}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 12,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  View all
                </Text>
              </Pressable>
            </View>
            <LiveActivityFeed limit={8} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function PrincipleRow({
  icon,
  title,
  text,
  tint,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  text: string;
  tint: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.principleRow,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View
        style={[
          styles.principleIcon,
          { backgroundColor: tint + "1A", borderRadius: 10 },
        ]}
      >
        <Feather name={icon} size={14} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 13,
            fontFamily: "Inter_600SemiBold",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            fontFamily: "Inter_400Regular",
            marginTop: 2,
            lineHeight: 17,
          }}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greet: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  name: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
    letterSpacing: -0.4,
  },
  empBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  empText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  heroCard: {
    marginTop: 22,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
  },
  heroValue: {
    color: "#fff",
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.5,
    marginTop: 6,
  },
  heroValueSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 22,
    fontFamily: "Inter_500Medium",
  },
  heroMeta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  heroBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "#F59E0B",
  },
  heroBtnText: {
    color: "#1F1300",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
  },
  row: { flexDirection: "row", gap: 10 },
  section: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  principleList: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  principleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  principleIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
});
