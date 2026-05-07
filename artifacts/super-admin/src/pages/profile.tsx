import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface Profile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  empCode: string;
}

const profileSchema = z.object({
  name: z.string().min(2, "Min 2 characters"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
});

const mpinSchema = z.object({
  currentMpin: z.string().min(4, "Min 4 digits").max(6).regex(/^\d+$/, "Digits only"),
  mpin: z.string().min(4, "Min 4 digits").max(6).regex(/^\d+$/, "Digits only"),
  confirmMpin: z.string().min(4).max(6),
}).refine((d) => d.mpin === d.confirmMpin, {
  message: "MPINs do not match",
  path: ["confirmMpin"],
});

type ProfileForm = z.infer<typeof profileSchema>;
type MpinForm = z.infer<typeof mpinSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ["super-admin-profile"],
    queryFn: () => apiFetch("/super-admin/profile"),
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile ? { name: profile.name, email: profile.email ?? "" } : undefined,
  });

  const mpinForm = useForm<MpinForm>({
    resolver: zodResolver(mpinSchema),
    defaultValues: { currentMpin: "", mpin: "", confirmMpin: "" },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProfileForm) => apiFetch("/super-admin/profile", {
      method: "PATCH",
      body: JSON.stringify({ ...data, email: data.email || null }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-profile"] });
      toast({ title: "Profile updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const mpinMutation = useMutation({
    mutationFn: (data: MpinForm) => apiFetch("/super-admin/profile", {
      method: "PATCH",
      body: JSON.stringify({ currentMpin: data.currentMpin, mpin: data.mpin }),
    }),
    onSuccess: () => {
      mpinForm.reset();
      toast({ title: "MPIN changed successfully" });
    },
    onError: (e: Error) => toast({ title: "MPIN change failed", description: e.message, variant: "destructive" }),
  });

  function handleLogout() {
    localStorage.removeItem("sa_phone");
    setLocation("/login");
  }

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage your super admin account</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 p-4 bg-card border border-card-border rounded-lg">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-base font-semibold" data-testid="text-profile-name">{profile?.name}</p>
              <p className="text-sm text-muted-foreground" data-testid="text-profile-phone">{profile?.phone}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5" data-testid="text-profile-empcode">{profile?.empCode}</p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Edit Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
                  <FormField control={profileForm.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input {...field} data-testid="input-profile-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={profileForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} data-testid="input-profile-email" type="email" placeholder="you@example.com" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-profile">
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Change MPIN</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...mpinForm}>
                <form onSubmit={mpinForm.handleSubmit((d) => mpinMutation.mutate(d))} className="space-y-4">
                  <FormField control={mpinForm.control} name="currentMpin" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current MPIN</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-current-mpin" type="password" inputMode="numeric" maxLength={6} placeholder="••••" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={mpinForm.control} name="mpin" render={({ field }) => (
                      <FormItem>
                        <FormLabel>New MPIN</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-new-mpin" type="password" inputMode="numeric" maxLength={6} placeholder="••••" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={mpinForm.control} name="confirmMpin" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm MPIN</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-confirm-mpin" type="password" inputMode="numeric" maxLength={6} placeholder="••••" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Button type="submit" variant="outline" disabled={mpinMutation.isPending} data-testid="button-change-mpin">
                    {mpinMutation.isPending ? "Changing..." : "Change MPIN"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">Sign Out</p>
              <p className="text-xs text-muted-foreground">Clear session and return to login</p>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-1.5" data-testid="button-logout">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
