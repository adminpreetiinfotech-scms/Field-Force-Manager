import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function AdminProfile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut, attendance, meterReadings, staffLocations } = useApp();

  const onSignOut = () => {
    Alert.alert("Sign out", "End your session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/phone");
        },
      },
    ]);
  };

  const webBottomPad = Platform.OS === "web" ? 84 : 84;
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16 + webTop,
        paddingBottom: insets.bottom + webBottomPad + 24,
        paddingHorizontal: 22,
      }}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        Admin profile
      </Text>

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
        <View style={styles.headerRow}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.accent, borderRadius: 999 },
            ]}
          >
            <Feather name="shield" size={22} color="#1F1300" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {user?.name}
            </Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {user?.empCode}  ·  Operations control
            </Text>
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor: colors.primary + "12",
                  borderColor: colors.primary + "33",
                  borderRadius: 999,
                },
              ]}
            >
              <Feather name="lock" size={11} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                Admin access
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {staffLocations.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Staff
            </Text>
          </View>
          <View style={[styles.statSep, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {attendance.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Attendance
            </Text>
          </View>
          <View style={[styles.statSep, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {meterReadings.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Meter reads
            </Text>
          </View>
        </View>
      </View>

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
        <Row icon="users" label="Manage field staff" colors={colors} />
        <Row icon="download" label="Export records (CSV)" colors={colors} />
        <Row icon="bell" label="Alert preferences" colors={colors} />
        <Row icon="shield" label="Audit log" colors={colors} />
        <Row icon="help-circle" label="Help & support" colors={colors} last />
      </View>

      <Button
        label="Sign out"
        onPress={onSignOut}
        variant="ghost"
        size="lg"
        fullWidth
        style={{ marginTop: 18 }}
        icon={<Feather name="log-out" size={18} color={colors.foreground} />}
      />

      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 11,
          fontFamily: "Inter_400Regular",
          textAlign: "center",
          marginTop: 18,
        }}
      >
        Field Staff Manager · Admin · v1.0
      </Text>
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  colors,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  colors: ReturnType<typeof useColors>;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Feather name={icon} size={17} color={colors.foreground} />
      <Text
        style={{
          color: colors.foreground,
          fontSize: 14,
          fontFamily: "Inter_500Medium",
          flex: 1,
        }}
      >
        {label}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  card: {
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 17, fontFamily: "Inter_700Bold" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statCol: { flex: 1, alignItems: "center" },
  statSep: { width: StyleSheet.hairlineWidth, height: 30 },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  section: {
    padding: 16,
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
});
