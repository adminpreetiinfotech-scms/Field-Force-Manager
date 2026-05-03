import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  UserCheck, RefreshCw, Download, AlertTriangle, MapPin, CheckCircle2,
  XCircle, Clock, ChevronDown,
} from "lucide-react";

interface CenterStaffListItem {
  id: string;
  name: string;
  empCode: string;
  centerStaffRole: string | null;
  staffCategory: string;
  approvalStatus: string;
  disabledAt: string | null;
}

interface CenterAttendanceRow {
  staffId: string;
  staffName: string;
  empCode: string;
  centerStaffRole: string | null;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: "present" | "partial" | "absent";
  checkInOutsideGeofence: boolean | null;
  checkOutOutsideGeofence: boolean | null;
  checkInDistanceM: number | null;
  checkOutDistanceM: number | null;
}

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

function toIst(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]}`;
}

function todayIst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function monthStartIst(): string {
  const d = new Date();
  const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2,"0")}-01`;
}

function geofenceBadge(outside: boolean | null, distM: number | null) {
  if (outside === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (outside) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <XCircle className="h-3 w-3" />
        Outside {distM != null ? `(${distM}m)` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="h-3 w-3" />
      Inside {distM != null ? `(${distM}m)` : ""}
    </span>
  );
}

function statusBadge(status: CenterAttendanceRow["status"]) {
  if (status === "present") return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="h-3 w-3" /> Present
    </span>
  );
  if (status === "partial") return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      <Clock className="h-3 w-3" /> Partial
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
      <XCircle className="h-3 w-3" /> Absent
    </span>
  );
}

function roleFmt(role: string | null): string {
  if (!role) return "—";
  return role.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

export default function CenterAttendance() {
  const { toast } = useToast();
  const [staffList, setStaffList] = useState<CenterStaffListItem[]>([]);
  const [rows, setRows] = useState<CenterAttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthStartIst());
  const [dateTo, setDateTo] = useState(todayIst());
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res = await adminFetch("/api/admin/staff-list");
      if (!res.ok) throw new Error("Failed to load staff");
      const all: CenterStaffListItem[] = await res.json();
      setStaffList(all.filter((s) => s.staffCategory === "center" && !s.disabledAt));
    } catch (e: any) {
      toast({ title: "Error loading staff", description: e.message, variant: "destructive" });
    } finally {
      setStaffLoading(false);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ dateFrom, dateTo });
      if (selectedStaffId) params.set("staffId", selectedStaffId);
      const res = await adminFetch(`/api/admin/center-attendance?${params}`);
      if (!res.ok) throw new Error("Failed to load attendance");
      setRows(await res.json());
    } catch (e: any) {
      toast({ title: "Error loading attendance", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedStaffId]);

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => { if (!staffLoading) loadAttendance(); }, [staffLoading, loadAttendance]);

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = ["Date","Staff Name","Emp Code","Role","Status","Check-in","Check-out","Check-in Geofence","Check-in Distance (m)","Check-out Geofence","Check-out Distance (m)"];
    const dataRows = rows.map((r) => [
      r.date,
      r.staffName,
      r.empCode,
      roleFmt(r.centerStaffRole),
      r.status,
      toIst(r.checkInTime),
      toIst(r.checkOutTime),
      r.checkInOutsideGeofence === null ? "N/A" : r.checkInOutsideGeofence ? "Outside" : "Inside",
      r.checkInDistanceM ?? "N/A",
      r.checkOutOutsideGeofence === null ? "N/A" : r.checkOutOutsideGeofence ? "Outside" : "Inside",
      r.checkOutDistanceM ?? "N/A",
    ]);
    const csv = [headers, ...dataRows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `center-attendance-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const outsideCount = rows.filter((r) => r.checkInOutsideGeofence === true || r.checkOutOutsideGeofence === true).length;
  const presentCount = rows.filter((r) => r.status === "present").length;
  const absentCount = rows.filter((r) => r.status === "absent").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <UserCheck className="h-7 w-7 text-primary" />
            Center Staff Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Geo-fence verified attendance for training center staff</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadStaff(); loadAttendance(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="border rounded-xl p-4 bg-card flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Staff</label>
          <div className="relative">
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="border rounded-lg pl-3 pr-8 py-2 text-sm bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
            >
              <option value="">All Center Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.empCode})</option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 absolute right-2 top-2.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <Button onClick={loadAttendance} disabled={loading} size="sm">
          Apply Filter
        </Button>
      </div>

      {/* Summary Cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Records", value: rows.length, color: "text-foreground" },
            { label: "Present Days", value: presentCount, color: "text-emerald-600" },
            { label: "Absent Days", value: absentCount, color: "text-red-600" },
            { label: "Geofence Violations", value: outsideCount, color: outsideCount > 0 ? "text-amber-600" : "text-emerald-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="border rounded-xl p-4 bg-card text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Geofence warning */}
      {outsideCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
              {outsideCount} record{outsideCount !== 1 ? "s" : ""} with geo-fence violations
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
              These staff members checked in/out from outside the company's defined geo-fence radius. Rows highlighted in red.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="border rounded-xl p-12 text-center bg-muted/20 text-muted-foreground">
          <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No attendance records found</p>
          <p className="text-sm mt-1">
            {staffList.length === 0
              ? "No center staff found. Add staff with category 'Center' to see attendance here."
              : "Try adjusting the date range or staff filter."}
          </p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Staff</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Check-in</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Check-out</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 inline mr-1" />In Geofence
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 inline mr-1" />Out Geofence
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const violation = row.checkInOutsideGeofence === true || row.checkOutOutsideGeofence === true;
                  return (
                    <tr
                      key={`${row.staffId}-${row.date}-${idx}`}
                      className={`border-b last:border-0 transition-colors ${violation ? "bg-red-50 dark:bg-red-950/20 hover:bg-red-100/60" : "hover:bg-muted/30"}`}
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{fmtDate(row.date)}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold leading-tight">{row.staffName}</p>
                        <p className="text-xs text-muted-foreground">{row.empCode}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{roleFmt(row.centerStaffRole)}</td>
                      <td className="px-4 py-3">{statusBadge(row.status)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{toIst(row.checkInTime)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{toIst(row.checkOutTime)}</td>
                      <td className="px-4 py-3">{geofenceBadge(row.checkInOutsideGeofence, row.checkInDistanceM)}</td>
                      <td className="px-4 py-3">{geofenceBadge(row.checkOutOutsideGeofence, row.checkOutDistanceM)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
