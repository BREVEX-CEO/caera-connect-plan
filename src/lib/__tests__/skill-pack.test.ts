import { describe, it, expect } from "vitest";
import {
  matchPack,
  assessAction,
  preferredMethod,
  methodRank,
  buildReceipt,
  describeMethod,
  CONFIDENCE_THRESHOLD,
  CONTROL_PREFERENCE,
  SKILL_CATEGORIES,
  type SkillPack,
  type SkillCapability,
  type AppIdentity,
} from "../skills/skill-pack";

const exportPdf: SkillCapability = {
  id: "export_pdf",
  label: "Export as PDF",
  methods: ["official_api", "vision_input"],
  mutating: true,
  verifyBy: "file",
  tested: true,
};

const pack: SkillPack = {
  appId: "libreoffice.calc",
  displayName: "LibreOffice Calc",
  category: "office_docs",
  testedVersions: ["24.", "25."],
  capabilities: [exportPdf],
  requiresLicensedInstall: false,
};

const app = (over: Partial<AppIdentity> = {}): AppIdentity => ({
  appId: "libreoffice.calc",
  displayName: "LibreOffice Calc",
  version: "24.8.1",
  ...over,
});

/**
 * OCADE must never claim knowledge of an app or version it has not verified.
 * These pin the three honest states apart.
 */
