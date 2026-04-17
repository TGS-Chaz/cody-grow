import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export interface PaginationState {
  page: number;
  pageSize: number;
  sortField?: string | null;
  sortAsc?: boolean;
}

export interface PaginatedQueryOptions {
  table: string;
  select?: string;
  orgId: string | null | undefined;
  /**
   * Build the .filter()/.eq()/etc. chain. Must NOT call .order, .range,
   * or .select("*", { count }). Those are added by this hook.
   */
  applyFilters?: (q: any) => any;
  defaultSortField?: string;
  defaultSortAsc?: boolean;
  defaultPageSize?: number;
  /** When any of these values change, page resets to 1 */
  filterSig?: string;
  /** If true, syncs page # to ?page= in the URL */
  urlSync?: boolean;
  /** URL param name (default 'page') */
  urlParam?: string;
  enabled?: boolean;
}

export interface PaginatedQueryResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  sortField: string | null;
  sortAsc: boolean;
  setSort: (field: string, asc?: boolean) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePaginatedQuery<T = any>(opts: PaginatedQueryOptions): PaginatedQueryResult<T> {
  const {
    table, select = "*", orgId, applyFilters,
    defaultSortField, defaultSortAsc = false, defaultPageSize = 50,
    filterSig = "", urlSync = false, urlParam = "page", enabled = true,
  } = opts;

  const [searchParams, setSearchParams] = useSearchParams();
  const urlPage = urlSync ? parseInt(searchParams.get(urlParam) ?? "1", 10) : 1;
  const [page, setPageState] = useState<number>(Number.isFinite(urlPage) && urlPage > 0 ? urlPage : 1);
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [sortField, setSortField] = useState<string | null>(defaultSortField ?? null);
  const [sortAsc, setSortAsc] = useState<boolean>(defaultSortAsc);

  const [data, setData] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Reset to page 1 when filters change
  useEffect(() => { setPageState(1); }, [filterSig]);

  // URL-sync: reading
  useEffect(() => {
    if (!urlSync) return;
    const p = parseInt(searchParams.get(urlParam) ?? "1", 10);
    if (Number.isFinite(p) && p > 0 && p !== page) setPageState(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSync ? searchParams.get(urlParam) : null]);

  // URL-sync: writing
  const setPage = useCallback((p: number) => {
    setPageState(p);
    if (urlSync) {
      const next = new URLSearchParams(searchParams);
      if (p === 1) next.delete(urlParam);
      else next.set(urlParam, String(p));
      setSearchParams(next, { replace: true });
    }
  }, [urlSync, searchParams, setSearchParams, urlParam]);

  const setSort = useCallback((field: string, asc?: boolean) => {
    setSortField(field);
    setSortAsc(asc ?? false);
    setPageState(1);
  }, []);

  useEffect(() => {
    if (!enabled || !orgId) { setData([]); setTotalCount(0); setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        let q: any = supabase.from(table).select(select, { count: "exact" }).eq("org_id", orgId);
        if (applyFilters) q = applyFilters(q);
        if (sortField) q = q.order(sortField, { ascending: sortAsc, nullsFirst: false });
        q = q.range(from, to);
        const { data: rows, error: err, count } = await q;
        if (cancelled) return;
        if (err) { setError(err.message); setData([]); setTotalCount(0); }
        else { setData((rows ?? []) as T[]); setTotalCount(count ?? 0); }
        setIsLoading(false);
      } catch (err: any) {
        if (!cancelled) { setError(err?.message ?? "Query failed"); setIsLoading(false); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, table, select, filterSig, page, pageSize, sortField, sortAsc, tick, enabled]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return {
    data, totalCount, page, pageSize, totalPages,
    setPage, setPageSize,
    sortField, sortAsc, setSort,
    isLoading, error, refresh,
  };
}
