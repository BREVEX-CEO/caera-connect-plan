/**
 * Why a person's own key did not answer, in their words (plan 14B.1B.5, 14D.4A.5-6): the provider's
 * own refusal, or their own spending policy, and never "OCADE is unavailable". Nothing here falls
 * back to another key, another provider or OCADE's models.
 */
export const BYOK_REFUSALS: Record<string, string> = {
  byok_missing: "The key chosen in Settings > BYOK was deleted. Choose a source again.",
  byok_disabled: "Your key is turned off in Settings > BYOK. Turn it on or choose another source.",
  byok_invalid: "Your provider refused your key. Replace it in Settings > BYOK, then test again.",
  byok_credits_unavailable:
    "Your provider says this key has no credits or billing. Nothing else was used.",
  byok_incompatible:
    "Your provider did not accept this model or address. Check them in Settings > BYOK.",
  byok_blocked: "Your key's API address is not a public HTTPS address OCADE may call.",
  byok_rate_limited: "Your provider asked to slow down. Try again shortly.",
  byok_quota_exhausted: "Your provider's quota for this key is used up until it resets.",
  byok_unreachable: "Your provider did not answer. Try again later.",
  byok_rejected_request: "Your provider refused this request.",
  byok_unavailable: "OCADE could not read your key settings, so nothing was sent.",
  byok_no_model:
    "Auto has no permitted model that can do this. Permit one in Settings > BYOK, or choose Manual.",
  byok_free_only_paid:
    "Your Free-only setting stopped this: the model is not known to be free. Nothing was sent.",
  byok_price_unknown:
    "Your Custom budget needs this model's price, and it is not known. Enter it in Settings > BYOK.",
  byok_budget_task: "This task reached the budget you set for your key. Nothing more was sent.",
  byok_budget_day:
    "Today's budget for your key is used up. It resets at midnight in your time zone.",
  byok_budget_month: "This month's budget for your key is used up. Nothing more was sent.",
};

export function byokRefusal(code: string | undefined): string | undefined {
  return code ? BYOK_REFUSALS[code] : undefined;
}
