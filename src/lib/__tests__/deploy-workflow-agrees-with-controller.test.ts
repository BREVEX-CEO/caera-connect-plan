import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDeploymentPlan } from "../../../scripts/deploy.mjs";

/**
 * THE DEPLOYMENT PATH MUST ACCEPT THE TREE IT SHIPS.
 *
 * The controller once demanded an environment value and a built-output header
 * the workflow and the build no longer had, so every deployment was refused
 * before Wrangler ran and the only symptom was a red workflow nobody reran.
 * This keeps the two in step.
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
