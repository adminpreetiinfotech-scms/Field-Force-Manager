import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, MapPin, Clock, Wifi, WifiOff, Users, AlertTriangle, Pencil, ChevronDown } from "lucide-react";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";

// ─── Fix leaflet default icon issue with Vite ─────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveStaff {
  staffId: string;
  staffName: string;
  empCode: string;
  area: string | null;
  role: string;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: string | null;
  isOnShift: boolean;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

function getAdminPhone(): string {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return (JSON.parse(raw) as { phone?: string }).phone ?? "";
  } catch {
    return "";
  }
}

function getAdminCompanyId(): string | null {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return null;
    return (JSON.parse(raw) as { companyId?: string }).companyId ?? null;
  } catch {
    return null;
  }
}

// ─── Haversine distance ───────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOutsideFence(staff: LiveStaff, geoFence: GeoFence | null): boolean {
  if (!geoFence || staff.lastLat == null || staff.lastLng == null) return false;
  return (
    haversineMeters(staff.lastLat, staff.lastLng, geoFence.centerLat, geoFence.centerLng) >
    geoFence.centerRadiusMeters
  );
}

// ─── Geo-fence types ──────────────────────────────────────────────────────────

interface GeoFence {
  centerLat: number;
  centerLng: number;
  centerRadiusMeters: number;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const ACTIVE_THRESHOLD_MINUTES = 60;

function isActive(staff: LiveStaff): boolean {
  if (!staff.lastLat || !staff.lastLng || !staff.lastLocationAt) return false;
  const mins = differenceInMinutes(new Date(), new Date(staff.lastLocationAt));
  return mins <= ACTIVE_THRESHOLD_MINUTES;
}

function getStatusLabel(staff: LiveStaff): "active" | "idle" | "offline" {
  if (!staff.lastLat || !staff.lastLng || !staff.lastLocationAt) return "offline";
  const mins = differenceInMinutes(new Date(), new Date(staff.lastLocationAt));
  if (mins <= 15) return "active";
  if (mins <= ACTIVE_THRESHOLD_MINUTES) return "idle";
  return "offline";
}

// ─── Custom map markers ───────────────────────────────────────────────────────

function createMarkerIcon(status: "active" | "idle" | "offline", isOnShift: boolean, outsideFence = false) {
  const colors = {
    active: { bg: "#22c55e", border: "#16a34a", ring: "rgba(34,197,94,0.3)" },
    idle:   { bg: "#f59e0b", border: "#d97706", ring: "rgba(245,158,11,0.3)" },
    offline: { bg: "#94a3b8", border: "#64748b", ring: "transparent" },
  }[status];

  const shiftDot = isOnShift && status !== "offline"
    ? `<div style="position:absolute;top:-2px;right:-2px;width:8px;height:8px;background:#3b82f6;border:1.5px solid white;border-radius:50%;"></div>`
    : "";

  const pulseRing = status === "active"
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;background:${colors.ring};animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>`
    : "";

  const fenceBadge = outsideFence
    ? `<div style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);background:#f59e0b;border:1.5px solid #92400e;border-radius:3px;width:14px;height:12px;display:flex;align-items:center;justify-content:center;z-index:2;box-shadow:0 1px 3px rgba(0,0,0,0.4);">
         <span style="color:#fff;font-size:9px;font-weight:900;line-height:1;">!</span>
       </div>`
    : "";

  return L.divIcon({
    className: "",
    iconSize: [28, outsideFence ? 40 : 28],
    iconAnchor: [14, outsideFence ? 40 : 28],
    popupAnchor: [0, -30],
    html: `
      <style>
        @keyframes ping { 75%,100%{transform:scale(2);opacity:0} }
      </style>
      <div style="position:relative;width:28px;height:${outsideFence ? 40 : 28}px;">
        ${pulseRing}
        <div style="
          width:28px;height:28px;
          background:${colors.bg};
          border:2.5px solid ${colors.border};
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
          position:relative;z-index:1;
        "></div>
        ${shiftDot}
        ${fenceBadge}
      </div>
    `,
  });
}

// ─── Map fit bounds helper ────────────────────────────────────────────────────

function FitBounds({ staff, geoFence }: { staff: LiveStaff[]; geoFence: GeoFence | null }) {
  const map = useMap();
  const didFit = useRef(false);

  useEffect(() => {
    if (didFit.current) return;
    const located = staff.filter(s => s.lastLat && s.lastLng);

    // Collect all points to include in bounds: staff positions + geo-fence center
    const points: L.LatLngTuple[] = located.map(s => [s.lastLat!, s.lastLng!]);
    if (geoFence) {
      points.push([geoFence.centerLat, geoFence.centerLng]);
    }

    if (points.length === 0) return;

    if (points.length === 1 && !geoFence) {
      map.setView(points[0], 13);
    } else if (geoFence && points.length === 1) {
      // Only geo-fence, no staff — zoom to show the circle
      const circle = L.circle([geoFence.centerLat, geoFence.centerLng], { radius: geoFence.centerRadiusMeters });
      map.fitBounds(circle.getBounds(), { padding: [40, 40], maxZoom: 16 });
    } else {
      const bounds = L.latLngBounds(points);
      // Expand bounds to also encompass the geo-fence circle if present
      if (geoFence) {
        const circle = L.circle([geoFence.centerLat, geoFence.centerLng], { radius: geoFence.centerRadiusMeters });
        bounds.extend(circle.getBounds());
      }
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
    didFit.current = true;
  }, [staff, geoFence, map]);

  return null;
}

// ─── Sidebar staff card ───────────────────────────────────────────────────────

function StaffCard({
  staff,
  selected,
  onClick,
  geoFence,
}: {
  staff: LiveStaff;
  selected: boolean;
  onClick: () => void;
  geoFence: GeoFence | null;
}) {
  const status = getStatusLabel(staff);
  const statusConfig = {
    active:  { label: "Active",   cls: "bg-green-100 text-green-800 border-green-200" },
    idle:    { label: "Idle",     cls: "bg-amber-100 text-amber-800 border-amber-200" },
    offline: { label: "Offline",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
  }[status];
  const outsideFence = isOutsideFence(staff, geoFence);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 transition-colors hover:bg-muted/60 cursor-pointer ${
        selected && outsideFence
          ? "bg-amber-50 border-l-2 border-l-primary"
          : selected
          ? "bg-primary/5 border-l-2 border-l-primary"
          : outsideFence
          ? "bg-amber-50 border-l-2 border-l-amber-400"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{staff.staffName}</p>
          <p className="text-xs text-muted-foreground font-mono">{staff.empCode}</p>
        </div>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${statusConfig.cls}`}>
          {statusConfig.label}
        </Badge>
      </div>
      {outsideFence && (
        <div className="flex items-center justify-between gap-1 mt-1">
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
              Outside fence
            </span>
          </div>
          <a
            href={`${import.meta.env.BASE_URL}settings#geo-fence`}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            Edit fence
          </a>
        </div>
      )}
      {staff.area && (
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          <p className="text-xs text-muted-foreground truncate">{staff.area}</p>
        </div>
      )}
      {staff.lastLocationAt ? (
        <div className="flex items-center gap-1 mt-0.5">
          <Clock className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(staff.lastLocationAt), { addSuffix: true })}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-0.5 italic">No location data</p>
      )}
      {staff.isOnShift && status !== "offline" && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 font-medium mt-0.5">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block" />
          On Shift
        </span>
      )}
    </div>
  );
}

