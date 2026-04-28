import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StaffLocation, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

import { NativeMapView } from "@/components/admin/MapView";

export default function AdminMap() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { staffLocations } = useApp();
  const [region, setRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const mapRef = useRef<{
    animateToRegion?: (r: object) => void;
  } | null>(null);
  const [selected, setSelected] = useState<StaffLocation | null>(
    staffLocations[0] || null,
  );

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          const center = staffLocations[0]?.location || {
            latitude: 28.6139,
            longitude: 77.209,
          };
          setRegion({
            ...center,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          });
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          const center = staffLocations[0]?.location || {
            latitude: 28.6139,
            longitude: 77.209,
          };
          setRegion({
            ...center,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          });
          return;
        }
        const cur = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: cur.coords.latitude,
          longitude: cur.coords.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        });
      } catch {
        setRegion({
          latitude: 28.6139,
          longitude: 77.209,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        });
      }
    })();
  }, [staffLocations]);

  const sorted = useMemo(
    () => [...staffLocations].sort((a, b) => b.updatedAt - a.updatedAt),
    [staffLocations],
  );

  const onShift = sorted.filter((s) => s.status === "in").length;
  const offShift = sorted.length - onShift;

  const webBottomPad = Platform.OS === "web" ? 84 : 84;
  const webTop = Platform.OS === "web" ? 67 : 0;

  const focusOn = (loc: StaffLocation) => {
    setSelected(loc);
    if (Platform.OS !== "web" && mapRef.current) {
      try {
        mapRef.current.animateToRegion?.({
          ...loc.location,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top + 12 + webTop,
          paddingHorizontal: 22,
          paddingBottom: 12,
          backgroundColor: colors.background,
        }}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Live map</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {onShift} on shift  ·  {offShift} off  ·  Updated continuously
        </Text>
      </View>

      <View style={styles.mapWrap}>
        {Platform.OS !== "web" && region ? (
          <NativeMapView
            ref={mapRef as React.Ref<never>}
            initialRegion={region}
            staffLocations={staffLocations}
            onSelect={(s) => setSelected(s)}
          />
        ) : (
          <WebMapPlaceholder
            staffLocations={staffLocations}
            selected={selected}
            onSelect={(s) => setSelected(s)}
          />
        )}
      </View>

      <View
        style={[
          styles.bottomSheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: insets.bottom + webBottomPad,
          },
        ]}
      >
        <View style={styles.handle} />
        {selected ? (
          <View style={styles.selectedRow}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.primary, borderRadius: 999 },
              ]}
            >
              <Text style={styles.avatarText}>
                {selected.staffName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.selectedName, { color: colors.foreground }]}>
                {selected.staffName}
              </Text>
              <Text style={[styles.selectedMeta, { color: colors.mutedForeground }]}>
                {selected.empCode}  ·  {selected.location.latitude.toFixed(4)},{" "}
                {selected.location.longitude.toFixed(4)}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    (selected.status === "in" ? colors.success : colors.mutedForeground) +
                    "1F",
                  borderRadius: 999,
                },
              ]}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor:
                    selected.status === "in"
                      ? colors.success
                      : colors.mutedForeground,
                  borderRadius: 999,
                }}
              />
              <Text
                style={{
                  color:
                    selected.status === "in"
                      ? colors.success
                      : colors.mutedForeground,
                  fontSize: 11,
                  fontFamily: "Inter_700Bold",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {selected.status === "in" ? "On shift" : "Off shift"}
              </Text>
            </View>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingTop: 10 }}
        >
          {sorted.map((s) => {
            const isSel = selected?.staffId === s.staffId;
            return (
              <Pressable
                key={s.staffId}
                onPress={() => focusOn(s)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isSel ? colors.primary : colors.muted,
                    borderColor: isSel ? colors.primary : colors.border,
                    borderRadius: 999,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor:
                      s.status === "in" ? "#34D399" : "#94A3B8",
                  }}
                />
                <Text
                  style={{
                    color: isSel ? "#fff" : colors.foreground,
                    fontSize: 12,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {s.staffName.split(" ")[0]}
                </Text>
                <Text
                  style={{
                    color: isSel
                      ? "rgba(255,255,255,0.7)"
                      : colors.mutedForeground,
                    fontSize: 11,
                    fontFamily: "Inter_500Medium",
                  }}
                >
                  {minutesAgo(s.updatedAt)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function WebMapPlaceholder({
  staffLocations,
  selected,
  onSelect,
}: {
  staffLocations: StaffLocation[];
  selected: StaffLocation | null;
  onSelect: (s: StaffLocation) => void;
}) {
  const colors = useColors();
  // Project lat/lng to a square 0-1 space, fit visible markers
  const lats = staffLocations.map((s) => s.location.latitude);
  const lngs = staffLocations.map((s) => s.location.longitude);
  const minLat = Math.min(...lats) - 0.005;
  const maxLat = Math.max(...lats) + 0.005;
  const minLng = Math.min(...lngs) - 0.005;
  const maxLng = Math.max(...lngs) + 0.005;
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: "#DEE7F2",
        },
      ]}
    >
      {/* Simple grid */}
      {[...Array(10)].map((_, i) => (
        <View
          key={`h-${i}`}
          style={{
            position: "absolute",
            top: `${i * 10}%`,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: "rgba(11,37,69,0.06)",
          }}
        />
      ))}
      {[...Array(10)].map((_, i) => (
        <View
          key={`v-${i}`}
          style={{
            position: "absolute",
            left: `${i * 10}%`,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: "rgba(11,37,69,0.06)",
          }}
        />
      ))}
      {staffLocations.map((s) => {
        const x = ((s.location.longitude - minLng) / (maxLng - minLng)) * 100;
        const y =
          ((maxLat - s.location.latitude) / (maxLat - minLat)) * 100;
        const isSel = selected?.staffId === s.staffId;
        return (
          <Pressable
            key={s.staffId}
            onPress={() => onSelect(s)}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: [{ translateX: -14 }, { translateY: -28 }],
              alignItems: "center",
            }}
          >
            <View
              style={[
                styles.webPin,
                {
                  backgroundColor:
                    s.status === "in" ? colors.success : "#94A3B8",
                  borderColor: isSel ? colors.primary : "#fff",
                  borderWidth: isSel ? 3 : 2,
                },
              ]}
            >
              <Feather name="user" size={12} color="#fff" />
            </View>
            {isSel ? (
              <View
                style={[
                  styles.webLabel,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 10,
                    fontFamily: "Inter_700Bold",
                  }}
                >
                  {s.staffName.split(" ")[0]}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
      <View style={styles.webMapTag}>
        <Feather name="map" size={11} color={colors.mutedForeground} />
        <Text
          style={{
            color: colors.mutedForeground,
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

function minutesAgo(ts: number) {
  const d = Math.floor((Date.now() - ts) / 60000);
  if (d < 1) return "now";
  if (d < 60) return `${d}m`;
  return `${Math.floor(d / 60)}h`;
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  mapWrap: { flex: 1, overflow: "hidden" },
  bottomSheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    shadowColor: "#0B2545",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  selectedName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  selectedMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  webPin: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0B2545",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  webLabel: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  webMapTag: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
});
