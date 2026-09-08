import { describe, expect, it } from "vitest";
import {
  AllowanceExhausted,
  CommercialGenerationGate,
  type AcquireRequest,
  type CommercialUsageLedger,
} from "@/lib/commercial/generation-gate";
import {
  ALLOWANCES,
  MINIMUM_WORK,
  SESSION_WINDOW_MS,
  windowFor,
  type UsageWindow,
  type WorkMeasurement,
} from "@/lib/commercial/usage-policy";

const key = (window: UsageWindow) => `${window.kind}:${window.startsAt}`;

/**
 * A ledger that behaves exactly like the atomic RPCs: it refuses over the
 * allowance, and it floors releases at zero.
 */
function testLedger(seed: Record<string, number> = {}) {
  const rows = new Map<string, number>(Object.entries(seed));
  const calls: string[] = [];

  const ledger: CommercialUsageLedger = {
    async read(_userId, windows) {
      const out = new Map<string, number>();
      for (const window of windows) out.set(key(window), rows.get(key(window)) ?? 0);
      return out;
    },
    async reserve({ window, amount, allowance }) {
      calls.push(`reserve ${key(window)} ${amount}`);
      const next = (rows.get(key(window)) ?? 0) + amount;
      if (allowance !== null && next > allowance) throw new AllowanceExhausted(window);
      rows.set(key(window), next);
    },
    async release({ window, amount }) {
      calls.push(`release ${key(window)} ${amount}`);
      rows.set(key(window), Math.max(0, (rows.get(key(window)) ?? 0) - amount));
    },
  };

  return { ledger, rows, calls };
}

const ANCHOR = 1_700_000_000_000;
const NOW = ANCHOR + 60_000;
const SESSION = windowFor("session", ANCHOR, NOW);
const WEEK = windowFor("week", ANCHOR, NOW);

function request(over: Partial<AcquireRequest> = {}): AcquireRequest {
  return {
    userId: "user-1",
    tier: "pro",
    anchoredAt: ANCHOR,
    now: NOW,
    idempotencyKey: "req-1",
    ...over,
  };
}

const nothing: WorkMeasurement = {
  billableInputTokens: 0,
  visibleOutputTokens: 0,
  readToolBatches: 0,
  sideEffectActions: 0,
};

