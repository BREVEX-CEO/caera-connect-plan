import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Stage 2 Phase 26 source gate", () => {
  it("keeps universal route evidence and live-runtime claims synchronized", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/check-stage2-phase26.mjs"], {
        cwd: process.cwd(),
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
