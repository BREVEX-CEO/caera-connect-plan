/**
 * What OCADE runs on. One entry, because there is one engine.
 *
 * THIS FILE USED TO BE A CLOUD CATALOGUE. Four providers — Lovable Gateway,
 * Historical engine labels and hosted providers are normalized behind OCADE's
 * local-first runtime boundary.
 * including google/gemini-3.5-flash and openai/gpt-5.5, each with locality,
 * cost, speed and vision metadata, plus `autoSelectModel` to pick between them
 * from the user's privacy/cost/speed preferences.
 *
 * The Chat composer rendered that list as a dropdown. Every option in it was a
 * hosted model. Choosing one is now meaningless — generation happens on the
 * device whatever the dropdown says — so a picker over that list would be a
 * control that changes nothing, which is exactly the defect this pass exists
 * to remove.
 *
 * What remains is the honest shape: OCADE describes its engine by capability,
 * never by file name, and there is one capability tier to describe.
 */

export interface OcadeModelInfo {
  id: string;
  display: string;
  description: string;
  locality: "local";
  vision: boolean;
}

/**
 * The on-device engine, named the way OCADE is allowed to name it.
 *
 * `id` stays a stable string rather than becoming a raw model identifier: it
 * is persisted on every stored message as `model_id`, and existing rows say
 * things like "google/gemini-3.5-flash". `getOcadeModel` resolves anything
 * unknown to this entry, so old conversations render with a truthful label
 * instead of advertising a provider OCADE no longer uses.
 */
export const OCADE_LOCAL_ENGINE: OcadeModelInfo = {
  id: "ocade-local",
  display: "OCADE Local",
  description: "Runs on this device. Unlimited and private.",
  locality: "local",
  vision: false,
};

export const OCADE_MODELS: OcadeModelInfo[] = [OCADE_LOCAL_ENGINE];

export const OCADE_DEFAULT_MODEL_ID = OCADE_LOCAL_ENGINE.id;

/**
 * Resolve a stored `model_id` to something that can be shown.
 *
 * Deliberately total: a message persisted before this change carries a hosted
 * model id that is not in the list any more, and a lookup that returned
 * `undefined` there would blank the label on historical conversations.
 */
export function getOcadeModel(id: string | null | undefined): OcadeModelInfo {
  return OCADE_MODELS.find((m) => m.id === id) ?? OCADE_LOCAL_ENGINE;
}
