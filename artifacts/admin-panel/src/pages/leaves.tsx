import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

type LeaveStatus = "pending" | "approved" | "rejected";
type LeaveType = "casual" | "sick" | "other";

interface LeaveRow {
  id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: LeaveStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  staffId: string;
  staffName: string;
  staffEmpCode: string;
  staffPhone: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAdminPhone(): string {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return (JSON.parse(raw) as { phone?: string }).phone ?? "";
  } catch {
    return "";
  }
}

function adminFetch(path: string, opts: RequestInit = {}) {
  return fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-admin-phone": getAdminPhone(),
      ...(opts.headers ?? {}),
    },
  });
}

const LEAVE_TYPE_CONFIG: Record<
  LeaveType,
  { label: string; color: string }
> = {
  casual: {
    label: "Casual",
    color: "bg-sky-100 text-sky-700 border-sky-200",
  },
  sick: {
    label: "Sick",
    color: "bg-red-100 text-red-700 border-red-200",
  },
  other: {
    label: "Other",
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
};

const STATUS_CONFIG: Record<
  LeaveStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
  },
};

function StatusBadge({ status }: { status: LeaveStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function LeaveTypeBadge({ type }: { type: LeaveType }) {
  const cfg = LEAVE_TYPE_CONFIG[type] ?? LEAVE_TYPE_CONFIG.other;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

function fmtDate(d: string) {
  try {
    return format(new Date(d), "d MMM yyyy");
  } catch {
    return d;
  }
}

function fmtDateTime(d: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "d MMM yyyy, h:mm a");
  } catch {
    return d;
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function Leaves() {
  useAuth(); // guards via AdminLayout

  const { toast } = useToast();
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [year, setYear] = useState(String(new Date().getFullYear()));

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState<LeaveRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);

  // Approve confirm
  const [approveTarget, setApproveTarget] = useState<LeaveRow | null>(null);
  const [approveBusy, setApproveBusy] = useState(false);

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(
        `/api/admin/leaves?status=${tab}&year=${year}`,
      );
      if (!res.ok) throw new Error("Failed to load leaves");
      const data = (await res.json()) as { leaves: LeaveRow[] };
      setLeaves(data.leaves ?? []);
    } catch {
      toast({ title: "Error", description: "Could not load leave requests.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tab, year, toast]);

  useEffect(() => {
    void loadLeaves();
  }, [loadLeaves]);

  async function doApprove() {
    if (!approveTarget) return;
    setApproveBusy(true);
    try {
      const res = await adminFetch(`/api/admin/leaves/${approveTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { title?: string };
        throw new Error(e.title ?? "Failed");
      }
      toast({ title: "Approved", description: `${approveTarget.staffName}'s leave has been approved.` });
      setApproveTarget(null);
      void loadLeaves();
    } catch (err) {
      toast({ title: "Error", description: String(err instanceof Error ? err.message : err), variant: "destructive" });
    } finally {
      setApproveBusy(false);
    }
  }

  async function doReject() {
    if (!rejectTarget) return;
    setRejectBusy(true);
    try {
      const res = await adminFetch(`/api/admin/leaves/${rejectTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "reject",
          rejectionReason: rejectReason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { title?: string };
        throw new Error(e.title ?? "Failed");
      }
      toast({ title: "Rejected", description: `${rejectTarget.staffName}'s leave has been rejected.` });
      setRejectTarget(null);
      setRejectReason("");
      void loadLeaves();
    } catch (err) {
      toast({ title: "Error", description: String(err instanceof Error ? err.message : err), variant: "destructive" });
    } finally {
      setRejectBusy(false);
    }
  }

  // Counts per status
  const counts = {
    all: leaves.length,
    pending: leaves.filter((l) => l.status === "pending").length,
    approved: leaves.filter((l) => l.status === "approved").length,
    rejected: leaves.filter((l) => l.status === "rejected").length,
  };

  // Year selector range
  const curYear = new Date().getFullYear();
  const years = [String(curYear - 1), String(curYear), String(curYear + 1)];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and manage staff leave applications
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Year navigator */}
          <button
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            onClick={() =>
              setYear((y) => String(Number(y) - 1))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold w-12 text-center">{year}</span>
          <button
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            onClick={() =>
              setYear((y) => String(Number(y) + 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadLeaves()}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            { key: "pending", label: "Pending", icon: Clock, color: "text-amber-500", bg: "bg-amber-50 border-amber-200" },
            { key: "approved", label: "Approved", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-200" },
            { key: "rejected", label: "Rejected", icon: XCircle, color: "text-red-500", bg: "bg-red-50 border-red-200" },
            { key: "all", label: "Total", icon: CalendarDays, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
          ] as const
        ).map(({ key, label, icon: Icon, color, bg }) => (
          <div
            key={key}
            className={`rounded-xl border p-4 cursor-pointer transition-all ${bg} ${tab === key ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
            onClick={() => setTab(key)}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${color}`}>
              {loading ? "…" : counts[key]}
            </div>
          </div>
        ))}
      </div>

      {/* Tab filters */}
      <div className="flex gap-1 border-b pb-0">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
              tab === t.value
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            {t.label}
            {t.value === "pending" && counts.pending > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {counts.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Leave list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : leaves.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-semibold text-muted-foreground">
            No {tab !== "all" ? tab : ""} leaves found
          </p>
          <p className="text-sm text-muted-foreground">
            {tab === "pending"
              ? "All leave requests have been reviewed."
              : "No leave records for this period."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaves.map((lv) => (
            <LeaveCard
              key={lv.id}
              leave={lv}
              onApprove={() => setApproveTarget(lv)}
              onReject={() => {
                setRejectTarget(lv);
                setRejectReason("");
              }}
            />
          ))}
        </div>
      )}

      {/* Approve confirm dialog */}
      <Dialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Approve Leave
            </DialogTitle>
            <DialogDescription>
              Approve{" "}
              <span className="font-semibold">{approveTarget?.staffName}</span>'s{" "}
              {approveTarget?.leaveType} leave from{" "}
              {approveTarget ? fmtDate(approveTarget.startDate) : ""} to{" "}
              {approveTarget ? fmtDate(approveTarget.endDate) : ""} (
              {approveTarget?.totalDays} day
              {(approveTarget?.totalDays ?? 0) > 1 ? "s" : ""})?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveTarget(null)}
              disabled={approveBusy}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={doApprove}
              disabled={approveBusy}
            >
              {approveBusy ? "Approving…" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Reject Leave
            </DialogTitle>
            <DialogDescription>
              Reject{" "}
              <span className="font-semibold">{rejectTarget?.staffName}</span>'s{" "}
              {rejectTarget?.leaveType} leave ({rejectTarget?.totalDays} day
              {(rejectTarget?.totalDays ?? 0) > 1 ? "s" : ""})?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Rejection reason{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="e.g. Insufficient notice period, project deadline…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              maxLength={300}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {rejectReason.length}/300
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
              disabled={rejectBusy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={doReject}
              disabled={rejectBusy}
            >
              {rejectBusy ? "Rejecting…" : "Reject Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Leave Card ─────────────────────────────────────────────────────────────────

function LeaveCard({
  leave,
  onApprove,
  onReject,
}: {
  leave: LeaveRow;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Staff avatar + info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-gradient-to-br from-cyan-500 to-indigo-600 text-white">
            {leave.staffName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{leave.staffName}</span>
              <span className="text-xs text-muted-foreground">
                {leave.staffEmpCode}
              </span>
              <LeaveTypeBadge type={leave.leaveType} />
              <StatusBadge status={leave.status} />
            </div>

            {/* Dates */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>
                {fmtDate(leave.startDate)}
                {leave.startDate !== leave.endDate &&
                  ` → ${fmtDate(leave.endDate)}`}
              </span>
              <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-xs font-medium">
                {leave.totalDays} day{leave.totalDays > 1 ? "s" : ""}
              </span>
            </div>

            {/* Reason */}
            {leave.reason && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1 mt-1 line-clamp-2">
                <span className="font-medium text-foreground/80">Reason: </span>
                {leave.reason}
              </p>
            )}

            {/* Rejection reason */}
            {leave.status === "rejected" && leave.rejectionReason && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1 mt-1 flex items-start gap-1">
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                {leave.rejectionReason}
              </p>
            )}

            {/* Timestamps */}
            <div className="flex gap-3 mt-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground">
                Applied: {fmtDateTime(leave.createdAt)}
              </span>
              {leave.reviewedAt && (
                <span className="text-[11px] text-muted-foreground">
                  Reviewed: {fmtDateTime(leave.reviewedAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons (only for pending) */}
        {leave.status === "pending" && (
          <div className="flex gap-2 sm:flex-col sm:items-end shrink-0">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-1.5 h-8"
              onClick={onApprove}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5 h-8"
              onClick={onReject}
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
