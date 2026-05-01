import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatRangeDMY, todayDMY } from "@/utils/dateUtils";

type Props = {
  organization?: string | null;
  staffName?: string | null;
  from?: string | null;
  to?: string | null;
  reportType?: "daily" | "weekly" | "monthly";
  textColor?: string;
  subColor?: string;
};

function deriveRange(
  from?: string | null,
  to?: string | null,
  reportType?: "daily" | "weekly" | "monthly",
): string {
  if (from && to) return formatRangeDMY(from, to);

  const t = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  if (reportType === "weekly") {
    const end = iso(t);
    const start = iso(new Date(t.getTime() - 6 * 86_400_000));
    return formatRangeDMY(start, end);
  }
  if (reportType === "monthly") {
    const start = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-01`;
    const end = iso(t);
    return formatRangeDMY(start, end);
  }
  return todayDMY();
}

export function ReportContextBar({
  organization,
  staffName,
  from,
  to,
  reportType = "daily",
  textColor = "#FFFFFF",
  subColor = "rgba(255,255,255,0.72)",
}: Props) {
  const dateLabel = deriveRange(from, to, reportType);

  return (
    <View style={styles.container}>
      {!!organization && (
        <Text
          style={[styles.orgText, { color: textColor }]}
          numberOfLines={1}
        >
          {organization}
        </Text>
      )}
      {!!staffName && (
        <Text style={[styles.subText, { color: subColor }]} numberOfLines={1}>
          Staff: {staffName}
        </Text>
      )}
      <Text style={[styles.dateText, { color: subColor }]}>
        Report: {dateLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: 8,
    gap: 2,
  },
  orgText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  subText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  dateText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
