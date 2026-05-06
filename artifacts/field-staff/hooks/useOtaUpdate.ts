/**
 * OTA update hook using expo-updates.
 *
 * Behaviour:
 *   - Checks for a new update every time the app comes to the foreground.
 *   - If an update is available it fetches it silently, then shows a native
 *     alert letting the staff member choose to reload now or later.
 *   - Completely disabled in Expo Go / development builds where
 *     `Updates.isEnabled` is false — no errors thrown in those environments.
 *
 * Usage:  call `useOtaUpdate()` once at the root layout level.
 */
import { useEffect, useRef } from "react";
import { Alert, AppState, type AppStateStatus, Platform } from "react-native";
import * as Updates from "expo-updates";

export function useOtaUpdate() {
  const checkingRef = useRef(false);

  async function checkAndFetch() {
    if (checkingRef.current) return;
    if (!Updates.isEnabled) return;        // dev builds / Expo Go
    if (Platform.OS === "web") return;

    checkingRef.current = true;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return;

      // Silently download in the background
      await Updates.fetchUpdateAsync();

      Alert.alert(
        "Update Available",
        "A new version of SCMS has been downloaded. Restart now to apply it — this only takes a second.",
        [
          {
            text: "Later",
            style: "cancel",
          },
          {
            text: "Restart Now",
            style: "default",
            onPress: () => {
              Updates.reloadAsync().catch(() => {});
            },
          },
        ],
        { cancelable: true },
      );
    } catch {
      // Network error or update server unreachable — silent, will retry next foreground
    } finally {
      checkingRef.current = false;
    }
  }

  useEffect(() => {
    // Check on first mount
    void checkAndFetch();

    // Re-check whenever app returns to foreground
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void checkAndFetch();
    });

    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
