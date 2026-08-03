import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  registerFeature,
  getFeature,
  isFeatureAvailable,
  listFeatures,
  type Feature,
} from "../features";

/**
 * Feature registry — the enforcement seam for the No-Dead-Button policy.
 *
 * The UI reads this registry to decide whether a control is enabled, disabled
 * with a reason, or replaced by a SetupRequired / AccessDenied state. Two kinds
 * of test live here:
 *
 *  1. Behaviour of the registry functions themselves.
 *  2. INVARIANTS ASSERTED OVER THE REAL SHIPPED REGISTRY — not a fixture. These
 *     are the ones that catch a future feature added without an explanation,
 *     which is exactly how a dead button reaches a user.
 */

const feature = (over: Partial<Feature> = {}): Feature => ({
  id: `test.${Math.random().toString(36).slice(2)}`,
  module: "core",
  title: "Test feature",
  status: "active",
  platforms: ["web"],
  ...over,
});

describe("registerFeature refuses an unexplained non-active feature", () => {
  for (const status of ["setup_required", "planned", "hidden"] as const) {
    it(`throws when a "${status}" feature has no reason`, () => {
      expect(() => registerFeature(feature({ status }))).toThrow(/no reason/i);
    });

    it(`accepts a "${status}" feature that explains itself`, () => {
      const f = feature({ status, reason: "Waiting on the provider adapter." });
      expect(() => registerFeature(f)).not.toThrow();
      expect(getFeature(f.id)?.reason).toBe("Waiting on the provider adapter.");
    });
  }

  it("accepts active and beta features without a reason", () => {
    expect(() => registerFeature(feature({ status: "active" }))).not.toThrow();
    expect(() => registerFeature(feature({ status: "beta" }))).not.toThrow();
  });

  it("does not register a feature that failed validation", () => {
    const f = feature({ status: "planned" });
    expect(() => registerFeature(f)).toThrow();
    expect(getFeature(f.id)).toBeUndefined();
  });
});

describe("availability is only ever active or beta", () => {
  it("treats active and beta as available", () => {
    const a = feature({ status: "active" });
    const b = feature({ status: "beta" });
    registerFeature(a);
    registerFeature(b);
    expect(isFeatureAvailable(a.id)).toBe(true);
    expect(isFeatureAvailable(b.id)).toBe(true);
  });

  it("treats setup_required, planned and hidden as NOT available", () => {
    for (const status of ["setup_required", "planned", "hidden"] as const) {
      const f = feature({ status, reason: "Not ready." });
      registerFeature(f);
      expect(isFeatureAvailable(f.id)).toBe(false);
    }
  });

  it("reports an unknown feature id as unavailable rather than throwing", () => {
    expect(isFeatureAvailable("does.not.exist")).toBe(false);
    expect(getFeature("does.not.exist")).toBeUndefined();
  });
});

describe("listFeatures", () => {
  it("filters by module", () => {
    const f = feature({ module: "madee" });
    registerFeature(f);
    const madee = listFeatures("madee");
    expect(madee.some((x) => x.id === f.id)).toBe(true);
    expect(madee.every((x) => x.module === "madee")).toBe(true);
  });

  it("returns every module when none is given", () => {
    expect(listFeatures().length).toBeGreaterThanOrEqual(listFeatures("core").length);
  });
});

/* ---------------------------------------------------------------------- */
/* Invariants over the REAL shipped registry — the No-Dead-Button policy.  */
/* ---------------------------------------------------------------------- */

const source = readFileSync(new URL("../features.ts", import.meta.url), "utf8");

/** Ids declared in the shipped bootstrap array, in source order. */
const shippedIds = [...source.matchAll(/^\s*id:\s*"([^"]+)"/gm)].map((m) => m[1]);
const shippedIdSet = new Set(shippedIds);

/**
 * The registry is a module-level singleton, so features registered by the
 * behaviour tests above also live in it. These invariants are about what the
 * product SHIPS, so they read only the ids declared in the source bootstrap
 * array and ignore test fixtures.
 */
const shippedFeatures = () => listFeatures().filter((f) => shippedIdSet.has(f.id));

describe("shipped feature registry invariants", () => {
  it("ships a non-trivial set of features", () => {
    expect(shippedIds.length).toBeGreaterThan(10);
  });

  it("declares no DUPLICATE feature id", () => {
    // The registry is a Map, so a duplicate id silently overwrites the earlier
    // entry and one feature disappears from the UI with no error anywhere.
    const seen = new Set<string>();
    const duplicates = shippedIds.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(duplicates).toEqual([]);
  });

  it("gives every non-active feature a user-facing reason", () => {
    // This is the policy: a control the user cannot use must say WHY.
    const unexplained = shippedFeatures()
      .filter((f) => f.status !== "active" && f.status !== "beta")
      .filter((f) => !f.reason || f.reason.trim().length === 0)
      .map((f) => f.id);
    expect(unexplained).toEqual([]);
  });

  it("writes reasons that actually explain, not placeholders", () => {
    const weak = shippedFeatures()
      .filter((f) => f.reason)
      .filter(
        (f) => f.reason!.trim().length < 15 || /^(tbd|todo|n\/a|soon)$/i.test(f.reason!.trim()),
      )
      .map((f) => f.id);
    expect(weak).toEqual([]);
  });

  it("gives every feature at least one platform", () => {
    const platformless = shippedFeatures()
      .filter((f) => !Array.isArray(f.platforms) || f.platforms.length === 0)
      .map((f) => f.id);
    expect(platformless).toEqual([]);
  });

  it("gives every feature a human-readable title", () => {
    const untitled = shippedFeatures()
      .filter((f) => !f.title || f.title.trim().length === 0)
      .map((f) => f.id);
    expect(untitled).toEqual([]);
  });

  it("uses only known modules and statuses", () => {
    const modules = new Set(["core", "ocade", "ficia", "madee", "cania", "admin"]);
    const statuses = new Set(["active", "beta", "setup_required", "planned", "hidden"]);
    for (const f of shippedFeatures()) {
      expect(modules.has(f.module)).toBe(true);
      expect(statuses.has(f.status)).toBe(true);
    }
  });

  it("registers every id declared in the source bootstrap array", () => {
    // Catches an entry that is declared but never reaches the registry.
    for (const id of new Set(shippedIds)) {
      expect(getFeature(id), `feature "${id}" is declared but not registered`).toBeDefined();
    }
  });
});
