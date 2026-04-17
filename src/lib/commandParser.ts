/**
 * Lightweight natural-language parser for the ⌘K command bar. Fires when the
 * user input starts with ">". Classifies the query into one of three intents:
 *
 *   1. action    — create/destroy/allocate (rewrites the URL with ?new=1 or
 *                  similar so the destination page's existing create flow handles it)
 *   2. navigate  — show/view/go (opens a filtered list page)
 *   3. ai        — how/what/why/explain (hands off to Ask Cody with the raw text)
 *
 * Keyword classification is intentionally permissive — we don't try to extract
 * entity ids. We just build the right URL and let the target page validate.
 */

export type CommandIntent = "action" | "navigate" | "ai";

export interface ParsedCommand {
  intent: CommandIntent;
  /** Short description to render below the input for confirmation */
  description: string;
  /** URL to navigate to (for action + navigate intents) */
  to?: string;
  /** Raw query to forward (for ai intent) */
  aiQuery?: string;
}

const ACTION_VERBS = ["create", "new", "add", "make", "start", "destroy", "harvest", "archive", "cancel", "allocate", "release", "complete", "phase", "move"];
const NAV_VERBS = ["show", "view", "open", "go", "list", "find", "locate"];
const AI_VERBS = ["how", "what", "why", "when", "explain", "suggest", "should", "analyze", "tell", "help"];

// Destination map: keyword → route + ?query hint
interface DestMatch { url: string; label: string }

const NOUN_DESTS: Array<{ match: RegExp; dest: DestMatch }> = [
  { match: /\border(s)?\b/i,     dest: { url: "/sales/orders",          label: "Orders" } },
  { match: /\baccount(s)?\b/i,   dest: { url: "/sales/accounts",        label: "Accounts" } },
  { match: /\bmanifest(s)?\b/i,  dest: { url: "/sales/manifests",       label: "Manifests" } },
  { match: /\bbatch(es)?\b/i,    dest: { url: "/inventory/batches",     label: "Batches" } },
  { match: /\bqa\b|\blab\b/i,    dest: { url: "/inventory/qa",          label: "QA & Lab" } },
  { match: /\bplant(s)?\b/i,     dest: { url: "/cultivation/plants",    label: "Plants" } },
  { match: /\bstrain(s)?\b/i,    dest: { url: "/cultivation/strains",   label: "Strains" } },
  { match: /\barea(s)?\b|\broom(s)?\b/i, dest: { url: "/cultivation/areas", label: "Areas" } },
  { match: /\bcycle(s)?\b/i,     dest: { url: "/cultivation/grow-cycles", label: "Cycles" } },
  { match: /\bharvest(s)?\b/i,   dest: { url: "/cultivation/harvests",  label: "Harvests" } },
  { match: /\bproduct(s)?\b/i,   dest: { url: "/cultivation/products",  label: "Products" } },
  { match: /\btask(s)?\b/i,      dest: { url: "/operations/tasks",      label: "Tasks" } },
  { match: /\breport(s)?\b/i,    dest: { url: "/reports",               label: "Reports" } },
  { match: /\brecall(s)?\b/i,    dest: { url: "/compliance/recalls",    label: "Recalls" } },
  { match: /\bccrs\b/i,          dest: { url: "/compliance/ccrs",       label: "CCRS Dashboard" } },
  { match: /\bdisposal(s)?\b/i,  dest: { url: "/compliance/disposals",  label: "Disposals" } },
  { match: /\blabel(s)?\b/i,     dest: { url: "/compliance/labels",     label: "Labels" } },
  { match: /\benvironment(al)?\b|\btemp(erature)?\b|\bhumidity\b/i, dest: { url: "/operations/environment", label: "Environment" } },
];

function findDestination(text: string): DestMatch | null {
  for (const { match, dest } of NOUN_DESTS) {
    if (match.test(text)) return dest;
  }
  return null;
}

function firstMatch(verbs: string[], words: string[]): string | null {
  for (const w of words) if (verbs.includes(w)) return w;
  return null;
}

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.replace(/^>\s*/, "").trim();
  if (!trimmed) return { intent: "ai", description: "Ask Cody anything", aiQuery: "" };

  const lower = trimmed.toLowerCase();
  const words = lower.split(/\s+/);

  const actionVerb = firstMatch(ACTION_VERBS, words);
  const navVerb = firstMatch(NAV_VERBS, words);
  const aiVerb = firstMatch(AI_VERBS, words);
  const dest = findDestination(lower);

  // AI intent — question words always win
  if (aiVerb) {
    return {
      intent: "ai",
      description: `Ask Cody: "${trimmed}"`,
      aiQuery: trimmed,
    };
  }

  // Navigation intent — verb + destination
  if (navVerb && dest) {
    // Try to extract a filter after "in" / "for" — e.g. "show plants in flower room"
    const inMatch = lower.match(/\b(in|for)\s+(.+)$/);
    const q = inMatch ? inMatch[2].trim() : "";
    const url = q ? `${dest.url}?q=${encodeURIComponent(q)}` : dest.url;
    return {
      intent: "navigate",
      description: `Open ${dest.label}${q ? ` · filter: "${q}"` : ""}`,
      to: url,
    };
  }

  // Action intent
  if (actionVerb && dest) {
    // Heuristic: "create order for acme" → /sales/orders?create=1
    const url = `${dest.url}?new=1`;
    const forMatch = lower.match(/\bfor\s+(.+)$/);
    const ctx = forMatch ? ` for "${forMatch[1].trim()}"` : "";
    return {
      intent: "action",
      description: `Start creating a new ${singular(dest.label)}${ctx}`,
      to: url,
    };
  }

  // Destination only
  if (dest) {
    return {
      intent: "navigate",
      description: `Open ${dest.label}`,
      to: dest.url,
    };
  }

  // Nothing matched — fall through to AI
  return {
    intent: "ai",
    description: `Ask Cody: "${trimmed}"`,
    aiQuery: trimmed,
  };
}

function singular(label: string): string {
  // strip trailing "s" for human-friendly description
  return label.replace(/s$/i, "").toLowerCase();
}
