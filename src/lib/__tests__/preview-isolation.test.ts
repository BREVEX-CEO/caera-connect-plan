import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * A PREVIEW THAT CAN SERVE ocade.in IS NOT A PREVIEW.
 *
 * The isolation is structural rather than procedural: a different Worker name,
 * and no routes at all. Nothing addressed to the production domain can reach a
 * script no route points at, whatever is deployed to it and whoever deploys
 * it. This test exists because that property is invisible — one added `routes`
 * block would quietly turn the preview into a second production with nobody
 * watching.
 *
 * The preview is DERIVED, not written. A hand-written root config was the
 * first attempt and could never have deployed: Nitro's cloudflare-module
 * preset copies `wrangler.json` into `.output/server/wrangler.json` and adds
 * `main`, `assets.directory`, `no_bundle` and the module rules, so a root
 * config deployed directly is missing every one of them. The generator is
 * therefore the thing under test — its inputs, its three edits, and the
 * refusals that stop it producing anything that could answer for ocade.in.
 */

const production = JSON.parse(readFileSync("wrangler.json", "utf8"));
const generator = readFileSync("scripts/preview-config.mjs", "utf8");

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
    expect(generator).toContain('const PREVIEW_NAME = "ocade-web-preview"');
    expect(generator).toContain('const PRODUCTION_NAME = "ocade-web"');
    expect(generator).toContain("config.name = PREVIEW_NAME");
  });

  it("has no routes at all, which is what makes it safe", () => {
    // Not "no production routes" — none. A route is the only way a request
    // for ocade.in could ever arrive here.
    expect(generator).toContain("delete config.routes");
  });

  it("has a URL of its own, which production deliberately does not", () => {
    expect(generator).toContain("config.workers_dev = true");
    expect(production.workers_dev).toBe(false);
  });

  it("inherits everything else, so it previews the real product", () => {
    // A preview on a different runtime is a preview of a different product.
    // Inheritance is the default here: the generator edits three fields and
    // touches nothing else, so compatibility date, flags and assets are
    // production's by construction rather than by a second declaration that
    // can drift.
    const edits = generator.match(/^config\.\w+(\.\w+)* =/gm) ?? [];
    expect(edits).toEqual(["config.name =", "config.workers_dev ="]);
    const deletions = generator.match(/^delete config\.\w+/gm) ?? [];
    expect(deletions).toEqual(["delete config.routes", "delete config.preview_urls"]);
  });

  it("refuses to write anything that could answer for production", () => {
    // The generator checks itself before writing. Each refusal is a way the
    // preview could have become a second production.
    for (const refusal of [
      "preview would take the production Worker name",
      "preview still declares routes",
      "preview has no reachable URL",
      "preview lost the entry point the build produced",
      "preview lost the assets directory the build produced",
    ]) {
      expect(generator).toContain(refusal);
    }
    expect(generator).toContain("process.exit(1)");
  });

  it("is derived from the config the build produced, not a second source", () => {
    // The root wrangler.preview.json this replaced was missing main,
    // assets.directory and no_bundle, and wrangler rejected it outright.
    expect(generator).toContain('".output/server/wrangler.json"');
    expect(existsSync("wrangler.preview.json")).toBe(false);
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
    expect(previewWorkflow).toContain("--config .output/server/wrangler.preview.json");
    expect(previewWorkflow).toContain("node scripts/preview-config.mjs");
    expect(previewWorkflow).not.toContain("wrangler deploy\n");
  });
});
