import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Stage 2 Phase 31 source gate", () => {
  it("keeps engineering-control evidence aligned with live-runtime limits", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/check-stage2-phase31.mjs"], {
        cwd: process.cwd(),
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
