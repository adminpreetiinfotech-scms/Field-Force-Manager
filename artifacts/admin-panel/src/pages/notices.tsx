import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bell,
  Plus,
  Trash2,
  Users,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle2,
  Eye,
  ChevronRight,
  X,
} from "lucide-react";
import { format, isAfter } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

type Priority = "normal" | "important" | "urgent";
type NoticeType = "notice" | "alert" | "reminder";
type TargetType = "all" | "specific";

interface NoticeListItem {
  id: string;
  title: string;
  message: string;
  priority: Priority;
  type: NoticeType;
  targetType: TargetType;
  expiresAt: string | null;
  createdAt: string;
  creatorName: string | null;
  totalRecipients: number;
  readCount: number;
}

interface StaffItem {
  id: string;
  name: string;
  phone: string;
  empCode: string;
  area: string | null;
}

interface Recipient {
  staffId: string;
  staffName: string | null;
  staffPhone: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  acknowledged: boolean;
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

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: React.ElementType }> = {
  normal: { label: "Normal", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Bell },
  important: { label: "Important", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
};

const TYPE_CONFIG: Record<NoticeType, { label: string; color: string }> = {
  notice: { label: "Notice", color: "bg-blue-100 text-blue-700 border-blue-200" },
  alert: { label: "Alert", color: "bg-orange-100 text-orange-700 border-orange-200" },
  reminder: { label: "Reminder", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.normal;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: NoticeType }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.notice;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function ReadRateBar({ read, total }: { read: number; total: number }) {
  const pct = total > 0 ? Math.round((read / total) * 100) : 0;
  const color = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-amber-400" : "bg-slate-300";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {read}/{total}
      </span>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function NoticeDetailDialog({
  noticeId,
  onClose,
}: {
  noticeId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ notice: NoticeListItem; recipients: Recipient[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!noticeId) return;
    setLoading(true);
    adminFetch(`/api/notices/admin/${noticeId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [noticeId]);

  const readCount = data?.recipients.filter((r) => r.readAt).length ?? 0;
  const totalCount = data?.recipients.length ?? 0;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Notice Details
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : data ? (
          <div className="overflow-auto flex-1 space-y-4 pr-1">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{data.notice.title}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.notice.message}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <PriorityBadge priority={data.notice.priority} />
                <TypeBadge type={data.notice.type} />
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-muted text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {data.notice.targetType === "all" ? "All Staff" : "Specific Staff"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span>Sent: {format(new Date(data.notice.createdAt), "dd MMM yyyy, hh:mm a")}</span>
                {data.notice.expiresAt && (
                  <span className={isAfter(new Date(), new Date(data.notice.expiresAt)) ? "text-red-500" : ""}>
                    Expires: {format(new Date(data.notice.expiresAt), "dd MMM yyyy")}
                  </span>
                )}
                {data.notice.creatorName && <span>By: {data.notice.creatorName}</span>}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">Recipients</h4>
                <span className="text-xs text-muted-foreground">
                  {readCount} of {totalCount} read ({totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0}%)
                </span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Staff</TableHead>
                      <TableHead className="text-xs">Phone</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Read At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recipients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                          No recipients found
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.recipients.map((r) => (
                        <TableRow key={r.staffId}>
                          <TableCell className="text-sm font-medium">{r.staffName ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.staffPhone ?? "—"}</TableCell>
                          <TableCell>
                            {r.readAt ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                                <CheckCircle2 className="h-3 w-3" /> Read
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" /> Unread
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.readAt ? format(new Date(r.readAt), "dd MMM, hh:mm a") : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">Failed to load notice details.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Notice Dialog ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: "",
  message: "",
  priority: "normal" as Priority,
  type: "notice" as NoticeType,
  targetType: "all" as TargetType,
  targetStaffIds: [] as string[],
  expiresAt: "",
};

function CreateNoticeDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");

  useEffect(() => {
    if (form.targetType !== "specific") return;
    setStaffLoading(true);
    adminFetch("/api/notices/admin/staff-list")
      .then((r) => r.json())
      .then((d) => setStaffList(d.staff ?? []))
      .catch(() => {})
      .finally(() => setStaffLoading(false));
  }, [form.targetType]);

  const toggleStaff = (id: string) => {
    setForm((f) => ({
      ...f,
      targetStaffIds: f.targetStaffIds.includes(id)
        ? f.targetStaffIds.filter((x) => x !== id)
        : [...f.targetStaffIds, id],
    }));
  };

  const filteredStaff = staffSearch.trim()
    ? staffList.filter(
        (s) =>
          s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
          s.phone.includes(staffSearch) ||
          s.empCode.toLowerCase().includes(staffSearch.toLowerCase()),
      )
    : staffList;

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast({ title: "Required", description: "Title and message are required.", variant: "destructive" });
      return;
    }
    if (form.targetType === "specific" && form.targetStaffIds.length === 0) {
      toast({ title: "Select staff", description: "Please select at least one staff member.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        message: form.message.trim(),
        priority: form.priority,
        type: form.type,
        targetType: form.targetType,
        expiresAt: form.expiresAt ? form.expiresAt : null,
      };
      if (form.targetType === "specific") {
        body.targetStaffIds = form.targetStaffIds;
      }
      const res = await adminFetch("/api/notices/admin/create", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).title ?? "Failed to create notice");
      }
      const data = await res.json();
      toast({
        title: "Notice sent!",
        description: `Sent to ${data.recipientCount} staff member${data.recipientCount !== 1 ? "s" : ""}.`,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Something went wrong.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Create New Notice
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-auto flex-1 space-y-4 pr-1">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
            <Input
              placeholder="Notice title…"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={120}
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Message <span className="text-red-500">*</span></label>
            <textarea
              className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Write your notice message here…"
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              maxLength={1000}
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">{form.message.length}/1000</p>
          </div>

          {/* Priority + Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Priority</label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">🔔 Normal</SelectItem>
                  <SelectItem value="important">⚠️ Important</SelectItem>
                  <SelectItem value="urgent">🚨 Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Type</label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as NoticeType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notice">📋 Notice</SelectItem>
                  <SelectItem value="alert">🔴 Alert</SelectItem>
                  <SelectItem value="reminder">⏰ Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Target</label>
            <div className="flex gap-2">
              {(["all", "specific"] as TargetType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, targetType: t, targetStaffIds: [] }))}
                  className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                    form.targetType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-muted border-input"
                  }`}
                >
                  {t === "all" ? "👥 All Staff" : "🎯 Selected Staff"}
                </button>
              ))}
            </div>
          </div>

          {/* Staff selector */}
          {form.targetType === "specific" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Select Staff</label>
                {form.targetStaffIds.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {form.targetStaffIds.length} selected
                  </span>
                )}
              </div>
              <Input
                placeholder="Search by name, phone, emp code…"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="max-h-44 overflow-y-auto border rounded-md divide-y">
                {staffLoading ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">Loading staff…</div>
                ) : filteredStaff.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">No staff found</div>
                ) : (
                  filteredStaff.map((s) => {
                    const selected = form.targetStaffIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleStaff(s.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted ${
                          selected ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          selected ? "bg-primary border-primary" : "border-input"
                        }`}>
                          {selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.phone} · {s.empCode}</p>
                        </div>
                        {s.area && (
                          <span className="text-xs text-muted-foreground shrink-0">{s.area}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Expiry */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Expiry Date{" "}
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Sending…" : "Send Notice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Notices() {
  const { toast } = useToast();
  const [notices, setNotices] = useState<NoticeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotices = useCallback(() => {
    setLoading(true);
    adminFetch("/api/notices/admin/list")
      .then((r) => r.json())
      .then((d) => setNotices(d.notices ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete notice "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await adminFetch(`/api/notices/admin/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setNotices((prev) => prev.filter((n) => n.id !== id));
      toast({ title: "Deleted", description: "Notice deleted successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to delete notice.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const totalSent = notices.length;
  const totalRead = notices.reduce((s, n) => s + n.readCount, 0);
  const totalRecipients = notices.reduce((s, n) => s + n.totalRecipients, 0);
  const urgentCount = notices.filter((n) => n.priority === "urgent").length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notices</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Broadcast messages to your field staff
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Create Notice
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Sent", value: totalSent, icon: Bell, color: "text-blue-600 bg-blue-50" },
          { label: "Total Reads", value: totalRead, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
          {
            label: "Read Rate",
            value: totalRecipients > 0 ? `${Math.round((totalRead / totalRecipients) * 100)}%` : "—",
            icon: Eye,
            color: "text-purple-600 bg-purple-50",
          },
          { label: "Urgent Notices", value: urgentCount, icon: AlertCircle, color: "text-red-600 bg-red-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold tabular-nums">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Sent Notices</h2>
          <span className="text-xs text-muted-foreground">{notices.length} total</span>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : notices.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No notices sent yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first notice to broadcast to staff
            </p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create Notice
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="hidden md:table-cell">Target</TableHead>
                  <TableHead className="hidden lg:table-cell">Read Rate</TableHead>
                  <TableHead className="hidden md:table-cell">Expiry</TableHead>
                  <TableHead className="hidden lg:table-cell">Sent</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notices.map((n) => {
                  const expired = n.expiresAt ? isAfter(new Date(), new Date(n.expiresAt)) : false;
                  return (
                    <TableRow
                      key={n.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setDetailId(n.id)}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm line-clamp-1">{n.title}</span>
                          <span className="text-xs text-muted-foreground line-clamp-1 hidden sm:block">
                            {n.message}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <TypeBadge type={n.type} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={n.priority} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {n.targetType === "all" ? "All" : "Specific"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <ReadRateBar read={n.readCount} total={n.totalRecipients} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {n.expiresAt ? (
                          <span className={`text-xs ${expired ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                            {expired ? "Expired" : format(new Date(n.expiresAt), "dd MMM yyyy")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No expiry</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {format(new Date(n.createdAt), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setDetailId(n.id)}
                            title="View details"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(n.id, n.title)}
                            disabled={deletingId === n.id}
                            title="Delete"
                          >
                            {deletingId === n.id ? (
                              <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showCreate && (
        <CreateNoticeDialog
          onClose={() => setShowCreate(false)}
          onCreated={fetchNotices}
        />
      )}
      {detailId && (
        <NoticeDetailDialog
          noticeId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
