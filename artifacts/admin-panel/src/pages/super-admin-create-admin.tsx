import { useState } from "react";
import { useListCompanies } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus, Loader2, Building2, Phone, Mail,
  KeyRound, CheckCircle2, Copy, ChevronLeft, RefreshCw,
} from "lucide-react";
import { Link } from "wouter";

function getAdminPhone(): string {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return (JSON.parse(raw) as { phone?: string }).phone ?? "";
  } catch { return ""; }
}

interface CreatedAdmin {
  id: string;
  empCode: string;
  name: string;
  phone: string;
  role: string;
  companyId: string | null;
  adminCode: string | null;
  email: string | null;
  createdAt: string | null;
}

interface CreatedResult {
  admin: CreatedAdmin;
  company: { id: string; name: string };
}

export default function SuperAdminCreateAdmin() {
  const { data: companies, isLoading: companiesLoading } = useListCompanies();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [initialMpin, setInitialMpin] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedResult | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!phone.trim()) e.phone = "Mobile number is required";
    else if (!/^[6-9]\d{9}$/.test(phone.trim())) e.phone = "Enter valid 10-digit Indian mobile number";
    if (!companyId) e.companyId = "Please select a company";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Invalid email address";
    if (initialMpin && !/^\d{4,6}$/.test(initialMpin)) e.initialMpin = "MPIN must be 4–6 digits";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/company-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-phone": getAdminPhone(),
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          companyId,
          initialMpin: initialMpin || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.title ?? "Failed to create admin");
      setCreated(data as CreatedResult);
      toast({ title: "Company admin created successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCreated(null);
    setName("");
    setPhone("");
    setEmail("");
    setCompanyId("");
    setInitialMpin("");
    setErrors({});
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  if (created) {
    return (
      <div className="max-w-xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/super-admin/companies">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Company Admin Created</h1>
        </div>

        <div className="border rounded-xl p-6 bg-card space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-700">Admin created successfully</p>
              <p className="text-xs text-muted-foreground">Share login details with the admin</p>
            </div>
          </div>

          <div className="divide-y rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{created.admin.name}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Mobile Number</p>
                <p className="font-mono font-medium">{created.admin.phone}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyText(created.admin.phone, "Mobile")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            {created.admin.email && (
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{created.admin.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Employee Code</p>
                <p className="font-mono font-medium">{created.admin.empCode}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyText(created.admin.empCode, "Emp Code")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
              <div>
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="font-medium">{created.company.name}</p>
              </div>
              <Badge variant="secondary">Admin</Badge>
            </div>
            {created.admin.adminCode && (
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Staff Registration Code</p>
                  <p className="font-mono font-medium tracking-widest">{created.admin.adminCode}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyText(created.admin.adminCode!, "Admin Code")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {!initialMpin && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium">MPIN not set</p>
              <p className="text-xs mt-0.5">The admin will need to set their MPIN on first login using the "Forgot MPIN" option.</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={handleReset} className="gap-2 flex-1">
              <RefreshCw className="h-4 w-4" />
              Create Another Admin
            </Button>
            <Link href="/super-admin/companies" className="flex-1">
              <Button variant="default" className="w-full gap-2">
                <Building2 className="h-4 w-4" />
                View Companies
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/super-admin/companies">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Company Admin</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Add a new admin for an existing company</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Personal Info */}
        <div className="border rounded-xl p-6 bg-card space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Admin Details</h2>

          <div className="space-y-1.5">
            <Label htmlFor="name">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Mobile Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
              className={errors.phone ? "border-red-500" : ""}
            />
            {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email Address <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@organization.com"
              className={errors.email ? "border-red-500" : ""}
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>
        </div>

        {/* Company Selection */}
        <div className="border rounded-xl p-6 bg-card space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Assign to Company</h2>

          <div className="space-y-1.5">
            <Label htmlFor="company" className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Company <span className="text-red-500">*</span>
            </Label>
            {companiesLoading ? (
              <Skeleton className="h-10 rounded-md" />
            ) : (
              <select
                id="company"
                value={companyId}
                onChange={e => setCompanyId(e.target.value)}
                className={`w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${
                  errors.companyId ? "border-red-500" : "border-input"
                }`}
              >
                <option value="">Select a company…</option>
                {(companies ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.status === "inactive" ? "(inactive)" : ""}
                  </option>
                ))}
              </select>
            )}
            {errors.companyId && <p className="text-xs text-red-500">{errors.companyId}</p>}
          </div>
        </div>

        {/* Initial MPIN */}
        <div className="border rounded-xl p-6 bg-card space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Login Security</h2>

          <div className="space-y-1.5">
            <Label htmlFor="mpin" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              Initial MPIN <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="mpin"
              type="password"
              value={initialMpin}
              onChange={e => setInitialMpin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="4–6 digit MPIN"
              className={errors.initialMpin ? "border-red-500" : ""}
              maxLength={6}
            />
            {errors.initialMpin && <p className="text-xs text-red-500">{errors.initialMpin}</p>}
            <p className="text-xs text-muted-foreground">
              If left blank, the admin can set their MPIN on first login using "Forgot MPIN".
            </p>
          </div>
        </div>

        <div className="flex gap-3 pb-4">
          <Link href="/super-admin/companies" className="flex-1">
            <Button type="button" variant="outline" className="w-full">Cancel</Button>
          </Link>
          <Button type="submit" disabled={saving} className="flex-1 gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Create Admin
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
