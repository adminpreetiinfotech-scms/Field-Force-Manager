import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";

const ACCENT = "#1E3A5F";
const GOLD = "#D4AF37";

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

const _domain = process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app";
const API_BASE = Platform.OS === "web" ? "" : `https://${_domain}`;

export default function SuperAdminDashboard() {
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const { user, signOut } = useApp();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/super-admin/companies`, {
        headers: { "x-admin-phone": user.phone },
      });
      if (!res.ok) throw new Error("Failed to load companies");
      const data = await res.json() as Company[];
      setCompanies(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchCompanies().finally(() => setLoading(false));
  }, [fetchCompanies]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCompanies().finally(() => setRefreshing(false));
  }, [fetchCompanies]);

  const activeCount = companies.filter((c) => c.status === "active").length;
  const inactiveCount = companies.filter((c) => c.status === "inactive").length;

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F4FA" }}>
      <LinearGradient
        colors={[ACCENT, "#0D2240"]}
        style={[StyleSheet.absoluteFill, { height: 200 + insets.top + webTop }]}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + webTop + 16 }]}>
        <View>
          <Text style={styles.headerLabel}>Super Admin</Text>
          <Text style={styles.headerTitle}>Company Management</Text>
        </View>
        <Pressable
          onPress={async () => { await signOut(); router.replace("/(auth)/welcome"); }}
          style={({ pressed }) => [styles.signOutBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="log-out" size={16} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: "#22C55E" }]}>
          <Text style={styles.statNum}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: "#EF4444" }]}>
          <Text style={styles.statNum}>{inactiveCount}</Text>
          <Text style={styles.statLabel}>Inactive</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: GOLD }]}>
          <Text style={styles.statNum}>{companies.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Companies</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={20} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : companies.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="briefcase" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No companies registered yet</Text>
          </View>
        ) : (
          companies.map((company) => (
            <Pressable
              key={company.id}
              onPress={() => router.push(`/(super-admin)/company/${company.id}` as any)}
              style={({ pressed }) => [styles.companyCard, { opacity: pressed ? 0.92 : 1 }]}
            >
              {/* Status dot */}
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: company.status === "active" ? "#22C55E" : "#EF4444" },
                ]}
              />

              <View style={{ flex: 1 }}>
                <View style={styles.companyRow}>
                  <Text style={styles.companyName} numberOfLines={1}>
                    {company.name}
                  </Text>
                  {!company.subscriptionActive && (
                    <View style={styles.subBadge}>
                      <Text style={styles.subBadgeText}>Sub Off</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.companyMeta} numberOfLines={1}>
                  {[company.adminName, company.phone].filter(Boolean).join(" · ")}
                </Text>

                {(company.state || company.district || company.projectName) ? (
                  <Text style={styles.companyMeta2} numberOfLines={1}>
                    {[company.projectName, company.district, company.state]
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                ) : null}
              </View>

              <Feather name="chevron-right" size={16} color="#CCC" />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  signOutBtn: {
    padding: 8,
    marginTop: 4,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statNum: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#111",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#888",
    marginTop: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#444",
    letterSpacing: 0.3,
  },

  companyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  companyName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#111",
    flexShrink: 1,
  },
  subBadge: {
    backgroundColor: "#FEE2E2",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  subBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#DC2626",
  },
  companyMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#666",
    marginTop: 3,
  },
  companyMeta2: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#999",
    marginTop: 2,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 14,
    marginTop: 20,
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    fontFamily: "Inter_400Regular",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: "#AAA",
    fontFamily: "Inter_400Regular",
  },
});
