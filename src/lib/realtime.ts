import { supabase } from "./supabase";

/**
 * Safely subscribe to one or more postgres_changes on a single channel.
 *
 * Why this helper exists
 * ----------------------
 * `supabase-js` requires every `.on()` listener to be attached BEFORE the
 * channel is `.subscribe()`d. That's fine for the fluent chain we use here,
 * but two separate footguns still bit us:
 *
 *   1. `supabase.channel("name")` returns the SAME cached channel if one with
 *      the same name already exists in the client. In React StrictMode, the
 *      effect runs → cleanup runs → effect runs AGAIN, and on the second run
 *      the cached channel is still mid-teardown. Adding `.on()` to a channel
 *      that has already been `.subscribe()`d throws
 *      "cannot add postgres_changes callbacks after subscribe()".
 *
 *   2. If the Realtime server is unreachable (self-hosted, auth blip), the
 *      subscribe throws synchronously and crashes the whole page. Realtime
 *      is an enhancement — pages must render without it.
 *
 * Both are solved by:
 *   - Appending a random suffix so every mount gets a brand-new channel name.
 *   - Wrapping creation + subscribe in try/catch and returning a no-op cleanup
 *     when it fails.
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

/**
 * Subscribe to a bundle of postgres_changes listeners on a single channel.
 * Returns a `Subscription` with `unsubscribe()` — safe to call even when the
 * subscribe itself failed (it'll just be a no-op).
 */
export function subscribeToChanges(
  baseName: string,
  listeners: ChangeListener[],
): Subscription {
  const uniqueName = `${baseName}:${Math.random().toString(36).slice(2, 10)}`;
  try {
    let channel: any = supabase.channel(uniqueName);
    for (const l of listeners) {
      channel = channel.on(
        "postgres_changes",
        { event: l.event ?? "*", schema: l.schema ?? "public", table: l.table, filter: l.filter },
        l.callback,
      );
    }
    channel.subscribe((status: string, err?: unknown) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || err) {
        console.warn(`[realtime] ${uniqueName}: ${status}`, err);
      }
    });
    return {
      unsubscribe: () => {
        try { supabase.removeChannel(channel); } catch { /* silent */ }
      },
    };
  } catch (err) {
    console.warn(`[realtime] failed to subscribe ${uniqueName}:`, err);
    return { unsubscribe: () => {} };
  }
}
