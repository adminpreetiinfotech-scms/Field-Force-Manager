import { useGetCompanyStats, useUpdateCompany, useResetCompanyAdmin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, RefreshCw, Users, UserSquare2, Activity,
  KeyRound, MapPin, User, CalendarDays, Mail,
  Building2, CreditCard, ShieldOff, CheckCircle2
} from "lucide-react";
import { format } from "date-fns";

interface Props {
  companyId: string;
}

export default function SuperAdminCompanyDetail({ companyId }: Props) {
  const [, setLocation] = useLocation();
  const { data, isLoading, error, refetch } = useGetCompanyStats(companyId);
  const updateCompany = useUpdateCompany();
  const resetAdmin    = useResetCompanyAdmin();
  const queryClient   = useQueryClient();
  const { toast }     = useToast();

  const handleToggleStatus = async () => {
    if (!data) return;
    const newStatus = data.company.status === "active" ? "inactive" : "active";
    try {
      await updateCompany.mutateAsync({ companyId, data: { status: newStatus as "active" | "inactive" } });
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/companies/${companyId}/stats`] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
      toast({ title: `Company ${newStatus === "active" ? "activated" : "deactivated"}` });
      refetch();
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleToggleSubscription = async () => {
    if (!data) return;
    try {
      await updateCompany.mutateAsync({ companyId, data: { subscriptionActive: !data.company.subscriptionActive } });
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/companies/${companyId}/stats`] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
      toast({ title: `Subscription ${!data.company.subscriptionActive ? "activated" : "deactivated"}` });
      refetch();
    } catch {
      toast({ title: "Failed to update subscription", variant: "destructive" });
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
  const isActive = company.status === "active";
  const hasSub   = company.subscriptionActive;

  const infoItems = [
    company.projectName && { icon: Building2, label: "Project",      value: company.projectName },
    (company.district || company.state) && { icon: MapPin,       label: "Location",     value: [company.district, company.state].filter(Boolean).join(", ") },
    company.adminName  && { icon: User,         label: "Admin",        value: company.adminName },
    company.phone      && { icon: User,         label: "Admin Phone",  value: company.phone },
    company.email      && { icon: Mail,         label: "Email",        value: company.email },
    company.createdAt  && { icon: CalendarDays, label: "Registered",   value: format(new Date(company.createdAt), "dd MMM yyyy") },
  ].filter(Boolean) as { icon: React.ElementType; label: string; value: string }[];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back nav */}
      <Button variant="ghost" size="sm" onClick={() => setLocation("/super-admin/companies")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> All Companies
      </Button>

      {/* Company header card */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className={`h-1.5 w-full ${isActive && hasSub ? "bg-emerald-500" : isActive ? "bg-amber-400" : "bg-slate-300"}`} />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4 items-start">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0
                ${isActive && hasSub ? "bg-emerald-500" : isActive ? "bg-amber-400" : "bg-slate-400"}`}>
                {company.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""} variant={isActive ? "default" : "secondary"}>
                    {isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant={hasSub ? "outline" : "outline"} className={hasSub ? "border-blue-200 text-blue-700 bg-blue-50" : "border-amber-300 text-amber-700 bg-amber-50"}>
                    <CreditCard className="h-3 w-3 mr-1" />
                    Subscription: {hasSub ? "Active" : "Off"}
                  </Badge>
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
          { icon: Users,       label: "Staff Members",   value: stats.staffCount,     accent: "bg-violet-500", textColor: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
          { icon: UserSquare2, label: "Candidates",      value: stats.candidateCount, accent: "bg-blue-500",   textColor: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/30" },
          { icon: Activity,    label: "Activity Events", value: stats.activityCount,  accent: "bg-pink-500",   textColor: "text-pink-600",   bg: "bg-pink-50 dark:bg-pink-950/30" },
        ].map(({ icon: Icon, label, value, textColor, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <Icon className={`h-5 w-5 ${textColor} mb-2`} />
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
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
              <Switch
                checked={isActive}
                onCheckedChange={handleToggleStatus}
                disabled={updateCompany.isPending}
              />
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
                <p className="text-sm font-medium">Subscription</p>
                <p className="text-xs text-muted-foreground">Disabling blocks all staff logins for this company</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={hasSub}
                onCheckedChange={handleToggleSubscription}
                disabled={updateCompany.isPending}
              />
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
    </div>
  );
}
