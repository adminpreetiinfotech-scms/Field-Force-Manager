import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, User, Lock, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  empCode: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ["super-admin-profile"],
    queryFn: () => apiFetch("/super-admin/profile"),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentMpin, setCurrentMpin] = useState("");
  const [newMpin, setNewMpin] = useState("");
  const [confirmMpin, setConfirmMpin] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email ?? "");
    }
  }, [profile]);

  const profileMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch("/super-admin/profile", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["super-admin-profile"] });
      toast({ title: "Profile updated successfully" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const mpinMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch("/super-admin/profile", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "MPIN changed successfully" });
      setCurrentMpin("");
      setNewMpin("");
      setConfirmMpin("");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    const updates: Record<string, string> = {};
    if (name.trim() && name !== profile?.name) updates.name = name.trim();
    if (email !== (profile?.email ?? "")) updates.email = email;
    if (Object.keys(updates).length === 0) {
      toast({ title: "No changes to save" });
      return;
    }
    profileMutation.mutate(updates);
  }

  function handleMpinChange(e: React.FormEvent) {
    e.preventDefault();
    if (!currentMpin || !newMpin || !confirmMpin) {
      toast({ title: "All MPIN fields are required", variant: "destructive" });
      return;
    }
    if (newMpin !== confirmMpin) {
      toast({ title: "New MPINs do not match", variant: "destructive" });
      return;
    }
    if (!/^\d{4,6}$/.test(newMpin)) {
      toast({ title: "MPIN must be 4–6 digits", variant: "destructive" });
      return;
    }
    mpinMutation.mutate({ currentMpin, mpin: newMpin });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your super admin account</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Employee Code</Label>
                  <Input value={profile?.empCode ?? ""} disabled className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input value={profile?.phone ?? ""} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Phone number cannot be changed from here</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <Button type="submit" size="sm" disabled={profileMutation.isPending}>
                    <Save className="h-4 w-4 mr-1.5" />
                    {profileMutation.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Change MPIN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMpinChange} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentMpin">Current MPIN</Label>
                <Input
                  id="currentMpin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentMpin}
                  onChange={(e) => setCurrentMpin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter current MPIN"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newMpin">New MPIN</Label>
                <Input
                  id="newMpin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newMpin}
                  onChange={(e) => setNewMpin(e.target.value.replace(/\D/g, ""))}
                  placeholder="4–6 digit MPIN"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmMpin">Confirm New MPIN</Label>
                <Input
                  id="confirmMpin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmMpin}
                  onChange={(e) => setConfirmMpin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Repeat new MPIN"
                />
                {newMpin && confirmMpin && newMpin !== confirmMpin && (
                  <p className="text-xs text-destructive">MPINs do not match</p>
                )}
              </div>
              <div className="flex justify-end pt-1">
                <Button type="submit" size="sm" disabled={mpinMutation.isPending}>
                  <Lock className="h-4 w-4 mr-1.5" />
                  {mpinMutation.isPending ? "Changing..." : "Change MPIN"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            Platform Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Platform Name", value: "SCMS Ops" },
              { label: "Product", value: "Skill Center Management System" },
              { label: "Role", value: "Super Administrator" },
              { label: "Access Level", value: "Full Platform Access" },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{item.label}</p>
                <p className="text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
