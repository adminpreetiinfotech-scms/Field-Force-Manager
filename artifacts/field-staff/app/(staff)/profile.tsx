import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { CompanyBrand } from "@/components/CompanyBrand";
import { KmDayDetailSheet } from "@/components/KmDayDetailSheet";
import { PillarsRow } from "@/components/PillarBadge";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { VehicleType, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useGetStaffKmHistory } from "@workspace/api-client-react";

const CENTER_STAFF_ROLE_LABELS: Record<string, string> = {
  centerHead: "Center Head",
  misExecutive: "MIS Executive",
  placementIncharge: "Placement Incharge",
  trainer: "Trainer",
  itTrainer: "IT Trainer",
  softSkillsTrainer: "Soft Skills Trainer",
  receptionist: "Receptionist",
  counselor: "Counselor",
  officeboy: "Office Boy",
  securityGuard: "Security Guard",
  cook: "Cook",
  cleaningStaff: "Cleaning Staff",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}

export default function StaffProfile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut, attendance, trips, updateProfile } = useApp();

  const mineAttendance = attendance.filter((a) => a.staffId === user?.id);
  const totalKm = trips
    .filter((t) => t.staffId === user?.id)
    .reduce((s, t) => s + t.km, 0);

  const [vehicleType, setVehicleType] = useState<VehicleType | null>(user?.vehicleType ?? null);
  const [vehicleNumber, setVehicleNumber] = useState(user?.vehicleNumber ?? "");
  const [savingVehicle, setSavingVehicle] = useState(false);

  const { data: kmHistoryData } = useGetStaffKmHistory(
    { staffId: user?.id ?? "", days: 14 },
    { query: { enabled: !!user?.id } },
  );
  const kmHistory = kmHistoryData?.entries ?? [];

  const [selectedKmDay, setSelectedKmDay] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const doSignOut = async () => {
    await signOut();
    router.replace("/(auth)/welcome");
  };

  const webBottomPad = Platform.OS === "web" ? 84 : 84;
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <>
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
              {trips.filter((t) => t.staffId === user?.id).length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Trips
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

      {/* ── Vehicle Setup — field staff only ─────────────────────── */}
      {user?.staffCategory !== "center" && (
      <View
        style={[
          styles.section,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius + 4,
            marginTop: 14,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          My Vehicle
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 }}>
          Set once — auto-fills odometer at every check-in/out
        </Text>

        {/* Type picker */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {(["2-wheeler", "4-wheeler"] as VehicleType[]).map((v) => (
            <Pressable
              key={v}
              onPress={() => setVehicleType((prev) => (prev === v ? null : v))}
              style={({ pressed }) => [
                {
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: vehicleType === v ? colors.primary : colors.border,
                  backgroundColor: vehicleType === v ? colors.primary + "14" : colors.background,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name={v === "2-wheeler" ? "navigation" : "truck"}
                size={20}
                color={vehicleType === v ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  fontFamily: vehicleType === v ? "Inter_700Bold" : "Inter_500Medium",
                  color: vehicleType === v ? colors.primary : colors.mutedForeground,
                }}
              >
                {v === "2-wheeler" ? "2-Wheeler" : "4-Wheeler"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Vehicle number */}
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6, letterSpacing: 0.4 }}>
            VEHICLE NUMBER (OPTIONAL)
          </Text>
          <TextInput
            value={vehicleNumber}
            onChangeText={(t) => setVehicleNumber(t.toUpperCase())}
            placeholder="e.g. JH 10 AB 1234"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            style={{
              backgroundColor: colors.background,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: colors.foreground,
              fontSize: 14,
              fontFamily: "Inter_600SemiBold",
              letterSpacing: 1,
            }}
          />
        </View>

        <Button
          label={savingVehicle ? "Saving…" : "Save vehicle"}
          loading={savingVehicle}
          size="md"
          fullWidth
          style={{ marginTop: 14 }}
          icon={<Feather name="save" size={16} color="#fff" />}
          onPress={async () => {
            setSavingVehicle(true);
            try {
              await updateProfile({ vehicleType: vehicleType ?? null, vehicleNumber: vehicleNumber.trim() || null });
              Alert.alert("Saved", "Vehicle info updated successfully.");
            } catch (e: unknown) {
              Alert.alert("Error", (e as Error).message || "Could not save vehicle info.");
            } finally {
              setSavingVehicle(false);
            }
          }}
        />
      </View>
      )}

      {/* ── Center Staff Role Badge ────────────────────────────────── */}
      {user?.staffCategory === "center" && (
        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius + 4,
              marginTop: 14,
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
              <Feather name="home" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.4 }}>STAFF CATEGORY</Text>
              <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_700Bold", marginTop: 1 }}>Center Staff</Text>
            </View>
          </View>
          {!!user?.centerStaffRole && (
            <View style={{ marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: colors.primary + "10", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primary + "30" }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.4 }}>DESIGNATED ROLE</Text>
              <Text style={{ color: colors.primary, fontSize: 14, fontFamily: "Inter_700Bold", marginTop: 2 }}>
                {CENTER_STAFF_ROLE_LABELS[user.centerStaffRole] ?? user.centerStaffRole}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── KM History — field staff only ────────────────────────── */}
      {user?.staffCategory !== "center" && user?.vehicleType && kmHistory.length > 0 && (
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
            My KM History (Last 14 Days)
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 }}>
            Vehicle KM vs GPS KM per day
          </Text>

          {/* Column headers */}
          <View style={{ flexDirection: "row", marginTop: 12, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
            <Text style={{ flex: 1.2, fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>DATE</Text>
            <Text style={{ flex: 1, fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textAlign: "center" }}>VEHICLE KM</Text>
            <Text style={{ flex: 1, fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textAlign: "center" }}>GPS KM</Text>
            <Text style={{ flex: 1, fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textAlign: "right" }}>VARIANCE</Text>
          </View>

          {kmHistory.slice(0, 10).map((entry) => {
            const highVar = entry.variancePct != null && entry.variancePct > 20;
            return (
              <Pressable
                key={entry.date}
                onPress={() => setSelectedKmDay(entry.date)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 8,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                  backgroundColor: pressed
                    ? colors.border + "60"
                    : highVar
                    ? "#FEF3C7"
                    : "transparent",
                  marginHorizontal: -4,
                  paddingHorizontal: 4,
                  borderRadius: 4,
                })}
              >
                <Text style={{ flex: 1.2, fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground }}>
                  {fmtDate(entry.date)}
                </Text>
                <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary, textAlign: "center" }}>
                  {entry.vehicleKm != null ? `${entry.vehicleKm} km` : "—"}
                </Text>
                <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground, textAlign: "center" }}>
                  {entry.gpsKm > 0 ? `${entry.gpsKm} km` : "—"}
                </Text>
                <Text style={{
                  flex: 1,
                  fontSize: 11,
                  fontFamily: "Inter_600SemiBold",
                  textAlign: "right",
                  color: highVar ? "#B45309" : entry.variancePct != null ? colors.success : colors.mutedForeground,
                }}>
                  {entry.variancePct != null ? `${entry.variancePct}%` : "—"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

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
        Field Staff Manager · v1.0.3
      </Text>
    </ScrollView>

    <KmDayDetailSheet
      visible={selectedKmDay != null}
      date={selectedKmDay ?? ""}
      staffId={user?.id ?? ""}
      vehicleType={user?.vehicleType}
      kmEntry={
        selectedKmDay != null
          ? (kmHistoryData?.entries ?? []).find((e) => e.date === selectedKmDay) ?? null
          : null
      }
      onClose={() => setSelectedKmDay(null)}
    />
    </>
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
