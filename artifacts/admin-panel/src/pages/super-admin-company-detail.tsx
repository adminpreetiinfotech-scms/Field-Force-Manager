import { useState } from "react";
import { useGetCompanyStats, useUpdateCompany, useResetCompanyAdmin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, RefreshCw, Users, UserSquare2, Activity,
  KeyRound, MapPin, User, CalendarDays, Mail,
  Building2, CreditCard, ShieldOff, CheckCircle2,
  AlertTriangle, XCircle, Zap, CalendarClock, Plus,
} from "lucide-react";
import { format, addDays, differenceInDays, isPast } from "date-fns";

interface Props {
  companyId: string;
}

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
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

// ─── Set Subscription Dialog ──────────────────────────────────────────────────

function SetSubscriptionDialog({
  companyId,
  currentPlan,
  currentStart,
  currentEnd,
  currentPaymentStatus,
  onClose,
  onSuccess,
}: {
  companyId: string;
  currentPlan: string | null;
  currentStart: string | null;
  currentEnd: string | null;
  currentPaymentStatus: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [plan, setPlan] = useState<string>(currentPlan ?? "basic");
  const [startDate, setStartDate] = useState(
    currentStart ? format(new Date(currentStart), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    currentEnd ? format(new Date(currentEnd), "yyyy-MM-dd") : format(addDays(new Date(), 365), "yyyy-MM-dd")
  );
  const [paymentStatus, setPaymentStatus] = useState<string>(currentPaymentStatus ?? "paid");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!startDate || !endDate) {
      toast({ title: "Both start and end dates are required", variant: "destructive" });
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast({ title: "End date must be after start date", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await adminFetch(`/api/super-admin/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify({
          plan,
          subscriptionStartDate: new Date(startDate).toISOString(),
          subscriptionEndDate: new Date(endDate).toISOString(),
          paymentStatus,
          subscriptionActive: true,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).title ?? "Failed");
      toast({ title: "Subscription updated successfully" });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Set Subscription
          </DialogTitle>
          <DialogDescription>Configure plan, dates, and payment status.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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

// ─── Expiry Banner ────────────────────────────────────────────────────────────

function ExpiryBanner({ endDate, isExpired, daysLeft }: { endDate: string; isExpired: boolean; daysLeft: number }) {
  if (isExpired) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <XCircle className="h-5 w-5 text-red-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-700">Subscription Expired</p>
          <p className="text-xs text-red-600">Expired on {format(new Date(endDate), "dd MMM yyyy")} — Staff login and check-in are blocked.</p>
        </div>
      </div>
    );
  }
  if (daysLeft <= 1) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-700">Expires Tomorrow!</p>
          <p className="text-xs text-red-600">Subscription ends on {format(new Date(endDate), "dd MMM yyyy")}. Extend now to avoid disruption.</p>
        </div>
      </div>
    );
  }
  if (daysLeft <= 3) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-700">Expiring Soon — {daysLeft} days left</p>
          <p className="text-xs text-amber-600">Subscription expires on {format(new Date(endDate), "dd MMM yyyy")}. Please extend before it runs out.</p>
        </div>
      </div>
    );
  }
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SuperAdminCompanyDetail({ companyId }: Props) {
  const [, setLocation] = useLocation();
  const { data, isLoading, error, refetch } = useGetCompanyStats(companyId);
  const updateCompany = useUpdateCompany();
  const resetAdmin    = useResetCompanyAdmin();
  const queryClient   = useQueryClient();
  const { toast }     = useToast();
  const [showSubDialog, setShowSubDialog] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/super-admin/companies/${companyId}/stats`] });
    queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
    refetch();
  };

  const handleToggleStatus = async () => {
    if (!data) return;
    const newStatus = data.company.status === "active" ? "inactive" : "active";
    try {
      await updateCompany.mutateAsync({ companyId, data: { status: newStatus as "active" | "inactive" } });
      invalidate();
      toast({ title: `Company ${newStatus === "active" ? "activated" : "deactivated"}` });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleToggleSubscription = async () => {
    if (!data) return;
    try {
      await updateCompany.mutateAsync({ companyId, data: { subscriptionActive: !data.company.subscriptionActive } });
      invalidate();
      toast({ title: `Subscription ${!data.company.subscriptionActive ? "activated" : "deactivated"}` });
    } catch {
      toast({ title: "Failed to update subscription", variant: "destructive" });
    }
  };

  const handleExtend = async (days: number) => {
    if (!data) return;
    const company = data.company as any;
    const base = company.subscriptionEndDate && !isPast(new Date(company.subscriptionEndDate))
      ? new Date(company.subscriptionEndDate)
      : new Date();
    const newEnd = addDays(base, days);
    try {
      await adminFetch(`/api/super-admin/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify({
          subscriptionEndDate: newEnd.toISOString(),
          subscriptionActive: true,
          paymentStatus: "paid",
        }),
      });
      invalidate();
      toast({ title: `Extended by ${days} days`, description: `New expiry: ${format(newEnd, "dd MMM yyyy")}` });
    } catch {
      toast({ title: "Failed to extend subscription", variant: "destructive" });
    }
  };

  const handleResetAdmin = async () => {
    try {
      const result = await resetAdmin.mutateAsync({ companyId });
      toast({
        title: "Admin MPIN reset successfully",
        description: `Admin (${result.phone}) will need to set a new MPIN on next login.`,
      });
    } catch {
      toast({ title: "Failed to reset admin MPIN", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/super-admin/companies")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-6 text-destructive text-sm text-center">
          Company not found or failed to load.
        </div>
      </div>
    );
  }

  const { company, stats } = data;
  const comp = company as any;
  const isActive = company.status === "active";
  const hasSub   = company.subscriptionActive;

  const endDate = comp.subscriptionEndDate ? new Date(comp.subscriptionEndDate) : null;
  const isExpired = comp.isSubscriptionExpired === true || (endDate !== null && isPast(endDate));
  const daysLeft = endDate ? differenceInDays(endDate, new Date()) : null;

  const infoItems = [
    company.projectName && { icon: Building2, label: "Project",      value: company.projectName },
    (company.district || company.state) && { icon: MapPin, label: "Location", value: [company.district, company.state].filter(Boolean).join(", ") },
    company.adminName  && { icon: User,         label: "Admin",        value: company.adminName },
    company.phone      && { icon: User,         label: "Admin Phone",  value: company.phone },
    company.email      && { icon: Mail,         label: "Email",        value: company.email },
    company.createdAt  && { icon: CalendarDays, label: "Registered",   value: format(new Date(company.createdAt), "dd MMM yyyy") },
  ].filter(Boolean) as { icon: React.ElementType; label: string; value: string }[];

  const subStatusColor = isExpired ? "bg-red-500" : (isActive && hasSub ? "bg-emerald-500" : isActive ? "bg-amber-400" : "bg-slate-300");

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back nav */}
      <Button variant="ghost" size="sm" onClick={() => setLocation("/super-admin/companies")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> All Companies
      </Button>

      {/* Expiry warning banner */}
      {comp.subscriptionEndDate && (
        <ExpiryBanner
          endDate={comp.subscriptionEndDate}
          isExpired={isExpired}
          daysLeft={daysLeft ?? 0}
        />
      )}

      {/* Company header card */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className={`h-1.5 w-full ${subStatusColor}`} />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4 items-start">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0 ${subStatusColor}`}>
                {company.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""} variant={isActive ? "default" : "secondary"}>
                    {isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline" className={hasSub ? "border-blue-200 text-blue-700 bg-blue-50" : "border-amber-300 text-amber-700 bg-amber-50"}>
                    <CreditCard className="h-3 w-3 mr-1" />
                    Sub: {hasSub ? "On" : "Off"}
                  </Badge>
                  {comp.plan && (
                    <Badge variant="outline" className={PLAN_COLORS[comp.plan] ?? ""}>
                      <Zap className="h-3 w-3 mr-1" />
                      {PLAN_LABELS[comp.plan] ?? comp.plan}
                    </Badge>
                  )}
                  {comp.paymentStatus && (
                    <Badge variant="outline" className={PAYMENT_COLORS[comp.paymentStatus] ?? ""}>
                      {comp.paymentStatus.charAt(0).toUpperCase() + comp.paymentStatus.slice(1)}
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                      <XCircle className="h-3 w-3 mr-1" />
                      Expired
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Info grid */}
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3">
            {infoItems.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5">
                <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users,       label: "Staff Members",   value: stats.staffCount,     textColor: "text-violet-600", bg: "bg-violet-50" },
          { icon: UserSquare2, label: "Candidates",      value: stats.candidateCount, textColor: "text-blue-600",   bg: "bg-blue-50" },
          { icon: Activity,    label: "Activity Events", value: stats.activityCount,  textColor: "text-pink-600",   bg: "bg-pink-50" },
        ].map(({ icon: Icon, label, value, textColor, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <Icon className={`h-5 w-5 ${textColor} mb-2`} />
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Subscription Details ────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription Details
          </h2>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowSubDialog(true)}>
            <CalendarClock className="h-3.5 w-3.5" />
            Set Plan &amp; Dates
          </Button>
        </div>

        <div className="p-6">
          {comp.plan || comp.subscriptionEndDate ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {comp.plan && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Plan</p>
                  <Badge variant="outline" className={PLAN_COLORS[comp.plan] ?? "border-slate-200"}>
                    <Zap className="h-3 w-3 mr-1" />
                    {PLAN_LABELS[comp.plan] ?? comp.plan}
                  </Badge>
                </div>
              )}
              {comp.paymentStatus && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Payment</p>
                  <Badge variant="outline" className={PAYMENT_COLORS[comp.paymentStatus] ?? ""}>
                    {comp.paymentStatus.charAt(0).toUpperCase() + comp.paymentStatus.slice(1)}
                  </Badge>
                </div>
              )}
              {comp.subscriptionStartDate && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                  <p className="text-sm font-medium">{format(new Date(comp.subscriptionStartDate), "dd MMM yyyy")}</p>
                </div>
              )}
              {comp.subscriptionEndDate && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">End Date</p>
                  <p className={`text-sm font-medium ${isExpired ? "text-red-600" : (daysLeft !== null && daysLeft <= 3 ? "text-amber-600" : "")}`}>
                    {format(new Date(comp.subscriptionEndDate), "dd MMM yyyy")}
                    {!isExpired && daysLeft !== null && daysLeft >= 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">({daysLeft}d left)</span>
                    )}
                    {isExpired && (
                      <span className="ml-2 text-xs text-red-500">(expired)</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No subscription dates set. Click "Set Plan &amp; Dates" to configure.
            </p>
          )}

          {/* Quick extend buttons */}
          {comp.subscriptionEndDate || comp.subscriptionStartDate ? (
            <div className="mt-5 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Quick Extend
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "+30 Days", days: 30 },
                  { label: "+90 Days", days: 90 },
                  { label: "+6 Months", days: 182 },
                  { label: "+1 Year", days: 365 },
                ].map(({ label, days }) => (
                  <Button key={days} variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => handleExtend(days)}>
                    <CalendarDays className="h-3 w-3" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Company Controls ────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Company Controls</h2>
        </div>

        <div className="divide-y">
          {/* Status toggle */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isActive ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Company Status</p>
                <p className="text-xs text-muted-foreground">Inactive companies cannot login or submit data</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={handleToggleStatus} disabled={updateCompany.isPending} />
              <span className={`text-sm font-medium w-16 text-right ${isActive ? "text-emerald-600" : "text-muted-foreground"}`}>
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Subscription toggle */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${hasSub ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"}`}>
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Subscription Access</p>
                <p className="text-xs text-muted-foreground">Disabling blocks all staff logins and check-ins</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={hasSub} onCheckedChange={handleToggleSubscription} disabled={updateCompany.isPending} />
              <span className={`text-sm font-medium w-16 text-right ${hasSub ? "text-blue-600" : "text-amber-600"}`}>
                {hasSub ? "Active" : "Off"}
              </span>
            </div>
          </div>

          {/* Reset MPIN */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-600">
                <ShieldOff className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Reset Admin MPIN</p>
                <p className="text-xs text-muted-foreground">
                  Clears the admin's MPIN — they must set a new one on next login
                </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0 border-red-200 text-red-600 hover:bg-red-50">
                  <KeyRound className="h-4 w-4 mr-2" />
                  Reset MPIN
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Admin MPIN?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear the MPIN for <strong>{company.adminName || "the admin"}</strong> of{" "}
                    <strong>{company.name}</strong>. They will need to set a new MPIN the next time they log in.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetAdmin}
                    disabled={resetAdmin.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {resetAdmin.isPending ? "Resetting..." : "Yes, Reset MPIN"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Set Subscription Dialog */}
      {showSubDialog && (
        <SetSubscriptionDialog
          companyId={companyId}
          currentPlan={comp.plan ?? null}
          currentStart={comp.subscriptionStartDate ?? null}
          currentEnd={comp.subscriptionEndDate ?? null}
          currentPaymentStatus={comp.paymentStatus ?? null}
          onClose={() => setShowSubDialog(false)}
          onSuccess={invalidate}
        />
      )}
    </div>
  );
}
