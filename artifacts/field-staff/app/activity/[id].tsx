import { Feather } from "@expo/vector-icons";
import {
  type ActivityDetail,
  type ActivityKind,
  useGetActivity,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const TITLE: Record<ActivityKind, string> = {
  checkin: "Check-in",
  checkout: "Check-out",
  meter: "Meter reading",
  "trip-start": "Trip started",
  "trip-end": "Trip ended",
};

export default function ActivityDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useGetActivity(id ?? "", {
    query: {
      queryKey: ["activity", id ?? ""],
      enabled: Boolean(id),
      staleTime: 30_000,
    },
  });

  const detail = query.data;
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace("/(admin)/dashboard")
              }
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
                {detail
                  ? TITLE[detail.kind]
                  : query.isLoading
                    ? "Loading…"
                    : query.isError
                      ? "Couldn't load"
                      : "Not found"}
              </Text>
            </View>
          </View>
        </View>

        {/* Loading */}
        {query.isLoading && (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                marginTop: 10,
              }}
            >
              Fetching record…
            </Text>
          </View>
        )}

        {/* Error */}
        {query.isError && !query.isLoading && (
          <View style={{ padding: 24, alignItems: "center" }}>
            <Feather name="alert-triangle" size={28} color={colors.destructive} />
            <Text
              style={{
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 14,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              Couldn't load this event
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
              {query.error?.message ?? "Network error"}
            </Text>
            <Pressable
              onPress={() => query.refetch()}
              style={({ pressed }) => ({
                marginTop: 14,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  color: "#fff",
                  fontFamily: "Inter_700Bold",
                  fontSize: 12,
                }}
              >
                Try again
              </Text>
            </Pressable>
          </View>
        )}

        {/* Detail */}
        {detail && <DetailBody detail={detail} />}
      </ScrollView>
    </View>
  );
}

function DetailBody({ detail }: { detail: ActivityDetail }) {
  const colors = useColors();
  const isAttendance = detail.kind === "checkin" || detail.kind === "checkout";
  const isMeter = detail.kind === "meter";
  const isTrip = detail.kind === "trip-start" || detail.kind === "trip-end";

  return (
    <View style={{ padding: 18, gap: 14 }}>
      <Card>
        <Row label="Staff" value={detail.staffName} />
        <Row label="Employee ID" value={detail.staffId} />
        <Row label="Event" value={TITLE[detail.kind]} />
        <Row label="Time" value={fmtDateTime(detail.occurredAt)} />
        <Row label="Recorded" value={fmtDateTime(detail.receivedAt)} />
        {detail.location ? (
          <Row label="GPS" value={fmtGeo(detail.location)} />
        ) : null}
        {isMeter && detail.consumerNo ? (
          <Row label="Consumer #" value={detail.consumerNo} />
        ) : null}
        {isMeter && typeof detail.reading === "number" ? (
          <Row
            label="Reading"
            value={`${detail.reading.toLocaleString("en-IN")} kWh`}
          />
        ) : null}
        {isTrip && typeof detail.distanceKm === "number" ? (
          <Row label="Distance" value={`${detail.distanceKm.toFixed(2)} km`} />
        ) : null}
        {isTrip && typeof detail.durationSec === "number" ? (
          <Row label="Duration" value={fmtDuration(detail.durationSec)} />
        ) : null}
        {isTrip && detail.origin ? (
          <Row label="Origin" value={fmtGeo(detail.origin)} />
        ) : null}
        {isTrip && detail.destination ? (
          <Row label="Destination" value={fmtGeo(detail.destination)} />
        ) : null}
        {detail.tripRef ? (
          <Row label="Trip reference" value={shortId(detail.tripRef)} />
        ) : null}
        {detail.notes ? <Row label="Notes" value={detail.notes} /> : null}
        <Row
          label="Sync status"
          value={detail.synced ? "Synced" : "Pending sync"}
          last
        />
      </Card>

      {isAttendance && detail.selfieUri ? (
        <Card title="Selfie evidence">
          <Image
            source={{ uri: detail.selfieUri }}
            style={{
              width: "100%",
              aspectRatio: 1,
              borderRadius: 14,
              backgroundColor: "#0001",
            }}
            resizeMode="cover"
          />
        </Card>
      ) : null}

      {isMeter && detail.photoUri ? (
        <Card title="Meter photo">
          <Image
            source={{ uri: detail.photoUri }}
            style={{
              width: "100%",
              aspectRatio: 4 / 3,
              borderRadius: 14,
              backgroundColor: "#0001",
            }}
            resizeMode="cover"
          />
        </Card>
      ) : null}

      {isTrip ? (
        <Pressable
          onPress={() => router.push(`/route/${detail.staffId}`)}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            borderRadius: 14,
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
            View staff on live map
          </Text>
        </Pressable>
      ) : null}
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
        borderRadius: 18,
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

function fmtDateTime(ts: Date | string | number) {
  const d = typeof ts === "object" ? ts : new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtGeo(g: { latitude: number; longitude: number }) {
  return `${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)}`;
}

function fmtDuration(sec: number) {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}
