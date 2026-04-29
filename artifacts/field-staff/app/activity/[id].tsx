import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type Kind = "attendance" | "meter" | "trip";

export default function ActivityDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: Kind }>();
  const { attendance, meterReadings, trips } = useApp();

  const resolved = useMemo(() => {
    if (kind === "attendance") {
      const a = attendance.find((x) => x.id === id);
      return a ? { kind: "attendance" as const, data: a } : null;
    }
    if (kind === "meter") {
      const m = meterReadings.find((x) => x.id === id);
      return m ? { kind: "meter" as const, data: m } : null;
    }
    if (kind === "trip") {
      const t = trips.find((x) => x.id === id);
      return t ? { kind: "trip" as const, data: t } : null;
    }
    // Fallback: search across all collections (handles direct URLs)
    const a = attendance.find((x) => x.id === id);
    if (a) return { kind: "attendance" as const, data: a };
    const m = meterReadings.find((x) => x.id === id);
    if (m) return { kind: "meter" as const, data: m };
    const t = trips.find((x) => x.id === id);
    if (t) return { kind: "trip" as const, data: t };
    return null;
  }, [id, kind, attendance, meterReadings, trips]);

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
        }}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 12 + webTop,
            paddingHorizontal: 18,
            paddingBottom: 16,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(admin)/dashboard"))}
              hitSlop={10}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
                width: 36,
                height: 36,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.muted,
              })}
            >
              <Feather name="arrow-left" size={18} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 11,
                  fontFamily: "Inter_600SemiBold",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                Activity detail
              </Text>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontFamily: "Inter_700Bold",
                  marginTop: 2,
                  letterSpacing: -0.3,
                }}
              >
                {resolved
                  ? titleFor(resolved)
                  : "Record not found"}
              </Text>
            </View>
          </View>
        </View>

        {!resolved && (
          <View style={{ padding: 24, alignItems: "center" }}>
            <Feather
              name="alert-circle"
              size={28}
              color={colors.mutedForeground}
            />
            <Text
              style={{
                color: colors.foreground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              We couldn't find that record.
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                marginTop: 6,
                textAlign: "center",
              }}
            >
              It may have been removed or this link is from a different
              session.
            </Text>
          </View>
        )}

        {resolved?.kind === "attendance" && (
          <AttendanceDetail data={resolved.data} />
        )}
        {resolved?.kind === "meter" && (
          <MeterDetail data={resolved.data} />
        )}
        {resolved?.kind === "trip" && <TripDetail data={resolved.data} />}
      </ScrollView>
    </View>
  );
}

type Resolved =
  | { kind: "attendance"; data: ReturnType<typeof useApp>["attendance"][number] }
  | { kind: "meter"; data: ReturnType<typeof useApp>["meterReadings"][number] }
  | { kind: "trip"; data: ReturnType<typeof useApp>["trips"][number] };

function titleFor(r: Resolved) {
  if (r.kind === "attendance")
    return r.data.type === "in" ? "Check-in" : "Check-out";
  if (r.kind === "meter") return "Meter reading";
  return "Trip log";
}

function AttendanceDetail({
  data,
}: {
  data: ReturnType<typeof useApp>["attendance"][number];
}) {
  const colors = useColors();
  return (
    <View style={{ padding: 18, gap: 14 }}>
      <Card>
        <Row label="Staff" value={data.staffName} />
        <Row label="Employee ID" value={data.staffId} />
        <Row label="Event" value={data.type === "in" ? "Check in" : "Check out"} />
        <Row
          label="Time"
          value={new Date(data.timestamp).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
        <Row
          label="GPS"
          value={
            data.location
              ? `${data.location.latitude.toFixed(5)}, ${data.location.longitude.toFixed(5)}`
              : "Not captured"
          }
        />
        <Row label="Sync status" value={data.synced ? "Synced" : "Pending sync"} last />
      </Card>

      {data.selfieUri ? (
        <Card title="Selfie evidence">
          <Image
            source={{ uri: data.selfieUri }}
            style={{
              width: "100%",
              aspectRatio: 1,
              borderRadius: colors.radius,
              backgroundColor: colors.muted,
            }}
            resizeMode="cover"
          />
        </Card>
      ) : null}
    </View>
  );
}

function MeterDetail({
  data,
}: {
  data: ReturnType<typeof useApp>["meterReadings"][number];
}) {
  const colors = useColors();
  return (
    <View style={{ padding: 18, gap: 14 }}>
      <Card>
        <Row label="Staff" value={data.staffName} />
        <Row label="Consumer #" value={data.consumerNo} />
        <Row label="Reading" value={`${data.reading.toLocaleString("en-IN")} kWh`} />
        <Row
          label="Time"
          value={new Date(data.timestamp).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
        <Row
          label="GPS"
          value={
            data.location
              ? `${data.location.latitude.toFixed(5)}, ${data.location.longitude.toFixed(5)}`
              : "Not captured"
          }
        />
        {data.notes ? <Row label="Notes" value={data.notes} /> : null}
        <Row label="Sync status" value={data.synced ? "Synced" : "Pending sync"} last />
      </Card>

      {data.photoUri ? (
        <Card title="Meter photo">
          <Image
            source={{ uri: data.photoUri }}
            style={{
              width: "100%",
              aspectRatio: 4 / 3,
              borderRadius: colors.radius,
              backgroundColor: colors.muted,
            }}
            resizeMode="cover"
          />
        </Card>
      ) : null}
    </View>
  );
}

function TripDetail({
  data,
}: {
  data: ReturnType<typeof useApp>["trips"][number];
}) {
  const colors = useColors();
  const duration = data.endedAt
    ? formatDuration(data.endedAt - data.startedAt)
    : "In progress";
  return (
    <View style={{ padding: 18, gap: 14 }}>
      <Card>
        <Row label="Staff" value={data.staffName || data.staffId} />
        <Row label="Date" value={data.date} />
        <Row label="Distance" value={`${data.km.toFixed(2)} km`} />
        <Row label="Duration" value={duration} />
        <Row
          label="Started at"
          value={new Date(data.startedAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
        <Row
          label="Ended at"
          value={
            data.endedAt
              ? new Date(data.endedAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Active"
          }
        />
        <Row
          label="Origin"
          value={
            data.start
              ? `${data.start.latitude.toFixed(5)}, ${data.start.longitude.toFixed(5)}`
              : "—"
          }
        />
        <Row
          label="Destination"
          value={
            data.end
              ? `${data.end.latitude.toFixed(5)}, ${data.end.longitude.toFixed(5)}`
              : data.endedAt
                ? "Not captured"
                : "Pending"
          }
        />
        <Row label="GPS points" value={`${data.path.length}`} last />
      </Card>

      <Pressable
        onPress={() => router.push(`/route/${data.staffId}`)}
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          borderRadius: colors.radius,
          paddingVertical: 14,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Feather name="map" size={15} color="#fff" />
        <Text
          style={{
            color: "#fff",
            fontFamily: "Inter_700Bold",
            fontSize: 14,
            letterSpacing: -0.2,
          }}
        >
          Replay route on map
        </Text>
      </Pressable>
    </View>
  );
}

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: colors.radius + 4,
        padding: 16,
      }}
    >
      {title ? (
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 11,
            fontFamily: "Inter_600SemiBold",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingVertical: 10,
        gap: 12,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}
    >
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 12,
          fontFamily: "Inter_500Medium",
          flex: 0.7,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 13,
          fontFamily: "Inter_600SemiBold",
          flex: 1.3,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
