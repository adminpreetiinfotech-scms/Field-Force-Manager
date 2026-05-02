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
import { CompanyBrand } from "@/components/CompanyBrand";
import { PillarsRow } from "@/components/PillarBadge";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function StaffProfile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut, attendance, meterReadings, trips } = useApp();

  const mineAttendance = attendance.filter((a) => a.staffId === user?.id);
  const mineMeters = meterReadings.filter((m) => m.staffId === user?.id);
  const totalKm = trips
    .filter((t) => t.staffId === user?.id)
    .reduce((s, t) => s + t.km, 0);

  const onSignOut = () => {
    Alert.alert("Sign out", "End your session on this device?", [
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
      <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>

      {/* ── Company Branding Card ─────────────────────────────────── */}
      {(user?.companyName || user?.organization) && (
        <View
          style={[
            {
              backgroundColor: colors.primary,
              borderRadius: colors.radius + 4,
              padding: 20,
              marginBottom: 14,
              alignItems: "center",
            },
          ]}
        >
          <CompanyBrand
            companyName={user?.companyName || user?.organization}
            companyLogoUrl={user?.companyLogoUrl}
            schemeName={user?.companySchemeName || user?.projectName}
            size="md"
            centered
            nameColor="#FFFFFF"
            schemeColor="rgba(255,255,255,0.72)"
            logoBackground="rgba(255,255,255,0.18)"
          />
        </View>
      )}

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
              { backgroundColor: colors.primary, borderRadius: 999 },
            ]}
          >
            <Text style={styles.avatarText}>
              {user?.name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "FS"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {user?.name}
            </Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {user?.empCode}  ·  +91 {user?.phone}
            </Text>
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor: colors.success + "1A",
                  borderColor: colors.success + "33",
                  borderRadius: 999,
                },
              ]}
            >
              <Feather name="check-circle" size={11} color={colors.success} />
              <Text style={{ color: colors.success, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                Verified field staff
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[styles.divider, { backgroundColor: colors.border }]}
        />

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {mineAttendance.filter((a) => a.type === "in").length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Check-ins
            </Text>
          </View>
          <View style={[styles.statSep, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {mineMeters.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Meter reads
            </Text>
          </View>
          <View style={[styles.statSep, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {totalKm.toFixed(0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Total km
            </Text>
          </View>
        </View>
      </View>

      {/* Account Details */}
      {(user?.email || user?.centerName || user?.projectName || user?.state || user?.district) && (
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
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Account Details
          </Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {user?.email && (
              <DetailRow icon="mail" label="Email" value={user.email} colors={colors} />
            )}
            {user?.centerName && (
              <DetailRow icon="home" label="Center / Branch" value={user.centerName} colors={colors} />
            )}
            {user?.projectName && (
              <DetailRow icon="briefcase" label="Scheme / Project" value={user.projectName} colors={colors} />
            )}
            {user?.state && (
              <DetailRow icon="map-pin" label="State" value={user.state} colors={colors} />
            )}
            {user?.district && (
              <DetailRow icon="map" label="District" value={user.district} colors={colors} />
            )}
          </View>
        </View>
      )}

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
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Built on four pillars
        </Text>
        <View style={{ marginTop: 10 }}>
          <PillarsRow />
        </View>
      </View>

      <RoleSwitcher />

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
        <Row icon="calendar" label="Attendance Calendar" colors={colors} onPress={() => router.push("/(staff)/attendance" as never)} />
        <Row icon="settings" label="Account Settings" colors={colors} onPress={() => router.push("/account-settings")} />
        <Row icon="bell" label="Notifications" colors={colors} />
        <Row icon="shield" label="Privacy & permissions" colors={colors} />
        <Row icon="help-circle" label="Help & support" colors={colors} />
        <Row icon="file-text" label="Field operations policy" colors={colors} last />
      </View>

      {/* ── Contact & Support ─────────────────────────────────────── */}
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
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Contact &amp; Support
        </Text>
        <View style={{ marginTop: 12, gap: 10 }}>
          <ContactRow icon="code" label="Developed by" value="Preeti Infotech" colors={colors} />
          {!!(user?.companyName || user?.organization) && (
            <ContactRow
              icon="briefcase"
              label="Company"
              value={(user?.companyName || user?.organization) as string}
              colors={colors}
            />
          )}
          <ContactRow icon="info" label="App Version" value="1.0.3" colors={colors} />
        </View>
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
        Field Staff Manager · v1.0.3
      </Text>
    </ScrollView>
  );
}

function ContactRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <View style={{ width: 22, alignItems: "center", paddingTop: 1 }}>
        <Feather name={icon} size={14} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.4 }}>
          {label}
        </Text>
        <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 2 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <View style={{ width: 22, alignItems: "center", paddingTop: 1 }}>
        <Feather name={icon} size={14} color={colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.4 }}>
          {label}
        </Text>
        <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  colors,
  last,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  colors: ReturnType<typeof useColors>;
  last?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  name: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  meta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
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
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
});
