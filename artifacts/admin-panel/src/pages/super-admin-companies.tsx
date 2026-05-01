import { useListCompanies, useUpdateCompany } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Building2, ChevronRight, Users, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function SuperAdminCompanies() {
  const { data: companies, isLoading, error, refetch } = useListCompanies();
  const updateCompany = useUpdateCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-destructive text-sm">
        Failed to load companies. Make sure you are logged in as Super Admin.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Companies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {companies?.length ?? 0} registered companies
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {companies?.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No companies registered yet.</p>
        </div>
      )}

      <div className="grid gap-4">
        {companies?.map((company) => (
          <div key={company.id} className="bg-card border rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-lg truncate">{company.name}</h2>
                  <Badge variant={company.status === "active" ? "default" : "secondary"}>
                    {company.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                  {!company.subscriptionActive && (
                    <Badge variant="destructive">Subscription Off</Badge>
                  )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
                  {company.projectName && <p>Project: {company.projectName}</p>}
                  {(company.district || company.state) && (
                    <p>{[company.district, company.state].filter(Boolean).join(", ")}</p>
                  )}
                  {company.adminName && <p>Admin: {company.adminName} {company.phone && `(${company.phone})`}</p>}
                  {company.createdAt && (
                    <p>Registered: {format(new Date(company.createdAt), "dd MMM yyyy")}</p>
                  )}
                </div>
              </div>

              <Link href={`/super-admin/companies/${company.id}`}>
                <Button variant="ghost" size="sm" className="shrink-0">
                  Details
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Company Status</span>
                <Switch
                  checked={company.status === "active"}
                  onCheckedChange={() => handleToggleStatus(company.id, company.status)}
                  disabled={updateCompany.isPending}
                />
                <span className="text-sm font-medium">
                  {company.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Subscription</span>
                <Switch
                  checked={company.subscriptionActive}
                  onCheckedChange={() => handleToggleSubscription(company.id, company.subscriptionActive)}
                  disabled={updateCompany.isPending}
                />
                <span className="text-sm font-medium">
                  {company.subscriptionActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
