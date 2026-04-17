import { createClient } from "@supabase/supabase-js";

// Trim — Vercel env var injection (and some shell-copied .env files) can
// leave a trailing \n that ends up URL-encoded as %0A in WebSocket connect
// URLs, which Realtime rejects silently. Defend at the boundary.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase env vars not set — running in mock-data mode.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