describe("nothing routes without a permit", () => {
  it("reserves before answering, not after", () => {
    /*
     * Charging afterwards means an exhausted account still reaches a backend:
     * it does the work, it costs whatever it costs, and only then is the
     * person told they had nothing left.
     */
    const { ledger, calls } = testLedger();
    return new CommercialGenerationGate(ledger).acquire(request()).then((result) => {
      expect(result.ok).toBe(true);
      expect(calls.filter((c) => c.startsWith("reserve"))).toHaveLength(2);
    });
  });

  it("reserves the floor rather than guessing what the request will cost", async () => {
    const { ledger, rows } = testLedger();
    const result = await new CommercialGenerationGate(ledger).acquire(request());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.permit.reserved).toBe(MINIMUM_WORK);
    expect(rows.get(key(SESSION))).toBe(MINIMUM_WORK);
  });

  it("reserves a whole use on Free, because half a use does not exist", async () => {
    const { ledger, rows } = testLedger();
    const result = await new CommercialGenerationGate(ledger).acquire(request({ tier: "free" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.permit.reserved).toBe(1);
    expect(rows.get(key(SESSION))).toBe(1);
  });

  it("holds the reservation against BOTH windows", async () => {
    const { ledger, rows } = testLedger();
    await new CommercialGenerationGate(ledger).acquire(request());
    expect(rows.get(key(SESSION))).toBe(MINIMUM_WORK);
    expect(rows.get(key(WEEK))).toBe(MINIMUM_WORK);
  });
});

describe("an exhausted allowance is refused before any backend is touched", () => {
  it("refuses when the session is spent, and says when it returns", async () => {
    const { ledger, calls } = testLedger({ [key(SESSION)]: ALLOWANCES.pro.session });
    const result = await new CommercialGenerationGate(ledger).acquire(request());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("allowance_exhausted");
      expect(result.exhausted).toBe("session");
      expect(result.resetsAt).toBe(SESSION.endsAt);
    }
    // Nothing was reserved, so nothing has to be given back.
    expect(calls.filter((c) => c.startsWith("reserve"))).toHaveLength(0);
  });

  it("refuses when the WEEK is spent even though the session has room", async () => {
    const { ledger } = testLedger({ [key(WEEK)]: ALLOWANCES.pro.week! });
    const result = await new CommercialGenerationGate(ledger).acquire(request());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.exhausted).toBe("week");
  });

  it("refuses Free at exactly 28 uses, not at 27", async () => {
    const { ledger } = testLedger({ [key(SESSION)]: 27 });
    const gate = new CommercialGenerationGate(ledger);
    // The twenty-eighth is allowed.
    expect((await gate.acquire(request({ tier: "free", idempotencyKey: "a" }))).ok).toBe(true);
    // The twenty-ninth is not.
    const refused = await gate.acquire(request({ tier: "free", idempotencyKey: "b" }));
    expect(refused.ok).toBe(false);
  });

  it("gives back a reservation the OTHER window then refused", async () => {
    /*
     * The session took it and the week refused. Without the unwind, a refused
     * request quietly costs the person their session allowance anyway.
     */
    const { ledger, rows } = testLedger({ [key(WEEK)]: ALLOWANCES.pro.week! });
    const result = await new CommercialGenerationGate(ledger).acquire(request());
    expect(result.ok).toBe(false);
    expect(rows.get(key(SESSION)) ?? 0).toBe(0);
  });

  it("loses the race at the ledger rather than in whichever process read first", async () => {
    /*
     * Two requests can both read "one left" and both pass the advisory check.
     * The ledger's reserve is atomic and refuses the second.
     */
    const { ledger } = testLedger({ [key(SESSION)]: ALLOWANCES.pro.session - MINIMUM_WORK });
    const gate = new CommercialGenerationGate(ledger);
    const [first, second] = await Promise.all([
      gate.acquire(request({ idempotencyKey: "race-a" })),
      gate.acquire(request({ idempotencyKey: "race-b" })),
    ]);
    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    const loser = first.ok ? second : first;
    expect(loser.ok).toBe(false);
    if (!loser.ok) expect(loser.reason).toBe("allowance_exhausted");
  });
});

