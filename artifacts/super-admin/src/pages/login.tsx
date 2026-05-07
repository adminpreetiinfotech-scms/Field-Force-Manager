import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { BASE } from "@/lib/api";

const phoneSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
});
const mpinSchema = z.object({
  mpin: z.string().min(4, "MPIN must be at least 4 digits").max(6).regex(/^\d+$/, "Digits only"),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type MpinForm = z.infer<typeof mpinSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"phone" | "mpin">("phone");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const mpinForm = useForm<MpinForm>({
    resolver: zodResolver(mpinSchema),
    defaultValues: { mpin: "" },
  });

  async function onPhoneSubmit(data: PhoneForm) {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/check-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.title ?? "Phone not found");
      if (!json.exists) {
        phoneForm.setError("phone", { message: "Phone number not registered" });
        return;
      }
      setPhone(data.phone);
      setStep("mpin");
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Check failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function onMpinSubmit(data: MpinForm) {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/login-mpin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, mpin: data.mpin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.title ?? "Login failed");
      if (json.user?.role !== "super_admin") {
        mpinForm.setError("mpin", { message: "Not authorized as super admin" });
        return;
      }
      localStorage.setItem("sa_phone", phone);
      setLocation("/dashboard");
    } catch (err: unknown) {
      toast({ title: "Login failed", description: err instanceof Error ? err.message : "Invalid credentials", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4 shadow-md">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">SCMS Ops</h1>
          <p className="text-muted-foreground text-sm mt-1">Super Admin Control Panel</p>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-6 shadow-sm">
          {step === "phone" ? (
            <>
              <h2 className="text-base font-semibold mb-1 text-foreground">Sign in</h2>
              <p className="text-sm text-muted-foreground mb-5">Enter your registered mobile number</p>
              <Form {...phoneForm}>
                <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
                  <FormField
                    control={phoneForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-phone"
                            placeholder="10-digit mobile"
                            inputMode="numeric"
                            maxLength={10}
                            autoFocus
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button data-testid="button-next" type="submit" className="w-full" disabled={loading}>
                    {loading ? "Checking..." : "Continue"}
                  </Button>
                </form>
              </Form>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep("phone"); mpinForm.reset(); }}
                className="text-xs text-muted-foreground mb-4 hover:text-foreground flex items-center gap-1 transition-colors"
                data-testid="button-back"
              >
                ← {phone}
              </button>
              <h2 className="text-base font-semibold mb-1 text-foreground">Enter MPIN</h2>
              <p className="text-sm text-muted-foreground mb-5">Your 4–6 digit security PIN</p>
              <Form {...mpinForm}>
                <form onSubmit={mpinForm.handleSubmit(onMpinSubmit)} className="space-y-4">
                  <FormField
                    control={mpinForm.control}
                    name="mpin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MPIN</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-mpin"
                            type="password"
                            placeholder="••••"
                            inputMode="numeric"
                            maxLength={6}
                            autoFocus
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button data-testid="button-login" type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </Form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
