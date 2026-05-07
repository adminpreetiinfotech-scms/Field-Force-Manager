import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, ShieldCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Indian states list ────────────────────────────────────────────────────────
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra & Nagar Haveli and Daman & Diu",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

// ─── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(2, "Min 2 characters required"),
  contactPersonName: z.string().min(2, "Min 2 characters required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Valid 10-digit Indian mobile number chahiye"),
  email: z.string().email("Valid email chahiye").optional().or(z.literal("")),
  state: z.string().min(1, "State select karein"),
  district: z.string().min(2, "District required"),
  officeAddress: z.string().optional(),
  pinCode: z.string().regex(/^\d{6}$/, "6-digit PIN code chahiye").optional().or(z.literal("")),
  projectName: z.string().optional(),
  plan: z.enum(["basic", "standard", "premium"]).default("basic"),
  message: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Plan details ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "basic" as const,
    label: "Basic",
    price: "₹5,000/month",
    features: ["Up to 50 staff", "Mobile app access", "Basic reports", "Email support"],
    color: "border-blue-200 bg-blue-50",
    badge: "text-blue-700 bg-blue-100",
  },
  {
    id: "standard" as const,
    label: "Standard",
    price: "₹10,000/month",
    features: ["Up to 200 staff", "All Basic features", "SMS notifications", "Live location tracking", "Priority support"],
    color: "border-violet-200 bg-violet-50",
    badge: "text-violet-700 bg-violet-100",
    popular: true,
  },
  {
    id: "premium" as const,
    label: "Premium",
    price: "₹20,000/month",
    features: ["Unlimited staff", "All Standard features", "Custom branding", "Dedicated support", "Analytics dashboard"],
    color: "border-amber-200 bg-amber-50",
    badge: "text-amber-700 bg-amber-100",
  },
];

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ name, phone }: { name: string; phone: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Application Submit Ho Gayi!</h1>
          <p className="text-gray-600 mt-2">
            <span className="font-semibold">{name}</span> ki SCMS registration request humein mil gayi hai.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-5 text-left space-y-3">
          <p className="text-sm font-semibold text-gray-700">Aage kya hoga:</p>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="h-5 w-5 rounded-full bg-green-100 text-green-700 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">1</span>
              <span>Aapke number <strong>{phone}</strong> pe ek SMS confirmation aaya hoga</span>
            </li>
            <li className="flex gap-2">
              <span className="h-5 w-5 rounded-full bg-green-100 text-green-700 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">2</span>
              <span>Hamare team 24-48 ghante mein aapki application review karegi</span>
            </li>
            <li className="flex gap-2">
              <span className="h-5 w-5 rounded-full bg-green-100 text-green-700 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">3</span>
              <span>Approve hone ke baad aapko SMS aayega aur login credentials milenge</span>
            </li>
          </ol>
        </div>
        <p className="text-xs text-gray-500">
          Koi sawaal ho toh humse sampark karein. Application ID save kar lein: <span className="font-mono">{phone}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Main registration page ───────────────────────────────────────────────────
export default function RegisterPage() {
  const [submitted, setSubmitted] = useState<{ name: string; phone: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "standard" | "premium">("basic");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", contactPersonName: "", phone: "", email: "", state: "", district: "", plan: "basic" },
  });

  async function onSubmit(data: FormData) {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/public/company-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, email: data.email || null, pinCode: data.pinCode || null }),
      });
      const json = await res.json() as { title?: string; message?: string };
      if (!res.ok) {
        setServerError(json.title ?? "Kuch galat hua. Dobara try karein.");
        return;
      }
      setSubmitted({ name: data.name, phone: data.phone });
    } catch {
      setServerError("Network error. Internet connection check karein aur dobara try karein.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) return <SuccessScreen name={submitted.name} phone={submitted.phone} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-tight">SCMS Platform</p>
            <p className="text-xs text-gray-500">Skill Center Management System</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SCMS ke liye Apply Karein</h1>
          <p className="text-gray-600 text-sm max-w-lg mx-auto">
            DDU-GKY / PMKVY training center ke liye SCMS ka access paane ke liye yeh form bharein.
            Hamare team 24-48 ghante mein aapko contact karegi.
          </p>
        </div>

        {/* Plan selection */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Plan Chunein</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  setSelectedPlan(plan.id);
                  form.setValue("plan", plan.id);
                }}
                className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                  selectedPlan === plan.id
                    ? `${plan.color} border-current ring-2 ring-offset-1 ring-primary/30`
                    : "bg-white border-gray-200 hover:border-gray-300"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 left-3 text-xs font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white">
                    Popular
                  </span>
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${plan.badge}`}>{plan.label}</span>
                    {selectedPlan === plan.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="font-bold text-gray-900 text-sm">{plan.price}</p>
                  <ul className="space-y-0.5">
                    {plan.features.map((f) => (
                      <li key={f} className="text-xs text-gray-600 flex items-start gap-1">
                        <span className="text-green-500 mt-0.5">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* Organization details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Training Center / Organization Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Prerna Skill Development Center" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="contactPersonName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person Name <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Full name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="10-digit number" inputMode="numeric" maxLength={10} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="contact@example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="projectName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="DDU-GKY / PMKVY / etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="State chunein" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {INDIAN_STATES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="district" render={({ field }) => (
                    <FormItem>
                      <FormLabel>District <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Ranchi" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="officeAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Office Address (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Full address" rows={2} className="resize-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="pinCode" render={({ field }) => (
                  <FormItem className="max-w-[160px]">
                    <FormLabel>PIN Code (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Additional message */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Kuch aur kehna hai? (optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Koi specific zaroorat ya sawaal..."
                        rows={3}
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-base font-semibold">
              {isSubmitting ? "Submit ho raha hai..." : "Application Submit Karein"}
            </Button>

            <p className="text-center text-xs text-gray-500">
              Form submit karne ke baad aapke mobile pe SMS confirmation aayega.
              Koi pareshani? <span className="text-primary">Support se sampark karein.</span>
            </p>
          </form>
        </Form>
      </div>
    </div>
  );
}
