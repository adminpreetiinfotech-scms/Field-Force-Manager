import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useListCandidates, useUpdateCandidateStatus, CandidateDtoStatus } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, Pencil } from "lucide-react";
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
  const [editCandidate, setEditCandidate] = useState<CandidateDto | null>(null);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "enrolled": return "bg-green-100 text-green-800 border-green-200";
      case "verified": return "bg-blue-100 text-blue-800 border-blue-200";
      case "rejected": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-orange-100 text-orange-800 border-orange-200";
    }
  };

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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            onChange={(e) => {
              setMobilizerFilter(e.target.value);
            }}
            onBlur={(e) => setMobilizerFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading candidates...</TableCell>
              </TableRow>
            ) : !candidates || candidates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No candidates found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              candidates.map((candidate) => (
                <TableRow key={candidate.id}>
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
