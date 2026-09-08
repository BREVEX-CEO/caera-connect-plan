import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  REMAINING_PRODUCT_GAPS,
  validateGapLedger,
  type RemainingProductGap,
} from "../remaining-gaps";

/**
 * THE LEDGER'S RULES, EACH PROVEN TO REJECT WHAT IT CLAIMS TO REJECT.
 *
 * PLAN.md §P lists eight conditions that must FAIL verification. A validator
 * that returns an empty list for every input satisfies the letter of that and
 * none of the point, so each rule below is handed an entry that breaks it and
 * asserted to complain — the only way to know a rule exists.
 */

const VALID: RemainingProductGap = {
  id: "AREA-001",
  area: "An area",
  requirement: "Something specific the product must do.",
  discoveredFrom: "Reading the tree and finding nothing that does it.",
  existingAuthority: "src/lib/release/remaining-gaps.ts",
  disposition: "COMPLETE",
  status: "IMPLEMENTED",
  implementationEvidence: ["src/lib/release/remaining-gaps.ts"],
  testEvidence: [],
  runtimeEvidence: [],
  lastVerifiedAt: "2026-09-03",
};

/** Pretend every path the tests invent exists, except ones marked missing. */
const exists = (path: string) => !path.includes("does-not-exist");

function problemsFor(overrides: Partial<RemainingProductGap>): string[] {
  return validateGapLedger([{ ...VALID, ...overrides }], exists);
}

describe("the ledger validator", () => {
  it("accepts a well-formed entry, so the rules below mean something", () => {
    expect(validateGapLedger([VALID], exists)).toEqual([]);
  });

  it("rejects a duplicate gap", () => {
    expect(validateGapLedger([VALID, VALID], exists).join()).toMatch(/duplicate id/);
  });

  it("rejects a missing authority on anything claimed as built", () => {
    expect(problemsFor({ existingAuthority: null }).join()).toMatch(
      /without an existing authority/,
    );
    expect(problemsFor({ existingAuthority: "src/does-not-exist.ts" }).join()).toMatch(
      /does not exist/,
    );
  });

  it("rejects a missing reason", () => {
    expect(problemsFor({ discoveredFrom: "because" }).join()).toMatch(/discoveredFrom/);
    expect(problemsFor({ requirement: "do it" }).join()).toMatch(/requirement/);
  });

  it("rejects an implemented claim with no implementation evidence", () => {
    // §P: "Do not mark IMPLEMENTED from file existence."
    expect(problemsFor({ implementationEvidence: [] }).join()).toMatch(
      /without implementation evidence/,
    );
  });

  it("rejects a runtime claim without runtime evidence", () => {
    expect(
      problemsFor({
        status: "RUNTIME-PROVEN",
        testEvidence: ["src/x.test.ts"],
        runtimeEvidence: [],
      }).join(),
    ).toMatch(/RUNTIME-PROVEN without runtime evidence/);
  });

  it("rejects a tested claim without tests", () => {
    expect(problemsFor({ status: "TESTED", testEvidence: [] }).join()).toMatch(
      /without test evidence/,
    );
  });

  it("rejects a MISSING gap that is also claiming proof", () => {
    expect(
      problemsFor({
        status: "MISSING",
        existingAuthority: null,
        implementationEvidence: [],
        runtimeEvidence: ["a browser run"],
      }).join(),
    ).toMatch(/MISSING but citing runtime evidence/);
  });

  it("rejects an external blocker whose repository work is unfinished", () => {
    expect(
      problemsFor({
        status: "EXTERNALLY-BLOCKED",
        externalBlocker: {
          dependency: "A provider account",
          exactReason: "Nobody has created one yet.",
          repositoryWorkComplete: false,
          unavailableUiVerified: true,
        },
      }).join(),
    ).toMatch(/repository work still incomplete/);
  });

  it("rejects an external blocker whose interface still claims availability", () => {
    expect(
      problemsFor({
        status: "EXTERNALLY-BLOCKED",
        externalBlocker: {
          dependency: "A provider account",
          exactReason: "Nobody has created one yet.",
          repositoryWorkComplete: true,
          unavailableUiVerified: false,
        },
      }).join(),
    ).toMatch(/still claims availability/);
  });

  it("rejects an external blocker that names no exact dependency or reason", () => {
    expect(
      problemsFor({
        status: "EXTERNALLY-BLOCKED",
        externalBlocker: {
          dependency: "x",
          exactReason: "no",
          repositoryWorkComplete: true,
          unavailableUiVerified: true,
        },
      }).join(),
    ).toMatch(/exact dependency/);
  });

  it("rejects EXTERNALLY-BLOCKED with no blocker at all, and a blocker on anything else", () => {
    expect(problemsFor({ status: "EXTERNALLY-BLOCKED" }).join()).toMatch(
      /without an externalBlocker/,
    );
    expect(
      problemsFor({
        externalBlocker: {
          dependency: "A provider account",
          exactReason: "Nobody has created one yet.",
          repositoryWorkComplete: true,
          unavailableUiVerified: true,
        },
      }).join(),
    ).toMatch(/not EXTERNALLY-BLOCKED/);
  });

  it("rejects evidence that cites a path which is not there", () => {
    expect(problemsFor({ implementationEvidence: ["src/does-not-exist.ts"] }).join()).toMatch(
      /cites missing/,
    );
  });

  it("accepts runtime evidence that describes a run rather than a file", () => {
    // "npm run audit:routes:prod, 816/816" is a thing that happened. Demanding a
    // path for it would push people towards citing a file that proves less.
    expect(
      problemsFor({
        status: "RUNTIME-PROVEN",
        testEvidence: ["src/lib/release/remaining-gaps.ts"],
        runtimeEvidence: ["npm run audit:routes:prod, 816/816"],
      }),
    ).toEqual([]);
  });

  it("rejects a malformed id or date", () => {
    expect(problemsFor({ id: "whatever" }).join()).toMatch(/id must look like/);
    expect(problemsFor({ lastVerifiedAt: "yesterday" }).join()).toMatch(/ISO date/);
  });
});

describe("the ledger this repository actually ships", () => {
  it("passes its own rules against the real file system", () => {
    expect(validateGapLedger(REMAINING_PRODUCT_GAPS, (path) => existsSync(path))).toEqual([]);
  });

  it("was found at all, so an empty ledger cannot pass as a clean one", () => {
    expect(REMAINING_PRODUCT_GAPS.length).toBeGreaterThan(0);
  });

  it("has a generated report that matches it", () => {
    /*
     * PLAN.md §P: "Fail verification for a stale generated report." The
     * byte-for-byte comparison lives in the generator's `--check` mode, which
     * CI runs; this asserts the report exists at the two paths §P names, so a
     * deleted ledger cannot pass by having nothing to compare.
     */
    expect(existsSync("release/checklists/OCADE_REMAINING_PRODUCT_GAPS.json")).toBe(true);
    expect(existsSync("release/checklists/OCADE_REMAINING_PRODUCT_GAPS.md")).toBe(true);
  });
});
