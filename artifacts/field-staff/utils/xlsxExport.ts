import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

const _domain =
  process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app";
export const API_BASE = `https://${_domain}`;

export type XlsxReportParams = {
  from: string;
  to: string;
  staffId?: string | null;
  reportType?: string;
  organization?: string | null;
  staffName?: string | null;
  companyId?: string | null;
};

export function buildXlsxUrl(params: XlsxReportParams): string {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.staffId)      q.set("staffId",      params.staffId);
  if (params.reportType)   q.set("reportType",   params.reportType);
  if (params.organization) q.set("organization", params.organization);
  if (params.staffName)    q.set("staffName",    params.staffName);
  if (params.companyId)    q.set("companyId",    params.companyId);
  return `${API_BASE}/api/admin/reports/rides/xlsx?${q.toString()}`;
}

export async function downloadXlsxFile(
  params: XlsxReportParams,
): Promise<void> {
  const url = buildXlsxUrl(params);
  const filename = `ride-report-${params.from}-to-${params.to}.xlsx`;

  if (Platform.OS === "web") {
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `Server error ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return;
  }

  const docDir: string | null = (FileSystem as unknown as { documentDirectory: string | null }).documentDirectory;
  const localUri = `${docDir ?? ""}${filename}`;
  const result = await FileSystem.downloadAsync(url, localUri, {
    headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });

  if (result.status !== 200) {
    throw new Error(`Download failed (HTTP ${result.status})`);
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri, {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Share Ride Excel Report",
      UTI: "com.microsoft.excel.xlsx",
    });
  } else {
    Alert.alert("Saved", `Excel report saved:\n${result.uri}`);
  }
}
