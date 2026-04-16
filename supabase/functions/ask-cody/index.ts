import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const PRODUCT_PROMPTS: Record<string, string> = {
  grow: `You are Cody, the AI assistant for Cody Grow — a seed-to-sale cannabis platform for Washington State licensees.

You help cultivators, processors, and producers manage their entire operation: planting, growing, harvesting, processing, packaging, lab testing, sales, fulfillment, and CCRS compliance reporting.

You can answer questions about plants, grow cycles, harvests, batches, products, lab results, orders, manifests, and CCRS upload status. You also surface proactive insights — environmental anomalies, harvest timing, yield comparisons, compliance gaps.

Be concise, factual, and grounded in the actual data the user provides. If you don't have enough context to answer, say so honestly and suggest what data would help. Reference specific strain names, batch barcodes, and dates when applicable. Use grams for weight, °F for temperature, and percentages for cannabinoid potency unless the user specifies otherwise.

When the user asks for an action (create a grow cycle, mark a plant destroyed, etc.), confirm what you'd do but don't execute it yet — action execution will be added in a future update.`,
  crm: `You are Cody, the AI assistant for Cody CRM — a sales and account management platform for cannabis wholesale teams.`,
  intel: `You are Cody, the AI assistant for Cody Intel — a market intelligence platform for the cannabis industry.`,
};

interface AskCodyRequest {
  product: "crm" | "intel" | "grow";
  context_type?: string;
  context_id?: string;
  page_data?: unknown;
  user_message: string;
  conversation_id?: string;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

async function callAnthropic(
  system: string,
  messages: AnthropicMessage[],
): Promise<{ content: string; tokens: number; model: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system,
        messages,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const content =
      data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
    const tokens =
      (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    return { content, tokens, model: data.model ?? "claude-sonnet-4-6" };
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // req.json() can only be called once per request
    const body: AskCodyRequest = await req.json();
    const { product, context_type, context_id, page_data, user_message } = body;
    let conversation_id = body.conversation_id;

    if (!product || !user_message) {
      return new Response(
        JSON.stringify({ error: "product and user_message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client for trusted writes (we'll use auth.getUser for identity)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user from JWT
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Resolve org_id (first membership; matches client's localStorage default)
    const { data: members } = await supabaseAdmin
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1);
    const orgId = members?.[0]?.org_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "User has no org membership" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or load conversation
    let messages: AnthropicMessage[] = [];
    if (conversation_id) {
      const { data: existing } = await supabaseAdmin
        .from("cody_messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: true });
      messages = (existing ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    } else {
      const { data: newConvo, error: convoError } = await supabaseAdmin
        .from("cody_conversations")
        .insert({
          org_id: orgId, // explicit org_id per ops rules
          user_id: userId,
          product,
          context_type: context_type ?? null,
          context_id: context_id ?? null,
          title: user_message.slice(0, 80),
        })
        .select("id")
        .single();
      if (convoError || !newConvo) {
        throw new Error(`Failed to create conversation: ${convoError?.message}`);
      }
      conversation_id = newConvo.id;
    }

    // Persist user message
    await supabaseAdmin.from("cody_messages").insert({
      conversation_id,
      role: "user",
      content: user_message,
    });

    // Build system prompt with page context
    const basePrompt = PRODUCT_PROMPTS[product] ?? PRODUCT_PROMPTS.grow;
    let contextBlock = "";
    if (context_type) {
      contextBlock += `\n\nCURRENT PAGE: ${context_type}`;
      if (context_id) contextBlock += ` (id: ${context_id})`;
    }
    if (page_data) {
      contextBlock += `\n\nPAGE DATA:\n${JSON.stringify(page_data).slice(0, 6000)}`;
    }
    const systemPrompt = basePrompt + contextBlock;

    // Append the new user message to the history
    messages.push({ role: "user", content: user_message });

    // Call Claude
    const { content: reply, tokens, model } = await callAnthropic(systemPrompt, messages);

    // Persist assistant message
    await supabaseAdmin.from("cody_messages").insert({
      conversation_id,
      role: "assistant",
      content: reply,
      tokens_used: tokens,
      model,
    });

    // Bump conversation updated_at (handled by trigger but explicit insert refreshes it)
    await supabaseAdmin
      .from("cody_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation_id);

    return new Response(
      JSON.stringify({ reply, conversation_id, tokens_used: tokens, model }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("ask-cody error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
