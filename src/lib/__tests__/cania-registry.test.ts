import { describe, it, expect } from "vitest";
import { CANIA_PROVIDERS, getCaniaProvider, providersForSection } from "../cania-providers";
import { CANIA_SECTIONS, getCaniaSection } from "../cania-sections";

/**
 * CANIA section and provider registries.
 *
 * These two tables reference each other by id: a section lists `providerIds`,
 * and a provider lists the `sections` it can power. A dangling id in either
 * direction is invisible at compile time and produces a section wired to a
 * provider that does not exist (or a provider that no section will ever ask
 * for). The cross-reference tests below are the point of this file.
 *
 * The other invariant is an honesty one, stated in the type itself: a provider
 * status must never be "connected" without a real health check. Nothing in this
 * repository has performed one, so no shipped provider may claim it — that is
 * the same rule as "never report coverage without runtime evidence".
 */

const providerIds = new Set(CANIA_PROVIDERS.map((p) => p.id));
const sectionIds = new Set(CANIA_SECTIONS.map((s) => s.id));

describe("registry basics", () => {
  it("ships providers and sections", () => {
    expect(CANIA_PROVIDERS.length).toBeGreaterThan(0);
    expect(CANIA_SECTIONS.length).toBeGreaterThan(0);
  });

  it("declares no duplicate provider id", () => {
    expect(providerIds.size).toBe(CANIA_PROVIDERS.length);
  });

  it("declares no duplicate section id", () => {
    expect(sectionIds.size).toBe(CANIA_SECTIONS.length);
  });

  it("declares no duplicate section slug", () => {
    const slugs = CANIA_SECTIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("cross-references resolve in both directions", () => {
  it("every providerId named by a section exists", () => {
    const dangling: string[] = [];
    for (const section of CANIA_SECTIONS) {
      for (const id of section.providerIds) {
        if (!providerIds.has(id)) dangling.push(`${section.id} -> ${id}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it("every section named by a provider exists", () => {
    const dangling: string[] = [];
    for (const provider of CANIA_PROVIDERS) {
      for (const id of provider.sections) {
        if (!sectionIds.has(id)) dangling.push(`${provider.id} -> ${id}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it("providersForSection agrees with the section's own provider list", () => {
    // Both directions must describe the same wiring, or the UI and the fetcher
    // disagree about which adapter powers a section.
    for (const section of CANIA_SECTIONS) {
      const viaProviders = providersForSection(section.id)
        .map((p) => p.id)
        .sort();
      const declared = [...section.providerIds].filter((id) => providerIds.has(id)).sort();
      expect(viaProviders, `section ${section.id}`).toEqual(declared);
    }
  });
});

describe("lookup helpers", () => {
  it("finds every shipped provider by id", () => {
    for (const p of CANIA_PROVIDERS) expect(getCaniaProvider(p.id)).toBe(p);
  });

  it("finds every shipped section by slug", () => {
    for (const s of CANIA_SECTIONS) expect(getCaniaSection(s.slug)).toBe(s);
  });

  it("returns undefined for unknown ids rather than throwing", () => {
    expect(getCaniaProvider("no-such-provider")).toBeUndefined();
    expect(getCaniaSection("no-such-section")).toBeUndefined();
  });

  it("returns an empty list for a section with no providers", () => {
    expect(providersForSection("no-such-section")).toEqual([]);
  });
});

describe("provider honesty invariants", () => {
  it("no provider claims to be CONNECTED without a health check", () => {
    // The type says: never set to "connected" without a real health check.
    // None has run, so none may claim it.
    const claiming = CANIA_PROVIDERS.filter((p) => p.status === "connected").map((p) => p.id);
    expect(claiming).toEqual([]);
  });

  it("uses only known statuses, kinds, auth modes and labels", () => {
    const statuses = new Set(["setup_required", "connected", "planned"]);
    const auths = new Set(["none", "api_key", "oauth", "native_companion"]);
    const labels = new Set(["live", "delayed", "estimated", "ai_summary"]);
    const kinds = new Set([
      "news",
      "weather",
      "traffic",
      "currency",
      "markets",
      "commodities",
      "sports",
      "government",
      "risk",
    ]);
    for (const p of CANIA_PROVIDERS) {
      expect(statuses.has(p.status), p.id).toBe(true);
      expect(auths.has(p.auth), p.id).toBe(true);
      expect(labels.has(p.defaultLabel), p.id).toBe(true);
      expect(kinds.has(p.kind), p.id).toBe(true);
    }
  });

  it("tells the user how to set up every credential-requiring provider", () => {
    const unexplained = CANIA_PROVIDERS.filter((p) => p.auth !== "none")
      .filter((p) => !p.setupHint || p.setupHint.trim().length < 10)
      .map((p) => p.id);
    expect(unexplained).toEqual([]);
  });

  it("names a secret env var for every api_key provider", () => {
    const missing = CANIA_PROVIDERS.filter((p) => p.auth === "api_key")
      .filter((p) => !p.secretName || !/^[A-Z0-9_]+$/.test(p.secretName))
      .map((p) => p.id);
    expect(missing).toEqual([]);
  });

  it("never puts a literal credential in the registry", () => {
    // secretName is the NAME of an env var, never its value.
    for (const p of CANIA_PROVIDERS) {
      expect(p.secretName ?? "").not.toMatch(/^sk-|^AKIA|[a-f0-9]{32,}/);
    }
  });

  it("gives every provider a display name, coverage note and at least one section", () => {
    for (const p of CANIA_PROVIDERS) {
      expect(p.displayName.trim().length, p.id).toBeGreaterThan(0);
      expect(p.coverage.trim().length, p.id).toBeGreaterThan(0);
      expect(p.sections.length, p.id).toBeGreaterThan(0);
    }
  });
});

describe("section invariants", () => {
  it("gives every section a title, description and icon", () => {
    for (const s of CANIA_SECTIONS) {
      expect(s.title.trim().length, s.id).toBeGreaterThan(0);
      expect(s.description.trim().length, s.id).toBeGreaterThan(0);
      expect(s.icon, s.id).toBeTruthy();
    }
  });

  it("reserves exactly one empty slug for the overview index", () => {
    const index = CANIA_SECTIONS.filter((s) => s.slug === "");
    expect(index).toHaveLength(1);
    expect(index[0].id).toBe("overview");
  });

  it("uses url-safe slugs", () => {
    for (const s of CANIA_SECTIONS) {
      if (s.slug === "") continue;
      expect(s.slug, s.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("uses only known default labels", () => {
    const labels = new Set(["live", "delayed", "estimated", "ai_summary"]);
    for (const s of CANIA_SECTIONS) expect(labels.has(s.defaultLabel), s.id).toBe(true);
  });

  it("only marks a data section as live-capable if a provider backs it", () => {
    // A non-admin section labelled "live" with no provider would promise fresh
    // data that nothing can actually fetch.
    const empty = CANIA_SECTIONS.filter((s) => !s.adminOnly && s.defaultLabel === "live")
      .filter((s) => providersForSection(s.id).length === 0)
      .map((s) => s.id);
    expect(empty).toEqual([]);
  });
});
