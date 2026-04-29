/**
 * Offline-first activity sync service.
 *
 * Every staff action (check-in, meter read, trip start/end) is fired straight
 * to POST /api/activity.  If the request fails (no network, server down) the
 * payload is persisted to AsyncStorage and retried automatically:
 *   - Immediate retry once on first failure.
 *   - Background timer at 30-second intervals while the queue is non-empty.
 *   - Manual drain when `syncNow()` is called or the app comes back to
 *     foreground.
 *   - Items are dropped after MAX_ATTEMPTS to prevent stale data building up.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import {
  ApiError,
  createActivity,
  type CreateActivityInput,
} from "@workspace/api-client-react";

const QUEUE_KEY = "@field-staff/activity-queue-v2";
const MAX_ATTEMPTS = 10;
const RETRY_INTERVAL_MS = 30_000;

type QueuedItem = {
  id: string;
  body: CreateActivityInput;
  attempts: number;
  queuedAt: number;
  lastError?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s);
}

let _queueLength = 0;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;
let _draining = false;

const _listeners = new Set<(n: number) => void>();

function _notifyListeners() {
  for (const fn of _listeners) fn(_queueLength);
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
  _queueLength = items.length;
  _notifyListeners();
}

/** Must be called once on app startup to hydrate the in-memory queue length. */
export async function initActivityQueue() {
  const items = await _readQueue();
  _queueLength = items.length;
  _notifyListeners();
  if (items.length > 0) _scheduleRetry();
  AppState.addEventListener("change", _onAppState);
}

function _onAppState(status: AppStateStatus) {
  if (status === "active") {
    drainActivityQueue().catch(() => {});
  }
}

function _scheduleRetry() {
  if (_retryTimer !== null) return;
  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    drainActivityQueue().catch(() => {});
  }, RETRY_INTERVAL_MS);
}

async function _trySend(body: CreateActivityInput): Promise<boolean> {
  try {
    await createActivity(body);
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
      return true;
    }
    return false;
  }
}

/**
 * Enqueue an activity event.  Attempts an immediate send first; only writes
 * to the persistent queue if that fails.
 */
export async function enqueueActivity(body: CreateActivityInput) {
  if (!isUuid(body.staffId)) {
    return;
  }

  const ok = await _trySend(body);
  if (ok) return;

  const items = await _readQueue();
  items.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    body,
    attempts: 1,
    queuedAt: Date.now(),
  });
  await _writeQueue(items);
  _scheduleRetry();
}

/**
 * Drain the offline queue.  Safe to call from `syncNow` or on foreground.
 * Returns the number of items successfully sent.
 */
export async function drainActivityQueue(): Promise<number> {
  if (_draining) return 0;
  _draining = true;
  try {
    const items = await _readQueue();
    if (items.length === 0) return 0;

    const remaining: QueuedItem[] = [];
    let sent = 0;

    for (const item of items) {
      const ok = await _trySend(item.body);
      if (ok) {
        sent++;
      } else {
        const next = { ...item, attempts: item.attempts + 1 };
        if (next.attempts < MAX_ATTEMPTS) remaining.push(next);
      }
    }

    await _writeQueue(remaining);
    if (remaining.length > 0) _scheduleRetry();
    return sent;
  } finally {
    _draining = false;
  }
}

/**
 * Subscribe to queue length changes for reactive UI.
 * Returns an unsubscribe function.
 */
export function subscribeActivityQueueLength(
  fn: (n: number) => void,
): () => void {
  _listeners.add(fn);
  fn(_queueLength);
  return () => {
    _listeners.delete(fn);
  };
}

/** Snapshot of current pending queue length. */
export function getActivityQueueLength() {
  return _queueLength;
}
