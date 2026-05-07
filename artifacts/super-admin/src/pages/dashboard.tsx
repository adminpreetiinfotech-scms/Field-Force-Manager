import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, Users, UserCheck, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface DashboardData {
  totalCompanies: number;
  activeCompanies: number;
  totalStaff: number;
  totalCandidates: number;
  recentCompanies: Array<{
    id: string;
    name: string;
    status: string;
    subscriptionActive: boolean;
    plan: string;
    createdAt: string;
  }>;
}

interface Company {
  id: string;
  name: string;
}

interface Center {
  id: string;
  name: string;
  companyName?: string;
}

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: number | undefined; icon: React.ElementType; sub?: string }) {
  return (
    <Card data-testid={`card-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            {value === undefined ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-3xl font-bold text-foreground mt-1">{value.toLocaleString()}</p>
            )}
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: dash, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ["super-admin-dashboard"],
    queryFn: () => apiFetch("/super-admin/dashboard"),
  });

  const { data: pendingCompanies } = useQuery<Company[]>({
    queryKey: ["super-admin-pending-companies"],
    queryFn: () => apiFetch("/super-admin/pending-companies"),
  });

  const { data: pendingCenters } = useQuery<Center[]>({
    queryKey: ["super-admin-pending-centers"],
    queryFn: () => apiFetch("/super-admin/pending-centers"),
  });

  const pendingCount = (pendingCompanies?.length ?? 0) + (pendingCenters?.length ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform-wide overview</p>
      </div>

      {pendingCount > 0 && (
        <Link href="/pending">
          <div
            data-testid="alert-pending-approvals"
            className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
          >
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              {pendingCount} item{pendingCount !== 1 ? "s" : ""} awaiting approval —{" "}
              {pendingCompanies?.length ?? 0} {pendingCompanies?.length === 1 ? "company" : "companies"},{" "}
              {pendingCenters?.length ?? 0} {pendingCenters?.length === 1 ? "center" : "centers"}
            </p>
            <span className="ml-auto text-xs text-amber-700 font-medium">Review →</span>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Companies"
          value={dashLoading ? undefined : dash?.totalCompanies}
          icon={Building2}
          sub={`${dash?.activeCompanies ?? 0} active`}
        />
        <StatCard
          label="Total Staff"
          value={dashLoading ? undefined : dash?.totalStaff}
          icon={Users}
        />
        <StatCard
          label="Candidates"
          value={dashLoading ? undefined : dash?.totalCandidates}
          icon={UserCheck}
        />
        <StatCard
          label="Pending"
          value={pendingCount}
          icon={Clock}
          sub="awaiting approval"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Companies</CardTitle>
            <Link href="/companies" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dashLoading ? (
            <div className="px-6 pb-4 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : dash?.recentCompanies?.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">No companies yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {dash?.recentCompanies?.map((c) => (
                <Link key={c.id} href={`/companies/${c.id}`}>
                  <div
                    data-testid={`row-recent-company-${c.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-medium truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={c.plan === "premium" ? "default" : "secondary"} className="text-xs capitalize">
                        {c.plan}
                      </Badge>
                      {c.subscriptionActive ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
