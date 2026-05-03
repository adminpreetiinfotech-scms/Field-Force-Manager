import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

type Fields = {
  name: string;
  phone: string;
  parentMobile: string;
  dob: string;
  fatherName: string;
  motherName: string;
  gender: string;
  email: string;
  address: string;
  village: string;
  district: string;
  state: string;
  pin: string;
  education: string;
  yearOfPassing: string;
  course: string;
  skillCentreName: string;
  aadhaarNumber: string;
};

const EMPTY: Fields = {
  name: "",
  phone: "",
  parentMobile: "",
  dob: "",
  fatherName: "",
  motherName: "",
  gender: "",
  email: "",
  address: "",
  village: "",
  district: "",
  state: "",
  pin: "",
  education: "",
  yearOfPassing: "",
  course: "",
  skillCentreName: "",
  aadhaarNumber: "",
};

export default function CandidateRegister() {
  const { toast } = useToast();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ name: string } | null>(null);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/candidates/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name.trim(),
          phone: fields.phone.trim(),
          parentMobile: fields.parentMobile.trim(),
          dob: fields.dob.trim(),
          fatherName: fields.fatherName.trim() || null,
          motherName: fields.motherName.trim() || null,
          gender: fields.gender.trim() || null,
          email: fields.email.trim() || null,
          address: fields.address.trim() || null,
          village: fields.village.trim() || null,
          district: fields.district.trim() || null,
          state: fields.state.trim() || null,
          pin: fields.pin.trim() || null,
          education: fields.education.trim() || null,
          yearOfPassing: fields.yearOfPassing.trim() || null,
          course: fields.course.trim() || null,
          skillCentreName: fields.skillCentreName.trim() || null,
          aadhaarNumber: fields.aadhaarNumber.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        title?: string;
        name?: string;
      };
      if (!res.ok) throw new Error(data.title ?? "Registration failed");
      setDone({ name: data.name ?? fields.name });
      setFields(EMPTY);
    } catch (err: any) {
      toast({
        title: "Could not register",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <CardTitle className="text-2xl">Registration Received</CardTitle>
            <CardDescription>
              Thank you, <strong>{done.name}</strong>. Your registration is now
              pending admin review. You will be contacted on the phone number
              you provided once it is approved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => setDone(null)}
            >
              Register Another Candidate
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-2xl">Candidate Registration</CardTitle>
                <CardDescription>
                  Fill in your details. An admin will review and contact you.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Personal Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Full Name *" required>
                    <Input value={fields.name} onChange={set("name")} required minLength={2} />
                  </Field>
                  <Field label="Date of Birth *" required>
                    <Input type="date" value={fields.dob} onChange={set("dob")} required />
                  </Field>
                  <Field label="Your Mobile *" required>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      value={fields.phone}
                      onChange={set("phone")}
                      required
                      placeholder="10-digit number"
                    />
                  </Field>
                  <Field label="Parent's Mobile *" required>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      value={fields.parentMobile}
                      onChange={set("parentMobile")}
                      required
                      placeholder="10-digit number"
                    />
                  </Field>
                  <Field label="Father's Name">
                    <Input value={fields.fatherName} onChange={set("fatherName")} />
                  </Field>
                  <Field label="Mother's Name">
                    <Input value={fields.motherName} onChange={set("motherName")} />
                  </Field>
                  <Field label="Gender">
                    <Input
                      value={fields.gender}
                      onChange={set("gender")}
                      placeholder="Male / Female / Other"
                    />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={fields.email} onChange={set("email")} />
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Address
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Address" className="sm:col-span-2">
                    <Input value={fields.address} onChange={set("address")} />
                  </Field>
                  <Field label="Village">
                    <Input value={fields.village} onChange={set("village")} />
                  </Field>
                  <Field label="District">
                    <Input value={fields.district} onChange={set("district")} />
                  </Field>
                  <Field label="State">
                    <Input value={fields.state} onChange={set("state")} />
                  </Field>
                  <Field label="PIN Code">
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={fields.pin}
                      onChange={set("pin")}
                      placeholder="6-digit PIN"
                    />
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Education & Course
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Highest Qualification">
                    <Input
                      value={fields.education}
                      onChange={set("education")}
                      placeholder="e.g. 10th, 12th, Graduate"
                    />
                  </Field>
                  <Field label="Year of Passing">
                    <Input
                      inputMode="numeric"
                      maxLength={4}
                      value={fields.yearOfPassing}
                      onChange={set("yearOfPassing")}
                    />
                  </Field>
                  <Field label="Course of Interest">
                    <Input value={fields.course} onChange={set("course")} />
                  </Field>
                  <Field label="Skill Centre">
                    <Input value={fields.skillCentreName} onChange={set("skillCentreName")} />
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Identity (optional)
                </h3>
                <Field label="Aadhaar Number">
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]{12}"
                    maxLength={12}
                    value={fields.aadhaarNumber}
                    onChange={set("aadhaarNumber")}
                    placeholder="12-digit Aadhaar (optional)"
                  />
                </Field>
              </section>

              <Button type="submit" className="w-full" disabled={submitting} size="lg">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...
                  </>
                ) : (
                  "Submit Registration"
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Documents (photo, Aadhaar copy, certificates) can be collected later by our team.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5"></span>}
      </Label>
      {children}
    </div>
  );
}
