import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

const _domain = process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app";
const API_BASE = _domain ? `https://${_domain}` : "";

type Size = "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, { logo: number; name: number; scheme: number; radius: number }> = {
  sm: { logo: 40, name: 13, scheme: 11, radius: 10 },
  md: { logo: 60, name: 16, scheme: 12, radius: 14 },
  lg: { logo: 84, name: 20, scheme: 14, radius: 20 },
};

type Props = {
  companyName?: string | null;
  companyLogoUrl?: string | null;
  schemeName?: string | null;
  size?: Size;
  nameColor?: string;
  schemeColor?: string;
  logoBackground?: string;
  centered?: boolean;
};

export function CompanyBrand({
  companyName,
  companyLogoUrl,
  schemeName,
  size = "md",
  nameColor = "#FFFFFF",
  schemeColor = "rgba(255,255,255,0.72)",
  logoBackground = "rgba(255,255,255,0.15)",
  centered = true,
}: Props) {
  const s = SIZE_MAP[size];
  const logoUri = companyLogoUrl
    ? companyLogoUrl.startsWith("http")
      ? companyLogoUrl
      : `${API_BASE}${companyLogoUrl}`
    : null;

  const initials = companyName
    ? companyName
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "NS";

  return (
    <View style={[styles.container, centered && styles.centered]}>
      {/* Logo circle */}
      <View
        style={[
          styles.logoWrap,
          {
            width: s.logo,
            height: s.logo,
            borderRadius: s.radius,
            backgroundColor: logoBackground,
          },
        ]}
      >
        {logoUri ? (
          <Image
            source={{ uri: logoUri }}
            style={{ width: s.logo, height: s.logo, borderRadius: s.radius }}
            resizeMode="contain"
          />
        ) : (
          <Text
            style={[
              styles.initials,
              { fontSize: s.logo * 0.36, color: nameColor },
            ]}
          >
            {initials}
          </Text>
        )}
      </View>

      {/* Text block */}
      <View style={centered ? styles.textsCentered : styles.textsLeft}>
        {!!companyName && (
          <Text
            style={[styles.name, { fontSize: s.name, color: nameColor }]}
            numberOfLines={2}
          >
            {companyName}
          </Text>
        )}
        {!!schemeName && (
          <Text
            style={[styles.scheme, { fontSize: s.scheme, color: schemeColor }]}
            numberOfLines={1}
          >
            {schemeName}
          </Text>
        )}
        <Text style={[styles.devCredit, { color: schemeColor }]}>
          Developed by Preeti Infotech
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  centered: {
    alignItems: "center",
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: {
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  textsCentered: {
    alignItems: "center",
    gap: 2,
  },
  textsLeft: {
    gap: 2,
  },
  name: {
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  scheme: {
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  devCredit: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 0.1,
    opacity: 0.7,
    marginTop: 2,
  },
});
