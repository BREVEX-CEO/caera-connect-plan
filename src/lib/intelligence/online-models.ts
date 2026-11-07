/** Owner correction, 19 October 2026: Standard is Gemini; High is opt-in Workers AI.
 * Provider identities are selected only by the server, never accepted from a request.
 */
export const DEFAULT_ONLINE_MODEL = "gemini-3.5-flash-lite";
export const HIGH_ONLINE_MODEL = "@cf/google/gemma-4-26b-a4b-it";
/**
 * Models the owner may name for a comparison (O14, 7 Nov 2026: configurations A, B and C in
 * plan.md §19.4). Server configuration only (`GEMINI_MODEL`); the default stays the model above.
 * The list is an allowlist, so a mistyped or paid model can never be selected by configuration.
 * How each one is called (streamed request or a live session) is read from the provider's own
 * model metadata, never assumed from its name.
 */
export const EVALUATION_ONLINE_MODELS = [
  "gemma-4-31b-it",
  "gemini-3.8-live-extended-thinking",
] as const;
export const ONLINE_MODEL_CATALOG = [
  DEFAULT_ONLINE_MODEL,
  HIGH_ONLINE_MODEL,
  ...EVALUATION_ONLINE_MODELS,
] as const;
export type OnlineModelId = (typeof ONLINE_MODEL_CATALOG)[number];
/** A standard-quality model the server may route to: the default or an evaluation model. */
export type StandardModelId = Exclude<OnlineModelId, typeof HIGH_ONLINE_MODEL>;

/**
 * The ordered model route from server configuration: "a" or "a,b". The first model serves;
 * the next is asked only when the one before cannot answer this turn (its quota is spent,
 * it is unavailable, or it refused the request's shape). Undefined when any entry is unknown:
 * a misconfigured route serves nothing rather than something nobody chose.
 */
export function modelRoute(configured: string | undefined): StandardModelId[] | undefined {
  const entries = (configured ?? DEFAULT_ONLINE_MODEL)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const allowed: readonly string[] = [DEFAULT_ONLINE_MODEL, ...EVALUATION_ONLINE_MODELS];
  if (!entries.length || entries.some((entry) => !allowed.includes(entry))) return undefined;
  if (new Set(entries).size !== entries.length) return undefined;
  return entries as StandardModelId[];
}

/**
 * THE THREE KEY SLOTS, IN FAILOVER ORDER.
 *
 * Exactly three, and the order is the policy: primary first, always. They are
 * an operational redundancy — a key that is revoked, misconfigured or serving
 * errors — and NOT a way around a quota that belongs to the project rather than
 * to the key. `docs/ARCHITECTURE.md` states both halves; `edge-handler.ts` enforces them.
 */
export const PROVIDER_KEY_SLOTS = ["primary", "secondary", "tertiary"] as const;
export type ProviderKeySlot = (typeof PROVIDER_KEY_SLOTS)[number];

/** The environment variable each slot is read from. Server-side only. */
export const PROVIDER_KEY_ENVIRONMENT: Record<ProviderKeySlot, string> = {
  primary: "GEMINI_API_KEY_PRIMARY",
  secondary: "GEMINI_API_KEY_SECONDARY",
  tertiary: "GEMINI_API_KEY_TERTIARY",
};
