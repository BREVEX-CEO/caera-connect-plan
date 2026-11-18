/**
 * The browser's side of Settings > BYOK (plan 14B.1A). It reads the person's own connections and
 * choices (nonsecret columns only, under row-level security) and asks OCADE's server to change
 * them. A key typed here goes once to the server in a request body and is not kept anywhere in
 * the browser: not in state after the form is sent, not in storage, not in a URL.
 */
import { getSupabaseBrowserConfiguration } from "@/integrations/supabase/configuration";

export type ByokProtocol = "gemini" | "openai";

export interface ByokConnection {
  id: string;
  alias: string;
  protocol: ByokProtocol;
  endpoint: string;
  model: string;
  fingerprint: string;
  enabled: boolean;
  status: string;
  sees_images: boolean | null;
  calls_tools: boolean | null;
  checked_at: string | null;
}

export interface ByokState {
  connections: ByokConnection[];
  /** The connection chosen per surface; absent: OCADE's own models. Null: chosen, then deleted. */
  choices: Partial<Record<"chat" | "jarvis", string | null>>;
  /** Turns answered with the person's own keys this month, as OCADE observed them. */
  observed: { turns: number; inputTokens: number; outputTokens: number };
}

/** Known providers first (UX: a preset, then advanced only when needed). */
export const PRESETS: { id: string; label: string; protocol: ByokProtocol; endpoint: string }[] = [
  {
    id: "google",
    label: "Google Gemini API",
    protocol: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
  },
  { id: "openai", label: "OpenAI", protocol: "openai", endpoint: "https://api.openai.com/v1" },
  {
    id: "openrouter",
    label: "OpenRouter",
    protocol: "openai",
    endpoint: "https://openrouter.ai/api/v1",
  },
  { id: "groq", label: "Groq", protocol: "openai", endpoint: "https://api.groq.com/openai/v1" },
  { id: "mistral", label: "Mistral", protocol: "openai", endpoint: "https://api.mistral.ai/v1" },
  {
    id: "together",
    label: "Together AI",
    protocol: "openai",
    endpoint: "https://api.together.xyz/v1",
  },
];

/** What each status means to a person, and what to do about it. */
export const STATUS_TEXT: Record<string, { label: string; fix?: string }> = {
  untested: { label: "Not tested yet", fix: "Test it before choosing it." },
  connected: { label: "Connected" },
  invalid: {
    label: "Key refused",
    fix: "The provider refused this key. Replace it, then test again.",
  },
  rate_limited: {
    label: "Temporarily rate-limited",
    fix: "Your provider asked to slow down. Try again shortly.",
  },
  quota_exhausted: {
    label: "Quota used up",
    fix: "Your provider's quota for this key is spent until it resets.",
  },
  credits_unavailable: {
    label: "Credits unavailable",
    fix: "Add credits or billing with your provider, then test again.",
  },
  incompatible: {
    label: "Model or address not compatible",
    fix: "Check the model ID and the API address for this provider.",
  },
  unreachable: {
    label: "Provider unreachable",
    fix: "The provider did not answer. Test again later.",
  },
  blocked: {
    label: "Address blocked",
    fix: "OCADE only calls public HTTPS addresses. Use your provider's public API address.",
  },
};

/** The server's refusals, as a person reads them beside the field or button. */
export const ERROR_TEXT: Record<string, string> = {
  alias_invalid: "Give the connection a name of up to 60 characters.",
  protocol_invalid: "Choose a provider.",
  endpoint_refused:
    "Use your provider's public HTTPS API address, without a port, query or password in it.",
  model_invalid: "Enter one model ID, exactly as your provider names it.",
  key_required: "Paste your API key.",
  key_invalid: "That does not look like an API key (no spaces, 8 to 4096 characters).",
  too_many_tests: "Too many tests in a minute. Wait a moment, then test again.",
  not_allowed:
    "Only a connection that passed its test can be chosen (JARVIS also needs tool calls), and you can keep up to 20.",
  connection_not_found: "That connection no longer exists.",
  authentication_required: "Sign in again, then retry.",
  byok_unavailable: "OCADE could not reach its key store. Nothing was changed. Try again.",
};

async function token(): Promise<string | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function readByok(): Promise<ByokState> {
  const { supabase } = await import("@/integrations/supabase/client");
  const [connections, choices, calls] = await Promise.all([
    supabase
      .from("byok_connections")
      .select(
        "id, alias, protocol, endpoint, model, fingerprint, enabled, status, sees_images, calls_tools, checked_at",
      )
      .order("created_at"),
    supabase.from("byok_choices").select("surface, connection_id"),
    supabase
      .from("model_calls")
      .select("input_tokens, output_tokens")
      .eq("source", "customer")
      .gte(
        "created_at",
        new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString(),
      )
      .limit(10_000),
  ]);
  if (connections.error || choices.error || calls.error) throw new Error("byok_unavailable");
  return {
    connections: connections.data as ByokConnection[],
    choices: Object.fromEntries(
      choices.data.map((row) => [row.surface, row.connection_id]),
    ) as ByokState["choices"],
    observed: {
      turns: calls.data.length,
      inputTokens: calls.data.reduce((sum, call) => sum + (call.input_tokens ?? 0), 0),
      outputTokens: calls.data.reduce((sum, call) => sum + (call.output_tokens ?? 0), 0),
    },
  };
}

/** One change through OCADE's server; resolves with its answer or throws with a readable reason. */
export async function changeByok(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const config = getSupabaseBrowserConfiguration();
  const access = await token();
  if (!config.configured || !config.url || !config.publishableKey || !access)
    throw new Error(ERROR_TEXT.authentication_required);
  const response = await fetch(`${config.url.replace(/\/$/, "")}/functions/v1/ocade-byok`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: config.publishableKey,
      authorization: `Bearer ${access}`,
    },
    body: JSON.stringify(body),
  }).catch(() => null);
  const answer = ((await response?.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (!response?.ok) {
    const code = typeof answer.error === "string" ? answer.error : "byok_unavailable";
    throw new Error(ERROR_TEXT[code] ?? ERROR_TEXT.byok_unavailable);
  }
  return answer;
}

/** The words shown at a composer for the source a surface uses (plan 14B.1B.4). */
export function sourceLabel(state: ByokState | undefined, surface: "chat" | "jarvis"): string {
  if (!state || !(surface in state.choices)) return "OCADE-managed";
  const chosen = state.connections.find((connection) => connection.id === state.choices[surface]);
  return chosen ? `Your key: ${chosen.alias}` : "Your key: deleted — choose again in Settings";
}
