/**
 * THE ONE ONLINE MODEL, NAMED ONCE.
 *
 * A checked-in allowlist rather than configuration: a client-selected model is
 * never accepted, and a server that could be pointed at "latest" would change
 * what OCADE says without anybody deciding to.
 *
 * `docs/TRD.md` names the exact stable API identifier and `docs/DECISIONS.md`
 * records why: a pinned identity makes behaviour and tests reproducible, and
 * changing it "requires an explicit owner decision and corresponding tests and
 * docs". This file held `gemini-3.7-flash`, dated the day before that decision
 * was taken — implementation drift rather than an owner change, and the kind
 * that is invisible because everything still works, just not with the model the
 * product documents.
 *
 * Owner decision, 13 October 2026 (second, replacing `gemini-3.8-flash` the same day):
 * `gemini-3.5-flash-lite` for Chat and JARVIS on every key slot, with no fallback and
 * no switch after a 429/503. Checked that day against Google's model, pricing and
 * thinking pages: stable, free of charge on the free tier, function calling and
 * thinking minimal/low/medium/high. Google Search grounding is "Not available" on the
 * free tier for this model (and for 3.8 Flash), so a grounded request is refused,
 * never billed, on a free-tier project.
 */
export const ONLINE_MODEL_CATALOG = [
  {
    id: "gemini-3.5-flash-lite",
    status: "stable",
    provider: "google",
    checkedAt: "2026-10-13",
  },
] as const;

export type OnlineModelId = (typeof ONLINE_MODEL_CATALOG)[number]["id"];
export const DEFAULT_ONLINE_MODEL: OnlineModelId = "gemini-3.5-flash-lite";

export function isAllowedOnlineModel(value: string): value is OnlineModelId {
  return ONLINE_MODEL_CATALOG.some((model) => model.id === value);
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
