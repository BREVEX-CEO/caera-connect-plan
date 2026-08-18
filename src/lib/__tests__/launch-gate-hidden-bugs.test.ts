import { describe, expect, it } from "vitest";
import { evaluateLaunchGate, LAUNCH_AT_MS } from "../launch/launch-window";

describe("launch gate hidden regressions", () => {
  it("does not use the historical calendar date as a production timer", () => {
    const before = evaluateLaunchGate({
      now: LAUNCH_AT_MS - 10_000,
      hostname: "ocade.example",
      env: { OCADE_LAUNCH_READY: "true", NODE_ENV: "production" },
    });
    const after = evaluateLaunchGate({
      now: LAUNCH_AT_MS + 10_000,
      hostname: "ocade.example",
      env: { OCADE_LAUNCH_READY: "true", NODE_ENV: "production" },
    });
    expect(before.open).toBe(true);
    expect(after.open).toBe(true);
  });

  it("does not let an internal-looking Host header bypass readiness in production", () => {
    const result = evaluateLaunchGate({
      now: Date.now(),
      hostname: "localhost",
      env: { OCADE_LAUNCH_READY: "false", NODE_ENV: "production" },
    });
    expect(result.open).toBe(false);
    expect(result.reason).toBe("locked_not_ready");
  });

  it("still allows a real development localhost preview", () => {
    const result = evaluateLaunchGate({
      now: Date.now(),
      hostname: "localhost",
      env: { OCADE_LAUNCH_READY: "false", NODE_ENV: "development" },
    });
    expect(result).toMatchObject({ open: true, reason: "open_internal_preview", internal: true });
  });

  it("allows an explicitly configured production preview without relying on Host", () => {
    const result = evaluateLaunchGate({
      now: Date.now(),
      hostname: "ocade.example",
      env: {
        OCADE_LAUNCH_READY: "false",
        OCADE_LAUNCH_PREVIEW: "true",
        NODE_ENV: "production",
      },
    });
    expect(result).toMatchObject({ open: true, reason: "open_internal_preview", internal: true });
  });
});
