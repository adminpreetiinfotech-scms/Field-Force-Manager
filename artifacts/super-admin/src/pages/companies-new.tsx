import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, Copy, Check } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const schema = z.object({
  name: z.string().min(2, "Min 2 characters"),
  adminName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  state: z.string().optional(),
  district: z.string().optional(),
  projectName: z.string().optional(),
  plan: z.enum(["basic", "standard", "premium"]).default("basic"),
  subscriptionStartDate: z.string().optional(),
  subscriptionEndDate: z.string().optional(),
  adminPhone: z.string().regex(/^[6-9]\d{9}$/, "Valid 10-digit Indian number").optional().or(z.literal("")),
  adminInitialMpin: z.string().min(4).max(6).regex(/^\d+$/, "Digits only").optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

interface CreatedResult {
  company: { id: string; name: string };
  admin: { empCode: string; name: string; phone: string; adminCode: string } | null;
}

export default function CompaniesNewPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<CreatedResult | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", plan: "basic" },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiFetch("/super-admin/companies", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        email: data.email || null,
        adminPhone: data.adminPhone || null,
        adminInitialMpin: data.adminInitialMpin || null,
      }),
    }),
    onSuccess: (res: CreatedResult) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-dashboard"] });
      setResult(res);
      toast({ title: "Company created", description: res.company.name });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  function copyCredentials() {
    if (!result?.admin) return;
    const text = `Company: ${result.company.name}\nAdmin: ${result.admin.name}\nPhone: ${result.admin.phone}\nEmp Code: ${result.admin.empCode}\nAdmin Code: ${result.admin.adminCode}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (result) {
    return (
      <div className="max-w-lg space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Company Created</h1>
            <p className="text-sm text-muted-foreground">{result.company.name}</p>
          </div>
        </div>

        {result.admin && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Admin Credentials</CardTitle>
                <Button variant="outline" size="sm" onClick={copyCredentials} className="gap-1.5 h-7 text-xs">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                ["Name", result.admin.name],
                ["Phone", result.admin.phone],
                ["Emp Code", result.admin.empCode],
                ["Admin Code", result.admin.adminCode],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={() => setLocation(`/companies/${result.company.id}`)} className="flex-1" data-testid="button-view-company">
            View Company
          </Button>
          <Button variant="outline" onClick={() => { setResult(null); form.reset(); }} data-testid="button-create-another">
            Create Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/companies">
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Company</h1>
          <p className="text-sm text-muted-foreground">Register a new training center tenant</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Company Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl><Input {...field} data-testid="input-company-name" placeholder="e.g. Prerna Skill Center" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="adminName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-admin-name" placeholder="Contact person" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Phone</FormLabel>
                    <FormControl><Input {...field} data-testid="input-company-phone" placeholder="10-digit number" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input {...field} data-testid="input-company-email" type="email" placeholder="admin@example.com" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl><Input {...field} data-testid="input-state" placeholder="Jharkhand" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="district" render={({ field }) => (
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <FormControl><Input {...field} data-testid="input-district" placeholder="Ranchi" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="projectName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-project-name" placeholder="DDU-GKY / PMKVY" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="plan" render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-plan">
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="subscriptionStartDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl><Input {...field} data-testid="input-sub-start" type="date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="subscriptionEndDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input {...field} data-testid="input-sub-end" type="date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">First Admin Account</CardTitle>
              <p className="text-xs text-muted-foreground">Optional — creates a login account for the company admin</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="adminPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Phone</FormLabel>
                    <FormControl><Input {...field} data-testid="input-admin-phone" placeholder="6–9 start, 10 digits" inputMode="numeric" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="adminInitialMpin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial MPIN</FormLabel>
                    <FormControl><Input {...field} data-testid="input-admin-mpin" type="password" placeholder="4–6 digits" inputMode="numeric" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Separator />

          <div className="flex gap-3 pb-4">
            <Button type="submit" disabled={mutation.isPending} data-testid="button-submit" className="flex-1">
              {mutation.isPending ? "Creating..." : "Create Company"}
            </Button>
            <Link href="/companies">
              <Button type="button" variant="outline" data-testid="button-cancel">Cancel</Button>
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
