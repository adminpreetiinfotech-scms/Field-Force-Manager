import { useState, useCallback, useEffect, useMemo } from "react";
import { useGetStaffProfileStats } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Download, Eye, UserX, UserCheck, ChevronLeft,
  ChevronRight, Loader2, Activity, Phone, Mail,
  Building2, RefreshCw, Filter, ShieldCheck, ShieldOff,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuperStaff {
  id: string;
  empCode: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  companyId: string | null;
  companyName: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
  disabledAt: string | null;
  createdAt: string | null;
  centerName: string | null;
  projectName: string | null;
  state: string | null;
  district: string | null;
  area: string | null;
  organization: string | null;
  lastLocationAt: string | null;
  isOnShift: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getEffectiveStatus(s: SuperStaff): "pending" | "approved" | "disabled" | "rejected" {
  if (s.approvalStatus === "approved" && s.disabledAt) return "disabled";
  return s.approvalStatus as "pending" | "approved" | "rejected";
}

const STATUS_CONFIG = {
  pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-800 border-amber-200" },
  approved: { label: "Approved", cls: "bg-green-100 text-green-800 border-green-200" },
  disabled: { label: "Disabled", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-800 border-red-200" },
};

function StatusBadge({ staff }: { staff: SuperStaff }) {
  const cfg = STATUS_CONFIG[getEffectiveStatus(staff)];
  return <Badge variant="outline" className={cfg.cls}>{cfg.label}</Badge>;
}

function lastActivity(s: SuperStaff): string {
  if (s.lastLocationAt) {
    const mins = differenceInMinutes(new Date(), new Date(s.lastLocationAt));
    if (mins < 2) return "Just now";
    return formatDistanceToNow(new Date(s.lastLocationAt), { addSuffix: true });
  }
  if (s.createdAt) return `Joined ${format(new Date(s.createdAt), "dd MMM yyyy")}`;
  return "—";
}

const PAGE_SIZE = 50;

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(data: SuperStaff[]) {
  const headers = [
    "Emp Code", "Name", "Phone", "Email", "Role", "Company",
    "Center", "Project", "State", "District", "Area",
    "Status", "Registered", "Last Activity",
  ];
  const esc = (v: string | null | undefined) => {
    const s = v ?? "";
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = data.map(s => [
    s.empCode, s.name, s.phone, s.email ?? "",
    s.role, s.companyName ?? "", s.centerName ?? "",
    s.projectName ?? "", s.state ?? "", s.district ?? "", s.area ?? "",
    getEffectiveStatus(s),
    s.createdAt ? format(new Date(s.createdAt), "dd MMM yyyy") : "",
    s.lastLocationAt ? format(new Date(s.lastLocationAt), "dd MMM yyyy HH:mm") : "",
  ].map(esc).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `super-admin-staff-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── View Profile Dialog ──────────────────────────────────────────────────────

function ViewProfileDialog({ staff, onClose }: { staff: SuperStaff; onClose: () => void }) {
  const { data: stats, isLoading } = useGetStaffProfileStats(staff.id);

  const Row = ({ label, value }: { label: string; value: string | null | undefined }) =>
    value ? (
      <div className="flex gap-2 text-sm">
        <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
        <span className="font-medium break-all">{value}</span>
      </div>
    ) : null;

  const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="bg-muted/40 rounded-lg p-3 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="text-xs text-primary">{sub}</div>}
    </div>
  );

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Staff Profile
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1 space-y-4 pr-1 py-1">
          {/* Identity */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-base">{staff.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{staff.empCode}</p>
              </div>
              <StatusBadge staff={staff} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2">
              <Row label="Phone" value={staff.phone} />
              <Row label="Email" value={staff.email} />
              <Row label="Role" value={staff.role} />
              <Row label="Company" value={staff.companyName} />
              <Row label="Center" value={staff.centerName} />
              <Row label="Project" value={staff.projectName} />
              <Row label="State" value={staff.state} />
              <Row label="District" value={staff.district} />
              <Row label="Area" value={staff.area} />
              <Row label="Organization" value={staff.organization} />
            </div>
            {staff.createdAt && (
              <p className="text-xs text-muted-foreground pt-1">
                Registered: {format(new Date(staff.createdAt), "dd MMM yyyy")}
              </p>
            )}
            {staff.isOnShift && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Currently on shift
              </span>
            )}
          </div>

          {/* Performance */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Field Performance</h4>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <StatCard label="Total Rides" value={stats.lifetimeTotalRides} />
                  <StatCard label="Total KM" value={`${stats.lifetimeTotalKm.toFixed(1)}`} />
                  <StatCard label="Active Days" value={stats.lifetimeActiveDays} />
                  <StatCard label="Avg KM/Ride" value={`${stats.lifetimeAvgKmPerRide.toFixed(1)}`} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Today" value={stats.periodToday.rides} sub={`${stats.periodToday.km.toFixed(1)} km`} />
                  <StatCard label="Last 7 Days" value={stats.periodLast7Days.rides} sub={`${stats.periodLast7Days.km.toFixed(1)} km`} />
                  <StatCard label="This Month" value={stats.periodThisMonth.rides} sub={`${stats.periodThisMonth.km.toFixed(1)} km`} />
                </div>
                {stats.notes && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
                    <p className="font-medium text-amber-800 text-xs mb-1">Admin Notes</p>
                    <p className="text-amber-900">{stats.notes}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No activity data yet.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  open, title, description, confirmLabel, loading, onConfirm, onCancel,
}: {
  open: boolean; title: string; description: string;
  confirmLabel: string; loading: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({ staff, onRefresh }: { staff: SuperStaff; onRefresh: () => void }) {
  const { toast } = useToast();
  const [showProfile, setShowProfile] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [loading, setLoading] = useState(false);
  const status = getEffectiveStatus(staff);

  const handleDisable = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/staff/${staff.id}/deactivate`, { method: "PATCH" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).title ?? "Failed");
      toast({ title: "Disabled", description: `${staff.name} has been disabled.` });
      setConfirmDisable(false);
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/staff/${staff.id}/enable`, { method: "PATCH" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).title ?? "Failed");
      toast({ title: "Re-activated", description: `${staff.name} has been re-activated.` });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleApproveAdmin = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/staff/${staff.id}/approve`, { method: "PATCH" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).title ?? "Failed");
      toast({ title: "Admin Approved", description: `${staff.name} can now log in as admin.` });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleRejectAdmin = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/staff/${staff.id}/reject`, { method: "PATCH" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).title ?? "Failed");
      toast({ title: "Admin Rejected", description: `${staff.name}'s admin account has been rejected.` });
      setConfirmReject(false);
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => setShowProfile(true)} title="View Profile">
          <Eye className="h-3.5 w-3.5" />
        </Button>
        {status === "pending" && staff.role === "admin" && (
          <>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600 hover:bg-green-50" onClick={handleApproveAdmin} disabled={loading} title="Approve Admin">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600 hover:bg-red-50" onClick={() => setConfirmReject(true)} disabled={loading} title="Reject Admin">
              <ShieldOff className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {status === "approved" && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-600 hover:bg-amber-50" onClick={() => setConfirmDisable(true)} disabled={loading} title="Disable">
            <UserX className="h-3.5 w-3.5" />
          </Button>
        )}
        {status === "disabled" && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600 hover:bg-green-50" onClick={handleEnable} disabled={loading} title="Enable">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>

      {showProfile && <ViewProfileDialog staff={staff} onClose={() => setShowProfile(false)} />}
      <ConfirmDialog
        open={confirmDisable}
        title="Disable Staff Member?"
        description={`${staff.name} (${staff.companyName ?? "no company"}) will be disabled and cannot log in until re-activated.`}
        confirmLabel="Disable"
        loading={loading}
        onConfirm={handleDisable}
        onCancel={() => setConfirmDisable(false)}
      />
      <ConfirmDialog
        open={confirmReject}
        title="Reject Admin Account?"
        description={`${staff.name}'s admin registration will be rejected. They will not be able to log in.`}
        confirmLabel="Reject"
        loading={loading}
        onConfirm={handleRejectAdmin}
        onCancel={() => setConfirmReject(false)}
      />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuperAdminStaff() {
  const { toast } = useToast();
  const [allStaff, setAllStaff] = useState<SuperStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterState, setFilterState] = useState("all");
  const [page, setPage] = useState(1);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/super-admin/staff");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).title ?? "Failed to load staff");
      }
      setAllStaff(await res.json());
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [search, filterCompany, filterStatus, filterState]);

  // Unique filter options
  const companies = useMemo(() => {
    const names = [...new Set(allStaff.map(s => s.companyName).filter(Boolean) as string[])].sort();
    return names;
  }, [allStaff]);

  const states = useMemo(() => {
    const s = [...new Set(allStaff.map(s => s.state).filter(Boolean) as string[])].sort();
    return s;
  }, [allStaff]);

  // Filtered data
  const filtered = useMemo(() => {
    return allStaff.filter(s => {
      if (search) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) &&
            !s.phone.includes(q) &&
            !(s.email ?? "").toLowerCase().includes(q) &&
            !s.empCode.toLowerCase().includes(q)) return false;
      }
      if (filterCompany !== "all" && s.companyName !== filterCompany) return false;
      if (filterStatus !== "all" && getEffectiveStatus(s) !== filterStatus) return false;
      if (filterState !== "all" && s.state !== filterState) return false;
      return true;
    });
  }, [allStaff, search, filterCompany, filterStatus, filterState]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusCounts = useMemo(() => {
    const c = { total: allStaff.length, pending: 0, approved: 0, disabled: 0, rejected: 0 };
    for (const s of allStaff) c[getEffectiveStatus(s)]++;
    return c;
  }, [allStaff]);

  const clearFilters = () => {
    setSearch(""); setFilterCompany("all"); setFilterStatus("all"); setFilterState("all");
  };
  const hasFilters = search || filterCompany !== "all" || filterStatus !== "all" || filterState !== "all";

  const pendingAdmins = useMemo(() => allStaff.filter(s => s.approvalStatus === "pending" && s.role === "admin"), [allStaff]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Staff</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Viewing all staff across all companies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(filtered)} disabled={loading || filtered.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV {filtered.length > 0 && `(${filtered.length})`}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchStaff} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Pending Admins Alert */}
      {!loading && pendingAdmins.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900 text-sm">
                {pendingAdmins.length} Admin Account{pendingAdmins.length > 1 ? "s" : ""} Pending Approval
              </p>
              <p className="text-amber-700 text-xs mt-0.5">
                The following admin{pendingAdmins.length > 1 ? "s" : ""} have registered and need your approval before they can log in.
              </p>
              <div className="mt-3 space-y-2">
                {pendingAdmins.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-white border border-amber-200 rounded-md px-3 py-2">
                    <div>
                      <span className="font-medium text-sm text-amber-900">{a.name}</span>
                      <span className="text-amber-600 text-xs ml-2">{a.phone}</span>
                      {a.companyName && <span className="text-amber-500 text-xs ml-2">· {a.companyName}</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs border-green-300 text-green-700 hover:bg-green-50"
                        onClick={async () => {
                          try {
                            const res = await adminFetch(`/api/admin/staff/${a.id}/approve`, { method: "PATCH" });
                            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).title ?? "Failed");
                            fetchStaff();
                          } catch (e: any) {
                            alert(e.message);
                          }
                        }}
                      >
                        <ShieldCheck className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs border-red-300 text-red-700 hover:bg-red-50"
                        onClick={async () => {
                          if (!confirm(`Reject ${a.name}'s admin account?`)) return;
                          try {
                            const res = await adminFetch(`/api/admin/staff/${a.id}/reject`, { method: "PATCH" });
                            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).title ?? "Failed");
                            fetchStaff();
                          } catch (e: any) {
                            alert(e.message);
                          }
                        }}
                      >
                        <ShieldOff className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: statusCounts.total, cls: "border-border" },
          { label: "Approved", value: statusCounts.approved, cls: "border-green-200 bg-green-50/40" },
          { label: "Pending", value: statusCounts.pending, cls: "border-amber-200 bg-amber-50/40" },
          { label: "Disabled", value: statusCounts.disabled, cls: "border-slate-200 bg-slate-50/40" },
          { label: "Rejected", value: statusCounts.rejected, cls: "border-red-200 bg-red-50/40" },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`border rounded-lg p-3 text-center ${cls}`}>
            <div className="text-2xl font-bold">{loading ? "—" : value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs ml-auto text-muted-foreground" onClick={clearFilters}>
              Clear all
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, email, code..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger>
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterState} onValueChange={setFilterState}>
            <SelectTrigger>
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-20">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone / Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Center / Project</TableHead>
              <TableHead>State / District</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="text-right w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-14 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-10 w-10 opacity-20" />
                    <p className="font-medium">No staff found</p>
                    {hasFilters && (
                      <Button variant="link" className="text-xs" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(staff => (
                <TableRow key={staff.id} className={getEffectiveStatus(staff) === "disabled" ? "opacity-55" : ""}>
                  <TableCell className="font-mono text-xs">{staff.empCode}</TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{staff.name}</p>
                    {staff.area && <p className="text-xs text-muted-foreground">{staff.area}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                      {staff.phone}
                    </div>
                    {staff.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[140px]">{staff.email}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{staff.companyName ?? <span className="text-muted-foreground italic">—</span>}</p>
                    {staff.organization && <p className="text-xs text-muted-foreground">{staff.organization}</p>}
                  </TableCell>
                  <TableCell>
                    {staff.centerName && <p className="text-sm">{staff.centerName}</p>}
                    {staff.projectName && <p className="text-xs text-muted-foreground">{staff.projectName}</p>}
                    {!staff.centerName && !staff.projectName && <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {(staff.state || staff.district) ? (
                      <>
                        {staff.state && <p className="text-sm">{staff.state}</p>}
                        {staff.district && <p className="text-xs text-muted-foreground">{staff.district}</p>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge staff={staff} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {lastActivity(staff)}
                    {staff.isOnShift && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-blue-600 font-medium">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        On Shift
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RowActions staff={staff} onRefresh={fetchStaff} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} staff
            {hasFilters && allStaff.length !== filtered.length && (
              <span className="ml-1">(filtered from {allStaff.length} total)</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <span className="text-xs font-medium px-1">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
