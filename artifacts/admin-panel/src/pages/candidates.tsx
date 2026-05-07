import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useListCandidates, useUpdateCandidateStatus, CandidateDtoStatus } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, Pencil, Trash2, CheckSquare, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import type { CandidateDto } from "@workspace/api-client-react";

type EditFields = {
  phone: string;
  parentMobile: string;
  dob: string;
  pin: string;
  fatherName: string;
  motherName: string;
  district: string;
  state: string;
  village: string;
  skillCentreName: string;
  yearOfPassing: string;
  bankAccount: string;
  bankName: string;
  bankBranch: string;
  ifsc: string;
  aadhaarNumber: string;
  education: string;
};

function EditCandidateModal({
  candidate,
  open,
  onClose,
  onSaved,
  adminPhone,
}: {
  candidate: CandidateDto;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  adminPhone: string;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<EditFields>({
    phone: candidate.phone ?? "",
    parentMobile: (candidate as any).parentMobile ?? "",
    dob: (candidate as any).dob ?? "",
    pin: (candidate as any).pin ?? "",
    fatherName: candidate.fatherName ?? "",
    motherName: (candidate as any).motherName ?? "",
    district: (candidate as any).district ?? "",
    state: (candidate as any).state ?? "",
    village: candidate.village ?? "",
    skillCentreName: (candidate as any).skillCentreName ?? "",
    yearOfPassing: (candidate as any).yearOfPassing ?? "",
    bankAccount: (candidate as any).bankAccount ?? "",
    bankName: (candidate as any).bankName ?? "",
    bankBranch: (candidate as any).bankBranch ?? "",
    ifsc: (candidate as any).ifsc ?? "",
    aadhaarNumber: (candidate as any).aadhaarNumber ?? "",
    education: (candidate as any).education ?? "",
  });

  const set = (key: keyof EditFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-phone": adminPhone,
        },
        body: JSON.stringify({
          phone: fields.phone || null,
          parentMobile: fields.parentMobile || null,
          dob: fields.dob || null,
          pin: fields.pin || null,
          fatherName: fields.fatherName || null,
          motherName: fields.motherName || null,
          district: fields.district || null,
          state: fields.state || null,
          village: fields.village || null,
          skillCentreName: fields.skillCentreName || null,
          yearOfPassing: fields.yearOfPassing || null,
          bankAccount: fields.bankAccount || null,
          bankName: fields.bankName || null,
          bankBranch: fields.bankBranch || null,
          ifsc: fields.ifsc || null,
          aadhaarNumber: fields.aadhaarNumber || null,
          education: fields.education || null,
        }),
      });
      const data = await res.json() as { title?: string };
      if (!res.ok) throw new Error(data.title ?? "Update failed");
      toast({ title: "Saved", description: "Candidate details updated. PDF will reflect changes on next download." });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Candidate: {candidate.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded p-2">
            Update blank/incorrect fields. PDF will show corrected data on next download.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-phone" className="text-xs font-medium">
                Mobile / मोबाइल <span className="text-red-500">*</span>
              </Label>
              <Input id="ed-phone" value={fields.phone} onChange={set("phone")}
                placeholder="10-digit mobile" maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-parent" className="text-xs font-medium">
                Parent's Mobile / अभिभावक मोबाइल
              </Label>
              <Input id="ed-parent" value={fields.parentMobile} onChange={set("parentMobile")}
                placeholder="10-digit" maxLength={10} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-dob" className="text-xs font-medium">
                Date of Birth / जन्म तिथि
              </Label>
              <Input id="ed-dob" value={fields.dob} onChange={set("dob")}
                placeholder="DD-MM-YYYY" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-pin" className="text-xs font-medium">
                PIN Code / पिन
              </Label>
              <Input id="ed-pin" value={fields.pin} onChange={set("pin")}
                placeholder="6-digit PIN" maxLength={6} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-father" className="text-xs font-medium">Father's Name / पिता का नाम</Label>
              <Input id="ed-father" value={fields.fatherName} onChange={set("fatherName")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-mother" className="text-xs font-medium">Mother's Name / माता का नाम</Label>
              <Input id="ed-mother" value={fields.motherName} onChange={set("motherName")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-village" className="text-xs font-medium">Village / गाँव</Label>
              <Input id="ed-village" value={fields.village} onChange={set("village")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-dist" className="text-xs font-medium">District / जिला</Label>
              <Input id="ed-dist" value={fields.district} onChange={set("district")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-state" className="text-xs font-medium">State / राज्य</Label>
              <Input id="ed-state" value={fields.state} onChange={set("state")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-tc" className="text-xs font-medium">Training Centre Name</Label>
              <Input id="ed-tc" value={fields.skillCentreName} onChange={set("skillCentreName")} />
            </div>
          </div>

          <div className="border-t pt-3 mt-1">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Education & Bank Details</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-edu" className="text-xs font-medium">Qualification / योग्यता</Label>
              <Input id="ed-edu" value={fields.education} onChange={set("education")}
                placeholder="e.g. Class 10, Class 12" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-yop" className="text-xs font-medium">
                Year of Passing / उत्तीर्ण वर्ष
              </Label>
              <Input id="ed-yop" value={fields.yearOfPassing} onChange={set("yearOfPassing")}
                placeholder="e.g. 2020" maxLength={4} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-acc" className="text-xs font-medium">
                Bank A/C No. / खाता नंबर
              </Label>
              <Input id="ed-acc" value={fields.bankAccount} onChange={set("bankAccount")}
                placeholder="Account number" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-bank" className="text-xs font-medium">Bank Name / बैंक</Label>
              <Input id="ed-bank" value={fields.bankName} onChange={set("bankName")}
                placeholder="e.g. SBI" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-ifsc" className="text-xs font-medium">IFSC Code</Label>
              <Input id="ed-ifsc" value={fields.ifsc} onChange={set("ifsc")}
                placeholder="e.g. SBIN0001234" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-branch" className="text-xs font-medium">Branch / शाखा</Label>
              <Input id="ed-branch" value={fields.bankBranch} onChange={set("bankBranch")}
                placeholder="Branch name" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-aadhar" className="text-xs font-medium">
                Aadhaar Number / आधार नंबर
              </Label>
              <Input id="ed-aadhar" value={fields.aadhaarNumber} onChange={set("aadhaarNumber")}
                placeholder="12-digit Aadhaar" maxLength={12} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Candidates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [mobilizerFilter, setMobilizerFilter] = useState("");
  const [centerFilter, setCenterFilter] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [editCandidate, setEditCandidate] = useState<CandidateDto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("verified");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const handleDeleteCandidate = async (candidate: CandidateDto) => {
    if (!user?.phone) return;
    setDeletingId(candidate.id);
    try {
      const res = await fetch(`/api/admin/candidates/${candidate.id}`, {
        method: "DELETE",
        headers: { "x-admin-phone": user.phone },
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { title?: string };
        throw new Error(err?.title ?? "Delete failed");
      }
      toast({
        title: "Candidate deleted",
        description: `${candidate.name} has been permanently removed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/candidate-stats"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadExcel = async () => {
    if (!user?.phone) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams({ format: "xlsx" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (mobilizerFilter) params.set("mobilizer", mobilizerFilter);
      if (centerFilter) params.set("skillCentre", centerFilter);
      const res = await fetch(`/api/admin/candidates/csv?${params.toString()}`, {
        headers: { "x-admin-phone": user.phone },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const centerLabel = centerFilter ? `_${centerFilter.replace(/\s+/g, "_")}` : "";
      a.download = `candidates${centerLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: "Excel file is being downloaded." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const queryParams: any = {};
  if (debouncedSearch) queryParams.search = debouncedSearch;
  if (statusFilter !== "all") queryParams.status = statusFilter;
  if (mobilizerFilter) queryParams.mobilizer = mobilizerFilter;

  const { data: candidates, isLoading } = useListCandidates(queryParams);
  const updateStatus = useUpdateCandidateStatus();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setTimeout(() => {
      setDebouncedSearch(e.target.value);
    }, 500);
  };

  const handleStatusUpdate = async (candidateId: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({
        id: candidateId,
        data: {
          status: newStatus as any,
          verifiedBy: user?.name,
          remarks: newStatus === "rejected" ? "Rejected by admin" : undefined
        }
      });
      toast({ title: "Updated", description: "Candidate status updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update status", variant: "destructive" });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!candidates) return;
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkUpdate = async () => {
    if (!user?.phone || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/candidates/bulk-status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-phone": user.phone,
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          status: bulkStatus,
          verifiedBy: user?.name,
          verifiedByPhone: user?.phone,
        }),
      });
      const data = await res.json() as { updated?: number; title?: string };
      if (!res.ok) throw new Error(data.title ?? "Bulk update failed");
      toast({
        title: "Bulk update complete",
        description: `${data.updated} candidate(s) marked as ${bulkStatus}.`,
      });
      setSelectedIds(new Set());
      setBulkConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/candidate-stats"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "enrolled": return "bg-green-100 text-green-800 border-green-200";
      case "verified": return "bg-blue-100 text-blue-800 border-blue-200";
      case "rejected": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-orange-100 text-orange-800 border-orange-200";
    }
  };

  const allSelected = !!candidates && candidates.length > 0 && selectedIds.size === candidates.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search candidates by name or phone..."
            className="pl-9"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSelectedIds(new Set()); }}>
            <SelectTrigger>
              <SelectValue placeholder="Status Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="enrolled">Enrolled</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Input
            placeholder="Filter by mobilizer"
            value={mobilizerFilter}
            onChange={(e) => setMobilizerFilter(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-56">
          <Input
            placeholder="Filter by training centre"
            value={centerFilter}
            onChange={(e) => setCenterFilter(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="shrink-0 gap-2"
          onClick={handleDownloadExcel}
          disabled={downloading}
          title="Download filtered candidates as Excel"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading..." : "Download Excel"}
        </Button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} candidate{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">Mark as:</span>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="enrolled">Enrolled</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs" disabled={bulkLoading}>
                  Apply to {selectedIds.size}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Bulk status update</AlertDialogTitle>
                  <AlertDialogDescription>
                    Mark <strong>{selectedIds.size}</strong> candidate{selectedIds.size !== 1 ? "s" : ""} as{" "}
                    <strong>{bulkStatus}</strong>? Each mobilizer will receive a notification.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={bulkLoading}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkUpdate} disabled={bulkLoading}>
                    {bulkLoading ? "Updating..." : "Confirm"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearSelection} title="Clear selection">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => { if (el) (el as any).indeterminate = someSelected; }}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Mobilizer</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading candidates...</TableCell>
              </TableRow>
            ) : !candidates || candidates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No candidates found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              candidates.map((candidate) => (
                <TableRow
                  key={candidate.id}
                  className={selectedIds.has(candidate.id) ? "bg-primary/5" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(candidate.id)}
                      onCheckedChange={() => toggleSelect(candidate.id)}
                      aria-label={`Select ${candidate.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{candidate.name}</div>
                    <div className="text-xs text-muted-foreground">{candidate.fatherName || "N/A"}</div>
                  </TableCell>
                  <TableCell>
                    <div className={!candidate.phone ? "text-red-500 text-xs italic" : ""}>
                      {candidate.phone || "Missing"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px] truncate" title={candidate.village || ""}>{candidate.village || "-"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{candidate.submittedBy}</div>
                    <div className="text-xs text-muted-foreground">{candidate.submittedByPhone}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {candidate.createdAt ? format(new Date(candidate.createdAt), "MMM d, yyyy") : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(candidate.status)}>
                      {candidate.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Edit Candidate Details"
                        onClick={() => setEditCandidate(candidate)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Select
                        value={candidate.status}
                        onValueChange={(val) => handleStatusUpdate(candidate.id, val)}
                        disabled={updateStatus.isPending}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
                          <SelectItem value="enrolled">Enrolled</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a
                          href={`/api/candidates/${candidate.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          title="Download Profile PDF"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete Candidate"
                            disabled={deletingId === candidate.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this candidate?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>{candidate.name}</strong> and all related history (audit log, notifications) will be permanently removed. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteCandidate(candidate)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Yes, Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editCandidate && user?.phone && (
        <EditCandidateModal
          candidate={editCandidate}
          open={!!editCandidate}
          onClose={() => setEditCandidate(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/candidates"] });
          }}
          adminPhone={user.phone}
        />
      )}
    </div>
  );
}