describe("matching an app to a pack", () => {
  it("reports `verified` only for a tested version", () => {
    const m = matchPack(app(), [pack]);
    expect(m.confidence).toBe("verified");
    expect(m.pack).toBe(pack);
  });

  /**
   * Menus and control ids move between releases. A pack for the right app but
   * an untested version must not be presented as tested.
   */
  it("downgrades a known app on an UNTESTED version to `probed`", () => {
    const m = matchPack(app({ version: "26.0.0" }), [pack]);
    expect(m.confidence).toBe("probed");
    expect(m.reason).toMatch(/re-check|not version/i);
  });

  it("treats a missing version as untested rather than assuming the latest", () => {
    expect(matchPack(app({ version: null }), [pack]).confidence).toBe("probed");
  });

  it("says plainly when there is NO pack, and never substitutes a similar app", () => {
    const m = matchPack(app({ appId: "some.unknown.app", displayName: "Unknown App" }), [pack]);
    expect(m.pack).toBeNull();
    expect(m.confidence).toBe("unknown");
    expect(m.reason).toMatch(/doesn't have a tested skill pack/i);
    expect(m.reason).toMatch(/inspect/i);
  });

  it("a pack with no pinned versions is never `verified`", () => {
    const loose = { ...pack, testedVersions: [] };
    expect(matchPack(app(), [loose]).confidence).toBe("probed");
  });

  it("always supplies a reason the user can read", () => {
    for (const v of ["24.8.1", "99.0", null]) {
      expect(matchPack(app({ version: v }), [pack]).reason.length).toBeGreaterThan(10);
    }
  });
});

/**
 * Control-method order is a SAFETY ordering. Vision with synthetic input is
 * last because it is the only method that cannot confirm its target before
 * acting on it.
 */
describe("choosing how to act", () => {
  it("prefers an official API over everything else", () => {
    expect(preferredMethod(["vision_input", "official_api", "dom"])).toBe("official_api");
  });

  it("ranks vision + input dead last", () => {
    const worst = [...CONTROL_PREFERENCE].sort((a, b) => methodRank(b) - methodRank(a))[0];
    expect(worst).toBe("vision_input");
  });

  it("returns null rather than inventing a method", () => {
    expect(preferredMethod([])).toBeNull();
  });

  it("describes every method in plain language", () => {
    for (const m of CONTROL_PREFERENCE) {
      expect(describeMethod(m).length).toBeGreaterThan(3);
    }
  });
});

describe("assessing an action before it runs", () => {
  it("proceeds confidently on a verified pack with an API", () => {
    const a = assessAction(exportPdf, "verified", ["official_api"]);
    expect(a.method).toBe("official_api");
    expect(a.proceed).toBe(true);
    expect(a.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });

  it("refuses when no known method is available", () => {
    const a = assessAction(exportPdf, "verified", ["cli"]);
    expect(a.method).toBeNull();
    expect(a.proceed).toBe(false);
    expect(a.confidence).toBe(0);
  });

  /** Vision cannot verify its target, so it must not clear the bar alone. */
  it("does NOT proceed unattended on a probed pack via vision only", () => {
    const a = assessAction(exportPdf, "probed", ["vision_input"]);
    expect(a.method).toBe("vision_input");
    expect(a.proceed).toBe(false);
    expect(a.reason).toMatch(/inspect the app first/i);
  });

  it("an unknown app never proceeds unattended", () => {
    const a = assessAction(exportPdf, "unknown", ["official_api"]);
    expect(a.proceed).toBe(false);
  });

  it("penalises an untested capability", () => {
    const untested = { ...exportPdf, tested: false };
    const tested = assessAction(exportPdf, "verified", ["official_api"]).confidence;
    const not = assessAction(untested, "verified", ["official_api"]).confidence;
    expect(not).toBeLessThan(tested);
  });

  /** Changing data with no way to check it afterwards is the worst case. */
  it("penalises a mutating action that cannot be verified", () => {
    const unverifiable = { ...exportPdf, verifyBy: "none" as const };
    const a = assessAction(unverifiable, "verified", ["official_api"]);
    expect(a.confidence).toBeLessThan(
      assessAction(exportPdf, "verified", ["official_api"]).confidence,
    );
  });

  it("a read-only action is not penalised for lacking verification", () => {
    const read = { ...exportPdf, mutating: false, verifyBy: "none" as const };
    expect(assessAction(read, "verified", ["official_api"]).proceed).toBe(true);
  });

  it("confidence is always reported between 0 and 1", () => {
    for (const c of ["verified", "probed", "unknown"] as const) {
      const a = assessAction(exportPdf, c, ["vision_input"]);
      expect(a.confidence).toBeGreaterThanOrEqual(0);
      expect(a.confidence).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * A receipt is evidence that something happened. Producing one without a check
 * would be exactly the fabricated success this product refuses to emit.
 */
describe("evidence receipts", () => {
  it("records what was done, how, and that it was confirmed", () => {
    const r = buildReceipt({
      app: app(),
      capability: exportPdf,
      method: "official_api",
      verified: true,
      evidence: "report.pdf appeared in Documents (48 KB)",
      now: new Date("2026-07-23T10:00:00Z"),
    });
    expect(r.appId).toBe("libreoffice.calc");
    expect(r.capabilityId).toBe("export_pdf");
    expect(r.verified).toBe(true);
    expect(r.evidence).toContain("report.pdf");
    expect(r.at).toBe("2026-07-23T10:00:00.000Z");
  });

  it("MARKS an unverified action instead of quietly presenting it as done", () => {
    const r = buildReceipt({
      app: app(),
      capability: exportPdf,
      method: "vision_input",
      verified: false,
      evidence: "the dialog closed",
      now: new Date(),
    });
    expect(r.verified).toBe(false);
    expect(r.evidence).toMatch(/^NOT CONFIRMED:/);
  });

  it("still says so when there was no evidence at all", () => {
    const r = buildReceipt({
      app: app(),
      capability: exportPdf,
      method: "vision_input",
      verified: false,
      evidence: "",
    });
    expect(r.evidence).toMatch(/NOT CONFIRMED: no check was possible/);
  });
});

describe("category coverage", () => {
  it("covers every software family the product promises", () => {
    expect(SKILL_CATEGORIES).toHaveLength(14);
    for (const c of SKILL_CATEGORIES) expect(typeof c).toBe("string");
    expect(new Set(SKILL_CATEGORIES).size).toBe(SKILL_CATEGORIES.length);
  });
});

/**
 * Inspecting an app is only worth doing if it changes the decision. Without a
 * confidence credit, OCADE would inspect and then still refuse — the learned
 * map would be dead weight.
 */
describe("a learned map counts as evidence", () => {
  const probedNoMap = assessAction(exportPdf, "probed", ["official_api"]);

  it("a fresh map raises confidence enough to act", () => {
    const withMap = assessAction(exportPdf, "probed", ["official_api"], { uses: 0 });
    expect(withMap.confidence).toBeGreaterThan(probedNoMap.confidence);
    expect(withMap.proceed).toBe(true);
  });

  it("a map proven over many uses is worth more than one just learned", () => {
    const fresh = assessAction(exportPdf, "probed", ["official_api"], { uses: 0 });
    const proven = assessAction(exportPdf, "probed", ["official_api"], { uses: 10 });
    expect(proven.confidence).toBeGreaterThan(fresh.confidence);
  });

  /** A learned map must never reach the standing of a genuinely tested pack. */
  it("never lets a learned map match a tested pack", () => {
    const proven = assessAction(exportPdf, "probed", ["official_api"], { uses: 1000 });
    const tested = assessAction(exportPdf, "verified", ["official_api"]);
    expect(proven.confidence).toBeLessThan(tested.confidence);
  });

  it("does not rescue an unknown app with a vision-only route", () => {
    const a = assessAction(exportPdf, "unknown", ["vision_input"], { uses: 50 });
    expect(a.proceed).toBe(false);
  });

  it("no map means no credit", () => {
    expect(assessAction(exportPdf, "probed", ["official_api"], null).confidence).toBe(
      probedNoMap.confidence,
    );
  });
});
