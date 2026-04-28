import React, { forwardRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { StaffLocation } from "@/contexts/AppContext";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  initialRegion: Region;
  staffLocations: StaffLocation[];
  onSelect: (s: StaffLocation) => void;
};

export const NativeMapView = forwardRef<MapView, Props>(function NativeMapView(
  { initialRegion, staffLocations, onSelect },
  ref,
) {
  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      showsUserLocation
      showsMyLocationButton={false}
    >
      {staffLocations.map((s) => (
        <Marker
          key={s.staffId}
          coordinate={s.location}
          onPress={() => onSelect(s)}
          pinColor={s.status === "in" ? "green" : "gray"}
          title={s.staffName}
          description={s.empCode}
        />
      ))}
    </MapView>
  );
});

export default NativeMapView;
