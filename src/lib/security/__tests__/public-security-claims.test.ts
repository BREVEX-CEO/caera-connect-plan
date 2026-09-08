import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SECURITY_DISCLOSURE, SECURITY_POSTURE } from "../public-posture";

/**
 * A SECURITY PAGE THAT CANNOT DRIFT INTO FICTION.
 *
 * The dangerous claim on a page like this is not the one somebody invented. It
 * is the one that was TRUE when it was written and stopped being true when a
 * protection was refactored away — because a public security page is the last
 * file anybody thinks to update, and nothing about the product breaks when it
 * goes stale.
 *
 * So every statement names the modules that implement it and a string that must
 * still be in them. Remove the protection and this fails, which is the point:
 * the page cannot keep advertising something OCADE no longer does.
 */

/**
 * Page prose with its line breaks collapsed.
 *
 * JSX prose is wrapped by the formatter, so a sentence in the source is broken
 * across lines at whatever column Prettier chose. Asserting on the raw text
 * makes a rule that passes or fails on formatting — which is how a real
 * assertion turns into a superstition about where the line breaks fall.
 */
function normalise(source: string): string {
  return source.replace(/\s+/g, " ");
}

describe("every public security claim points at something real", () => {
  it("was found at all, so a broken scan cannot pass", () => {
    expect(SECURITY_POSTURE.length).toBeGreaterThan(4);
    const statements = SECURITY_POSTURE.flatMap((group) => group.statements);
    expect(statements.length).toBeGreaterThan(10);
    for (const statement of statements) {
      expect(statement.implementedBy.length).toBeGreaterThan(0);
      expect(statement.evidence.length).toBeGreaterThan(0);
    }
  });

  it.each(SECURITY_POSTURE.flatMap((group) => group.statements.map((s) => [s.claim, s] as const)))(
    "%s",
    (_claim, statement) => {
      for (const file of statement.implementedBy) {
        expect(existsSync(file), `${file} does not exist`).toBe(true);
      }
      const sources = normalise(
        statement.implementedBy.map((file) => readFileSync(file, "utf8")).join("\n"),
      );
      for (const evidence of statement.evidence) {
        expect(
          sources.includes(evidence),
          `no "${evidence}" in ${statement.implementedBy.join(", ")}`,
        ).toBe(true);
      }
    },
  );

  it("has a unique id and a title for every group", () => {
    const ids = SECURITY_POSTURE.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const group of SECURITY_POSTURE) expect(group.title.length).toBeGreaterThan(0);
  });
});

describe("claims PLAN.md §J forbids", () => {
  /*
   * Not a stylistic rule. Every one of these is a statement a reader would
   * reasonably act on — a procurement decision, a compliance sign-off — and
   * OCADE has earned none of them. The page says so explicitly; this makes sure
   * a later edit cannot quietly add one.
   */
  const FORBIDDEN = [
    /\bSOC ?2\b/i,
    /\bISO ?27001\b/i,
    /GDPR[- ]certified/i,
    /HIPAA[- ]compliant/i,
    /\bpenetration test(ed)?\b/i,
    /\bpen[- ]test(ed)?\b/i,
    /zero incidents/i,
    /no incidents have/i,
    /\bmilitary[- ]grade\b/i,
    /\bunhackable\b/i,
    /\b100% secure\b/i,
    /\bbank[- ]grade\b/i,
  ];

  /**
   * Comments and the explicit disclaimers are stripped first: the page's whole
   * point is to NAME the things it does not have, and a scan of raw text would
   * be tripped by the sentence saying "OCADE holds no SOC 2 report".
   */
  function assertableText(source: string): string {
    return normalise(source)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/OCADE holds no[\s\S]*?not an audit of it\./, "");
  }

  it("appear nowhere in the posture data", () => {
    const text = JSON.stringify(SECURITY_POSTURE) + JSON.stringify(SECURITY_DISCLOSURE);
    for (const pattern of FORBIDDEN) {
      expect(pattern.test(text), `${pattern} appeared in a security claim`).toBe(false);
    }
  });

  it("appear nowhere in the page beyond the explicit denial of them", () => {
    const page = assertableText(readFileSync("src/routes/security.tsx", "utf8"));
    for (const pattern of FORBIDDEN) {
      expect(pattern.test(page), `${pattern} appeared on the security page`).toBe(false);
    }
  });

  it("states plainly that no certification or independent test exists", () => {
    const page = normalise(readFileSync("src/routes/security.tsx", "utf8"));
    expect(page).toMatch(/holds no security certification/i);
    expect(page).toMatch(/no independent penetration test/i);
  });

  it("never reads an empty incident history as a clean record", () => {
    const page = normalise(readFileSync("src/routes/security.tsx", "utf8"));
    expect(page).toMatch(/not a claim that there have been no incidents/i);
  });
});

describe("the disclosure route", () => {
  it("offers a channel that actually reaches somebody", () => {
    // The Security ticket category has to exist for this sentence to be true.
    const support = readFileSync("src/routes/_authenticated/settings.support.tsx", "utf8");
    expect(support).toContain('value="security"');
    expect(SECURITY_DISCLOSURE.route).toMatch(/Security ticket/i);
  });

  it("does not publish an email address that has not been verified", () => {
    /*
     * An unread security@ address is worse than none: the reporter believes
     * they have told somebody, and nobody has been told.
     */
    const text = `${SECURITY_DISCLOSURE.route} ${SECURITY_DISCLOSURE.expectations} ${SECURITY_DISCLOSURE.contactStatus}`;
    expect(text).not.toMatch(/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(SECURITY_DISCLOSURE.contactStatus).toMatch(/has been activated and verified/i);
  });

  it("tells reporters not to send credentials", () => {
    expect(SECURITY_DISCLOSURE.expectations).toMatch(/recovery codes/i);
    expect(SECURITY_DISCLOSURE.expectations).toMatch(/private keys/i);
  });
});
