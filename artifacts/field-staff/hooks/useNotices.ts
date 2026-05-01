import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

const _domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = _domain ? `https://${_domain}` : "";

export type NoticeItem = {
  id: string;
  title: string;
  message: string;
  priority: "normal" | "important" | "urgent";
  type: "notice" | "alert" | "reminder";
  createdAt: string;
  expiresAt: string | null;
  readAt: string | null;
  acknowledged: boolean;
  recipientId: string;
};

type UseNoticesOpts = {
  phone: string | null | undefined;
  enabled?: boolean;
  pollIntervalMs?: number;
};

export function useNotices({ phone, enabled = true, pollIntervalMs = 60_000 }: UseNoticesOpts) {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotices = useCallback(async () => {
    if (!phone?.trim() || !enabled) return;
    try {
      const res = await fetch(`${API_BASE}/api/notices/my?phone=${encodeURIComponent(phone.trim())}`);
      if (!res.ok) return;
      const data = (await res.json()) as { notices: NoticeItem[] };
      setNotices(data.notices ?? []);
      setUnreadCount((data.notices ?? []).filter((n) => !n.readAt).length);
    } catch {
      // silently ignore network errors
    }
  }, [phone, enabled]);

  const markRead = useCallback(async (noticeId: string) => {
    if (!phone?.trim()) return;
    try {
      await fetch(`${API_BASE}/api/notices/${noticeId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      setNotices((prev) =>
        prev.map((n) =>
          n.id === noticeId ? { ...n, readAt: new Date().toISOString(), acknowledged: true } : n,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silently ignore
    }
  }, [phone]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchNotices();
    setLoading(false);
  }, [fetchNotices]);

  // Poll on mount and interval
  useEffect(() => {
    if (!phone?.trim() || !enabled) return;
    void refresh();
    intervalRef.current = setInterval(() => void fetchNotices(), pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phone, enabled, pollIntervalMs, refresh, fetchNotices]);

  // Re-fetch when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void fetchNotices();
    });
    return () => sub.remove();
  }, [fetchNotices]);

  const unreadNotices = notices.filter((n) => !n.readAt);
  // Sort: urgent first, then important, then normal
  const priorityOrder: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
  const sortedUnread = [...unreadNotices].sort(
    (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2),
  );

  return { notices, unreadCount, unreadNotices: sortedUnread, loading, markRead, refresh };
}
