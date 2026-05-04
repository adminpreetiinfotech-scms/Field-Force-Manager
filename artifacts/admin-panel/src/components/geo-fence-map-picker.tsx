import { useEffect, useRef, useState, type RefObject } from "react";
import { MapContainer, TileLayer, Marker, Circle, Tooltip, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const PIN_ICON = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const HANDLE_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:14px;height:14px;border-radius:50%;
    background:#6366f1;border:2px solid #fff;
    box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:ew-resize;
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function edgeHandlePos(lat: number, lng: number, radiusMeters: number): [number, number] {
  const lngDeg = radiusMeters / (Math.cos((lat * Math.PI) / 180) * 111320);
  return [lat, lng + lngDeg];
}

interface Props {
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  onLocationChange: (lat: number, lng: number) => void;
  onRadiusChange: (radiusMeters: number) => void;
}

function ClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function DraggablePin({
  lat,
  lng,
  radiusMeters,
  showDragHint,
  hintTimerRef,
  isDragMoveRef,
  setShowDragHint,
  onLocationChange,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  showDragHint: boolean;
  hintTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  isDragMoveRef: RefObject<boolean>;
  setShowDragHint: (v: boolean) => void;
  onLocationChange: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  return (
    <Marker
      position={[lat, lng]}
      icon={PIN_ICON}
      draggable={true}
      eventHandlers={{
        dragstart() {
          isDragMoveRef.current = true;
          if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
          setShowDragHint(false);
        },
        drag(e) {
          const pos = (e.target as L.Marker).getLatLng();
          const circleBounds = L.circle(pos, radiusMeters).getBounds();
          map.fitBounds(circleBounds, {
            animate: true,
            duration: 0.1,
            maxZoom: map.getZoom(),
            padding: [24, 24],
          });
        },
        dragend(e) {
          const pos = (e.target as L.Marker).getLatLng();
          onLocationChange(pos.lat, pos.lng);
          isDragMoveRef.current = false;
        },
      }}
    >
      {showDragHint && (
        <Tooltip permanent direction="top" offset={[0, -42]}>
          Drag to reposition
        </Tooltip>
      )}
    </Marker>
  );
}

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    if (!prev || prev.lat !== lat || prev.lng !== lng) {
      prevRef.current = { lat, lng };
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [lat, lng]);
  return null;
}

function EdgeHandle({
  lat,
  lng,
  radiusMeters,
  onRadiusChange,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  onRadiusChange: (radiusMeters: number) => void;
}) {
  const map = useMap();
  const centerLatLng = L.latLng(lat, lng);
  return (
    <Marker
      position={edgeHandlePos(lat, lng, radiusMeters)}
      icon={HANDLE_ICON}
      draggable={true}
      eventHandlers={{
        drag(e) {
          const handleLatLng = (e.target as L.Marker).getLatLng();
          const currentRadius = Math.round(centerLatLng.distanceTo(handleLatLng));
          const clamped = Math.min(1000, Math.max(50, currentRadius));
          const circleBounds = L.circle(centerLatLng, clamped).getBounds();
          map.fitBounds(circleBounds, {
            animate: true,
            duration: 0.1,
            maxZoom: map.getZoom(),
            padding: [24, 24],
          });
        },
        dragend(e) {
          const handleLatLng = (e.target as L.Marker).getLatLng();
          const newRadius = Math.round(centerLatLng.distanceTo(handleLatLng));
          const clamped = Math.min(1000, Math.max(50, newRadius));
          onRadiusChange(clamped);
        },
      }}
    />
  );
}

const DEFAULT_CENTER: [number, number] = [23.3565, 85.3095];
const DEFAULT_ZOOM = 14;

export default function GeoFenceMapPicker({
  lat, lng, radiusMeters, onLocationChange, onRadiusChange,
}: Props) {
  const hasCoords = lat != null && lng != null;
  const center: [number, number] = hasCoords ? [lat, lng] : DEFAULT_CENTER;
  const [showDragHint, setShowDragHint] = useState(true);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragMoveRef = useRef(false);
  const prevLatRef = useRef<number | null>(null);
  const prevLngRef = useRef<number | null>(null);

  useEffect(() => {
    const wasNull = prevLatRef.current == null || prevLngRef.current == null;
    const isNowSet = lat != null && lng != null;
    const coordsChanged =
      isNowSet &&
      (prevLatRef.current !== lat || prevLngRef.current !== lng);

    prevLatRef.current = lat;
    prevLngRef.current = lng;

    const isClickMove = !wasNull && coordsChanged && !isDragMoveRef.current;
    isDragMoveRef.current = false;

    if ((wasNull && isNowSet) || isClickMove) {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      setShowDragHint(true);
      hintTimerRef.current = setTimeout(() => setShowDragHint(false), 4000);
    }

    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [lat, lng]);

  return (
    <div
      className="rounded-lg overflow-hidden border border-border"
      style={{ height: 280, cursor: "crosshair" }}
    >
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onLocationChange={onLocationChange} />
        {hasCoords && (
          <>
            <MapRecenter lat={lat} lng={lng} />
            {/* Center marker — drag to reposition */}
            <DraggablePin
              lat={lat}
              lng={lng}
              radiusMeters={radiusMeters}
              showDragHint={showDragHint}
              hintTimerRef={hintTimerRef}
              isDragMoveRef={isDragMoveRef}
              setShowDragHint={setShowDragHint}
              onLocationChange={onLocationChange}
            />
            {/* Radius circle */}
            <Circle
              center={[lat, lng]}
              radius={radiusMeters}
              pathOptions={{
                color: "#6366f1",
                fillColor: "#6366f1",
                fillOpacity: 0.12,
                weight: 2,
              }}
            />
            {/* Edge handle marker — drag to resize radius */}
            <EdgeHandle
              lat={lat}
              lng={lng}
              radiusMeters={radiusMeters}
              onRadiusChange={onRadiusChange}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
