import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

import type { TripReportRow } from "@workspace/api-client-react";

export function formatLocalTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function escCsv(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function buildCsv(rows: TripReportRow[]): string {
  const header = [
    "Staff Name",
    "Mobile Number",
    "Ride Date",
    "Start Time",
    "End Time",
    "Start Location",
    "End Location",
    "Distance (km)",
  ].join(",");
  const lines = rows.map((r) =>
    [
      escCsv(r.staffName),
      escCsv(r.staffPhone),
      escCsv(r.rideDate),
      escCsv(formatLocalTime(r.startTime)),
      escCsv(formatLocalTime(r.endTime)),
      escCsv(r.startLocation),
      escCsv(r.endLocation),
      escCsv(r.distanceKm ?? ""),
    ].join(","),
  );
  return [header, ...lines].join("\r\n");
}

export async function exportCsvFile(csv: string, filename: string) {
  if (Platform.OS === "web") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    const path = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(path, {
        mimeType: "text/csv",
        dialogTitle: "Share Ride Report",
      });
    } else {
      Alert.alert("Saved", `Report saved to: ${path}`);
    }
  }
}
