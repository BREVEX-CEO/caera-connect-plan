import { describe, expect, it } from "vitest";
import {
  LANDING_MODEL_WARMUP_DELAY_MS,
  landingWarmupDecision,
} from "../landing-model-warmup";

describe("landing local-model warm-up policy", () => {
  it("starts inside a genuine two-second landing visit", () => {
    expect(LANDING_MODEL_WARMUP_DELAY_MS).toBeGreaterThanOrEqual(500);
    expect(LANDING_MODEL_WARMUP_DELAY_MS).toBeLessThan(2000);
  });

  it("starts automatically when online and Web Locks can enforce one engine", () => {
    expect(
      landingWarmupDecision({ online: true, saveData: false, hasWebLocks: true }),
    ).toEqual({ start: true });
  });

  it("respects explicit Save-Data instead of silently burning metered data", () => {
    expect(
      landingWarmupDecision({ online: true, saveData: true, hasWebLocks: true }),
    ).toEqual({ start: false, reason: "save-data" });
  });

  it("waits for connectivity when the first visit is offline", () => {
    expect(
      landingWarmupDecision({ online: false, saveData: false, hasWebLocks: true }),
    ).toEqual({ start: false, reason: "offline" });
  });

  it("refuses an unsafe multi-tab warm-up when Web Locks are unavailable", () => {
    expect(
      landingWarmupDecision({ online: true, saveData: false, hasWebLocks: false }),
    ).toEqual({ start: false, reason: "no-web-locks" });
  });
});
