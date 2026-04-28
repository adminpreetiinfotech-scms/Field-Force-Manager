import React, { forwardRef } from "react";

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

// Web stub — react-native-maps cannot render on web.
// The screen renders a schematic preview instead.
export const NativeMapView = forwardRef<unknown, Props>(function NativeMapView() {
  return null;
});

export default NativeMapView;
