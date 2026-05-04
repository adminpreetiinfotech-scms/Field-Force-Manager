import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TripRouteMapView } from "@/components/TripRouteMapView";
import { useColors } from "@/hooks/useColors";

export type TripReportRow = {
  tripRef: string;
  rideDate: string;
  startTime: string;
  endTime: string;
  distanceKm: number | null;
  checkinPhotoUrl: string | null;
  checkoutPhotoUrl: string | null;
  startLocation: string | null;
  endLocation: string | null;
};

export type KmEntry = {
  date: string;
  startOdometerKm?: number | null;
  endOdometerKm?: number | null;
  vehicleKm?: number | null;
  tripCount: number;
  gpsKm: number;
};

export type AttendanceDayInfo = {
  date: string;
  checkinTime: string | null;
  checkoutTime: string | null;
};

type TripRouteData = {
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  waypoints: { lat: number; lng: number; t: number }[];
};

export function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain =
    process.env.EXPO_PUBLIC_DOMAIN ||
    "field-force-manager-Mobilization.replit.app";
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

function parseLatLng(
  s: string | null | undefined,
): { latitude: number; longitude: number } | null {
  if (!s) return null;
  const parts = s.split(",").map((p) => parseFloat(p.trim()));
  if (parts.length < 2 || isNaN(parts[0]!) || isNaN(parts[1]!)) return null;
  return { latitude: parts[0]!, longitude: parts[1]! };
}

