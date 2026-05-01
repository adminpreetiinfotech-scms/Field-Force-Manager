import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCheckPhone, useLoginMpin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "mpin">("phone");
  const [mpin, setMpin] = useState("");
  const [, setLocation] = useLocation();
  const { setUser } = useAuth();
  const { toast } = useToast();

  const checkPhone = useCheckPhone();
  const loginMpin = useLoginMpin();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) {
      toast({ title: "Invalid Phone", description: "Please enter a valid 10-digit phone number.", variant: "destructive" });
      return;
    }

    try {
      const res = await checkPhone.mutateAsync({ data: { phone } });
      if (!res.exists || !res.hasMpin) {
        toast({ title: "Not found", description: "Account not found or MPIN not set. Please contact admin.", variant: "destructive" });
        return;
      }
      setStep("mpin");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to check phone number.", variant: "destructive" });
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mpin.length !== 4) return;

    try {
      const res = await loginMpin.mutateAsync({ data: { phone, mpin } });
      if (res.user.role === "staff") {
        toast({ title: "Access Denied", description: "Only admins can access this panel.", variant: "destructive" });
        return;
      }
      setUser(res.user);
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Invalid MPIN.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-xl font-bold mb-4">
            NS
          </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Nistha Skill Admin Panel</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  type="tel"
                  placeholder="Enter 10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={checkPhone.isPending || phone.length !== 10}>
                {checkPhone.isPending ? <Loader2 className="animate-spin" /> : "Continue"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Enter 4-digit MPIN for <span className="font-medium text-foreground">{phone}</span>
                </p>
                <div className="flex justify-center">
                  <InputOTP maxLength={4} value={mpin} onChange={setMpin} autoFocus>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("phone")}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loginMpin.isPending || mpin.length !== 4}>
                  {loginMpin.isPending ? <Loader2 className="animate-spin" /> : "Login"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
