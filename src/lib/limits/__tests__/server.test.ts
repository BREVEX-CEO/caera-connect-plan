import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { checkServerLimit, limitError, resetServerLimits } from "../server";

/**
 * The endpoints that cost somebody something are limited server-side.
 *
 * The device-local governor is honest that clearing site data resets it, which
 * is fine for work the user's own machine does for the user. It is not fine for
 * an outbound search, a payment endpoint or an outbound email: those consume a
 * third party's quota, a provider's fraud budget or a sender's reputation, and
 * a limit somebody resets with a cookie is not a limit on any of them.
 */

beforeEach(() => resetServerLimits());

const NOW = 1_700_000_000_000;

describe("per account, not per device", () => {
  it("counts one account's calls together", () => {
    for (let i = 0; i < 20; i++) {
      expect(checkServerLimit("research", "user-a", { now: NOW + i }).allowed).toBe(true);
    }
    const other = checkServerLimit("research", "user-b", { now: NOW });
    expect(other.allowed).toBe(true);
    expect(other.decision.windows[0].used).toBe(0);
  });

  it("does not let one account's usage limit another", () => {
    for (let i = 0; i < 130; i++) checkServerLimit("research", "user-a", { now: NOW + i });
    expect(checkServerLimit("research", "user-a", { now: NOW + 200 }).allowed).toBe(false);
    expect(checkServerLimit("research", "user-b", { now: NOW + 200 }).allowed).toBe(true);
  });
});

describe("Retry-After", () => {
  it("is sent when an endpoint refuses, in seconds", () => {
    for (let i = 0; i < 130; i++) checkServerLimit("research", "user-a", { now: NOW + i });
    const refused = checkServerLimit("research", "user-a", { now: NOW + 200 });
    expect(refused.allowed).toBe(false);
    expect(refused.headers["retry-after"]).toMatch(/^\d+$/);
  });

  it("is absent when the call goes through", () => {
    expect(checkServerLimit("research", "user-a", { now: NOW }).headers).toEqual({});
  });

  it("travels on the thrown error, so a caller can back off correctly", () => {
    for (let i = 0; i < 130; i++) checkServerLimit("research", "user-a", { now: NOW + i });
    const refused = checkServerLimit("research", "user-a", { now: NOW + 200 });
    const error = limitError(refused) as Error & { retryAfterSeconds?: number };
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    expect(error.message).toMatch(/Try again/);
  });
});

describe("the quotas match what each endpoint costs", () => {
  it("holds purchase actions to a far tighter budget than reads", () => {
    let writes = 0;
    while (checkServerLimit("billing_write", "user-a", { now: NOW + writes }).allowed) {
      writes += 1;
      if (writes > 500) break;
    }
    let reads = 0;
    while (checkServerLimit("billing_read", "user-b", { now: NOW + reads }).allowed) {
      reads += 1;
      if (reads > 500) break;
    }
    expect(writes).toBeLessThan(reads);
  });

  it("holds outbound email tightest of all", () => {
    let mails = 0;
    while (checkServerLimit("auth_mail", "user-a", { now: NOW + mails }).allowed) {
      mails += 1;
      if (mails > 500) break;
    }
    expect(mails).toBeLessThan(20);
  });
});

describe("the isolate cannot be grown without bound", () => {
  it("evicts rather than tracking every account that ever called", () => {
    /*
     * An isolate that never evicts eventually falls over, which takes the
     * endpoint DOWN rather than limiting it. Eviction weakens the limit for
     * whoever gets dropped; running out of memory removes it for everybody.
     */
    for (let i = 0; i < 10_050; i++) checkServerLimit("research", `user-${i}`, { now: NOW });
    // The earliest accounts have been dropped, so they start fresh.
    expect(checkServerLimit("research", "user-0", { now: NOW }).decision.windows[0].used).toBe(0);
  });
});

describe("what this layer claims about itself", () => {
  it("says plainly that it is not the security boundary", () => {
    /*
     * A Worker isolate is not a shared store: two isolates hold two counters.
     * The file has to say so, because a future reader deciding whether Supabase
     * auth limits are still needed will read this comment and not the runtime.
     */
    const source = readFileSync("src/lib/limits/server.ts", "utf8");
    expect(source).toMatch(/not a security boundary/i);
    expect(source).toMatch(/Supabase enforces/);
  });

  it("is wired into the endpoints that leave the device", () => {
    const research = readFileSync("src/lib/research.functions.ts", "utf8");
    const payments = readFileSync("src/utils/payments.functions.ts", "utf8");
    expect(research).toContain('checkServerLimit("research"');
    expect(payments).toContain('checkServerLimit("billing_read"');
    expect(payments).toContain('checkServerLimit("billing_write"');
  });
});
