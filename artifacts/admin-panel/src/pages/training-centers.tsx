import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Plus, Pencil, Trash2, Loader2, MapPin, X, Check,
  Navigation, BookOpen, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import GeoFenceMapPicker, { type GeoFenceMapPickerHandle } from "@/components/geo-fence-map-picker";

interface Center {
  id: string;
  companyId: string;
  name: string;
  tcId: string | null;
  courses: string[];
  state: string | null;
  district: string | null;
  block: string | null;
  pinCode: string | null;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  createdAt: string | null;
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

const BLANK_FORM = {
  name: "",
  tcId: "",
  courses: [] as string[],
  courseInput: "",
  state: "",
  district: "",
  block: "",
  pinCode: "",
  lat: "",
  lng: "",
  radiusMeters: "200",
};

type FormState = typeof BLANK_FORM;

interface CenterFormProps {
  initial?: Center | null;
  companyId: string;
  onSaved: (c: Center) => void;
  onCancel: () => void;
}

function CenterForm({ initial, companyId, onSaved, onCancel }: CenterFormProps) {
  const { toast } = useToast();
  const geoRef = useRef<GeoFenceMapPickerHandle>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          name: initial.name,
          tcId: initial.tcId ?? "",
          courses: initial.courses ?? [],
          courseInput: "",
          state: initial.state ?? "",
          district: initial.district ?? "",
          block: initial.block ?? "",
          pinCode: initial.pinCode ?? "",
          lat: initial.lat != null ? String(initial.lat) : "",
          lng: initial.lng != null ? String(initial.lng) : "",
          radiusMeters: String(initial.radiusMeters ?? 200),
        }
      : BLANK_FORM,
  );

  const set = (k: keyof FormState, v: string | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addCourse = () => {
    const c = form.courseInput.trim();
    if (!c) return;
    if (form.courses.includes(c)) { set("courseInput", ""); return; }
    set("courses", [...form.courses, c]);
    set("courseInput", "");
  };

  const removeCourse = (c: string) =>
    set("courses", form.courses.filter((x) => x !== c));

  const handleSave = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast({ title: "Center name required (min 2 characters)", variant: "destructive" }); return;
    }
    geoRef.current?.clearHint();
    setSaving(true);
    try {
      const latNum = form.lat.trim() ? parseFloat(form.lat.trim()) : null;
      const lngNum = form.lng.trim() ? parseFloat(form.lng.trim()) : null;
      const radiusNum = parseInt(form.radiusMeters || "200", 10);
      const body = {
        name: form.name.trim(),
        tcId: form.tcId.trim() || null,
        courses: form.courses,
        state: form.state.trim() || null,
        district: form.district.trim() || null,
        block: form.block.trim() || null,
        pinCode: form.pinCode.trim() || null,
        lat: Number.isFinite(latNum) ? latNum : null,
        lng: Number.isFinite(lngNum) ? lngNum : null,
        radiusMeters: Number.isFinite(radiusNum) && radiusNum >= 50 ? radiusNum : 200,
      };
      const url = initial
        ? `/api/companies/${companyId}/centers/${initial.id}`
        : `/api/companies/${companyId}/centers`;
      const res = await adminFetch(url, {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).title ?? "Save failed");
      const saved: Center = await res.json();
      toast({ title: initial ? "Center updated" : "Center created" });
      onSaved(saved);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" }); return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoRef.current?.suppressNextAutoHint();
        set("lat", pos.coords.latitude.toFixed(6));
        set("lng", pos.coords.longitude.toFixed(6));
        setLocating(false);
        geoRef.current?.clearHint();
      },
      () => {
        setLocating(false);
        toast({ title: "Could not get location", variant: "destructive" });
      },
      { timeout: 10000 },
    );
  };

  return (
    <div className="border rounded-xl bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">
          {initial ? "Edit Training Center" : "New Training Center"}
        </h3>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Basic */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Training Center Name <span className="text-red-500">*</span></Label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Ranchi Training Center" />
        </div>
        <div className="space-y-1.5">
          <Label>TC ID / Training Center ID</Label>
          <Input value={form.tcId} onChange={e => set("tcId", e.target.value)} placeholder="e.g. JH-RAN-001" />
          <p className="text-xs text-muted-foreground">Auto-printed on candidate PDFs</p>
        </div>
        <div className="space-y-1.5">
          <Label>PIN Code</Label>
          <Input value={form.pinCode} onChange={e => set("pinCode", e.target.value)} placeholder="e.g. 834001" maxLength={6} />
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <Input value={form.state} onChange={e => set("state", e.target.value)} placeholder="e.g. Jharkhand" />
        </div>
        <div className="space-y-1.5">
          <Label>District</Label>
          <Input value={form.district} onChange={e => set("district", e.target.value)} placeholder="e.g. Ranchi" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Block / Taluka</Label>
          <Input value={form.block} onChange={e => set("block", e.target.value)} placeholder="e.g. Namkum" />
        </div>
      </div>

      {/* Courses */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          Courses Offered
        </Label>
        <div className="flex gap-2">
          <Input
            value={form.courseInput}
            onChange={e => set("courseInput", e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCourse(); } }}
            placeholder="Type course name and press Enter or Add"
          />
          <Button type="button" variant="outline" size="sm" onClick={addCourse}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add
          </Button>
        </div>
        {form.courses.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {form.courses.map((c) => (
              <span key={c} className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1">
                {c}
                <button type="button" onClick={() => removeCourse(c)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">These courses will appear in the candidate registration dropdown.</p>
      </div>

      {/* Geo-fence */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          Geo-fence (Center Staff Attendance)
        </Label>
        <p className="text-xs text-muted-foreground -mt-1">
          Click on the map to set the center point. Center staff check-ins outside this radius will be flagged.
        </p>
        <GeoFenceMapPicker
          ref={geoRef}
          lat={(() => { const v = parseFloat(form.lat); return Number.isFinite(v) ? v : null; })()}
          lng={(() => { const v = parseFloat(form.lng); return Number.isFinite(v) ? v : null; })()}
          radiusMeters={(() => { const r = parseInt(form.radiusMeters || "200", 10); return Number.isFinite(r) && r > 0 ? r : 200; })()}
          onLocationChange={(lat, lng) => { set("lat", lat.toFixed(6)); set("lng", lng.toFixed(6)); }}
          onRadiusChange={(r) => set("radiusMeters", String(r))}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />Latitude</Label>
            <Input type="number" step="any" value={form.lat} onChange={e => set("lat", e.target.value)} placeholder="e.g. 23.3565" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />Longitude</Label>
            <Input type="number" step="any" value={form.lng} onChange={e => set("lng", e.target.value)} placeholder="e.g. 85.3095" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center justify-between">
            <span>Geo-fence Radius</span>
            <span className="text-sm font-semibold text-primary">{form.radiusMeters || "200"} m</span>
          </Label>
          <input
            type="range" min={50} max={1000} step={25}
            value={form.radiusMeters || "200"}
            onChange={e => set("radiusMeters", e.target.value)}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground"><span>50 m</span><span>1000 m</span></div>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={locating} onClick={useCurrentLocation} className="gap-1.5">
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
          {locating ? "Locating…" : "Use My Current Location"}
        </Button>
        {form.lat && form.lng && (
          <p className="text-xs text-emerald-600 font-medium">
            ✓ Geo-fence set at {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)} — radius {form.radiusMeters || 200}m
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {initial ? "Save Changes" : "Create Center"}
        </Button>
      </div>
    </div>
  );
}

export default function TrainingCenters() {
  const { toast } = useToast();
  const user = getAdminUser();
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "super_admin";

  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Center | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadCenters = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await adminFetch(`/api/companies/${companyId}/centers`);
      if (!res.ok) throw new Error("Failed to load centers");
      const data: Center[] = await res.json();
      setCenters(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadCenters(); }, [loadCenters]);

  const handleSaved = (c: Center) => {
    setCenters((prev) => {
      const idx = prev.findIndex((x) => x.id === c.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = c; return next; }
      return [...prev, c];
    });
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = async (center: Center) => {
    if (!confirm(`"${center.name}" delete karein? Yeh action undo nahi hoga.`)) return;
    setDeleting(center.id);
    try {
      const res = await adminFetch(`/api/companies/${companyId}/centers/${center.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).title ?? "Delete failed");
      setCenters((prev) => prev.filter((c) => c.id !== center.id));
      toast({ title: "Center deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  if (isSuperAdmin) {
    return (
      <div className="border rounded-xl p-8 text-center bg-muted/30 text-muted-foreground">
        <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Super Admin does not have a company.</p>
        <p className="text-sm mt-1">Use the <strong>All Companies</strong> section to manage company details.</p>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="border rounded-xl p-8 text-center bg-muted/30 text-muted-foreground">
        <p className="text-sm">No company associated with your account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Har center ka TC ID, courses, aur geo-fence alag set karein. Staff registration mein center se link hoga.
          </p>
        </div>
        {!showForm && !editing && (
          <Button onClick={() => setShowForm(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add Center
          </Button>
        )}
      </div>

      {/* Create form */}
      {showForm && !editing && (
        <CenterForm
          companyId={companyId}
          onSaved={handleSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Edit form */}
      {editing && (
        <CenterForm
          key={editing.id}
          initial={editing}
          companyId={companyId}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Centers list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : centers.length === 0 ? (
        <div className="border rounded-xl p-10 text-center text-muted-foreground bg-muted/20">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-25" />
          <p className="font-medium text-sm">Koi training center nahi hai</p>
          <p className="text-xs mt-1">Upar "Add Center" button se pehla center banayein.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {centers.map((c) => {
            const expanded = expandedId === c.id;
            return (
              <div key={c.id} className="border rounded-xl bg-card overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{c.name}</span>
                      {c.tcId && (
                        <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 font-mono">
                          {c.tcId}
                        </span>
                      )}
                      {c.lat && c.lng && (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />Geo-fence set
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[c.district, c.state, c.pinCode].filter(Boolean).join(" · ")}
                      {c.courses.length > 0 && ` · ${c.courses.length} course${c.courses.length > 1 ? "s" : ""}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8"
                      onClick={e => { e.stopPropagation(); setEditing(c); setShowForm(false); }}
                      disabled={!!deleting}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); handleDelete(c); }}
                      disabled={deleting === c.id}
                    >
                      {deleting === c.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-muted/10">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {c.tcId && <div><span className="text-muted-foreground text-xs">TC ID</span><p className="font-mono font-medium">{c.tcId}</p></div>}
                      {c.state && <div><span className="text-muted-foreground text-xs">State</span><p>{c.state}</p></div>}
                      {c.district && <div><span className="text-muted-foreground text-xs">District</span><p>{c.district}</p></div>}
                      {c.block && <div><span className="text-muted-foreground text-xs">Block</span><p>{c.block}</p></div>}
                      {c.pinCode && <div><span className="text-muted-foreground text-xs">PIN Code</span><p>{c.pinCode}</p></div>}
                      {c.lat && c.lng && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground text-xs">Geo-fence</span>
                          <p className="text-xs font-mono">{c.lat?.toFixed(5)}, {c.lng?.toFixed(5)} · radius {c.radiusMeters}m</p>
                        </div>
                      )}
                    </div>
                    {c.courses.length > 0 && (
                      <div>
                        <span className="text-muted-foreground text-xs block mb-1">Courses</span>
                        <div className="flex flex-wrap gap-1.5">
                          {c.courses.map((co) => (
                            <span key={co} className="text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full px-2.5 py-0.5">
                              {co}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && centers.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3">
          <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Staff registration mein center choose karne ka option milega (Admin Code se). Candidate form mein center ka naam, TC ID aur course auto-fill ho jaayega.
          </p>
        </div>
      )}
    </div>
  );
}
