import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";

const ACCENT = "#1E3A5F";

type Company = {
  id: string;
  name: string;
  adminName: string | null;
  phone: string | null;
  email: string | null;
  state: string | null;
  district: string | null;
  projectName: string | null;
  status: "active" | "inactive";
  subscriptionActive: boolean;
  createdAt: string;
};

type CompanyStats = {
  company: Company;
  stats: {
    staffCount: number;
    candidateCount: number;
    activityCount: number;
  };
};

const _domain = process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app";
const API_BASE = Platform.OS === "web" ? "" : `https://${_domain}`;

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const { user } = useApp();

  const [data, setData] = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = { "x-admin-phone": user?.phone ?? "", "Content-Type": "application/json" };

  const fetchStats = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/super-admin/companies/${id}/stats`, { headers });
      if (!res.ok) throw new Error("Failed to load company");
      const json = await res.json() as CompanyStats;
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    }
  }, [id, user]);

  useEffect(() => {
    setLoading(true);
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  const patchCompany = useCallback(async (updates: Partial<Company>) => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/super-admin/companies/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Update failed");
      const updated = await res.json() as Company;
      setData((prev) => prev ? { ...prev, company: updated } : prev);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }, [id, user]);

  const handleResetAdmin = useCallback(() => {
    Alert.alert(
      "Reset Admin MPIN",
      "This will clear the company admin's MPIN. They will need to set a new one on next login. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              const res = await fetch(`${API_BASE}/api/super-admin/companies/${id}/reset-admin`, {
                method: "POST",
                headers,
              });
              if (!res.ok) throw new Error("Reset failed");
              Alert.alert("Done", "Admin MPIN reset. They must re-setup MPIN on next login.");
            } catch (e: any) {
              Alert.alert("Error", e.message || "Reset failed");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }, [id, user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Feather name="alert-circle" size={32} color="#DC2626" />
        <Text style={{ color: "#DC2626", marginTop: 12, fontFamily: "Inter_400Regular" }}>
          {error || "Company not found"}
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const { company, stats } = data;

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F4FA" }}>
      {/* Header */}
      <View style={[styles.headerBg, { paddingTop: insets.top + webTop + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backArrow}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{company.name}</Text>
          <Text style={styles.headerSub}>
            {company.status === "active" ? "● Active" : "● Inactive"}
            {!company.subscriptionActive ? " · Sub Off" : ""}
          </Text>
        </View>
        {saving && <ActivityIndicator color="rgba(255,255,255,0.8)" size="small" />}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Feather name="users" size={18} color={ACCENT} />
            <Text style={styles.statNum}>{stats.staffCount}</Text>
            <Text style={styles.statLabel}>Staff</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="user-check" size={18} color="#16A34A" />
            <Text style={styles.statNum}>{stats.candidateCount}</Text>
            <Text style={styles.statLabel}>Candidates</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="activity" size={18} color="#7C3AED" />
            <Text style={styles.statNum}>{stats.activityCount.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
        </View>

        {/* Company info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Company Info</Text>
          {[
            { label: "Admin Name", value: company.adminName },
            { label: "Phone", value: company.phone },
            { label: "Email", value: company.email },
            { label: "Project", value: company.projectName },
            { label: "State", value: company.state },
            { label: "District", value: company.district },
            { label: "Registered", value: company.createdAt ? new Date(company.createdAt).toLocaleDateString("en-IN") : null },
          ]
            .filter((f) => f.value)
            .map((field) => (
              <View key={field.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{field.label}</Text>
                <Text style={styles.infoValue}>{field.value}</Text>
              </View>
            ))}
        </View>

        {/* Controls */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Controls</Text>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Company Status</Text>
              <Text style={styles.toggleSub}>
                {company.status === "active" ? "Active — staff can log in" : "Inactive — login blocked"}
              </Text>
            </View>
            <Switch
              value={company.status === "active"}
              onValueChange={(val) => patchCompany({ status: val ? "active" : "inactive" })}
              trackColor={{ true: "#22C55E", false: "#EF4444" }}
              thumbColor="#fff"
              disabled={saving}
            />
          </View>

          <View style={[styles.toggleRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EEE", paddingTop: 14 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Subscription Active</Text>
              <Text style={styles.toggleSub}>
                {company.subscriptionActive
                  ? "Active — full access"
                  : "Inactive — login blocked for non-admins"}
              </Text>
            </View>
            <Switch
              value={company.subscriptionActive}
              onValueChange={(val) => patchCompany({ subscriptionActive: val })}
              trackColor={{ true: "#3B82F6", false: "#EF4444" }}
              thumbColor="#fff"
              disabled={saving}
            />
          </View>
        </View>

        {/* Danger zone */}
        <View style={[styles.card, { borderColor: "#FEE2E2", borderWidth: 1 }]}>
          <Text style={[styles.cardTitle, { color: "#DC2626" }]}>Danger Zone</Text>
          <Text style={styles.dangerDesc}>
            Reset the company admin's MPIN. They will need to set a new 4-digit MPIN on next login.
          </Text>
          <Pressable
            onPress={handleResetAdmin}
            style={({ pressed }) => [styles.dangerBtn, { opacity: pressed ? 0.8 : 1 }]}
            disabled={saving}
          >
            <Feather name="refresh-cw" size={14} color="#DC2626" />
            <Text style={styles.dangerBtnText}>Reset Admin MPIN</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBg: {
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  backArrow: { padding: 4 },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statNum: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#111",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#888",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#444",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#666",
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#222",
    maxWidth: "60%",
    textAlign: "right",
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#222",
  },
  toggleSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#888",
    marginTop: 2,
  },

  dangerDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#666",
    marginBottom: 12,
    lineHeight: 18,
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#DC2626",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  dangerBtnText: {
    color: "#DC2626",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  backBtn: {
    marginTop: 16,
    backgroundColor: ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
