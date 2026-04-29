import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.primary, "#13325F"]}
        style={[
          StyleSheet.absoluteFill,
          { height: 400 + insets.top + webTop },
        ]}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 28 + webTop,
          paddingBottom: insets.bottom + 48,
        }}
      >
        {/* Brand */}
        <View style={styles.headerWrap}>
          <View style={styles.brand}>
            <View
              style={[
                styles.logoBadge,
                { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16 },
              ]}
            >
              <Feather name="map-pin" size={22} color="#FCD34D" />
            </View>
            <View>
              <Text style={styles.brandTitle}>Field Staff Manager</Text>
              <Text style={styles.brandSub}>
                Operations command for the field
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Welcome aboard</Text>
          <Text style={styles.heroSub}>
            GPS-verified attendance, auto-tracked kilometers, and tamper-proof
            audit trails — all in one app.
          </Text>
        </View>

        {/* Registration options */}
        <View style={styles.cardsWrap}>
          <Text
            style={[styles.sectionLabel, { color: colors.mutedForeground }]}
          >
            CREATE YOUR ACCOUNT
          </Text>

          <Pressable
            onPress={() => router.push("/(auth)/register-admin")}
            style={({ pressed }) => [
              styles.roleCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary + "44",
                borderRadius: colors.radius + 4,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.roleIcon,
                {
                  backgroundColor: colors.primary + "18",
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather name="shield" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.roleTitle, { color: colors.foreground }]}
              >
                Register as Admin
              </Text>
              <Text
                style={[styles.roleSub, { color: colors.mutedForeground }]}
              >
                Manage your team, view live map & activity feed
              </Text>
            </View>
            <Feather
              name="arrow-right"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/register-staff")}
            style={({ pressed }) => [
              styles.roleCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.pillarAccuracy + "44",
                borderRadius: colors.radius + 4,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.roleIcon,
                {
                  backgroundColor: colors.pillarAccuracy + "18",
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather name="user" size={22} color={colors.pillarAccuracy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.roleTitle, { color: colors.foreground }]}
              >
                Register as Staff
              </Text>
              <Text
                style={[styles.roleSub, { color: colors.mutedForeground }]}
              >
                Log attendance, capture meter reads & track trips
              </Text>
            </View>
            <Feather
              name="arrow-right"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
            <Text
              style={[styles.dividerText, { color: colors.mutedForeground }]}
            >
              OR
            </Text>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
          </View>

          {/* Login CTA */}
          <Pressable
            onPress={() => router.push("/(auth)/phone")}
            style={({ pressed }) => [
              styles.loginBtn,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="log-in" size={16} color={colors.foreground} />
            <Text style={[styles.loginText, { color: colors.foreground }]}>
              Already registered? Sign in
            </Text>
          </Pressable>

          {/* Demo hint */}
          <View
            style={[
              styles.demoHint,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text
              style={[styles.demoText, { color: colors.mutedForeground }]}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold" }}>Demo: </Text>
              use 9999999999 (admin) or 9876543210 (staff) to sign in without
              registering. OTP is{" "}
              <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                1234
              </Text>
              .
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 22,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 36,
  },
  logoBadge: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  brandSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  heroSub: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 10,
    lineHeight: 21,
    maxWidth: 320,
  },
  cardsWrap: {
    marginTop: 32,
    paddingHorizontal: 18,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderWidth: 1,
  },
  roleIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  roleSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
    lineHeight: 17,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  loginText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  demoHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  demoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
