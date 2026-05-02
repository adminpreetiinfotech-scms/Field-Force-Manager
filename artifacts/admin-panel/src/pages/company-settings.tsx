import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Save, Loader2, Upload, X, ImageIcon,
  MapPin, Layers, GitBranch, RefreshCw,
} from "lucide-react";

interface CompanyProfile {
  id: string;
  name: string;
  adminName: string | null;
  email: string | null;
  state: string | null;
  district: string | null;
  projectName: string | null;
  centerName: string | null;
  logoUrl: string | null;
}

function getAdminPhone(): string {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return (JSON.parse(raw) as { phone?: string }).phone ?? "";
  } catch { return ""; }
}

function getAdminUser(): { phone: string; companyId?: string; role?: string } | null {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
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

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve({ base64, mime: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CompanySettings() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [projectName, setProjectName] = useState("");
  const [centerName, setCenterName] = useState("");

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const user = getAdminUser();
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "super_admin";

  const loadProfile = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await adminFetch(`/api/companies/${companyId}/branding`);
      if (!res.ok) throw new Error("Failed to load company profile");
      const data: CompanyProfile = await res.json();
      setProfile(data);
      setName(data.name ?? "");
      setEmail(data.email ?? "");
      setState(data.state ?? "");
      setDistrict(data.district ?? "");
      setProjectName(data.projectName ?? "");
      setCenterName(data.centerName ?? "");
      setLogoPreview(data.logoUrl ?? null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!companyId) return;
    if (!name.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const profileRes = await adminFetch(`/api/companies/${companyId}/profile`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          state: state.trim() || null,
          district: district.trim() || null,
          projectName: projectName.trim() || null,
          centerName: centerName.trim() || null,
        }),
      });
      if (!profileRes.ok) throw new Error((await profileRes.json().catch(() => ({}))).title ?? "Profile update failed");

      if (logoFile) {
        const { base64, mime } = await fileToBase64(logoFile);
        const logoRes = await adminFetch(`/api/companies/${companyId}/logo`, {
          method: "PATCH",
          body: JSON.stringify({ logoBase64: base64, logoMime: mime }),
        });
        if (!logoRes.ok) throw new Error((await logoRes.json().catch(() => ({}))).title ?? "Logo upload failed");
        const updated = await logoRes.json();
        setLogoPreview(updated.logoUrl ?? logoPreview);
        setLogoFile(null);
      }

      toast({ title: "Settings saved successfully" });
      await loadProfile();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isSuperAdmin) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
        <div className="border rounded-xl p-8 text-center bg-muted/30 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Super Admin does not have a company.</p>
          <p className="text-sm mt-1">Use the <strong>All Companies</strong> section to manage company details.</p>
        </div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
        <div className="border rounded-xl p-8 text-center bg-muted/30 text-muted-foreground">
          <p className="text-sm">No company associated with your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Update your organization's profile and branding</p>
        </div>
        <Button variant="ghost" size="icon" onClick={loadProfile} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Logo */}
          <div className="border rounded-xl p-6 bg-card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Company Logo</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    {logoPreview ? "Change Logo" : "Upload Logo"}
                  </Button>
                  {logoPreview && (
                    <Button variant="ghost" size="sm" onClick={handleRemoveLogo} className="gap-1.5 text-muted-foreground">
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP — max 2MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </div>
            </div>
            {logoFile && (
              <p className="text-xs text-blue-600 flex items-center gap-1.5">
                <Upload className="h-3 w-3" />
                New logo ready to upload: {logoFile.name}
              </p>
            )}
          </div>

          {/* Basic Info */}
          <div className="border rounded-xl p-6 bg-card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Organization Details</h2>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Company Name <span className="text-red-500">*</span></Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Nistha Skill Development"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contact@organization.com"
                />
              </div>
            </div>
          </div>

          {/* Scheme & Location */}
          <div className="border rounded-xl p-6 bg-card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Scheme &amp; Location</h2>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  Scheme / Project Name
                </Label>
                <Input
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="e.g. DDU-GKY / JSDMS"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  Center / Branch Name
                </Label>
                <Input
                  value={centerName}
                  onChange={e => setCenterName(e.target.value)}
                  placeholder="e.g. Ranchi Training Center"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    State
                  </Label>
                  <Input
                    value={state}
                    onChange={e => setState(e.target.value)}
                    placeholder="e.g. Jharkhand"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    District
                  </Label>
                  <Input
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    placeholder="e.g. Ranchi"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pb-4">
            <Button variant="outline" onClick={loadProfile} disabled={saving || loading}>
              Reset Changes
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[120px]">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
