import { useGetCompanyStats, useUpdateCompany, useResetCompanyAdmin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { ArrowLeft, RefreshCw, Users, UserSquare2, Activity, KeyRound } from "lucide-react";
import { format } from "date-fns";

interface Props {
  companyId: string;
}

export default function SuperAdminCompanyDetail({ companyId }: Props) {
  const [, setLocation] = useLocation();
  const { data, isLoading, error, refetch } = useGetCompanyStats(companyId);
  const updateCompany = useUpdateCompany();
  const resetAdmin = useResetCompanyAdmin();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/super-admin/companies")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-destructive text-sm">
          Company not found or failed to load.
        </div>
      </div>
    );
  }

  const { company, stats } = data;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/super-admin/companies")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> All Companies
        </Button>
      </div>

      {/* Company Header */}
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant={company.status === "active" ? "default" : "secondary"}>
                {company.status === "active" ? "Active" : "Inactive"}
              </Badge>
              <Badge variant={company.subscriptionActive ? "outline" : "destructive"}>
                Subscription: {company.subscriptionActive ? "Active" : "Off"}
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {company.projectName && (
            <div>
              <span className="text-muted-foreground">Project</span>
              <p className="font-medium">{company.projectName}</p>
            </div>
          )}
          {(company.district || company.state) && (
            <div>
              <span className="text-muted-foreground">Location</span>
              <p className="font-medium">{[company.district, company.state].filter(Boolean).join(", ")}</p>
            </div>
          )}
          {company.adminName && (
            <div>
              <span className="text-muted-foreground">Admin Name</span>
              <p className="font-medium">{company.adminName}</p>
            </div>
          )}
          {company.phone && (
            <div>
              <span className="text-muted-foreground">Admin Phone</span>
              <p className="font-medium">{company.phone}</p>
            </div>
          )}
          {company.email && (
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-medium">{company.email}</p>
            </div>
          )}
          {company.createdAt && (
            <div>
              <span className="text-muted-foreground">Registered</span>
              <p className="font-medium">{format(new Date(company.createdAt), "dd MMM yyyy")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4 text-center">
          <Users className="h-6 w-6 mx-auto text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{stats.staffCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Staff Members</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <UserSquare2 className="h-6 w-6 mx-auto text-green-500 mb-2" />
          <p className="text-2xl font-bold">{stats.candidateCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Candidates</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <Activity className="h-6 w-6 mx-auto text-purple-500 mb-2" />
          <p className="text-2xl font-bold">{stats.activityCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Activity Events</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border rounded-lg p-6 space-y-5">
        <h2 className="font-semibold text-base">Company Controls</h2>

        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="text-sm font-medium">Company Status</p>
            <p className="text-xs text-muted-foreground">
              Inactive companies cannot login or submit data.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={company.status === "active"}
              onCheckedChange={handleToggleStatus}
              disabled={updateCompany.isPending}
            />
            <span className="text-sm w-16 text-right">
              {company.status === "active" ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="text-sm font-medium">Subscription</p>
            <p className="text-xs text-muted-foreground">
              Disabling blocks all staff logins for this company.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={company.subscriptionActive}
              onCheckedChange={handleToggleSubscription}
              disabled={updateCompany.isPending}
            />
            <span className="text-sm w-16 text-right">
              {company.subscriptionActive ? "Active" : "Off"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-sm font-medium">Reset Admin MPIN</p>
            <p className="text-xs text-muted-foreground">
              Clears the admin's MPIN — they must set a new one on next login.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                <KeyRound className="h-4 w-4 mr-2" />
                Reset MPIN
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Admin MPIN?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear the MPIN for <strong>{company.adminName || "the admin"}</strong> of <strong>{company.name}</strong>. They will need to set a new MPIN the next time they log in.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetAdmin} disabled={resetAdmin.isPending}>
                  {resetAdmin.isPending ? "Resetting..." : "Reset MPIN"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
