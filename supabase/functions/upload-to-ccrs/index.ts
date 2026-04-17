/**
 * upload-to-ccrs — prepare a CCRS submission for upload.
 *
 * Current state: Cody Grow is not yet an approved CCRS integrator, so direct
 * SAW-authenticated upload to cannabisreporting.lcb.wa.gov is not automated.
 * This function stubs the eventual direct-upload flow and provides manual
 * upload guidance for operators.
 *
 * When integrator approval lands, swap out the "manual" branch for the real
 * SAW auth + upload sequence inside the commented block below.
 *
 * Invocation:
 *   POST { submission_file_id, org_id, confirm_manual_upload?: boolean }
 *     - Without confirm_manual_upload: marks as 'queued_manual' and returns
 *       upload instructions + CCRS portal URL
 *     - With confirm_manual_upload: marks as 'uploaded' + 'accepted' (operator
 *       performed the manual upload themselves)
 *
 * Deploy: `npx supabase functions deploy upload-to-ccrs --no-verify-jwt`
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CCRS_PORTAL_URL = "https://cannabisreporting.lcb.wa.gov";
const SAW_LOGIN_URL = "https://secureaccess.wa.gov";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const submissionFileId: string | undefined = body.submission_file_id;
    const orgId: string | undefined = body.org_id;
    const confirmManual: boolean = !!body.confirm_manual_upload;
    if (!submissionFileId || !orgId) {
      return new Response(JSON.stringify({ ok: false, error: "submission_file_id + org_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: submission, error } = await sb
      .from("grow_ccrs_submission_files")
      .select("*").eq("id", submissionFileId).eq("org_id", orgId).maybeSingle();
    if (error) throw error;
    if (!submission) {
      return new Response(JSON.stringify({ ok: false, error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check integrator status on org settings
    const { data: settings } = await sb.from("grow_org_settings").select("integrator_status, integrator_id").eq("org_id", orgId).maybeSingle();
    const integratorApproved = (settings as any)?.integrator_status === "approved";

    // ─── BRANCH 1: direct upload (requires integrator approval) ──────────
    if (integratorApproved) {
      // TODO(future): when LCB approves us as an integrator:
      //
      // 1. Authenticate to SAW using stored ccrs_saw_username + decrypted
      //    ccrs_saw_password_encrypted. SAW uses OAuth/SAML — the real flow
      //    will need a scraper or an LCB-provided API key.
      // 2. POST the CSV file to cannabisreporting.lcb.wa.gov's upload endpoint.
      // 3. Poll for confirmation (usually 2-15 minutes).
      // 4. Mark submission 'accepted' or 'rejected' based on response.
      //
      // For now this branch falls through to manual since we don't have
      // integrator credentials yet.
      return new Response(JSON.stringify({
        ok: true, mode: "direct-upload-placeholder",
        message: "Integrator approved — direct upload wiring pending (awaiting SAW API access from LCB).",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── BRANCH 2: manual upload (current default) ───────────────────────
    if (confirmManual) {
      // Operator confirms they completed the manual upload through the CCRS portal
      await sb.from("grow_ccrs_submission_files").update({
        status: "accepted",
        uploaded_at: submission.uploaded_at ?? new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      }).eq("id", submissionFileId);

      return new Response(JSON.stringify({
        ok: true, mode: "manual-confirmed", status: "accepted",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Queue for manual: mark as ready, return instructions
    await sb.from("grow_ccrs_submission_files").update({
      status: "queued_manual",
      uploaded_at: new Date().toISOString(),
    }).eq("id", submissionFileId);

    return new Response(JSON.stringify({
      ok: true, mode: "manual",
      message: "Cody Grow is not yet an approved CCRS integrator. Download the CSV and upload it manually at cannabisreporting.lcb.wa.gov, then click 'Confirm Upload Success' to mark as accepted.",
      portal_url: CCRS_PORTAL_URL,
      saw_login_url: SAW_LOGIN_URL,
      submission: {
        id: submission.id,
        file_category: submission.file_category,
        file_name: submission.file_name,
        number_records: submission.number_records,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
