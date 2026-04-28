import React, { forwardRef } from "react";

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

// Web stub — react-native-maps cannot render on web. The screen renders a
// schematic SVG-based path preview instead of using this component.
export const NativeRouteMapView = forwardRef<unknown, Props>(
  function NativeRouteMapView() {
    return null;
  },
);

export default NativeRouteMapView;
