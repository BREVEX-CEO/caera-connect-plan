import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { releaseHealthResponse } from "../health";

/**
 * A DEPLOYMENT WITHOUT THE SERVER SECRET MUST FAIL ITS OWN GATE.
 *
 * This is the Phase 1 production defect, and it was invisible for the worst
 * possible reason: the release gate asked only about the two public values the
 * browser also holds. A Worker with `SUPABASE_URL` and
 * `SUPABASE_PUBLISHABLE_KEY` but no `SUPABASE_SERVICE_ROLE_KEY` serves the
 * shell, signs people in, renders Chat — and then throws inside every server
 * function that needs the admin client. Reproduced in a real browser against
 * the production build: Send answers "OCADE could not verify your usage
 * allowance", Billing cannot read the allowance, Advanced renders no sessions,
 * and Offline Intelligence reports itself unavailable although the approved
 * artifact exists. One missing secret, four customer-visible failures, and a
 * green deployment.
 *
 * Health reports which bindings exist and never what they contain, and
 * `scripts/deploy.mjs` refuses a deployment whose health says the server secret
 * is absent.
 */
async function configurationFor(env: Record<string, unknown>) {
  const response = releaseHealthResponse(new Request("https://ocade.in/api/health"), env);
  expect(response).not.toBeNull();
  return (await response!.json()).configuration as {
    supabasePublic: boolean;
    supabaseServer: boolean;
  };
}

const CONFIGURED = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_key",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_key",
};

describe("the release configuration gate", () => {
  it("reports both halves of the Supabase binding", async () => {
    expect(await configurationFor(CONFIGURED)).toEqual({
      supabasePublic: true,
      supabaseServer: true,
    });
  });

  it("reports the server secret as absent when it is", async () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _omitted, ...withoutSecret } = CONFIGURED;
    expect(await configurationFor(withoutSecret)).toEqual({
      supabasePublic: true,
      supabaseServer: false,
    });
  });

  it("never reports the value of a secret, only that one exists", async () => {
    const response = releaseHealthResponse(new Request("https://ocade.in/api/health"), CONFIGURED);
    const body = await response!.text();
    expect(body).not.toContain("sb_secret_key");
    expect(body).not.toContain("sb_publishable_key");
  });

  it("is refused by the deployment gate when the server secret is missing", () => {
    // The gate is in the deploy script rather than in a module it could import,
    // so this asserts the condition is actually written there. A deployment
    // that cannot answer a single authenticated request must not be promoted.
    const deploy = readFileSync("scripts/deploy.mjs", "utf8");
    expect(deploy).toContain("body?.configuration?.supabaseServer !== true");
  });
});
