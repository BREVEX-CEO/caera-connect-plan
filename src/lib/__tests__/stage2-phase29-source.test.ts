import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Stage 2 Phase 29 source gate", () => {
  it("keeps email and authenticated web evidence aligned with live-runtime limits", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/check-stage2-phase29.mjs"], {
        cwd: process.cwd(),
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
