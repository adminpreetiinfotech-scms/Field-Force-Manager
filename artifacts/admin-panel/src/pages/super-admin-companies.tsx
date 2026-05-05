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
  User, CalendarDays, CreditCard, Clock, Check, X
} from "lucide-react";
import { format } from "date-fns";

type Company = {
  id: string;
  name: string;
  adminName?: string | null;
  phone?: string | null;
  projectName?: string | null;
  state?: string | null;
  district?: string | null;
  status: string;
  subscriptionActive: boolean;
  createdAt?: string | null;
  approvalStatus?: string | null;
  contactPersonName?: string | null;
  officeAddress?: string | null;
  pinCode?: string | null;
};

type PendingCenter = {
  id: string;
  companyId: string;
  companyName?: string | null;
  name: string;
  tcId?: string | null;
  state?: string | null;
  district?: string | null;
  block?: string | null;
  approvalStatus?: string | null;
  createdAt?: string | null;
};

const API_BASE = "/api";

function getAdminPhone(): string {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return (JSON.parse(raw) as { phone?: string }).phone ?? "";
  } catch { return ""; }
}

async function approveCompany(id: string, action: "approve" | "reject", phone: string) {
  const res = await fetch(`${API_BASE}/super-admin/companies/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-phone": phone },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.title ?? `Failed to ${action} company`);
  }
  return res.json();
}

async function approveCenter(id: string, action: "approve" | "reject", phone: string) {
  const res = await fetch(`${API_BASE}/super-admin/centers/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-phone": phone },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.title ?? `Failed to ${action} center`);
  }
  return res.json();
}

function usePendingCompanies(phone: string) {
  const [data, setData] = useState<Company[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/super-admin/pending-companies`, {
        headers: { "x-admin-phone": phone },
      });
      if (!res.ok) throw new Error("Failed to fetch pending companies");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch };
}

function usePendingCenters(phone: string) {
  const [data, setData] = useState<PendingCenter[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/super-admin/pending-centers`, {
        headers: { "x-admin-phone": phone },
      });
      if (!res.ok) throw new Error("Failed to fetch pending centers");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch };
}

type Tab = "all" | "pending-companies" | "pending-centers";

