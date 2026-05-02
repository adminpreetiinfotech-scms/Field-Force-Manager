import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useListCandidates, useUpdateCandidateStatus, CandidateDtoStatus } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function Candidates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [mobilizerFilter, setMobilizerFilter] = useState("");

  const queryParams: any = {};
  if (debouncedSearch) queryParams.search = debouncedSearch;
  if (statusFilter !== "all") queryParams.status = statusFilter;
  if (mobilizerFilter) queryParams.mobilizer = mobilizerFilter;

  const { data: candidates, isLoading } = useListCandidates(queryParams);
  const updateStatus = useUpdateCandidateStatus();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    // Simple debounce inline for demo purposes
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
            onBlur={(e) => setMobilizerFilter(e.target.value)} // Re-trigger on blur
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
                    <div>{candidate.phone}</div>
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
                    <div className="flex justify-end items-center gap-2">
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
    </div>
  );
}
