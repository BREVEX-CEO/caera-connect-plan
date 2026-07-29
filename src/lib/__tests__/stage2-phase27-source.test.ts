import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Stage 2 Phase 27 source gate", () => {
  it("keeps unknown-app lifecycle evidence and live-runtime claims synchronized", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/check-stage2-phase27.mjs"], {
        cwd: process.cwd(),
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
