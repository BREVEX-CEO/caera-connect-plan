/** Owner correction, 19 October 2026: Standard is Gemini; High is opt-in Workers AI.
 * Provider identities are selected only by the server, never accepted from a request.
 */
export const DEFAULT_ONLINE_MODEL = "gemini-3.5-flash-lite";
export const HIGH_ONLINE_MODEL = "@cf/google/gemma-4-26b-a4b-it";
export const ONLINE_MODEL_CATALOG = [DEFAULT_ONLINE_MODEL, HIGH_ONLINE_MODEL] as const;
export type OnlineModelId = (typeof ONLINE_MODEL_CATALOG)[number];

/**
 * THE THREE KEY SLOTS, IN FAILOVER ORDER.
 *
 * Exactly three, and the order is the policy: primary first, always. They are
 * an operational redundancy — a key that is revoked, misconfigured or serving
 * errors — and NOT a way around a quota that belongs to the project rather than
 * to the key. `docs/TRD.md` states both halves; `edge-handler.ts` enforces them.
 */
export const PROVIDER_KEY_SLOTS = ["primary", "secondary", "tertiary"] as const;
export type ProviderKeySlot = (typeof PROVIDER_KEY_SLOTS)[number];

/** The environment variable each slot is read from. Server-side only. */
export const PROVIDER_KEY_ENVIRONMENT: Record<ProviderKeySlot, string> = {
  primary: "GEMINI_API_KEY_PRIMARY",
  secondary: "GEMINI_API_KEY_SECONDARY",
  tertiary: "GEMINI_API_KEY_TERTIARY",
};
