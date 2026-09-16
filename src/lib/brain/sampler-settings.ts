/**
 * THE SAMPLING VALUES OFFLINE INTELLIGENCE RUNS AT — DECIDED ONCE.
 *
 * One place, read by the adapter and by the artifact proof, so the conditions
 * a proof establishes are the conditions the product applies. When each caller
 * carried its own literals, proving the artifact answered correctly proved it
 * about settings nothing shipped with.
 *
 * THESE ARE THE ARTIFACT'S OWN RECOMMENDED VALUES, not a house preference. A
 * previous engine was run at 0.2/0.9 on the reasoning that a small model doing
 * arithmetic should be sampled tightly. That reasoning is sound and these
 * weights were not tuned for it: at 0.2 this artifact repeats and stalls, which
 * is how `scripts/prove-offline-artifact.mjs` came to need 0.7/0.8/20 before it
 * would answer a sum correctly. The publisher's values win over the theory.
 */
export const BROWSER_SAMPLER = {
  temperature: 0.7,
  topP: 0.8,
  topK: 20,
  minP: 0,
} as const;
