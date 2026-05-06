import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Users,
  TrendingUp,
  MapPin,
  UserSquare2,
  CalendarDays,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffPerf {
  id: string;
  name: string;
  phone: string;
  empCode: string;
  staffCategory: "field" | "center";
  designation: string | null;
  area: string | null;
  isDisabled: boolean;
  presentDays: number;
  attendancePct: number;
  gpsKm: number;
  candidatesThisMonth: number;
  candidatesApprovedThisMonth: number;
  leaveDaysYTD: number;
}

interface PerfData {
  month: string;
  workingDays: number;
  staff: StaffPerf[];
}

type SortKey =
  | "name"
  | "presentDays"
  | "attendancePct"
  | "gpsKm"
  | "candidatesThisMonth"
  | "leaveDaysYTD";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[parseInt(mo ?? "1", 10) - 1]} ${y}`;
}

function prevMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y!, mo! - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y!, mo! - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const n = new Date(Date.now() + 5.5 * 3600000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
}

function attendColor(pct: number): string {
  if (pct >= 85) return "text-green-600";
  if (pct >= 60) return "text-amber-600";
  return "text-red-500";
}

function attendBg(pct: number): string {
  if (pct >= 85) return "bg-green-100 text-green-700 border-green-200";
  if (pct >= 60) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-red-100 text-red-700 border-red-200";
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function StaffPerformance() {
  useAuth();

  const { toast } = useToast();
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "field" | "center">("all");
  const [sortKey, setSortKey] = useState<SortKey>("attendancePct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/staff-performance?month=${month}`);
      if (!res.ok) throw new Error("Failed to load");
      setData((await res.json()) as PerfData);
    } catch {
      toast({ title: "Error", description: "Could not load performance data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [month, toast]);

  useEffect(() => { void load(); }, [load]);

  // ── Filtering + sorting ────────────────────────────────────────────────────
  const filtered = (data?.staff ?? []).filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.empCode.toLowerCase().includes(q) ||
      (s.area?.toLowerCase().includes(q) ?? false);
    const matchCat = categoryFilter === "all" || s.staffCategory === categoryFilter;
    return matchSearch && matchCat;
  });

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortKey === "name") {
      diff = a.name.localeCompare(b.name);
    } else {
      diff = (a[sortKey] as number) - (b[sortKey] as number);
    }
    return sortDir === "asc" ? diff : -diff;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const staffArr = data?.staff ?? [];
  const avgAttend =
    staffArr.length > 0
      ? Math.round(staffArr.reduce((s, x) => s + x.attendancePct, 0) / staffArr.length)
      : 0;
  const totalKm = Math.round(staffArr.reduce((s, x) => s + x.gpsKm, 0));
  const totalCand = staffArr.reduce((s, x) => s + x.candidatesThisMonth, 0);
  const topPerformer = [...staffArr].sort((a, b) => b.attendancePct - a.attendancePct)[0] ?? null;

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-blue-500" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 text-blue-500" />;
  };

  const SortTh = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none whitespace-nowrap hover:bg-muted/40 transition-colors"
      onClick={() => toggleSort(k)}
    >
      <div className="flex items-center">
        {children}
        <SortIcon k={k} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-rose-500" />
            Staff Performance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Attendance, KM, and candidate metrics — {fmtMonth(month)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            onClick={() => setMonth((m) => prevMonth(m))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold min-w-[110px] text-center">
            {fmtMonth(month)}
          </span>
          <button
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            onClick={() => setMonth((m) => nextMonth(m))}
            disabled={month >= currentMonth()}
          >
            <ChevronRight className={`h-4 w-4 ${month >= currentMonth() ? "opacity-30" : ""}`} />
          </button>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={Users}
          label="Total Staff"
          value={loading ? "…" : String(staffArr.length)}
          sub={data ? `${data.workingDays} working days` : ""}
          color="text-blue-600"
          bg="bg-blue-50 border-blue-200"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Avg Attendance"
          value={loading ? "…" : `${avgAttend}%`}
          sub={topPerformer ? `Top: ${topPerformer.name}` : ""}
          color={avgAttend >= 75 ? "text-green-600" : "text-amber-600"}
          bg={avgAttend >= 75 ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}
        />
        <SummaryCard
          icon={MapPin}
          label="Total GPS KM"
          value={loading ? "…" : `${totalKm.toLocaleString()} km`}
          sub="field staff trips"
          color="text-indigo-600"
          bg="bg-indigo-50 border-indigo-200"
        />
        <SummaryCard
          icon={UserSquare2}
          label="Candidates"
          value={loading ? "…" : String(totalCand)}
          sub="registered this month"
          color="text-pink-600"
          bg="bg-pink-50 border-pink-200"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name, emp code, area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff</SelectItem>
            <SelectItem value="field">Field</SelectItem>
            <SelectItem value="center">Center</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center ml-1">
          {loading ? "—" : `${sorted.length} of ${staffArr.length} staff`}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {["Staff", "Category", "Present", "Attendance %", "GPS KM", "Candidates", "Leaves YTD"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <BarChart2 className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-semibold text-muted-foreground">
            No staff found for this period
          </p>
          <p className="text-sm text-muted-foreground">
            Try adjusting the month or category filter.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <SortTh k="name">Staff</SortTh>
                <TableHead>Category</TableHead>
                <SortTh k="presentDays">Present Days</SortTh>
                <SortTh k="attendancePct">Attendance %</SortTh>
                <SortTh k="gpsKm">GPS KM</SortTh>
                <SortTh k="candidatesThisMonth">Candidates</SortTh>
                <SortTh k="leaveDaysYTD">Leaves YTD</SortTh>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                  {/* Staff */}
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-[160px]">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-br from-cyan-500 to-indigo-600 text-white">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm leading-tight flex items-center gap-1">
                          {s.name}
                          {s.isDisabled && (
                            <span className="text-[9px] px-1 rounded bg-red-100 text-red-600 font-semibold ml-0.5">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {s.empCode}
                          {s.area && ` · ${s.area}`}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Category */}
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      s.staffCategory === "field"
                        ? "bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-violet-100 text-violet-700 border-violet-200"
                    }`}>
                      {s.staffCategory === "field" ? "Field" : "Center"}
                    </span>
                    {s.designation && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{s.designation}</div>
                    )}
                  </TableCell>

                  {/* Present Days */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-semibold ${attendColor(s.attendancePct)}`}>
                        {s.presentDays}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        / {data?.workingDays ?? "—"}
                      </span>
                    </div>
                  </TableCell>

                  {/* Attendance % */}
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            s.attendancePct >= 85 ? "bg-green-500" :
                            s.attendancePct >= 60 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(100, s.attendancePct)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold tabular-nums w-8 shrink-0 ${attendColor(s.attendancePct)}`}>
                        {s.attendancePct}%
                      </span>
                    </div>
                  </TableCell>

                  {/* GPS KM */}
                  <TableCell>
                    {s.staffCategory === "field" ? (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-indigo-400 shrink-0" />
                        <span className="text-sm font-medium tabular-nums">
                          {s.gpsKm.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
                        </span>
                        <span className="text-xs text-muted-foreground">km</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Candidates */}
                  <TableCell>
                    {s.candidatesThisMonth > 0 ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <UserSquare2 className="h-3 w-3 text-pink-400 shrink-0" />
                          <span className="text-sm font-medium">{s.candidatesThisMonth}</span>
                          <span className="text-xs text-muted-foreground">registered</span>
                        </div>
                        {s.candidatesApprovedThisMonth > 0 && (
                          <div className="text-[11px] text-green-600 flex items-center gap-0.5 pl-4">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {s.candidatesApprovedThisMonth} approved
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </TableCell>

                  {/* Leaves YTD */}
                  <TableCell>
                    {s.leaveDaysYTD > 0 ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                        s.leaveDaysYTD >= 10
                          ? "bg-red-100 text-red-700 border-red-200"
                          : s.leaveDaysYTD >= 5
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        <CalendarDays className="h-3 w-3" />
                        {s.leaveDaysYTD}d
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Legend */}
      {!loading && sorted.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>≥ 85% — Good</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>60–84% — Average</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>&lt; 60% — Below Target</span>
          </div>
          <div className="ml-auto">
            Attendance % = Present Days ÷ Working Days (Mon–Sat) × 100
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary Card ───────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color} leading-tight`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
