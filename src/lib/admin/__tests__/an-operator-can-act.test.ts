import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { searchableAccountTerm } from "../access.functions";

/**
 * TWO THINGS MADE THE ONE OPERATIONAL TASK IMPOSSIBLE, AND NEITHER FAILED LOUDLY.
 *
 * `ocade_grant_entitlement` requires `aal2`, and nothing in OCADE could create a
 * second factor: `startEnrollment` had no caller anywhere. So an operator opened
 * the grant form, filled it in, pressed the button, and was told the change
 * needed something the product gave them no way to obtain.
 *
 * And the account they were looking for might not have been on the screen at
 * all. The search filtered the 200 newest profiles IN THE BROWSER, so the two
 * hundred and first customer was reported as not existing.
 *
 * Both defects are shapes rather than runtime behaviour — a missing call site
 * and a filter on the wrong side of the network — so both are checked as shapes.
 * The sanitizer below is real logic and is tested as logic.
 */
const ADMIN = readFileSync("src/routes/_authenticated/admin.tsx", "utf8");
const PANEL = readFileSync("src/components/settings/settings-dialog.tsx", "utf8");
const TWO_STEP = readFileSync("src/components/settings/TwoStep.tsx", "utf8");
const ACCESS = readFileSync("src/lib/admin/access.functions.ts", "utf8");

describe("a second factor can be created", () => {
  it("is reachable from Settings, not only from the library that implements it", () => {
    expect(PANEL).toContain("TwoStep");
    expect(TWO_STEP).toContain("startEnrollment");
    expect(TWO_STEP).toContain("verifyEnrollment");
    // An abandoned enrollment leaves an unverified factor against the account's
    // limit, so the screen that creates one also tidies up after itself.
    expect(TWO_STEP).toContain("discardUnverifiedFactors");
  });

  it("tells an operator why a grant would be refused before they try it", () => {
    expect(ADMIN).toContain("currentAssurance");
    expect(ADMIN).toMatch(/two-step verification/i);
  });
});

describe("the account search", () => {
  it("happens on the server, so an older account is still findable", () => {
    // The whole defect in one line: a filter over the rows already fetched.
    expect(ADMIN).not.toMatch(/\.filter\(\s*\(?row/);
    expect(ADMIN).toContain("listAccountAccess({ data: { query: term } })");
    expect(ACCESS).toContain("ilike");
    // An exact id must not be turned into a substring match.
    expect(ACCESS).toContain('accountQuery.eq("id", term)');
  });

  it("neutralises the characters that would change the query rather than the term", () => {
    // `,` and `(` `)` are PostgREST's own filter separators, and `%` and `_` are
    // wildcards: a term carrying them either reshapes the query or matches more
    // than was typed.
    expect(searchableAccountTerm("a,b")).toBe("a b");
    expect(searchableAccountTerm("%")).toBe("");
    expect(searchableAccountTerm("_x_")).toBe("x");
    expect(searchableAccountTerm("me@ocade.in")).toBe("me@ocade.in");
    expect(searchableAccountTerm("  spaced  ")).toBe("spaced");
    expect(searchableAccountTerm("or(id.eq.1)")).toBe("or id.eq.1");
  });
});
