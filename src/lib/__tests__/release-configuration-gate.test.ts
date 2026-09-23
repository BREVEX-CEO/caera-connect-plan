import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { releaseHealthResponse } from "../health";

/**
 * A DEPLOYMENT MISSING A BINDING MUST FAIL ITS OWN GATE.
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
 * Every binding whose absence a customer meets as a broken feature is reported
 * now, not only that one — the R2 binding that is the only door to the
 * artifact, and the four lease values without which no offline capacity can be
 * signed. Presence, never a value: this endpoint is public.
 */
const FIELDS = ["supabasePublic", "supabaseServer", "modelDelivery", "offlineLeases"] as const;
type Configuration = Record<(typeof FIELDS)[number], boolean>;

async function configurationFor(env: Record<string, unknown>): Promise<Configuration> {
  const response = releaseHealthResponse(new Request("https://ocade.in/api/health"), env);
  expect(response).not.toBeNull();
  return (await response!.json()).configuration as Configuration;
}

const CONFIGURED = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_key",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_key",
  // A bucket binding is an object with methods, never a string.
  OCADE_MODELS: { get: () => null, head: () => null },
  OCADE_LEASE_SIGNING_KEY_ID: "lease-key-1",
  OCADE_LEASE_SIGNING_PRIVATE_KEY: "private-key-material",
  OCADE_LEASE_SIGNING_PUBLIC_KEY: "public-key-material",
  OCADE_LEASE_SIGNING_NOT_BEFORE: "2026-01-01T00:00:00.000Z",
};

describe("the release configuration gate", () => {
  it("reports every binding a release needs", async () => {
    expect(await configurationFor(CONFIGURED)).toEqual({
      supabasePublic: true,
      supabaseServer: true,
      modelDelivery: true,
      offlineLeases: true,
    });
  });

  it.each([
    ["SUPABASE_SERVICE_ROLE_KEY", "supabaseServer"],
    ["SUPABASE_PUBLISHABLE_KEY", "supabasePublic"],
    ["OCADE_MODELS", "modelDelivery"],
    ["OCADE_LEASE_SIGNING_PRIVATE_KEY", "offlineLeases"],
    ["OCADE_LEASE_SIGNING_NOT_BEFORE", "offlineLeases"],
  ])("reports %s as absent when it is", async (variable, field) => {
    const { [variable]: _omitted, ...incomplete } = CONFIGURED as Record<string, unknown>;
    const configuration = await configurationFor(incomplete);
    expect(configuration[field as keyof Configuration]).toBe(false);
  });

  it("never reports the value of a secret, only that one exists", async () => {
    const response = releaseHealthResponse(new Request("https://ocade.in/api/health"), CONFIGURED);
    const body = await response!.text();
    for (const secret of ["sb_secret_key", "sb_publishable_key", "private-key-material"]) {
      expect(body).not.toContain(secret);
    }
  });

  it("names the commit the running bundle was built from (F13)", async () => {
    const response = releaseHealthResponse(new Request("https://ocade.in/api/health"), CONFIGURED);
    expect(JSON.parse(await response!.text())).toHaveProperty("commit");
  });

  it("keeps request URLs, and the signed model links in them, out of Worker logs (F25)", () => {
    const wrangler = JSON.parse(readFileSync("wrangler.json", "utf8"));
    expect(wrangler.observability.logs.invocation_logs).toBe(false);
  });

  it("refuses a deployment that is missing any of them", () => {
    // The gate is in the deploy script rather than in a module it could import,
    // so this asserts the list is actually written there. A deployment that
    // cannot answer an authenticated request, deliver the artifact, or sign
    // offline capacity must not be promoted.
    const deploy = readFileSync("scripts/deploy.mjs", "utf8");
    for (const field of FIELDS) expect(deploy).toContain(`"${field}"`);
    expect(deploy).toContain("missingConfiguration(body?.configuration).length > 0");
  });
});
