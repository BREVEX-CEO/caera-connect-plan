import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkServerLimit, resetServerLimits, type ServerLimitKind } from "../server";

/**
 * THE SERVER-SIDE LIMITS ARE WIRED TO SOMETHING, AND EVERYTHING THAT SPENDS
 * SOMEBODY ELSE'S MONEY IS BEHIND ONE.
 *
 * Re-authored after Phase 2 deleted the version that guarded eight endpoints
 * belonging to retired products. The property is unchanged and the surface is
 * smaller: a policy nothing calls is a limit that does not exist, and an
 * endpoint that reaches a third party without one is a free loop against
 * somebody's quota or sender reputation.
 *
 * The device-local governor this used to sit beside is gone with the products
 * that needed it. What remains is the only kind that was ever a real limit:
 * server-side, keyed by account.
 */

afterEach(() => resetServerLimits());

function sourceFiles(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...sourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

const SOURCES = sourceFiles("src")
  .filter((path) => !path.endsWith("lib/limits/server.ts"))
  .map((path) => ({ path, source: readFileSync(path, "utf8") }));

const KINDS: ServerLimitKind[] = ["billing_write"];

describe("every policy has a caller", () => {
  it.each(KINDS)("%s is enforced somewhere", (kind) => {
    const callers = SOURCES.filter(({ source }) =>
      source.includes(`checkServerLimit("${kind}"`),
    ).map(({ path }) => path);
    expect(callers.length, `no endpoint enforces the ${kind} limit`).toBeGreaterThan(0);
  });

  it("declares no policy the product cannot reach", () => {
    const declared = [
      ...readFileSync("src/lib/limits/server.ts", "utf8").matchAll(/^ {2}(\w+): \{$/gm),
    ].map((match) => match[1]);
    expect(declared.sort()).toEqual([...KINDS].sort());
  });
});

describe("what must be behind a limit", () => {
  it("the payment webhook is, because anybody on the internet can post to it", () => {
    const webhook = readFileSync("src/routes/api/public/payments/webhook.ts", "utf8");
    expect(webhook).toContain('checkServerLimit("billing_write"');
    // Keyed by the SOURCE, not by an account: an unauthenticated caller has no
    // account, and keying by one it supplied would let it pick a fresh bucket.
    expect(webhook).toContain("`webhook:${source}`");
  });
});

describe("the limit itself", () => {
  it("allows ordinary use and refuses a flood, per account", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(checkServerLimit("billing_write", "account-a").allowed).toBe(true);
    }
    const refused = checkServerLimit("billing_write", "account-a");
    expect(refused.allowed).toBe(false);
    expect(refused.headers["retry-after"]).toBeDefined();

    // Another account is untouched: one person cannot lock out everybody.
    expect(checkServerLimit("billing_write", "account-b").allowed).toBe(true);
  });

  it("says when to come back rather than refusing blankly", () => {
    for (let i = 0; i < 20; i += 1) checkServerLimit("billing_write", "account-c");
    const refused = checkServerLimit("billing_write", "account-c");
    expect(refused.allowed).toBe(false);
    expect(refused.decision.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.decision.message).toBeTruthy();
  });
});
