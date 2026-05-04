import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Save, Loader2, Upload, X, ImageIcon,
  MapPin, Layers, GitBranch, RefreshCw, AlertTriangle, Navigation, RotateCcw, SlidersHorizontal,
} from "lucide-react";
import GeoFenceMapPicker, { type GeoFenceMapPickerHandle } from "@/components/geo-fence-map-picker";
import { DASHBOARD_HINT_PREFIX } from "@/lib/dashboard-hints";
import { useGetDismissedHints, useResetDismissedHints, getGetDismissedHintsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface CompanyProfile {
  id: string;
  name: string;
  adminName: string | null;
  email: string | null;
  state: string | null;
  district: string | null;
  projectName: string | null;
  centerName: string | null;
  tcId: string | null;
  logoUrl: string | null;
  centerLat: number | null;
  centerLng: number | null;
  centerRadiusMeters: number | null;
}

function clearLocalHints(): void {
  Object.keys(localStorage)
    .filter(k => k.startsWith(DASHBOARD_HINT_PREFIX))
    .forEach(k => localStorage.removeItem(k));
}

function getAdminPhone(): string {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return (JSON.parse(raw) as { phone?: string }).phone ?? "";
  } catch { return ""; }
}

function getAdminUser(): { phone: string; companyId?: string; role?: string } | null {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function adminFetch(path: string, opts: RequestInit = {}) {
  return fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-admin-phone": getAdminPhone(),
      ...(opts.headers ?? {}),
    },
  });
}

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve({ base64, mime: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CompanySettings() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();
  const { data: serverHints } = useGetDismissedHints();
  const { mutate: resetHintsOnServer, isPending: resettingHints } = useResetDismissedHints();

  const dismissedHintCount = serverHints?.dismissedHints.length ?? 0;

  const handleResetHints = () => {
    resetHintsOnServer(undefined, {
      onSuccess: (data) => {
        // Clear localStorage only after the server confirms success to avoid divergence on error.
        clearLocalHints();
        // Update query cache immediately so the hint count shows 0 and the
        // dashboard re-enables hints without waiting for the next refetch.
        queryClient.setQueryData(getGetDismissedHintsQueryKey(), data);
        toast({ title: "Dashboard hints restored", description: "All dashboard hints will reappear on your next visit." });
      },
      onError: () => {
        toast({ title: "Failed to reset hints", variant: "destructive" });
      },
    });
  };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [projectName, setProjectName] = useState("");
  const [centerName, setCenterName] = useState("");
  const [tcId, setTcId] = useState("");
  const [centerLat, setCenterLat] = useState("");
  const [centerLng, setCenterLng] = useState("");
  const [centerRadius, setCenterRadius] = useState("200");
  const [locatingGeo, setLocatingGeo] = useState(false);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const geoFencePickerRef = useRef<GeoFenceMapPickerHandle>(null);

  const user = getAdminUser();
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "super_admin";

  const loadProfile = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await adminFetch(`/api/companies/${companyId}/branding`);
      if (!res.ok) throw new Error("Failed to load company profile");
      const data: CompanyProfile = await res.json();
      setProfile(data);
      setName(data.name ?? "");
      setEmail(data.email ?? "");
      setState(data.state ?? "");
      setDistrict(data.district ?? "");
      setProjectName(data.projectName ?? "");
      setCenterName(data.centerName ?? "");
      setTcId(data.tcId ?? "");
      setLogoPreview(data.logoUrl ?? null);
      setCenterLat(data.centerLat != null ? String(data.centerLat) : "");
      setCenterLng(data.centerLng != null ? String(data.centerLng) : "");
      setCenterRadius(data.centerRadiusMeters != null ? String(data.centerRadiusMeters) : "200");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Only image files allowed", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be under 2MB", variant: "destructive" });
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!companyId) return;
    if (!name.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }
    geoFencePickerRef.current?.clearHint();
    setSaving(true);
    try {
      const latNum = centerLat.trim() ? parseFloat(centerLat.trim()) : null;
      const lngNum = centerLng.trim() ? parseFloat(centerLng.trim()) : null;
      const radiusNum = centerRadius.trim() ? parseInt(centerRadius.trim(), 10) : 200;
      const profileRes = await adminFetch(`/api/companies/${companyId}/profile`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          state: state.trim() || null,
          district: district.trim() || null,
          projectName: projectName.trim() || null,
          centerName: centerName.trim() || null,
          tcId: tcId.trim() || null,
          centerLat: Number.isFinite(latNum) ? latNum : null,
          centerLng: Number.isFinite(lngNum) ? lngNum : null,
          centerRadiusMeters: Number.isFinite(radiusNum) && radiusNum >= 50 ? radiusNum : 200,
        }),
      });
      if (!profileRes.ok) throw new Error((await profileRes.json().catch(() => ({}))).title ?? "Profile update failed");

      if (logoFile) {
        const { base64, mime } = await fileToBase64(logoFile);
        const logoRes = await adminFetch(`/api/companies/${companyId}/logo`, {
          method: "PATCH",
          body: JSON.stringify({ logoBase64: base64, logoMime: mime }),
        });
        if (!logoRes.ok) throw new Error((await logoRes.json().catch(() => ({}))).title ?? "Logo upload failed");
        const updated = await logoRes.json();
        setLogoPreview(updated.logoUrl ?? logoPreview);
        setLogoFile(null);
      }

      toast({ title: "Settings saved successfully" });
      await loadProfile();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isSuperAdmin) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
        <div className="border rounded-xl p-8 text-center bg-muted/30 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Super Admin does not have a company.</p>
          <p className="text-sm mt-1">Use the <strong>All Companies</strong> section to manage company details.</p>
        </div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
        <div className="border rounded-xl p-8 text-center bg-muted/30 text-muted-foreground">
          <p className="text-sm">No company associated with your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Update your organization's profile and branding</p>
        </div>
        <Button variant="ghost" size="icon" onClick={loadProfile} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {!loading && !tcId.trim() && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Training Centre ID set nahi hai</p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
              Jab tak Training Centre ID (TC ID) set nahi hoga, tab tak har candidate ke PDF mein Training Centre ID field blank rahega. Neeche "Scheme &amp; Location" section mein TC ID fill karein aur Save karein.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Logo */}
          <div className="border rounded-xl p-6 bg-card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Company Logo</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    {logoPreview ? "Change Logo" : "Upload Logo"}
                  </Button>
                  {logoPreview && (
                    <Button variant="ghost" size="sm" onClick={handleRemoveLogo} className="gap-1.5 text-muted-foreground">
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP — max 2MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </div>
            </div>
            {logoFile && (
              <p className="text-xs text-blue-600 flex items-center gap-1.5">
                <Upload className="h-3 w-3" />
                New logo ready to upload: {logoFile.name}
              </p>
            )}
          </div>

          {/* Basic Info */}
          <div className="border rounded-xl p-6 bg-card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Organization Details</h2>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Company Name <span className="text-red-500">*</span></Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Nistha Skill Development"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contact@organization.com"
                />
              </div>
            </div>
          </div>

          {/* Scheme & Location */}
          <div className="border rounded-xl p-6 bg-card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Scheme &amp; Location</h2>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  Scheme / Project Name
                </Label>
                <Input
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="e.g. DDU-GKY / JSDMS"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  Center / Branch Name
                </Label>
                <Input
                  value={centerName}
                  onChange={e => setCenterName(e.target.value)}
                  placeholder="e.g. Ranchi Training Center"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  Training Centre ID (TC ID)
                </Label>
                <Input
                  value={tcId}
                  onChange={e => setTcId(e.target.value)}
                  placeholder="e.g. JH-RAN-001"
                />
                <p className="text-xs text-muted-foreground">This ID will be auto-printed on all candidate registration PDFs.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    State
                  </Label>
                  <Input
                    value={state}
                    onChange={e => setState(e.target.value)}
                    placeholder="e.g. Jharkhand"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    District
                  </Label>
                  <Input
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    placeholder="e.g. Ranchi"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Geo-fence */}
          <div id="geo-fence" className="border rounded-xl p-6 bg-card space-y-4 scroll-mt-6">
            <div className="flex items-center gap-2 mb-1">
              <Navigation className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Geo-fence (Center Staff Attendance)</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Click anywhere on the map to set the center point. Adjust the radius slider to define the geo-fence area. Center staff check-ins outside this radius will be flagged.
            </p>

            {/* Map picker */}
            <GeoFenceMapPicker
              ref={geoFencePickerRef}
              lat={(() => { const v = parseFloat(centerLat); return Number.isFinite(v) ? v : null; })()}
              lng={(() => { const v = parseFloat(centerLng); return Number.isFinite(v) ? v : null; })()}
              radiusMeters={(() => { const r = parseInt(centerRadius || "200", 10); return Number.isFinite(r) && r > 0 ? r : 200; })()}
              onLocationChange={(lat, lng) => {
                setCenterLat(lat.toFixed(6));
                setCenterLng(lng.toFixed(6));
              }}
              onRadiusChange={(r) => setCenterRadius(String(r))}
            />
            <p className="text-xs text-muted-foreground -mt-1">
              Click the map to drop a pin. The shaded circle shows the geo-fence radius.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  Center Latitude
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={centerLat}
                  onChange={e => setCenterLat(e.target.value)}
                  placeholder="e.g. 23.3565"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  Center Longitude
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={centerLng}
                  onChange={e => setCenterLng(e.target.value)}
                  placeholder="e.g. 85.3095"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center justify-between">
                <span>Geo-fence Radius</span>
                <span className="text-sm font-semibold text-primary">{centerRadius || "200"} m</span>
              </Label>
              <input
                type="range"
                min={50}
                max={1000}
                step={25}
                value={centerRadius || "200"}
                onChange={e => setCenterRadius(e.target.value)}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>50 m</span>
                <span>1000 m</span>
              </div>
              <p className="text-xs text-muted-foreground">Staff outside this radius at check-in/out will be flagged as geo-fence violation.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locatingGeo}
              className="gap-1.5"
              onClick={() => {
                if (!navigator.geolocation) {
                  toast({ title: "Geolocation not supported by this browser", variant: "destructive" });
                  return;
                }
                setLocatingGeo(true);
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setCenterLat(pos.coords.latitude.toFixed(6));
                    setCenterLng(pos.coords.longitude.toFixed(6));
                    setLocatingGeo(false);
                    toast({ title: "Location captured", description: `Lat: ${pos.coords.latitude.toFixed(6)}, Lng: ${pos.coords.longitude.toFixed(6)}` });
                  },
                  () => {
                    setLocatingGeo(false);
                    toast({ title: "Could not get location", description: "Please allow location access or enter coordinates manually.", variant: "destructive" });
                  },
                  { timeout: 10000 },
                );
              }}
            >
              {locatingGeo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
              {locatingGeo ? "Locating…" : "Use My Current Location"}
            </Button>
            {centerLat && centerLng && (
              <p className="text-xs text-emerald-600 font-medium">
                ✓ Geo-fence set at {parseFloat(centerLat).toFixed(5)}, {parseFloat(centerLng).toFixed(5)} — radius {centerRadius || 200}m
              </p>
            )}
          </div>

          {/* Preferences */}
          <div className="border rounded-xl p-6 bg-card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Preferences</h2>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Dashboard hints</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dismissedHintCount > 0
                    ? `${dismissedHintCount} hint${dismissedHintCount === 1 ? "" : "s"} currently dismissed.`
                    : "All dashboard hints are visible."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={dismissedHintCount === 0 || resettingHints}
                onClick={handleResetHints}
                className="gap-1.5 shrink-0"
              >
                {resettingHints ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Reset all hints
              </Button>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pb-4">
            <Button variant="outline" onClick={loadProfile} disabled={saving || loading}>
              Reset Changes
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[120px]">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
