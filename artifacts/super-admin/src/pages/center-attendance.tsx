import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin, Users, CheckCircle2, XCircle, Clock, AlertTriangle, Building2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

interface AttendanceSummary {
  total: number;
  present: number;
  partial: number;
  absent: number;
  outsideFence: number;
  complianceRate: number;
  attendanceRate: number;
}

interface AttendanceRecord {
  staffId: string;
  staffName: string;
  empCode: string | null;
  phone: string | null;
  companyId: string | null;
  companyName: string;
  status: "present" | "partial" | "absent";
  checkinTime: string | null;
  checkoutTime: string | null;
  durationMin: number | null;
  outsideGeofence: boolean;
  distanceFromCenterM: number | null;
}

interface AttendanceData {
  date: string;
  summary: AttendanceSummary;
  records: AttendanceRecord[];
}

interface Company {
  id: string;
  name: string;
}

function toISTTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

function formatDuration(min: number | null): string {
  if (min === null || min < 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function todayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function KpiCard({
  label, value, sub, icon: Icon, color, loading,
}: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color: string; loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          {loading ? <Skeleton className="h-7 w-16 mt-1" /> : (
            <p className="text-2xl font-bold tracking-tight mt-0.5">{value}</p>
          )}
          {sub && !loading && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: AttendanceRecord["status"] }) {
  if (status === "present") return <Badge className="text-xs bg-green-600 hover:bg-green-700">Present</Badge>;
  if (status === "partial") return <Badge className="text-xs bg-amber-500 hover:bg-amber-600">Partial</Badge>;
  return <Badge variant="destructive" className="text-xs">Absent</Badge>;
}

export default function CenterAttendancePage() {
  const [date, setDate] = useState(todayIST());
  const [companyId, setCompanyId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<AttendanceData>({
    queryKey: ["center-attendance", date, companyId],
    queryFn: () => {
      const params = new URLSearchParams({ date });
      if (companyId !== "all") params.set("companyId", companyId);
      return apiFetch(`/api/super-admin/center-attendance?${params}`);
    },
    staleTime: 60_000,
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["companies-list"],
    queryFn: () => apiFetch("/api/super-admin/companies?limit=200"),
    staleTime: 300_000,
    select: (d) => (Array.isArray(d) ? d : (d as { companies?: Company[] }).companies ?? []),
  });

  const filtered = (data?.records ?? []).filter((r) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "outside") return r.outsideGeofence;
    return r.status === statusFilter;
  });

  const s = data?.summary;
  const isToday = date === todayIST();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Center Staff Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Geo-fenced daily attendance for center-category staff</p>
        </div>

        {/* Date navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            max={todayIST()}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={isToday}
            className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Center Staff"
          value={s?.total ?? "—"}
          icon={Users}
          color="bg-blue-50 text-blue-600"
          loading={isLoading}
        />
        <KpiCard
          label="Present"
          value={s ? `${s.present} / ${s.total}` : "—"}
          sub={s ? `${s.attendanceRate}% attendance` : undefined}
          icon={CheckCircle2}
          color="bg-green-50 text-green-600"
          loading={isLoading}
        />
        <KpiCard
          label="Absent"
          value={s?.absent ?? "—"}
          sub={s?.partial ? `${s.partial} partial` : undefined}
          icon={XCircle}
          color="bg-red-50 text-red-600"
          loading={isLoading}
        />
        <KpiCard
          label="Geo-fence Violations"
          value={s?.outsideFence ?? "—"}
          sub={s ? `${s.complianceRate}% compliance` : undefined}
          icon={AlertTriangle}
          color={s && s.outsideFence > 0 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}
          loading={isLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger className="h-8 text-xs w-48">
            <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {(companies ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="partial">Partial (no checkout)</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="outside">Outside Geo-fence</SelectItem>
          </SelectContent>
        </Select>

        {filtered.length !== (data?.records?.length ?? 0) && (
          <span className="text-xs text-muted-foreground">{filtered.length} of {data?.records?.length} shown</span>
        )}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-3 px-4 py-2 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Staff</span>
          <span>Company</span>
          <span>Status</span>
          <span>Check-In</span>
          <span>Check-Out</span>
          <span>Duration</span>
          <span>Geo-fence</span>
        </div>

        {isLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24 ml-auto" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-14" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No center staff records found for this date</p>
            <p className="text-xs text-muted-foreground mt-1">Try changing the date or company filter</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => (
              <div
                key={r.staffId}
                className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-2 sm:gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
              >
                {/* Staff info */}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.staffName}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.empCode, r.phone].filter(Boolean).join(" · ")}
                  </p>
                </div>

                {/* Company */}
                <div className="text-xs text-muted-foreground truncate max-w-[130px]">{r.companyName}</div>

                {/* Status */}
                <StatusBadge status={r.status} />

                {/* Check-in time */}
                <div className="text-xs font-mono">
                  <span className="text-muted-foreground sm:hidden">In: </span>
                  {r.checkinTime ? (
                    <span className="text-green-700">{toISTTime(r.checkinTime)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                {/* Check-out time */}
                <div className="text-xs font-mono">
                  <span className="text-muted-foreground sm:hidden">Out: </span>
                  {r.checkoutTime ? (
                    <span className="text-blue-700">{toISTTime(r.checkoutTime)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                {/* Duration */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {r.durationMin !== null && <Clock className="h-3 w-3" />}
                  {formatDuration(r.durationMin)}
                </div>

                {/* Geo-fence status */}
                <div>
                  {r.status === "absent" ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : r.outsideGeofence ? (
                    <div className="flex items-center gap-1">
                      <Badge className="text-xs bg-red-500 hover:bg-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Outside
                      </Badge>
                      {r.distanceFromCenterM != null && (
                        <span className="text-[10px] text-muted-foreground">{Math.round(r.distanceFromCenterM)}m</span>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs text-green-700 border-green-300 flex items-center gap-1 w-fit">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Inside
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-600 inline-block" />Present = checked in + out</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />Partial = checked in, no checkout</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Absent = no check-in</span>
        <span className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-red-500" />Outside = checked in beyond geo-fence radius</span>
      </div>
    </div>
  );
}
