import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  extractPlanRequirements,
  MISSION_SECTION_STATES,
  validateMissionEvidence,
} from "../mission-evidence";

const plan = readFileSync("PLAN.md", "utf8");

describe("the complete PLAN.md continuation evidence graph", () => {
  it("accounts for every semantic PLAN block with a stable owner and completion target", () => {
    const requirements = extractPlanRequirements(plan);
    expect(requirements.length).toBeGreaterThan(20);
    expect(new Set(requirements.map((item) => item.id)).size).toBe(requirements.length);
    expect(new Set(requirements.map((item) => item.section))).toEqual(
      new Set(MISSION_SECTION_STATES.map((item) => item.section)),
    );
    expect(validateMissionEvidence(requirements, existsSync)).toEqual([]);
    expect(requirements.every((item) => item.remainingAction && item.evidenceTarget)).toBe(true);
  });

  it("is insensitive to checkout line endings", () => {
    const lf = extractPlanRequirements(plan);
    const crlf = extractPlanRequirements(plan.replace(/\r?\n/g, "\r\n"));
    expect(crlf).toEqual(lf);
  });

  it("rejects duplicate requirements and missing authorities", () => {
    const requirements = extractPlanRequirements(plan);
    const broken = {
      ...requirements[0]!,
      currentAuthority: "src/does-not-exist.ts",
    };
    const problems = validateMissionEvidence(
      [requirements[0]!, requirements[0]!, broken],
      existsSync,
    ).join("\n");
    expect(problems).toMatch(/duplicate id/);
    expect(problems).toMatch(/does not exist/);
  });

  it("keeps generated evidence bound to the exact PLAN and every composed ledger", () => {
    const generated = JSON.parse(
      readFileSync("release/checklists/OCADE_MISSION_EVIDENCE.json", "utf8"),
    );
    expect(generated.planSha256).toBe(createHash("sha256").update(plan).digest("hex"));
    expect(generated.summary.planRequirements).toBe(extractPlanRequirements(plan).length);
    expect(generated.summary.parityCapabilities).toBe(31);
    expect(generated.summary.routeRecords).toBe(98);
    expect(generated.summary.remainingGapRecords).toBe(19);
    expect(generated.composedLedgers.donor.records).toBe(2126);
  });
});
