/**
 * THE SAMPLING VALUES OCADE RUNS BROWSER ENGINES AT — DECIDED ONCE.
 *
 * These are not a preference. They are part of what an answer receipt PINS: a
 * repeat is only interpretable if the conditions it claims were the conditions
 * actually applied. When each adapter carried its own literal, a change to one
 * of them turned every pin on the other into a quiet lie — the receipt said
 * 0.2/0.9 and the runtime used something else.
 *
 * So the adapters read these, and so does the pin. There is one number to
 * change, and changing it changes the receipt with it.
 *
 * LOW TEMPERATURE ON PURPOSE. The browser tiers are small models doing exact
 * and arithmetic work; sampling them loosely made them erratic on precisely
 * the prompts where being wrong is most obvious.
 */
export const BROWSER_SAMPLER = {
  temperature: 0.2,
  topP: 0.9,
} as const;
