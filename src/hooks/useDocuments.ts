import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface GrowDocument {
  id: string;
  org_id: string;
  name: string;
  document_category: string | null;
  entity_type: string | null;
  entity_id: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  expires_at: string | null;
  tags: string[] | null;
  folder_id: string | null;
  is_folder: boolean | null;
  uploaded_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UploadDocumentInput {
  name: string;
  document_category?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  expires_at?: string | null;
  tags?: string[] | null;
  folder_id?: string | null;
  file?: File | null;
}

const BUCKET = "documents";

export function useDocuments(folderId: string | null = null) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<GrowDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_documents").select("*").eq("org_id", orgId);
      q = folderId ? q.eq("folder_id", folderId) : q.is("folder_id", null);
      const { data: rows, error } = await q.order("is_folder", { ascending: false }).order("name");
      if (cancelled) return;
      if (error) console.warn("[useDocuments]", error.message);
      setData((rows ?? []) as GrowDocument[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, folderId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useFolder(folderId: string | null | undefined) {
  const [data, setData] = useState<GrowDocument | null>(null);
  useEffect(() => {
    if (!folderId) { setData(null); return; }
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase.from("grow_documents").select("*").eq("id", folderId).maybeSingle();
      if (!cancelled) setData((row as any) ?? null);
    })();
    return () => { cancelled = true; };
  }, [folderId]);
  return data;
}

export function useFolderBreadcrumbs(folderId: string | null | undefined) {
  const [data, setData] = useState<GrowDocument[]>([]);
  useEffect(() => {
    if (!folderId) { setData([]); return; }
    let cancelled = false;
    (async () => {
      const crumbs: GrowDocument[] = [];
      let currentId: string | null = folderId;
      const seen = new Set<string>();
      while (currentId && !seen.has(currentId)) {
        seen.add(currentId);
        const res: { data: any } = await supabase.from("grow_documents").select("*").eq("id", currentId).maybeSingle();
        if (!res.data) break;
        crumbs.unshift(res.data);
        currentId = res.data.folder_id ?? null;
      }
      if (!cancelled) setData(crumbs);
    })();
    return () => { cancelled = true; };
  }, [folderId]);
  return data;
}

export function useUploadDocument() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: UploadDocumentInput): Promise<GrowDocument> => {
    if (!orgId) throw new Error("No active org");
    let file_url: string | null = null;
    let file_size_bytes: number | null = null;
    let mime_type: string | null = null;
    let file_type: string | null = null;
    if (input.file) {
      try { await supabase.storage.createBucket(BUCKET, { public: false }); } catch { /* likely exists */ }
      const path = `${orgId}/${Date.now()}-${input.file.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, input.file, {
        contentType: input.file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
      file_url = signed?.signedUrl ?? null;
      file_size_bytes = input.file.size;
      mime_type = input.file.type || null;
      file_type = input.file.name.split(".").pop()?.toLowerCase() ?? null;
    }
    const { data, error } = await supabase.from("grow_documents").insert({
      org_id: orgId,
      name: input.name,
      document_category: input.document_category ?? null,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      file_url,
      file_size_bytes,
      mime_type,
      file_type,
      expires_at: input.expires_at ?? null,
      tags: input.tags ?? null,
      folder_id: input.folder_id ?? null,
      is_folder: false,
      uploaded_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    return data as GrowDocument;
  }, [orgId, user?.id]);
}

export function useCreateFolder() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (name: string, parentId: string | null = null): Promise<GrowDocument> => {
    if (!orgId) throw new Error("No active org");
    const { data, error } = await supabase.from("grow_documents").insert({
      org_id: orgId, name, is_folder: true, folder_id: parentId,
      uploaded_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    return data as GrowDocument;
  }, [orgId, user?.id]);
}

export function useDeleteDocument() {
  return useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from("grow_documents").delete().eq("id", id);
    if (error) throw error;
  }, []);
}
