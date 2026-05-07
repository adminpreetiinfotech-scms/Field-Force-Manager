import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, Trash2, AlertCircle, Info, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function NoticesPage() {
  const [showForm, setShowForm] = useState(false);
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
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch("/super-admin/notices", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["super-admin-notices"] });
      toast({ title: "Notice created" });
      setShowForm(false);
      setTitle("");
      setMessage("");
      setPriority("normal");
      setType("notice");
      setCompanyId("all");
      setExpiresAt("");
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
      title,
      message,
      priority,
      type,
      companyId: companyId === "all" ? null : companyId,
      expiresAt: expiresAt || null,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Notices</h1>
          <p className="text-muted-foreground text-sm mt-1">Broadcast notices to companies and staff</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((p) => !p)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Notice
        </Button>
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
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Notice title..."
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Target Company</Label>
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All companies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies (Platform-wide)</SelectItem>
                      {companies?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Notice message..."
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notice">Notice</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expires">Expires At (optional)</Label>
                  <Input
                    id="expires"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
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
