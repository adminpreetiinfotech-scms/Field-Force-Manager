import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { useNotices } from "@/hooks/useNotices";

export default function StaffTabsLayout() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { user, validateSession } = useApp();
  const { unreadCount } = useNotices({ phone: user?.phone, pollIntervalMs: 30_000 });
  const isCenterStaff = user?.staffCategory === "center";

  useEffect(() => {
    validateSession();
    const interval = setInterval(validateSession, 30_000);
    return () => clearInterval(interval);
  }, [validateSession]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Inter_600SemiBold",
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={scheme === "dark" ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.card },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="shift"
        options={{
          title: isCenterStaff ? "Attendance" : "Shift",
          tabBarIcon: ({ color, size }) => (
            <Feather name={isCenterStaff ? "check-square" : "clock"} size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="meter"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          href: isCenterStaff ? null : undefined,
          title: "Trips",
          tabBarIcon: ({ color, size }) => (
            <Feather name="navigation" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaves"
        options={{
          title: "Leaves",
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="holidays"
        options={{
          title: "Holidays",
          tabBarIcon: ({ color, size }) => (
            <Feather name="sun" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: "Notices",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Feather name="bell" size={size - 2} color={color} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? "9+" : String(unreadCount)}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#DC2626",
    borderRadius: 999,
    minWidth: 14,
    height: 14,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    lineHeight: 12,
  },
});
