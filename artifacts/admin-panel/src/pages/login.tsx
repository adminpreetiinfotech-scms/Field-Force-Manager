import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCheckPhone, useLoginMpin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, GraduationCap, ArrowLeft, Phone, KeyRound, ShieldCheck, Lock } from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function apiFetch(path: string, body: Record<string, string>) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.title ?? "Something went wrong");
  return data;
}

type Step = "phone" | "mpin" | "forgot-phone" | "forgot-otp" | "forgot-new-mpin";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [mpin, setMpin] = useState("");
  const [, setLocation] = useLocation();
  const { setUser } = useAuth();
  const { toast } = useToast();

  // Forgot MPIN state
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewMpin, setForgotNewMpin] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

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
    if (mpin.length < 4) return;
    try {
      const res = await loginMpin.mutateAsync({ data: { phone, mpin } });
      if (res.user.role === "staff") {
        toast({ title: "Access Denied", description: "Only admins can access this panel.", variant: "destructive" });
        return;
      }
      setUser(res.user);
      setLocation((res.user.role as string) === "super_admin" ? "/super-admin/companies" : "/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Invalid MPIN.", variant: "destructive" });
    }
  };

  // ── Forgot MPIN handlers ───────────────────────────────────────────────────
  const startForgotFlow = () => {
    setForgotPhone(phone || "");
    setForgotOtp("");
    setForgotNewMpin("");
    setStep("forgot-phone");
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotPhone.length !== 10) {
      toast({ title: "Invalid Phone", description: "10-digit phone number required.", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    try {
      const res = await apiFetch("/auth/forgot-mpin/send-otp", { phone: forgotPhone });
      setMaskedPhone(res.maskedPhone ?? `XXXXXX${forgotPhone.slice(-4)}`);
      setStep("forgot-otp");
      startResendCooldown();
      toast({ title: "OTP Sent", description: `OTP aapke phone ${res.maskedPhone} par bheja gaya.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(30);
    const timer = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setForgotLoading(true);
    try {
      const res = await apiFetch("/auth/forgot-mpin/send-otp", { phone: forgotPhone });
      setMaskedPhone(res.maskedPhone ?? `XXXXXX${forgotPhone.slice(-4)}`);
      startResendCooldown();
      setForgotOtp("");
      toast({ title: "OTP Resent", description: "Naya OTP bheja gaya." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotOtp.length !== 6) return;
    setStep("forgot-new-mpin");
  };

  const handleResetMpin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotNewMpin.length < 4) return;
    setForgotLoading(true);
    try {
      await apiFetch("/auth/forgot-mpin/verify-reset", {
        phone: forgotPhone,
        otp: forgotOtp,
        newMpin: forgotNewMpin,
      });
      toast({ title: "MPIN Reset!", description: "Aapka MPIN successfully reset ho gaya. Ab login karein." });
      setPhone(forgotPhone);
      setMpin("");
      setForgotPhone("");
      setForgotOtp("");
      setForgotNewMpin("");
      setStep("mpin");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      if (err.message?.includes("expired") || err.message?.includes("Too many")) {
        setStep("forgot-phone");
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{
        background: "linear-gradient(135deg, hsl(222,60%,12%) 0%, hsl(224,55%,10%) 50%, hsl(220,60%,14%) 100%)",
      }}
    >
      {/* Left decorative panel — hidden on mobile */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 p-12 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }} />
        <div className="absolute bottom-10 right-0 w-56 h-56 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
        <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #f97316, transparent)" }} />

        <div className="relative z-10">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-xl"
            style={{ background: "linear-gradient(135deg, #06b6d4, #6366f1)" }}
          >
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white leading-tight">
            Skill Center<br />Management System
          </h1>
          <p className="mt-3 text-slate-400 text-sm leading-relaxed">
            Praiaiti Infotech's white-label platform for DDU-GKY, JSDMS, PMKVY and other skill development programs.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { color: "#06b6d4", label: "Staff & Attendance Tracking" },
            { color: "#6366f1", label: "Candidate Management" },
            { color: "#f97316", label: "Live Field Map & Reports" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-slate-400 text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className="w-full max-w-sm rounded-2xl p-8 shadow-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-xl"
              style={{ background: "linear-gradient(135deg, #06b6d4, #6366f1)" }}
            >
              {step.startsWith("forgot") ? (
                <Lock className="h-8 w-8 text-white" />
              ) : (
                <GraduationCap className="h-8 w-8 text-white" />
              )}
            </div>
            <h2 className="text-xl font-bold text-white">
              {step === "phone" && "Admin Login"}
              {step === "mpin" && "Enter MPIN"}
              {step === "forgot-phone" && "Forgot MPIN"}
              {step === "forgot-otp" && "Verify OTP"}
              {step === "forgot-new-mpin" && "Set New MPIN"}
            </h2>
            <p className="text-slate-400 text-sm mt-1">SCMS — Skill Center Management</p>
          </div>

          {/* ── Step: Phone ── */}
          {step === "phone" && (
            <form onSubmit={handlePhoneSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-cyan-400" />
                  Phone Number
                </label>
                <Input
                  type="tel"
                  placeholder="Enter 10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  autoFocus
                  className="bg-white/8 border-white/15 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500"
                />
              </div>
              <Button
                type="submit"
                className="w-full font-semibold text-sm h-10"
                disabled={checkPhone.isPending || phone.length !== 10}
                style={{ background: "linear-gradient(90deg, #06b6d4, #6366f1)", border: "none" }}
              >
                {checkPhone.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
              </Button>
            </form>
          )}

          {/* ── Step: MPIN ── */}
          {step === "mpin" && (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="space-y-4 text-center">
                <div className="flex items-center gap-2 justify-center text-slate-400 text-sm">
                  <KeyRound className="h-4 w-4 text-cyan-400" />
                  Enter MPIN for{" "}
                  <span className="font-semibold text-white">{phone}</span>
                </div>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={mpin} onChange={setMpin} autoFocus>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-white/15 text-slate-300 hover:bg-white/8 gap-1.5"
                  onClick={() => { setStep("phone"); setMpin(""); }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 font-semibold"
                  disabled={loginMpin.isPending || mpin.length < 4}
                  style={{ background: "linear-gradient(90deg, #06b6d4, #6366f1)", border: "none" }}
                >
                  {loginMpin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
                </Button>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={startForgotFlow}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
                >
                  MPIN bhool gaye? Reset karein
                </button>
              </div>
            </form>
          )}

          {/* ── Step: Forgot — Enter Phone ── */}
          {step === "forgot-phone" && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <p className="text-sm text-slate-400 text-center">
                Aapke registered phone number par OTP bheja jayega.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-cyan-400" />
                  Admin Phone Number
                </label>
                <Input
                  type="tel"
                  placeholder="Enter 10-digit number"
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  autoFocus
                  className="bg-white/8 border-white/15 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-white/15 text-slate-300 hover:bg-white/8 gap-1.5"
                  onClick={() => setStep("mpin")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 font-semibold"
                  disabled={forgotLoading || forgotPhone.length !== 10}
                  style={{ background: "linear-gradient(90deg, #06b6d4, #6366f1)", border: "none" }}
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "OTP Bhejo"}
                </Button>
              </div>
            </form>
          )}

          {/* ── Step: Forgot — Verify OTP ── */}
          {step === "forgot-otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="space-y-1 text-center">
                <div className="flex items-center gap-2 justify-center text-slate-400 text-sm">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  OTP bheja gaya: <span className="font-semibold text-white">{maskedPhone}</span>
                </div>
                <p className="text-xs text-slate-500">10 minutes mein expire hoga</p>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={forgotOtp} onChange={setForgotOtp} autoFocus>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-white/15 text-slate-300 hover:bg-white/8 gap-1.5"
                  onClick={() => setStep("forgot-phone")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 font-semibold"
                  disabled={forgotOtp.length !== 6}
                  style={{ background: "linear-gradient(90deg, #06b6d4, #6366f1)", border: "none" }}
                >
                  Verify
                </Button>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || forgotLoading}
                  className="text-xs text-cyan-400 hover:text-cyan-300 disabled:text-slate-500 disabled:cursor-not-allowed underline underline-offset-2 transition-colors"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "OTP dobara bhejo"}
                </button>
              </div>
            </form>
          )}

          {/* ── Step: Forgot — Set New MPIN ── */}
          {step === "forgot-new-mpin" && (
            <form onSubmit={handleResetMpin} className="space-y-6">
              <div className="space-y-1 text-center">
                <div className="flex items-center gap-2 justify-center text-slate-400 text-sm">
                  <Lock className="h-4 w-4 text-cyan-400" />
                  Naya MPIN set karein
                </div>
                <p className="text-xs text-slate-500">4 se 6 digits</p>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={forgotNewMpin} onChange={setForgotNewMpin} autoFocus>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-white/15 text-slate-300 hover:bg-white/8 gap-1.5"
                  onClick={() => setStep("forgot-otp")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 font-semibold"
                  disabled={forgotLoading || forgotNewMpin.length < 4}
                  style={{ background: "linear-gradient(90deg, #06b6d4, #6366f1)", border: "none" }}
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "MPIN Reset Karein"}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-slate-500">
            Nayi training center?{" "}
            <Link href="/company-register" className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2">
              Register karein
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
