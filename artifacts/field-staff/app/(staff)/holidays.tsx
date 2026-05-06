import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
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
import { useColors } from "@/hooks/useColors";

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

const API_BASE = getApiBase();

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
] as const;

type HolidayRow = {
  id: string;
  name: string;
  date: string;
  type: "national" | "regional" | "company";
  description: string | null;
};

const TYPE_COLOR: Record<string, string> = {
  national: "#DC2626",
  regional: "#D97706",
  company: "#3B82F6",
};

const TYPE_BG: Record<string, string> = {
  national: "#FEF2F2",
  regional: "#FFFBEB",
  company: "#EFF6FF",
};

const TYPE_LABEL: Record<string, string> = {
  national: "National",
  regional: "Regional",
  company: "Company",
};

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" });
}

function groupByMonth(holidays: HolidayRow[]) {
  const groups: Record<string, HolidayRow[]> = {};
  for (const h of holidays) {
    const monthKey = h.date.slice(0, 7);
    if (!groups[monthKey]) groups[monthKey] = [];
    groups[monthKey].push(h);
  }
  return groups;
}

function isUpcoming(dateStr: string) {
  return new Date(dateStr + "T00:00:00") >= new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
}

export default function StaffHolidays() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();

  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);

  const phoneHeader: Record<string, string> = user?.role === "admin" || user?.role === "super_admin"
    ? { "x-admin-phone": user?.phone ?? "" }
    : { "x-staff-phone": user?.phone ?? "" };

  const load = useCallback(async () => {
    if (!user?.phone) return;
    try {
      const r = await fetch(`${API_BASE}/api/holidays?year=${year}`, { headers: phoneHeader });
      const d = await r.json() as { holidays: HolidayRow[] };
      setHolidays(d.holidays ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.phone, year]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); void load(); };

  const webTop = Platform.OS === "web" ? 67 : 0;
  const displayed = showUpcomingOnly ? holidays.filter((h) => isUpcoming(h.date)) : holidays;
  const groups = groupByMonth(displayed);
  const sortedMonths = Object.keys(groups).sort();

  const upcomingNext = holidays.find((h) => isUpcoming(h.date));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={["#1E3A5F", "#0B2545"]}
        style={{
          paddingTop: insets.top + webTop + 16,
          paddingBottom: 20,
          paddingHorizontal: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 20, color: "#FFFFFF" }}>
              Holiday Calendar
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#93C5FD", marginTop: 2 }}>
              {holidays.length} holiday{holidays.length !== 1 ? "s" : ""} in {year}
            </Text>
          </View>
          {/* Year selector */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => setYear(y => y - 1)}
              style={{ padding: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8 }}
            >
              <Feather name="chevron-left" size={16} color="#fff" />
            </Pressable>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff", minWidth: 40, textAlign: "center" }}>
              {year}
            </Text>
            <Pressable
              onPress={() => setYear(y => Math.min(y + 1, new Date().getFullYear() + 1))}
              style={{ padding: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8 }}
            >
              <Feather name="chevron-right" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Next holiday banner */}
        {upcomingNext && (
          <View style={{
            marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 12,
          }}>
            <View style={{
              width: 40, height: 40, borderRadius: 10,
              backgroundColor: TYPE_COLOR[upcomingNext.type],
              alignItems: "center", justifyContent: "center",
            }}>
              <Feather name="flag" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#93C5FD" }}>
                Next Holiday
              </Text>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" }}>
                {upcomingNext.name}
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#93C5FD" }}>
                {fmtDate(upcomingNext.date)}
              </Text>
            </View>
          </View>
        )}

        {/* Legend */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          {(["national", "regional", "company"] as const).map((t) => (
            <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TYPE_COLOR[t] }} />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#93C5FD" }}>
                {TYPE_LABEL[t]}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Filter row */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "flex-end",
        paddingHorizontal: 18, paddingVertical: 10,
      }}>
        <Pressable
          onPress={() => setShowUpcomingOnly(!showUpcomingOnly)}
          style={{
            flexDirection: "row", alignItems: "center", gap: 6,
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
            backgroundColor: showUpcomingOnly ? colors.primary : colors.muted,
          }}
        >
          <Feather
            name="calendar"
            size={13}
            color={showUpcomingOnly ? "#fff" : colors.mutedForeground}
          />
          <Text style={{
            fontFamily: "Inter_600SemiBold", fontSize: 12,
            color: showUpcomingOnly ? "#fff" : colors.mutedForeground,
          }}>
            Upcoming only
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : sortedMonths.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 60, gap: 12 }}>
            <Feather name="sun" size={48} color={colors.mutedForeground} />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: colors.mutedForeground }}>
              No holidays found
            </Text>
          </View>
        ) : (
          sortedMonths.map((monthKey) => {
            const [y, m] = monthKey.split("-").map(Number);
            const monthName = MONTH_NAMES[(m ?? 1) - 1];
            return (
              <View key={monthKey} style={{ marginBottom: 20 }}>
                <Text style={{
                  fontFamily: "Inter_700Bold", fontSize: 13, color: colors.primary,
                  marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase",
                }}>
                  {monthName} {y}
                </Text>
                <View style={{ gap: 8 }}>
                  {(groups[monthKey] ?? []).map((h) => {
                    const past = !isUpcoming(h.date);
                    return (
                      <View
                        key={h.id}
                        style={{
                          backgroundColor: colors.card,
                          borderRadius: 12, padding: 12,
                          borderLeftWidth: 4, borderLeftColor: TYPE_COLOR[h.type],
                          borderWidth: 1, borderColor: colors.border,
                          opacity: past ? 0.55 : 1,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{
                              fontFamily: "Inter_700Bold", fontSize: 14,
                              color: colors.foreground,
                            }}>
                              {h.name}
                            </Text>
                            <Text style={{
                              fontFamily: "Inter_400Regular", fontSize: 12,
                              color: colors.mutedForeground, marginTop: 2,
                            }}>
                              {fmtDate(h.date)}
                            </Text>
                            {h.description ? (
                              <Text style={{
                                fontFamily: "Inter_400Regular", fontSize: 12,
                                color: colors.mutedForeground, marginTop: 4,
                              }}>
                                {h.description}
                              </Text>
                            ) : null}
                          </View>
                          <View style={{
                            backgroundColor: TYPE_BG[h.type],
                            paddingHorizontal: 8, paddingVertical: 3,
                            borderRadius: 20, marginLeft: 8,
                          }}>
                            <Text style={{
                              fontFamily: "Inter_600SemiBold", fontSize: 10,
                              color: TYPE_COLOR[h.type],
                            }}>
                              {TYPE_LABEL[h.type]}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({});
