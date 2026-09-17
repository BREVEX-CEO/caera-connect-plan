import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDeploymentPlan } from "../../../scripts/deploy.mjs";

/**
 * THE ONLY WAY OCADE REACHES PRODUCTION MUST ACCEPT THE TREE IT SHIPS.
 *
 * `cloudflare-production.yml` is the single deployment path, and it supplies a
 * fixed environment. When the controller demands something that workflow does
 * not set — or something the build no longer produces — every deployment is
 * refused and the only symptom is a red workflow nobody reruns.
 *
 * That is exactly what happened: Phase 2 removed the pre-launch gate from
 * `cloudflare-entry.ts`, but the controller still required its
 * `x-ocade-edge-gate` header in the built Worker entry and still demanded an
 * `OCADE_DEPLOY_EXPECT_ASSET_STATE` the workflow had to guess. Production sat
 * on a pre-Phase-1 build for weeks with no product defect behind it.
 *
 * So this asserts the two agree in both directions: the workflow's environment
 * is enough, and the controller asks for nothing the deleted gate used to give.
 */
const WORKFLOW = readFileSync(".github/workflows/cloudflare-production.yml", "utf8");

/** What the workflow provides, with the secrets standing in as themselves. */
const WORKFLOW_ENVIRONMENT = {
  CLOUDFLARE_API_TOKEN: "token",
  CLOUDFLARE_ACCOUNT_ID: "account",
  OCADE_DEPLOY_HEALTH_URL: "https://ocade.in/api/health",
  OCADE_DEPLOY_APPROVAL: "I_APPROVE_OCADE_PRODUCTION_DEPLOY",
  OCADE_ROLLBACK_VERSION_ID: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  OCADE_SUPABASE_PROJECT_REF: "sazhgaisyhkdbrooycdv",
  VITE_SUPABASE_URL: "https://sazhgaisyhkdbrooycdv.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_uFxUZNEZWZIWMB1T8CxXZQ_tyfgnkd9",
};

describe("the production deployment workflow", () => {
  it("supplies everything the controller requires to deploy", () => {
    const plan = createDeploymentPlan({ mode: "deploy", env: WORKFLOW_ENVIRONMENT });
    expect(plan.blockers).toEqual([]);
    expect(plan.ready).toBe(true);
  });

  it("sets every environment variable the controller reads", () => {
    for (const name of Object.keys(WORKFLOW_ENVIRONMENT)) {
      expect(WORKFLOW).toContain(`${name}:`);
    }
  });
});
