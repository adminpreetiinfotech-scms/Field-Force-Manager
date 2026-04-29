import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";

const ACCENT = "#1E3A5F";
const GOLD   = "#D4AF37";

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const { lang, setLang, t } = useLanguage();
  const [showRegister, setShowRegister] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F4FA" }}>
      {/* Gradient header band */}
      <LinearGradient
        colors={[ACCENT, "#0D2240"]}
        style={[
          StyleSheet.absoluteFill,
          { height: 320 + insets.top + webTop },
        ]}
      />

      {/* Language toggle — top right */}
      <View style={[styles.langRow, { paddingTop: insets.top + webTop + 12 }]}>
        <TouchableOpacity
          onPress={() => setLang("en")}
          style={[styles.langBtn, lang === "en" && styles.langBtnActive]}
        >
          <Text style={[styles.langBtnText, lang === "en" && styles.langBtnTextActive]}>
            EN
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setLang("hi")}
          style={[styles.langBtn, lang === "hi" && styles.langBtnActive]}
        >
          <Text style={[styles.langBtnText, lang === "hi" && styles.langBtnTextActive]}>
            हि
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + webTop + 36,
          paddingBottom: insets.bottom + 48,
          alignItems: "center",
        }}
      >
        {/* ── Circular avatar ─────────────────────────────────────── */}
        <View style={styles.avatarShadow}>
          <View style={styles.avatarRing}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../../assets/admin-photo.png")}
              style={styles.avatar}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* ── Credit line ───────────────────────────────────────────── */}
        <Text style={styles.creditLine}>{t("developedBy")}</Text>

        <View style={styles.goldBar} />
        <Text style={styles.heroTitle}>{t("welcomeTitle")}</Text>
        <Text style={styles.heroSub}>{t("welcomeSub")}</Text>

        {/* ── Action card ──────────────────────────────────────────── */}
        <View style={styles.card}>
          {!showRegister ? (
            <>
              {/* Login */}
              <Pressable
                onPress={() => router.push("/(auth)/phone")}
                style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Feather name="log-in" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>{t("login")}</Text>
              </Pressable>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t("or")}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Register toggle */}
              <Pressable
                onPress={() => setShowRegister(true)}
                style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Feather name="user-plus" size={18} color={ACCENT} />
                <Text style={styles.secondaryBtnText}>{t("register")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.backLink} onPress={() => setShowRegister(false)}>
                <Feather name="arrow-left" size={14} color={ACCENT} />
                <Text style={styles.backLinkText}>{t("back")}</Text>
              </TouchableOpacity>

              {/* Register as Admin */}
              <Pressable
                onPress={() => router.push("/(auth)/register-admin")}
                style={({ pressed }) => [styles.roleCard, { opacity: pressed ? 0.9 : 1 }]}
              >
                <View style={styles.roleIcon}>
                  <Feather name="shield" size={20} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleTitle}>{t("registerAdmin")}</Text>
                  <Text style={styles.roleSub}>{t("registerAdminSub")}</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#AAA" />
              </Pressable>

              {/* Register as Staff */}
              <Pressable
                onPress={() => router.push("/(auth)/register-staff")}
                style={({ pressed }) => [styles.roleCard, { opacity: pressed ? 0.9 : 1 }]}
              >
                <View style={[styles.roleIcon, { backgroundColor: "#E8F5E9" }]}>
                  <Feather name="user" size={20} color="#388E3C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleTitle}>{t("registerStaff")}</Text>
                  <Text style={styles.roleSub}>{t("registerStaffSub")}</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#AAA" />
              </Pressable>
            </>
          )}

          {/* Demo hint */}
          <View style={styles.demoHint}>
            <Feather name="info" size={12} color="#888" />
            <Text style={styles.demoText}>{t("demoHint")}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  langRow: {
    position: "absolute",
    top: 0,
    right: 16,
    flexDirection: "row",
    gap: 6,
    zIndex: 20,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  langBtnActive: {
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  langBtnText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  langBtnTextActive: {
    color: ACCENT,
  },

  // Avatar
  avatarShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    borderRadius: 66,
    marginBottom: 10,
  },
  avatarRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: GOLD,
    overflow: "hidden",
  },
  avatar: {
    width: 132,
    height: 132,
  },

  // Credit line
  creditLine: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 4,
  },

  goldBar: {
    width: 40,
    height: 3,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginVertical: 10,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 27,
    maxWidth: 300,
    letterSpacing: -0.3,
  },
  heroSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "center",
    maxWidth: 280,
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginTop: 28,
    marginHorizontal: 20,
    padding: 22,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    width: "90%",
  },

  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#DDD",
  },
  dividerText: {
    fontSize: 12,
    color: "#AAA",
    fontFamily: "Inter_500Medium",
  },

  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 13,
  },
  secondaryBtnText: {
    color: ACCENT,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },

  // Register sub-panel
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  backLinkText: {
    color: ACCENT,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#E8EEF4",
    borderRadius: 10,
    padding: 14,
    backgroundColor: "#FAFBFC",
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#E8F0FA",
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111",
  },
  roleSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#888",
    marginTop: 2,
    lineHeight: 16,
  },

  // Demo hint
  demoHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#F8F8F8",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  demoText: {
    flex: 1,
    fontSize: 11,
    color: "#888",
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
});
