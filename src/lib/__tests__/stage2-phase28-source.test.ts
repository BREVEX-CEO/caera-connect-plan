import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Stage 2 Phase 28 source gate", () => {
  it("keeps real extension evidence and live Chrome or Edge claims synchronized", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/check-stage2-phase28.mjs"], {
        cwd: process.cwd(),
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
