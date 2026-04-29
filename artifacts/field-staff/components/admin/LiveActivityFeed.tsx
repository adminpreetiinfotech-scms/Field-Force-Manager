import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type FeedKind = "checkin" | "checkout" | "meter" | "trip-start" | "trip-end";

type FeedItem = {
  uid: string;
  kind: FeedKind;
  recordId: string;
  recordKind: "attendance" | "meter" | "trip";
  staffName: string;
  title: string;
  sub: string;
  ts: number;
  synced: boolean;
};

const ICON: Record<FeedKind, keyof typeof Feather.glyphMap> = {
  checkin: "log-in",
  checkout: "log-out",
  meter: "zap",
  "trip-start": "play",
  "trip-end": "flag",
};

const LABEL: Record<FeedKind, string> = {
  checkin: "Check-in",
  checkout: "Check-out",
  meter: "Meter read",
  "trip-start": "Trip started",
  "trip-end": "Trip ended",
};

export function LiveActivityFeed({ limit = 8 }: { limit?: number }) {
  const colors = useColors();
  const { attendance, meterReadings, trips } = useApp();
  const [, setTick] = useState(0);

  // Re-render every 20s so the "Xm ago" labels stay fresh — gives the
  // feed a real "live" feel even when there are no new events.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 20000);
    return () => clearInterval(id);
  }, []);

  const items: FeedItem[] = useMemo(() => {
    const tones: FeedItem[] = [];

    for (const a of attendance) {
      tones.push({
        uid: `att-${a.id}`,
        kind: a.type === "in" ? "checkin" : "checkout",
        recordId: a.id,
        recordKind: "attendance",
        staffName: a.staffName,
        title: `${a.staffName} ${a.type === "in" ? "checked in" : "checked out"}`,
        sub: a.location
          ? `${a.location.latitude.toFixed(3)}, ${a.location.longitude.toFixed(3)}`
          : "No GPS lock",
        ts: a.timestamp,
        synced: a.synced,
      });
    }

    for (const m of meterReadings) {
      tones.push({
        uid: `met-${m.id}`,
        kind: "meter",
        recordId: m.id,
        recordKind: "meter",
        staffName: m.staffName,
        title: `${m.staffName} read ${m.reading.toLocaleString("en-IN")} kWh`,
        sub: `Consumer #${m.consumerNo}`,
        ts: m.timestamp,
        synced: m.synced,
      });
    }

    for (const t of trips) {
      const name = t.staffName || "Field staff";
      tones.push({
        uid: `trp-s-${t.id}`,
        kind: "trip-start",
        recordId: t.id,
        recordKind: "trip",
        staffName: name,
        title: `${name} started a trip`,
        sub: t.start
          ? `From ${t.start.latitude.toFixed(3)}, ${t.start.longitude.toFixed(3)}`
          : "Origin pending",
        ts: t.startedAt,
        synced: t.synced,
      });
      if (t.endedAt) {
        tones.push({
          uid: `trp-e-${t.id}`,
          kind: "trip-end",
          recordId: t.id,
          recordKind: "trip",
          staffName: name,
          title: `${name} ended a trip`,
          sub: `${t.km.toFixed(1)} km · ${formatDuration(t.endedAt - t.startedAt)}`,
          ts: t.endedAt,
          synced: t.synced,
        });
      }
    }

    return tones.sort((a, b) => b.ts - a.ts).slice(0, limit);
  }, [attendance, meterReadings, trips, limit]);

  const display = items.length > 0 ? items : MOCK_ITEMS;

  const onTap = (it: FeedItem) => {
    router.push({
      pathname: "/activity/[id]",
      params: { id: it.recordId, kind: it.recordKind },
    });
  };

  const tintFor = (k: FeedKind) =>
    k === "meter"
      ? colors.pillarTransparency
      : k === "trip-start" || k === "trip-end"
        ? colors.pillarAccuracy
        : k === "checkin"
          ? colors.success
          : colors.destructive;

  return (
    <View style={{ marginTop: 4 }}>
      {display.map((it, i) => (
        <Pressable
          key={it.uid}
          onPress={() => onTap(it)}
          android_ripple={{ color: colors.muted }}
          style={({ pressed }) => [
            styles.row,
            {
              borderBottomColor: colors.border,
              borderBottomWidth:
                i === display.length - 1 ? 0 : StyleSheet.hairlineWidth,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.icon,
              { backgroundColor: tintFor(it.kind) + "1F", borderRadius: 10 },
            ]}
          >
            <Feather name={ICON[it.kind]} size={14} color={tintFor(it.kind)} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text
                numberOfLines={1}
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  flex: 1,
                }}
              >
                {it.title}
              </Text>
              <View
                style={[
                  styles.tag,
                  {
                    backgroundColor: tintFor(it.kind) + "14",
                    borderRadius: 6,
                  },
                ]}
              >
                <Text
                  style={{
                    color: tintFor(it.kind),
                    fontFamily: "Inter_700Bold",
                    fontSize: 9,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  {LABEL[it.kind]}
                </Text>
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 11,
                marginTop: 3,
              }}
            >
              {it.sub} · {timeAgo(it.ts)}
            </Text>
          </View>

          <View style={styles.trailing}>
            {!it.synced && (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: colors.warning,
                }}
              />
            )}
            <Feather
              name="chevron-right"
              size={16}
              color={colors.mutedForeground}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const MOCK_ITEMS: FeedItem[] = [
  {
    uid: "mock-1",
    kind: "meter",
    recordId: "mock-meter-1",
    recordKind: "meter",
    staffName: "Ramesh Kumar",
    title: "Ramesh Kumar read 4,287 kWh",
    sub: "Consumer #218450",
    ts: Date.now() - 1000 * 60 * 5,
    synced: true,
  },
  {
    uid: "mock-2",
    kind: "checkin",
    recordId: "mock-att-1",
    recordKind: "attendance",
    staffName: "Sita Devi",
    title: "Sita Devi checked in",
    sub: "28.612, 77.211",
    ts: Date.now() - 1000 * 60 * 22,
    synced: true,
  },
  {
    uid: "mock-3",
    kind: "trip-end",
    recordId: "mock-trip-1",
    recordKind: "trip",
    staffName: "Arjun Singh",
    title: "Arjun Singh ended a trip",
    sub: "12.4 km · 1h 8m",
    ts: Date.now() - 1000 * 60 * 41,
    synced: true,
  },
  {
    uid: "mock-4",
    kind: "checkout",
    recordId: "mock-att-2",
    recordKind: "attendance",
    staffName: "Pooja Verma",
    title: "Pooja Verma checked out",
    sub: "28.617, 77.217",
    ts: Date.now() - 1000 * 60 * 60,
    synced: true,
  },
];

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString("en-IN");
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  icon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
