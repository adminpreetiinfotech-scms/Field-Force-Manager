import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDismissedHintsQueryKey,
  useDismissHint,
  useGetDismissedHints,
} from "@workspace/api-client-react";

export const DASHBOARD_HINT_PREFIX = "dashboard_hint_";

export const DASHBOARD_HINT_KEYS = {
  centerStaff: `${DASHBOARD_HINT_PREFIX}center`,
} as const;

export const DASHBOARD_HINT_LABELS: Record<string, string> = {
  [DASHBOARD_HINT_KEYS.centerStaff]: "Center Staff Map Tip",
};

export const DASHBOARD_HINT_DESCRIPTIONS: Record<string, string> = {
  [DASHBOARD_HINT_KEYS.centerStaff]: "Tip shown on the dashboard map explaining how to center the view on a staff member's location. Appears above the staff list until dismissed.",
};

/**
 * Manages the dismissed state for a single dashboard hint key.
 *
 * - Initialises from localStorage for an instant, flicker-free render.
 * - Once the server response arrives it overrides local state and keeps
 *   localStorage in sync so subsequent page loads are still instant.
 * - Dismissing is optimistic: the hint disappears immediately and the
 *   change is persisted to the server in the background.
 *
 * Usage:
 *   const [isDismissed, dismiss] = useDashboardHint(DASHBOARD_HINT_KEYS.centerStaff);
 */
export function useDashboardHint(key: string): [boolean, () => void] {
  const [isDismissed, setIsDismissed] = useState(
    () => localStorage.getItem(key) === "true",
  );

  const queryClient = useQueryClient();
  const { data: serverHints } = useGetDismissedHints();
  const { mutate: dismissHintOnServer } = useDismissHint();

  useEffect(() => {
    if (!serverHints) return;
    const serverDismissed = serverHints.dismissedHints.includes(key);
    if (serverDismissed) {
      localStorage.setItem(key, "true");
    } else {
      localStorage.removeItem(key);
    }
    setIsDismissed(serverDismissed);
  }, [serverHints, key]);

  const dismiss = useCallback(() => {
    localStorage.setItem(key, "true");
    setIsDismissed(true);
    dismissHintOnServer(
      { data: { key } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetDismissedHintsQueryKey(), data);
        },
        onError: () => {
          queryClient.invalidateQueries({
            queryKey: getGetDismissedHintsQueryKey(),
          });
        },
      },
    );
  }, [key, dismissHintOnServer, queryClient]);

  return [isDismissed, dismiss];
}
