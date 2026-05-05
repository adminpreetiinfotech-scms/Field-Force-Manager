import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { User, Phone, Mail, Lock, ShieldCheck, Loader2 } from "lucide-react";

const getAdminPhone = () => {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return null;
    return (JSON.parse(raw) as { phone?: string }).phone ?? null;
  } catch { return null; }
};

const API_BASE = "/api";

interface Profile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  empCode: string;
}

export default function SuperAdminProfile() {
  const { user, setUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMpin, setSavingMpin] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [currentMpin, setCurrentMpin] = useState("");
  const [newMpin, setNewMpin] = useState("");
  const [confirmMpin, setConfirmMpin] = useState("");

  const adminPhone = getAdminPhone();

  useEffect(() => {
    if (!adminPhone) return;
    fetch(`${API_BASE}/super-admin/profile`, {
      headers: { "x-admin-phone": adminPhone },
    })
      .then((r) => r.json())
      .then((data: Profile) => {
        setProfile(data);
        setName(data.name);
        setPhone(data.phone);
        setEmail(data.email ?? "");
      })
      .catch(() => toast({ title: "Profile load failed", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [adminPhone]);

  const handleSaveProfile = async () => {
    if (!adminPhone) return;
    if (name.trim().length < 2) { toast({ title: "Name must be at least 2 characters", variant: "destructive" }); return; }
    if (!/^\d{10}$/.test(phone.trim())) { toast({ title: "Phone must be 10 digits", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/super-admin/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-phone": adminPhone },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.title || "Update failed", variant: "destructive" }); return; }

      // Update localStorage if phone changed
      if (user) {
        const updated = { ...user, name: data.name, phone: data.phone };
        setUser(updated);
      }
      setProfile((p) => p ? { ...p, name: data.name, phone: data.phone, email: data.email } : p);
      toast({ title: "Profile updated successfully" });

      // If phone changed, logout so they can re-login with new number
      if (data.phone !== adminPhone) {
        toast({ title: "Phone number changed — please login again" });
        setTimeout(() => setLocation("/login"), 1500);
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeMpin = async () => {
    if (!adminPhone) return;
    if (!currentMpin) { toast({ title: "Enter your current MPIN", variant: "destructive" }); return; }
    if (newMpin.length < 4 || newMpin.length > 6 || !/^\d+$/.test(newMpin)) {
      toast({ title: "New MPIN must be 4–6 digits", variant: "destructive" }); return;
    }
    if (newMpin !== confirmMpin) { toast({ title: "New MPIN and Confirm MPIN don't match", variant: "destructive" }); return; }

    setSavingMpin(true);
    try {
      const res = await fetch(`${API_BASE}/super-admin/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-phone": adminPhone },
        body: JSON.stringify({ mpin: newMpin, currentMpin }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.title || "MPIN change failed", variant: "destructive" }); return; }
      toast({ title: "MPIN changed successfully" });
      setCurrentMpin(""); setNewMpin(""); setConfirmMpin("");
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSavingMpin(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-amber-500" />
          My Profile
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Update your Super Admin name, mobile number, email, and MPIN.
        </p>
      </div>

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Profile Details
          </CardTitle>
          <CardDescription>Change your name, phone number, or email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Employee Code</Label>
            <Input value={profile?.empCode ?? ""} disabled className="bg-muted text-muted-foreground" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="name" className="pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="phone" className="pl-9" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" maxLength={10} />
            </div>
            <p className="text-xs text-muted-foreground">If you change your mobile number, you will be logged out and must login with the new number.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email (optional)</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="email" className="pl-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Change MPIN Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Change MPIN
          </CardTitle>
          <CardDescription>Update your login MPIN (4–6 digits).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentMpin">Current MPIN</Label>
            <Input id="currentMpin" type="password" inputMode="numeric" maxLength={6} value={currentMpin} onChange={(e) => setCurrentMpin(e.target.value)} placeholder="••••" />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="newMpin">New MPIN</Label>
            <Input id="newMpin" type="password" inputMode="numeric" maxLength={6} value={newMpin} onChange={(e) => setNewMpin(e.target.value)} placeholder="New 4–6 digit MPIN" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmMpin">Confirm New MPIN</Label>
            <Input id="confirmMpin" type="password" inputMode="numeric" maxLength={6} value={confirmMpin} onChange={(e) => setConfirmMpin(e.target.value)} placeholder="Repeat new MPIN" />
          </div>

          <Button onClick={handleChangeMpin} disabled={savingMpin} variant="outline" className="w-full">
            {savingMpin ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Changing...</> : "Change MPIN"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
