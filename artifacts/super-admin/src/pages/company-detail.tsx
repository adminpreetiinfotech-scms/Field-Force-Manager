import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, Building2, Users, UserCheck, BarChart2, RefreshCw, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { apiFetch } from "@/lib/api";

interface Company {
  id: string;
  name: string;
  adminName?: string;
  phone?: string;
  email?: string;
  state?: string;
  district?: string;
  projectName?: string;
  plan: "basic" | "standard" | "premium";
  status: "active" | "inactive";
  subscriptionActive: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  paymentStatus?: "paid" | "pending" | "expired";
}

interface Stats {
  staffCount: number;
  candidateCount: number;
  activityCount: number;
  centerCount: number;
}

interface Center {
  id: string;
  name: string;
  tcId?: string;
  state?: string;
  district?: string;
  block?: string;
  approvalStatus: string;
  courses: string[];
}

const editSchema = z.object({
  name: z.string().min(2),
  status: z.enum(["active", "inactive"]),
  subscriptionActive: z.boolean(),
  plan: z.enum(["basic", "standard", "premium"]),
  paymentStatus: z.enum(["paid", "pending", "expired"]).optional(),
  subscriptionStartDate: z.string().optional(),
  subscriptionEndDate: z.string().optional(),
});

const newAdminSchema = z.object({
  name: z.string().min(2, "Min 2 chars"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Valid 10-digit Indian number"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  initialMpin: z.string().min(4).max(6).regex(/^\d+$/, "Digits only").optional().or(z.literal("")),
});

type EditForm = z.infer<typeof editSchema>;
type NewAdminForm = z.infer<typeof newAdminSchema>;

function toDateInput(s?: string) {
  if (!s) return "";
  return s.substring(0, 10);
}

export default function CompanyDetailPage({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [resetMpin, setResetMpin] = useState("");

  const { data, isLoading } = useQuery<{ company: Company; stats: Stats }>({
    queryKey: ["super-admin-company-stats", id],
    queryFn: () => apiFetch(`/super-admin/companies/${id}/stats`),
  });

  const { data: centers, isLoading: centersLoading } = useQuery<Center[]>({
    queryKey: ["super-admin-company-centers", id],
    queryFn: () => apiFetch(`/super-admin/companies/${id}/centers`),
  });

  const company = data?.company;
  const stats = data?.stats;

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: company ? {
      name: company.name,
      status: company.status,
      subscriptionActive: company.subscriptionActive,
      plan: company.plan,
      paymentStatus: company.paymentStatus ?? undefined,
      subscriptionStartDate: toDateInput(company.subscriptionStartDate),
      subscriptionEndDate: toDateInput(company.subscriptionEndDate),
    } : undefined,
  });

  const newAdminForm = useForm<NewAdminForm>({
    resolver: zodResolver(newAdminSchema),
    defaultValues: { name: "", phone: "", email: "", initialMpin: "" },
  });

  const updateMutation = useMutation({
    mutationFn: (data: EditForm) => apiFetch(`/super-admin/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-company-stats", id] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-companies"] });
      toast({ title: "Company updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const resetAdminMutation = useMutation({
    mutationFn: () => apiFetch(`/super-admin/companies/${id}/reset-admin`, {
      method: "POST",
      body: JSON.stringify(resetMpin ? { newMpin: resetMpin } : {}),
    }),
    onSuccess: () => {
      setResetMpin("");
      toast({ title: "Admin MPIN reset successfully" });
    },
    onError: (e: Error) => toast({ title: "Reset failed", description: e.message, variant: "destructive" }),
  });

  const newAdminMutation = useMutation({
    mutationFn: (data: NewAdminForm) => apiFetch("/super-admin/company-admin", {
      method: "POST",
      body: JSON.stringify({ ...data, companyId: id, email: data.email || null, initialMpin: data.initialMpin || null }),
    }),
    onSuccess: () => {
      newAdminForm.reset();
      toast({ title: "Admin account created" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/super-admin/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-dashboard"] });
      toast({ title: "Company deleted" });
      setLocation("/companies");
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const approveCenterMutation = useMutation({
    mutationFn: ({ centerId, action }: { centerId: string; action: "approve" | "reject" }) =>
      apiFetch(`/super-admin/centers/${centerId}/${action}`, { method: "POST", body: "{}" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-company-centers", id] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-pending-centers"] });
      toast({ title: "Center status updated" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!company) {
    return <div className="text-muted-foreground text-sm">Company not found.</div>;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/companies">
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{company.name}</h1>
          <p className="text-xs text-muted-foreground">
            {[company.projectName, company.state, company.district].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Badge variant={company.approvalStatus === "approved" ? "outline" : company.approvalStatus === "pending" ? "secondary" : "destructive"} className="capitalize">
          {company.approvalStatus}
        </Badge>
        <Badge variant={company.plan === "premium" ? "default" : "secondary"} className="capitalize">
          {company.plan}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Staff", value: stats?.staffCount },
          { icon: UserCheck, label: "Candidates", value: stats?.candidateCount },
          { icon: BarChart2, label: "Activities", value: stats?.activityCount },
          { icon: Building2, label: "Centers", value: stats?.centerCount },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-card border border-card-border rounded-lg p-3 flex items-center gap-2" data-testid={`stat-${label.toLowerCase()}`}>
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold leading-none">{value ?? "—"}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="edit">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="edit" data-testid="tab-edit">Edit</TabsTrigger>
          <TabsTrigger value="admin" data-testid="tab-admin">Admin</TabsTrigger>
          <TabsTrigger value="centers" data-testid="tab-centers">Centers</TabsTrigger>
          <TabsTrigger value="danger" data-testid="tab-danger">Danger</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="pt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Edit Company</CardTitle></CardHeader>
            <CardContent>
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
                  <FormField control={editForm.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl><Input {...field} data-testid="input-edit-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="plan" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger data-testid="select-plan"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={editForm.control} name="subscriptionActive" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel className="text-sm">Subscription Active</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-subscription-active" />
                      </FormControl>
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="subscriptionStartDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl><Input {...field} type="date" data-testid="input-sub-start" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="subscriptionEndDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl><Input {...field} type="date" data-testid="input-sub-end" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={editForm.control} name="paymentStatus" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl><SelectTrigger data-testid="select-payment-status"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save">
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Reset Admin MPIN
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Leave blank to clear the MPIN (admin must set a new one on next login). Or enter a specific 4–6 digit MPIN.
              </p>
              <div className="flex gap-2">
                <Input
                  data-testid="input-reset-mpin"
                  type="password"
                  placeholder="New MPIN (optional)"
                  value={resetMpin}
                  onChange={(e) => setResetMpin(e.target.value)}
                  maxLength={6}
                  inputMode="numeric"
                  className="flex-1"
                />
                <Button
                  data-testid="button-reset-mpin"
                  variant="outline"
                  onClick={() => resetAdminMutation.mutate()}
                  disabled={resetAdminMutation.isPending}
                >
                  {resetAdminMutation.isPending ? "Resetting..." : "Reset"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Admin Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...newAdminForm}>
                <form onSubmit={newAdminForm.handleSubmit((d) => newAdminMutation.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={newAdminForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input {...field} data-testid="input-new-admin-name" placeholder="Full name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={newAdminForm.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl><Input {...field} data-testid="input-new-admin-phone" placeholder="10-digit number" inputMode="numeric" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={newAdminForm.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (optional)</FormLabel>
                        <FormControl><Input {...field} data-testid="input-new-admin-email" type="email" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={newAdminForm.control} name="initialMpin" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial MPIN (optional)</FormLabel>
                        <FormControl><Input {...field} data-testid="input-new-admin-mpin" type="password" inputMode="numeric" maxLength={6} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Button type="submit" disabled={newAdminMutation.isPending} data-testid="button-create-admin">
                    {newAdminMutation.isPending ? "Creating..." : "Create Admin"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="centers" className="pt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Training Centers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {centersLoading ? (
                <div className="px-6 pb-4 space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !centers?.length ? (
                <p className="px-6 pb-4 text-sm text-muted-foreground">No training centers registered.</p>
              ) : (
                <div className="divide-y divide-border">
                  {centers.map((c) => (
                    <div key={c.id} data-testid={`row-center-${c.id}`} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[c.tcId, c.state, c.district].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Badge
                        variant={c.approvalStatus === "approved" ? "outline" : c.approvalStatus === "pending" ? "secondary" : "destructive"}
                        className="text-xs capitalize flex-shrink-0"
                      >
                        {c.approvalStatus}
                      </Badge>
                      {c.approvalStatus === "pending" && (
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                            onClick={() => approveCenterMutation.mutate({ centerId: c.id, action: "approve" })}
                            data-testid={`button-approve-center-${c.id}`}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                            onClick={() => approveCenterMutation.mutate({ centerId: c.id, action: "reject" })}
                            data-testid={`button-reject-center-${c.id}`}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger" className="pt-4 space-y-4">
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Delete Company</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently deletes this company and ALL its data — staff, candidates, activities, and centers. This cannot be undone.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1.5 flex-shrink-0" data-testid="button-delete-company">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {company.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the company and ALL associated data including staff, candidates, and activity records. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => deleteMutation.mutate()}
                        data-testid="button-confirm-delete"
                      >
                        Yes, Delete Company
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
