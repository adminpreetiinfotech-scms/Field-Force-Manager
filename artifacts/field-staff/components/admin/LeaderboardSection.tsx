import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const _domain =
  process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app";
const API_BASE = _domain
  ? _domain.startsWith("http")
    ? _domain
    : `https://${_domain}`
  : "";

type Period = "daily" | "weekly" | "monthly";

type LeaderEntry = {
  rank: number;
  staffId: string;
  staffName: string;
  empCode: string;
  totalKm: number;
  tripCount: number;
  candidateCount: number;
  periodLabel: string;
  hasNotes: boolean;
};

const PERIOD_LABELS: { key: Period; label: string }[] = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This Week" },
  { key: "monthly", label: "This Month" },
];

const RANK_COLORS = ["#F59E0B", "#94A3B8", "#B45309"];
const RANK_BG = ["#FEF3C7", "#F1F5F9", "#FEF3C7"];
const MEDAL = ["🥇", "🥈", "🥉"];

function RankMedal({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <Text style={{ fontSize: rank === 1 ? 22 : 18, lineHeight: rank === 1 ? 26 : 22 }}>
        {MEDAL[rank - 1]}
      </Text>
    );
  }
  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#64748B" }}>
        {rank}
      </Text>
    </View>
  );
}

type Props = {
  companyId?: string | null;
};

export function LeaderboardSection({ companyId: _companyId }: Props) {
  const colors = useColors();
  const [period, setPeriod] = useState<Period>("daily");
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(
    (p: Period) => {
      setLoading(true);
      setError(false);
      const qs = _companyId ? `&companyId=${encodeURIComponent(_companyId)}` : "";
      fetch(`${API_BASE}/api/activity/leaderboard?period=${p}${qs}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<LeaderEntry[]>;
        })
        .then((data) => {
          setEntries(data.slice(0, 5));
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    },
    [],
  );

  useEffect(() => {
    load(period);
    const timer = setInterval(() => load(period), 120_000);
    return () => clearInterval(timer);
  }, [period, load]);

  const periodLbl =
    entries.length > 0 ? entries[0].periodLabel : PERIOD_LABELS.find((p) => p.key === period)?.label ?? "";

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: colors.card,
          borderColor: "#F59E0B44",
          borderRadius: colors.radius + 4,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: "#FEF3C7",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="award" size={15} color="#D97706" />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Staff Leaderboard
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Top performers · {periodLbl}
            </Text>
          </View>
        </View>
      </View>

      {/* Period filter pills */}
      <View style={styles.filterRow}>
        {PERIOD_LABELS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPeriod(p.key)}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor:
                  period === p.key ? "#1E3A5F" : colors.muted,
                borderRadius: 999,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                {
                  color: period === p.key ? "#fff" : colors.mutedForeground,
                },
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Body */}
      {loading ? (
        <View style={{ paddingVertical: 28, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#D97706" />
        </View>
      ) : error ? (
        <View style={{ paddingVertical: 20, alignItems: "center", gap: 8 }}>
          <Feather name="wifi-off" size={20} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
            Could not load leaderboard
          </Text>
          <Pressable onPress={() => load(period)}>
            <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : entries.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: "center", gap: 6 }}>
          <Feather name="award" size={28} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
            No activity yet
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", paddingHorizontal: 16 }}>
            Field staff trips will appear here once recorded
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 10, gap: 8 }}>
          {entries.map((entry, idx) => {
            const isTop = entry.rank === 1;
            return (
              <View
                key={entry.staffId}
                style={[
                  styles.row,
                  {
                    backgroundColor: isTop
                      ? "#FEF3C7"
                      : idx % 2 === 0
                        ? colors.muted
                        : colors.background,
                    borderRadius: 12,
                    borderWidth: isTop ? 1 : 0,
                    borderColor: isTop ? "#F59E0B66" : "transparent",
                  },
                ]}
              >
                {/* Medal / Rank */}
                <View style={{ width: 34, alignItems: "center", justifyContent: "center" }}>
                  <RankMedal rank={entry.rank} />
                </View>

                {/* Name + emp code */}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={[
                      styles.staffName,
                      {
                        color: isTop ? "#92400E" : colors.foreground,
                        fontSize: isTop ? 15 : 14,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {entry.staffName}
                  </Text>
                  <Text style={[styles.empCode, { color: isTop ? "#B45309" : colors.mutedForeground }]}>
                    {entry.empCode}
                  </Text>
                </View>

                {/* Stats */}
                <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                  <View style={styles.statChip}>
                    <Feather
                      name="navigation"
                      size={10}
                      color={isTop ? "#D97706" : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.statVal,
                        { color: isTop ? "#92400E" : colors.foreground },
                      ]}
                    >
                      {entry.totalKm.toFixed(1)}
                      <Text style={[styles.statUnit, { color: isTop ? "#B45309" : colors.mutedForeground }]}>
                        {" "}km
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.statChip}>
                    <Feather
                      name="repeat"
                      size={10}
                      color={isTop ? "#D97706" : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.statVal,
                        { color: isTop ? "#92400E" : colors.foreground },
                      ]}
                    >
                      {entry.tripCount}
                      <Text style={[styles.statUnit, { color: isTop ? "#B45309" : colors.mutedForeground }]}>
                        {" "}trips
                      </Text>
                    </Text>
                  </View>

                  {entry.candidateCount > 0 && (
                    <View style={styles.statChip}>
                      <Feather
                        name="user-plus"
                        size={10}
                        color={isTop ? "#D97706" : "#7C3AED"}
                      />
                      <Text
                        style={[
                          styles.statVal,
                          { color: isTop ? "#92400E" : "#7C3AED" },
                        ]}
                      >
                        {entry.candidateCount}
                        <Text style={[styles.statUnit, { color: isTop ? "#B45309" : "#9333EA" }]}>
                          {" "}cand
                        </Text>
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Legend */}
      {entries.length > 0 && (
        <View
          style={[
            styles.legend,
            { borderTopColor: colors.border, marginTop: 10 },
          ]}
        >
          <View style={styles.legendItem}>
            <Feather name="navigation" size={10} color={colors.mutedForeground} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
              Distance
            </Text>
          </View>
          <View style={styles.legendItem}>
            <Feather name="repeat" size={10} color={colors.mutedForeground} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
              Trips
            </Text>
          </View>
          <View style={styles.legendItem}>
            <Feather name="user-plus" size={10} color={colors.mutedForeground} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
              Candidate registrations
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
    flexWrap: Platform.OS === "web" ? "wrap" : "nowrap",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  staffName: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
  },
  empCode: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  statVal: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  statUnit: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
