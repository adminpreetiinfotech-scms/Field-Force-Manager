import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, Zap, CheckCircle2, AlertTriangle, XCircle,
  CalendarClock, Building2, ExternalLink, Search, RefreshCw,
} from "lucide-react";
import { format, addDays, differenceInDays, isPast } from "date-fns";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getAdminPhone(): string {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return (JSON.parse(raw) as { phone?: string }).phone ?? "";
  } catch { return ""; }
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

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic", standard: "Standard", premium: "Premium",
};
const PLAN_COLORS: Record<string, string> = {
  basic: "bg-slate-100 text-slate-700 border-slate-200",
  standard: "bg-blue-100 text-blue-700 border-blue-200",
  premium: "bg-violet-100 text-violet-700 border-violet-200",
};
const PAYMENT_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  expired: "bg-red-100 text-red-700 border-red-200",
};

type Company = {
  id: string;
  name: string;
  status: string;
  subscriptionActive: boolean;
  plan: string | null;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  paymentStatus: string | null;
  isSubscriptionExpired: boolean;
  district: string | null;
  state: string | null;
  projectName: string | null;
};

type SubFilter = "all" | "active" | "expiring" | "expired" | "no_sub";

// ─── Set Subscription Dialog ──────────────────────────────────────────────────

function SetSubscriptionDialog({
  company, onClose, onSuccess,
}: {
  company: Company;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [plan, setPlan] = useState<string>(company.plan ?? "basic");
  const [startDate, setStartDate] = useState(
    company.subscriptionStartDate
      ? format(new Date(company.subscriptionStartDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    company.subscriptionEndDate
      ? format(new Date(company.subscriptionEndDate), "yyyy-MM-dd")
      : format(addDays(new Date(), 365), "yyyy-MM-dd")
  );
  const [paymentStatus, setPaymentStatus] = useState<string>(company.paymentStatus ?? "paid");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!startDate || !endDate) {
      toast({ title: "Dono dates zaroori hain", variant: "destructive" }); return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast({ title: "End date, start date ke baad honi chahiye", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const res = await adminFetch(`/api/super-admin/companies/${company.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          plan,
          subscriptionStartDate: new Date(startDate).toISOString(),
          subscriptionEndDate: new Date(endDate).toISOString(),
          paymentStatus,
          subscriptionActive: true,
        }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any).title ?? "Failed");
      toast({ title: "Subscription update ho gaya" });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: String(e.message), variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Subscription Set Karein — {company.name}
          </DialogTitle>
          <DialogDescription>Plan, dates aur payment status configure karein.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Payment Status</Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Subscription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Company Row ──────────────────────────────────────────────────────────────

function CompanyRow({
  company, onSetSub,
}: {
  company: Company;
  onSetSub: (c: Company) => void;
}) {
  const [, setLocation] = useLocation();
  const endDate = company.subscriptionEndDate ? new Date(company.subscriptionEndDate) : null;
  const isExpired = company.isSubscriptionExpired || (endDate !== null && isPast(endDate));
  const daysLeft = endDate ? differenceInDays(endDate, new Date()) : null;
  const expiringSOon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

  let statusIcon = <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  let statusText = "Active";
  let statusClass = "text-emerald-700";
  if (!company.subscriptionActive || !company.plan) {
    statusIcon = <XCircle className="h-4 w-4 text-slate-400" />;
    statusText = "No Sub";
    statusClass = "text-slate-500";
  } else if (isExpired) {
    statusIcon = <XCircle className="h-4 w-4 text-red-500" />;
    statusText = "Expired";
    statusClass = "text-red-600";
  } else if (expiringSOon) {
    statusIcon = <AlertTriangle className="h-4 w-4 text-amber-500" />;
    statusText = `${daysLeft}d left`;
    statusClass = "text-amber-600";
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b last:border-0 hover:bg-muted/30 transition-colors">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
        {company.name.slice(0, 2).toUpperCase()}
      </div>

      {/* Name + location */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{company.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {[company.projectName, company.district, company.state].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>

      {/* Plan badge */}
      <div className="w-24 flex justify-center">
        {company.plan ? (
          <Badge variant="outline" className={`text-xs ${PLAN_COLORS[company.plan] ?? ""}`}>
            <Zap className="h-2.5 w-2.5 mr-1" />
            {PLAN_LABELS[company.plan] ?? company.plan}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Payment */}
      <div className="w-20 flex justify-center">
        {company.paymentStatus ? (
          <Badge variant="outline" className={`text-xs ${PAYMENT_COLORS[company.paymentStatus] ?? ""}`}>
            {company.paymentStatus.charAt(0).toUpperCase() + company.paymentStatus.slice(1)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Expiry */}
      <div className="w-28 text-xs text-right">
        {endDate ? (
          <span className={isExpired ? "text-red-600 font-medium" : expiringSOon ? "text-amber-600 font-medium" : "text-muted-foreground"}>
            {format(endDate, "dd MMM yyyy")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      {/* Status */}
      <div className={`w-24 flex items-center gap-1.5 justify-center text-xs font-medium ${statusClass}`}>
        {statusIcon}
        {statusText}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => onSetSub(company)}>
          <CreditCard className="h-3 w-3 mr-1" />
          Set
        </Button>
        <Button
          size="sm" variant="ghost" className="h-7 w-7 p-0"
          onClick={() => setLocation(`/super-admin/companies/${company.id}`)}
          title="Company detail"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuperAdminSubscriptions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<SubFilter>("all");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const { data: companies = [], isLoading, refetch } = useQuery<Company[]>({
    queryKey: ["super-admin-companies"],
    queryFn: async () => {
      const res = await adminFetch("/api/super-admin/companies");
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<Company[]>;
    },
  });

  // ─── derive stats ───────────────────────────────────────────────────────────
  const stats = companies.reduce(
    (acc, c) => {
      const endDate = c.subscriptionEndDate ? new Date(c.subscriptionEndDate) : null;
      const expired = c.isSubscriptionExpired || (endDate !== null && isPast(endDate));
      const daysLeft = endDate ? differenceInDays(endDate, new Date()) : null;
      const expiringSOon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && !expired;
      if (!c.subscriptionActive || !c.plan) { acc.noSub++; }
      else if (expired) { acc.expired++; }
      else if (expiringSOon) { acc.expiring++; acc.active++; }
      else { acc.active++; }
      return acc;
    },
    { active: 0, expiring: 0, expired: 0, noSub: 0 }
  );

  // ─── filtering ──────────────────────────────────────────────────────────────
  const filtered = companies.filter(c => {
    const endDate = c.subscriptionEndDate ? new Date(c.subscriptionEndDate) : null;
    const expired = c.isSubscriptionExpired || (endDate !== null && isPast(endDate));
    const daysLeft = endDate ? differenceInDays(endDate, new Date()) : null;
    const expiringSOon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && !expired;
    const noSub = !c.subscriptionActive || !c.plan;

    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (planFilter !== "all" && c.plan !== planFilter) return false;
    if (statusFilter === "active" && (noSub || expired)) return false;
    if (statusFilter === "expiring" && !expiringSOon) return false;
    if (statusFilter === "expired" && !expired) return false;
    if (statusFilter === "no_sub" && !noSub) return false;
    return true;
  });

  const handleSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ["super-admin-companies"] });
    toast({ title: "Subscription update ho gaya" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            Subscription Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sabhi companies ke subscription manage karein
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            label="Active Subscriptions"
            value={stats.active}
            color="border-emerald-200 bg-emerald-50"
            onClick={() => setStatusFilter("active")}
            active={statusFilter === "active"}
          />
          <SummaryCard
            icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
            label="Expiring in 30 Days"
            value={stats.expiring}
            color="border-amber-200 bg-amber-50"
            onClick={() => setStatusFilter("expiring")}
            active={statusFilter === "expiring"}
          />
          <SummaryCard
            icon={<XCircle className="h-5 w-5 text-red-500" />}
            label="Expired"
            value={stats.expired}
            color="border-red-200 bg-red-50"
            onClick={() => setStatusFilter("expired")}
            active={statusFilter === "expired"}
          />
          <SummaryCard
            icon={<CalendarClock className="h-5 w-5 text-slate-400" />}
            label="No Subscription"
            value={stats.noSub}
            color="border-slate-200 bg-slate-50"
            onClick={() => setStatusFilter("no_sub")}
            active={statusFilter === "no_sub"}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Company naam se search karein…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as SubFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expiring">Expiring Soon</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="no_sub">No Subscription</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || planFilter !== "all" || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setPlanFilter("all"); setSearch(""); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="w-9 shrink-0" />
          <div className="flex-1">Company</div>
          <div className="w-24 text-center">Plan</div>
          <div className="w-20 text-center">Payment</div>
          <div className="w-28 text-right">Expiry</div>
          <div className="w-24 text-center">Status</div>
          <div className="w-20 shrink-0" />
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center text-muted-foreground gap-2">
            <Building2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">Koi company nahi mili</p>
            {(search || statusFilter !== "all" || planFilter !== "all") && (
              <p className="text-xs">Filter hata ke dobara try karein</p>
            )}
          </div>
        ) : (
          filtered.map(c => (
            <CompanyRow key={c.id} company={c} onSetSub={setSelectedCompany} />
          ))
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 bg-muted/20 border-t text-xs text-muted-foreground">
            {filtered.length} of {companies.length} companies
          </div>
        )}
      </div>

      {/* Set subscription dialog */}
      {selectedCompany && (
        <SetSubscriptionDialog
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon, label, value, color, onClick, active,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${color} ${active ? "ring-2 ring-primary/40 shadow-sm" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        {icon}
        {active && <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Filtered</span>}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
    </button>
  );
}
