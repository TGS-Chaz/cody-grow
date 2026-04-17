import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Route, Loader2, MapPin, ArrowRight } from "lucide-react";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import { optimizeByZip, DeliveryStop } from "@/lib/routeOptimizer";

interface Stop {
  account_id: string;
  account_name: string;
  zip: string | null;
  city: string | null;
  pending_orders: number;
}

/**
 * Surfaces accounts on a route with pending orders, suggests a delivery
 * sequence sorted by ZIP proximity. Future: integrate with Maps for actual
 * drive-time optimization.
 */
export function RouteOptimizerModal({ open, onClose, routeId, routeName }: {
  open: boolean; onClose: () => void; routeId: string | null; routeName: string | null;
}) {
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !orgId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_accounts").select("id, company_name, zip, city").eq("org_id", orgId).eq("is_active", true);
      if (routeId) q = q.eq("route_id", routeId);
      const { data: accounts } = await q;
      const accountIds = ((accounts ?? []) as any[]).map((a) => a.id);
      const { data: orders } = accountIds.length > 0
        ? await supabase.from("grow_orders").select("account_id").in("account_id", accountIds)
            .in("status", ["submitted", "allocated", "packaged"])
        : { data: [] };
      const pendingByAccount = new Map<string, number>();
      ((orders ?? []) as any[]).forEach((o) => {
        pendingByAccount.set(o.account_id, (pendingByAccount.get(o.account_id) ?? 0) + 1);
      });

      const enriched = ((accounts ?? []) as any[])
        .map((a) => ({
          account_id: a.id,
          account_name: a.company_name,
          zip: a.zip,
          city: a.city,
          pending_orders: pendingByAccount.get(a.id) ?? 0,
        }))
        .filter((s) => s.pending_orders > 0);

      if (cancelled) return;
      setStops(enriched);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, orgId, routeId]);

  const optimized = useMemo(() => {
    const deliveryStops: DeliveryStop<Stop>[] = stops.map((s) => ({
      id: s.account_id, zip: s.zip, label: s.account_name, data: s,
    }));
    return optimizeByZip(deliveryStops);
  }, [stops]);

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md"
      header={<ModalHeader icon={<Route className="w-4 h-4 text-primary" />} title="Optimize route order" subtitle={routeName ?? "All accounts with pending orders"} />}
      footer={<Button type="button" onClick={onClose}>Close</Button>}
    >
      <div className="p-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : optimized.length === 0 ? (
          <p className="text-[12px] text-muted-foreground italic text-center py-8">No accounts with pending orders on this route.</p>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-[11px]">
              Suggested sequence by ZIP-code proximity. Applying this order to your manifest will reorder the delivery stops.
            </div>
            <ol className="space-y-2">
              {optimized.map((stop, idx) => (
                <li key={stop.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[13px] font-bold">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => navigate(`/sales/accounts/${stop.id}`)} className="text-[13px] font-semibold text-primary hover:underline">{stop.label}</button>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3 h-3" /> {stop.data?.city ?? "—"} · ZIP <span className="font-mono">{stop.zip ?? "—"}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">{stop.data?.pending_orders} order{stop.data?.pending_orders === 1 ? "" : "s"}</div>
                  {idx < optimized.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50" />}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </ScrollableModal>
  );
}
