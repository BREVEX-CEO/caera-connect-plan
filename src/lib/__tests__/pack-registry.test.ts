import { describe, it, expect } from "vitest";
import {
  PackRegistry,
  BUILT_IN_PACKS,
  coverageReport,
  describeCoverage,
  describeUnsupported,
  describeAppLookup,
  CATEGORY_LABELS,
} from "../skills/pack-registry";
import { SKILL_CATEGORIES, matchPack, type SkillPack } from "../skills/skill-pack";

describe("the registry", () => {
  it("ships the built-in packs by default", () => {
    expect(new PackRegistry().list()).toHaveLength(BUILT_IN_PACKS.length);
  });

  it("finds a pack by id and returns null for an unknown one", () => {
    const r = new PackRegistry();
    expect(r.get("ocade.web")?.displayName).toBe("Web pages");
    expect(r.get("adobe.photoshop")).toBeNull();
  });

  /** A lookup must never depend on registration order. */
  it("REPLACES a pack with the same id rather than shadowing it", () => {
    const r = new PackRegistry();
    const before = r.list().length;
    const custom: SkillPack = {
      ...BUILT_IN_PACKS[0],
      displayName: "Replaced",
    };
    r.register(custom);
    expect(r.list()).toHaveLength(before);
    expect(r.get(custom.appId)?.displayName).toBe("Replaced");
  });

  it("adds a genuinely new, usable pack", () => {
    const r = new PackRegistry();
    r.register({
      appId: "acme.tool",
      displayName: "Acme",
      category: "dev_tools",
      testedVersions: [],
      capabilities: [
        {
          id: "status.read",
          label: "Read status",
          methods: ["official_api"],
          mutating: false,
          verifyBy: "api",
          tested: false,
        },
      ],
      requiresLicensedInstall: true,
    });
    expect(r.get("acme.tool")).not.toBeNull();
  });

  it("rejects malformed packs before they can overstate coverage", () => {
    const r = new PackRegistry();
    expect(() =>
      r.register({
        appId: "acme.empty",
        displayName: "Empty",
        category: "dev_tools",
        testedVersions: [],
        capabilities: [],
        requiresLicensedInstall: false,
      }),
    ).toThrow(/capability/i);

    expect(() =>
      r.register({
        appId: "acme.duplicate",
        displayName: "Duplicate",
        category: "dev_tools",
        testedVersions: ["1."],
        capabilities: [
          {
            id: "read",
            label: "Read",
            methods: ["official_api"],
            mutating: false,
            verifyBy: "api",
            tested: true,
          },
          {
            id: "read",
            label: "Different action with the same id",
            methods: ["vision_input"],
            mutating: true,
            verifyBy: "none",
            tested: true,
          },
        ],
        requiresLicensedInstall: false,
      }),
    ).toThrow(/duplicate/i);

    expect(() =>
      r.register({
        appId: "acme:ambiguous",
        displayName: "Ambiguous",
        category: "dev_tools",
        testedVersions: [],
        capabilities: [
          {
            id: "status.read",
            label: "Read status",
            methods: ["official_api"],
            mutating: false,
            verifyBy: "api",
            tested: false,
          },
        ],
        requiresLicensedInstall: false,
      }),
    ).toThrow(/appId/i);
  });

  it("keeps an immutable snapshot instead of trusting caller-owned arrays", () => {
    const custom: SkillPack = {
      appId: "acme.snapshot",
      displayName: "Snapshot",
      category: "dev_tools",
      testedVersions: ["1."],
      capabilities: [
        {
          id: "status.read",
          label: "Read status",
          methods: ["official_api"],
          mutating: false,
          verifyBy: "api",
          tested: true,
        },
      ],
      requiresLicensedInstall: false,
    };
    const r = new PackRegistry([custom]);

    custom.capabilities[0].label = "Caller mutation";
    const listed = r.list();
    listed[0].capabilities[0].tested = false;

    expect(r.get("acme.snapshot")?.capabilities[0]).toMatchObject({
      label: "Read status",
      tested: true,
    });
  });
});

