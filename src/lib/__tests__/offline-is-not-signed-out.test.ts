import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The two gates that made a local-first assistant unusable without internet.
 *
 * Both were asking the cloud a question the cloud could not usefully answer,
 * and both are the kind of line that gets re-added by someone tidying up
 * inconsistent middleware. So they are pinned here.
 *
 * Source-read on purpose: the failure is the PRESENCE of a network call on a
 * path that must not need one. Proving that at runtime means standing up a
 * browser, a Supabase project and a severed network to watch a redirect that
 * should not happen. The line itself is the thing to guard.
 */

const GUARD = readFileSync("src/routes/_authenticated/route.tsx", "utf8");
const RUNTIME = readFileSync("src/lib/local-runtime.functions.ts", "utf8");

describe("a dropped network does not sign the user out", () => {
  it("falls back to the persisted session when the auth server is unreachable", () => {
    /*
     * `getUser()` VALIDATES a token over the network; `getSession()` reads the
     * one already stored. Only the second can answer with the wifi off, and
     * every chat route lives under this layout -- so without the fallback, a
     * local model running on the user's own machine became unreachable the
     * moment their connection dropped.
     */
    expect(GUARD).toContain("supabase.auth.getSession()");
    expect(GUARD).toMatch(/offline\s*=\s*true/);
  });

  it("still refuses an EXPIRED cached session without asking anybody", () => {
    // Offline grace covers unreachability, never expiry. Expiry is a timestamp
    // and needs no network to evaluate, so there is no excuse for honouring it.
    expect(GUARD).toContain("expires_at");
    expect(GUARD).toMatch(/expiresAt\s*>\s*Date\.now\(\)/);
  });

  it("does not send someone back through onboarding because their wifi dropped", () => {
    // The gate is a database read. Someone past onboarding must not be pushed
    // back into it, and someone who has not finished it cannot finish it
    // offline anyway, since onboarding writes to that same database.
    expect(GUARD).toContain("if (!offline) {");
  });
});

describe("starting a loopback engine is not a cloud operation", () => {
  it("does not gate local runtime control behind the remote auth server", () => {
    /*
     * These carried `requireSupabaseAuth`, which validates a bearer against
     * the auth server -- so "start the model on my own computer" required
     * internet. `authoriseControl()` is the gate the rest of the machine-
     * control surface uses, and it answers from the request's own origin.
     */
    // The USAGE, not the word: the comment above these handlers explains why
    // the middleware was removed, and that explanation is worth keeping.
    expect(RUNTIME).not.toContain(".middleware([requireSupabaseAuth])");
    expect(RUNTIME).toContain("authoriseControl");
  });

  it("keeps the engine pinned to loopback", () => {
    // The offline guarantee rests on the engine being local. A configurable
    // host would quietly turn a private product into a networked one.
    expect(RUNTIME).toContain("LOOPBACK_HOST");
  });
});