export function ReportStatBox({
  icon,
  label,
  value,
  color,
  small,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  color: string;
  small?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color + "10",
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: color + "30",
        paddingVertical: small ? 10 : 14,
        paddingHorizontal: 12,
        alignItems: "center",
        gap: 4,
      }}
    >
      <Feather name={icon} size={small ? 14 : 18} color={color} />
      <Text
        style={{
          fontSize: small ? 16 : 20,
          fontFamily: "Inter_700Bold",
          color,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11,
          fontFamily: "Inter_400Regular",
          color: colors.mutedForeground,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function TripRouteModal({
  trip,
  onClose,
}: {
  trip: TripReportRow | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [routeData, setRouteData] = useState<TripRouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    if (!trip?.tripRef) return;
    setRouteLoading(true);
    setRouteData(null);
    const base = getApiBase();
    fetch(
      `${base}/api/activity/trip-route/${encodeURIComponent(trip.tripRef)}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        setRouteData({
          startLat: data.startLat ?? null,
          startLng: data.startLng ?? null,
          endLat: data.endLat ?? null,
          endLng: data.endLng ?? null,
          waypoints: Array.isArray(data.waypoints) ? data.waypoints : [],
        });
      })
      .catch(() => {
        const fallbackStart = parseLatLng(trip.startLocation);
        const fallbackEnd = parseLatLng(trip.endLocation);
        setRouteData({
          startLat: fallbackStart?.latitude ?? null,
          startLng: fallbackStart?.longitude ?? null,
          endLat: fallbackEnd?.latitude ?? null,
          endLng: fallbackEnd?.longitude ?? null,
          waypoints: [],
        });
      })
      .finally(() => setRouteLoading(false));
  }, [trip?.tripRef]);

  const fmtTime = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (!trip) return null;

  const startCoord =
    routeData?.startLat != null && routeData?.startLng != null
      ? { latitude: routeData.startLat, longitude: routeData.startLng }
      : parseLatLng(trip.startLocation);
  const endCoord =
    routeData?.endLat != null && routeData?.endLng != null
      ? { latitude: routeData.endLat, longitude: routeData.endLng }
      : parseLatLng(trip.endLocation);
  const hasCoords = startCoord !== null || endCoord !== null;
  const waypoints = routeData?.waypoints ?? [];
  const hasFullRoute = waypoints.length >= 2;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: insets.bottom + 24,
            maxHeight: "85%",
          }}
        >
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 999,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View
                  style={{
                    backgroundColor: "#7C3AED18",
                    borderRadius: 10,
                    padding: 8,
                  }}
                >
                  <Feather name="map" size={18} color="#7C3AED" />
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "Inter_700Bold",
                      color: colors.foreground,
                    }}
                  >
                    Trip Route
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter_400Regular",
                      color: colors.mutedForeground,
                      marginTop: 1,
                    }}
                  >
                    {fmtTime(trip.startTime)} → {fmtTime(trip.endTime)}
                    {trip.distanceKm != null
                      ? `  ·  ${trip.distanceKm.toFixed(1)} km`
                      : ""}
                    {hasFullRoute ? `  ·  ${waypoints.length} pts` : ""}
                  </Text>
                </View>
              </View>
              <Pressable onPress={onClose} hitSlop={12}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          {routeLoading ? (
            <View
              style={{
                height: 340,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: colors.mutedForeground,
                }}
              >
                Loading route…
              </Text>
            </View>
          ) : hasCoords ? (
            <View
              style={{
                height: 340,
                marginHorizontal: 0,
                position: "relative",
              }}
            >
              <TripRouteMapView
                start={startCoord}
                end={endCoord}
                startLabel={fmtTime(trip.startTime)}
                endLabel={fmtTime(trip.endTime)}
                waypoints={waypoints}
              />
              <View
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  right: 12,
                  flexDirection: "row",
                  gap: 8,
                }}
                pointerEvents="none"
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(255,255,255,0.92)",
                    borderRadius: 10,
                    padding: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#16A34A",
                    }}
                  />
                  <View>
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: "Inter_500Medium",
                        color: "#6B7280",
                      }}
                    >
                      START
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Inter_700Bold",
                        color: "#111827",
                      }}
                    >
                      {fmtTime(trip.startTime)}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(255,255,255,0.92)",
                    borderRadius: 10,
                    padding: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#DC2626",
                    }}
                  />
                  <View>
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: "Inter_500Medium",
                        color: "#6B7280",
                      }}
                    >
                      END
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Inter_700Bold",
                        color: "#111827",
                      }}
                    >
                      {fmtTime(trip.endTime)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View
              style={{
                paddingVertical: 40,
                paddingHorizontal: 20,
                alignItems: "center",
                gap: 10,
              }}
            >
              <Feather name="slash" size={32} color={colors.mutedForeground} />
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: "Inter_600SemiBold",
                  color: colors.foreground,
                }}
              >
                No location data
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: colors.mutedForeground,
                  textAlign: "center",
                }}
              >
                GPS coordinates were not recorded for this trip.
              </Text>
            </View>
          )}

          <View
            style={{
              paddingHorizontal: 20,
              marginTop: 12,
              flexDirection: "row",
              gap: 10,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "#7C3AED12",
                borderRadius: 12,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "#7C3AED30",
                padding: 12,
                alignItems: "center",
                gap: 3,
              }}
            >
              <Feather name="navigation" size={16} color="#7C3AED" />
              <Text
                style={{
                  fontSize: 17,
                  fontFamily: "Inter_700Bold",
                  color: "#7C3AED",
                }}
              >
                {trip.distanceKm != null
                  ? `${trip.distanceKm.toFixed(1)} km`
                  : "—"}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                  color: colors.mutedForeground,
                }}
              >
                Distance
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: colors.primary + "12",
                borderRadius: 12,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.primary + "30",
                padding: 12,
                alignItems: "center",
                gap: 3,
              }}
            >
              <Feather name="clock" size={16} color={colors.primary} />
              <Text
                style={{
                  fontSize: 17,
                  fontFamily: "Inter_700Bold",
                  color: colors.primary,
                }}
              >
                {(() => {
                  if (!trip.startTime || !trip.endTime) return "—";
                  const diffMs =
                    new Date(trip.endTime).getTime() -
                    new Date(trip.startTime).getTime();
                  const mins = Math.round(diffMs / 60000);
                  if (mins < 60) return `${mins}m`;
                  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                })()}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                  color: colors.mutedForeground,
                }}
              >
                Duration
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function KmDayDetailSheet({
  visible,
  date,
  staffId,
  vehicleType,
  kmEntry,
  onClose,
}: {
  visible: boolean;
  date: string;
  staffId: string;
  vehicleType?: string | null;
  kmEntry: KmEntry | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [trips, setTrips] = useState<TripReportRow[]>([]);
  const [attendanceDay, setAttendanceDay] = useState<AttendanceDayInfo | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripReportRow | null>(null);

  useEffect(() => {
    if (!visible || !date || !staffId) return;
    setLoading(true);
    setFetchError(false);
    setTrips([]);
    setAttendanceDay(null);

    const base = getApiBase();
    const parts = date.split("-").map(Number);
    const year = parts[0] ?? 0;
    const month = parts[1] ?? 0;

    Promise.all([
      fetch(
        `${base}/api/activity/trip-report?from=${date}&to=${date}&staffId=${encodeURIComponent(staffId)}`,
      ).then((r) => {
        if (!r.ok) throw new Error(`trip-report: ${r.status}`);
        return r.json() as Promise<TripReportRow[]>;
      }),
      fetch(
        `${base}/api/activity/attendance-calendar?staffId=${encodeURIComponent(staffId)}&year=${year}&month=${month}`,
      ).then((r) => {
        if (!r.ok) throw new Error(`attendance-calendar: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([tripsData, calData]) => {
        const tripList = Array.isArray(tripsData) ? tripsData : [];
        tripList.sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );
        setTrips(tripList);
        const day = (calData?.days as AttendanceDayInfo[] | undefined)?.find(
          (d) => d.date === date,
        );
        setAttendanceDay(day ?? null);
      })
      .catch(() => {
        setFetchError(true);
      })
      .finally(() => setLoading(false));
  }, [visible, date, staffId]);

  const fmtTime = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const checkinPhoto = trips[0]?.checkinPhotoUrl ?? null;
  const checkoutPhoto = trips[0]?.checkoutPhotoUrl ?? null;

  const displayDate = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: insets.bottom + 28,
            maxHeight: "90%",
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.border,
              alignSelf: "center",
              marginBottom: 20,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  backgroundColor: colors.primary + "14",
                  borderRadius: 10,
                  padding: 8,
                }}
              >
                <Feather name="navigation" size={18} color={colors.primary} />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 17,
                    fontFamily: "Inter_700Bold",
                    color: colors.foreground,
                  }}
                >
                  Day Detail
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_400Regular",
                    color: colors.mutedForeground,
                    marginTop: 2,
                  }}
                >
                  {displayDate}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={{
                  marginTop: 12,
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                }}
              >
                Loading details…
              </Text>
            </View>
          ) : fetchError ? (
            <View
              style={{
                paddingVertical: 40,
                alignItems: "center",
                gap: 10,
              }}
            >
              <Feather name="alert-circle" size={28} color="#DC2626" />
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: "Inter_600SemiBold",
                  color: colors.foreground,
                }}
              >
                Couldn't load details
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: colors.mutedForeground,
                  textAlign: "center",
                  paddingHorizontal: 16,
                }}
              >
                Check your connection and try again.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12, paddingBottom: 8 }}>
                {/* Check-in / Check-out times */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <ReportStatBox
                    icon="clock"
                    label="Check-in"
                    value={fmtTime(attendanceDay?.checkinTime)}
                    color="#1E3A5F"
                  />
                  <ReportStatBox
                    icon="log-out"
                    label="Check-out"
                    value={fmtTime(attendanceDay?.checkoutTime)}
                    color="#6B7280"
                  />
                </View>

                {/* Odometer section for vehicle users */}
                {vehicleType && kmEntry && (
                  <View
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 14,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                      padding: 14,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Feather
                        name="truck"
                        size={15}
                        color={colors.primary}
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: "Inter_600SemiBold",
                          color: colors.foreground,
                        }}
                      >
                        Odometer Readings
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: "#1E3A5F10",
                          borderRadius: 10,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: "#1E3A5F30",
                          padding: 10,
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontFamily: "Inter_700Bold",
                            color: "#1E3A5F",
                          }}
                        >
                          {kmEntry.startOdometerKm != null
                            ? kmEntry.startOdometerKm.toLocaleString("en-IN")
                            : "—"}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Inter_400Regular",
                            color: colors.mutedForeground,
                          }}
                        >
                          Start km
                        </Text>
                      </View>
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: "#16A34A10",
                          borderRadius: 10,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: "#16A34A30",
                          padding: 10,
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontFamily: "Inter_700Bold",
                            color: "#16A34A",
                          }}
                        >
                          {kmEntry.endOdometerKm != null
                            ? kmEntry.endOdometerKm.toLocaleString("en-IN")
                            : "—"}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Inter_400Regular",
                            color: colors.mutedForeground,
                          }}
                        >
                          End km
                        </Text>
                      </View>
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: colors.primary + "10",
                          borderRadius: 10,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: colors.primary + "30",
                          padding: 10,
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontFamily: "Inter_700Bold",
                            color: colors.primary,
                          }}
                        >
                          {kmEntry.vehicleKm != null
                            ? kmEntry.vehicleKm.toFixed(1)
                            : "—"}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Inter_400Regular",
                            color: colors.mutedForeground,
                          }}
                        >
                          Vehicle km
                        </Text>
                      </View>
                    </View>

                    {/* Odometer photos */}
                    {(checkinPhoto || checkoutPhoto) && (
                      <View style={{ gap: 8 }}>
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: "Inter_600SemiBold",
                            color: colors.mutedForeground,
                          }}
                        >
                          Odometer Photos
                        </Text>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          {checkinPhoto ? (
                            <View style={{ flex: 1, gap: 4 }}>
                              <Image
                                source={{ uri: checkinPhoto }}
                                style={{
                                  width: "100%",
                                  height: 90,
                                  borderRadius: 8,
                                  backgroundColor: colors.border,
                                }}
                                resizeMode="cover"
                              />
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontFamily: "Inter_400Regular",
                                  color: colors.mutedForeground,
                                  textAlign: "center",
                                }}
                              >
                                Start
                              </Text>
                            </View>
                          ) : null}
                          {checkoutPhoto ? (
                            <View style={{ flex: 1, gap: 4 }}>
                              <Image
                                source={{ uri: checkoutPhoto }}
                                style={{
                                  width: "100%",
                                  height: 90,
                                  borderRadius: 8,
                                  backgroundColor: colors.border,
                                }}
                                resizeMode="cover"
                              />
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontFamily: "Inter_400Regular",
                                  color: colors.mutedForeground,
                                  textAlign: "center",
                                }}
                              >
                                End
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* GPS summary for non-vehicle users */}
                {!vehicleType && kmEntry && (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <ReportStatBox
                      icon="map"
                      label="GPS Trips"
                      value={String(kmEntry.tripCount)}
                      color="#7C3AED"
                    />
                    <ReportStatBox
                      icon="navigation"
                      label="GPS Distance"
                      value={`${kmEntry.gpsKm.toFixed(1)} km`}
                      color={colors.primary}
                    />
                  </View>
                )}

                {/* Individual GPS trips */}
                {trips.length > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 14,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                      padding: 14,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      <Feather name="map-pin" size={15} color="#7C3AED" />
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: "Inter_600SemiBold",
                          color: colors.foreground,
                        }}
                      >
                        GPS Trips
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: "Inter_400Regular",
                          color: colors.mutedForeground,
                          marginLeft: 2,
                        }}
                      >
                        · Tap to view route
                      </Text>
                    </View>
                    {trips.map((trip, i) => (
                      <Pressable
                        key={trip.tripRef}
                        onPress={() => setSelectedTrip(trip)}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 10,
                          paddingHorizontal: 6,
                          borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                          borderTopColor: colors.border,
                          gap: 10,
                          borderRadius: 8,
                          backgroundColor: pressed
                            ? colors.border + "40"
                            : "transparent",
                        })}
                      >
                        <View
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: "#7C3AED18",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontFamily: "Inter_700Bold",
                              color: "#7C3AED",
                            }}
                          >
                            {i + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: "Inter_600SemiBold",
                              color: colors.foreground,
                            }}
                          >
                            {fmtTime(trip.startTime)} → {fmtTime(trip.endTime)}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: colors.primary + "18",
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: "Inter_700Bold",
                              color: colors.primary,
                            }}
                          >
                            {trip.distanceKm != null
                              ? `${trip.distanceKm.toFixed(1)} km`
                              : "—"}
                          </Text>
                        </View>
                        <Feather
                          name="chevron-right"
                          size={14}
                          color={colors.mutedForeground}
                        />
                      </Pressable>
                    ))}
                  </View>
                )}

                {trips.length === 0 && !loading && (
                  <View
                    style={{
                      paddingVertical: 20,
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Feather
                      name="inbox"
                      size={24}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: "Inter_400Regular",
                        color: colors.mutedForeground,
                      }}
                    >
                      No GPS trips recorded for this day.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
      {selectedTrip !== null && (
        <TripRouteModal
          trip={selectedTrip}
          onClose={() => setSelectedTrip(null)}
        />
      )}
    </Modal>
  );
}
