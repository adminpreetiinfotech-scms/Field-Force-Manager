/**
 * pushNotifications.ts
 *
 * Handles Expo push notification registration on the mobile side.
 * Call `registerForPushNotificationsAsync` once after login.
 * It requests permission, retrieves the Expo push token, and
 * saves it to the server so the backend can deliver pushes.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const _domain =
  process.env.EXPO_PUBLIC_DOMAIN ||
  "field-force-manager-Mobilization.replit.app";
const API_BASE = `https://${_domain}`;

// Configure how notifications are displayed when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request push permission, get the Expo token, and save it to the server.
 * Safe to call multiple times — server does an upsert.
 * Returns the token string or null if permission was denied / not on device.
 */
export async function registerForPushNotificationsAsync(
  phone: string,
): Promise<string | null> {
  // Push tokens only work on physical devices (not simulators/web)
  if (Platform.OS === "web") return null;

  // Request / check permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  // Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563EB",
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Save token to server (fire-and-forget — don't block login)
    void savePushToken(phone, token);

    return token;
  } catch {
    // Simulator or environment that doesn't support push
    return null;
  }
}

async function savePushToken(phone: string, token: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-staff-phone": phone,
      },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Network error — next login attempt will retry
  }
}
