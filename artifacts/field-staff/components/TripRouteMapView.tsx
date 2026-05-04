import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

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
  const coordinates: LatLng[] = useMemo(() => {
    if (waypoints.length >= 2) {
      return waypoints.map((w) => ({ latitude: w.lat, longitude: w.lng }));
    }
    const pts: LatLng[] = [];
    if (start) pts.push(start);
    if (end) pts.push(end);
    return pts;
  }, [waypoints, start, end]);

  const region = useMemo(() => {
    const pts = coordinates.length > 0 ? coordinates : [start, end].filter(Boolean) as LatLng[];
    if (pts.length === 0) return { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 10, longitudeDelta: 10 };
    const lats = pts.map((p) => p.latitude);
    const lngs = pts.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
    const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.01);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [coordinates, start, end]);

  const hasFull = waypoints.length >= 2;

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      showsUserLocation={false}
      showsMyLocationButton={false}
    >
      {coordinates.length >= 2 && (
        <Polyline
          coordinates={coordinates}
          strokeColor="#7C3AED"
          strokeWidth={3}
          lineDashPattern={hasFull ? undefined : [6, 4]}
        />
      )}
      {start && (
        <Marker
          coordinate={start}
          pinColor="green"
          title="Start"
          description={startLabel}
        />
      )}
      {end && (
        <Marker
          coordinate={end}
          pinColor="red"
          title="End"
          description={endLabel}
        />
      )}
    </MapView>
  );
}

export default TripRouteMapView;
