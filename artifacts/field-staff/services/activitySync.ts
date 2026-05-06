/**
 * Offline-first activity sync service.
 *
 * Every staff action (check-in, meter read, trip start/end) is fired straight
 * to POST /api/activity.  If the request fails (no network, server down) the
 * payload is persisted to AsyncStorage and retried automatically:
 *
 *   - Immediate retry once on first failure.
 *   - Exponential backoff timer while the queue is non-empty:
 *       Attempt 1 → 30 s, 2 → 60 s, 3 → 120 s, 4+ → 300 s
 *   - Network-aware: skips drain when device is offline.
 *   - Manual drain when `drainActivityQueue()` is called explicitly or the
 *     app comes back to foreground.
 *   - Items are dropped after MAX_ATTEMPTS to prevent stale data building up.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";
import {
  ApiError,
  createActivity,
  type CreateActivityInput,
} from "@workspace/api-client-react";

const QUEUE_KEY   = "@field-staff/activity-queue-v2";
const MAX_ATTEMPTS = 10;

// Exponential backoff steps (ms). Last value is used for all subsequent attempts.
const BACKOFF_MS = [30_000, 60_000, 120_000, 300_000];

function backoffMs(attempts: number): number {
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] ?? 300_000;
}

export type QueuedItem = {
  id:          string;
  body:        CreateActivityInput;
  attempts:    number;
  queuedAt:    number;
  nextRetryAt: number;
  lastError?:  string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s);
}

let _items: QueuedItem[] = [];
let _retryTimer: ReturnType<typeof setTimeout> | null = null;
let _draining = false;
let _lastSyncAt: number | null = null;

// Subscribers for queue-length (legacy) and full item list.
const _lengthListeners = new Set<(n: number) => void>();
const _itemListeners   = new Set<(items: QueuedItem[]) => void>();

function _notify() {
  for (const fn of _lengthListeners) fn(_items.length);
  for (const fn of _itemListeners)   fn([..._items]);
}

async function _readQueue(): Promise<QueuedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedItem[];
  } catch {
    return [];
  }
}

async function _writeQueue(items: QueuedItem[]) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* best-effort */
  }
  _items = items;
  _notify();
}

/** Must be called once on app startup to hydrate the in-memory queue. */
export async function initActivityQueue() {
  _items = await _readQueue();
  _notify();
  if (_items.length > 0) _scheduleRetry(_items[0]?.nextRetryAt);
  AppState.addEventListener("change", _onAppState);
}

function _onAppState(status: AppStateStatus) {
  if (status === "active") {
    drainActivityQueue().catch(() => {});
  }
}

function _scheduleRetry(nextRetryAt?: number) {
  if (_retryTimer !== null) return;
  const delay = nextRetryAt
    ? Math.max(0, nextRetryAt - Date.now())
    : backoffMs(0);
  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    drainActivityQueue().catch(() => {});
  }, delay);
}

async function _isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    // isConnected=null means unknown (e.g. Expo Go dev) — allow attempt
    if (state.isConnected === false) return false;
    return true;
  } catch {
    return true; // conservative: try anyway
  }
}

async function _trySend(body: CreateActivityInput): Promise<{ ok: boolean; error?: string }> {
  try {
    await createActivity(body);
    return { ok: true };
  } catch (err) {
    // 4xx = client error → drop (won't succeed on retry)
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
      return { ok: true };
    }
    const msg =
      err instanceof Error ? err.message :
      err instanceof ApiError ? `HTTP ${err.status}` :
      "Unknown error";
    return { ok: false, error: msg };
  }
}

/**
 * Enqueue an activity event.  Attempts an immediate send first; only writes
 * to the persistent queue if that fails.
 */
export async function enqueueActivity(body: CreateActivityInput) {
  if (!isUuid(body.staffId)) return;

  const { ok } = await _trySend(body);
  if (ok) {
    _lastSyncAt = Date.now();
    return;
  }

  const nextRetryAt = Date.now() + backoffMs(1);
  const updated = [
    ..._items,
    {
      id:          Date.now().toString(36) + Math.random().toString(36).slice(2),
      body,
      attempts:    1,
      queuedAt:    Date.now(),
      nextRetryAt,
      lastError:   "Initial send failed — will retry",
    },
  ];
  await _writeQueue(updated);
  _scheduleRetry(nextRetryAt);
}

/**
 * Drain the offline queue.  Safe to call from syncNow or on foreground.
 * Skips drain if device is known to be offline.
 * Returns the number of items successfully sent.
 */
export async function drainActivityQueue(): Promise<number> {
  if (_draining) return 0;
  if (!(await _isOnline())) return 0;

  _draining = true;
  try {
    const items = await _readQueue();
    if (items.length === 0) return 0;

    const remaining: QueuedItem[] = [];
    let sent = 0;

    for (const item of items) {
      const { ok, error } = await _trySend(item.body);
      if (ok) {
        sent++;
      } else {
        const nextAttempts = item.attempts + 1;
        if (nextAttempts < MAX_ATTEMPTS) {
          remaining.push({
            ...item,
            attempts:    nextAttempts,
            nextRetryAt: Date.now() + backoffMs(nextAttempts),
            lastError:   error ?? "Send failed",
          });
        }
        // else: drop silently after MAX_ATTEMPTS
      }
    }

    await _writeQueue(remaining);
    if (sent > 0) _lastSyncAt = Date.now();
    if (remaining.length > 0) {
      _scheduleRetry(remaining[0]?.nextRetryAt);
    }
    return sent;
  } finally {
    _draining = false;
  }
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

/** Subscribe to queue-length changes (legacy). Returns unsubscribe fn. */
export function subscribeActivityQueueLength(fn: (n: number) => void): () => void {
  _lengthListeners.add(fn);
  fn(_items.length);
  return () => { _lengthListeners.delete(fn); };
}

/** Subscribe to full queue-item list changes. Returns unsubscribe fn. */
export function subscribeQueueItems(fn: (items: QueuedItem[]) => void): () => void {
  _itemListeners.add(fn);
  fn([..._items]);
  return () => { _itemListeners.delete(fn); };
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

/** Snapshot of current pending queue length. */
export function getActivityQueueLength(): number {
  return _items.length;
}

/** Snapshot of current queue items. */
export function getQueueItems(): QueuedItem[] {
  return [..._items];
}

/** Timestamp (ms) of last successful sync, or null if none this session. */
export function getLastSyncAt(): number | null {
  return _lastSyncAt;
}

/** Whether a drain is in progress right now. */
export function isDraining(): boolean {
  return _draining;
}

/** When the next automatic retry is scheduled (ms epoch), or null. */
export function getNextRetryAt(): number | null {
  if (_items.length === 0) return null;
  const soonest = _items.reduce((min, it) => Math.min(min, it.nextRetryAt), Infinity);
  return soonest === Infinity ? null : soonest;
}
