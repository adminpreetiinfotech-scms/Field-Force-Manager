import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CheckCircle2, XCircle, AlertCircle, Clock, CreditCard, Search, CalendarDays
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface Company {
  id: string;
  name: string;
  plan: "basic" | "standard" | "premium";
  status: "active" | "inactive";
  subscriptionActive: boolean;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  paymentStatus?: "paid" | "pending" | "expired";
  approvalStatus: string;
  adminName?: string;
  state?: string;
  district?: string;
}

function daysLeft(dateStr?: string): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function SubBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-muted-foreground">No end date</span>;
  if (days < 0) return <Badge variant="destructive" className="text-xs">Expired {Math.abs(days)}d ago</Badge>;
  if (days <= 7) return <Badge className="text-xs bg-red-500 hover:bg-red-600">{days}d left</Badge>;
  if (days <= 30) return <Badge className="text-xs bg-amber-500 hover:bg-amber-600">{days}d left</Badge>;
  return <Badge variant="outline" className="text-xs text-green-700 border-green-300">{days}d left</Badge>;
}

function PaymentBadge({ status }: { status?: string }) {
  if (status === "paid") return <Badge className="text-xs bg-green-600 hover:bg-green-700">Paid</Badge>;
  if (status === "expired") return <Badge variant="destructive" className="text-xs">Expired</Badge>;
  if (status === "pending") return <Badge className="text-xs bg-amber-500 hover:bg-amber-600">Pending</Badge>;
  return <span className="text-xs text-muted-foreground">—</span>;
}

export default function SubscriptionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterExpiry, setFilterExpiry] = useState("all");

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["super-admin-companies"],
    queryFn: () => apiFetch("/super-admin/companies"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiFetch(`/super-admin/companies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-companies"] });
      toast({ title: "Subscription updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const filtered = (companies ?? []).filter((c) => {
    const q = search.toLowerCase();
    if (q && !c.name.toLowerCase().includes(q) && !(c.adminName ?? "").toLowerCase().includes(q)) return false;
    if (filterPlan !== "all" && c.plan !== filterPlan) return false;
    if (filterPayment !== "all" && c.paymentStatus !== filterPayment) return false;
    if (filterExpiry !== "all") {
      const days = daysLeft(c.subscriptionEndDate);
      if (filterExpiry === "expired" && (days === null || days >= 0)) return false;
      if (filterExpiry === "week" && (days === null || days < 0 || days > 7)) return false;
      if (filterExpiry === "month" && (days === null || days < 0 || days > 30)) return false;
      if (filterExpiry === "active" && (days === null || days < 0)) return false;
    }
    return true;
  });

  // Summary stats
  const total = companies?.length ?? 0;
  const activeCount = companies?.filter(c => c.subscriptionActive).length ?? 0;
  const expiredCount = companies?.filter(c => {
    const d = daysLeft(c.subscriptionEndDate);
    return d !== null && d < 0;
  }).length ?? 0;
  const expiringCount = companies?.filter(c => {
    const d = daysLeft(c.subscriptionEndDate);
    return d !== null && d >= 0 && d <= 30;
  }).length ?? 0;
  const pendingPayment = companies?.filter(c => c.paymentStatus === "pending").length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage all tenant plans and billing status</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active", value: activeCount, icon: CheckCircle2, color: "text-green-500" },
          { label: "Expiring (30d)", value: expiringCount, icon: AlertCircle, color: "text-amber-500" },
          { label: "Expired", value: expiredCount, icon: XCircle, color: "text-red-500" },
          { label: "Payment Due", value: pendingPayment, icon: CreditCard, color: "text-blue-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-card-border rounded-lg p-3 flex items-center gap-3">
            <Icon className={`h-5 w-5 ${color} flex-shrink-0`} />
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold leading-none mt-0.5">{isLoading ? "—" : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterExpiry} onValueChange={setFilterExpiry}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Expiry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Expiry</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="week">Expiring in 7d</SelectItem>
            <SelectItem value="month">Expiring in 30d</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-2 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Company</span>
          <span>Plan</span>
          <span>Subscription</span>
          <span>End Date</span>
          <span>Payment</span>
          <span>Active</span>
        </div>

        {isLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 ml-auto" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-5 w-10" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No companies match filters</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((c) => {
              const days = daysLeft(c.subscriptionEndDate);
              return (
                <div
                  key={c.id}
                  data-testid={`row-sub-${c.id}`}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 sm:gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
                >
                  {/* Company name */}
                  <div className="min-w-0">
                    <Link href={`/companies/${c.id}`}>
                      <p className="text-sm font-medium hover:text-primary transition-colors cursor-pointer truncate">
                        {c.name}
                      </p>
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.adminName, c.state].filter(Boolean).join(" · ")}
                    </p>
                  </div>

                  {/* Plan */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground sm:hidden">Plan: </span>
                    <Select
                      value={c.plan}
                      onValueChange={(val) =>
                        updateMutation.mutate({ id: c.id, data: { plan: val } })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-28 border-0 bg-transparent px-0 focus:ring-0 shadow-none">
                        <Badge
                          variant={c.plan === "premium" ? "default" : c.plan === "standard" ? "secondary" : "outline"}
                          className="text-xs capitalize cursor-pointer"
                        >
                          {c.plan} ▾
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Days remaining */}
                  <div className="flex items-center">
                    <span className="text-xs text-muted-foreground sm:hidden mr-1">Expires: </span>
                    <SubBadge days={days} />
                  </div>

                  {/* End date */}
                  <div>
                    <span className="text-xs text-muted-foreground sm:hidden">End: </span>
                    <span className="text-xs text-muted-foreground">{formatDate(c.subscriptionEndDate)}</span>
                  </div>

                  {/* Payment status */}
                  <div className="flex items-center">
                    <span className="text-xs text-muted-foreground sm:hidden mr-1">Payment: </span>
                    <Select
                      value={c.paymentStatus ?? ""}
                      onValueChange={(val) =>
                        updateMutation.mutate({ id: c.id, data: { paymentStatus: val } })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-0 focus:ring-0 shadow-none w-auto">
                        <span><PaymentBadge status={c.paymentStatus} /> <span className="text-muted-foreground">▾</span></span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Active toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground sm:hidden">Active: </span>
                    <Switch
                      checked={c.subscriptionActive}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({ id: c.id, data: { subscriptionActive: checked } })
                      }
                      className="data-[state=checked]:bg-green-600"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!isLoading && (
        <p className="text-xs text-muted-foreground text-right">
          {filtered.length} of {total} companies
        </p>
      )}
    </div>
  );
}
