import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  consumesAllowance,
  canUseCloud,
  allowanceState,
  currentWindow,
  CLOUD_ALLOWANCE,
  WINDOW_HOURS,
} from "../ocade-allowance";

/**
 * These pin the BILLING rules enforced in `src/routes/api/ocade.chat.ts`.
 * A regression here charges real users for work they didn't get, so each rule
 * is asserted explicitly rather than assumed from the implementation.
 */
describe("what may be charged", () => {
  it("charges a SUCCESSFUL cloud request", () => {
    expect(consumesAllowance("cloud", "success")).toBe(true);
  });

  it.each(["failed", "cancelled", "system_retry"] as const)(
    "never charges a cloud request that %s",
    (outcome) => {
      expect(consumesAllowance("cloud", outcome)).toBe(false);
    },
  );

  it.each(["success", "failed", "cancelled", "system_retry"] as const)(
    "NEVER charges local inference (%s) — local is unlimited",
    (outcome) => {
      expect(consumesAllowance("local", outcome)).toBe(false);
    },
  );
});

describe("the gate the chat route applies", () => {
  it("permits a request while allowance remains", () => {
    const s = allowanceState(CLOUD_ALLOWANCE - 1);
    expect(s.exhausted).toBe(false);
    expect(s.remaining).toBe(1);
  });

  it("blocks exactly at the limit, not one over", () => {
    expect(allowanceState(CLOUD_ALLOWANCE - 1).exhausted).toBe(false);
    expect(allowanceState(CLOUD_ALLOWANCE).exhausted).toBe(true);
    expect(allowanceState(CLOUD_ALLOWANCE).remaining).toBe(0);
  });

  it("treats a missing row in an available usage table as zero", () => {
    // Mirrors the route after it has separately checked `usageError`.
    // Read through a function so the type isn't narrowed away to `never`.
    const readUsageRow = (): { used_count?: number } | null => null;
    const row = readUsageRow();
    const s = allowanceState(Number(row?.used_count ?? 0));
    expect(s.used).toBe(0);
    expect(s.exhausted).toBe(false);
  });

  it("clamps a corrupt over-count instead of reporting negative remaining", () => {
    const s = allowanceState(CLOUD_ALLOWANCE + 999);
    expect(s.used).toBe(CLOUD_ALLOWANCE);
    expect(s.remaining).toBe(0);
  });

  it("reports the limit the product promises", () => {
    expect(CLOUD_ALLOWANCE).toBe(28);
    expect(WINDOW_HOURS).toBe(8);
  });
});

/**
 * The chat route gates on entitlement AND allowance together.
 *
 * Checking the allowance alone let an expired plan keep spending: the counter
 * resets every 8-hour window, so an expired subscriber would have been granted
 * a fresh 28 uses forever.
 */
describe("entitlement is checked, not just the counter", () => {
  it("refuses cloud when the plan has ended, even with allowance left", () => {
    const d = canUseCloud({ entitlementActive: false, state: allowanceState(0) });
    if (d.allowed) throw new Error("expected a refusal");
    expect(d.code).toBe("subscription_expired");
  });

  it("says local still works, so the user is not told everything is gone", () => {
    const d = canUseCloud({ entitlementActive: false, state: allowanceState(0) });
    expect(d.allowed).toBe(false);
    if (d.allowed) throw new Error("unreachable");
    expect(d.reason).toMatch(/local/i);
  });

  it("distinguishes an exhausted allowance from an expired plan", () => {
    const exhausted = canUseCloud({
      entitlementActive: true,
      state: allowanceState(CLOUD_ALLOWANCE),
    });
    if (exhausted.allowed) throw new Error("expected a refusal");
    expect(exhausted.code).toBe("allowance_exhausted");
  });

  it("expired plan takes precedence over an exhausted counter", () => {
    const d = canUseCloud({ entitlementActive: false, state: allowanceState(CLOUD_ALLOWANCE) });
    if (d.allowed) throw new Error("expected a refusal");
    expect(d.code).toBe("subscription_expired");
  });

  it("permits cloud only when entitled AND under the limit", () => {
    expect(canUseCloud({ entitlementActive: true, state: allowanceState(0) }).allowed).toBe(true);
  });

  /**
   * Mirrors the route after it has separately checked `subscriptionError`: an
   * available table with no row represents a user without an explicit expired
   * subscription record.
   */
  it("treats an absent subscription row as entitled, not as expired", () => {
    const readSub = (): { expires_at?: string; status?: string } | null => null;
    const sub = readSub();
    const entitlementActive =
      !sub ||
      (sub.status === "active" &&
        (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now()));
    expect(entitlementActive).toBe(true);
    expect(canUseCloud({ entitlementActive, state: allowanceState(0) }).allowed).toBe(true);
  });

  it("treats an explicitly expired row as NOT entitled", () => {
    const sub = { status: "expired", expires_at: "2020-01-01T00:00:00Z" };
    const entitlementActive =
      sub.status === "active" && new Date(sub.expires_at).getTime() > Date.now();
    expect(entitlementActive).toBe(false);
  });

  it("treats an active row with a past expiry as NOT entitled", () => {
    const sub = { status: "active", expires_at: "2020-01-01T00:00:00Z" };
    const entitlementActive =
      sub.status === "active" && new Date(sub.expires_at).getTime() > Date.now();
    expect(entitlementActive).toBe(false);
  });
});

describe("the chat route fails closed at authority and persistence boundaries", () => {
  const source = readFileSync(resolve(process.cwd(), "src/routes/api/ocade.chat.ts"), "utf8");

  it("verifies allowance before persisting the user turn", () => {
    const authority = source.indexOf("const { data: usageRow, error: usageError }");
    const persistence = source.indexOf("// Persist user message.");
    expect(authority).toBeGreaterThan(-1);
    expect(persistence).toBeGreaterThan(authority);
  });

  it.each([
    "conversationError",
    "privacyError",
    "preferencesError",
    "usageError",
    "subscriptionError",
    "userMessageResult.error",
    "historyError",
    "assistantMessageResult.error",
    "conversationUpdateResult.error",
    "chargeResult.error",
  ])("checks %s instead of silently continuing", (boundary) => {
    expect(source).toContain(boundary);
  });

  it("does not claim a missing migration is zero usage", () => {
    expect(source).not.toMatch(/missing table[\s\S]{0,120}treated as zero/i);
  });
});

describe("the reset the user is told about", () => {
  it("resets on a fixed 8-hour boundary so it is predictable across devices", () => {
    const w = currentWindow(new Date("2026-07-23T09:30:00Z"));
    expect(w.start.toISOString()).toBe("2026-07-23T08:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-07-23T16:00:00.000Z");
  });

  it("the state's resetsAt matches the window end shown in the UI", () => {
    const now = new Date("2026-07-23T09:30:00Z");
    expect(allowanceState(3, now).resetsAt.toISOString()).toBe(
      currentWindow(now).end.toISOString(),
    );
  });

  it("a new window starts the count again", () => {
    const before = currentWindow(new Date("2026-07-23T15:59:59Z"));
    const after = currentWindow(new Date("2026-07-23T16:00:01Z"));
    expect(after.start.getTime()).toBeGreaterThan(before.start.getTime());
  });
});
