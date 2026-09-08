import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

/**
 * The import report is regenerated, not written.
 *
 * The JSONL ledger is refreshed from a hash-verified disposable extraction.
 * Normal verification then checks every record and regenerates both report
 * views from it, without requiring the raw archive in the shipped source tree.
 */

const REPORT = "imports/ocade-primary-logic/INTEGRATION_REPORT.md";
const JSON_REPORT = "imports/ocade-primary-logic/INTEGRATION_REPORT.json";
const LEDGER = "imports/ocade-primary-logic/OCADE_PRIMARY_LOGIC_DISPOSITION.jsonl";
const ARCHIVE_SHA256 = "FD831F6C817AF1DBADCD6CBC67EC17CD11D0A8EDB7E01343FA60766FF11B17CD";

function records() {
  return readFileSync(LEDGER, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

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
    expect(report.archive.sha256).toBe(ARCHIVE_SHA256);
    expect(report.totals.uncompressedBytes).toBe(33_940_440);
    expect(report.totals.sourceGraphFiles).toBe(2104);
    expect(report.totals.donorReachable).toBe(1830);
    expect(report.totals.donorUnreachable).toBe(274);
    expect(report.totals.brokenRelativeImportOccurrences).toBe(623);
    expect(report.totals.brokenRelativeImportPairs).toBe(498);
  });

  it("keeps one complete final disposition per unique archive path", () => {
    const ledger = records();
    expect(ledger).toHaveLength(2126);
    expect(new Set(ledger.map((record) => record.archivePath)).size).toBe(2126);
    for (const record of ledger) {
      expect(record.archiveSha256).toBe(ARCHIVE_SHA256);
      expect(record.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(["KEEP", "FIX", "COMPLETE", "MERGE", "REPLACE", "REMOVE"]).toContain(
        record.finalDisposition,
      );
      expect(record.exactReason.length).toBeGreaterThan(20);
      expect(record.verificationTest).toBeTruthy();
      if (["MERGE", "REPLACE"].includes(record.finalDisposition)) {
        expect(record.currentOcadeEquivalent).toBeTruthy();
        expect(existsSync(record.canonicalDestination)).toBe(true);
        expect(record.requiredTests).toContain(record.verificationTest);
      }
    }
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

  it("rejects a duplicate ledger record instead of generating a plausible report", () => {
    const lines = readFileSync(LEDGER, "utf8").trimEnd().split(/\r?\n/);
    const path = join(tmpdir(), `ocade-donor-ledger-duplicate-${process.pid}.jsonl`);
    try {
      writeFileSync(path, `${lines.join("\n")}\n${lines[0]}\n`, "utf8");
      const result = spawnSync(
        process.execPath,
        ["scripts/generate-integration-report.mjs", "--check", "--ledger", path],
        { encoding: "utf8" },
      );
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("duplicate or empty archivePath");
    } finally {
      rmSync(path, { force: true });
    }
  });

  it("refuses to refresh immutable facts from an archive with the wrong identity", () => {
    const path = join(tmpdir(), `ocade-wrong-donor-${process.pid}.rar`);
    try {
      writeFileSync(path, "not the verified archive", "utf8");
      const result = spawnSync(
        process.execPath,
        ["scripts/generate-donor-disposition.mjs", "--archive", path, "--archive-root", "."],
        { encoding: "utf8" },
      );
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("Archive identity mismatch");
    } finally {
      rmSync(path, { force: true });
    }
  });
});

describe("the stale reports are gone", () => {
  it.each([
    "imports/ocade-primary-logic/IMPORT_ANALYSIS.json",
    "imports/ocade-primary-logic/source-metadata/IMPORT_MANIFEST.json",
    "imports/ocade-primary-logic/source-metadata/IMPORT_VALIDATION.json",
    "imports/ocade-primary-logic/CURRENT_SOURCE_REVIEW.md",
    "imports/ocade-primary-logic/source/README.md",
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
