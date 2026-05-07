import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, MapPin, CheckCircle, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface Company {
  id: string;
  name: string;
  adminName?: string;
  phone?: string;
  state?: string;
  district?: string;
  projectName?: string;
  plan: string;
  createdAt?: string;
}

interface Center {
  id: string;
  name: string;
  tcId?: string;
  companyName?: string;
  companyId?: string;
  state?: string;
  district?: string;
  block?: string;
  courses: string[];
  createdAt?: string;
}

function formatDate(s?: string) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function PendingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["super-admin-pending-companies"],
    queryFn: () => apiFetch("/super-admin/pending-companies"),
  });

  const { data: centers, isLoading: centersLoading } = useQuery<Center[]>({
    queryKey: ["super-admin-pending-centers"],
    queryFn: () => apiFetch("/super-admin/pending-centers"),
  });

  const companyActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      apiFetch(`/super-admin/companies/${id}/${action}`, { method: "POST", body: "{}" }),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-pending-companies"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-dashboard"] });
      toast({ title: `Company ${action === "approve" ? "approved" : "rejected"}` });
    },
    onError: (e: Error) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const centerActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      apiFetch(`/super-admin/centers/${id}/${action}`, { method: "POST", body: "{}" }),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-pending-centers"] });
      toast({ title: `Center ${action === "approve" ? "approved" : "rejected"}` });
    },
    onError: (e: Error) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const pendingCompanyCount = companies?.length ?? 0;
  const pendingCenterCount = centers?.length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Pending Approvals</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {pendingCompanyCount + pendingCenterCount} item{pendingCompanyCount + pendingCenterCount !== 1 ? "s" : ""} awaiting review
        </p>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies" data-testid="tab-pending-companies">
            Companies
            {pendingCompanyCount > 0 && (
              <span className="ml-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {pendingCompanyCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="centers" data-testid="tab-pending-centers">
            Training Centers
            {pendingCenterCount > 0 && (
              <span className="ml-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {pendingCenterCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="pt-4">
          {companiesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : !companies?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle className="h-8 w-8 text-green-400 mb-2" />
              <p className="text-sm font-medium text-foreground">All caught up</p>
              <p className="text-xs text-muted-foreground mt-0.5">No companies awaiting approval</p>
            </div>
          ) : (
            <div className="space-y-3">
              {companies.map((c) => (
                <div
                  key={c.id}
                  data-testid={`card-pending-company-${c.id}`}
                  className="bg-card border border-card-border rounded-lg p-4 flex items-start gap-4"
                >
                  <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Building2 className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/companies/${c.id}`}>
                          <p className="text-sm font-semibold hover:text-primary transition-colors cursor-pointer">{c.name}</p>
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[c.adminName, c.phone, c.state, c.district].filter(Boolean).join(" · ")}
                        </p>
                        {c.projectName && (
                          <p className="text-xs text-muted-foreground">{c.projectName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge variant="secondary" className="text-xs capitalize">{c.plan}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="h-7 gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={() => companyActionMutation.mutate({ id: c.id, action: "approve" })}
                        disabled={companyActionMutation.isPending}
                        data-testid={`button-approve-company-${c.id}`}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs text-red-700 border-red-200 hover:bg-red-50"
                        onClick={() => companyActionMutation.mutate({ id: c.id, action: "reject" })}
                        disabled={companyActionMutation.isPending}
                        data-testid={`button-reject-company-${c.id}`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="centers" className="pt-4">
          {centersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : !centers?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle className="h-8 w-8 text-green-400 mb-2" />
              <p className="text-sm font-medium text-foreground">All caught up</p>
              <p className="text-xs text-muted-foreground mt-0.5">No training centers awaiting approval</p>
            </div>
          ) : (
            <div className="space-y-3">
              {centers.map((c) => (
                <div
                  key={c.id}
                  data-testid={`card-pending-center-${c.id}`}
                  className="bg-card border border-card-border rounded-lg p-4 flex items-start gap-4"
                >
                  <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{c.name}</p>
                        {c.companyName && (
                          <p className="text-xs text-primary font-medium">{c.companyName}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[c.tcId, c.state, c.district, c.block].filter(Boolean).join(" · ")}
                        </p>
                        {c.courses?.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {c.courses.slice(0, 3).join(", ")}{c.courses.length > 3 ? ` +${c.courses.length - 3}` : ""}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(c.createdAt)}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="h-7 gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={() => centerActionMutation.mutate({ id: c.id, action: "approve" })}
                        disabled={centerActionMutation.isPending}
                        data-testid={`button-approve-center-${c.id}`}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs text-red-700 border-red-200 hover:bg-red-50"
                        onClick={() => centerActionMutation.mutate({ id: c.id, action: "reject" })}
                        disabled={centerActionMutation.isPending}
                        data-testid={`button-reject-center-${c.id}`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
