import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Plus, Trash2, AlertCircle, Info, Clock, Radio, Search, X,
  CheckCircle2, MessageSquare, Smartphone, Building2, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Notice {
  id: string;
  companyId: string | null;
  companyName: string;
  title: string;
  message: string;
  priority: "normal" | "important" | "urgent";
  type: "notice" | "alert" | "reminder";
  expiresAt: string | null;
  createdAt: string;
}

interface Company {
  id: string;
  name: string;
  plan?: string;
  state?: string;
}

interface BroadcastResult {
  summary: {
    totalCompanies: number;
    companiesReached: number;
    totalStaff: number;
    channels: { sms: boolean; push: boolean; inApp: boolean };
  };
  results: Array<{ companyId: string; companyName: string; staffCount: number; noticeId: string | null }>;
}

const PRIORITY_STYLES: Record<string, string> = {
  normal: "bg-blue-50 text-blue-700 border-blue-200",
  important: "bg-amber-50 text-amber-700 border-amber-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  notice: Bell,
  alert: AlertCircle,
  reminder: Clock,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Broadcast Modal ──────────────────────────────────────────────────────────

function BroadcastModal({ companies, onClose }: { companies: Company[]; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [type, setType] = useState<"notice" | "alert" | "reminder">("notice");
  const [expiresAt, setExpiresAt] = useState("");
  const [adminOnly, setAdminOnly] = useState(false);
  const [smsOn, setSmsOn] = useState(true);
  const [pushOn, setPushOn] = useState(true);
  const [inAppOn, setInAppOn] = useState(true);
  const [targetAll, setTargetAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<BroadcastResult | null>(null);

  const broadcastMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch("/api/super-admin/notices/broadcast", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data: BroadcastResult) => {
      qc.invalidateQueries({ queryKey: ["super-admin-notices"] });
      setResult(data);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const filteredCos = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.state ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  function toggleCompany(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSend() {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" });
      return;
    }
    if (!targetAll && selectedIds.size === 0) {
      toast({ title: "Select at least one company", variant: "destructive" });
      return;
    }
    if (!smsOn && !pushOn && !inAppOn) {
      toast({ title: "Select at least one channel", variant: "destructive" });
      return;
    }
    broadcastMutation.mutate({
      title,
      message,
      priority,
      type,
      expiresAt: expiresAt || null,
      companyIds: targetAll ? "all" : Array.from(selectedIds),
      channels: { sms: smsOn, push: pushOn, inApp: inAppOn },
      adminOnly,
    });
  }

  if (result) {
    const { summary, results } = result;
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h2 className="font-semibold text-base">Broadcast Sent!</h2>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
                <p className="text-xl font-bold text-green-700">{summary.companiesReached}</p>
                <p className="text-xs text-green-600">Companies reached</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
                <p className="text-xl font-bold text-blue-700">{summary.totalStaff}</p>
                <p className="text-xs text-blue-600">Staff notified</p>
              </div>
              <div className="rounded-lg bg-violet-50 border border-violet-100 p-3 text-center">
                <p className="text-xl font-bold text-violet-700">
                  {[summary.channels.sms && "SMS", summary.channels.push && "Push", summary.channels.inApp && "App"].filter(Boolean).length}
                </p>
                <p className="text-xs text-violet-600">Channels used</p>
              </div>
            </div>
            {/* Channel badges */}
            <div className="flex gap-2 flex-wrap">
              {summary.channels.sms && <Badge className="bg-green-600 text-xs"><MessageSquare className="h-3 w-3 mr-1" />SMS</Badge>}
              {summary.channels.push && <Badge className="bg-blue-600 text-xs"><Smartphone className="h-3 w-3 mr-1" />Push</Badge>}
              {summary.channels.inApp && <Badge className="bg-violet-600 text-xs"><Bell className="h-3 w-3 mr-1" />In-App</Badge>}
            </div>
            {/* Per-company table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground grid grid-cols-[1fr_auto]">
                <span>Company</span><span>Staff</span>
              </div>
              <div className="divide-y divide-border max-h-48 overflow-y-auto">
                {results.map((r) => (
                  <div key={r.companyId} className="px-3 py-2 grid grid-cols-[1fr_auto] text-sm items-center">
                    <span className="truncate">{r.companyName}</span>
                    <span className={`text-xs font-medium ${r.staffCount > 0 ? "text-green-700" : "text-muted-foreground"}`}>
                      {r.staffCount > 0 ? `${r.staffCount} notified` : "no staff"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-base">Bulk Broadcast</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Message */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notice title..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="important">Important</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notice">Notice</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Message * <span className="text-muted-foreground text-xs">({message.length}/320 chars for SMS)</span></Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Notice message..."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expires At (optional)</Label>
              <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full sm:w-56" />
            </div>
          </div>

          {/* Target Companies */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />Target Companies</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">All companies</span>
                <Switch checked={targetAll} onCheckedChange={setTargetAll} />
              </div>
            </div>
            {!targetAll && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="p-2 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search companies..."
                      className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground"
                    />
                    {selectedIds.size > 0 && (
                      <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-medium">
                        {selectedIds.size} selected
                      </span>
                    )}
                  </div>
                </div>
                <div className="max-h-44 overflow-y-auto divide-y divide-border">
                  {filteredCos.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No companies found</p>
                  ) : (
                    filteredCos.map((c) => {
                      const selected = selectedIds.has(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleCompany(c.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors ${selected ? "bg-primary/5" : ""}`}
                        >
                          <div className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? "bg-primary border-primary" : "border-border"}`}>
                            {selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            {c.state && <p className="text-xs text-muted-foreground">{c.state}</p>}
                          </div>
                          {c.plan && <Badge variant="outline" className="text-xs capitalize ml-auto flex-shrink-0">{c.plan}</Badge>}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {targetAll && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                Will be sent to all {companies.length} approved companies
              </p>
            )}
          </div>

          {/* Channels + Options */}
          <div className="space-y-3">
            <Label>Channels</Label>
            <div className="flex flex-wrap gap-3">
              {[
                { key: "sms", label: "SMS", icon: MessageSquare, on: smsOn, toggle: setSmsOn, color: "text-green-600" },
                { key: "push", label: "Push Notification", icon: Smartphone, on: pushOn, toggle: setPushOn, color: "text-blue-600" },
                { key: "inApp", label: "In-App Notice", icon: Bell, on: inAppOn, toggle: setInAppOn, color: "text-violet-600" },
              ].map(({ key, label, icon: Icon, on, toggle, color }) => (
                <button
                  key={key}
                  onClick={() => toggle(!on)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    on ? "border-primary/40 bg-primary/5 text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${on ? color : ""}`} />
                  {label}
                  {on && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={adminOnly} onCheckedChange={setAdminOnly} />
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Send to company admins only
              </span>
            </div>
          </div>

          {/* Preview */}
          {(title || message) && (
            <div className={`rounded-lg border p-3 text-sm space-y-1 ${PRIORITY_STYLES[priority]}`}>
              <p className="font-semibold text-xs uppercase tracking-wide opacity-60">Preview</p>
              {priority !== "normal" && (
                <p className="text-xs font-bold">[{priority.toUpperCase()}] SCMS Notice:</p>
              )}
              {title && <p className="font-semibold">{title}</p>}
              {message && <p className="text-xs opacity-80 line-clamp-3">{message}</p>}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-1 border-t border-border">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={broadcastMutation.isPending || !title.trim() || !message.trim()}
              className="gap-1.5"
            >
              <Radio className="h-4 w-4" />
              {broadcastMutation.isPending
                ? "Sending..."
                : `Broadcast to ${targetAll ? `all ${companies.length}` : selectedIds.size} compan${(targetAll ? companies.length : selectedIds.size) === 1 ? "y" : "ies"}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NoticesPage() {
  const [showForm, setShowForm] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [type, setType] = useState<"notice" | "alert" | "reminder">("notice");
  const [companyId, setCompanyId] = useState<string>("all");
  const [expiresAt, setExpiresAt] = useState("");

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: notices, isLoading } = useQuery<Notice[]>({
    queryKey: ["super-admin-notices"],
    queryFn: () => apiFetch("/super-admin/notices"),
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["super-admin-companies"],
    queryFn: () => apiFetch("/super-admin/companies"),
    select: (d) => (Array.isArray(d) ? d : (d as { companies?: Company[] }).companies ?? []),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch("/super-admin/notices", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["super-admin-notices"] });
      toast({ title: "Notice created" });
      setShowForm(false);
      setTitle(""); setMessage(""); setPriority("normal"); setType("notice"); setCompanyId("all"); setExpiresAt("");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/super-admin/notices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["super-admin-notices"] });
      toast({ title: "Notice deleted" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    createMutation.mutate({
      title, message, priority, type,
      companyId: companyId === "all" ? null : companyId,
      expiresAt: expiresAt || null,
    });
  }

  return (
    <div className="space-y-6">
      {showBroadcast && (
        <BroadcastModal
          companies={companies ?? []}
          onClose={() => setShowBroadcast(false)}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Notices</h1>
          <p className="text-muted-foreground text-sm mt-1">Broadcast notices to companies and staff</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowBroadcast(true)} className="gap-1.5">
            <Radio className="h-4 w-4" />
            Bulk Broadcast
          </Button>
          <Button size="sm" onClick={() => setShowForm((p) => !p)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Notice
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-primary/30 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Create Notice</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notice title..." required />
                </div>
                <div className="space-y-1.5">
                  <Label>Target Company</Label>
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger><SelectValue placeholder="All companies" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies (Platform-wide)</SelectItem>
                      {(companies ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Notice message..." rows={3} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="important">Important</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notice">Notice</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expires">Expires At (optional)</Label>
                  <Input id="expires" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Notice"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            All Notices {notices && <span className="text-muted-foreground font-normal">({notices.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 pb-4 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : notices?.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-sm">No notices yet. Create one above.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notices?.map((n) => {
                const TypeIcon = TYPE_ICONS[n.type] ?? Info;
                return (
                  <div key={n.id} className="flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                    <div className={`mt-0.5 h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${PRIORITY_STYLES[n.priority] ?? ""} border`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{n.title}</p>
                        <Badge variant="outline" className="text-xs capitalize">{n.priority}</Badge>
                        <Badge variant="secondary" className="text-xs capitalize">{n.type}</Badge>
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">
                          {n.companyName}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                        {n.expiresAt && (
                          <span className="text-xs text-muted-foreground">
                            Expires: {new Date(n.expiresAt).toLocaleDateString("en-IN")}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => deleteMutation.mutate(n.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
