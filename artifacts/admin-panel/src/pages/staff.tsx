import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useListStaff, useListPendingStaff, useApproveStaff, useRejectStaff } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function StaffManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const reqOpts = { request: { headers: { "x-staff-phone": user?.phone || "" } } };
  
  const { data: allStaff, isLoading: isLoadingAll } = useListStaff(reqOpts);
  const { data: pendingStaff, isLoading: isLoadingPending } = useListPendingStaff(reqOpts);

  const approveStaff = useApproveStaff(reqOpts);
  const rejectStaff = useRejectStaff(reqOpts);

  const handleAction = async (action: 'approve' | 'reject', staffId: string) => {
    try {
      if (action === 'approve') {
        await approveStaff.mutateAsync({ staffId });
      } else {
        await rejectStaff.mutateAsync({ staffId });
      }
      
      toast({ title: "Success", description: `Staff member ${action}d.` });
      // Refetch
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || `Failed to ${action} staff.`, variant: "destructive" });
    }
  };

  const filterStaff = (staffList: any[]) => {
    if (!staffList) return [];
    if (!search) return staffList;
    const lowerSearch = search.toLowerCase();
    return staffList.filter(s => 
      s.name.toLowerCase().includes(lowerSearch) || 
      s.phone.includes(search) ||
      (s.empCode && s.empCode.toLowerCase().includes(lowerSearch))
    );
  };

  const displayedStaff = tab === "all" ? filterStaff(allStaff || []) : filterStaff(pendingStaff || []);
  const isLoading = tab === "all" ? isLoadingAll : isLoadingPending;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or code..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Staff</TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            Pending Approvals
            {pendingStaff && pendingStaff.length > 0 && (
              <span className="ml-2 rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white">
                {pendingStaff.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        
        <div className="mt-4 border rounded-md bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : displayedStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No staff found.
                  </TableCell>
                </TableRow>
              ) : (
                displayedStaff.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-mono text-xs">{staff.empCode || "-"}</TableCell>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell>{staff.phone}</TableCell>
                    <TableCell className="capitalize">{staff.role.replace("_", " ")}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {staff.createdAt ? format(new Date(staff.createdAt), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        staff.approvalStatus === "approved" ? "default" :
                        staff.approvalStatus === "rejected" ? "destructive" : "outline"
                      }>
                        {staff.approvalStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {staff.approvalStatus === "pending" && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleAction('approve', staff.id)} disabled={approveStaff.isPending || rejectStaff.isPending}>
                            <CheckCircle className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleAction('reject', staff.id)} disabled={approveStaff.isPending || rejectStaff.isPending}>
                            <XCircle className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Tabs>
    </div>
  );
}
