import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, Loader2, X, Search, Users, CalendarCheck, TrendingUp, ChevronDown, ChevronUp, Camera, ExternalLink, Mail, Clock, Bell, Plus, Send, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ImageOff, ImageIcon, Filter } from "lucide-react";
import { format, subMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function getAdminPhone(): string {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return (JSON.parse(raw) as { phone?: string }).phone ?? "";
  } catch {
    return "";
  }
}

interface StaffOption {
  id: string;
  name: string;
  empCode?: string | null;
  phone?: string | null;
}

interface AttendanceSummary {
  from: string;
  to: string;
  uniqueStaff: number;
  totalCheckInDays: number;
  avgDaysPerStaff: number;
  staffBreakdown: { staffId: string; staffName: string; empCode: string; checkInDays: number }[];
}

interface TripReportRow {
  tripRef: string;
  staffId: string;
  staffName: string;
  staffPhone: string;
  rideDate: string;
  startTime: string;
  endTime: string;
  startLocation?: string | null;
  endLocation?: string | null;
  distanceKm?: number | null;
  checkinPhotoUrl?: string | null;
  checkoutPhotoUrl?: string | null;
  vehicleKm?: number | null;
  gpsKm?: number | null;
  variancePct?: number | null;
  startOdometer?: number | null;
  endOdometer?: number | null;
}

interface ReportSchedule {
  id: string;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  enabled: boolean;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hourUtc: number;
  lastSentAt: string | null;
  updatedAt: string;
}

async function fetchWithAuth(url: string) {
  return fetch(url, { headers: { "x-admin-phone": getAdminPhone() } });
}

