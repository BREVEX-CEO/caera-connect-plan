/** Owner decision, 19 October 2026: Gemma primary, Gemini fallback; server-selected only.
 * Google hosts both under the same native API; Cloudflare authenticates and proxies it.
 * Exact identities are pinned; API capability is not a benchmark result.
 */
export const ONLINE_MODEL_CATALOG = ["gemma-4-26b-a4b-it", "gemini-3.5-flash-lite"] as const;
export type OnlineModelId = (typeof ONLINE_MODEL_CATALOG)[number];
export const DEFAULT_ONLINE_MODEL = ONLINE_MODEL_CATALOG[0];
export const FALLBACK_ONLINE_MODEL = ONLINE_MODEL_CATALOG[1];
export function isAllowedOnlineModel(value: string): value is OnlineModelId {
  return ONLINE_MODEL_CATALOG.some((model) => model === value);
}

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
