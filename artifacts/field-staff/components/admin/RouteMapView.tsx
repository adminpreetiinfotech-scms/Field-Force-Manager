import React, { forwardRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { TripPoint } from "@/contexts/AppContext";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  initialRegion: Region;
  path: TripPoint[];
  cursorIndex: number;
  strokeColor: string;
  cursorColor: string;
};

export const NativeRouteMapView = forwardRef<MapView, Props>(
  function NativeRouteMapView(
    { initialRegion, path, cursorIndex, strokeColor, cursorColor },
    ref,
  ) {
    const start = path[0];
    const end = path[path.length - 1];
    const cursor = path[Math.max(0, Math.min(path.length - 1, cursorIndex))];
    return (
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {path.length > 1 ? (
          <Polyline
            coordinates={path.map((p) => ({
              latitude: p.latitude,
              longitude: p.longitude,
            }))}
            strokeColor={strokeColor}
            strokeWidth={4}
          />
        ) : null}
        {start ? (
          <Marker
            coordinate={{ latitude: start.latitude, longitude: start.longitude }}
            pinColor="green"
            title="Shift start"
          />
        ) : null}
        {end ? (
          <Marker
            coordinate={{ latitude: end.latitude, longitude: end.longitude }}
            pinColor="red"
            title="Latest position"
          />
        ) : null}
        {cursor ? (
          <Marker
            coordinate={{
              latitude: cursor.latitude,
              longitude: cursor.longitude,
            }}
            pinColor={cursorColor}
            title="Replay"
          />
        ) : null}
      </MapView>
    );
  },
);

export default NativeRouteMapView;
