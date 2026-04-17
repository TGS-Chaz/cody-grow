import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface CreditAccount {
  id: string;
  account_id: string;
  credit_limit: number | null;
  current_balance: number | null;
  past_due_balance: number | null;
  credit_hold: boolean | null;
  credit_hold_reason: string | null;
  payment_terms: string | null;
  payment_terms_custom: string | null;
  last_payment_at: string | null;
  last_payment_amount: number | null;
}

export function useCreditAccount(accountId: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<CreditAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !accountId) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row } = await supabase.from("grow_credit_accounts")
        .select("*").eq("account_id", accountId).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      // Compute current balance from unpaid invoices as the authoritative source
      const { data: invoices } = await supabase.from("grow_invoices")
        .select("balance, due_date").eq("account_id", accountId).gt("balance", 0);
      const balance = ((invoices ?? []) as any[]).reduce((s, i) => s + Number(i.balance ?? 0), 0);
      const now = Date.now();
      const pastDue = ((invoices ?? []) as any[])
        .filter((i) => i.due_date && new Date(i.due_date).getTime() < now)
        .reduce((s, i) => s + Number(i.balance ?? 0), 0);
      setData({
        ...(row as any ?? { account_id: accountId, credit_limit: null }),
        current_balance: balance,
        past_due_balance: pastDue,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, accountId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useUpsertCreditAccount() {
  const { orgId } = useOrg();
  return useCallback(async (input: {
    account_id: string;
    credit_limit?: number | null;
    payment_terms?: string | null;
    credit_hold?: boolean;
    credit_hold_reason?: string | null;
  }) => {
    if (!orgId) throw new Error("No active org");
    const { data: existing } = await supabase.from("grow_credit_accounts")
      .select("id").eq("account_id", input.account_id).eq("org_id", orgId).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("grow_credit_accounts")
        .update(input as any).eq("id", (existing as any).id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("grow_credit_accounts")
        .insert({ org_id: orgId, ...input });
      if (error) throw error;
    }
  }, [orgId]);
}
