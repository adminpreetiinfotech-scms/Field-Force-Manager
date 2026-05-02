import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, Loader2, X, Search } from "lucide-react";
import { format, subMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function getAdminPhone(): string {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return (JSON.parse(raw) as { phone?: string }).phone ?? "";
  } catch {
    return "";
  }
}

interface StaffOption {
  id: string;
  name: string;
  empCode?: string | null;
  phone?: string | null;
}

async function fetchWithAuth(url: string) {
  return fetch(url, { headers: { "x-admin-phone": getAdminPhone() } });
}

async function downloadBlob(url: string, filename: string) {
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).title || `Error ${res.status}`);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Reports() {
  const [fromDate, setFromDate] = useState(format(subMonths(new Date(), 1), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const { toast } = useToast();

  // Staff filter state
  const [staffQuery, setStaffQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch staff list when user types
  useEffect(() => {
    if (selectedStaff) return;
    if (staffQuery.trim().length < 1) { setStaffList([]); setShowDropdown(false); return; }
    const timer = setTimeout(async () => {
      setStaffLoading(true);
      try {
        const res = await fetchWithAuth(`/api/admin/staff-list`);
        if (res.ok) {
          const data: StaffOption[] = await res.json();
          const q = staffQuery.toLowerCase();
          const filtered = data.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.empCode ?? "").toLowerCase().includes(q) ||
            (s.phone ?? "").includes(q)
          );
          setStaffList(filtered.slice(0, 10));
          setShowDropdown(filtered.length > 0);
        }
      } catch { /* ignore */ }
      setStaffLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [staffQuery, selectedStaff]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDownloadRides = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (selectedStaff) {
        params.set("staffId", selectedStaff.id);
        params.set("staffName", selectedStaff.name);
      }
      const suffix = selectedStaff ? `-${selectedStaff.name.replace(/\s+/g, "-")}` : "-all-staff";
      await downloadBlob(
        `/api/admin/reports/rides/xlsx?${params}`,
        `rides-report-${fromDate}-to-${toDate}${suffix}.xlsx`
      );
      toast({ title: "Download started", description: "Excel report is being downloaded." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message || "Could not download report.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadCsv = async () => {
    setIsDownloadingCsv(true);
    try {
      await downloadBlob(
        `/api/admin/candidates/csv`,
        `candidates-${format(new Date(), "yyyy-MM-dd")}.csv`
      );
      toast({ title: "Download started", description: "Candidates CSV is being downloaded." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Reports & Exports</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Staff Ride Report ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Staff Ride Report
            </CardTitle>
            <CardDescription>
              Download Excel export of staff field visits. Filter by date range and optionally a specific staff member.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from">From Date</Label>
                <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">To Date</Label>
                <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>

            {/* Staff filter */}
            <div className="space-y-2">
              <Label>Staff Member (optional)</Label>
              {selectedStaff ? (
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted text-sm">
                  <span className="flex-1 font-medium">
                    {selectedStaff.name}
                    {selectedStaff.empCode && <span className="text-muted-foreground ml-1">· {selectedStaff.empCode}</span>}
                  </span>
                  <button
                    onClick={() => { setSelectedStaff(null); setStaffQuery(""); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, EMP ID or phone..."
                    className="pl-8"
                    value={staffQuery}
                    onChange={(e) => setStaffQuery(e.target.value)}
                    onFocus={() => { if (staffList.length > 0) setShowDropdown(true); }}
                  />
                  {staffLoading && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {showDropdown && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {staffList.map((s) => (
                        <button
                          key={s.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedStaff(s);
                            setStaffQuery("");
                            setShowDropdown(false);
                          }}
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground text-xs">{s.empCode ?? s.phone ?? ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!selectedStaff && !staffQuery && (
                <p className="text-xs text-muted-foreground">Leave blank to include all staff in the report.</p>
              )}
            </div>

            <Button onClick={handleDownloadRides} className="w-full gap-2" disabled={isDownloading}>
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloading ? "Downloading..." : selectedStaff ? `Download Report for ${selectedStaff.name}` : "Download Excel Report"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Candidates CSV ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Candidates CSV
            </CardTitle>
            <CardDescription>
              Download all candidates data as a CSV file for further analysis or import.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Exports all candidate records including name, contact, location, mobilizer, and current status.
            </p>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleDownloadCsv}
              disabled={isDownloadingCsv}
            >
              {isDownloadingCsv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloadingCsv ? "Downloading..." : "Download Candidates CSV"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Individual candidate PDFs can be downloaded from the{" "}
              <a href="/admin-panel/candidates" className="text-primary underline-offset-2 hover:underline">
                Candidates page
              </a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
