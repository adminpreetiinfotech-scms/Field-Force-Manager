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
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function AdminProfile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut, attendance, staffLocations } = useApp();

  const [confirmSignOut, setConfirmSignOut] = React.useState(false);

  const doSignOut = async () => {
    await signOut();
    router.replace("/(auth)/welcome");
  };

  const onHelpSupport = () => {
    Alert.alert(
      "Help & Support",
      "For technical support, contact:\n\nPraiaiti Infotech\nEmail: support@praiaiti.com\n\nApp Version: 1.0.3",
      [{ text: "OK" }],
    );
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

      {/* ── Company Branding Card ─────────────────────────────────── */}
      {(user?.companyName || user?.organization) && (
        <View
          style={[
            styles.brandCard,
            { backgroundColor: colors.primary, borderRadius: colors.radius + 4 },
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
        <Row icon="settings" label="Account Settings" colors={colors} onPress={() => router.push("/account-settings")} />
        <Row icon="users" label="Manage field staff" colors={colors} onPress={() => router.push("/(admin)/staff")} />
        <Row icon="download" label="Export records (CSV)" colors={colors} onPress={() => router.push("/(admin)/reports")} />
        <Row icon="bell" label="Alert preferences" colors={colors} onPress={() => router.push("/alert-preferences")} />
        <Row icon="shield" label="Audit log" colors={colors} onPress={() => router.push("/(admin)/records")} />
        <Row icon="help-circle" label="Help & support" colors={colors} onPress={onHelpSupport} last />
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

      {confirmSignOut ? (
        <View style={{ marginTop: 18, gap: 10 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" }}>
            Is session se sign out karein?
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label="Cancel"
              onPress={() => setConfirmSignOut(false)}
              variant="ghost"
              size="lg"
              style={{ flex: 1 }}
            />
            <Button
              label="Sign out"
              onPress={doSignOut}
              size="lg"
              style={{ flex: 1, backgroundColor: "#DC2626" }}
              icon={<Feather name="log-out" size={16} color="#fff" />}
            />
          </View>
        </View>
      ) : (
        <Button
          label="Sign out"
          onPress={() => setConfirmSignOut(true)}
          variant="ghost"
          size="lg"
          fullWidth
          style={{ marginTop: 18 }}
          icon={<Feather name="log-out" size={18} color={colors.foreground} />}
        />
      )}

      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 11,
          fontFamily: "Inter_400Regular",
          textAlign: "center",
          marginTop: 18,
        }}
      >
        Field Staff Manager · Admin · v1.0.3
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
  brandCard: {
    padding: 20,
    marginBottom: 14,
    alignItems: "center",
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
