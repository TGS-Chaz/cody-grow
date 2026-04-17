import { supabase } from "./supabase";

/**
 * Safely subscribe to one or more postgres_changes on a single channel.
 *
 * Why this helper exists
 * ----------------------
 * `supabase-js` requires every `.on()` listener to be attached BEFORE the
 * channel is `.subscribe()`d. Two additional footguns:
 *
 *   1. `supabase.channel("name")` returns the SAME cached channel if one with
 *      the same name already exists in the client. In React StrictMode the
 *      effect fires → cleanup runs → effect fires AGAIN, and on the second run
 *      the cached channel is still mid-teardown. Adding `.on()` to a channel
 *      that has already been `.subscribe()`d throws
 *      "cannot add postgres_changes callbacks after subscribe()".
 *
 *   2. If the Realtime server is unreachable (auth blip, self-hosted outage,
 *      bad anon key), subscribe throws synchronously and crashes the page.
 *      Realtime is an enhancement — pages must render without it.
 *
 * Additional smoothing:
 *   - Only the FIRST failure per channel logs a warn. Subsequent reconnection
 *     attempts are silent to keep the console clean.
 *   - After MAX_RETRIES failures the channel is removed and we stop trying
 *     entirely with a single "giving up" line.
 */
export interface ChangeListener {
  /** The postgres_changes filter spec. `event` defaults to '*'. */
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  table: string;
  filter?: string;
  callback: (payload: unknown) => void;
}

export interface Subscription {
  unsubscribe: () => void;
}

const MAX_RETRIES = 3;

export function subscribeToChanges(
  baseName: string,
  listeners: ChangeListener[],
): Subscription {
  const uniqueName = `${baseName}:${Math.random().toString(36).slice(2, 10)}`;

  // Track failure state per channel so we only log once + stop after N failures.
  let failureCount = 0;
  let hasLoggedFirstError = false;
  let hasGivenUp = false;
  let channelRef: any = null;
  let isUnsubscribed = false;

  try {
    channelRef = supabase.channel(uniqueName);
    for (const l of listeners) {
      channelRef = channelRef.on(
        "postgres_changes",
        { event: l.event ?? "*", schema: l.schema ?? "public", table: l.table, filter: l.filter },
        l.callback,
      );
    }
    channelRef.subscribe((status: string, err?: unknown) => {
      // SUBSCRIBED = healthy. Reset counters on a successful reconnect.
      if (status === "SUBSCRIBED") {
        failureCount = 0;
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || err) {
        failureCount++;
        if (!hasLoggedFirstError) {
          hasLoggedFirstError = true;
          console.warn(`[realtime] ${baseName}: ${status}`, err ?? "");
        }
        if (failureCount >= MAX_RETRIES && !hasGivenUp && !isUnsubscribed) {
          hasGivenUp = true;
          console.warn(
            `[realtime] Giving up on channel ${baseName} after ${MAX_RETRIES} attempts. ` +
            `Data will refresh on page navigation.`,
          );
          // Removing the channel stops supabase-js from auto-reconnecting.
          try { supabase.removeChannel(channelRef); } catch { /* silent */ }
        }
      }
    });
    return {
      unsubscribe: () => {
        isUnsubscribed = true;
        if (hasGivenUp) return; // already removed
        try { supabase.removeChannel(channelRef); } catch { /* silent */ }
      },
    };
  } catch (err) {
    console.warn(`[realtime] failed to subscribe ${baseName}:`, err);
    return { unsubscribe: () => {} };
  }
}
