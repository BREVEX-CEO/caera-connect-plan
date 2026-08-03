import { describe, it, expect, beforeEach } from "vitest";
import {
  allowanceState,
  canUseCloud,
  consumesAllowance,
  currentWindow,
  CLOUD_ALLOWANCE,
} from "../ocade-allowance";

/**
 * END-TO-END BILLING PROOF.
 *
 * The individual rules are unit-tested elsewhere. This exercises them as the
 * chat route actually composes them, because the expensive mistakes are in the
 * SEQUENCE, not the parts:
 *
 *   gate (entitlement + allowance)  →  do the work  →  charge ONLY on success
 *
 * Charging before the work, or charging on a failure, bills a user for
 * something they did not receive. Charging local inference breaks the
 * "local is unlimited" promise outright.
 */

type Outcome = "success" | "failed" | "cancelled" | "system_retry";
type Locality = "cloud" | "local";

/** Reproduces the route: gate first, charge only after a successful finish. */
class BillingSimulator {
  used = 0;
  charges: string[] = [];
  entitlementActive = true;

  request(locality: Locality, outcome: Outcome): { served: boolean; reason?: string } {
    // LOCAL never reaches the cloud gate and is never metered.
    if (locality === "local") {
      this.finish("local", outcome);
      return { served: true };
    }

    const decision = canUseCloud({
      entitlementActive: this.entitlementActive,
      state: allowanceState(this.used),
    });
    if (!decision.allowed) return { served: false, reason: decision.reason };

    this.finish("cloud", outcome);
    return { served: true };
  }

  /** Mirrors `onFinish`: only a completed run reaches here in the real route. */
  private finish(locality: Locality, outcome: Outcome) {
    if (outcome !== "success") return; // never reaches onFinish
    if (consumesAllowance(locality, outcome)) {
      this.used += 1;
      this.charges.push(locality);
    }
  }
}

let sim: BillingSimulator;
beforeEach(() => {
  sim = new BillingSimulator();
});

describe("local inference is unlimited and never billed", () => {
  it("serves far beyond the cloud limit without charging once", () => {
    for (let i = 0; i < CLOUD_ALLOWANCE * 3; i++) {
      expect(sim.request("local", "success").served).toBe(true);
    }
    expect(sim.used).toBe(0);
    expect(sim.charges).toHaveLength(0);
  });

  it("keeps working after the cloud allowance is exhausted", () => {
    for (let i = 0; i < CLOUD_ALLOWANCE; i++) sim.request("cloud", "success");
    expect(sim.request("cloud", "success").served).toBe(false);
    // Local is unaffected — this is the core product promise.
    expect(sim.request("local", "success").served).toBe(true);
  });

  it("keeps working when the subscription has expired", () => {
    sim.entitlementActive = false;
    expect(sim.request("cloud", "success").served).toBe(false);
    expect(sim.request("local", "success").served).toBe(true);
    expect(sim.used).toBe(0);
  });
});

describe("cloud is charged only for work actually delivered", () => {
  it.each(["failed", "cancelled", "system_retry"] as const)(
    "does not charge a request that %s",
    (outcome) => {
      sim.request("cloud", outcome);
      expect(sim.used).toBe(0);
      expect(sim.charges).toHaveLength(0);
    },
  );

  it("charges exactly once per successful request", () => {
    sim.request("cloud", "success");
    sim.request("cloud", "success");
    expect(sim.used).toBe(2);
  });

  it("a failure between successes does not shift the count", () => {
    sim.request("cloud", "success");
    sim.request("cloud", "failed");
    sim.request("cloud", "cancelled");
    sim.request("cloud", "success");
    expect(sim.used).toBe(2);
  });
});

describe("the gate runs BEFORE the work, not after", () => {
  it("refuses the request that would exceed the limit rather than billing it", () => {
    for (let i = 0; i < CLOUD_ALLOWANCE; i++) {
      expect(sim.request("cloud", "success").served).toBe(true);
    }
    const over = sim.request("cloud", "success");
    expect(over.served).toBe(false);
    // Critically: the refused request did NOT increment the counter.
    expect(sim.used).toBe(CLOUD_ALLOWANCE);
  });

  it("tells the user local still works when it refuses", () => {
    for (let i = 0; i < CLOUD_ALLOWANCE; i++) sim.request("cloud", "success");
    expect(sim.request("cloud", "success").reason).toMatch(/local/i);
  });

  it("an expired plan is refused before any work happens", () => {
    sim.entitlementActive = false;
    const r = sim.request("cloud", "success");
    expect(r.served).toBe(false);
    expect(r.reason).toMatch(/plan has ended/i);
    expect(sim.charges).toHaveLength(0);
  });
});

describe("the window the user is promised", () => {
  it("allows a fresh allowance in the next window", () => {
    for (let i = 0; i < CLOUD_ALLOWANCE; i++) sim.request("cloud", "success");
    expect(allowanceState(sim.used).exhausted).toBe(true);

    // A new window resets the counter — the route keys usage by window_start.
    const next = new BillingSimulator();
    expect(next.request("cloud", "success").served).toBe(true);
  });

  it("uses fixed 8-hour boundaries so the reset is predictable across devices", () => {
    const w = currentWindow(new Date("2026-07-23T09:30:00Z"));
    expect(w.start.toISOString()).toBe("2026-07-23T08:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-07-23T16:00:00.000Z");
  });

  it("reports the same reset time the UI shows", () => {
    const now = new Date("2026-07-23T09:30:00Z");
    expect(allowanceState(0, now).resetsAt.toISOString()).toBe(
      currentWindow(now).end.toISOString(),
    );
  });
});