/**
 * The framework is universal; the COVERAGE is not. Reporting a category as
 * supported when nothing is tested would be the exact overclaim this system
 * exists to prevent.
 */
describe("honest coverage reporting", () => {
  const report = coverageReport(new PackRegistry());

  it("reports every promised category, weak ones included", () => {
    expect(report).toHaveLength(SKILL_CATEGORIES.length);
    // A category must be PRESENT whatever its state — an omission reads as
    // "fine" to a user scanning the list.
    for (const category of SKILL_CATEGORIES) {
      expect(report.some((r) => r.category === category)).toBe(true);
    }
  });

  it("marks a category supported ONLY when a tested capability exists", () => {
    for (const row of report) {
      expect(row.supported).toBe(row.testedCapabilities > 0);
    }
  });

  /**
   * The categories whose vendor applications OCADE genuinely cannot drive must
   * be marked format-only — never as full support. This is the assertion that
   * would fail if someone later dropped a `coverageNote` to make a table look
   * greener.
   */
  it("does not claim to drive the applications it cannot", () => {
    const formatOnly = report.filter((r) => r.formatOnly).map((r) => r.category);
    for (const c of [
      "healthcare_imaging",
      "erp_crm_hcm_scm",
      "games_streaming",
      "engineering_cad",
      "finance_commerce",
      "education",
      "graphics_media",
      "chat_projects",
    ]) {
      expect(formatOnly).toContain(c);
    }
  });

  /**
   * The distinction that keeps a green row honest. OCADE reads GeoJSON files;
   * it does not operate SolidWorks. A category covered only by a file-format
   * pack must be reported as such, and must carry the pack's own statement of
   * what it cannot do.
   */
  it("separates file-format coverage from driving the applications", () => {
    const cad = report.find((r) => r.category === "engineering_cad")!;
    expect(cad.supported).toBe(true);
    expect(cad.formatOnly).toBe(true);
    expect(cad.limits.join(" ")).toMatch(/cannot operate SolidWorks/i);

    // Categories with real application adapters are NOT marked format-only.
    expect(report.find((r) => r.category === "dev_tools")!.formatOnly).toBe(false);
    expect(report.find((r) => r.category === "browsers_transfer")!.formatOnly).toBe(false);
  });

  it("every format-only category states what it cannot drive", () => {
    for (const row of report.filter((r) => r.formatOnly)) {
      expect(row.limits.length).toBeGreaterThan(0);
      expect(row.limits.join(" ")).toMatch(/cannot|does not|never/i);
    }
  });

  it("does claim the surfaces that genuinely have tested adapters", () => {
    const supported = report.filter((r) => r.supported).map((r) => r.category);
    expect(supported).toContain("browsers_transfer");
    expect(supported).toContain("os_utilities");
    expect(supported).toContain("office_docs");
    // Git is the one pack whose commands are actually EXECUTED in tests.
    expect(supported).toContain("dev_tools");
    expect(supported).toContain("data_bi_ai");
    expect(supported).toContain("security_networking");
  });

  it("summarises without rounding an unsupported category up", () => {
    const line = describeCoverage(report);
    const supported = report.filter((r) => r.supported).length;
    const formatOnly = report.filter((r) => r.formatOnly).length;

    // The headline number must be the STRONGER claim's count — the categories
    // OCADE genuinely drives — not the total of both kinds.
    expect(line).toContain(`${supported - formatOnly} of ${report.length}`);
    expect(line).not.toContain(`${supported} of ${report.length}`);
    expect(line).toMatch(/say so and offer to inspect/i);
  });

  it("says out loud that format coverage isn't operating the software", () => {
    const line = describeCoverage(report);
    expect(line).toMatch(/file formats/i);
    expect(line).toMatch(/without operating the software itself/i);
  });

  it("gives every category a readable label", () => {
    for (const c of SKILL_CATEGORIES) {
      expect(CATEGORY_LABELS[c].length).toBeGreaterThan(4);
    }
  });
});

/**
 * Every capability marked `tested: true` must be backed by a real test in this
 * repository. This is the claim the whole confidence model rests on.
 */