async function downloadBlob(url: string, filename: string) {
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).title || `Error ${res.status}`);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function toIst(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]}`;
}

interface OdometerPhotoProps {
  url: string;
  label: string;
}

function OdometerPhoto({ url, label }: OdometerPhotoProps) {
  const [imgError, setImgError] = useState(false);

  const isCheckin = label.toLowerCase().includes("check-in");
  const borderClass = isCheckin ? "border-blue-200 group-hover:border-blue-500" : "border-green-200 group-hover:border-green-500";
  const ringClass = isCheckin ? "focus-visible:ring-blue-500" : "focus-visible:ring-green-500";
  const hoverBorderClass = isCheckin ? "border-blue-200" : "border-green-200";
  const labelTextClass = isCheckin ? "text-blue-600" : "text-green-600";
  const shortLabel = isCheckin ? "Check-in" : "Check-out";

  if (imgError) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${label} photo`}
        className="inline-flex items-center justify-center w-10 h-10 rounded border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    );
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${label} photo`}
          className={`group inline-block rounded overflow-hidden border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${borderClass} ${ringClass}`}
        >
          <img
            src={url}
            alt={label}
            className="w-10 h-10 object-cover"
            onError={() => setImgError(true)}
          />
        </a>
      </HoverCardTrigger>
      <HoverCardContent side="top" className={`w-auto p-1.5 ${hoverBorderClass}`}>
        <img
          src={url}
          alt={`${label} preview`}
          className="w-[120px] h-[90px] object-cover rounded"
        />
        <p className={`text-[9px] text-center mt-0.5 ${labelTextClass}`}>{shortLabel}</p>
      </HoverCardContent>
    </HoverCard>
  );
}

export default function Reports() {
  const [fromDate, setFromDate] = useState(format(subMonths(new Date(), 1), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingVehicleKm, setIsDownloadingVehicleKm] = useState(false);
  const [isDownloadingAttendance, setIsDownloadingAttendance] = useState(false);
  const [isDownloadingAttendanceSummary, setIsDownloadingAttendanceSummary] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [attendanceRowCount, setAttendanceRowCount] = useState<number | null>(null);
  const { toast } = useToast();

  // Staff filter state
  const [staffQuery, setStaffQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Attendance summary state
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Trip report viewer state
  const [tripRows, setTripRows] = useState<TripReportRow[] | null>(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);

  // Sort + filter state (session-local)
  type SortCol = "date" | "staff" | "km";
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  type PhotoFilter = "all" | "has" | "missing";
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("all");

  // Email schedule state
  const [schedule, setSchedule] = useState<ReportSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [schedFrequency, setSchedFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [schedDayOfWeek, setSchedDayOfWeek] = useState(1);
  const [schedDayOfMonth, setSchedDayOfMonth] = useState(1);
  const [schedHourUtc, setSchedHourUtc] = useState(2);
  const [schedRecipients, setSchedRecipients] = useState<string[]>([]);
  const [schedEmailInput, setSchedEmailInput] = useState("");
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedSendingNow, setSchedSendingNow] = useState(false);

  const fetchSummary = useCallback(async (from: string, to: string, staffId?: string) => {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (staffId) params.set("staffId", staffId);
      const res = await fetchWithAuth(`/api/admin/reports/attendance-summary?${params}`);
      if (res.ok) {
        const data: AttendanceSummary = await res.json();
        setSummary(data);
      } else {
        setSummary(null);
      }
    } catch {
      setSummary(null);
    }
    setSummaryLoading(false);
  }, []);

  useEffect(() => {
    fetchSummary(fromDate, toDate, selectedStaff?.id);
  }, [fromDate, toDate, selectedStaff, fetchSummary]);

  const fetchAttendanceCount = useCallback(async (from: string, to: string, staffId?: string) => {
    try {
      const params = new URLSearchParams({ dateFrom: from, dateTo: to });
      if (staffId) params.set("staffId", staffId);
      const res = await fetchWithAuth(`/api/admin/field-attendance?${params}`);
      if (res.ok) {
        const data: unknown = await res.json();
        setAttendanceRowCount(Array.isArray(data) ? data.length : null);
      } else {
        setAttendanceRowCount(null);
      }
    } catch {
      setAttendanceRowCount(null);
    }
  }, []);

  useEffect(() => {
    fetchAttendanceCount(fromDate, toDate, selectedStaff?.id);
  }, [fromDate, toDate, selectedStaff, fetchAttendanceCount]);

  // Single fetch path: runs whenever the viewer is visible and filters change
  useEffect(() => {
    if (!reportVisible) return;
    loadTripReport(fromDate, toDate, selectedStaff?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportVisible, fromDate, toDate, selectedStaff]);

  const loadTripReport = useCallback(async (from: string, to: string, staffId?: string) => {
    setTripLoading(true);
    setTripError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (staffId) params.set("staffId", staffId);
      const res = await fetchWithAuth(`/api/activity/trip-report?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).title || `Error ${res.status}`);
      }
      const data: TripReportRow[] = await res.json();
      setTripRows(data);
    } catch (err: any) {
      setTripError(err.message || "Failed to load report.");
      setTripRows(null);
    }
    setTripLoading(false);
  }, []);

  const handleViewReport = () => {
    setReportVisible(true);
  };

  const handleHideReport = () => {
    setReportVisible(false);
    setTripRows(null);
    setTripError(null);
  };

  const handleSortCol = (col: "date" | "staff" | "km") => {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const displayedRows = (() => {
    if (!tripRows) return null;
    let rows = [...tripRows];
    // Photo filter
    // "has" = both check-in AND check-out photos present (fully documented)
    // "missing" = either check-in OR check-out photo is absent (needs attention)
    if (photoFilter === "has") {
      rows = rows.filter(r => !!r.checkinPhotoUrl && !!r.checkoutPhotoUrl);
    } else if (photoFilter === "missing") {
      rows = rows.filter(r => !r.checkinPhotoUrl || !r.checkoutPhotoUrl);
    }
    // Sort
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "date") {
        cmp = a.rideDate.localeCompare(b.rideDate) || a.startTime.localeCompare(b.startTime);
      } else if (sortCol === "staff") {
        cmp = a.staffName.localeCompare(b.staffName);
      } else if (sortCol === "km") {
        // Push rows with no KM data to the bottom regardless of sort direction
        const aKm = a.gpsKm ?? a.distanceKm;
        const bKm = b.gpsKm ?? b.distanceKm;
        if (aKm == null && bKm == null) return 0;
        if (aKm == null) return 1;
        if (bKm == null) return -1;
        cmp = aKm - bKm;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  })();

  // Fetch staff list when user types
  useEffect(() => {
    if (selectedStaff) return;
    if (staffQuery.trim().length < 1) { setStaffList([]); setShowDropdown(false); return; }
    const timer = setTimeout(async () => {
      setStaffLoading(true);
      try {
        const res = await fetchWithAuth(`/api/admin/staff-list`);
        if (res.ok) {
          const data: StaffOption[] = await res.json();
          const q = staffQuery.toLowerCase();
          const filtered = data.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.empCode ?? "").toLowerCase().includes(q) ||
            (s.phone ?? "").includes(q)
          );
          setStaffList(filtered.slice(0, 10));
          setShowDropdown(filtered.length > 0);
        }
      } catch { /* ignore */ }
      setStaffLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [staffQuery, selectedStaff]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDownloadRides = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (selectedStaff) {
        params.set("staffId", selectedStaff.id);
        params.set("staffName", selectedStaff.name);
      }
      const suffix = selectedStaff ? `-${selectedStaff.name.replace(/\s+/g, "-")}` : "-all-staff";
      await downloadBlob(
        `/api/admin/reports/rides/xlsx?${params}`,
        `rides-report-${fromDate}-to-${toDate}${suffix}.xlsx`
      );
      toast({ title: "Download started", description: "Excel report is being downloaded." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message || "Could not download report.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadVehicleKm = async () => {
    setIsDownloadingVehicleKm(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate, sheet: "vehicleKm" });
      if (selectedStaff) {
        params.set("staffId", selectedStaff.id);
        params.set("staffName", selectedStaff.name);
      }
      const suffix = selectedStaff ? `-${selectedStaff.name.replace(/\s+/g, "-")}` : "-all-staff";
      await downloadBlob(
        `/api/admin/reports/rides/xlsx?${params}`,
        `vehicle-km-summary-${fromDate}-to-${toDate}${suffix}.xlsx`
      );
      toast({ title: "Download started", description: "Vehicle KM summary is being downloaded." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message || "Could not download report.", variant: "destructive" });
    } finally {
      setIsDownloadingVehicleKm(false);
    }
  };

  const handleDownloadFieldAttendance = async () => {
    setIsDownloadingAttendance(true);
    try {
      const params = new URLSearchParams({ dateFrom: fromDate, dateTo: toDate });
      if (selectedStaff) {
        params.set("staffId", selectedStaff.id);
      }
      const suffix = selectedStaff ? `-${selectedStaff.name.replace(/\s+/g, "-")}` : "-all-staff";
      await downloadBlob(
        `/api/admin/field-attendance/xlsx?${params}`,
        `field-attendance-${fromDate}-to-${toDate}${suffix}.xlsx`
      );
      toast({ title: "Download started", description: "Field attendance Excel is being downloaded." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message || "Could not download field attendance.", variant: "destructive" });
    } finally {
      setIsDownloadingAttendance(false);
    }
  };

  const handleDownloadAttendanceSummary = async () => {
    setIsDownloadingAttendanceSummary(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (selectedStaff) {
        params.set("staffId", selectedStaff.id);
        params.set("staffName", selectedStaff.name);
      }
      const suffix = selectedStaff ? `-${selectedStaff.name.replace(/\s+/g, "-")}` : "-all-staff";
      await downloadBlob(
        `/api/admin/reports/attendance-summary/xlsx?${params}`,
        `attendance-summary-${fromDate}-to-${toDate}${suffix}.xlsx`
      );
      toast({ title: "Download started", description: "Attendance summary Excel is being downloaded." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message || "Could not download attendance summary.", variant: "destructive" });
    } finally {
      setIsDownloadingAttendanceSummary(false);
    }
  };

  // ─── Email schedule functions ───────────────────────────────────────────────

  const fetchSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/report-schedule");
      if (res.ok) {
        const data = await res.json() as { schedule: ReportSchedule | null; emailConfigured: boolean };
        setSchedule(data.schedule);
        setEmailConfigured(data.emailConfigured);
        if (data.schedule) {
          setSchedFrequency(data.schedule.frequency);
          setSchedDayOfWeek(data.schedule.dayOfWeek ?? 1);
          setSchedDayOfMonth(data.schedule.dayOfMonth ?? 1);
          setSchedHourUtc(data.schedule.hourUtc);
          setSchedRecipients(data.schedule.recipients);
        }
      }
    } catch { /* ignore */ }
    setScheduleLoading(false);
  }, []);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const startEditing = () => {
    if (schedule) {
      setSchedFrequency(schedule.frequency);
      setSchedDayOfWeek(schedule.dayOfWeek ?? 1);
      setSchedDayOfMonth(schedule.dayOfMonth ?? 1);
      setSchedHourUtc(schedule.hourUtc);
      setSchedRecipients([...schedule.recipients]);
    } else {
      setSchedFrequency("weekly");
      setSchedDayOfWeek(1);
      setSchedDayOfMonth(1);
      setSchedHourUtc(2);
      setSchedRecipients([]);
    }
    setSchedEmailInput("");
    setScheduleEditing(true);
  };

  const addEmail = () => {
    const email = schedEmailInput.trim();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRe.test(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (schedRecipients.includes(email)) {
      toast({ title: "Already added", description: `${email} is already in the list.`, variant: "destructive" });
      return;
    }
    setSchedRecipients(prev => [...prev, email]);
    setSchedEmailInput("");
  };

  const removeEmail = (email: string) => {
    setSchedRecipients(prev => prev.filter(e => e !== email));
  };

  const handleSaveSchedule = async () => {
    if (schedRecipients.length === 0) {
      toast({ title: "No recipients", description: "Add at least one recipient email.", variant: "destructive" });
      return;
    }
    setSchedSaving(true);
    try {
      const body = {
        frequency: schedFrequency,
        recipients: schedRecipients,
        enabled: true,
        dayOfWeek: schedFrequency === "weekly" ? schedDayOfWeek : null,
        dayOfMonth: schedFrequency === "monthly" ? schedDayOfMonth : null,
        hourUtc: schedHourUtc,
      };
      const res = await fetch("/api/admin/report-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-phone": getAdminPhone() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).title || `Error ${res.status}`);
      }
      const data = await res.json() as { schedule: ReportSchedule };
      setSchedule(data.schedule);
      setScheduleEditing(false);
      toast({ title: "Schedule saved", description: "Email delivery schedule has been configured." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSchedSaving(false);
    }
  };

  const handleToggleSchedule = async (enabled: boolean) => {
    if (!schedule) return;
    try {
      if (enabled) {
        const body = {
          frequency: schedule.frequency,
          recipients: schedule.recipients,
          enabled: true,
          dayOfWeek: schedule.dayOfWeek,
          dayOfMonth: schedule.dayOfMonth,
          hourUtc: schedule.hourUtc,
        };
        const res = await fetch("/api/admin/report-schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-admin-phone": getAdminPhone() },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json() as { schedule: ReportSchedule };
          setSchedule(data.schedule);
          toast({ title: "Schedule enabled" });
        }
      } else {
        const res = await fetch("/api/admin/report-schedule", {
          method: "DELETE",
          headers: { "x-admin-phone": getAdminPhone() },
        });
        if (res.ok) {
          setSchedule(prev => prev ? { ...prev, enabled: false } : null);
          toast({ title: "Schedule paused" });
        }
      }
    } catch { /* ignore */ }
  };

  const handleSendNow = async () => {
    if (schedRecipients.length === 0 && (!schedule || schedule.recipients.length === 0)) {
      toast({ title: "No recipients", description: "Configure recipients first.", variant: "destructive" });
      return;
    }
    const recipients = scheduleEditing ? schedRecipients : (schedule?.recipients ?? []);
    setSchedSendingNow(true);
    try {
      const res = await fetch("/api/admin/report-schedule/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-phone": getAdminPhone() },
        body: JSON.stringify({ recipients }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).title || `Error ${res.status}`);
      }
      toast({ title: "Report sent", description: `Attendance summary emailed to ${recipients.join(", ")}.` });
      await fetchSchedule();
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSchedSendingNow(false);
    }
  };

  const handleDownloadCsv = async () => {
    setIsDownloadingCsv(true);
    try {
      await downloadBlob(
        `/api/admin/candidates/csv`,
        `candidates-${format(new Date(), "yyyy-MM-dd")}.csv`
      );
      toast({ title: "Download started", description: "Candidates CSV is being downloaded." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight">Reports & Exports</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Staff Ride Report ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Staff Ride Report
            </CardTitle>
            <CardDescription>
              Download Excel export of staff field visits. Filter by date range and optionally a specific staff member.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from">From Date</Label>
                <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">To Date</Label>
                <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>

            {/* Staff filter */}
            <div className="space-y-2">
              <Label>Staff Member (optional)</Label>
              {selectedStaff ? (
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted text-sm">
                  <span className="flex-1 font-medium">
                    {selectedStaff.name}
                    {selectedStaff.empCode && <span className="text-muted-foreground ml-1">· {selectedStaff.empCode}</span>}
                  </span>
                  <button
                    onClick={() => { setSelectedStaff(null); setStaffQuery(""); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, EMP ID or phone..."
                    className="pl-8"
                    value={staffQuery}
                    onChange={(e) => setStaffQuery(e.target.value)}
                    onFocus={() => { if (staffList.length > 0) setShowDropdown(true); }}
                  />
                  {staffLoading && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {showDropdown && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {staffList.map((s) => (
                        <button
                          key={s.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedStaff(s);
                            setStaffQuery("");
                            setShowDropdown(false);
                          }}
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground text-xs">{s.empCode ?? s.phone ?? ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!selectedStaff && !staffQuery && (
                <p className="text-xs text-muted-foreground">Leave blank to include all staff in the report.</p>
              )}
            </div>

            {/* Attendance Summary */}
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attendance Summary</span>
                  {summary && !summaryLoading && (
                    <p className="text-xs text-muted-foreground mt-0.5">{summary.from} → {summary.to}</p>
                  )}
                </div>
                {summaryLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              {summary && !summaryLoading ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex items-center gap-2 bg-background rounded-md px-3 py-2 border">
                      <Users className="h-4 w-4 text-blue-600 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground leading-none">Unique Staff</p>
                        <p className="text-lg font-bold text-foreground leading-tight">{summary.uniqueStaff}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-background rounded-md px-3 py-2 border">
                      <CalendarCheck className="h-4 w-4 text-green-600 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground leading-none">Total Check-In Days</p>
                        <p className="text-lg font-bold text-foreground leading-tight">{summary.totalCheckInDays}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-background rounded-md px-3 py-2 border">
                      <TrendingUp className="h-4 w-4 text-purple-600 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground leading-none">Avg Days/Staff</p>
                        <p className="text-lg font-bold text-foreground leading-tight">{summary.avgDaysPerStaff.toFixed(1)}</p>
                      </div>
                    </div>
                  </div>
                  {summary.staffBreakdown.length > 0 && (
                    <div>
                      <button
                        onClick={() => setSummaryExpanded(v => !v)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {summaryExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {summaryExpanded ? "Hide" : "Show"} staff breakdown
                      </button>
                      {summaryExpanded && (
                        <div className="mt-2 max-h-40 overflow-y-auto rounded border bg-background divide-y text-xs">
                          {summary.staffBreakdown.map(s => (
                            <div key={s.staffId} className="flex items-center justify-between px-3 py-1.5">
                              <span className="font-medium truncate">
                                {s.staffName}
                                {s.empCode && <span className="text-muted-foreground ml-1">· {s.empCode}</span>}
                              </span>
                              <span className="shrink-0 ml-2 font-semibold text-green-700">
                                {s.checkInDays} {s.checkInDays === 1 ? "day" : "days"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {summary.uniqueStaff === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-1">No check-ins found in this date range.</p>
                  )}
                </>
              ) : !summaryLoading ? (
                <p className="text-xs text-muted-foreground">Could not load summary.</p>
              ) : null}
            </div>

            <Button onClick={handleDownloadRides} className="w-full gap-2" disabled={isDownloading}>
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloading ? "Downloading..." : selectedStaff ? `Download Report for ${selectedStaff.name}` : "Download Excel Report"}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadVehicleKm}
              className="w-full gap-2 border-green-600 text-green-700 hover:bg-green-50"
              disabled={isDownloadingVehicleKm}
            >
              {isDownloadingVehicleKm ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {isDownloadingVehicleKm ? "Downloading..." : selectedStaff ? `Export KM Summary for ${selectedStaff.name}` : "Export Vehicle KM Summary"}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadFieldAttendance}
              className="w-full gap-2 border-purple-600 text-purple-700 hover:bg-purple-50"
              disabled={isDownloadingAttendance || attendanceRowCount === 0}
            >
              {isDownloadingAttendance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloadingAttendance
                ? "Downloading..."
                : attendanceRowCount != null
                  ? `Export Field Attendance Excel (${attendanceRowCount} ${attendanceRowCount === 1 ? "row" : "rows"})`
                  : "Export Field Attendance Excel"}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadAttendanceSummary}
              className="w-full gap-2 border-teal-600 text-teal-700 hover:bg-teal-50"
              disabled={isDownloadingAttendanceSummary || (summary !== null && summary.uniqueStaff === 0)}
            >
              {isDownloadingAttendanceSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {isDownloadingAttendanceSummary
                ? "Downloading..."
                : selectedStaff
                  ? `Export Attendance Summary for ${selectedStaff.name}`
                  : "Export Attendance Summary"}
            </Button>

            {/* View on-screen report */}
            {!reportVisible ? (
              <Button
                variant="ghost"
                onClick={handleViewReport}
                className="w-full gap-2 text-muted-foreground hover:text-foreground"
                disabled={tripLoading}
              >
                {tripLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                View Ride Report with Photos
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={handleHideReport}
                className="w-full gap-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
                Hide Ride Report
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ── Candidates CSV ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Candidates CSV
            </CardTitle>
            <CardDescription>
              Download all candidates data as a CSV file for further analysis or import.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Exports all candidate records including name, contact, location, mobilizer, and current status.
            </p>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleDownloadCsv}
              disabled={isDownloadingCsv}
            >
              {isDownloadingCsv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloadingCsv ? "Downloading..." : "Download Candidates CSV"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Individual candidate PDFs can be downloaded from the{" "}
              <a href="/admin-panel/candidates" className="text-primary underline-offset-2 hover:underline">
                Candidates page
              </a>.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Email Schedule ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-teal-600" />
                Scheduled Email Delivery
                {schedule?.enabled && (
                  <Badge variant="secondary" className="bg-teal-100 text-teal-800 border-teal-200 text-xs">Active</Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Automatically email the Attendance Summary report on a recurring schedule.
              </CardDescription>
            </div>
            {schedule && !scheduleEditing && (
              <Switch
                checked={schedule.enabled}
                onCheckedChange={handleToggleSchedule}
                aria-label="Toggle schedule"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheduleLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : !emailConfigured ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                <Bell className="h-4 w-4" /> SMTP not configured
              </p>
              <p className="text-xs text-amber-700">
                Set the <code className="font-mono bg-amber-100 px-1 rounded">SMTP_HOST</code>,{" "}
                <code className="font-mono bg-amber-100 px-1 rounded">SMTP_USER</code>, and{" "}
                <code className="font-mono bg-amber-100 px-1 rounded">SMTP_PASS</code> environment variables to enable email delivery.
                Optionally set <code className="font-mono bg-amber-100 px-1 rounded">SMTP_PORT</code> (default 587) and{" "}
                <code className="font-mono bg-amber-100 px-1 rounded">SMTP_FROM</code>.
              </p>
            </div>
          ) : !scheduleEditing ? (
            schedule ? (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <span className="font-medium capitalize">{schedule.frequency}</span>
                      {schedule.frequency === "weekly" && schedule.dayOfWeek !== null && (
                        <span className="text-muted-foreground ml-1">
                          — every {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][schedule.dayOfWeek]}
                        </span>
                      )}
                      {schedule.frequency === "monthly" && schedule.dayOfMonth !== null && (
                        <span className="text-muted-foreground ml-1">
                          — on the {schedule.dayOfMonth}{["st","nd","rd"][schedule.dayOfMonth - 1] ?? "th"} of each month
                        </span>
                      )}
                      <span className="text-muted-foreground ml-1">at {String(schedule.hourUtc).padStart(2,"0")}:00 UTC</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {schedule.recipients.map(r => (
                        <Badge key={r} variant="secondary" className="text-xs font-mono">{r}</Badge>
                      ))}
                    </div>
                  </div>
                  {schedule.lastSentAt && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Send className="h-3.5 w-3.5 shrink-0" />
                      Last sent: {new Date(schedule.lastSentAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
                    Edit Schedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendNow}
                    disabled={schedSendingNow}
                    className="gap-1.5 border-teal-600 text-teal-700 hover:bg-teal-50"
                  >
                    {schedSendingNow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {schedSendingNow ? "Sending…" : "Send Now"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No schedule configured yet. Set one up to receive the Attendance Summary automatically by email.
                </p>
                <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Configure Schedule
                </Button>
              </div>
            )
          ) : (
            /* ── Editing form ── */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Frequency</Label>
                  <Select value={schedFrequency} onValueChange={(v) => setSchedFrequency(v as "daily" | "weekly" | "monthly")}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Send Time (UTC hour)</Label>
                  <Select value={String(schedHourUtc)} onValueChange={(v) => setSchedHourUtc(Number(v))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>{String(i).padStart(2,"0")}:00 UTC</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {schedFrequency === "weekly" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Day of Week</Label>
                  <Select value={String(schedDayOfWeek)} onValueChange={(v) => setSchedDayOfWeek(Number(v))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {schedFrequency === "monthly" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Day of Month (1–28)</Label>
                  <Select value={String(schedDayOfMonth)} onValueChange={(v) => setSchedDayOfMonth(Number(v))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                        <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Recipients */}
              <div className="space-y-2">
                <Label className="text-xs">Recipients</Label>
                {schedRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {schedRecipients.map(r => (
                      <Badge key={r} variant="secondary" className="text-xs font-mono gap-1 pr-1">
                        {r}
                        <button
                          onClick={() => removeEmail(r)}
                          className="ml-0.5 hover:text-destructive transition-colors"
                          aria-label={`Remove ${r}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="recipient@example.com"
                    value={schedEmailInput}
                    onChange={e => setSchedEmailInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                    className="h-8 text-sm flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={addEmail} className="h-8 gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
                {schedRecipients.length === 0 && (
                  <p className="text-xs text-muted-foreground">Add at least one recipient email address.</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleSaveSchedule}
                  disabled={schedSaving || schedRecipients.length === 0}
                  className="gap-1.5"
                >
                  {schedSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {schedSaving ? "Saving…" : "Save Schedule"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendNow}
                  disabled={schedSendingNow || schedRecipients.length === 0}
                  className="gap-1.5 border-teal-600 text-teal-700 hover:bg-teal-50"
                >
                  {schedSendingNow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {schedSendingNow ? "Sending…" : "Test Send Now"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setScheduleEditing(false)}
                  disabled={schedSaving || schedSendingNow}
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Ride Report Viewer ── */}
      {reportVisible && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-indigo-600" />
                  Ride Report
                  {selectedStaff && (
                    <span className="text-base font-normal text-muted-foreground">— {selectedStaff.name}</span>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  {fromDate} to {toDate}
                  {tripRows && !tripLoading && (
                    <>
                      <span className="ml-2 text-xs font-medium bg-muted px-1.5 py-0.5 rounded">
                        {tripRows.length} {tripRows.length === 1 ? "trip" : "trips"}
                      </span>
                      {displayedRows && displayedRows.length !== tripRows.length && (
                        <span className="ml-1.5 text-xs font-medium bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                          {displayedRows.length} shown
                        </span>
                      )}
                    </>
                  )}
                </CardDescription>
              </div>
              {tripLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent>
            {tripError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-4 py-3">
                {tripError}
              </div>
            )}
            {tripLoading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading trips…
              </div>
            )}
            {!tripLoading && tripRows && tripRows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">
                No completed trips found for this date range.
              </p>
            )}
            {!tripLoading && tripRows && tripRows.length > 0 && (
              <>
                {/* Photo filter toolbar */}
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">Photos:</span>
                  {(["all", "has", "missing"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setPhotoFilter(opt)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                        photoFilter === opt
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "border-border text-muted-foreground hover:border-indigo-400 hover:text-indigo-600"
                      }`}
                    >
                      {opt === "all" && "All"}
                      {opt === "has" && <><ImageIcon className="h-3 w-3" /> Has photo</>}
                      {opt === "missing" && <><ImageOff className="h-3 w-3" /> Missing photo</>}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b text-xs text-muted-foreground uppercase tracking-wide">
                        {/* Sortable: Date */}
                        <th className="px-3 py-2.5 text-left font-semibold">
                          <button
                            onClick={() => handleSortCol("date")}
                            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            Date
                            {sortCol === "date" ? (
                              sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </button>
                        </th>
                        {/* Sortable: Staff */}
                        <th className="px-3 py-2.5 text-left font-semibold">
                          <button
                            onClick={() => handleSortCol("staff")}
                            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            Staff
                            {sortCol === "staff" ? (
                              sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold">Start</th>
                        <th className="px-3 py-2.5 text-left font-semibold">End</th>
                        {/* Sortable: KM */}
                        <th className="px-3 py-2.5 text-right font-semibold">
                          <button
                            onClick={() => handleSortCol("km")}
                            className="inline-flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                          >
                            GPS KM
                            {sortCol === "km" ? (
                              sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold">Vehicle KM</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Variance</th>
                        <th className="px-3 py-2.5 text-center font-semibold">Check-in Photo</th>
                        <th className="px-3 py-2.5 text-center font-semibold">Check-out Photo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {displayedRows && displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">
                            No trips match the current filter.
                          </td>
                        </tr>
                      ) : (
                        displayedRows?.map((row) => {
                          const highVariance = row.variancePct != null && row.variancePct > 20;
                          return (
                            <tr key={row.tripRef} className={`hover:bg-muted/30 transition-colors ${highVariance ? "bg-amber-50" : ""}`}>
                              <td className="px-3 py-2.5 whitespace-nowrap font-medium text-foreground">
                                {fmtDate(row.rideDate)}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="font-medium truncate max-w-[140px]">{row.staffName}</div>
                                <div className="text-xs text-muted-foreground">{row.staffPhone}</div>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                                {toIst(row.startTime)}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                                {toIst(row.endTime)}
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap font-medium">
                                {row.gpsKm != null ? `${row.gpsKm.toFixed(1)} km` : row.distanceKm != null ? `${row.distanceKm.toFixed(1)} km` : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                {row.vehicleKm != null ? (
                                  <span className="font-medium">
                                    {row.vehicleKm.toFixed(1)} km
                                    {row.startOdometer != null && row.endOdometer != null && (
                                      <span className="block text-xs text-muted-foreground">
                                        {row.startOdometer.toLocaleString("en-IN")} → {row.endOdometer.toLocaleString("en-IN")}
                                      </span>
                                    )}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                {row.variancePct != null ? (
                                  <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${highVariance ? "bg-amber-100 text-amber-700" : "text-muted-foreground"}`}>
                                    {row.variancePct.toFixed(1)}%
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {row.checkinPhotoUrl ? (
                                  <OdometerPhoto url={row.checkinPhotoUrl} label="check-in odometer" />
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {row.checkoutPhotoUrl ? (
                                  <OdometerPhoto url={row.checkoutPhotoUrl} label="check-out odometer" />
                                ) : null}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
