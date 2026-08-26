import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The import report is regenerated, not written.
 *
 * This repository has already carried several import reports, and every one was
 * a snapshot of an intention: counts recorded when a plan was made and never
 * re-derived. One of them described a different archive entirely — a ZIP with a
 * different hash and 2,124 files — while sitting in the same directory as the
 * source it was not about. A stale provenance record is worse than none,
 * because it is the one a reader trusts.
 */

const REPORT = "imports/ocade-primary-logic/INTEGRATION_REPORT.md";
const JSON_REPORT = "imports/ocade-primary-logic/INTEGRATION_REPORT.json";

describe("the current report", () => {
  it("is current — the generator agrees with what is committed", () => {
    // Fails the build the moment the tree moves and the report does not.
    execFileSync(process.execPath, ["scripts/generate-integration-report.mjs", "--check"], {
      encoding: "utf8",
    });
  });

  it("accounts for every file in the archive", () => {
    const report = JSON.parse(readFileSync(JSON_REPORT, "utf8"));
    expect(report.totals.archiveFiles).toBe(2126);
    expect(report.totals.dispositioned).toBe(2126);
  });

  it("reports reach separately from presence, and every module is reached", () => {
    /*
     * The number that matters. A directory full of imported code that nothing
     * imports is not integration, and counting it as such is how "100% used"
     * becomes a figure nobody should believe.
     */
    const report = JSON.parse(readFileSync(JSON_REPORT, "utf8"));
    expect(report.totals.portedModules).toBeGreaterThan(0);
    expect(report.totals.reachedModules).toBe(report.totals.portedModules);
    expect(readFileSync(REPORT, "utf8")).not.toContain("not yet reached");
  });
});

describe("the stale reports are gone", () => {
  it.each([
    "imports/ocade-primary-logic/IMPORT_ANALYSIS.json",
    "imports/ocade-primary-logic/source-metadata/IMPORT_MANIFEST.json",
    "imports/ocade-primary-logic/source-metadata/IMPORT_VALIDATION.json",
  ])("%s no longer sits beside the source it was not about", (path) => {
    expect(existsSync(path)).toBe(false);
  });

  it("keeps the licence, notice and verified provenance of what WAS integrated", () => {
    for (const path of [
      "src/primary-logic/LICENSE.md",
      "src/primary-logic/NOTICE.md",
      "src/primary-logic/provenance.json",
    ]) {
      expect(existsSync(path), path).toBe(true);
    }
    const provenance = JSON.parse(readFileSync("src/primary-logic/provenance.json", "utf8"));
    expect(provenance.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(provenance.licence.rightsHolder).toBe("CARCC CADANE");
  });
});
