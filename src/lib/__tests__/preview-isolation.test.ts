import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * A PREVIEW THAT CAN SERVE ocade.in IS NOT A PREVIEW.
 *
 * The isolation is structural rather than procedural: a different Worker name,
 * and no routes at all. Nothing addressed to the production domain can reach a
 * script no route points at, whatever is deployed to it and whoever deploys
 * it. This test exists because that property is invisible — the two files look
 * almost identical, and one added `routes` block would quietly turn the
 * preview into a second production with nobody watching.
 */

const production = JSON.parse(readFileSync("wrangler.json", "utf8"));
const preview = JSON.parse(readFileSync("wrangler.preview.json", "utf8"));

describe("the production Worker", () => {
  it("is reachable only on its own domain", () => {
    expect(production.workers_dev).toBe(false);
    expect(production.preview_urls).toBe(false);
  });

  it("owns the production routes", () => {
    const patterns = (production.routes ?? []).map((r: { pattern: string }) => r.pattern);
    expect(patterns).toContain("ocade.in/*");
    expect(patterns).toContain("www.ocade.in/*");
  });
});

describe("the preview Worker", () => {
  it("is a different script, so deploying it cannot overwrite production", () => {
    expect(preview.name).not.toBe(production.name);
    expect(preview.name).toBe("ocade-web-preview");
  });

  it("has no routes at all, which is what makes it safe", () => {
    // Not "no production routes" — none. A route is the only way a request
    // for ocade.in could ever arrive here.
    expect(preview.routes).toBeUndefined();
  });

  it("has a URL of its own, which production deliberately does not", () => {
    expect(preview.workers_dev).toBe(true);
  });

  it("is built on the same compatibility date as production", () => {
    // A preview on a different runtime is a preview of a different product.
    expect(preview.compatibility_date).toBe(production.compatibility_date);
    expect(preview.compatibility_flags).toEqual(production.compatibility_flags);
  });
});

describe("the deployment workflows", () => {
  const productionWorkflow = readFileSync(".github/workflows/cloudflare-production.yml", "utf8");
  const previewWorkflow = readFileSync(".github/workflows/cloudflare-preview.yml", "utf8");

  it("keep production behind one deliberate typed approval", () => {
    expect(productionWorkflow).toContain("I_APPROVE_OCADE_PRODUCTION_DEPLOY");
    // No push trigger: production is never deployed by merging something.
    expect(productionWorkflow).not.toMatch(/^\s*push:/m);
  });

  it("never deploy the preview automatically", () => {
    expect(previewWorkflow).not.toMatch(/^\s*push:/m);
    expect(previewWorkflow).toContain("workflow_dispatch");
  });

  it("point the preview at its own config", () => {
    expect(previewWorkflow).toContain("--config wrangler.preview.json");
    expect(previewWorkflow).not.toContain("wrangler deploy\n");
  });
});
