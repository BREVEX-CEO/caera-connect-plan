/** Checked-in production allowlist. Never accept a client-selected model. */
export const ONLINE_MODEL_CATALOG = [
  {
    id: "gemini-3.7-flash",
    status: "stable",
    provider: "google",
    checkedAt: "2026-09-07",
  },
] as const;

export type OnlineModelId = (typeof ONLINE_MODEL_CATALOG)[number]["id"];
export const DEFAULT_ONLINE_MODEL: OnlineModelId = "gemini-3.7-flash";

export function isAllowedOnlineModel(value: string): value is OnlineModelId {
  return ONLINE_MODEL_CATALOG.some((model) => model.id === value);
}
