import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const STORAGE_KEY = "@scms_alert_prefs";

type AlertPrefs = {
  staffOffline: boolean;
  lowAttendance: boolean;
  dailySummary: boolean;
  geofenceBreach: boolean;
  newCandidateReg: boolean;
  centerInactive: boolean;
};

const DEFAULT_PREFS: AlertPrefs = {
  staffOffline: true,
  lowAttendance: true,
  dailySummary: true,
  geofenceBreach: false,
  newCandidateReg: true,
  centerInactive: false,
};

async function loadPrefs(): Promise<AlertPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<AlertPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

async function savePrefs(prefs: AlertPrefs): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

type AlertRow = {
  key: keyof AlertPrefs;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sub: string;
};

const ALERT_ROWS: AlertRow[] = [
  {
    key: "staffOffline",
    icon: "wifi-off",
    label: "Staff offline alert",
    sub: "Notify when a staff member has no activity for 2+ hours",
  },
  {
    key: "lowAttendance",
    icon: "user-x",
    label: "Low attendance alert",
    sub: "Alert when daily attendance drops below 70%",
  },
  {
    key: "dailySummary",
    icon: "bar-chart-2",
    label: "Daily summary",
    sub: "Receive an end-of-day activity summary",
  },
  {
    key: "geofenceBreach",
    icon: "map-pin",
    label: "Geo-fence breach",
    sub: "Alert when a staff member exits the assigned zone",
  },
  {
    key: "newCandidateReg",
    icon: "user-plus",
    label: "New candidate registration",
    sub: "Notify when a new candidate is registered",
  },
  {
    key: "centerInactive",
    icon: "home",
    label: "Center inactivity alert",
    sub: "Alert when a training center reports no activity",
  },
];

export default function AlertPreferencesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const [prefs, setPrefs] = useState<AlertPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadPrefs().then(setPrefs);
  }, []);

  async function toggle(key: keyof AlertPrefs) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaved(false);
    setSaving(true);
    try {
      await savePrefs(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + webTop,
            backgroundColor: colors.primary,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Alert Preferences</Text>
          <Text style={styles.headerSub}>
            Choose which events trigger notifications
          </Text>
        </View>
        {saving ? (
          <ActivityIndicator color="#fff" size="small" style={{ marginRight: 4 }} />
        ) : saved ? (
          <Feather name="check-circle" size={18} color="rgba(255,255,255,0.85)" />
        ) : null}
      </View>

      {prefs === null ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Info banner */}
          <View
            style={[
              styles.infoBanner,
              {
                backgroundColor: colors.primary + "14",
                borderColor: colors.primary + "33",
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="info" size={14} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>
              Preferences are saved locally on this device. Changes take effect immediately.
            </Text>
          </View>

          {/* Alert rows */}
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
            {ALERT_ROWS.map((row, idx) => (
              <View key={row.key}>
                {idx > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: colors.border }]}
                  />
                )}
                <View style={styles.row}>
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: prefs[row.key]
                          ? colors.primary + "18"
                          : colors.muted,
                        borderRadius: 10,
                      },
                    ]}
                  >
                    <Feather
                      name={row.icon}
                      size={17}
                      color={prefs[row.key] ? colors.primary : colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.rowLabel,
                        { color: colors.foreground },
                      ]}
                    >
                      {row.label}
                    </Text>
                    <Text
                      style={[
                        styles.rowSub,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {row.sub}
                    </Text>
                  </View>
                  <Switch
                    value={prefs[row.key]}
                    onValueChange={() => toggle(row.key)}
                    trackColor={{
                      false: colors.muted,
                      true: colors.primary + "99",
                    }}
                    thumbColor={prefs[row.key] ? colors.primary : colors.mutedForeground}
                    ios_backgroundColor={colors.muted}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* Footer note */}
          <Text
            style={[
              styles.footerNote,
              { color: colors.mutedForeground },
            ]}
          >
            In-app alerts only. SMS/push notifications can be configured from the web admin panel.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 14,
  },
  headerSub: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 50,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  footerNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 16,
  },
});