export default function SuperAdminCompanies() {
  const { data: companies, isLoading, error, refetch } = useListCompanies();
  const updateCompany = useUpdateCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const adminPhone = getAdminPhone();

  const pendingCompaniesHook = usePendingCompanies(adminPhone);
  const pendingCentersHook = usePendingCenters(adminPhone);

  // Load pending data when tab switches
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "pending-companies" && !pendingCompaniesHook.data) {
      pendingCompaniesHook.refetch();
    }
    if (tab === "pending-centers" && !pendingCentersHook.data) {
      pendingCentersHook.refetch();
    }
  };

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

  const handleCompanyAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(`company-${id}-${action}`);
    try {
      await approveCompany(id, action, adminPhone);
      toast({ title: action === "approve" ? "Company approved!" : "Company rejected" });
      pendingCompaniesHook.refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCenterAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(`center-${id}-${action}`);
    try {
      await approveCenter(id, action, adminPhone);
      toast({ title: action === "approve" ? "Center approved!" : "Center rejected" });
      pendingCentersHook.refetch();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
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

  const activeCount   = (companies ?? []).filter(c => c.status === "active").length;
  const noSubCount    = (companies ?? []).filter(c => !c.subscriptionActive).length;
  const pendingCount  = (companies ?? []).filter(c => (c as any).approvalStatus === "pending").length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies & Approvals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage registered organizations and approve pending requests
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetch(); pendingCompaniesHook.refetch(); pendingCentersHook.refetch(); }} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-0">
        {([
          { key: "all", label: "All Companies", icon: Building2 },
          { key: "pending-companies", label: "Pending Companies", icon: Clock, badge: pendingCount },
          { key: "pending-centers", label: "Pending Centers", icon: Clock },
        ] as { key: Tab; label: string; icon: any; badge?: number }[]).map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {badge !== undefined && badge > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold px-1.5 py-0.5 min-w-[20px] text-center">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: All Companies ─────────────────────────────────────────────────── */}
      {activeTab === "all" && (
        <>
          {/* Summary strip */}
          {!isLoading && !error && companies && companies.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total",    value: companies.length, icon: Building2,    color: "text-blue-600",   bg: "bg-blue-50" },
                { label: "Active",   value: activeCount,      icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "No Sub",   value: noSubCount,       icon: AlertTriangle,color: "text-amber-600",  bg: "bg-amber-50" },
                { label: "Pending",  value: pendingCount,     icon: Clock,        color: "text-orange-600", bg: "bg-orange-50" },
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

          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-muted-foreground">Failed to load companies. Make sure you are logged in as Super Admin.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Try Again</Button>
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">
                {search ? "No companies match your search." : "No companies registered yet."}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {filtered.map((company) => {
              const c = company as Company;
              const isActive = c.status === "active";
              const hasSub   = c.subscriptionActive;
              const isPending = (c as any).approvalStatus === "pending";
              return (
                <div
                  key={c.id}
                  className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className={`h-1 w-full ${isPending ? "bg-amber-400" : isActive && hasSub ? "bg-emerald-500" : isActive ? "bg-amber-400" : "bg-slate-300"}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4 flex-1 min-w-0">
                        <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-sm font-bold text-white
                          ${isPending ? "bg-amber-400" : isActive && hasSub ? "bg-emerald-500" : isActive ? "bg-amber-400" : "bg-slate-400"}`}>
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="font-semibold text-base truncate">{c.name}</h2>
                            {isPending && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                <Clock className="h-3 w-3 mr-1" /> Pending Approval
                              </Badge>
                            )}
                            {!isPending && (
                              <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                                {isActive ? "Active" : "Inactive"}
                              </Badge>
                            )}
                            {!hasSub && (
                              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">No Subscription</Badge>
                            )}
                          </div>
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                            {c.projectName && (
                              <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3 shrink-0" /> {c.projectName}</span>
                            )}
                            {(c.district || c.state) && (
                              <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0" />{[c.district, c.state].filter(Boolean).join(", ")}</span>
                            )}
                            {c.adminName && (
                              <span className="flex items-center gap-1.5"><User className="h-3 w-3 shrink-0" />{c.adminName}{c.phone ? ` · ${c.phone}` : ""}</span>
                            )}
                            {c.createdAt && (
                              <span className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3 shrink-0" />Registered {format(new Date(c.createdAt), "dd MMM yyyy")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Link href={`/super-admin/companies/${c.id}`}>
                        <Button variant="outline" size="sm" className="shrink-0 gap-1">
                          Details <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                    <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2.5">
                        <Switch checked={isActive} onCheckedChange={() => handleToggleStatus(c.id, c.status)} disabled={updateCompany.isPending} />
                        <span className="text-xs font-medium text-muted-foreground">Company {isActive ? "Active" : "Inactive"}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        <Switch checked={hasSub} onCheckedChange={() => handleToggleSubscription(c.id, hasSub)} disabled={updateCompany.isPending} />
                        <span className="text-xs font-medium text-muted-foreground">Subscription {hasSub ? "Active" : "Off"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── TAB: Pending Companies ─────────────────────────────────────────────── */}
      {activeTab === "pending-companies" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Neeche companies hain jo Super Admin approval ka wait kar rahi hain.
            </p>
            <Button variant="outline" size="sm" onClick={pendingCompaniesHook.refetch} disabled={pendingCompaniesHook.loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${pendingCompaniesHook.loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {pendingCompaniesHook.loading && (
            <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
          )}

          {pendingCompaniesHook.error && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{pendingCompaniesHook.error}</p>
              <Button variant="outline" size="sm" onClick={pendingCompaniesHook.refetch}>Try Again</Button>
            </div>
          )}

          {!pendingCompaniesHook.loading && pendingCompaniesHook.data?.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 opacity-60" />
              <p className="text-muted-foreground text-sm">Koi pending company nahi hai. Sab clear!</p>
            </div>
          )}

          <div className="space-y-4">
            {(pendingCompaniesHook.data ?? []).map((company) => (
              <div key={company.id} className="rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-amber-400" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4 flex-1 min-w-0">
                      <div className="shrink-0 w-11 h-11 rounded-lg bg-amber-400 flex items-center justify-center text-sm font-bold text-white">
                        {company.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="font-semibold text-base">{company.name}</h2>
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            <Clock className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          {company.projectName && <span><strong>Scheme:</strong> {company.projectName}</span>}
                          {(company.district || company.state) && <span><MapPin className="inline h-3 w-3 mr-1" />{[company.district, company.state].filter(Boolean).join(", ")}</span>}
                          {company.adminName && <span><User className="inline h-3 w-3 mr-1" />{company.adminName}{company.phone ? ` · ${company.phone}` : ""}</span>}
                          {(company as any).contactPersonName && <span><strong>Contact:</strong> {(company as any).contactPersonName}</span>}
                          {(company as any).officeAddress && <span><strong>Address:</strong> {(company as any).officeAddress}</span>}
                          {company.createdAt && <span><CalendarDays className="inline h-3 w-3 mr-1" />Submitted {format(new Date(company.createdAt), "dd MMM yyyy, HH:mm")}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-amber-200 flex gap-3">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                      onClick={() => handleCompanyAction(company.id, "approve")}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === `company-${company.id}-approve` ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Approve Company
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 gap-1.5"
                      onClick={() => handleCompanyAction(company.id, "reject")}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === `company-${company.id}-reject` ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Reject
                    </Button>
                    <Link href={`/super-admin/companies/${company.id}`}>
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                        Details <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TAB: Pending Centers ───────────────────────────────────────────────── */}
      {activeTab === "pending-centers" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Training centers jo approval ka wait kar rahe hain.
            </p>
            <Button variant="outline" size="sm" onClick={pendingCentersHook.refetch} disabled={pendingCentersHook.loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${pendingCentersHook.loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {pendingCentersHook.loading && (
            <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          )}

          {pendingCentersHook.error && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{pendingCentersHook.error}</p>
              <Button variant="outline" size="sm" onClick={pendingCentersHook.refetch}>Try Again</Button>
            </div>
          )}

          {!pendingCentersHook.loading && pendingCentersHook.data?.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 opacity-60" />
              <p className="text-muted-foreground text-sm">Koi pending center nahi hai. Sab clear!</p>
            </div>
          )}

          <div className="space-y-4">
            {(pendingCentersHook.data ?? []).map((center) => (
              <div key={center.id} className="rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-amber-400" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4 flex-1 min-w-0">
                      <div className="shrink-0 w-11 h-11 rounded-lg bg-blue-500 flex items-center justify-center text-sm font-bold text-white">
                        {center.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="font-semibold text-base">{center.name}</h2>
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            <Clock className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          {center.companyName && <span><Building2 className="inline h-3 w-3 mr-1" />{center.companyName}</span>}
                          {center.tcId && <span><strong>TC ID:</strong> {center.tcId}</span>}
                          {[center.block, center.district, center.state].filter(Boolean).join(", ") && (
                            <span><MapPin className="inline h-3 w-3 mr-1" />{[center.block, center.district, center.state].filter(Boolean).join(", ")}</span>
                          )}
                          {center.createdAt && <span><CalendarDays className="inline h-3 w-3 mr-1" />Submitted {format(new Date(center.createdAt), "dd MMM yyyy, HH:mm")}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-amber-200 flex gap-3">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                      onClick={() => handleCenterAction(center.id, "approve")}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === `center-${center.id}-approve` ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Approve Center
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 gap-1.5"
                      onClick={() => handleCenterAction(center.id, "reject")}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === `center-${center.id}-reject` ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
