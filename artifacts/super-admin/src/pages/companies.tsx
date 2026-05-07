import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Search, Building2, CheckCircle2, AlertCircle, XCircle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Company {
  id: string;
  name: string;
  adminName?: string;
  phone?: string;
  state?: string;
  district?: string;
  projectName?: string;
  plan: "basic" | "standard" | "premium";
  status: "active" | "inactive";
  subscriptionActive: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  subscriptionEndDate?: string;
  paymentStatus?: "paid" | "pending" | "expired";
  createdAt?: string;
}

function planColor(plan: string) {
  if (plan === "premium") return "default";
  if (plan === "standard") return "secondary";
  return "outline";
}

function statusIcon(c: Company) {
  if (c.approvalStatus === "pending") return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  if (!c.subscriptionActive) return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  if (c.status === "active") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterApproval, setFilterApproval] = useState("all");

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["super-admin-companies"],
    queryFn: () => apiFetch("/super-admin/companies"),
  });

  const filtered = (companies ?? []).filter((c) => {
    const q = search.toLowerCase();
    if (q && !c.name.toLowerCase().includes(q) && !(c.adminName ?? "").toLowerCase().includes(q) && !(c.state ?? "").toLowerCase().includes(q)) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterPlan !== "all" && c.plan !== filterPlan) return false;
    if (filterApproval !== "all" && c.approvalStatus !== filterApproval) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Companies</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {companies?.length ?? 0} tenant{(companies?.length ?? 0) !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Link href="/companies/new">
          <Button data-testid="button-new-company" size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Company
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Search by name, admin, state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger data-testid="select-filter-status" className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger data-testid="select-filter-plan" className="w-36">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterApproval} onValueChange={setFilterApproval}>
          <SelectTrigger data-testid="select-filter-approval" className="w-40">
            <SelectValue placeholder="Approval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {isLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No companies found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((c) => (
              <Link key={c.id} href={`/companies/${c.id}`}>
                <div
                  data-testid={`row-company-${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      {statusIcon(c)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.adminName, c.state, c.district].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={planColor(c.plan)} className="text-xs capitalize">{c.plan}</Badge>
                    <Badge
                      variant={c.approvalStatus === "approved" ? "outline" : c.approvalStatus === "pending" ? "secondary" : "destructive"}
                      className="text-xs capitalize hidden sm:flex"
                    >
                      {c.approvalStatus}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {companies?.length ?? 0}
        </p>
      )}
    </div>
  );
}
