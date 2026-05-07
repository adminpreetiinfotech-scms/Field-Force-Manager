import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  CalendarClock,
  BarChart2,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenueData {
  planPrices: Record<string, number>;
  kpi: {
    totalCompaniesWithPlan: number;
    totalMRR: number;
    totalARR: number;
    collectedMRR: number;
    pendingMRR: number;
    expiredMRR: number;
    collectionRate: number;
  };
  planRevenue: Record<string, { count: number; mrr: number }>;
  pendingCompanies: Array<{
    id: string;
    name: string;
    phone: string | null;
    plan: string | null;
    paymentStatus: string | null;
    subscriptionEndDate: string | null;
    estimatedAmount: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    basic: number;
    standard: number;
    premium: number;
    total: number;
    mrr: number;
  }>;
  renewalForecast: {
    in30Days: { count: number; mrr: number };
    in60Days: { count: number; mrr: number };
    in90Days: { count: number; mrr: number };
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtFull(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y?.slice(2)}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "text-primary",
  bg = "bg-primary/10",
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
  bg?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground mt-1 leading-none">{value}</p>
            )}
            {sub && !loading && (
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            )}
          </div>
          <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PLAN_COLORS: Record<string, { bar: string; dot: string; badge: string }> = {
  basic:    { bar: "bg-blue-400",   dot: "bg-blue-400",   badge: "text-blue-700 bg-blue-50 border-blue-200" },
  standard: { bar: "bg-violet-500", dot: "bg-violet-500", badge: "text-violet-700 bg-violet-50 border-violet-200" },
  premium:  { bar: "bg-amber-500",  dot: "bg-amber-500",  badge: "text-amber-700 bg-amber-50 border-amber-200" },
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const { data, isLoading } = useQuery<RevenueData>({
    queryKey: ["super-admin-revenue"],
    queryFn: () => apiFetch("/super-admin/revenue"),
    refetchInterval: 60_000,
  });

  const kpi = data?.kpi;
  const maxMonthMrr = Math.max(...(data?.monthlyTrend?.map((m) => m.mrr) ?? [1]), 1);
  const maxPlanMrr = Math.max(...Object.values(data?.planRevenue ?? {}).map((p) => p.mrr), 1);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Revenue Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Estimated revenue based on plan rates — Basic ₹5K · Standard ₹10K · Premium ₹20K per month
        </p>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Total MRR"
          value={isLoading ? "—" : fmt(kpi?.totalMRR ?? 0)}
          sub={`ARR: ${fmt((kpi?.totalARR ?? 0))}`}
          icon={IndianRupee}
          loading={isLoading}
        />
        <KpiCard
          label="Collected"
          value={isLoading ? "—" : fmt(kpi?.collectedMRR ?? 0)}
          sub={`${kpi?.collectionRate ?? 0}% collection rate`}
          icon={CheckCircle2}
          color="text-green-600"
          bg="bg-green-50"
          loading={isLoading}
        />
        <KpiCard
          label="Pending"
          value={isLoading ? "—" : fmt(kpi?.pendingMRR ?? 0)}
          sub={`${data?.pendingCompanies?.length ?? 0} companies`}
          icon={Clock}
          color="text-amber-600"
          bg="bg-amber-50"
          loading={isLoading}
        />
        <KpiCard
          label="Expired / Lost"
          value={isLoading ? "—" : fmt(kpi?.expiredMRR ?? 0)}
          icon={XCircle}
          color="text-red-500"
          bg="bg-red-50"
          loading={isLoading}
        />
        <KpiCard
          label="Active Plans"
          value={isLoading ? "—" : String(kpi?.totalCompaniesWithPlan ?? 0)}
          sub="paid + pending + expired"
          icon={Building2}
          loading={isLoading}
        />
        <KpiCard
          label="ARR"
          value={isLoading ? "—" : fmt(kpi?.totalARR ?? 0)}
          sub="annualised"
          icon={TrendingUp}
          color="text-violet-600"
          bg="bg-violet-50"
          loading={isLoading}
        />
      </div>

      {/* ── Renewal forecast + Plan revenue ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Renewal forecast */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              Renewal Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Next 30 days", data: data?.renewalForecast.in30Days, color: "text-red-600 bg-red-50 border-red-200" },
                  { label: "Next 60 days", data: data?.renewalForecast.in60Days, color: "text-amber-600 bg-amber-50 border-amber-200" },
                  { label: "Next 90 days", data: data?.renewalForecast.in90Days, color: "text-blue-600 bg-blue-50 border-blue-200" },
                ].map(({ label, data: d, color }) => (
                  <div key={label} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${color}`}>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs opacity-75">{d?.count ?? 0} companies up for renewal</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold">{fmt(d?.mrr ?? 0)}</p>
                      <p className="text-xs opacity-75">potential collection</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan-wise revenue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
              Revenue by Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              Object.entries(data?.planRevenue ?? {}).map(([plan, info]) => {
                const cols = PLAN_COLORS[plan] ?? { bar: "bg-gray-400", dot: "bg-gray-400", badge: "" };
                const pct = maxPlanMrr > 0 ? Math.max((info.mrr / maxPlanMrr) * 100, info.mrr > 0 ? 4 : 0) : 0;
                return (
                  <div key={plan} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${cols.dot}`} />
                        <span className="capitalize font-medium">{plan}</span>
                        <span className="text-muted-foreground text-xs">× {info.count}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{fmtFull(info.mrr)}</span>
                        <span className="text-xs text-muted-foreground">/mo</span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${cols.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
            {!isLoading && (
              <div className="pt-3 border-t flex justify-between text-sm font-semibold">
                <span>Total MRR</span>
                <span>{fmtFull(kpi?.totalMRR ?? 0)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly MRR trend ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Monthly New Subscription Revenue (Last 12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="space-y-2">
              {data?.monthlyTrend?.map((m) => {
                const pct = maxMonthMrr > 0 ? Math.max((m.mrr / maxMonthMrr) * 100, m.mrr > 0 ? 2 : 0) : 0;
                return (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-12 flex-shrink-0 font-mono">{formatMonth(m.month)}</span>
                    <div className="flex-1 bg-muted rounded-full h-7 overflow-hidden relative">
                      <div
                        className="h-full bg-primary/80 rounded-full transition-all flex items-center gap-2 px-2"
                        style={{ width: `${pct}%` }}
                      >
                        {m.mrr > 0 && pct > 10 && (
                          <span className="text-xs text-primary-foreground font-medium whitespace-nowrap">
                            {fmt(m.mrr)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 w-24">
                      <span className="text-xs font-semibold">{m.mrr > 0 ? fmtFull(m.mrr) : "—"}</span>
                      {m.total > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">({m.total})</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pending payments table ── */}
      {((data?.pendingCompanies?.length ?? 0) > 0 || isLoading) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Payments
              {!isLoading && (
                <Badge variant="secondary" className="ml-1 text-amber-700 bg-amber-50 border border-amber-200">
                  {data?.pendingCompanies?.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="px-6 pb-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <div className="divide-y divide-border max-h-80 overflow-y-auto">
                {data?.pendingCompanies?.map((c) => {
                  const cols = PLAN_COLORS[c.plan ?? ""] ?? { badge: "" };
                  return (
                    <div key={c.id} className="flex items-center justify-between px-6 py-3 gap-4 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{c.name}</span>
                          {c.plan && (
                            <Badge className={`text-xs capitalize ${cols.badge}`}>{c.plan}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {c.phone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {c.phone}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Expires: {formatDate(c.subscriptionEndDate)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-amber-700">{fmtFull(c.estimatedAmount)}</p>
                        <p className="text-xs text-muted-foreground">pending/mo</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