describe("one logical request is charged once", () => {
  it("gives a duplicate submission the SAME permit rather than a second reservation", async () => {
    /*
     * A double-clicked send, a retried submit and a reconnecting client all
     * arrive with the same key. Charging per delivery attempt charges the
     * person for OCADE's transport rather than for their question.
     */
    const { ledger, rows } = testLedger();
    const gate = new CommercialGenerationGate(ledger);
    const first = await gate.acquire(request());
    const second = await gate.acquire(request());
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.permit).toBe(first.permit);
    expect(rows.get(key(SESSION))).toBe(MINIMUM_WORK);
  });

  it("charges nothing at all for a failure", async () => {
    const { ledger, rows } = testLedger();
    const result = await new CommercialGenerationGate(ledger).acquire(request());
    if (!result.ok) throw new Error("expected a permit");
    await result.permit.release("failed");
    expect(rows.get(key(SESSION))).toBe(0);
    expect(rows.get(key(WEEK))).toBe(0);
  });

  it("charges nothing for a cancellation before any output reached the person", async () => {
    const { ledger, rows } = testLedger();
    const result = await new CommercialGenerationGate(ledger).acquire(request());
    if (!result.ok) throw new Error("expected a permit");
    await result.permit.release("cancelled_before_output");
    expect(rows.get(key(SESSION))).toBe(0);
  });

  it("survives a double release without crediting the account twice", async () => {
    const { ledger, rows } = testLedger({ [key(SESSION)]: 10, [key(WEEK)]: 10 });
    const result = await new CommercialGenerationGate(ledger).acquire(request());
    if (!result.ok) throw new Error("expected a permit");
    await result.permit.release("failed");
    await result.permit.release("abandoned");
    // Back to the ten that were already spent, not below them.
    expect(rows.get(key(SESSION))).toBe(10);
  });

  it("does not settle a finalised permit a second time", async () => {
    const { ledger, rows } = testLedger();
    const result = await new CommercialGenerationGate(ledger).acquire(request());
    if (!result.ok) throw new Error("expected a permit");
    const measurement = { ...nothing, visibleOutputTokens: 2000 };
    await result.permit.finalize(measurement);
    const after = rows.get(key(SESSION));
    await result.permit.finalize(measurement);
    expect(rows.get(key(SESSION))).toBe(after);
  });

  it("ignores a release that arrives after the answer was delivered", async () => {
    const { ledger, rows } = testLedger();
    const result = await new CommercialGenerationGate(ledger).acquire(request());
    if (!result.ok) throw new Error("expected a permit");
    await result.permit.finalize({ ...nothing, visibleOutputTokens: 2000 });
    await result.permit.release("abandoned");
    expect(rows.get(key(SESSION))).toBe(2);
  });

  it("frees the key once settled, so a genuinely new request is charged again", async () => {
    const { ledger, rows } = testLedger();
    const gate = new CommercialGenerationGate(ledger);
    const first = await gate.acquire(request());
    if (!first.ok) throw new Error("expected a permit");
    await first.permit.release("failed");
    const second = await gate.acquire(request());
    expect(second.ok).toBe(true);
    expect(rows.get(key(SESSION))).toBe(MINIMUM_WORK);
  });
});

describe("settling against what was measured", () => {
  it("tops the reservation up to the real cost", async () => {
    const { ledger, rows } = testLedger();
    const result = await new CommercialGenerationGate(ledger).acquire(request());
    if (!result.ok) throw new Error("expected a permit");
    const total = await result.permit.finalize({ ...nothing, visibleOutputTokens: 4000 });
    expect(total).toBe(4);
    expect(rows.get(key(SESSION))).toBe(4);
    expect(rows.get(key(WEEK))).toBe(4);
  });

  it("gives back the difference when the request cost less than the floor reserved", async () => {
    // Nothing costs less than the floor, so this is the equal case: the
    // reservation stands and nothing moves.
    const { ledger, rows } = testLedger();
    const result = await new CommercialGenerationGate(ledger).acquire(request());
    if (!result.ok) throw new Error("expected a permit");
    const total = await result.permit.finalize(nothing);
    expect(total).toBe(MINIMUM_WORK);
    expect(rows.get(key(SESSION))).toBe(MINIMUM_WORK);
  });

  it("charges Free one use however heavy the answer turned out to be", async () => {
    const { ledger, rows } = testLedger();
    const result = await new CommercialGenerationGate(ledger).acquire(request({ tier: "free" }));
    if (!result.ok) throw new Error("expected a permit");
    await result.permit.finalize({ ...nothing, visibleOutputTokens: 100_000 });
    expect(rows.get(key(SESSION))).toBe(1);
  });

  it("lets a permitted request finish even when it overruns the allowance", async () => {
    /*
     * A request that was allowed to start must be allowed to finish and be
     * charged honestly. Refusing the top-up would leave the person with an
     * answer they received and did not pay for; refusing it mid-answer would
     * be worse. The overrun takes the NEXT request below the line instead.
     */
    const { ledger, rows } = testLedger({
      [key(SESSION)]: ALLOWANCES.pro.session - MINIMUM_WORK,
    });
    const gate = new CommercialGenerationGate(ledger);
    const result = await gate.acquire(request());
    if (!result.ok) throw new Error("expected a permit");
    await result.permit.finalize({ ...nothing, visibleOutputTokens: 10_000 });
    expect(rows.get(key(SESSION))).toBeGreaterThan(ALLOWANCES.pro.session);

    const next = await gate.acquire(request({ idempotencyKey: "after-overrun" }));
    expect(next.ok).toBe(false);
  });
});

