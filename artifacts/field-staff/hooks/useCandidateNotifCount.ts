import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

const _domain = process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app";
const API_BASE = _domain ? (_domain.startsWith("http") ? _domain : `https://${_domain}`) : "";

type UseCandidateNotifCountOpts = {
  phone: string | null | undefined;
  enabled?: boolean;
  pollIntervalMs?: number;
};

/**
 * Polls the candidate notifications endpoint and returns the unread count.
 * Designed to match the useNotices hook pattern for consistency.
 */
export function useCandidateNotifCount({
  phone,
  enabled = true,
  pollIntervalMs = 60_000,
}: UseCandidateNotifCountOpts) {
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    if (!phone?.trim() || !enabled) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/notifications?phone=${encodeURIComponent(phone.trim())}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as Array<{ isRead: boolean }>;
      setUnreadCount((data ?? []).filter((n) => !n.isRead).length);
    } catch {
      // silently ignore network errors — non-fatal
    }
  }, [phone, enabled]);

  // Mark one notification as read (optimistic update)
  const decrementCount = useCallback(() => {
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  // Reset to zero (mark all read)
  const resetCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Poll on mount and at interval
  useEffect(() => {
    if (!phone?.trim() || !enabled) return;
    void fetchCount();
    intervalRef.current = setInterval(() => void fetchCount(), pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phone, enabled, pollIntervalMs, fetchCount]);

  // Re-fetch when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void fetchCount();
    });
    return () => sub.remove();
  }, [fetchCount]);

  return { unreadCount, refresh: fetchCount, decrementCount, resetCount };
}
