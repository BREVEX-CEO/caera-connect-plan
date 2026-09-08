import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * THE DEMO IS GONE, AND STAYS GONE.
 *
 * OCADE had a 28-minute anonymous demo: its own routes, its own session clock,
 * its own once-per-28-hours reset window, its own entitlement record on the
 * account, and its own copy across the public pages. Free is now a real
 * authenticated account plan, so none of that has a meaning any more — and a
 * timed trial that survives in fragments is worse than one that is still there,
 * because the fragments are the parts nobody is maintaining.
 *
 * This is the demo-removal row of the final verification matrix, expressed as a
 * gate: no route, no timer, no entitlement, no flag, no UI, no copy, no
 * fixture. It is deliberately a whole-tree scan rather than a list of the files
 * that were deleted, because the failure it guards against is a NEW reference
 * appearing, not an old one surviving.
 */

/** Product source, excluding tests — a test naming the demo to forbid it is fine. */
function productSources(root = "src"): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      found.push(...productSources(path));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

const ROUTE_TREE = readFileSync("src/routeTree.gen.ts", "utf8");
const ROOT = readFileSync("src/routes/__root.tsx", "utf8");

describe("the demo is removed from the product", () => {
  it("has no demo route file", () => {
    const routes = readdirSync("src/routes");
    expect(routes.filter((file) => file.startsWith("demo"))).toEqual([]);
  });

  it("has no demo route in the generated tree, so old demo URLs reach the 404", () => {
    /*
     * The two halves matter together. No route means the router finds nothing
     * to match; `notFoundComponent` on the root means what it shows instead is
     * OCADE's ordinary 404 rather than a blank page or a crash.
     */
    expect(ROUTE_TREE).not.toMatch(/["'`]\/demo\b/);
    expect(ROUTE_TREE).not.toMatch(/routes\/demo\./);
    expect(ROOT).toMatch(/notFoundComponent:/);
  });

  it("has no demo authority, hooks, components or fixtures left on disk", () => {
    for (const path of [
      "src/lib/demo",
      "src/components/ocade/demo",
      "src/components/shell/DemoShell.tsx",
      "src/components/shell/DemoBadge.tsx",
    ]) {
      expect(existsSync(path), `${path} still exists`).toBe(false);
    }
  });

  it("keeps no demo session clock, reset window or entitlement marker", () => {
    /*
     * The specific things the demo enforced. Named individually because each
     * one could be reintroduced on its own and would be a timed trial again:
     * a countdown, a once-per-window gate, or an account-level record that a
     * free trial had been consumed.
     */
    const forbidden = [
      /DEMO_SESSION_MS/,
      /DEMO_RESET_MS/,
      /DEMO_WARNING_MS/,
      /demo_consumed_at/,
      /recordDemoConsumed/,
      /useDemoSession/,
      /DemoProvider/,
      /DEMO_MODULES/,
    ];
    for (const file of productSources()) {
      const source = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        expect(source, `${file} still references ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("routes no product surface at a removed demo URL", () => {
    // Including the service worker and the offline page, which are not
    // TypeScript and so are missed by a source scan.
    for (const file of [
      ...productSources(),
      "public/sw.js",
      "public/offline.html",
      "public/manifest.webmanifest",
    ]) {
      if (!existsSync(file)) continue;
      expect(readFileSync(file, "utf8"), `${file} links to a removed demo route`).not.toMatch(
        /["'`(]\/demo\b/,
      );
    }
  });

  it("still isolates the product routes it is supposed to isolate", () => {
    /*
     * Removing the demo prefixes must not have removed the isolation rule with
     * them. `/ocade` runs inference and needs cross-origin isolation for
     * threads; `/auth` must never be isolated.
     */
    const isolation = readFileSync("src/lib/security/isolation.ts", "utf8");
    expect(isolation).toMatch(/ISOLATED_PATH_PREFIXES = \["\/ocade"\]/);
    expect(isolation).toMatch(/NEVER_ISOLATED_PATH_PREFIXES = \["\/auth"/);
  });
});
