import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const report = JSON.parse(readFileSync("release/OCADE_CAPABILITY_STATUS.json", "utf8"));

describe("lightweight capability status", () => {
  it("uses categorical states without scores or requirement rows", () => {
    expect(report.capabilities).toHaveLength(18);
    expect(JSON.stringify(report)).not.toMatch(
      /"(?:weight|score|percent|numerator|denominator|requirements)"\s*:/i,
    );
  });

  it("is enforced by the development-only capability gate", () => {
    const result = spawnSync(process.execPath, ["scripts/check-capability-status.mjs"], {
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("no weighted score");
    expect(result.stdout).toContain("operational dependency scan: clean");
  });
});
