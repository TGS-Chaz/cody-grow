import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface SOP {
  id: string;
  org_id: string;
  title: string;
  category: string | null;
  content: string | null;
  document_url: string | null;
  version: string;
  is_current: boolean | null;
  is_published: boolean | null;
  previous_version_id: string | null;
  effective_date: string | null;
  next_review_date: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SOPInput {
  title: string;
  category?: string | null;
  content?: string | null;
  document_url?: string | null;
  effective_date?: string | null;
  next_review_date?: string | null;
  is_published?: boolean;
}

export function useSops() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows, error } = await supabase.from("grow_sops")
        .select("*").eq("org_id", orgId).eq("is_current", true)
        .order("title");
      if (cancelled) return;
      if (error) console.warn("[useSops]", error.message);
      setData((rows ?? []) as SOP[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useSOPVersionHistory(sopId: string | undefined) {
  const [data, setData] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sopId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Walk the previous_version_id chain starting at the current SOP.
      const versions: SOP[] = [];
      let currentId: string | null = sopId;
      const seen = new Set<string>();
      while (currentId && !seen.has(currentId)) {
        seen.add(currentId);
        const res: { data: any } = await supabase.from("grow_sops").select("*").eq("id", currentId).maybeSingle();
        if (!res.data) break;
        versions.push(res.data as SOP);
        currentId = res.data.previous_version_id ?? null;
      }
      if (cancelled) return;
      setData(versions);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sopId]);

  return { data, loading };
}

/** Insert a new SOP row that replaces `current`: increments version, links
 * the old one via previous_version_id, and flips is_current. */
export function useCreateSopVersion() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (current: SOP, patch: Partial<SOPInput>): Promise<SOP> => {
    if (!orgId) throw new Error("No active org");
    const nextVersion = bumpVersion(current.version);
    const { data, error } = await supabase.from("grow_sops").insert({
      org_id: orgId,
      title: patch.title ?? current.title,
      category: patch.category ?? current.category,
      content: patch.content ?? current.content,
      document_url: patch.document_url ?? current.document_url,
      version: nextVersion,
      is_current: true,
      is_published: patch.is_published ?? current.is_published ?? true,
      previous_version_id: current.id,
      effective_date: patch.effective_date ?? new Date().toISOString().slice(0, 10),
      next_review_date: patch.next_review_date ?? current.next_review_date,
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    // Retire the previous version
    await supabase.from("grow_sops").update({ is_current: false }).eq("id", current.id);
    return data as SOP;
  }, [orgId, user?.id]);
}

/** Mark `version` as current again and retire whatever is currently current. */
export function useRestoreSopVersion() {
  return useCallback(async (version: SOP, currentId: string): Promise<void> => {
    await supabase.from("grow_sops").update({ is_current: false }).eq("id", currentId);
    await supabase.from("grow_sops").update({ is_current: true }).eq("id", version.id);
  }, []);
}

function bumpVersion(v: string | null | undefined): string {
  if (!v) return "1.1";
  const m = /^(\d+)\.(\d+)$/.exec(v);
  if (!m) return `${v}.1`;
  return `${m[1]}.${Number(m[2]) + 1}`;
}
