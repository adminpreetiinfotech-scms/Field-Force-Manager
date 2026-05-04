import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Users, RefreshCw, Download, CheckCircle2, XCircle, Clock, ChevronDown,
} from "lucide-react";

interface FieldStaffListItem {
  id: string;
  name: string;
  empCode: string;
  staffCategory: string;
  approvalStatus: string;
  disabledAt: string | null;
}

interface FieldAttendanceRow {
  staffId: string;
  staffName: string;
  empCode: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: "present" | "partial" | "absent";
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

function statusBadge(status: FieldAttendanceRow["status"]) {
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

async function downloadBlob(url: string, filename: string) {
  const res = await adminFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { title?: string };
    throw new Error(err.title || `Error ${res.status}`);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function FieldAttendance() {
  const { toast } = useToast();
  const [staffList, setStaffList] = useState<FieldStaffListItem[]>([]);
  const [rows, setRows] = useState<FieldAttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const initDateFrom = urlParams.get("dateFrom") ?? monthStartIst();
  const initDateTo = urlParams.get("dateTo") ?? todayIst();
  const initStatus = urlParams.get("status") ?? "";

  const [dateFrom, setDateFrom] = useState(initDateFrom);
  const [dateTo, setDateTo] = useState(initDateTo);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>(initStatus);
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res = await adminFetch("/api/admin/staff-list");
      if (!res.ok) throw new Error("Failed to load staff");
      const all: FieldStaffListItem[] = await res.json();
      setStaffList(all.filter((s) => s.staffCategory === "field" && !s.disabledAt));
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
      const res = await adminFetch(`/api/admin/field-attendance?${params}`);
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

  const categories = Array.from(new Set(staffList.map((s) => s.staffCategory).filter(Boolean))).sort();

  const staffCategoryMap = new Map(staffList.map((s) => [s.id, s.staffCategory]));

  const visibleStaff = categoryFilter
    ? staffList.filter((s) => s.staffCategory === categoryFilter)
    : staffList;

  const filteredRows = rows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (categoryFilter && staffCategoryMap.get(r.staffId) !== categoryFilter) return false;
    return true;
  });

  const isFiltered = !!(statusFilter || categoryFilter);

  const exportExcel = async () => {
    if (!filteredRows.length) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ dateFrom, dateTo });
      if (selectedStaffId) params.set("staffId", selectedStaffId);
      if (statusFilter)    params.set("status", statusFilter);
      if (categoryFilter)  params.set("category", categoryFilter);
      const suffixes = [categoryFilter, statusFilter].filter(Boolean).join("-");
      const filterSuffix = suffixes ? `-${suffixes}` : "";
      await downloadBlob(
        `/api/admin/field-attendance/xlsx?${params}`,
        `field-attendance${filterSuffix}-${dateFrom}-to-${dateTo}.xlsx`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not export attendance.";
      toast({ title: "Export failed", description: msg, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const presentCount = rows.filter((r) => r.status === "present").length;
  const absentCount = rows.filter((r) => r.status === "absent").length;
  const partialCount = rows.filter((r) => r.status === "partial").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Field Staff Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Daily check-in and check-out records for field staff</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadStaff(); loadAttendance(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!filteredRows.length || isExporting}>
            <Download className={`h-4 w-4 mr-1.5 ${isExporting ? "animate-spin" : ""}`} />
            {isExporting ? "Exporting…" : `Export Excel (${filteredRows.length} ${filteredRows.length === 1 ? "row" : "rows"})`}
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
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSelectedStaffId("");
              }}
              className="border rounded-lg pl-3 pr-8 py-2 text-sm bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-primary min-w-[160px]"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 absolute right-2 top-2.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Staff</label>
          <div className="relative">
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="border rounded-lg pl-3 pr-8 py-2 text-sm bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
            >
              <option value="">All{categoryFilter ? "" : " Staff"}</option>
              {visibleStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.empCode})</option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 absolute right-2 top-2.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg pl-3 pr-8 py-2 text-sm bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-primary min-w-[150px]"
            >
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="partial">Partial</option>
              <option value="absent">Absent</option>
            </select>
            <ChevronDown className="h-4 w-4 absolute right-2 top-2.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <Button onClick={loadAttendance} disabled={loading} size="sm">
          Apply Filter
        </Button>
      </div>

      {/* Filter row count info */}
      {isFiltered && rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredRows.length}</span> of{" "}
          <span className="font-semibold text-foreground">{rows.length}</span> records
        </p>
      )}

      {/* Summary Cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Records", value: rows.length, color: "text-foreground" },
            { label: "Present Days", value: presentCount, color: "text-emerald-600" },
            { label: "Partial Days", value: partialCount, color: "text-amber-600" },
            { label: "Absent Days", value: absentCount, color: "text-red-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="border rounded-xl p-4 bg-card text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="border rounded-xl p-12 text-center bg-muted/20 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No attendance records found</p>
          <p className="text-sm mt-1">
            {staffList.length === 0
              ? "No staff found. Add field staff to see attendance here."
              : isFiltered
              ? "No records match the selected filters. Try changing or clearing the category or status."
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
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Check-in</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Check-out</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr
                    key={`${row.staffId}-${row.date}-${idx}`}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{fmtDate(row.date)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold leading-tight">{row.staffName}</p>
                      <p className="text-xs text-muted-foreground">{row.empCode}</p>
                    </td>
                    <td className="px-4 py-3">{statusBadge(row.status)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{toIst(row.checkInTime)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{toIst(row.checkOutTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
