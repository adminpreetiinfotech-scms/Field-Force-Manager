import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, Save, Plus, Loader2, RefreshCw, AlertCircle,
  ChevronLeft, ChevronRight, SlidersHorizontal, History,
  User, CalendarDays, Pencil, CheckCircle2,
} from "lucide-react";

function getAdminPhone(): string {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return (JSON.parse(raw) as { phone?: string }).phone ?? "";
  } catch { return ""; }
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

interface ShiftSettings {
  fieldShiftStart: string;
  fieldShiftEnd: string;
  centerShiftStart: string;
  centerShiftEnd: string;
  lateGraceMinutes: number;
}

interface StaffOption {
  id: string;
  name: string;
  empCode: string;
  phone: string;
  staffCategory: string;
}

interface Correction {
  id: string;
  staffId: string;
  date: string;
  originalCheckin: string | null;
  originalCheckout: string | null;
  correctedCheckin: string | null;
  correctedCheckout: string | null;
  reason: string;
  correctedBy: string;
  createdAt: string;
  staffName?: string;
  empCode?: string;
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const rh = Math.floor(total / 60) % 24;
  const rm = total % 60;
  return `${String(rh).padStart(2, "0")}:${String(rm).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

type Tab = "settings" | "corrections";

export default function AttendanceControl() {
  const [tab, setTab] = useState<Tab>("settings");
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance Control</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure shift timings, late-mark rules, and apply manual corrections.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
        <button
          onClick={() => setTab("settings")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            tab === "settings"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Shift Settings
        </button>
        <button
          onClick={() => setTab("corrections")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            tab === "corrections"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          Manual Corrections
        </button>
      </div>

      {tab === "settings" && <ShiftSettingsTab toast={toast} />}
      {tab === "corrections" && <CorrectionsTab toast={toast} />}
    </div>
  );
}

function ShiftSettingsTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [settings, setSettings] = useState<ShiftSettings>({
    fieldShiftStart: "09:00",
    fieldShiftEnd: "18:00",
    centerShiftStart: "09:00",
    centerShiftEnd: "18:00",
    lateGraceMinutes: 15,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/attendance-settings");
      if (res.ok) setSettings(await res.json());
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/attendance-settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast({ title: "Settings saved", description: "Shift timings updated successfully." });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Save failed", description: (err as any).title ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof ShiftSettings, value: string | number) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading settings…
      </div>
    );
  }

  const fieldLate = addMinutes(settings.fieldShiftStart, settings.lateGraceMinutes);
  const centerLate = addMinutes(settings.centerShiftStart, settings.lateGraceMinutes);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Field Staff */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            Field Staff Shift
          </CardTitle>
          <CardDescription>Shift timings for field/mobiliser staff</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fss">Shift Start</Label>
              <Input
                id="fss"
                type="time"
                value={settings.fieldShiftStart}
                onChange={(e) => set("fieldShiftStart", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fse">Shift End</Label>
              <Input
                id="fse"
                type="time"
                value={settings.fieldShiftEnd}
                onChange={(e) => set("fieldShiftEnd", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Late if check-in after <strong className="mx-1">{fieldLate}</strong>
            (start + {settings.lateGraceMinutes} min grace)
          </div>
        </CardContent>
      </Card>

      {/* Center Staff */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Center Staff Shift
          </CardTitle>
          <CardDescription>Shift timings for trainers and center staff</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="css">Shift Start</Label>
              <Input
                id="css"
                type="time"
                value={settings.centerShiftStart}
                onChange={(e) => set("centerShiftStart", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cse">Shift End</Label>
              <Input
                id="cse"
                type="time"
                value={settings.centerShiftEnd}
                onChange={(e) => set("centerShiftEnd", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Late if check-in after <strong className="mx-1">{centerLate}</strong>
            (start + {settings.lateGraceMinutes} min grace)
          </div>
        </CardContent>
      </Card>

      {/* Grace Period */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-sky-500" />
            Late Grace Period
          </CardTitle>
          <CardDescription>
            Minutes after shift start before a check-in is marked as late. Applies to both field and center staff.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => set("lateGraceMinutes", Math.max(0, settings.lateGraceMinutes - 5))}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-border hover:bg-muted text-lg font-bold transition-colors"
              >
                −
              </button>
              <div className="w-20 text-center">
                <span className="text-2xl font-bold tabular-nums">{settings.lateGraceMinutes}</span>
                <span className="text-sm text-muted-foreground ml-1">min</span>
              </div>
              <button
                onClick={() => set("lateGraceMinutes", Math.min(120, settings.lateGraceMinutes + 5))}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-border hover:bg-muted text-lg font-bold transition-colors"
              >
                +
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[0, 5, 10, 15, 20, 30].map((v) => (
                <button
                  key={v}
                  onClick={() => set("lateGraceMinutes", v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    settings.lateGraceMinutes === v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {v} min
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CorrectionsTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [showStaffDrop, setShowStaffDrop] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [corrCheckin, setCorrCheckin] = useState("");
  const [corrCheckout, setCorrCheckout] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadCorrections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/attendance/corrections");
      if (res.ok) {
        const data: Correction[] = await res.json();
        setCorrections(data);
      }
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/staff-list");
      if (res.ok) {
        const data: StaffOption[] = await res.json();
        setStaffList(data.filter((s) => s.staffCategory !== undefined));
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { void loadCorrections(); }, [loadCorrections]);
  useEffect(() => { void loadStaff(); }, [loadStaff]);

  const filteredStaff = staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.empCode.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.phone.includes(staffSearch)
  );

  const handleSubmit = async () => {
    if (!selectedStaff) {
      toast({ title: "Select a staff member", variant: "destructive" });
      return;
    }
    if (!formDate) {
      toast({ title: "Enter date", variant: "destructive" });
      return;
    }
    if (!corrCheckin && !corrCheckout) {
      toast({ title: "Enter at least one corrected time", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Reason is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        staffId: selectedStaff.id,
        date: formDate,
        reason: reason.trim(),
      };
      if (corrCheckin) body.correctedCheckin = corrCheckin;
      if (corrCheckout) body.correctedCheckout = corrCheckout;

      const res = await adminFetch("/api/admin/attendance/correct", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast({ title: "Correction saved", description: `Attendance corrected for ${selectedStaff.name}.` });
        setShowForm(false);
        setSelectedStaff(null);
        setStaffSearch("");
        setCorrCheckin("");
        setCorrCheckout("");
        setReason("");
        void loadCorrections();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Failed", description: (err as any).title ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Manual Corrections</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Override attendance check-in/check-out times with a reason for audit.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadCorrections()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Correction
          </Button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              New Attendance Correction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Staff picker */}
            <div className="space-y-1.5 relative">
              <Label>Staff Member</Label>
              <Input
                placeholder="Search by name, emp code, or phone…"
                value={selectedStaff ? `${selectedStaff.name} (${selectedStaff.empCode})` : staffSearch}
                onChange={(e) => {
                  setStaffSearch(e.target.value);
                  setSelectedStaff(null);
                  setShowStaffDrop(true);
                }}
                onFocus={() => setShowStaffDrop(true)}
              />
              {showStaffDrop && filteredStaff.length > 0 && !selectedStaff && (
                <div className="absolute z-10 w-full mt-1 max-h-52 overflow-y-auto rounded-lg border bg-background shadow-lg">
                  {filteredStaff.slice(0, 20).map((s) => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-center gap-3 transition-colors border-b border-border last:border-0"
                      onMouseDown={() => {
                        setSelectedStaff(s);
                        setStaffSearch("");
                        setShowStaffDrop(false);
                      }}
                    >
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.empCode} · {s.phone}</p>
                      </div>
                      <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                        {s.staffCategory === "center" ? "Center" : "Field"}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="corr-date">Date</Label>
              <Input
                id="corr-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>

            {/* Corrected times */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="corr-checkin">Corrected Check-in (HH:MM)</Label>
                <Input
                  id="corr-checkin"
                  type="time"
                  value={corrCheckin}
                  onChange={(e) => setCorrCheckin(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="corr-checkout">Corrected Check-out (HH:MM)</Label>
                <Input
                  id="corr-checkout"
                  type="time"
                  value={corrCheckout}
                  onChange={(e) => setCorrCheckout(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="corr-reason">Reason <span className="text-destructive">*</span></Label>
              <textarea
                id="corr-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this correction is being made (visible in audit trail)…"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setSelectedStaff(null);
                  setStaffSearch("");
                  setCorrCheckin("");
                  setCorrCheckout("");
                  setReason("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save Correction
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Corrections list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading corrections…
            </div>
          ) : corrections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No manual corrections yet.</p>
              <p className="text-xs mt-1">Add a correction when check-in/out times need to be overridden.</p>
            </div>
          ) : (
            <div className="divide-y">
              {corrections.map((c) => (
                <div key={c.id} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{c.staffName ?? c.staffId}</span>
                        {c.empCode && (
                          <Badge variant="outline" className="text-[10px]">{c.empCode}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {fmtDate(c.date)}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                          { label: "Orig Check-in", value: c.originalCheckin ?? "—", color: "text-muted-foreground" },
                          { label: "Corr Check-in", value: c.correctedCheckin ?? "—", color: "text-blue-600 font-semibold" },
                          { label: "Orig Check-out", value: c.originalCheckout ?? "—", color: "text-muted-foreground" },
                          { label: "Corr Check-out", value: c.correctedCheckout ?? "—", color: "text-emerald-600 font-semibold" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-muted/50 rounded-md px-2.5 py-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                            <p className={`text-sm mt-0.5 ${color}`}>{value}</p>
                          </div>
                        ))}
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Reason: <span className="text-foreground not-italic">{c.reason}</span>
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Saved on {fmtCreatedAt(c.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
