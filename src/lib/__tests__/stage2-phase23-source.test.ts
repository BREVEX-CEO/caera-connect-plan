import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Stage 2 Phase 23 source gate", () => {
  it("keeps the secure generated-code sandbox evidence and runtime claims synchronized", () => {
    const output = execFileSync(process.execPath, ["scripts/check-stage2-phase23.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(output).toContain("Phase 23 gate");
    expect(output).toContain("SECURE PYTHON 0%");
    expect(output).toContain("PHASE 24 WINDOWS COMPANION AND PERMISSION SETUP");
  });
});
