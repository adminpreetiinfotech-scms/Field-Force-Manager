import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, CheckCircle2, Loader2, KeyRound, User, Phone, Mail, MapPin, Briefcase } from "lucide-react";
import { Link } from "wouter";

type Fields = {
  companyName: string;
  companyState: string;
  companyDistrict: string;
  projectName: string;
  adminName: string;
  adminPhone: string;
  adminEmail: string;
  adminRegistrationKey: string;
};

const EMPTY: Fields = {
  companyName: "",
  companyState: "",
  companyDistrict: "",
  projectName: "",
  adminName: "",
  adminPhone: "",
  adminEmail: "",
  adminRegistrationKey: "",
};

type CreatedInfo = {
  companyName: string;
  adminName: string;
  adminPhone: string;
};

export default function CompanyRegister() {
  const { toast } = useToast();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedInfo | null>(null);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((p) => ({ ...p, [key]: e.target.value }));

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let logoBase64: string | null = null;
      let logoMime: string | null = null;

      if (logoFile) {
        logoBase64 = await toBase64(logoFile);
        logoMime = logoFile.type;
      }

      const res = await fetch("/api/companies/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: fields.companyName.trim(),
          companyState: fields.companyState.trim() || null,
          companyDistrict: fields.companyDistrict.trim() || null,
          projectName: fields.projectName.trim() || null,
          adminName: fields.adminName.trim(),
          adminPhone: fields.adminPhone.trim(),
          adminEmail: fields.adminEmail.trim() || null,
          adminRegistrationKey: fields.adminRegistrationKey.trim(),
          logoBase64,
          logoMime,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        title?: string;
        company?: { name: string };
        admin?: { name: string; phone: string };
      };

      if (!res.ok) throw new Error(data.title ?? "Registration failed");

      setCreated({
        companyName: data.company?.name ?? fields.companyName,
        adminName: data.admin?.name ?? fields.adminName,
        adminPhone: data.admin?.phone ?? fields.adminPhone,
      });
      setFields(EMPTY);
      setLogoFile(null);
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <CardTitle className="text-2xl">Registration Successful!</CardTitle>
            <CardDescription className="text-base mt-1">
              <strong>{created.companyName}</strong> successfully registered on SCMS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <p className="font-semibold text-foreground">Aage kya karein / Next Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>
                  Admin Panel mein login karein:{" "}
                  <a
                    href="/admin-panel/login"
                    className="text-primary underline"
                  >
                    Admin Login
                  </a>
                </li>
                <li>
                  Phone: <strong className="text-foreground">{created.adminPhone}</strong> se login karein
                </li>
                <li>OTP milega — enter karke MPIN set karein</li>
                <li>Training Centers mein jaake apne center add karein</li>
                <li>Staff add karein aur field operations shuru karein</li>
              </ol>
            </div>
            <Link href="/login">
              <Button className="w-full" size="lg">
                Admin Panel Login Karein
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 text-primary mb-3">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Training Center Registration</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            SCMS par apna training center register karein — Praiaiti Infotech se Registration Key prapt karke yeh form bharein.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organization &amp; Admin Details</CardTitle>
            <CardDescription>
              Ek baar register hone ke baad aap Admin Panel se apni organization manage kar sakte hain.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              <section className="space-y-3">
                <SectionHeading icon={<Building2 className="h-3.5 w-3.5" />} title="Organization Details" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Training Center / Organization Name *" className="sm:col-span-2">
                    <Input
                      value={fields.companyName}
                      onChange={set("companyName")}
                      required
                      minLength={2}
                      placeholder="e.g. Jharkhand Skills Academy"
                    />
                  </Field>
                  <Field label="Project Name">
                    <Input
                      value={fields.projectName}
                      onChange={set("projectName")}
                      placeholder="e.g. DDU-GKY / JSDMS"
                    />
                  </Field>
                  <Field label="State">
                    <Input
                      value={fields.companyState}
                      onChange={set("companyState")}
                      placeholder="e.g. Jharkhand"
                    />
                  </Field>
                  <Field label="District">
                    <Input
                      value={fields.companyDistrict}
                      onChange={set("companyDistrict")}
                      placeholder="e.g. Ranchi"
                    />
                  </Field>
                  <Field label="Organization Logo (optional)">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                      className="cursor-pointer"
                    />
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <SectionHeading icon={<User className="h-3.5 w-3.5" />} title="Admin Account" />
                <p className="text-xs text-muted-foreground">
                  Yeh details admin ke login ke liye use honge. Ek baar register hone ke baad is phone number se login karein.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Admin Full Name *">
                    <Input
                      value={fields.adminName}
                      onChange={set("adminName")}
                      required
                      minLength={2}
                      placeholder="e.g. Ramesh Kumar"
                    />
                  </Field>
                  <Field label="Admin Phone Number *">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        maxLength={10}
                        value={fields.adminPhone}
                        onChange={set("adminPhone")}
                        required
                        placeholder="10-digit mobile number"
                        className="pl-9"
                      />
                    </div>
                  </Field>
                  <Field label="Admin Email (optional)" className="sm:col-span-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={fields.adminEmail}
                        onChange={set("adminEmail")}
                        placeholder="admin@yourorganization.com"
                        className="pl-9"
                      />
                    </div>
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <SectionHeading icon={<KeyRound className="h-3.5 w-3.5" />} title="Registration Key" />
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <strong>Registration Key kaise milega?</strong> Praiaiti Infotech se contact karein aur woh aapko ek secret Registration Key provide karenge. Bina is key ke registration possible nahi hai.
                </div>
                <Field label="Admin Registration Key *">
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={fields.adminRegistrationKey}
                      onChange={set("adminRegistrationKey")}
                      required
                      placeholder="Praiaiti Infotech se prapt key"
                      className="pl-9"
                    />
                  </div>
                </Field>
              </section>

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering...</>
                ) : (
                  <><Building2 className="h-4 w-4 mr-2" /> Register Training Center</>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already registered?{" "}
                <Link href="/login" className="text-primary underline font-medium">
                  Admin Panel Login
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}
