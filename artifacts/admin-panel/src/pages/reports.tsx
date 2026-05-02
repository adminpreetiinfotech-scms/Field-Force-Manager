import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
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

export default function Reports() {
  const [fromDate, setFromDate] = useState(format(subMonths(new Date(), 1), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownloadRides = async () => {
    setIsDownloading(true);
    try {
      const phone = getAdminPhone();
      const url = `/api/admin/reports/rides/xlsx?from=${fromDate}&to=${toDate}`;
      const res = await fetch(url, {
        headers: { "x-admin-phone": phone },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).title || `Error ${res.status}`);
      }

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `rides-report-${fromDate}-to-${toDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);

      toast({ title: "Download started", description: "Excel report is being downloaded." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message || "Could not download report.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Reports & Exports</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Staff Ride Report
            </CardTitle>
            <CardDescription>
              Download a comprehensive Excel export of all staff field visits and activities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from">From Date</Label>
                <Input
                  id="from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">To Date</Label>
                <Input
                  id="to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleDownloadRides} className="w-full gap-2" disabled={isDownloading}>
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloading ? "Downloading..." : "Download Excel Report"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Candidate CSV
            </CardTitle>
            <CardDescription>
              Download all candidates data as a CSV file for further analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={async () => {
                try {
                  const phone = getAdminPhone();
                  const res = await fetch("/api/admin/candidates/csv", {
                    headers: { "x-admin-phone": phone },
                  });
                  if (!res.ok) throw new Error(`Error ${res.status}`);
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `candidates-${format(new Date(), "yyyy-MM-dd")}.csv`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                } catch (err: any) {
                  toast({ title: "Download failed", description: err.message, variant: "destructive" });
                }
              }}
            >
              <Download className="h-4 w-4" />
              Download Candidates CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
