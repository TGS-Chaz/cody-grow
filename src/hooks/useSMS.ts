import { useCallback } from "react";
import { useOrg } from "@/lib/org";
import { useOrgSettings } from "@/hooks/useOrgSettings";
import { callEdgeFunction } from "@/lib/edge-function";

export interface SendSMSInput {
  to: string;
  message: string;
}

export function useSMSEnabled(): boolean {
  const { data: settings } = useOrgSettings();
  const twilio = (settings?.integrations as any)?.twilio;
  const cfg = twilio?.config ?? {};
  return !!(twilio?.connected && cfg.account_sid && cfg.auth_token && cfg.from_number);
}

export function useSendSMS() {
  const { orgId } = useOrg();
  return useCallback(async (input: SendSMSInput): Promise<{ ok: boolean; sid?: string }> => {
    if (!orgId) throw new Error("No active org");
    return callEdgeFunction<{ ok: boolean; sid?: string }>("send-sms", {
      org_id: orgId,
      to: input.to,
      message: input.message,
    });
  }, [orgId]);
}