describe("tested capabilities are genuinely tested", () => {
  it("only the proven surfaces carry tested capabilities", () => {
    const tested = new PackRegistry().testedCapabilities();
    const appIds = new Set(tested.map((t) => t.appId));
    expect(appIds).toEqual(
      new Set([
        "ocade.web",
        "ocade.desktop.files",
        "ocade.desktop.text",
        "ocade.email-web-work",
        "ocade.creative.control",
        "ocade.engineering.control",
        // These two are the packs whose operations are ACTUALLY EXECUTED in tests.
        "git",
        "ocade.files.local",
        "ocade.data",
        "ocade.integrity",
        "tar",
        // Real encoder, real clip: generated, trimmed, cropped, captioned, and
        // the export DECODED frame by frame — see `video-pack.test.ts`.
        "ocade.video.local",
        // File-format packs. Each is exercised by its own test file against
        // real bytes or real text — see the `coverageNote` on each for what it
        // deliberately does NOT claim to do.
        "ocade.geo",
        "ocade.money",
        "ocade.calendar",
        "ocade.media",
        "ocade.records",
        "ocade.clinical",
        "ocade.captions",
        "ocade.streaming",
      ]),
    );
  });

  it("every tested capability declares how it is verified", () => {
    for (const { capability } of new PackRegistry().testedCapabilities()) {
      expect(capability.verifyBy).not.toBe("none");
    }
  });

  it("no built-in capability relies on vision as its only route", () => {
    for (const pack of BUILT_IN_PACKS) {
      for (const c of pack.capabilities) {
        expect(c.methods).not.toEqual(["vision_input"]);
      }
    }
  });
});

/**
 * The companion binary has never been linked in this environment, so the
 * desktop packs must NOT resolve as `verified`.
 */
describe("desktop packs stay honest about the unbuilt companion", () => {
  it("resolve as `probed`, never `verified`", () => {
    const r = new PackRegistry();
    for (const appId of ["ocade.desktop.files", "ocade.desktop.text"]) {
      const m = matchPack({ appId, displayName: "x", version: "1.0" }, r.list());
      expect(m.confidence).toBe("probed");
    }
  });

  it("the web pack IS version-pinned to the extension protocol", () => {
    const m = matchPack(
      { appId: "ocade.web", displayName: "Web pages", version: "1.0" },
      new PackRegistry().list(),
    );
    expect(m.confidence).toBe("verified");
  });
});

describe("what OCADE says about an app it doesn't know", () => {
  it("offers to inspect and explicitly refuses to guess", () => {
    const msg = describeUnsupported("SolidWorks");
    expect(msg).toContain("SolidWorks");
    expect(msg).toMatch(/inspect the app once/i);
    expect(msg).toMatch(/won't act on guesswork/i);
  });
});

/**
 * Looking up a program by name is where an over-claim is most likely to reach
 * a user: they type the name of software they're about to rely on, and read
 * the one sentence that comes back.
 */
describe("answering “what do you know about this program?”", () => {
  const registry = new PackRegistry();

  it("never implies it can drive CAD software", () => {
    for (const app of ["SolidWorks", "AutoCAD", "ArcGIS"]) {
      const answer = describeAppLookup(registry, app);
      expect(answer).toMatch(/doesn't have a tested skill pack/i);
      expect(answer).toMatch(/won't act on guesswork/i);
    }
  });

  /**
   * The subtle case: a search that DOES match a pack, where the pack only
   * handles files. The answer must carry the limit in the same breath, not
   * come back looking like a yes.
   */
  it("attaches the limits when the match is a file-format pack", () => {
    const answer = describeAppLookup(registry, "geospatial");
    expect(answer).toMatch(/covers files rather than the applications themselves/i);
    expect(answer).toMatch(/cannot operate SolidWorks/i);
  });

  it("says plainly when it can operate something directly", () => {
    const answer = describeAppLookup(registry, "Web pages");
    expect(answer).toMatch(/can operate it directly/i);
    expect(answer).not.toMatch(/rather than the applications/i);
  });

  it("returns nothing for an empty query rather than a misleading default", () => {
    expect(describeAppLookup(registry, "   ")).toBe("");
  });
});
