import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Save, Loader2, Upload, X, ImageIcon,
  MapPin, Layers, RefreshCw, RotateCcw, SlidersHorizontal,
  Eye, EyeOff, School, User, Phone, Mail, Home, ChevronDown,
} from "lucide-react";
import TrainingCenters from "./training-centers";
import { DASHBOARD_HINT_PREFIX, DASHBOARD_HINT_KEYS, DASHBOARD_HINT_LABELS, DASHBOARD_HINT_DESCRIPTIONS, type HintKey } from "@/lib/dashboard-hints";
import { useGetDismissedHints, useResetDismissedHints, useRestoreHint, useDismissHint, getGetDismissedHintsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const SCHEME_OPTIONS = [
  "DDU-GKY", "JSDMS", "PMKVY 3.0", "PMKVY STT",
  "ASDMS", "RSLDC", "MSDE", "State Scheme", "Other",
];

interface CompanyProfile {
  id: string;
  name: string;
  adminName: string | null;
  email: string | null;
  phone: string | null;
  contactPersonName: string | null;
  state: string | null;
  district: string | null;
  officeAddress: string | null;
  pinCode: string | null;
  projectName: string | null;
  logoUrl: string | null;
}

function clearLocalHints(): void {
  Object.keys(localStorage)
    .filter(k => k.startsWith(DASHBOARD_HINT_PREFIX))
    .forEach(k => localStorage.removeItem(k));
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

type Tab = "general" | "centers";

export default function CompanySettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();
  const { data: serverHints } = useGetDismissedHints();
  const { mutate: resetHintsOnServer, isPending: resettingHints } = useResetDismissedHints();
  const { mutate: restoreHintOnServer } = useRestoreHint();
  const { mutate: dismissHintOnServer } = useDismissHint();

  const dismissedHintKeys = serverHints?.dismissedHints ?? [];
  const dismissedHintCount = dismissedHintKeys.length;

  const allHintEntries = Object.values(DASHBOARD_HINT_KEYS).map((key) => ({
    key,
    label: DASHBOARD_HINT_LABELS[key] ?? key,
    dismissed: dismissedHintKeys.includes(key),
  }));

  const handleResetHints = () => {
    resetHintsOnServer(undefined, {
      onSuccess: (data) => {
        clearLocalHints();
        queryClient.setQueryData(getGetDismissedHintsQueryKey(), data);
        toast({ title: "Dashboard hints restored", description: "All dashboard hints will reappear on your next visit." });
      },
      onError: () => {
        toast({ title: "Failed to reset hints", variant: "destructive" });
      },
    });
  };

  const handleRestoreHint = (key: string) => {
    restoreHintOnServer(
      { data: { key } },
      {
        onSuccess: (data) => {
          localStorage.removeItem(key);
          queryClient.setQueryData(getGetDismissedHintsQueryKey(), data);
          toast({ title: "Hint re-enabled", description: `"${DASHBOARD_HINT_LABELS[key as HintKey] ?? key}" will show again on the dashboard.` });
        },
        onError: () => {
          toast({ title: "Failed to re-enable hint", variant: "destructive" });
        },
      },
    );
  };

  const handleDismissHint = (key: string) => {
    dismissHintOnServer(
      { data: { key } },
      {
        onSuccess: (data) => {
          localStorage.setItem(key, "true");
          queryClient.setQueryData(getGetDismissedHintsQueryKey(), data);
          toast({ title: "Hint dismissed", description: `"${DASHBOARD_HINT_LABELS[key as HintKey] ?? key}" will no longer show on the dashboard.` });
        },
        onError: () => {
          toast({ title: "Failed to dismiss hint", variant: "destructive" });
        },
      },
    );
  };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [showSchemePicker, setShowSchemePicker] = useState(false);

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
      setPhone(data.phone ?? "");
      setContactPersonName(data.contactPersonName ?? "");
      setState(data.state ?? "");
      setDistrict(data.district ?? "");
      setOfficeAddress(data.officeAddress ?? "");
      setPinCode(data.pinCode ?? "");
      setProjectName(data.projectName ?? "");
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
          phone: phone.trim() || null,
          contactPersonName: contactPersonName.trim() || null,
          state: state.trim() || null,
          district: district.trim() || null,
          officeAddress: officeAddress.trim() || null,
          pinCode: pinCode.trim() || null,
          projectName: projectName.trim() || null,
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
        {activeTab === "general" && (
          <Button variant="ghost" size="icon" onClick={loadProfile} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "general"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          General Settings
        </button>
        <button
          onClick={() => setActiveTab("centers")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "centers"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <School className="h-3.5 w-3.5" />
          Training Centers
        </button>
      </div>

      {/* Training Centers Tab */}
      {activeTab === "centers" && <TrainingCenters />}

      {activeTab === "general" && loading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : activeTab === "general" ? (
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

          {/* Organization Details */}
          <div className="border rounded-xl p-6 bg-card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Organization Details</h2>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Company Name <span className="text-red-500 ml-0.5">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Nistha Skill Development"
                />
              </div>

              {/* Project / Scheme dropdown */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  Project / Scheme
                </Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSchemePicker(v => !v)}
                    className="w-full flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span className={projectName ? "text-foreground" : "text-muted-foreground"}>
                      {projectName || "Select scheme / project"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                  {showSchemePicker && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {SCHEME_OPTIONS.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${projectName === opt ? "bg-accent font-medium" : ""}`}
                          onClick={() => { setProjectName(opt); setShowSchemePicker(false); }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Contact Person Name
                </Label>
                <Input
                  value={contactPersonName}
                  onChange={e => setContactPersonName(e.target.value)}
                  placeholder="e.g. Amrendra Pandey"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Mobile Number
                </Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Email ID
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contact@organization.com"
                />
              </div>
            </div>
          </div>

          {/* Head Office Address & Location */}
          <div className="border rounded-xl p-6 bg-card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Home className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Head Office Address &amp; Location</h2>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Home className="h-3.5 w-3.5 text-muted-foreground" />
                  Office Address
                </Label>
                <Input
                  value={officeAddress}
                  onChange={e => setOfficeAddress(e.target.value)}
                  placeholder="e.g. 12, MG Road, Ranchi"
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
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  Pincode
                </Label>
                <Input
                  value={pinCode}
                  onChange={e => setPinCode(e.target.value)}
                  placeholder="e.g. 834001"
                  maxLength={6}
                />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="border rounded-xl p-6 bg-card space-y-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Preferences</h2>
              </div>
              {dismissedHintCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={resettingHints}
                  onClick={handleResetHints}
                  className="gap-1.5 text-xs text-muted-foreground h-7 px-2"
                >
                  {resettingHints ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Re-enable all
                </Button>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Dashboard hints</p>
              <p className="text-xs text-muted-foreground">
                {dismissedHintCount > 0
                  ? `${dismissedHintCount} hint${dismissedHintCount === 1 ? "" : "s"} currently dismissed.`
                  : "All dashboard hints are visible."}
              </p>
            </div>
            <div className="space-y-2">
              {allHintEntries.map(({ key, label, dismissed }) => (
                <div
                  key={key}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {dismissed ? (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{label}</span>
                        <span className={`text-xs shrink-0 ${dismissed ? "text-muted-foreground" : "text-emerald-600 font-medium"}`}>
                          {dismissed ? "Dismissed" : "Visible"}
                        </span>
                      </div>
                      {DASHBOARD_HINT_DESCRIPTIONS[key] && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {DASHBOARD_HINT_DESCRIPTIONS[key]}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs shrink-0"
                    onClick={() => dismissed ? handleRestoreHint(key) : handleDismissHint(key)}
                  >
                    {dismissed ? "Re-enable" : "Dismiss"}
                  </Button>
                </div>
              ))}
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
      ) : null}
    </div>
  );
}
