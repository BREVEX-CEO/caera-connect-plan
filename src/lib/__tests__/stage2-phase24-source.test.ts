import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Stage 2 Phase 24 source gate", () => {
  it("keeps Windows companion source evidence and runtime claims synchronized", () => {
    const output = execFileSync(process.execPath, ["scripts/check-stage2-phase24.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(output).toContain("Phase 24 gate");
    expect(output).toContain("SIGNED COMPANION 0%");
    expect(output).toContain("PHASE 25 PERCEPTION SET-OF-MARK AND STATE FINGERPRINTS");
  });
});
