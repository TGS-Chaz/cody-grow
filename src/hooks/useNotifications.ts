import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { subscribeToChanges } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface Notification {
  id: string;
  org_id: string;
  user_id: string;
  event_key: string;
  title: string;
  content: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string | null;
}

export function useNotifications(limit: number = 20) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_in_app_notifications")
        .select("*").eq("user_id", user.id).is("dismissed_at", null)
        .order("created_at", { ascending: false }).limit(limit);
      if (cancelled) return;
      setData((rows ?? []) as Notification[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick, limit]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Realtime: push-refresh when this user's notifications change.
  // Wrapped so a Realtime failure never crashes the notification bell.
  useEffect(() => {
    if (!user?.id) return;
    const sub = subscribeToChanges(`notifications:${user.id}`, [
      { table: "grow_in_app_notifications", filter: `user_id=eq.${user.id}`, callback: () => setTick((t) => t + 1) },
    ]);
    return () => sub.unsubscribe();
  }, [user?.id]);

  return { data, loading, refresh };
}

export function useUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    let cancelled = false;
    (async () => {
      const { count: c } = await supabase.from("grow_in_app_notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id).is("read_at", null).is("dismissed_at", null);
      if (!cancelled) setCount(c ?? 0);
    })();
    return () => { cancelled = true; };
  }, [user?.id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Realtime: bump tick when this user's notifications change
  useEffect(() => {
    if (!user?.id) return;
    const sub = subscribeToChanges(`notifications-count:${user.id}`, [
      { table: "grow_in_app_notifications", filter: `user_id=eq.${user.id}`, callback: () => setTick((t) => t + 1) },
    ]);
    return () => sub.unsubscribe();
  }, [user?.id]);

  return { count, refresh };
}

export function useMarkAsRead() {
  return useCallback(async (id: string) => {
    await supabase.from("grow_in_app_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }, []);
}

export function useMarkAllRead() {
  const { user } = useAuth();
  return useCallback(async () => {
    if (!user) return;
    await supabase.from("grow_in_app_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  }, [user?.id]);
}

export function useDismissNotification() {
  return useCallback(async (id: string) => {
    await supabase.from("grow_in_app_notifications").update({ dismissed_at: new Date().toISOString() }).eq("id", id);
  }, []);
}
