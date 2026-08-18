import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  consumesAllowance,
  allowanceState,
  currentWindow,
  CLOUD_ALLOWANCE,
  WINDOW_HOURS,
} from "../ocade-allowance";
import { FREE_LAUNCH_MODE } from "../launch-mode";

/**
 * Historical allowance math is retained for audit/migration compatibility, but
 * OCADE Chat no longer has a cloud-model route and free-launch mode does not
 * meter local inference. These tests make that distinction explicit.
 */
describe("historical allowance math remains internally consistent", () => {
  it("never charges local inference", () => {
    for (const outcome of ["success", "failed", "cancelled", "system_retry"] as const) {
      expect(consumesAllowance("local", outcome)).toBe(false);
    }
  });

  it("keeps the historical counter bounded for old billing records", () => {
    const s = allowanceState(CLOUD_ALLOWANCE + 999);
    expect(s.used).toBe(CLOUD_ALLOWANCE);
    expect(s.remaining).toBe(0);
    expect(CLOUD_ALLOWANCE).toBe(28);
    expect(WINDOW_HOURS).toBe(8);
  });

  it("keeps historical windows deterministic across devices", () => {
    const w = currentWindow(new Date("2026-07-23T09:30:00Z"));
    expect(w.start.toISOString()).toBe("2026-07-23T08:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-07-23T16:00:00.000Z");
  });
});

describe("current OCADE chat never consumes cloud allowance", () => {
  const source = readFileSync(resolve(process.cwd(), "src/routes/api/ocade.chat.ts"), "utf8");

  it("keeps free launch active", () => {
    expect(FREE_LAUNCH_MODE).toBe(true);
  });

  it("retires the old server generation route with HTTP 410", () => {
    expect(source).toContain("status: 410");
    expect(source).toContain('error: "local_only"');
  });

  it("contains no allowance, subscription, provider key, or prompt-forwarding logic", () => {
    expect(source).not.toMatch(/CLOUD_ALLOWANCE|ocade_usage_windows|ocade_subscriptions/i);
    expect(source).not.toMatch(/OPENAI_API_KEY|LOVABLE_API_KEY|api\.openai\.com|ai\.gateway\.lovable\.dev/i);
    expect(source).not.toMatch(/createLovableGateway|createOpenAIDirectGateway/);
  });

  it("does not persist a user turn before local inference because it performs no inference at all", () => {
    expect(source).not.toMatch(/ocade_messages|Persist user message|assistantMessageResult/i);
  });
});
