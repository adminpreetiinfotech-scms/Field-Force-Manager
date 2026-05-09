import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, RadioTower } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: "staff" | "admin" | "super_admin";
  empCode: string;
  companyId?: string;
  companyName?: string;
  approvalStatus: string;
  disabledAt?: string;
  createdAt?: string;
  centerName?: string;
  projectName?: string;
  state?: string;
  district?: string;
  area?: string;
  organization?: string;
  lastLocationAt?: string;
  isOnShift: boolean;
}

function roleBadgeVariant(role: string) {
  if (role === "super_admin") return "default" as const;
  if (role === "admin") return "secondary" as const;
  return "outline" as const;
}

function roleLabel(role: string) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  return "Staff";
}

export default function StaffPage() {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterShift, setFilterShift] = useState("all");

  const { data: staff, isLoading } = useQuery<StaffMember[]>({
    queryKey: ["super-admin-staff"],
    queryFn: () => apiFetch("/super-admin/staff"),
  });

  const companies = [...new Set((staff ?? []).map((s) => s.companyName).filter(Boolean))].sort() as string[];

  const filtered = (staff ?? []).filter((s) => {
    const q = search.toLowerCase();
    if (q && !s.name.toLowerCase().includes(q) && !s.phone.includes(q) && !(s.companyName ?? "").toLowerCase().includes(q) && !s.empCode.toLowerCase().includes(q)) return false;
    if (filterRole !== "all" && s.role !== filterRole) return false;
    if (filterCompany !== "all" && s.companyName !== filterCompany) return false;
    if (filterShift === "on" && !s.isOnShift) return false;
    if (filterShift === "off" && s.isOnShift) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Staff Directory</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {staff?.length ?? 0} member{(staff?.length ?? 0) !== 1 ? "s" : ""} across all companies
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Search name, phone, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger data-testid="select-filter-role" className="w-36">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger data-testid="select-filter-company" className="w-44">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterShift} onValueChange={setFilterShift}>
          <SelectTrigger data-testid="select-filter-shift" className="w-32">
            <SelectValue placeholder="Shift" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="on">On Shift</SelectItem>
            <SelectItem value="off">Off Shift</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {isLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-14" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No staff members found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((s) => (
              <div
                key={s.id}
                data-testid={`row-staff-${s.id}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{s.name}</span>
                    {s.isOnShift && (
                      <RadioTower className="h-3 w-3 text-green-500 flex-shrink-0" />
                    )}
                    {s.disabledAt && (
                      <span className="text-xs text-red-500">Disabled</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.phone} · {s.empCode}{s.companyName ? ` · ${s.companyName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={roleBadgeVariant(s.role)} className="text-xs">
                    {roleLabel(s.role)}
                  </Badge>
                  <Badge
                    variant={s.approvalStatus === "approved" ? "outline" : s.approvalStatus === "pending" ? "secondary" : "destructive"}
                    className="text-xs capitalize hidden sm:flex"
                  >
                    {s.approvalStatus}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isLoading && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {staff?.length ?? 0}
        </p>
      )}
    </div>
  );
}