// ─── Geo-fence popup content ──────────────────────────────────────────────────

function GeoFencePopupContent({
  geoFence,
  onEdit,
}: {
  geoFence: GeoFence;
  onEdit: () => void;
}) {
  const radiusKm = (geoFence.centerRadiusMeters / 1000).toFixed(2);
  const showKm = geoFence.centerRadiusMeters >= 1000;

  return (
    <div className="min-w-[200px] text-sm space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-base leading-tight">Geo-fence</p>
        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-800">
          Boundary
        </span>
      </div>

      <div className="text-xs text-gray-500 font-mono">
        {geoFence.centerLat.toFixed(5)}, {geoFence.centerLng.toFixed(5)}
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-600">
        <MapPin className="h-3 w-3 shrink-0 text-indigo-500" />
        Radius:{" "}
        {showKm
          ? `${radiusKm} km`
          : `${geoFence.centerRadiusMeters.toLocaleString()} m`}
      </div>

      <div className="pt-1 border-t border-gray-100">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <Pencil className="h-3 w-3 shrink-0" />
          Edit geo-fence
        </button>
      </div>
    </div>
  );
}

// ─── Map popup content ────────────────────────────────────────────────────────

function PopupContent({ staff }: { staff: LiveStaff }) {
  const status = getStatusLabel(staff);
  const statusConfig = {
    active:  { label: "Active",  cls: "bg-green-100 text-green-800" },
    idle:    { label: "Idle",    cls: "bg-amber-100 text-amber-800" },
    offline: { label: "Offline", cls: "bg-slate-100 text-slate-600" },
  }[status];

  return (
    <div className="min-w-[180px] text-sm space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-base leading-tight">{staff.staffName}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusConfig.cls}`}>
          {statusConfig.label}
        </span>
      </div>
      <p className="text-xs text-gray-500 font-mono">{staff.empCode}</p>

      {staff.area && (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <MapPin className="h-3 w-3 shrink-0" />
          {staff.area}
        </div>
      )}

      {staff.lastLat && staff.lastLng && (
        <div className="text-xs text-gray-500 font-mono">
          {staff.lastLat.toFixed(5)}, {staff.lastLng.toFixed(5)}
        </div>
      )}

      {staff.lastLocationAt && (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Clock className="h-3 w-3 shrink-0" />
          {format(new Date(staff.lastLocationAt), "dd MMM yyyy, hh:mm a")}
        </div>
      )}

      {staff.isOnShift && (
        <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block" />
          Currently on shift
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000;
// Default center: Jharkhand, India
const DEFAULT_CENTER: [number, number] = [23.6102, 85.2799];
const DEFAULT_ZOOM = 8;

export default function LiveMapPage() {
  const [, navigate] = useLocation();
  const [staffList, setStaffList] = useState<LiveStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "offline" | "outside-fence">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [geoFence, setGeoFence] = useState<GeoFence | null>(null);
  const [outsideCollapsed, setOutsideCollapsed] = useState(() => {
    try { return localStorage.getItem("livemap:outsideCollapsed") === "true"; } catch { return false; }
  });
  const [insideCollapsed, setInsideCollapsed] = useState(() => {
    try { return localStorage.getItem("livemap:insideCollapsed") === "true"; } catch { return false; }
  });
  const markerRefs = useRef<Record<string, L.Marker>>({});
  const [fenceChangeNotice, setFenceChangeNotice] = useState<string | null>(null);
  const prevOutsideFenceCountRef = useRef<number | null>(null);
  const filterStatusRef = useRef(filterStatus);
  const geoFenceRef = useRef(geoFence);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist sidebar collapsed prefs to localStorage
  useEffect(() => { try { localStorage.setItem("livemap:outsideCollapsed", String(outsideCollapsed)); } catch {} }, [outsideCollapsed]);
  useEffect(() => { try { localStorage.setItem("livemap:insideCollapsed", String(insideCollapsed)); } catch {} }, [insideCollapsed]);

  // Keep refs in sync with latest state so fetchLocations can read them
  useEffect(() => { filterStatusRef.current = filterStatus; }, [filterStatus]);
  useEffect(() => { geoFenceRef.current = geoFence; }, [geoFence]);

  // Clean up notice timer on unmount
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // Detect outside-fence count changes on every staffList update
  useEffect(() => {
    const fence = geoFenceRef.current;
    if (!fence) return;
    const newCount = staffList.filter(s => isOutsideFence(s, fence)).length;
    const prev = prevOutsideFenceCountRef.current;
    if (prev !== null && filterStatusRef.current === "outside-fence" && newCount !== prev) {
      const delta = newCount - prev;
      let msg: string;
      if (delta > 0) {
        msg = `${delta} more staff moved outside the fence.`;
      } else {
        const returned = Math.abs(delta);
        msg = returned === 1
          ? "1 staff member moved back inside the fence."
          : `${returned} staff members moved back inside the fence.`;
      }
      setFenceChangeNotice(msg);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => setFenceChangeNotice(null), 5000);
    }
    prevOutsideFenceCountRef.current = newCount;
  }, [staffList]);

  // Fetch geo-fence config once on mount
  useEffect(() => {
    const companyId = getAdminCompanyId();
    if (!companyId) return;
    fetch(`/api/companies/${companyId}/branding`, {
      headers: { "x-admin-phone": getAdminPhone() },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (
          data &&
          typeof data.centerLat === "number" &&
          typeof data.centerLng === "number"
        ) {
          setGeoFence({
            centerLat: data.centerLat,
            centerLng: data.centerLng,
            centerRadiusMeters: typeof data.centerRadiusMeters === "number" ? data.centerRadiusMeters : 200,
          });
        }
      })
      .catch(() => {});
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/live-locations", {
        headers: { "x-admin-phone": getAdminPhone() },
      });
      if (res.ok) {
        const data: LiveStaff[] = await res.json();
        setStaffList(data);
        setLastRefresh(new Date());
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchLocations();
    const timer = setInterval(fetchLocations, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchLocations]);

  // Filter logic
  const filtered = staffList.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.staffName.toLowerCase().includes(q) && !s.empCode.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterStatus === "active") return isActive(s);
    if (filterStatus === "offline") return !isActive(s);
    if (filterStatus === "outside-fence") return isOutsideFence(s, geoFence);
    return true;
  });

  const locatedStaff = filtered.filter(s => s.lastLat && s.lastLng);
  const activeCount = staffList.filter(isActive).length;
  const offlineCount = staffList.length - activeCount;
  const outsideFenceCount = geoFence
    ? staffList.filter(s => isOutsideFence(s, geoFence)).length
    : 0;

  const handleSidebarClick = (staff: LiveStaff) => {
    setSelectedId(staff.staffId);
    if (staff.lastLat && staff.lastLng) {
      const marker = markerRefs.current[staff.staffId];
      if (marker) {
        marker.openPopup();
      }
    }
  };

  const statusOrder = { active: 0, idle: 1, offline: 2 } as const;
  const sortByStatus = (a: (typeof filtered)[0], b: (typeof filtered)[0]) => {
    const sa = getStatusLabel(a);
    const sb = getStatusLabel(b);
    return statusOrder[sa] - statusOrder[sb];
  };
  const outsideStaff = filtered.filter((s) => isOutsideFence(s, geoFence)).sort(sortByStatus);
  const insideStaff = filtered.filter((s) => !isOutsideFence(s, geoFence)).sort(sortByStatus);

  return (
    <div className="flex flex-col h-full -m-4 md:-m-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">Live Staff Locations</h1>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <Wifi className="h-3.5 w-3.5" />
              {activeCount} active
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <WifiOff className="h-3.5 w-3.5" />
              {offlineCount} offline
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {staffList.length} total
            </span>
            {(outsideFenceCount > 0 || filterStatus === "outside-fence") && (
              <>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => setFilterStatus(f => f === "outside-fence" ? "all" : "outside-fence")}
                  className={`flex items-center gap-1 font-medium rounded px-1 py-0.5 transition-colors cursor-pointer ${
                    filterStatus === "outside-fence"
                      ? "bg-amber-200 text-amber-800"
                      : "text-amber-600 hover:bg-amber-100"
                  }`}
                  title={filterStatus === "outside-fence" ? "Clear outside-fence filter" : "Show only outside-fence staff"}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {outsideFenceCount} outside fence
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => { setLoading(true); fetchLocations(); }}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Body: sidebar + map */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-r bg-card flex flex-col overflow-hidden">
          {/* Sidebar filters */}
          <div className="p-3 border-b space-y-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name or emp code..."
                className="pl-8 h-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                <SelectItem value="active">Active Only (last 60 min)</SelectItem>
                <SelectItem value="offline">Offline Only</SelectItem>
                {geoFence && <SelectItem value="outside-fence">Outside Fence Only</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Outside-fence change notice */}
          {fenceChangeNotice && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-snug">{fenceChangeNotice}</p>
              <button
                type="button"
                className="ml-auto text-amber-500 hover:text-amber-700 shrink-0"
                onClick={() => setFenceChangeNotice(null)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          {/* Staff list */}
          <div className="flex-1 overflow-y-auto">
            {loading && staffList.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Loading staff locations...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                <MapPin className="h-8 w-8 opacity-30" />
                <p className="text-sm">No staff found</p>
              </div>
            ) : (
              <>
                {outsideStaff.length > 0 && (
                  <>
                    <button
                      className="w-full px-3 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center gap-1.5 cursor-pointer hover:bg-amber-100 transition-colors text-left"
                      onClick={() => setOutsideCollapsed((v) => !v)}
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-amber-600 transition-transform ${outsideCollapsed ? "-rotate-90" : ""}`}
                      />
                      <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                        Outside Fence
                      </span>
                      <span className="ml-auto text-xs font-medium bg-amber-200 text-amber-800 rounded-full px-1.5 py-0.5 leading-none">
                        {outsideStaff.length}
                      </span>
                    </button>
                    {!outsideCollapsed && outsideStaff.map((s) => (
                      <StaffCard
                        key={s.staffId}
                        staff={s}
                        selected={selectedId === s.staffId}
                        onClick={() => handleSidebarClick(s)}
                        geoFence={geoFence}
                      />
                    ))}
                  </>
                )}
                {insideStaff.length > 0 && (
                  <>
                    <button
                      className="w-full px-3 py-1.5 bg-muted/40 border-b flex items-center gap-1.5 cursor-pointer hover:bg-muted/60 transition-colors text-left"
                      onClick={() => setInsideCollapsed((v) => !v)}
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${insideCollapsed ? "-rotate-90" : ""}`}
                      />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        All Staff
                      </span>
                      <span className="ml-auto text-xs font-medium bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">
                        {insideStaff.length}
                      </span>
                    </button>
                    {!insideCollapsed && insideStaff.map((s) => (
                      <StaffCard
                        key={s.staffId}
                        staff={s}
                        selected={selectedId === s.staffId}
                        onClick={() => handleSidebarClick(s)}
                        geoFence={geoFence}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* Legend */}
          <div className="p-3 border-t shrink-0 bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground mb-2">MAP LEGEND</p>
            <div className="space-y-1">
              {[
                { color: "bg-green-500", label: "Active (last 15 min)" },
                { color: "bg-amber-400", label: "Idle (15–60 min ago)" },
                { color: "bg-slate-400", label: "Offline (>60 min or no data)" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                  {label}
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-blue-500" />
                Blue dot = On Shift
              </div>
              {geoFence && (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span className="w-2.5 h-2.5 shrink-0 rounded-full border-2 border-dashed border-indigo-500" />
                    Geo-fence boundary
                  </div>
                  <div className="flex items-center gap-2 text-xs text-orange-600 mt-1">
                    <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                    Outside fence
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1 relative">
          {staffList.length === 0 && !loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground z-10 bg-muted/20">
              <MapPin className="h-12 w-12 opacity-20" />
              <p className="text-lg font-medium">No live staff available</p>
              <p className="text-sm">Staff locations will appear here once they are active.</p>
            </div>
          ) : null}

          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: "100%", width: "100%" }}
            zoomControl
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FitBounds staff={locatedStaff} geoFence={geoFence} />

            {geoFence && (
              <Circle
                center={[geoFence.centerLat, geoFence.centerLng]}
                radius={geoFence.centerRadiusMeters}
                pathOptions={{
                  color: "#6366f1",
                  fillColor: "#6366f1",
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: "6 4",
                }}
              >
                <Popup>
                  <GeoFencePopupContent
                    geoFence={geoFence}
                    onEdit={() => navigate("/settings")}
                  />
                </Popup>
              </Circle>
            )}

            {locatedStaff.map((staff) => {
              const status = getStatusLabel(staff);
              return (
                <Marker
                  key={staff.staffId}
                  position={[staff.lastLat!, staff.lastLng!]}
                  icon={createMarkerIcon(status, staff.isOnShift, isOutsideFence(staff, geoFence))}
                  ref={(ref) => {
                    if (ref) markerRefs.current[staff.staffId] = ref;
                  }}
                  eventHandlers={{
                    click: () => setSelectedId(staff.staffId),
                  }}
                >
                  <Popup>
                    <PopupContent staff={staff} />
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Auto-refresh countdown badge */}
          <div className="absolute bottom-4 right-4 z-[1000] bg-card/90 backdrop-blur-sm border rounded-full px-3 py-1 text-xs text-muted-foreground shadow">
            Auto-refresh: 30s
          </div>
        </div>
      </div>
    </div>
  );
}
