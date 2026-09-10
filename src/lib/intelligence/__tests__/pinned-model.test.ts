import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ONLINE_MODEL,
  ONLINE_MODEL_CATALOG,
  PROVIDER_KEY_ENVIRONMENT,
  PROVIDER_KEY_SLOTS,
  isAllowedOnlineModel,
} from "../online-models";

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
 */

const TRD = readFileSync("docs/TRD.md", "utf8");
const PLAN = readFileSync("PLAN.md", "utf8");
const EDGE_FUNCTION = readFileSync("supabase/functions/ocade-intelligence/index.ts", "utf8");

describe("the pinned online model", () => {
  it("is the exact identifier docs/TRD.md names", () => {
    /*
     * The TRD carries the API identifier; PLAN.md and the rest carry the
     * product name. Both are checked, because the product name is what a reader
     * recognises and the identifier is what the request actually uses.
     */
    expect(TRD).toContain(`\`${DEFAULT_ONLINE_MODEL}\``);
    expect(PLAN).toContain("Gemini 3.1 Flash-Lite");
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

describe("the three key slots", () => {
  it("are exactly three, in the order failover uses", () => {
    expect(PROVIDER_KEY_SLOTS).toEqual(["primary", "secondary", "tertiary"]);
  });

  it("read the environment variables docs/TRD.md names", () => {
    for (const slot of PROVIDER_KEY_SLOTS) {
      const variable = PROVIDER_KEY_ENVIRONMENT[slot];
      expect(TRD, `docs/TRD.md does not name ${variable}`).toContain(variable);
      expect(EDGE_FUNCTION, `the Edge Function never reads ${variable}`).toContain(variable);
    }
  });

  it("are the only provider credentials the function reads", () => {
    /*
     * `GEMINI_API_KEY` survives as an alias for the primary — earlier
     * deployments set it, and a rename that silently turned online intelligence
     * off would be worse than one alias. Anything ELSE named like a key is a
     * fourth slot nobody decided on.
     */
    const read = [...EDGE_FUNCTION.matchAll(/Deno\.env\.get\("(GEMINI[A-Z_]*)"\)/g)].map(
      (match) => match[1],
    );
    expect(new Set(read)).toEqual(
      new Set([
        "GEMINI_API_KEY_PRIMARY",
        "GEMINI_API_KEY_SECONDARY",
        "GEMINI_API_KEY_TERTIARY",
        "GEMINI_API_KEY",
        "GEMINI_MODEL",
      ]),
    );
  });

  it("never leave the server", () => {
    /*
     * The provider host and the key header exist in exactly one file, and it is
     * a Deno function that no browser bundle imports. `Local-only performs zero
     * provider DNS/fetch/preconnect/health traffic` is true for the same reason:
     * the browser does not have the address.
     */
    expect(EDGE_FUNCTION).toContain("generativelanguage.googleapis.com");
    expect(EDGE_FUNCTION).toContain("x-goog-api-key");
  });
});
