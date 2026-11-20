/** Owner correction, 19 October 2026: Standard is Gemini; High is opt-in Workers AI.
 * Provider identities are selected only by the server, never accepted from a request.
 */
export const DEFAULT_ONLINE_MODEL = "gemini-3.5-flash-lite";
export const HIGH_ONLINE_MODEL = "@cf/google/gemma-4-26b-a4b-it";
export type OnlineModelId = string;

/**
 * THE PLANNER IS ANY COMPATIBLE MODEL THE SERVER NAMES (owner, 17 Nov 2026).
 *
 * One model per task, chosen only by the server's configuration (`OCADE_MODEL`, or the older
 * `GEMINI_MODEL`), never by a request: no route, no second-model repair, no failover between
 * models. Any model id the provider accepts is allowed; one id only, so no hybrid can be named.
 */
export function plannerModel(configured: string | undefined): OnlineModelId | undefined {
  const model = (configured ?? DEFAULT_ONLINE_MODEL).trim();
  return /^[A-Za-z0-9@][A-Za-z0-9._:/@+-]{0,199}$/.test(model) ? model : undefined;
}

/**
 * HOW THE PLANNER'S PROVIDER IS SPOKEN TO.
 *
 * `gemini`: Google's generateContent API (the default endpoint, or any compatible one).
 * `openai`: the OpenAI-compatible chat completions API that most providers and local servers
 * offer (OpenRouter, Groq, Together, Mistral, vLLM, Ollama behind HTTPS, Gemini's own
 * compatibility endpoint, Workers AI ...). The endpoint is the API's base URL, HTTPS only, with no
 * credentials or query in it; the keys are sent as headers.
 */
export type ProviderProtocol = "gemini" | "openai" | "anthropic" | "responses";
export interface PlannerProvider {
  protocol: ProviderProtocol;
  endpoint: string;
}
const DEFAULT_ENDPOINT: Partial<Record<ProviderProtocol, string>> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  anthropic: "https://api.anthropic.com/v1",
};

export function plannerProvider(
  read: (name: string) => string | undefined,
): PlannerProvider | undefined {
  const protocol = (read("OCADE_MODEL_PROTOCOL")?.trim() || "gemini") as ProviderProtocol;
  if (!["gemini", "openai", "anthropic", "responses"].includes(protocol)) return undefined;
  const endpoint = (
    read("OCADE_MODEL_ENDPOINT")?.trim() ||
    DEFAULT_ENDPOINT[protocol] ||
    ""
  ).replace(/\/+$/, "");
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
      return undefined;
  } catch {
    return undefined;
  }
  return { protocol, endpoint };
}

/**
 * THE KEY SLOTS, IN FAILOVER ORDER.
 *
 * As many keys as the deployment holds (at most eight), primary first, always. They are an
 * operational redundancy (a key that is revoked, misconfigured or serving errors) and NOT a way
 * around a quota that belongs to the project rather than to the key. `docs/ARCHITECTURE.md`
 * states both halves; `edge-handler.ts` enforces them. `OCADE_MODEL_API_KEYS` holds them as a
 * JSON array or separated by commas or new lines; without it the three older
 * `GEMINI_API_KEY_*` secrets are read. Server-side only.
 */
export type ProviderKeySlot = string;
export const PROVIDER_KEY_SLOTS: readonly ProviderKeySlot[] = ["primary", "secondary", "tertiary"];
export const PROVIDER_KEY_ENVIRONMENT: Record<string, string> = {
  primary: "GEMINI_API_KEY_PRIMARY",
  secondary: "GEMINI_API_KEY_SECONDARY",
  tertiary: "GEMINI_API_KEY_TERTIARY",
};
const MAX_KEYS = 8;

export function plannerKeys(read: (name: string) => string | undefined): string[] {
  const listed = read("OCADE_MODEL_API_KEYS")?.trim();
  let keys: unknown[];
  if (listed) {
    try {
      keys = listed.startsWith("[") ? (JSON.parse(listed) as unknown[]) : listed.split(/[\s,]+/);
    } catch {
      keys = [];
    }
  } else keys = PROVIDER_KEY_SLOTS.map((slot) => read(PROVIDER_KEY_ENVIRONMENT[slot]!));
  const usable = keys.filter((key): key is string => typeof key === "string" && key.length > 0);
  return [...new Set(usable)].slice(0, MAX_KEYS);
}

/** The slot names of `count` keys: primary, secondary, tertiary, then key4 to key8. */
export function keySlots(count: number): ProviderKeySlot[] {
  return Array.from({ length: count }, (_, i) => PROVIDER_KEY_SLOTS[i] ?? `key${i + 1}`);
}
