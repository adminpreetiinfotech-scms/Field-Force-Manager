import { useState, useCallback, useEffect } from "react";
import {
  useApproveStaff,
  useRejectStaff,
  useDeactivateStaff,
  useGetStaffProfileStats,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
  Eye,
  UserCheck,
  UserX,
  Loader2,
  Activity,
  MapPin,
  Phone,
  User,
  Camera,
  X as XIcon,
  Home,
  Users,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

const CENTER_STAFF_ROLES = [
  { value: "centerHead", label: "Center Head" },
  { value: "misExecutive", label: "MIS Executive" },
  { value: "placementIncharge", label: "Placement Incharge" },
  { value: "trainer", label: "Trainer" },
  { value: "itTrainer", label: "IT Trainer" },
  { value: "softSkillsTrainer", label: "Soft Skills Trainer" },
  { value: "receptionist", label: "Receptionist" },
  { value: "counselor", label: "Counselor" },
  { value: "officeboy", label: "Office Boy" },
  { value: "securityGuard", label: "Security Guard" },
  { value: "cook", label: "Cook" },
  { value: "cleaningStaff", label: "Cleaning Staff" },
];

interface StaffMember {
  id: string;
  empCode: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  area: string | null;
  organization: string | null;
  centerName: string | null;
  projectName: string | null;
  state: string | null;
  district: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
  disabledAt: string | null;
  createdAt: string | null;
  vehicleType?: "2-wheeler" | "4-wheeler" | null;
  vehicleNumber?: string | null;
  staffCategory?: "field" | "center" | null;
  centerStaffRole?: string | null;
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

// ─── Status helpers ───────────────────────────────────────────────────────────

function getEffectiveStatus(staff: StaffMember): "pending" | "approved" | "disabled" | "rejected" {
  if (staff.approvalStatus === "approved" && staff.disabledAt) return "disabled";
  return staff.approvalStatus as "pending" | "approved" | "rejected";
}

function StatusBadge({ staff }: { staff: StaffMember }) {
  const status = getEffectiveStatus(staff);
  const config = {
    pending: { label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-200" },
    approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200" },
    disabled: { label: "Disabled", className: "bg-slate-100 text-slate-600 border-slate-200" },
    rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200" },
  }[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = "destructive",
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Profile Dialog ──────────────────────────────────────────────────────

const EMPTY_PROFILE = {
  name: "",
  email: "",
  organization: "",
  centerName: "",
  projectName: "",
  state: "",
  district: "",
  area: "",
};

function EditProfileDialog({
  staff,
  onClose,
  onSaved,
}: {
  staff: StaffMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: staff.name ?? "",
    email: staff.email ?? "",
    organization: staff.organization ?? "",
    centerName: staff.centerName ?? "",
    projectName: staff.projectName ?? "",
    state: staff.state ?? "",
    district: staff.district ?? "",
    area: staff.area ?? "",
    staffCategory: (staff.staffCategory ?? "field") as "field" | "center",
    centerStaffRole: staff.centerStaffRole ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast({ title: "Name required", description: "Name must be at least 2 characters.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/staff/${staff.id}/profile`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          organization: form.organization.trim() || null,
          centerName: form.centerName.trim() || null,
          projectName: form.projectName.trim() || null,
          state: form.state.trim() || null,
          district: form.district.trim() || null,
          area: form.area.trim() || null,
          staffCategory: form.staffCategory,
          centerStaffRole: form.staffCategory === "center" ? (form.centerStaffRole || null) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).title ?? "Failed to update profile");
      }
      toast({ title: "Profile updated", description: `${form.name}'s profile has been saved.` });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const Field = ({
    id, label, value, onChange, type = "text",
  }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            Edit Profile — {staff.name}
          </DialogTitle>
          <DialogDescription>
            Update this staff member's profile. Phone and Emp Code cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto flex-1 space-y-4 pr-1 py-2">
          <div className="flex gap-3 text-sm text-muted-foreground bg-muted/40 p-3 rounded-md">
            <span className="font-medium text-foreground">{staff.phone}</span>
            <span>·</span>
            <span className="font-mono">{staff.empCode}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field id="name" label="Full Name *" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} />
            </div>
            <div className="col-span-2">
              <Field id="email" label="Email" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} type="email" />
            </div>
            <Field id="org" label="Organization" value={form.organization} onChange={(v) => setForm(f => ({ ...f, organization: v }))} />
            <Field id="center" label="Center Name" value={form.centerName} onChange={(v) => setForm(f => ({ ...f, centerName: v }))} />
            <Field id="project" label="Project Name" value={form.projectName} onChange={(v) => setForm(f => ({ ...f, projectName: v }))} />
            <Field id="area" label="Area / Territory" value={form.area} onChange={(v) => setForm(f => ({ ...f, area: v }))} />
            <Field id="state" label="State" value={form.state} onChange={(v) => setForm(f => ({ ...f, state: v }))} />
            <Field id="district" label="District" value={form.district} onChange={(v) => setForm(f => ({ ...f, district: v }))} />
            {/* Staff Category */}
            <div className="col-span-2 space-y-1.5">
              <Label>Staff Category</Label>
              <div className="flex gap-2">
                {(["field", "center"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, staffCategory: cat, centerStaffRole: "" }))}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${form.staffCategory === cat ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {cat === "field" ? "Field Staff" : "Center Staff"}
                  </button>
                ))}
              </div>
            </div>
            {/* Center staff role */}
            {form.staffCategory === "center" && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="centerRole">Center Role</Label>
                <select
                  id="centerRole"
                  value={form.centerStaffRole}
                  onChange={(e) => setForm(f => ({ ...f, centerStaffRole: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Select role —</option>
                  {CENTER_STAFF_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── View Profile Dialog ──────────────────────────────────────────────────────

function PhotoLightbox({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white hover:text-gray-300"
        onClick={onClose}
      >
        <XIcon className="h-6 w-6" />
      </button>
      <img
        src={uri}
        alt="Odometer photo"
        className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function todayIst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function monthStartIst(): string {
  const d = new Date();
  const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function ViewProfileDialog({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const { data: stats, isLoading } = useGetStaffProfileStats(staff.id);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const downloadAttendance = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        dateFrom: monthStartIst(),
        dateTo: todayIst(),
        staffId: staff.id,
      });
      const res = await adminFetch(`/api/admin/center-attendance/xlsx?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = staff.name.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
      a.href = url;
      a.download = `center-attendance-${safeName}-${monthStartIst()}-to-${todayIst()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="bg-muted/40 rounded-lg p-3 text-center">
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-xs text-primary mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Staff Profile — {staff.name}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-auto flex-1 space-y-4 pr-1 py-1">
          {/* Basic Info */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-base">{staff.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{staff.empCode}</p>
              </div>
              <StatusBadge staff={staff} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {staff.phone}
              </div>
              {staff.email && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  {staff.email}
                </div>
              )}
              {staff.area && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {staff.area}
                </div>
              )}
              {(staff.state || staff.district) && (
                <div className="text-muted-foreground">
                  {[staff.district, staff.state].filter(Boolean).join(", ")}
                </div>
              )}
              {staff.organization && (
                <div className="text-muted-foreground col-span-2">{staff.organization}</div>
              )}
              {staff.projectName && (
                <div className="text-muted-foreground col-span-2">Project: {staff.projectName}</div>
              )}
              {staff.centerName && (
                <div className="text-muted-foreground col-span-2">Center: {staff.centerName}</div>
              )}
              {(staff.vehicleType || staff.vehicleNumber) && (
                <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                  <span className="font-medium text-foreground">
                    {staff.vehicleType === "2-wheeler" ? "2-Wheeler" : staff.vehicleType === "4-wheeler" ? "4-Wheeler" : ""}
                    {staff.vehicleNumber ? ` · ${staff.vehicleNumber}` : ""}
                  </span>
                </div>
              )}
              {staff.staffCategory === "center" && (
                <div className="flex items-center gap-2 col-span-2 pt-1">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                    Center Staff
                    {staff.centerStaffRole ? ` · ${CENTER_STAFF_ROLES.find(r => r.value === staff.centerStaffRole)?.label ?? staff.centerStaffRole}` : ""}
                  </span>
                </div>
              )}
            </div>
            {staff.createdAt && (
              <p className="text-xs text-muted-foreground pt-1">
                Registered: {format(new Date(staff.createdAt), "dd MMM yyyy")}
              </p>
            )}
          </div>

          {/* Performance Stats */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Field Performance</h4>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <StatCard label="Total Rides" value={stats.lifetimeTotalRides} />
                  <StatCard label="Total KM" value={`${stats.lifetimeTotalKm.toFixed(1)}`} />
                  <StatCard label="Active Days" value={stats.lifetimeActiveDays} />
                  <StatCard label="Avg KM/Ride" value={`${stats.lifetimeAvgKmPerRide.toFixed(1)}`} />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <StatCard label="Today" value={stats.periodToday.rides} sub={`${stats.periodToday.km.toFixed(1)} km`} />
                  <StatCard label="Last 7 Days" value={stats.periodLast7Days.rides} sub={`${stats.periodLast7Days.km.toFixed(1)} km`} />
                  <StatCard label="This Month" value={stats.periodThisMonth.rides} sub={`${stats.periodThisMonth.km.toFixed(1)} km`} />
                </div>

                {stats.bestDay && (
                  <p className="text-xs text-muted-foreground px-1">
                    Best day: <span className="font-medium text-foreground">{format(new Date(stats.bestDay.date), "dd MMM yyyy")}</span>
                    {" "}— {stats.bestDay.rideCount} rides, {stats.bestDay.totalKm.toFixed(1)} km
                  </p>
                )}

                {stats.notes && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
                    <p className="font-medium text-amber-800 text-xs mb-1">Admin Notes</p>
                    <p className="text-amber-900">{stats.notes}</p>
                  </div>
                )}

                {stats.recentTrips.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Recent Trips</p>
                    <div className="border rounded-md divide-y text-xs max-h-64 overflow-y-auto">
                      {stats.recentTrips.slice(0, 10).map((t) => (
                        <div key={t.tripRef} className="flex items-center gap-2 px-3 py-2">
                          <span className="text-muted-foreground w-14 shrink-0">{format(new Date(t.rideDate), "dd MMM")}</span>
                          <span className="flex-1 font-medium">{t.distanceKm != null ? `${t.distanceKm.toFixed(1)} km` : "—"}</span>
                          <div className="flex items-center gap-2">
                            {t.checkinMeterPhotoUri ? (
                              <HoverCard openDelay={200} closeDelay={100}>
                                <HoverCardTrigger asChild>
                                  <button
                                    title="Check-in odometer photo — click to enlarge"
                                    onClick={() => setLightboxUri(t.checkinMeterPhotoUri!)}
                                    className="group flex flex-col items-center gap-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                                  >
                                    <img
                                      src={t.checkinMeterPhotoUri}
                                      alt="Check-in odometer"
                                      loading="lazy"
                                      className="w-12 h-9 object-cover rounded border border-blue-200 group-hover:border-blue-500 group-hover:shadow transition-all"
                                    />
                                    <span className="text-[9px] text-blue-600 group-hover:text-blue-800">In</span>
                                  </button>
                                </HoverCardTrigger>
                                <HoverCardContent side="top" className="w-auto p-1.5 border-blue-200">
                                  <img
                                    src={t.checkinMeterPhotoUri}
                                    alt="Check-in odometer preview"
                                    className="w-[120px] h-[90px] object-cover rounded"
                                  />
                                  <p className="text-[9px] text-center text-blue-600 mt-0.5">Check-in</p>
                                </HoverCardContent>
                              </HoverCard>
                            ) : null}
                            {t.checkoutMeterPhotoUri ? (
                              <HoverCard openDelay={200} closeDelay={100}>
                                <HoverCardTrigger asChild>
                                  <button
                                    title="Check-out odometer photo — click to enlarge"
                                    onClick={() => setLightboxUri(t.checkoutMeterPhotoUri!)}
                                    className="group flex flex-col items-center gap-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1"
                                  >
                                    <img
                                      src={t.checkoutMeterPhotoUri}
                                      alt="Check-out odometer"
                                      loading="lazy"
                                      className="w-12 h-9 object-cover rounded border border-green-200 group-hover:border-green-500 group-hover:shadow transition-all"
                                    />
                                    <span className="text-[9px] text-green-600 group-hover:text-green-800">Out</span>
                                  </button>
                                </HoverCardTrigger>
                                <HoverCardContent side="top" className="w-auto p-1.5 border-green-200">
                                  <img
                                    src={t.checkoutMeterPhotoUri}
                                    alt="Check-out odometer preview"
                                    className="w-[120px] h-[90px] object-cover rounded"
                                  />
                                  <p className="text-[9px] text-center text-green-600 mt-0.5">Check-out</p>
                                </HoverCardContent>
                              </HoverCard>
                            ) : null}
                            {!t.checkinMeterPhotoUri && !t.checkoutMeterPhotoUri && (
                              <span className="text-muted-foreground text-[10px]">No photos</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No activity data available yet.</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          {staff.staffCategory === "center" && (
            <Button
              variant="outline"
              size="sm"
              onClick={downloadAttendance}
              disabled={exporting}
              className="flex items-center gap-1.5"
            >
              <Download className={`h-4 w-4 ${exporting ? "animate-bounce" : ""}`} />
              {exporting ? "Downloading…" : "Download Attendance"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className={staff.staffCategory !== "center" ? "sm:ml-auto" : ""}>Close</Button>
        </DialogFooter>
      </DialogContent>
      {lightboxUri && <PhotoLightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />}
    </Dialog>
  );
}

// ─── Staff Actions Menu ───────────────────────────────────────────────────────

function StaffActions({
  staff,
  onRefresh,
}: {
  staff: StaffMember;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const approveStaff = useApproveStaff();
  const rejectStaff = useRejectStaff();
  const deactivateStaff = useDeactivateStaff();

  const [showEdit, setShowEdit] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const status = getEffectiveStatus(staff);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-staff"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
    onRefresh();
  };

  const handleApprove = async () => {
    try {
      await approveStaff.mutateAsync({ staffId: staff.id });
      toast({ title: "Approved", description: `${staff.name} has been approved.` });
      invalidate();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to approve.", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    try {
      await rejectStaff.mutateAsync({ staffId: staff.id });
      toast({ title: "Rejected", description: `${staff.name} has been rejected.` });
      invalidate();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to reject.", variant: "destructive" });
    }
  };

  const handleDisable = async () => {
    try {
      await deactivateStaff.mutateAsync({ staffId: staff.id });
      toast({ title: "Disabled", description: `${staff.name} has been disabled.` });
      setConfirmDisable(false);
      invalidate();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to disable.", variant: "destructive" });
    }
  };

  const handleEnable = async () => {
    setActionLoading(true);
    try {
      const res = await adminFetch(`/api/admin/staff/${staff.id}/enable`, { method: "PATCH" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).title ?? "Failed to enable");
      }
      toast({ title: "Re-activated", description: `${staff.name} has been re-activated.` });
      invalidate();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const res = await adminFetch(`/api/admin/staff/${staff.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).title ?? "Failed to delete");
      }
      toast({ title: "Deleted", description: `${staff.name} has been removed.` });
      setConfirmDelete(false);
      invalidate();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const isPending = approveStaff.isPending || rejectStaff.isPending || deactivateStaff.isPending || actionLoading;

  return (
    <>
      <div className="flex justify-end items-center gap-1 flex-wrap">
        {/* View Profile — always available */}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => setShowProfile(true)}
          title="View Profile & Performance"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>

        {/* Pending: Approve + Reject */}
        {status === "pending" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
              onClick={handleApprove}
              disabled={isPending}
              title="Approve"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={handleReject}
              disabled={isPending}
              title="Reject"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
          </>
        )}

        {/* Approved: Edit + Disable + Delete */}
        {status === "approved" && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => setShowEdit(true)}
              disabled={isPending}
              title="Edit Profile"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => setConfirmDisable(true)}
              disabled={isPending}
              title="Disable Staff"
            >
              <UserX className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
              title="Delete Staff"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {/* Disabled: Enable + Edit + Delete */}
        {status === "disabled" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
              onClick={handleEnable}
              disabled={isPending}
              title="Re-activate Staff"
            >
              <UserCheck className="h-3.5 w-3.5 mr-1" /> Enable
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => setShowEdit(true)}
              disabled={isPending}
              title="Edit Profile"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
              title="Delete Staff"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {/* Rejected: Approve + Delete */}
        {status === "rejected" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
              onClick={handleApprove}
              disabled={isPending}
              title="Approve (Re-activate)"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
              title="Delete Staff"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Dialogs */}
      {showEdit && (
        <EditProfileDialog staff={staff} onClose={() => setShowEdit(false)} onSaved={onRefresh} />
      )}
      {showProfile && (
        <ViewProfileDialog staff={staff} onClose={() => setShowProfile(false)} />
      )}

      <ConfirmDialog
        open={confirmDisable}
        title="Disable Staff Member?"
        description={`${staff.name} will no longer be able to log in or submit candidates. You can re-activate them later.`}
        confirmLabel="Yes, Disable"
        confirmVariant="destructive"
        loading={deactivateStaff.isPending}
        onConfirm={handleDisable}
        onCancel={() => setConfirmDisable(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Staff Member?"
        description={`This will permanently remove ${staff.name} from the system. Their submitted candidates will be kept. This cannot be undone.`}
        confirmLabel="Yes, Delete"
        confirmVariant="destructive"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

// ─── Staff Table ──────────────────────────────────────────────────────────────

function StaffTable({
  staffList,
  isLoading,
  onRefresh,
}: {
  staffList: StaffMember[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return (
      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {["Code", "Name", "Phone", "Area", "Registered", "Status", "Actions"].map(h => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map(i => (
              <TableRow key={i}>
                {[1, 2, 3, 4, 5, 6, 7].map(j => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (staffList.length === 0) {
    return (
      <div className="border rounded-md bg-card py-14 text-center text-muted-foreground">
        No staff members found.
      </div>
    );
  }

  return (
    <div className="border rounded-md bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Registered</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right min-w-[180px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staffList.map((staff) => (
            <TableRow key={staff.id} className={getEffectiveStatus(staff) === "disabled" ? "opacity-60" : ""}>
              <TableCell className="font-mono text-xs">{staff.empCode}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{staff.name}</span>
                  {staff.staffCategory === "center" && (
                    <span title="Center Staff" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 flex-shrink-0">
                      <Home className="h-3 w-3" />
                    </span>
                  )}
                </div>
                {staff.organization && (
                  <div className="text-xs text-muted-foreground truncate max-w-[150px]">{staff.organization}</div>
                )}
              </TableCell>
              <TableCell className="text-sm">{staff.phone}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {staff.area || staff.district || "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {staff.createdAt ? format(new Date(staff.createdAt), "dd MMM yyyy") : "—"}
              </TableCell>
              <TableCell>
                <StatusBadge staff={staff} />
              </TableCell>
              <TableCell>
                <StaffActions staff={staff} onRefresh={onRefresh} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StaffManagement() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "field" | "center">("all");
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/staff-list");
      if (res.ok) {
        const data = await res.json();
        setAllStaff(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const filtered = allStaff.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !s.phone.includes(q) &&
        !(s.empCode ?? "").toLowerCase().includes(q)
      ) return false;
    }
    if (categoryFilter === "field" && s.staffCategory !== "field") return false;
    if (categoryFilter === "center" && s.staffCategory !== "center") return false;
    if (tab === "pending") return s.approvalStatus === "pending";
    if (tab === "approved") return s.approvalStatus === "approved" && !s.disabledAt;
    if (tab === "disabled") return s.approvalStatus === "approved" && !!s.disabledAt;
    if (tab === "rejected") return s.approvalStatus === "rejected";
    return true;
  });

  const counts = {
    all: allStaff.length,
    pending: allStaff.filter(s => s.approvalStatus === "pending").length,
    approved: allStaff.filter(s => s.approvalStatus === "approved" && !s.disabledAt).length,
    disabled: allStaff.filter(s => s.approvalStatus === "approved" && !!s.disabledAt).length,
    rejected: allStaff.filter(s => s.approvalStatus === "rejected").length,
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Category filter toggle */}
          <div className="flex items-center rounded-lg border bg-muted p-1 gap-0.5 text-sm">
            {(["all", "field", "center"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                  categoryFilter === cat
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat === "all" && <Users className="h-3.5 w-3.5" />}
                {cat === "field" && <MapPin className="h-3.5 w-3.5" />}
                {cat === "center" && <Home className="h-3.5 w-3.5" />}
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone or code..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="gap-1.5">
            All
            <span className="rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs leading-none">{counts.all}</span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending
            {counts.pending > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs text-white leading-none">{counts.pending}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1.5">
            Approved
            <span className="rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs leading-none">{counts.approved}</span>
          </TabsTrigger>
          <TabsTrigger value="disabled" className="gap-1.5">
            Disabled
            {counts.disabled > 0 && (
              <span className="rounded-full bg-slate-400 px-1.5 py-0.5 text-xs text-white leading-none">{counts.disabled}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1.5">
            Rejected
            {counts.rejected > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white leading-none">{counts.rejected}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <StaffTable staffList={filtered} isLoading={loading} onRefresh={fetchStaff} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
