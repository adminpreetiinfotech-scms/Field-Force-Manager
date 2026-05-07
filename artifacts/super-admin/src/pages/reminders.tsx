import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Play, CheckCircle2, AlertTriangle, XCircle, Clock, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ReminderStatus {
  id: string;
  name: string;
  phone: string | null;
  plan: string | null;
  subscriptionEndDate: string | null;
  subscriptionReminderSentAt: string | null;
  subscriptionActive: boolean;
  status: string;
  daysLeft: number | null;
  urgency: "none" | "expired" | "critical" | "urgent" | "warning" | "notice" | "ok";
}

interface RunResult {
  message: string;
  checked: number;
  sent: number;
  skipped: number;
  errors: number;
}

const URGENCY_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  expired:  { label: "Expired",    color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    icon: XCircle },
  critical: { label: "1 day left", color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",    icon: AlertTriangle },
  urgent:   { label: "3 days",     color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", icon: AlertTriangle },
  warning:  { label: "7 days",     color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200",  icon: Clock },
  notice:   { label: "30 days",    color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   icon: Bell },
  ok:       { label: "Safe",       color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200",  icon: CheckCircle2 },
  none:     { label: "No date",    color: "text-gray-500",   bg: "bg-gray-50",   border: "border-gray-200",   icon: Clock },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function timeAgo(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "less than 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RemindersPage() {
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: statuses, isLoading } = useQuery<ReminderStatus[]>({
    queryKey: ["sub-reminder-status"],
    queryFn: () => apiFetch("/super-admin/subscription-reminders/status"),
    refetchInterval: 30_000,
  });

  const runMutation = useMutation({
    mutationFn: () => apiFetch("/super-admin/subscription-reminders/run", { method: "POST" }),
    onSuccess: (data: RunResult) => {
      setLastResult(data);
      qc.invalidateQueries({ queryKey: ["sub-reminder-status"] });
      toast({
        title: `Done! ${data.sent} SMS sent, ${data.skipped} skipped`,
      });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const expiring = statuses?.filter((s) => ["critical", "urgent", "warning"].includes(s.urgency)) ?? [];
  const expired = statuses?.filter((s) => s.urgency === "expired") ?? [];
  const safe = statuses?.filter((s) => s.urgency === "ok" || s.urgency === "notice") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Subscription Reminders</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auto SMS at 7, 3, 1 din pehle. Daily 2:30 PM IST pe chalega.
          </p>
        </div>
        <Button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          {runMutation.isPending ? "Running..." : "Run Now (Manual)"}
        </Button>
      </div>

      {lastResult && (
        <div className="flex flex-wrap gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
          <span className="text-sm font-medium text-green-800">Last Run Result:</span>
          <span className="text-sm text-green-700">Checked: <strong>{lastResult.checked}</strong></span>
          <span className="text-sm text-green-700">SMS Sent: <strong>{lastResult.sent}</strong></span>
          <span className="text-sm text-green-700">Skipped: <strong>{lastResult.skipped}</strong></span>
          {lastResult.errors > 0 && (
            <span className="text-sm text-red-600">Errors: <strong>{lastResult.errors}</strong></span>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expiring Soon</p>
            <p className="text-3xl font-bold mt-1 text-amber-600">{isLoading ? "—" : expiring.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Within 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expired</p>
            <p className="text-3xl font-bold mt-1 text-red-600">{isLoading ? "—" : expired.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Already past date</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Safe</p>
            <p className="text-3xl font-bold mt-1 text-green-600">{isLoading ? "—" : safe.length}</p>
            <p className="text-xs text-muted-foreground mt-1">More than 7 days left</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-1">
        <p className="font-medium">Reminder schedule:</p>
        <ul className="list-disc list-inside space-y-0.5 text-amber-700">
          <li><strong>7 din pehle</strong> — pehla warning SMS</li>
          <li><strong>3 din pehle</strong> — urgent reminder</li>
          <li><strong>1 din pehle</strong> — final alert</li>
        </ul>
        <p className="text-xs mt-2">Company phone + admin phone dono ko SMS jata hai. Ek hi din mein duplicate SMS nahi jayega.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Sabhi Companies — Subscription Status</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 pb-4 space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !statuses?.length ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-sm">Koi company nahi mili.</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
              {statuses
                .sort((a, b) => {
                  const order = ["expired", "critical", "urgent", "warning", "notice", "ok", "none"];
                  return order.indexOf(a.urgency) - order.indexOf(b.urgency);
                })
                .map((s) => {
                  const meta = URGENCY_META[s.urgency];
                  const Icon = meta.icon;
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                      <div className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${meta.bg} border ${meta.border}`}>
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{s.name}</span>
                          {s.plan && (
                            <Badge variant="secondary" className="text-xs capitalize">{s.plan}</Badge>
                          )}
                          <Badge className={`text-xs ${meta.color} ${meta.bg} border ${meta.border}`}>
                            {s.daysLeft === null ? "No date" : s.daysLeft < 0 ? `${Math.abs(s.daysLeft)}d expired` : s.daysLeft === 0 ? "Expires today" : `${s.daysLeft}d left`}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            Expires: {formatDate(s.subscriptionEndDate)}
                          </span>
                          {s.phone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {s.phone}
                            </span>
                          )}
                          {s.subscriptionReminderSentAt && (
                            <span className="text-xs text-green-600 font-medium">
                              ✓ SMS sent {timeAgo(s.subscriptionReminderSentAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
