import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ONLINE_MODEL, ONLINE_MODEL_CATALOG, isAllowedOnlineModel } from "../online-models";

/**
 * THE DOCUMENTS AND THE CODE NAME THE SAME MODEL.
 *
 * This exists because they did not. `online-models.ts` pinned
 * `gemini-3.7-flash`, dated 7 September — the day BEFORE `docs/DECISIONS.md`
 * recorded the decision to pin `gemini-3.1-flash-lite`, and that decision says
 * in so many words that changing the model "requires an explicit owner decision
 * and corresponding tests and docs". No such decision existed. Every canonical
 * document named one model and the running code used another, and nothing
 * failed, because a model identifier is a string that works right up until
 * somebody compares it to what was promised.
 *
 * So the comparison happens here, against the documents themselves rather than
 * against a copy of the value. A future change has to move both, which is what
 * "corresponding tests and docs" means in practice.
 *
 * ONLY `docs/TRD.md` CARRIES IT NOW. The identifier used to be asserted in
 * `PLAN.md` too, under its product name. `PLAN.md` is a customer-product
 * document and `docs/RULES.md` #6 keeps raw provider identity off customer
 * surfaces, so the technical authority is the one place that names it — which
 * is also the one place an operator would look.
 *
 * The KEY SLOTS used to be asserted here too. They live in
 * `online-boundary.test.ts` with the rest of the boundary's shape, so there is
 * one place that says what the server may read.
 */

const TRD = readFileSync("docs/TRD.md", "utf8");
const EDGE_FUNCTION = readFileSync("supabase/functions/ocade-intelligence/index.ts", "utf8");

describe("the pinned online model", () => {
  it("is the exact identifier docs/TRD.md names", () => {
    expect(TRD).toContain(`\`${DEFAULT_ONLINE_MODEL}\``);
    expect(DEFAULT_ONLINE_MODEL).toBe("gemini-3.1-flash-lite");
  });

  it("is the only model the allowlist accepts", () => {
    expect(ONLINE_MODEL_CATALOG).toHaveLength(1);
    expect(isAllowedOnlineModel(DEFAULT_ONLINE_MODEL)).toBe(true);
    // A client-chosen model, a provider alias and the identifier this replaced
    // are all refused, so a mistyped override fails closed rather than reaching
    // something nobody chose.
    expect(isAllowedOnlineModel("latest")).toBe(false);
    expect(isAllowedOnlineModel("gemini-3.7-flash")).toBe(false);
    expect(isAllowedOnlineModel("gemini-1.5-pro")).toBe(false);
  });

  it("is the Edge Function's default rather than a second literal", () => {
    // The function used to carry its own `"gemini-3.7-flash"` string, which is
    // how the two came apart in the first place.
    expect(EDGE_FUNCTION).toContain("DEFAULT_ONLINE_MODEL");
    expect(EDGE_FUNCTION).not.toMatch(/"gemini-[\d.]+/);
  });
});
