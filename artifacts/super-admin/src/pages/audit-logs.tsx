import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, MapPin, LogIn, LogOut, Car, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

interface AuditLog {
  id: string;
  companyId: string | null;
  companyName: string;
  kind: "checkin" | "checkout" | "meter" | "trip-start" | "trip-end";
  staffId: string;
  staffName: string;
  occurredAt: string;
  receivedAt: string;
}

const KIND_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  checkin: { label: "Check In", icon: LogIn, color: "text-green-700", bg: "bg-green-50" },
  checkout: { label: "Check Out", icon: LogOut, color: "text-red-700", bg: "bg-red-50" },
  meter: { label: "Meter Read", icon: Gauge, color: "text-blue-700", bg: "bg-blue-50" },
  "trip-start": { label: "Trip Start", icon: Car, color: "text-violet-700", bg: "bg-violet-50" },
  "trip-end": { label: "Trip End", icon: MapPin, color: "text-amber-700", bg: "bg-amber-50" },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AuditLogsPage() {
  const [kindFilter, setKindFilter] = useState<string>("all");

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["super-admin-audit-logs", kindFilter],
    queryFn: () =>
      apiFetch(`/super-admin/audit-logs?limit=100${kindFilter !== "all" ? `&kind=${kindFilter}` : ""}`),
  });

  const kindCounts = logs?.reduce<Record<string, number>>((acc, l) => {
    acc[l.kind] = (acc[l.kind] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">Field activity events across all companies</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(KIND_META).map(([kind, meta]) => {
          const Icon = meta.icon;
          return (
            <button
              key={kind}
              onClick={() => setKindFilter(kindFilter === kind ? "all" : kind)}
              className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                kindFilter === kind ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium leading-tight">{meta.label}</p>
                <p className="text-lg font-bold leading-tight">{kindCounts[kind] ?? 0}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Activity Feed
              {logs && (
                <span className="text-muted-foreground font-normal">({logs.length} events)</span>
              )}
            </CardTitle>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="checkin">Check In</SelectItem>
                <SelectItem value="checkout">Check Out</SelectItem>
                <SelectItem value="meter">Meter Read</SelectItem>
                <SelectItem value="trip-start">Trip Start</SelectItem>
                <SelectItem value="trip-end">Trip End</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 pb-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : logs?.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
              <Activity className="h-8 w-8 opacity-30" />
              <p className="text-sm">No activity events found.</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {logs?.map((log) => {
                const meta = KIND_META[log.kind];
                const Icon = meta?.icon ?? Activity;
                return (
                  <div key={log.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                    <div className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${meta?.bg ?? "bg-muted"}`}>
                      <Icon className={`h-4 w-4 ${meta?.color ?? "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{log.staffName}</span>
                        <Badge variant="outline" className="text-xs">{meta?.label ?? log.kind}</Badge>
                        <Badge variant="secondary" className="text-xs text-blue-600 bg-blue-50 border-blue-100">
                          {log.companyName}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDateTime(log.occurredAt)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(log.occurredAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
