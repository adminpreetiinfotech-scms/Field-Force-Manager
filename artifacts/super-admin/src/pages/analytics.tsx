import { useQuery } from "@tanstack/react-query";
import { BarChart2, TrendingUp, Building2, CreditCard, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface AnalyticsData {
  total: number;
  active: number;
  inactive: number;
  expiringIn30Days: number;
  expired: number;
  planDistribution: Record<string, number>;
  paymentDistribution: Record<string, number>;
  monthlyGrowth: Array<{ month: string; count: number }>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-primary",
  bg = "bg-primary/10",
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  color?: string;
  bg?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            {value === undefined ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-3xl font-bold text-foreground mt-1">{value.toLocaleString()}</p>
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

const PLAN_COLORS: Record<string, string> = {
  basic: "bg-blue-400",
  standard: "bg-violet-500",
  premium: "bg-amber-500",
  none: "bg-gray-300",
};

const PAYMENT_COLORS: Record<string, string> = {
  paid: "bg-green-500",
  pending: "bg-amber-400",
  expired: "bg-red-500",
  none: "bg-gray-300",
};

function DistributionBar({
  data,
  colors,
  total,
}: {
  data: Record<string, number>;
  colors: Record<string, string>;
  total: number;
}) {
  if (total === 0) return <div className="h-4 rounded-full bg-muted w-full" />;
  return (
    <div className="flex h-4 rounded-full overflow-hidden w-full gap-px">
      {Object.entries(data)
        .filter(([, v]) => v > 0)
        .map(([key, val]) => (
          <div
            key={key}
            className={`${colors[key] ?? "bg-gray-300"} transition-all`}
            style={{ width: `${(val / total) * 100}%` }}
            title={`${key}: ${val}`}
          />
        ))}
    </div>
  );
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["super-admin-analytics"],
    queryFn: () => apiFetch("/super-admin/analytics"),
  });

  const total = data?.total ?? 0;
  const maxMonth = Math.max(...(data?.monthlyGrowth?.map((m) => m.count) ?? [1]), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform-wide performance overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Companies" value={isLoading ? undefined : data?.total} icon={Building2} />
        <StatCard
          label="Active"
          value={isLoading ? undefined : data?.active}
          icon={CheckCircle2}
          color="text-green-600"
          bg="bg-green-50"
        />
        <StatCard
          label="Inactive"
          value={isLoading ? undefined : data?.inactive}
          icon={Building2}
          color="text-gray-500"
          bg="bg-gray-100"
        />
        <StatCard
          label="Expiring (30d)"
          value={isLoading ? undefined : data?.expiringIn30Days}
          icon={AlertTriangle}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <StatCard
          label="Expired"
          value={isLoading ? undefined : data?.expired}
          icon={AlertTriangle}
          color="text-red-600"
          bg="bg-red-50"
        />
        <StatCard label="Paid" value={isLoading ? undefined : data?.paymentDistribution?.paid} icon={CreditCard} color="text-green-600" bg="bg-green-50" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
              Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              <>
                <DistributionBar data={data?.planDistribution ?? {}} colors={PLAN_COLORS} total={total} />
                <div className="space-y-2">
                  {Object.entries(data?.planDistribution ?? {})
                    .filter(([, v]) => v >= 0)
                    .map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${PLAN_COLORS[key] ?? "bg-gray-300"}`} />
                          <span className="capitalize text-muted-foreground">{key === "none" ? "No Plan" : key}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{val}</span>
                          <span className="text-xs text-muted-foreground">
                            ({total > 0 ? Math.round((val / total) * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              <>
                <DistributionBar data={data?.paymentDistribution ?? {}} colors={PAYMENT_COLORS} total={total} />
                <div className="space-y-2">
                  {Object.entries(data?.paymentDistribution ?? {})
                    .filter(([, v]) => v >= 0)
                    .map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${PAYMENT_COLORS[key] ?? "bg-gray-300"}`} />
                          <span className="capitalize text-muted-foreground">{key === "none" ? "Not Set" : key}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{val}</span>
                          <span className="text-xs text-muted-foreground">
                            ({total > 0 ? Math.round((val / total) * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Monthly Company Registrations (Last 6 months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : data?.monthlyGrowth?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available.</p>
          ) : (
            <div className="space-y-3">
              {data?.monthlyGrowth?.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{formatMonth(m.month)}</span>
                  <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full flex items-center px-2 transition-all"
                      style={{ width: `${Math.max((m.count / maxMonth) * 100, m.count > 0 ? 5 : 0)}%` }}
                    >
                      {m.count > 0 && (
                        <span className="text-xs text-primary-foreground font-medium">{m.count}</span>
                      )}
                    </div>
                  </div>
                  {m.count === 0 && <span className="text-xs text-muted-foreground">0</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
