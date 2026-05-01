import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet } from "lucide-react";
import { format, subMonths } from "date-fns";

export default function Reports() {
  const [fromDate, setFromDate] = useState(format(subMonths(new Date(), 1), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const handleDownloadRides = () => {
    const url = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/reports/excel?from=${fromDate}&to=${toDate}`;
    window.open(url, "_blank");
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
            <Button onClick={handleDownloadRides} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Download Excel Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Candidate PDFs
            </CardTitle>
            <CardDescription>
              Individual candidate profiles can be exported directly from the Candidates table. 
              The PDF includes their photo, demographic details, and attached documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted rounded-md text-sm text-muted-foreground border">
              Navigate to the <a href="/candidates" className="font-medium text-primary hover:underline">Candidates page</a> to search for a specific person and click the download icon next to their status.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
