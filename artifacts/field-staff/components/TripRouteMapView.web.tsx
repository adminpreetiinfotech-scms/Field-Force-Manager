import React from "react";
import { View, Text } from "react-native";

export type GpsWaypoint = { lat: number; lng: number; t: number };

type LatLng = { latitude: number; longitude: number };

type Props = {
  start: LatLng | null;
  end: LatLng | null;
  startLabel: string;
  endLabel: string;
  waypoints?: GpsWaypoint[];
};

export function TripRouteMapView({ start, end, startLabel, endLabel, waypoints = [] }: Props) {
  const waypointCount = waypoints.length;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
      {start && (
        <View style={{ alignItems: "center", gap: 8 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#16A34A" }} />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#16A34A" }}>Start</Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#6B7280" }}>{startLabel}</Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#9CA3AF" }}>
            {start.latitude.toFixed(5)}, {start.longitude.toFixed(5)}
          </Text>
        </View>
      )}
      <View style={{ width: 1, height: 32, backgroundColor: "#7C3AED", opacity: 0.4 }} />
      {end && (
        <View style={{ alignItems: "center", gap: 8 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#DC2626" }} />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#DC2626" }}>End</Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#6B7280" }}>{endLabel}</Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#9CA3AF" }}>
            {end.latitude.toFixed(5)}, {end.longitude.toFixed(5)}
          </Text>
        </View>
      )}
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#9CA3AF", marginTop: 8, textAlign: "center" }}>
        {waypointCount >= 2
          ? `GPS route available on mobile (${waypointCount} waypoints)`
          : "Map preview is available on the mobile app"}
      </Text>
    </View>
  );
}

export default TripRouteMapView;
