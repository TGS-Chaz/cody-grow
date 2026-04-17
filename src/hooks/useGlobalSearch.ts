import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export type SearchEntity = "plant" | "batch" | "strain" | "account" | "order" | "product" | "cycle" | "harvest" | "employee" | "manifest";

export interface SearchResult {
  id: string;
  entity: SearchEntity;
  label: string;
  sublabel?: string;
  href: string;
}

export interface GlobalSearchState {
  results: SearchResult[];
  byEntity: Record<SearchEntity, SearchResult[]>;
  counts: Record<SearchEntity, number>;
  isSearching: boolean;
}

const EMPTY_STATE: GlobalSearchState = {
  results: [],
  byEntity: { plant: [], batch: [], strain: [], account: [], order: [], product: [], cycle: [], harvest: [], employee: [], manifest: [] },
  counts: { plant: 0, batch: 0, strain: 0, account: 0, order: 0, product: 0, cycle: 0, harvest: 0, employee: 0, manifest: 0 },
  isSearching: false,
};

const DEBOUNCE_MS = 250;
const PER_ENTITY_LIMIT = 5;

export function useGlobalSearch(query: string): GlobalSearchState {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [state, setState] = useState<GlobalSearchState>(EMPTY_STATE);
  const aborter = useRef<AbortController | null>(null);
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !orgId || !query.trim() || query.trim().length < 2) {
      setState(EMPTY_STATE);
      return;
    }

    const q = query.trim();
    setState((s) => ({ ...s, isSearching: true }));

    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      // Abort previous in-flight
      aborter.current?.abort();
      const ctrl = new AbortController();
      aborter.current = ctrl;

      const like = `%${q}%`;

      try {
        const [plantsRes, batchesRes, strainsRes, accountsRes, ordersRes, productsRes, cyclesRes, harvestsRes, employeesRes, manifestsRes] = await Promise.all([
          supabase.from("grow_plants").select("id, plant_identifier").eq("org_id", orgId).ilike("plant_identifier", like).limit(PER_ENTITY_LIMIT).abortSignal(ctrl.signal),
          supabase.from("grow_batches").select("id, barcode, external_id, area_id, current_quantity, qa_status").eq("org_id", orgId).or(`barcode.ilike.${like},external_id.ilike.${like}`).limit(PER_ENTITY_LIMIT).abortSignal(ctrl.signal),
          supabase.from("grow_strains").select("id, name, type").eq("org_id", orgId).ilike("name", like).limit(PER_ENTITY_LIMIT).abortSignal(ctrl.signal),
          supabase.from("grow_accounts").select("id, company_name, license_number").eq("org_id", orgId).or(`company_name.ilike.${like},license_number.ilike.${like}`).limit(PER_ENTITY_LIMIT).abortSignal(ctrl.signal),
          supabase.from("grow_orders").select("id, order_number, total, status").eq("org_id", orgId).ilike("order_number", like).limit(PER_ENTITY_LIMIT).abortSignal(ctrl.signal),
          supabase.from("grow_products").select("id, name, category").eq("org_id", orgId).ilike("name", like).limit(PER_ENTITY_LIMIT).abortSignal(ctrl.signal),
          supabase.from("grow_cycles").select("id, name, phase").eq("org_id", orgId).ilike("name", like).limit(PER_ENTITY_LIMIT).abortSignal(ctrl.signal),
          supabase.from("grow_harvests").select("id, name, status").eq("org_id", orgId).ilike("name", like).limit(PER_ENTITY_LIMIT).abortSignal(ctrl.signal),
          supabase.from("grow_employees").select("id, first_name, last_name, title").eq("org_id", orgId).or(`first_name.ilike.${like},last_name.ilike.${like}`).limit(PER_ENTITY_LIMIT).abortSignal(ctrl.signal),
          supabase.from("grow_manifests").select("id, external_id, manifest_type, status").eq("org_id", orgId).ilike("external_id", like).limit(PER_ENTITY_LIMIT).abortSignal(ctrl.signal),
        ]);

        if (ctrl.signal.aborted) return;

        // Enrich batch results with area name (location) so the ⌘K result
        // doubles as an inventory locator: "BDR-... · Flower Room 1 · 320g · passed"
        const batchRows = ((batchesRes.data ?? []) as any[]);
        const areaIds = Array.from(new Set(batchRows.map((b) => b.area_id).filter(Boolean)));
        const { data: areas } = areaIds.length > 0
          ? await supabase.from("grow_areas").select("id, name").in("id", areaIds)
          : { data: [] };
        const areaById = new Map<string, any>(((areas ?? []) as any[]).map((a) => [a.id, a]));

        const results: SearchResult[] = [];
        const byEntity: GlobalSearchState["byEntity"] = {
          plant: ((plantsRes.data ?? []) as any[]).map((r) => ({ id: r.id, entity: "plant", label: r.plant_identifier ?? r.id.slice(0, 8), href: `/cultivation/plants/${r.id}` })),
          batch: batchRows.map((r) => {
            const areaName = r.area_id ? areaById.get(r.area_id)?.name : null;
            const qty = Number(r.current_quantity ?? 0);
            const subs = [areaName, `${qty.toFixed(0)} on hand`, r.qa_status].filter(Boolean).join(" · ");
            return { id: r.id, entity: "batch" as const, label: r.barcode, sublabel: subs || r.external_id, href: `/inventory/batches/${r.id}` };
          }),
          strain: ((strainsRes.data ?? []) as any[]).map((r) => ({ id: r.id, entity: "strain", label: r.name, sublabel: r.type, href: `/cultivation/strains/${r.id}` })),
          account: ((accountsRes.data ?? []) as any[]).map((r) => ({ id: r.id, entity: "account", label: r.company_name, sublabel: r.license_number, href: `/sales/accounts/${r.id}` })),
          order: ((ordersRes.data ?? []) as any[]).map((r) => ({ id: r.id, entity: "order", label: r.order_number, sublabel: r.status, href: `/sales/orders/${r.id}` })),
          product: ((productsRes.data ?? []) as any[]).map((r) => ({ id: r.id, entity: "product", label: r.name, sublabel: r.category, href: `/cultivation/products/${r.id}` })),
          cycle: ((cyclesRes.data ?? []) as any[]).map((r) => ({ id: r.id, entity: "cycle", label: r.name, sublabel: r.phase, href: `/cultivation/cycles/${r.id}` })),
          harvest: ((harvestsRes.data ?? []) as any[]).map((r) => ({ id: r.id, entity: "harvest", label: r.name, sublabel: r.status, href: `/cultivation/harvests/${r.id}` })),
          employee: ((employeesRes.data ?? []) as any[]).map((r) => ({ id: r.id, entity: "employee", label: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.id.slice(0, 8), sublabel: r.title, href: `/settings/employees/${r.id}` })),
          manifest: ((manifestsRes.data ?? []) as any[]).map((r) => ({ id: r.id, entity: "manifest", label: r.external_id?.slice(-8) ?? r.id.slice(0, 8), sublabel: `${r.manifest_type} · ${r.status ?? "draft"}`, href: `/sales/manifests/${r.id}` })),
        };

        const counts = {} as GlobalSearchState["counts"];
        (Object.keys(byEntity) as SearchEntity[]).forEach((k) => {
          counts[k] = byEntity[k].length;
          results.push(...byEntity[k]);
        });

        setState({ results, byEntity, counts, isSearching: false });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setState((s) => ({ ...s, isSearching: false }));
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    };
  }, [user?.id, orgId, query]);

  return state;
}

export const ENTITY_LABELS: Record<SearchEntity, string> = {
  plant: "Plants",
  batch: "Batches",
  strain: "Strains",
  account: "Accounts",
  order: "Orders",
  product: "Products",
  cycle: "Grow Cycles",
  harvest: "Harvests",
  employee: "Employees",
  manifest: "Manifests",
};

export const ENTITY_LIST_PATH: Record<SearchEntity, string> = {
  plant: "/cultivation/plants",
  batch: "/inventory/batches",
  strain: "/cultivation/strains",
  account: "/sales/accounts",
  order: "/sales/orders",
  product: "/cultivation/products",
  cycle: "/cultivation/cycles",
  harvest: "/cultivation/harvests",
  employee: "/settings/employees",
  manifest: "/sales/manifests",
};
