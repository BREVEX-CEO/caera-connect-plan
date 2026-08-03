import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Stage 2 Phase 25 source gate", () => {
  it("keeps perception evidence and live-runtime claims synchronized", () => {
    const output = execFileSync(process.execPath, ["scripts/check-stage2-phase25.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(output).toContain("Phase 25 gate");
    expect(output).toContain("LIVE DESKTOP 0%");
    expect(output).toContain("PHASE 26 UNIVERSAL ROUTE SELECTOR");
  });
});
