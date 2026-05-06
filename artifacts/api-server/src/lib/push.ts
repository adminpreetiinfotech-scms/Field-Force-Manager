/**
 * push.ts — Expo Push Notification utility
 *
 * Sends push notifications via the Expo Push HTTP API.
 * No SDK required — plain HTTP POST to exp.host.
 * Fire-and-forget: wrap callers in `void (async () => { ... })()`.
 */

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: "default";
};

/**
 * Send push notifications to one or more Expo push tokens.
 * Invalid / non-Expo tokens are silently filtered out.
 * Errors are caught and optionally logged via `warn` — never thrown.
 */
export async function sendPushSilent(
  tokens: (string | null | undefined)[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  warn?: (...args: unknown[]) => void,
): Promise<void> {
  const valid = tokens.filter(
    (t): t is string =>
      typeof t === "string" &&
      (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[")),
  );
  if (!valid.length) return;

  const messages: PushMessage[] = valid.map((to) => ({
    to,
    title,
    body,
    data: data ?? {},
    sound: "default",
  }));

  // Expo batch limit: 100 messages per request
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok && warn) {
        warn(`[push] Expo API returned HTTP ${res.status}`);
      }
    } catch (err) {
      if (warn) warn("[push] fetch error", err);
    }
  }
}
