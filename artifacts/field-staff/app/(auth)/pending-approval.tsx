import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

const API_BASE =
  Platform.OS === "web"
    ? ""
    : `https://${process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app"}`;

export default function PendingApprovalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ name?: string; phone?: string; role?: string }>();
  const { setPendingPhone } = useApp();

  const [checking, setChecking] = useState(false);
  const userName = params.name ?? "User";
  const userPhone = params.phone ?? "";
  const userRole = params.role ?? "staff";
  const isAdmin = userRole === "admin";

  const webTop = Platform.OS === "web" ? 67 : 0;

  const handleCheckStatus = async () => {
    if (!userPhone) {
      Alert.alert("Error", "Phone number not found. Please go back and log in.");
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/check-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: userPhone }),
      });
      if (!res.ok) throw new Error("Failed to check status.");
      const data = (await res.json()) as { exists: boolean; hasMpin: boolean; approvalStatus?: string };
      if (data.approvalStatus === "approved") {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        setPendingPhone(userPhone);
        router.replace({ pathname: "/(auth)/mpin", params: { mode: "login" } });
      } else if (data.approvalStatus === "rejected") {
        Alert.alert(
          "Account Rejected",
          "Your account has been rejected. Please contact your administrator for more information.",
          [{ text: "OK" }],
        );
      } else {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
        Alert.alert(
          "Still Pending",
          isAdmin
            ? "Your admin account is still awaiting Super Admin approval. Please try again later."
            : "Your account is still awaiting admin approval. Please try again later.",
          [{ text: "OK" }],
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to check status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace("/");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24 + webTop,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 24,
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
          <Feather name="clock" size={32} color="#D97706" />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.foreground }]}>
          Account Pending Approval
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {isAdmin
            ? "Aapka admin account registered ho gaya hai. Aapko Super Admin se approval milne ka intezaar karna hoga."
            : "Aapka account registered ho gaya hai. Aapko apne admin se approval milne ka intezaar karna hoga."}
        </Text>

        {/* Info card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Row label="Name" value={userName} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row label="Phone" value={`+91 ${userPhone}`} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row label="Role" value={isAdmin ? "Admin" : "Field Staff"} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row label="Status" value="Pending Approval" valueColor="#D97706" colors={colors} />
        </View>

        {/* Info note */}
        <View
          style={[
            styles.note,
            { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", borderRadius: colors.radius },
          ]}
        >
          <Feather name="info" size={14} color="#3B82F6" style={{ marginTop: 1 }} />
          <Text style={[styles.noteText, { color: "#1D4ED8" }]}>
            {isAdmin
              ? "Super Admin aapka account review karenge aur approve/reject karenge. MPIN already set ho gaya hai — approve hone ke baad aap login kar sakte hain."
              : "Aapke admin aapka account review karenge aur approve/reject karenge. MPIN already set ho gaya hai — approve hone ke baad aap login kar sakte hain."}
          </Text>
        </View>

        {/* Check Status Button */}
        <Pressable
          onPress={handleCheckStatus}
          disabled={checking}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: colors.radius,
              opacity: pressed || checking ? 0.8 : 1,
              marginTop: 28,
            },
          ]}
        >
          {checking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>Check Approval Status</Text>
            </>
          )}
        </Pressable>

        {/* Back to login */}
        <Pressable
          onPress={handleBackToLogin}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginTop: 14, alignItems: "center" })}
        >
          <Text style={[styles.link, { color: colors.mutedForeground }]}>
            Back to Login
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  valueColor,
  colors,
}: {
  label: string;
  value: string;
  valueColor?: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 22,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 10,
  },
  sub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 28,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  note: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  link: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
