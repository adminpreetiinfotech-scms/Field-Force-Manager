import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  ApiError,
  type ActivityEvent,
  type ActivityKind,
  type ActivityPage,
  listActivity,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const PAGE_LIMIT = 20;
const POLL_INTERVAL_MS = 5_000;

const ICON: Record<ActivityKind, keyof typeof Feather.glyphMap> = {
  checkin: "log-in",
  checkout: "log-out",
  meter: "zap",
  "trip-start": "play",
  "trip-end": "flag",
};

const LABEL: Record<ActivityKind, string> = {
  checkin: "Check-in",
  checkout: "Check-out",
  meter: "Meter read",
  "trip-start": "Trip started",
  "trip-end": "Trip ended",
};

export function LiveActivityFeed({ companyId }: { companyId?: string | null }) {
  const colors = useColors();
  const [, forceTick] = useState(0);

  // Re-render every 30s so "Xm ago" labels stay accurate.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const query = useInfiniteQuery<ActivityPage, ApiError>({
    queryKey: ["activity", "feed", companyId ?? "all"],
    queryFn: async ({ pageParam }) =>
      listActivity({
        limit: PAGE_LIMIT,
        ...(pageParam ? { cursor: pageParam as string } : {}),
        ...(companyId ? ({ companyId } as object) : {}),
      } as Parameters<typeof listActivity>[0]),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  const items = useMemo(() => {
    if (!query.data) return [] as ActivityEvent[];
    const seen = new Set<string>();
    const all: ActivityEvent[] = [];
    for (const page of query.data.pages) {
      for (const it of page.items) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        all.push(it);
      }
    }
    return all;
  }, [query.data]);

  const tintFor = (k: ActivityKind) =>
    k === "meter"
      ? colors.pillarTransparency
      : k === "trip-start" || k === "trip-end"
        ? colors.pillarAccuracy
        : k === "checkin"
          ? colors.success
          : colors.destructive;

  // ---- Loading skeleton ------------------------------------------------
  if (query.isLoading) {
    return (
      <View style={{ paddingVertical: 24, alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            fontFamily: "Inter_500Medium",
            marginTop: 10,
          }}
        >
          Loading live feed…
        </Text>
      </View>
    );
  }

  // ---- Error state -----------------------------------------------------
  if (query.isError && items.length === 0) {
    return (
      <View
        style={{
          padding: 16,
          backgroundColor: colors.destructive + "0F",
          borderRadius: 12,
          marginTop: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="wifi-off" size={14} color={colors.destructive} />
          <Text
            style={{
              color: colors.destructive,
              fontFamily: "Inter_700Bold",
              fontSize: 13,
            }}
          >
            Couldn't reach the activity feed
          </Text>
        </View>
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 12,
            marginTop: 6,
          }}
        >
          {query.error?.message ?? "Network error"}
        </Text>
        <Pressable
          onPress={() => query.refetch()}
          style={({ pressed }) => ({
            marginTop: 10,
            alignSelf: "flex-start",
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: colors.destructive,
            borderRadius: 8,
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
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  // ---- Empty state -----------------------------------------------------
  if (items.length === 0) {
    return (
      <View style={{ paddingVertical: 24, alignItems: "center" }}>
        <Feather name="inbox" size={20} color={colors.mutedForeground} />
        <Text
          style={{
            color: colors.foreground,
            fontFamily: "Inter_600SemiBold",
            fontSize: 13,
            marginTop: 8,
          }}
        >
          No activity yet
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            marginTop: 4,
          }}
        >
          Field events will appear here in real time.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 4 }}>
      {/* Live status pill */}
      <View style={styles.statusRow}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              backgroundColor: query.isError ? colors.warning : colors.success,
            }}
          />
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 10,
              fontFamily: "Inter_700Bold",
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {query.isError
              ? "Reconnecting…"
              : query.isFetching
                ? "Live · syncing"
                : `Live · ${items.length} event${items.length === 1 ? "" : "s"}`}
          </Text>
        </View>
        {query.isFetching && !query.isFetchingNextPage ? (
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        ) : null}
      </View>

      {items.map((it, i) => (
        <Pressable
          key={it.id}
          onPress={() =>
            router.push({
              pathname: "/activity/[id]",
              params: { id: it.id },
            })
          }
          android_ripple={{ color: colors.muted }}
          style={({ pressed }) => [
            styles.row,
            {
              borderBottomColor: colors.border,
              borderBottomWidth:
                i === items.length - 1 ? 0 : StyleSheet.hairlineWidth,
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
                {it.summary}
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
              {it.staffName} · {timeAgo(it.occurredAt)}
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

      {query.hasNextPage ? (
        <Pressable
          onPress={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          style={({ pressed }) => ({
            marginTop: 12,
            paddingVertical: 12,
            borderRadius: 10,
            backgroundColor: colors.muted,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {query.isFetchingNextPage ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <Feather name="more-horizontal" size={14} color={colors.foreground} />
          )}
          <Text
            style={{
              color: colors.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 12,
            }}
          >
            {query.isFetchingNextPage ? "Loading…" : "Load older events"}
          </Text>
        </Pressable>
      ) : (
        <View style={{ paddingTop: 14, alignItems: "center" }}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 10,
              letterSpacing: 0.4,
            }}
          >
            That's the start of the feed.
          </Text>
        </View>
      )}
    </View>
  );
}

function timeAgo(ts: Date | string | number) {
  const t = typeof ts === "object" ? ts.getTime() : new Date(ts).getTime();
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(t).toLocaleDateString("en-IN");
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingBottom: 8,
  },
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
