/**
 * Reactive hook for offline sync state.
 * Exposes queue items, network status, retry countdown, and last-sync time.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import * as Network from "expo-network";
import {
  subscribeQueueItems,
  drainActivityQueue,
  getLastSyncAt,
  isDraining,
  getNextRetryAt,
  type QueuedItem,
} from "@/services/activitySync";

export type SyncStatus = {
  /** Items currently in the retry queue */
  queueItems: QueuedItem[];
  /** Total pending count */
  pendingCount: number;
  /** Whether a drain is currently running */
  draining: boolean;
  /** Whether network appears reachable */
  isOnline: boolean;
  /** Seconds until next automatic retry (null = no retry scheduled) */
  secondsUntilRetry: number | null;
  /** Epoch ms of last successful sync this session */
  lastSyncAt: number | null;
  /** Trigger an immediate drain */
  syncNowImmediate: () => void;
};

export function useSyncStatus(): SyncStatus {
  const [queueItems, setQueueItems] = useState<QueuedItem[]>([]);
  const [draining, setDraining]     = useState(false);
  const [isOnline, setIsOnline]     = useState(true);
  const [countdown, setCountdown]   = useState<number | null>(null);
  const [lastSync, setLastSync]     = useState<number | null>(getLastSyncAt);

  // Subscribe to queue item changes
  useEffect(() => {
    const unsub = subscribeQueueItems((items) => {
      setQueueItems(items);
      setDraining(isDraining());
      setLastSync(getLastSyncAt());
    });
    return unsub;
  }, []);

  // Network polling — check every 5 s
  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted) setIsOnline(state.isConnected !== false);
      } catch {
        if (mounted) setIsOnline(true);
      }
    }
    void check();
    const id = setInterval(() => { void check(); }, 5_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Countdown ticker — updates every second while queue is non-empty
  useEffect(() => {
    if (queueItems.length === 0) {
      setCountdown(null);
      return;
    }
    function tick() {
      const next = getNextRetryAt();
      if (next === null) { setCountdown(null); return; }
      setCountdown(Math.max(0, Math.ceil((next - Date.now()) / 1000)));
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [queueItems.length]);

  const syncNowImmediate = useCallback(() => {
    setDraining(true);
    drainActivityQueue()
      .then(() => { setLastSync(getLastSyncAt()); })
      .catch(() => {})
      .finally(() => setDraining(false));
  }, []);

  return {
    queueItems,
    pendingCount: queueItems.length,
    draining,
    isOnline,
    secondsUntilRetry: countdown,
    lastSyncAt: lastSync,
    syncNowImmediate,
  };
}
