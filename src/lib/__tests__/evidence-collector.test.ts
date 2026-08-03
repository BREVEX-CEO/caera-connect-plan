import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/**
 * Evidence collector honesty.
 *
 * `npm run evidence:collect` produces the single artefact a reader uses to judge
 * where this project stands. Its value depends entirely on one property: an
 * UNRUN check must never be presentable as a passing one.
 *
 * The collector distinguishes three outcomes — passed, failed, not_attempted —
 * and these tests pin that distinction, plus the specific classification bug
 * that was found and fixed while building it: `cargo test` failing at the LINK
 * step is "the assertions never ran", NOT "the assertions failed". Those are
 * different facts and reporting one as the other would be a fabrication.
 */

const SOURCE = "scripts/collect-evidence.mjs";
const REPORT = "release/OCADE_EVIDENCE_REPORT.json";

const source = readFileSync(SOURCE, "utf8");

interface Check {
  id: string;
  status: "passed" | "failed" | "not_attempted";
  evidence?: string;
  reason?: string;
  humanAction?: string;
}
interface Report {
  generatedAt: string;
  repository: { branch: string; head: string };
  summary: { passed: number; failed: number; notAttempted: number; verdict: string };
  checks: Check[];
  note: string;
}

describe("the collector separates unrun from passed", () => {
  it("has three distinct outcomes", () => {
    expect(source).toContain('status: "passed"');
    expect(source).toContain('status: "failed"');
    expect(source).toContain('status: "not_attempted"');
  });

  it("counts only genuine failures toward the exit code", () => {
    // An unrun check must not fail the command, and must not pass it either.
    expect(source).toMatch(/process\.exit\(failed\.length === 0 \? 0 : 1\)/);
  });

  it("never derives a completion percentage", () => {
    // A percentage would blend "ran and passed" with "never ran". Comments are
    // stripped first: the file explains WHY it avoids percentages, and that
    // explanation must not be mistaken for the thing it warns against.
    const executable = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    expect(executable).not.toMatch(/percent|Percentage|\* 100/);
  });

  it("classifies a link failure by the FULL output, not the summary line", () => {
    // cargo's closing line is "could not compile (lib test)"; the linker cause
    // appears further up. Matching only the last line misreported "could not
    // link" as "assertions failed".
    expect(source).toMatch(/rustTest\.raw/);
    expect(source).toContain("linking with");
    expect(source).toContain("linker");
  });

  it("strips the raw output before writing, so the report stays reviewable", () => {
    expect(source).toMatch(/checks\.map\(\(\{ raw, \.\.\.rest \}\) => rest\)/);
  });

  it("gives every not_attempted check a reason AND a human action", () => {
    const calls = [...source.matchAll(/notAttempted\(/g)];
    expect(calls.length).toBeGreaterThan(4);
    // The helper signature enforces it structurally.
    expect(source).toMatch(/function notAttempted\(id, description, reason, humanAction\)/);
  });
});

describe("the generated report", () => {
  const hasReport = existsSync(REPORT);

  it.runIf(hasReport)("records branch and HEAD alongside the results", () => {
    const report = JSON.parse(readFileSync(REPORT, "utf8")) as Report;
    expect(report.repository.branch.length).toBeGreaterThan(0);
    expect(report.repository.head).toMatch(/^[0-9a-f]{7,40}$/);
    expect(Date.parse(report.generatedAt)).not.toBeNaN();
  });

  it.runIf(hasReport)("keeps the three counts consistent with the check list", () => {
    const report = JSON.parse(readFileSync(REPORT, "utf8")) as Report;
    const { passed, failed, notAttempted } = report.summary;
    expect(passed + failed + notAttempted).toBe(report.checks.length);
    expect(report.checks.filter((c) => c.status === "passed")).toHaveLength(passed);
    expect(report.checks.filter((c) => c.status === "not_attempted")).toHaveLength(notAttempted);
  });

  it.runIf(hasReport)("never labels a not_attempted check as evidence of success", () => {
    const report = JSON.parse(readFileSync(REPORT, "utf8")) as Report;
    for (const check of report.checks.filter((c) => c.status === "not_attempted")) {
      expect(check.reason, `${check.id} has no reason`).toBeTruthy();
      expect(check.humanAction, `${check.id} has no human action`).toBeTruthy();
      expect(check.evidence).toBeUndefined();
    }
  });

  it.runIf(hasReport)("states plainly that not_attempted is not a pass", () => {
    const report = JSON.parse(readFileSync(REPORT, "utf8")) as Report;
    expect(report.note).toMatch(/not a pass/i);
  });

  it.runIf(hasReport)("does not claim success when something failed", () => {
    const report = JSON.parse(readFileSync(REPORT, "utf8")) as Report;
    if (report.summary.failed > 0) {
      expect(report.summary.verdict).toMatch(/FAILED/);
    } else {
      expect(report.summary.verdict).toMatch(/attempted/i);
    }
  });
});

describe("device- and credential-gated work is declared, not hidden", () => {
  for (const id of [
    "supabase-apply",
    "browser-extension-runtime",
    "android-runtime",
    "ios-runtime",
    "voice-runtime",
  ]) {
    it(`declares ${id} rather than omitting it`, () => {
      expect(source).toContain(`"${id}"`);
    });
  }
});
