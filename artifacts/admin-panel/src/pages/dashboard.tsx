import { useGetDashboardStats } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Users, UserCheck, Clock, XCircle, UserSquare2,
  TrendingUp, Calendar, AlertCircle, ArrowRight,
  CheckCircle2, Activity, Award, AlertTriangle,
  Building2, UserX, ShieldAlert,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useEffect, useState } from "react";

interface SubscriptionInfo {
  plan: string | null;
  subscriptionActive: boolean;
  subscriptionEndDate: string | null;
  paymentStatus: string | null;
  isSubscriptionExpired: boolean;
  daysUntilExpiry: number | null;
}

function getAdminPhone(): string {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return (JSON.parse(raw) as { phone?: string }).phone ?? "";
  } catch { return ""; }
}

function SubscriptionWarning({ info }: { info: SubscriptionInfo }) {
  const { isSubscriptionExpired, daysUntilExpiry, subscriptionEndDate } = info;
  if (!subscriptionEndDate) return null;
  if (isSubscriptionExpired) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5">
        <XCircle className="h-5 w-5 text-red-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700">Subscription Expired</p>
          <p className="text-xs text-red-600 mt-0.5">
            Staff login and field operations are blocked. Contact your system admin to renew.
          </p>
        </div>
      </div>
    );
  }
  if (daysUntilExpiry !== null && daysUntilExpiry <= 1) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5">
        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700">Subscription Expires Tomorrow!</p>
          <p className="text-xs text-red-600 mt-0.5">
            Expires on {format(new Date(subscriptionEndDate), "dd MMM yyyy")}. Contact admin immediately to avoid disruption.
          </p>
        </div>
      </div>
    );
  }
  if (daysUntilExpiry !== null && daysUntilExpiry <= 3) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-700">Subscription Expiring in {daysUntilExpiry} days</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Expires on {format(new Date(subscriptionEndDate), "dd MMM yyyy")}. Contact admin to extend before operations are disrupted.
          </p>
        </div>
      </div>
    );
  }
  return null;
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
  href,
}: {
  title: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  href?: string;
}) {
  const inner = (
    <div className={`relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow group`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-[0.07] ${accent}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${accent} bg-opacity-15`}>
          <Icon className={`h-5 w-5 ${accent.replace("bg-", "text-")}`} />
        </div>
      </div>
      {href && (
        <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          View details <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-medium tabular-nums">{pct}%</span>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, error } = useGetDashboardStats();
  const today = format(new Date(), "EEEE, MMMM d, yyyy");
  // Use IST date for links to match backend stats day boundaries (IST = UTC+5:30)
  const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    const phone = getAdminPhone();
    if (!phone) return;
    fetch("/api/admin/company/subscription", { headers: { "x-admin-phone": phone } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSubInfo(d); })
      .catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-56 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Failed to load dashboard statistics.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  const totalCandidates = stats.totalCandidates || 0;
  const enrollmentRate = totalCandidates > 0
    ? Math.round(((stats.verifiedCandidates + stats.enrolledCandidates) / totalCandidates) * 100)
    : 0;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Subscription warning — shown only when subscription is expiring/expired */}
      {subInfo && <SubscriptionWarning info={subInfo} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/candidates">
              <UserSquare2 className="h-4 w-4 mr-1.5" /> Candidates
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/staff">
              <Users className="h-4 w-4 mr-1.5" /> Manage Staff
            </Link>
          </Button>
        </div>
      </div>

      {/* Candidate Stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <UserSquare2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Candidates</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Candidates"
            value={stats.totalCandidates}
            icon={UserSquare2}
            accent="bg-blue-500"
            href="/candidates"
          />
          <StatCard
            title="Verified / Enrolled"
            value={stats.verifiedCandidates + stats.enrolledCandidates}
            sub={`${stats.verifiedCandidates} verified · ${stats.enrolledCandidates} enrolled`}
            icon={CheckCircle2}
            accent="bg-emerald-500"
            href="/candidates"
          />
          <StatCard
            title="Pending Review"
            value={stats.pendingCandidates}
            sub={stats.pendingCandidates > 0 ? "Action required" : "All clear"}
            icon={Clock}
            accent="bg-amber-500"
            href="/candidates"
          />
          <StatCard
            title="Rejected"
            value={stats.rejectedCandidates}
            icon={XCircle}
            accent="bg-red-500"
            href="/candidates"
          />
        </div>
      </div>

      {/* Staff Stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Field Staff</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Staff"
            value={stats.totalStaff}
            sub={`${stats.activeStaff} active`}
            icon={Users}
            accent="bg-violet-500"
            href="/staff"
          />
          <StatCard
            title="Pending Approvals"
            value={stats.pendingApprovals}
            sub={stats.pendingApprovals > 0 ? "Review needed" : "No pending requests"}
            icon={AlertCircle}
            accent="bg-orange-500"
            href="/staff"
          />
          <StatCard
            title="Registered Today"
            value={stats.todayRegistrations}
            icon={TrendingUp}
            accent="bg-sky-500"
          />
          <StatCard
            title="This Month"
            value={stats.thisMonthRegistrations}
            sub="New registrations"
            icon={Calendar}
            accent="bg-pink-500"
          />
        </div>
      </div>

      {/* Center Staff Attendance */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Center Staff — Today</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Present Today"
            value={stats.centerPresentToday}
            sub="Checked in at center"
            icon={UserCheck}
            accent="bg-emerald-500"
            href={`/center-attendance?dateFrom=${todayIST}&dateTo=${todayIST}`}
          />
          <StatCard
            title="Absent Today"
            value={stats.centerAbsentToday}
            sub={stats.centerAbsentToday > 0 ? "No check-in recorded" : "All present"}
            icon={UserX}
            accent="bg-red-500"
            href={`/center-attendance?dateFrom=${todayIST}&dateTo=${todayIST}`}
          />
          <StatCard
            title="Geofence Violations"
            value={stats.centerViolationsToday}
            sub={stats.centerViolationsToday > 0 ? "Checked in outside zone" : "No violations"}
            icon={ShieldAlert}
            accent="bg-amber-500"
            href={`/center-attendance?dateFrom=${todayIST}&dateTo=${todayIST}`}
          />
        </div>
      </div>

      {/* Bottom row: Candidate funnel + Quick actions */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Candidate Funnel */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Candidate Pipeline</h3>
            {totalCandidates > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">{enrollmentRate}% conversion rate</span>
            )}
          </div>
          {totalCandidates === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No candidates yet.</p>
          ) : (
            <div className="space-y-4">
              {[
                { label: "Enrolled",  value: stats.enrolledCandidates,  color: "bg-emerald-500" },
                { label: "Verified",  value: stats.verifiedCandidates,  color: "bg-blue-500" },
                { label: "Pending",   value: stats.pendingCandidates,   color: "bg-amber-400" },
                { label: "Rejected",  value: stats.rejectedCandidates,  color: "bg-red-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{label}</span>
                    <span className="tabular-nums text-muted-foreground">{value} / {totalCandidates}</span>
                  </div>
                  <ProgressBar value={value} max={totalCandidates} color={color} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Award className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Quick Actions</h3>
          </div>
          <div className="space-y-2">
            {[
              { href: "/candidates", icon: UserSquare2, label: "Review Pending Candidates", badge: stats.pendingCandidates, color: "text-amber-600" },
              { href: "/staff",      icon: Users,        label: "Approve Staff Requests",    badge: stats.pendingApprovals,  color: "text-orange-600" },
              { href: "/reports",    icon: TrendingUp,   label: "Download Ride Reports",     badge: null, color: "text-sky-600" },
              { href: "/candidates", icon: UserCheck,    label: "View Verified Candidates",  badge: stats.verifiedCandidates, color: "text-emerald-600" },
            ].map(({ href, icon: Icon, label, badge, color }) => (
              <Link key={href + label} href={href}>
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer group">
                  <div className={`p-2 rounded-md bg-muted group-hover:bg-background ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  {badge != null && badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {badge}
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
