import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export type Product = "crm" | "intel" | "grow";
export type SubscriptionTier = "starter" | "professional" | "enterprise";
export type SubscriptionStatus = "active" | "trial" | "past_due" | "cancelled" | "expired";

interface ProductAccessResult {
  hasAccess: boolean;
  tier: SubscriptionTier | null;
  status: SubscriptionStatus | null;
  orgId: string | null;
  loading: boolean;
}

const GRANTED_STATUSES: SubscriptionStatus[] = ["active", "trial"];

export function useProductAccess(product: Product): ProductAccessResult {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<ProductAccessResult>({
    hasAccess: false,
    tier: null,
    status: null,
    orgId: null,
    loading: true,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ hasAccess: false, tier: null, status: null, orgId: null, loading: false });
      return;
    }

    let cancelled = false;

    async function check() {
      // Step 1: get the user's org membership(s)
      const { data: members, error: memErr } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user!.id);

      if (cancelled) return;

      if (memErr || !members || members.length === 0) {
        setState({ hasAccess: false, tier: null, status: null, orgId: null, loading: false });
        return;
      }

      // Prefer the org stored in localStorage (same key as CRM), else first
      const savedOrgId = localStorage.getItem("cody-active-org");
      const active =
        members.find((m: any) => m.org_id === savedOrgId) ?? members[0];
      const orgId = active.org_id as string;

      // Step 2: check product_subscriptions for this org and product
      const { data: sub, error: subErr } = await supabase
        .from("product_subscriptions")
        .select("tier, status")
        .eq("org_id", orgId)
        .eq("product", product)
        .maybeSingle();

      if (cancelled) return;

      if (subErr || !sub) {
        setState({ hasAccess: false, tier: null, status: null, orgId, loading: false });
        return;
      }

      const hasAccess = GRANTED_STATUSES.includes(sub.status as SubscriptionStatus);
      setState({
        hasAccess,
        tier: sub.tier as SubscriptionTier,
        status: sub.status as SubscriptionStatus,
        orgId,
        loading: false,
      });
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, product]);

  return state;
}
