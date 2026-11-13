/** Owner correction, 19 October 2026: Standard is Gemini; High is opt-in Workers AI.
 * Provider identities are selected only by the server, never accepted from a request.
 */
export const DEFAULT_ONLINE_MODEL = "gemini-3.5-flash-lite";
export const HIGH_ONLINE_MODEL = "@cf/google/gemma-4-26b-a4b-it";
/**
 * The independent planners (plan.md O2/O14): Flash-Lite by default, Gemma 4 31B when the server's
 * `GEMINI_MODEL` names it. Each plans alone. There is no route, no second-model repair and no
 * failover between models: a model that cannot answer a turn says so honestly.
 */
export const PLANNER_MODELS = [DEFAULT_ONLINE_MODEL, "gemma-4-31b-it"] as const;
export type StandardModelId = (typeof PLANNER_MODELS)[number];
export type OnlineModelId = StandardModelId | typeof HIGH_ONLINE_MODEL;

/** The server's configured planner, or undefined when it names anything else (serves nothing). */
export function plannerModel(configured: string | undefined): StandardModelId | undefined {
  const model = (configured ?? DEFAULT_ONLINE_MODEL).trim();
  return PLANNER_MODELS.find((allowed) => allowed === model);
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
