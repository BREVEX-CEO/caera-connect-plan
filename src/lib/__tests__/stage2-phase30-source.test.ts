import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Stage 2 Phase 30 source gate", () => {
  it("keeps creative-control evidence aligned with live-runtime limits", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/check-stage2-phase30.mjs"], {
        cwd: process.cwd(),
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
