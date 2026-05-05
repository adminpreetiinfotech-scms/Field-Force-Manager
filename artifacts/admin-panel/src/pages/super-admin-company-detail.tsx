import { useState, useRef } from "react";
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
  AlertTriangle, XCircle, Zap, CalendarClock, Plus, Wand2, Trash2,
  School, Check, X, ChevronDown, ChevronUp, Upload, ImageIcon,
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

type CenterRow = {
  id: string;
  name: string;
  tcId?: string | null;
  state?: string | null;
  district?: string | null;
  block?: string | null;
  approvalStatus: string;
  createdAt?: string | null;
  courses?: string[];
};

function useCenters(companyId: string) {
  const [data, setData] = useState<CenterRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const refetch = async () => {
    setLoading(true);
    try {
      const phone = getAdminPhone();
      const res = await adminFetchStatic(`/api/super-admin/companies/${companyId}/centers`, phone);
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  return { data, loading, refetch };
}

function adminFetchStatic(path: string, phone: string, opts: RequestInit = {}) {
  return fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-admin-phone": phone,
      ...(opts.headers ?? {}),
    },
  });
}

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.split(",")[1], mime: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SuperAdminCompanyDetail({ companyId }: Props) {
  const [, setLocation] = useLocation();
  const { data, isLoading, error, refetch } = useGetCompanyStats(companyId);
  const updateCompany = useUpdateCompany();
  const resetAdmin    = useResetCompanyAdmin();
  const queryClient   = useQueryClient();
  const { toast }     = useToast();
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [centersExpanded, setCentersExpanded] = useState(false);
  const [centerActionLoading, setCenterActionLoading] = useState<string | null>(null);
  const centersHook = useCenters(companyId);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/super-admin/companies/${companyId}/stats`] });
    queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
    refetch();
  };

  const handleCenterAction = async (centerId: string, action: "approve" | "reject") => {
    setCenterActionLoading(`${centerId}-${action}`);
    try {
      const res = await adminFetch(`/api/super-admin/centers/${centerId}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).title ?? "Failed");
      toast({ title: action === "approve" ? "Center approved!" : "Center rejected" });
      centersHook.refetch();
      invalidate();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setCenterActionLoading(null); }
  };

  const handleToggleCenters = () => {
    if (!centersExpanded && !centersHook.data) {
      centersHook.refetch();
    }
    setCentersExpanded(v => !v);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Only image files allowed", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be under 2MB", variant: "destructive" });
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;
    setUploadingLogo(true);
    try {
      const { base64, mime } = await fileToBase64(logoFile);
      const res = await adminFetch(`/api/companies/${companyId}/logo`, {
        method: "PATCH",
        body: JSON.stringify({ logoBase64: base64, logoMime: mime }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).title ?? "Logo upload failed");
      toast({ title: "Logo updated successfully" });
      setLogoFile(null);
      if (logoFileRef.current) logoFileRef.current.value = "";
      invalidate();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false); }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoFileRef.current) logoFileRef.current.value = "";
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

  const [backfilling, setBackfilling] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState(false);

  const handleDeleteCompany = async () => {
    setDeletingCompany(true);
    try {
      const res = await adminFetch(
        `/api/super-admin/companies/${companyId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.title || "Delete failed");
      }
      const result = (await res.json()) as {
        candidatesDeleted: number;
        staffDeleted: number;
        eventsDeleted: number;
      };
      toast({
        title: "Company deleted",
        description: `Removed ${result.candidatesDeleted} candidate(s), ${result.staffDeleted} staff, and ${result.eventsDeleted} activity record(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
      setLocation("/super-admin/companies");
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      setDeletingCompany(false);
    }
  };
  const handleBackfillOrphans = async () => {
    setBackfilling(true);
    try {
      const res = await adminFetch(
        `/api/super-admin/companies/${companyId}/backfill-orphans`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.title || "Backfill failed");
      }
      const result = (await res.json()) as {
        candidatesUpdated: number;
        staffUpdated: number;
      };
      toast({
        title: "Orphan records adopted",
        description: `${result.candidatesUpdated} candidate(s) and ${result.staffUpdated} staff member(s) assigned to this company.`,
      });
      invalidate();
    } catch (e) {
      toast({
        title: "Backfill failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBackfilling(false);
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
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0 overflow-hidden ${(logoPreview || comp.logoUrl) ? "bg-white border" : subStatusColor}`}>
                {(logoPreview || comp.logoUrl) ? (
                  <img src={logoPreview ?? comp.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  company.name.slice(0, 2).toUpperCase()
                )}
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users,       label: "Staff Members",      value: stats.staffCount,                    textColor: "text-violet-600", bg: "bg-violet-50" },
          { icon: UserSquare2, label: "Candidates",         value: stats.candidateCount,                textColor: "text-blue-600",   bg: "bg-blue-50" },
          { icon: Activity,    label: "Activity Events",    value: stats.activityCount,                 textColor: "text-pink-600",   bg: "bg-pink-50" },
          { icon: School,      label: "Training Centers",   value: (stats as any).centerCount ?? 0,     textColor: "text-teal-600",   bg: "bg-teal-50" },
        ].map(({ icon: Icon, label, value, textColor, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <Icon className={`h-5 w-5 ${textColor} mb-2`} />
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Training Centers ────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <button
          className="w-full px-6 py-4 border-b bg-muted/30 flex items-center justify-between hover:bg-muted/50 transition-colors"
          onClick={handleToggleCenters}
        >
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <School className="h-4 w-4" />
            Training Centers
            {(stats as any).centerCount > 0 && (
              <span className="ml-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold px-1.5 py-0.5">
                {(stats as any).centerCount}
              </span>
            )}
            {centersHook.data && centersHook.data.some(c => c.approvalStatus === "pending") && (
              <span className="ml-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold px-1.5 py-0.5">
                {centersHook.data.filter(c => c.approvalStatus === "pending").length} pending
              </span>
            )}
          </h2>
          {centersExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {centersExpanded && (
          <div className="divide-y">
            {centersHook.loading && (
              <div className="p-6 space-y-3">
                {[1, 2].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
              </div>
            )}
            {!centersHook.loading && centersHook.data && centersHook.data.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No training centers registered yet.</p>
            )}
            {!centersHook.loading && centersHook.data && centersHook.data.map((center) => {
              const statusColor =
                center.approvalStatus === "approved" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                center.approvalStatus === "rejected" ? "bg-red-100 text-red-700 border-red-200" :
                "bg-amber-100 text-amber-700 border-amber-200";
              const isPending = center.approvalStatus === "pending";
              return (
                <div key={center.id} className="flex items-start justify-between gap-4 px-6 py-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${isPending ? "bg-amber-100 text-amber-600" : "bg-teal-100 text-teal-600"}`}>
                      <School className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{center.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {center.tcId && (
                          <span className="text-xs text-muted-foreground font-mono">{center.tcId}</span>
                        )}
                        {(center.district || center.state) && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[center.district, center.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {center.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(center.createdAt), "dd MMM yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`text-xs ${statusColor}`}>
                      {center.approvalStatus}
                    </Badge>
                    {isPending && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          disabled={centerActionLoading !== null}
                          onClick={() => handleCenterAction(center.id, "approve")}
                        >
                          {centerActionLoading === `${center.id}-approve` ? "..." : <><Check className="h-3 w-3 mr-1" />Approve</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 border-red-200 text-red-700 hover:bg-red-50"
                          disabled={centerActionLoading !== null}
                          onClick={() => handleCenterAction(center.id, "reject")}
                        >
                          {centerActionLoading === `${center.id}-reject` ? "..." : <><X className="h-3 w-3 mr-1" />Reject</>}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
          {/* Logo Upload */}
          <div className="px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 shrink-0 mt-0.5">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Company Logo</p>
                <p className="text-xs text-muted-foreground mb-3">Upload or replace the logo shown on reports and the app</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {(logoPreview || comp.logoUrl) && (
                    <div className="w-12 h-12 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                      <img src={logoPreview ?? comp.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => logoFileRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {comp.logoUrl ? "Change Logo" : "Upload Logo"}
                    </Button>
                    {logoFile && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                          onClick={handleUploadLogo}
                          disabled={uploadingLogo}
                        >
                          {uploadingLogo ? "Uploading..." : <><Check className="h-3.5 w-3.5" />Save Logo</>}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground"
                          onClick={handleRemoveLogo}
                          disabled={uploadingLogo}
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {logoFile && (
                  <p className="text-xs text-indigo-600 mt-2 flex items-center gap-1.5">
                    <Upload className="h-3 w-3" />
                    Ready to upload: {logoFile.name}
                  </p>
                )}
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
                <p className="text-xs text-muted-foreground mt-1.5">JPG, PNG, WebP — max 2MB</p>
              </div>
            </div>
          </div>

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

          {/* Adopt orphan records */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                <Wand2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Adopt Orphan Records</p>
                <p className="text-xs text-muted-foreground">
                  Assigns every candidate and field staff with no company to <strong>{company.name}</strong>. Use only if legacy records are missing from the dashboard.
                </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0 border-indigo-200 text-indigo-600 hover:bg-indigo-50" disabled={backfilling}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  {backfilling ? "Working..." : "Adopt Orphans"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Adopt all orphan records?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All candidates and field staff currently with no company will be reassigned to <strong>{company.name}</strong>. Super admins are excluded. This cannot be undone automatically — only run this if you are sure those records belong to this company.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBackfillOrphans}
                    disabled={backfilling}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {backfilling ? "Working..." : "Yes, Adopt All"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Delete Company — destructive */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-600">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Delete Company</p>
                <p className="text-xs text-muted-foreground">
                  Permanently removes <strong>{company.name}</strong> with all its candidates, staff, and activity. Use this to clean up after a demo.
                </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                  disabled={deletingCompany}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deletingCompany ? "Deleting..." : "Delete Company"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this company permanently?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All candidates, field staff, company admin, activity events, and notices for <strong>{company.name}</strong> will be wiped from the database. Super-admin accounts are not affected. This action <strong>cannot be undone</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteCompany}
                    disabled={deletingCompany}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deletingCompany ? "Deleting..." : "Yes, Delete Company"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
