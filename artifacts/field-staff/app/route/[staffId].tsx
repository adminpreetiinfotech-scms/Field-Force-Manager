import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path as SvgPath, Rect } from "react-native-svg";

import { NativeRouteMapView } from "@/components/admin/RouteMapView";
import { Trip, TripPoint, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function RouteReplay() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { staffId } = useLocalSearchParams<{ staffId: string }>();
  const { trips, staffLocations, user } = useApp();

  const today = new Date().toISOString().slice(0, 10);

  // Pick today's trip for the staff member, falling back to their most recent.
  const trip: Trip | null = useMemo(() => {
    const mine = trips.filter((t) => t.staffId === staffId);
    const todays = mine.find((t) => t.date === today);
    if (todays) return todays;
    return mine.sort((a, b) => b.startedAt - a.startedAt)[0] || null;
  }, [trips, staffId, today]);

  const peer = useMemo(
    () => staffLocations.find((s) => s.staffId === staffId),
    [staffLocations, staffId],
  );

  const staffName =
    peer?.staffName ||
    trip?.staffName ||
    (user?.id === staffId ? user.name : "Field staff");
  const empCode = peer?.empCode || (user?.id === staffId ? user.empCode : "");

  const path: TripPoint[] = trip?.path || [];
  const hasPath = path.length > 1;

  // Replay scrubber.
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCursor(Math.max(0, path.length - 1));
  }, [path.length]);

  useEffect(() => {
    if (!playing) {
      if (playRef.current) clearInterval(playRef.current);
      playRef.current = null;
      return;
    }
    playRef.current = setInterval(() => {
      setCursor((c) => {
        if (c >= path.length - 1) {
          setPlaying(false);
          return path.length - 1;
        }
        return c + 1;
      });
    }, 220);
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playing, path.length]);

  const region = useMemo(() => {
    if (!hasPath) {
      return {
        latitude: 28.6139,
        longitude: 77.209,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    const lats = path.map((p) => p.latitude);
    const lngs = path.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.012, (maxLat - minLat) * 1.6),
      longitudeDelta: Math.max(0.012, (maxLng - minLng) * 1.6),
    };
  }, [path, hasPath]);

  const distanceKm = trip?.km ?? 0;
  const durationMin = trip
    ? Math.round(((trip.endedAt || Date.now()) - trip.startedAt) / 60000)
    : 0;
  const startTime = trip ? formatTime(trip.startedAt) : "—";
  const endTime = trip
    ? trip.endedAt
      ? formatTime(trip.endedAt)
      : "Live"
    : "—";

  const cursorPoint = path[Math.max(0, Math.min(path.length - 1, cursor))];

  const onScrub = (delta: number) => {
    setPlaying(false);
    setCursor((c) => Math.max(0, Math.min(path.length - 1, c + delta)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + 10 + (Platform.OS === "web" ? 67 : 0),
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Today's route
          </Text>
          <Text
            style={[styles.headerSub, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {staffName}
            {empCode ? `  ·  ${empCode}` : ""}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor:
                ((trip?.endedAt ? colors.mutedForeground : colors.success) +
                  "1F"),
            },
          ]}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              backgroundColor: trip?.endedAt
                ? colors.mutedForeground
                : colors.success,
            }}
          />
          <Text
            style={{
              color: trip?.endedAt ? colors.mutedForeground : colors.success,
              fontSize: 11,
              fontFamily: "Inter_700Bold",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {trip?.endedAt ? "Closed" : "Live"}
          </Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        {!hasPath ? (
          <EmptyState colors={colors} />
        ) : Platform.OS !== "web" ? (
          <NativeRouteMapView
            initialRegion={region}
            path={path}
            cursorIndex={cursor}
            strokeColor={colors.primary}
            cursorColor="orange"
          />
        ) : (
          <WebRouteMap
            path={path}
            cursorIndex={cursor}
            strokeColor={colors.primary}
            background="#DEE7F2"
          />
        )}
      </View>

      <View
        style={[
          styles.bottom,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 18,
          },
        ]}
      >
        <View style={styles.statsRow}>
          <Stat
            label="Distance"
            value={`${distanceKm.toFixed(2)} km`}
            colors={colors}
          />
          <Stat
            label="Duration"
            value={`${Math.floor(durationMin / 60)}h ${durationMin % 60}m`}
            colors={colors}
          />
          <Stat label="Points" value={`${path.length}`} colors={colors} />
        </View>
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
            <Feather name="play" size={11} color={colors.mutedForeground} />{" "}
            Started {startTime}
          </Text>
          <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
            <Feather name="square" size={11} color={colors.mutedForeground} />{" "}
            {trip?.endedAt ? `Ended ${endTime}` : "On shift"}
          </Text>
        </View>

        {hasPath ? (
          <View style={styles.replayRow}>
            <Pressable
              onPress={() => onScrub(-Math.max(1, Math.floor(path.length / 20)))}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.muted,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="rewind" size={18} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={() => {
                if (cursor >= path.length - 1) setCursor(0);
                setPlaying((p) => !p);
              }}
              style={({ pressed }) => [
                styles.playBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather
                name={playing ? "pause" : "play"}
                size={20}
                color="#fff"
              />
              <Text style={styles.playBtnText}>
                {playing ? "Pause replay" : "Play replay"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onScrub(Math.max(1, Math.floor(path.length / 20)))}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.muted,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="fast-forward" size={18} color={colors.foreground} />
            </Pressable>
          </View>
        ) : null}

        {hasPath ? (
          <ScrubBar
            cursor={cursor}
            total={path.length - 1}
            onChange={(c) => {
              setPlaying(false);
              setCursor(c);
            }}
            colors={colors}
          />
        ) : null}

        {hasPath && cursorPoint ? (
          <View style={styles.cursorMeta}>
            <Feather name="map-pin" size={12} color={colors.primary} />
            <Text style={[styles.cursorMetaText, { color: colors.foreground }]}>
              {formatTime(cursorPoint.t)}
            </Text>
            <Text
              style={[
                styles.cursorMetaSub,
                { color: colors.mutedForeground },
              ]}
            >
              {cursorPoint.latitude.toFixed(4)}, {cursorPoint.longitude.toFixed(4)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 10,
          fontFamily: "Inter_600SemiBold",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 18,
          fontFamily: "Inter_700Bold",
          marginTop: 4,
          letterSpacing: -0.4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ScrubBar({
  cursor,
  total,
  onChange,
  colors,
}: {
  cursor: number;
  total: number;
  onChange: (c: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [width, setWidth] = useState(0);
  const pct = total > 0 ? cursor / total : 0;
  return (
    <View style={{ marginTop: 14 }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[
          styles.track,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.fill,
            { backgroundColor: colors.primary, width: `${pct * 100}%` },
          ]}
        />
        <View
          style={[
            styles.thumb,
            {
              backgroundColor: "#fff",
              borderColor: colors.primary,
              left: Math.max(0, Math.min(width - 18, pct * width - 9)),
            },
          ]}
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            if (width <= 0) return;
            const x = e.nativeEvent.locationX;
            const ratio = Math.max(0, Math.min(1, x / width));
            onChange(Math.round(ratio * total));
          }}
          onResponderMove={(e) => {
            if (width <= 0) return;
            const x = e.nativeEvent.locationX;
            const ratio = Math.max(0, Math.min(1, x / width));
            onChange(Math.round(ratio * total));
          }}
        />
      </View>
    </View>
  );
}

function WebRouteMap({
  path,
  cursorIndex,
  strokeColor,
  background,
}: {
  path: TripPoint[];
  cursorIndex: number;
  strokeColor: string;
  background: string;
}) {
  const lats = path.map((p) => p.latitude);
  const lngs = path.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padX = (maxLng - minLng) * 0.15 || 0.001;
  const padY = (maxLat - minLat) * 0.15 || 0.001;
  const x0 = minLng - padX;
  const x1 = maxLng + padX;
  const y0 = minLat - padY;
  const y1 = maxLat + padY;

  const project = (p: TripPoint) => ({
    x: ((p.longitude - x0) / (x1 - x0)) * 100,
    y: ((y1 - p.latitude) / (y1 - y0)) * 100,
  });

  const projected = path.map(project);
  const d = projected
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const cursor = projected[Math.max(0, Math.min(projected.length - 1, cursorIndex))];
  const start = projected[0];
  const end = projected[projected.length - 1];

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: background }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Grid */}
        {[...Array(10)].map((_, i) => (
          <Rect
            key={`gh-${i}`}
            x={0}
            y={i * 10}
            width={100}
            height={0.15}
            fill="rgba(11,37,69,0.08)"
          />
        ))}
        {[...Array(10)].map((_, i) => (
          <Rect
            key={`gv-${i}`}
            x={i * 10}
            y={0}
            width={0.15}
            height={100}
            fill="rgba(11,37,69,0.08)"
          />
        ))}
        {/* Halo trail */}
        <SvgPath
          d={d}
          stroke={strokeColor}
          strokeOpacity={0.15}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        <SvgPath
          d={d}
          stroke={strokeColor}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        {start ? (
          <Circle cx={start.x} cy={start.y} r={1.6} fill="#10B981" stroke="#fff" strokeWidth={0.6} />
        ) : null}
        {end ? (
          <Circle cx={end.x} cy={end.y} r={1.6} fill="#EF4444" stroke="#fff" strokeWidth={0.6} />
        ) : null}
        {cursor ? (
          <>
            <Circle cx={cursor.x} cy={cursor.y} r={3.2} fill={strokeColor} fillOpacity={0.18} />
            <Circle cx={cursor.x} cy={cursor.y} r={1.6} fill="#F59E0B" stroke="#fff" strokeWidth={0.6} />
          </>
        ) : null}
      </Svg>
      <View style={styles.webMapTag}>
        <Feather name="map" size={11} color="#475569" />
        <Text
          style={{
            color: "#475569",
            fontSize: 10,
            fontFamily: "Inter_500Medium",
          }}
        >
          Schematic preview · open on device for live map
        </Text>
      </View>
    </View>
  );
}

function EmptyState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          backgroundColor: colors.muted,
        },
      ]}
    >
      <Feather name="map" size={32} color={colors.mutedForeground} />
      <Text
        style={{
          color: colors.foreground,
          fontSize: 16,
          fontFamily: "Inter_700Bold",
          marginTop: 12,
        }}
      >
        No GPS trail yet
      </Text>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 12,
          fontFamily: "Inter_400Regular",
          marginTop: 6,
          textAlign: "center",
        }}
      >
        This staff member hasn't checked in today, or no GPS points have been
        recorded for the active shift.
      </Text>
    </View>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  mapWrap: { flex: 1, overflow: "hidden" },
  bottom: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 18,
    shadowColor: "#0B2545",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  statsRow: { flexDirection: "row", gap: 12 },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  timeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  replayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  playBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  track: {
    height: 18,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  thumb: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 3,
  },
  cursorMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  cursorMetaText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  cursorMetaSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  webMapTag: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
});