describe("windows", () => {
  it("charges a request in the window it started in", async () => {
    const { ledger, rows } = testLedger();
    const gate = new CommercialGenerationGate(ledger);
    await gate.acquire(request({ idempotencyKey: "early" }));

    // A request in the next window lands on a different row entirely.
    const later = NOW + SESSION_WINDOW_MS;
    await gate.acquire(request({ idempotencyKey: "late", now: later }));

    const lateWindow = windowFor("session", ANCHOR, later);
    expect(lateWindow.startsAt).not.toBe(SESSION.startsAt);
    expect(rows.get(key(SESSION))).toBe(MINIMUM_WORK);
    expect(rows.get(key(lateWindow))).toBe(MINIMUM_WORK);
  });

  it("records against Free's week even though it has no weekly allowance", async () => {
    /*
     * The account's own usage screen is built from these rows, and a window
     * that is not enforced is still a window somebody may want to see.
     */
    const { ledger, rows } = testLedger();
    await new CommercialGenerationGate(ledger).acquire(request({ tier: "free" }));
    expect(rows.get(key(WEEK))).toBe(1);
  });
});

describe("the durable production permit lifecycle", () => {
  function durableLedger() {
    let status: "empty" | "reserved" | "succeeded" = "empty";
    let acquired = 0;
    let finalized = 0;
    const ledger: CommercialUsageLedger = {
      async read() {
        throw new Error("the durable gate must not use the legacy read path");
      },
      async reserve() {
        throw new Error("the durable gate must not reserve window-by-window");
      },
      async release() {
        throw new Error("the durable gate must not release window-by-window");
      },
      async acquirePermit() {
        acquired += 1;
        if (status === "succeeded") {
          return {
            permitId: "durable-permit",
            outcome: "duplicate_completed",
            reserved: 2,
            sessionResetAt: SESSION.endsAt,
            weekResetAt: WEEK.endsAt,
          };
        }
        status = "reserved";
        return {
          permitId: "durable-permit",
          outcome: "granted",
          reserved: MINIMUM_WORK,
          sessionResetAt: SESSION.endsAt,
          weekResetAt: WEEK.endsAt,
        };
      },
      async finalizePermit() {
        finalized += 1;
        status = "succeeded";
        return 2;
      },
      async releasePermit() {
        status = "empty";
        return true;
      },
    };
    return { ledger, counts: () => ({ acquired, finalized }) };
  }

  it("survives a server-instance change and still settles exactly once", async () => {
    const shared = durableLedger();
    const firstServer = new CommercialGenerationGate(shared.ledger);
    const secondServer = new CommercialGenerationGate(shared.ledger);
    const first = await firstServer.acquire(request());
    const retry = await secondServer.acquire(request());
    expect(first.ok && retry.ok).toBe(true);
    if (!retry.ok) throw new Error("expected the durable retry to recover the permit");
    await retry.permit.finalize({ ...nothing, visibleOutputTokens: 2_000 });

    const afterRestart = await new CommercialGenerationGate(shared.ledger).acquire(request());
    expect(afterRestart).toMatchObject({ ok: false, reason: "duplicate_completed" });
    expect(shared.counts()).toEqual({ acquired: 3, finalized: 1 });
  });

  it("uses the reset instant returned by the atomic database decision", async () => {
    const ledger: CommercialUsageLedger = {
      async read() {
        return new Map();
      },
      async reserve() {},
      async release() {},
      async acquirePermit() {
        return {
          permitId: null,
          outcome: "week_exhausted",
          reserved: 0,
          sessionResetAt: 111,
          weekResetAt: 222,
        };
      },
    };
    await expect(new CommercialGenerationGate(ledger).acquire(request())).resolves.toEqual({
      ok: false,
      reason: "allowance_exhausted",
      exhausted: "week",
      resetsAt: 222,
    });
  });
});
