import { useState } from "react";
import { useListCompanies, useUpdateCompany } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, ChevronRight, RefreshCw, Search,
  CheckCircle2, XCircle, AlertTriangle, MapPin,
  User, CalendarDays, CreditCard
} from "lucide-react";
import { format } from "date-fns";

export default function SuperAdminCompanies() {
  const { data: companies, isLoading, error, refetch } = useListCompanies();
  const updateCompany = useUpdateCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const handleToggleStatus = async (companyId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      await updateCompany.mutateAsync({ companyId, data: { status: newStatus as "active" | "inactive" } });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
      toast({ title: `Company ${newStatus === "active" ? "activated" : "deactivated"}` });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleToggleSubscription = async (companyId: string, current: boolean) => {
    try {
      await updateCompany.mutateAsync({ companyId, data: { subscriptionActive: !current } });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
      toast({ title: `Subscription ${!current ? "activated" : "deactivated"}` });
    } catch {
      toast({ title: "Failed to update subscription", variant: "destructive" });
    }
  };

  const filtered = (companies ?? []).filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.projectName ?? "").toLowerCase().includes(q) ||
      (c.state ?? "").toLowerCase().includes(q) ||
      (c.district ?? "").toLowerCase().includes(q) ||
      (c.adminName ?? "").toLowerCase().includes(q)
    );
  });

  const activeCount  = (companies ?? []).filter(c => c.status === "active").length;
  const inactiveCount = (companies ?? []).filter(c => c.status !== "active").length;
  const noSubCount   = (companies ?? []).filter(c => !c.subscriptionActive).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Companies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage registered organizations and their subscriptions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary strip */}
      {!isLoading && !error && companies && companies.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total",    value: companies.length, icon: Building2,    color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/30" },
            { label: "Active",   value: activeCount,      icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { label: "No Sub",   value: noSubCount,       icon: AlertTriangle,color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950/30" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
              <div>
                <p className="text-xl font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by company, project, location or admin..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">Failed to load companies. Make sure you are logged in as Super Admin.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try Again</Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground text-sm">
            {search ? "No companies match your search." : "No companies registered yet."}
          </p>
        </div>
      )}

      {/* Company cards */}
      <div className="space-y-3">
        {filtered.map((company) => {
          const isActive = company.status === "active";
          const hasSub   = company.subscriptionActive;
          return (
            <div
              key={company.id}
              className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              {/* Top accent line */}
              <div className={`h-1 w-full ${isActive && hasSub ? "bg-emerald-500" : isActive ? "bg-amber-400" : "bg-slate-300"}`} />

              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: info */}
                  <div className="flex gap-4 flex-1 min-w-0">
                    {/* Icon */}
                    <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-sm font-bold text-white
                      ${isActive && hasSub ? "bg-emerald-500" : isActive ? "bg-amber-400" : "bg-slate-400"}`}>
                      {company.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-base truncate">{company.name}</h2>
                        <Badge
                          variant={isActive ? "default" : "secondary"}
                          className={isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </Badge>
                        {!hasSub && (
                          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                            No Subscription
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        {company.projectName && (
                          <span className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3 shrink-0" /> {company.projectName}
                          </span>
                        )}
                        {(company.district || company.state) && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {[company.district, company.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {company.adminName && (
                          <span className="flex items-center gap-1.5">
                            <User className="h-3 w-3 shrink-0" />
                            {company.adminName}{company.phone ? ` · ${company.phone}` : ""}
                          </span>
                        )}
                        {company.createdAt && (
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3 w-3 shrink-0" />
                            Registered {format(new Date(company.createdAt), "dd MMM yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details button */}
                  <Link href={`/super-admin/companies/${company.id}`}>
                    <Button variant="outline" size="sm" className="shrink-0 gap-1">
                      Details <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>

                {/* Controls */}
                <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2.5">
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => handleToggleStatus(company.id, company.status)}
                      disabled={updateCompany.isPending}
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      Company {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    <Switch
                      checked={hasSub}
                      onCheckedChange={() => handleToggleSubscription(company.id, hasSub)}
                      disabled={updateCompany.isPending}
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      Subscription {hasSub ? "Active" : "Off"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
