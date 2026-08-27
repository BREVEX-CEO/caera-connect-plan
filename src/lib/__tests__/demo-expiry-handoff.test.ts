import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * THE LAST SCREEN OF THE DEMO IS THE FIRST SCREEN OF THE PRODUCT.
 *
 * When the twenty-eight minutes run out, the demo stops and hands the visitor
 * to /auth. What happened at that moment used to be a toast and a generic
 * sign-in page still headed "Welcome to" — an introduction, offered to
 * somebody who had just spent half an hour inside the thing being introduced,
 * next to a cheerful invitation to try the demo they had provably just used
 * up. This is the wrong note to end on, and it is the note a visitor decides
 * on.
 *
 * These are source assertions rather than rendered ones on purpose: what is
 * being protected is the WIRING between two files — the search parameter the
 * demo sends and the branch /auth takes when it arrives. A render test of
 * either file alone would pass with the wire cut.
 */

const AUTH = readFileSync(join("src", "routes", "auth.tsx"), "utf8");
const DEMO = readFileSync(join("src", "routes", "demo.ocade.tsx"), "utf8");

describe("the demo hands off to the account screen", () => {
  it("sends a reason, not a sentence, when the clock runs out", () => {
    expect(DEMO).toMatch(/reason:\s*"demo-expired"/);
  });

  it("sends the same reason when the browser is inside its reset window", () => {
    // Both exits — expired mid-session, and blocked before it could start —
    // land on the same screen. A visitor who cannot start a demo is in the
    // same position as one whose demo just ended.
    const occurrences = DEMO.match(/reason:\s*"demo-expired"/g) ?? [];
    expect(occurrences.length).toBe(2);
  });

  it("no longer clears the demo by way of a toast that outlives the page", () => {
    // The navigation is `replace`, so back does not re-enter a demo that has
    // already had its state torn down.
    expect(DEMO).toMatch(/to:\s*"\/auth",\s*\n\s*search:\s*\{\s*next:\s*"\/home",\s*reason/);
    expect(DEMO).toMatch(/replace:\s*true/);
  });

  it("still stops execution and drops every trace before it navigates", () => {
    const expire = DEMO.slice(DEMO.indexOf("const handleExpire"));
    const body = expire.slice(0, expire.indexOf("}, [engine, navigate]);"));
    expect(body).toContain("engine.stop()");
    expect(body).toContain("setTurns([])");
    expect(body).toContain("ledgerRef.current = []");
    expect(body).toContain("treeRef.current = emptyTree()");
    // Nothing in the teardown writes anything back to storage.
    expect(body).not.toMatch(/localStorage|setItem/);
  });
});

describe("the account screen recognises where the visitor came from", () => {
  it("accepts the reason as a validated search parameter", () => {
    expect(AUTH).toMatch(/reason:\s*z\.enum\(\["demo-expired"\]\)\.optional\(\)/);
  });

  it("stops introducing itself to somebody who has already used the product", () => {
    expect(AUTH).toContain('fromExpiredDemo ? "Continue with OCADE"');
    expect(AUTH).toMatch(/Your 28-minute demo has ended/);
  });

  it("explains what an account keeps, in place of the small notice chip", () => {
    expect(AUTH).toContain("Your demo has ended");
    expect(AUTH).toMatch(/saves nothing/);
    // The generic notice path survives for every other caller of /auth.
    expect(AUTH).toMatch(/\) : notice \? \(/);
  });

  it("does not invite a browser to start a demo it cannot start", () => {
    expect(AUTH).toContain("readNextEligibleAt");
    expect(AUTH).toMatch(/demoResetsIn \?/);
    expect(AUTH).toMatch(/The demo is available again in \{demoResetsIn\}/);
  });

  it("reads the reset clock monotonically, so winding it back changes nothing", () => {
    // observeNow is the same high-water reading the demo gate itself uses.
    expect(AUTH).toMatch(/observeNow\(Date\.now\(\)\)/);
    expect(AUTH).not.toMatch(/formatResetRemaining\(nextEligibleAt,\s*Date\.now\(\)\)/);
  });

  it("keeps the eligibility read off the server render", () => {
    // readNextEligibleAt touches localStorage; it belongs in an effect.
    const start = AUTH.indexOf("const [demoResetsIn");
    const effect = AUTH.slice(start, start + 400);
    expect(effect).toContain("useEffect(");
    expect(effect.indexOf("useEffect(")).toBeLessThan(effect.indexOf("readNextEligibleAt"));
  });
});
