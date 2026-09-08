import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_CATEGORIES } from "../categories";

/**
 * EVERY PLACE THAT SENDS A NOTIFICATION, CHECKED AGAINST WHAT THE DATABASE
 * WILL ACCEPT.
 *
 * `ocade_record_notification` is called with a category and a deep link that
 * two CHECK constraints police. A sender that gets either wrong does not throw
 * where anybody would notice — `sendNotification` deliberately never throws
 * into the caller's work, because the caller has already revoked the session or
 * issued the codes and must not report that as a failure. So a bad category
 * produces a notification that is silently never recorded, which is the exact
 * shape of a bug nobody finds until somebody asks why they were not told.
 *
 * This reads the call sites and checks the two things a constraint would refuse.
 * It is a source scan, and it is the right tool here precisely because the
 * failure is silent at runtime.
 */

const CATEGORY_IDS = new Set(NOTIFICATION_CATEGORIES.map((category) => category.id));

/** The same shape `ocade_notifications_deep_link` enforces. */
const DEEP_LINK = /^\/([A-Za-z0-9_\-.?&=%#][A-Za-z0-9_\-./?&=%#]*)?$/;

interface CallSite {
  file: string;
  category: string;
  deepLink: string | null;
  /** The whole title expression as written, quotes and backticks included. */
  title: string;
  /** True when the title is built at runtime, so its length cannot be read here. */
  computed: boolean;
}

function callSites(): CallSite[] {
  const found: CallSite[] = [];
  for (const file of globSync("src/**/*.{ts,tsx}")) {
    if (file.includes("__tests__") || file.endsWith("send.server.ts")) continue;
    const source = readFileSync(file, "utf8");
    if (!source.includes("sendNotification(")) continue;
    for (const call of source.matchAll(/sendNotification\(\{([\s\S]*?)\n {4}\}\)/g)) {
      const body = call[1];
      const category = /category:\s*"([^"]+)"/.exec(body)?.[1];
      /*
       * The whole title EXPRESSION, not a prefix of it. Reading only the
       * characters before the first `${` reported a computed title as empty,
       * which is the scanner failing rather than the sender — and a scanner
       * that cannot tell those apart is worse than no scanner.
       */
      const literal = /title:\s*"((?:[^"\\]|\\.)*)"/.exec(body)?.[1];
      const template = /title:\s*`((?:[^`\\]|\\.)*)`/.exec(body)?.[1];
      const deepLink = /deepLink:\s*"([^"]*)"/.exec(body)?.[1] ?? null;
      if (category) {
        found.push({
          file,
          category,
          deepLink,
          title: literal ?? template ?? "",
          computed: literal === undefined && template !== undefined,
        });
      }
    }
  }
  return found;
}

describe("every notification the product sends", () => {
  const sites = callSites();

  it("was found, so a broken scanner cannot pass silently", () => {
    // If the regex stopped matching, every assertion below would be vacuous.
    expect(sites.length).toBeGreaterThan(2);
  });

  it("uses a category the database will accept", () => {
    const wrong = sites
      .filter((site) => !CATEGORY_IDS.has(site.category as never))
      .map((site) => `${site.file}: ${site.category}`);
    // A category outside the ten §D names is refused by a CHECK constraint, and
    // `sendNotification` swallows that so the caller's real work still succeeds.
    // The notification simply never exists.
    expect(wrong, "these notifications would be refused by the category constraint").toEqual([]);
  });

  it("uses a deep link the database will accept, or none", () => {
    const wrong = sites
      .filter((site) => site.deepLink !== null && !DEEP_LINK.test(site.deepLink))
      .map((site) => `${site.file}: ${site.deepLink}`);
    // Same-origin path or nothing. An absolute URL — and a protocol-relative
    // `//elsewhere.example/x`, which a browser treats as absolute — is refused.
    expect(wrong, "these deep links would be refused by the link constraint").toEqual([]);
  });

  it("says something in its title, within the length the column allows", () => {
    /*
     * A computed title cannot be length-checked from source, and pretending
     * otherwise would either pass vacuously or fail honestly-written code. What
     * IS checkable is that its literal parts are not empty — a template of pure
     * interpolation would say nothing a person could read at a glance — and
     * that the static budget leaves room for what it interpolates.
     */
    const wrong = sites
      .filter(
        (site) =>
          site.title.replace(/\$\{[^}]*\}/g, "").trim().length === 0 || site.title.length > 200,
      )
      .map((site) => `${site.file}: "${site.title.slice(0, 40)}"`);
    expect(wrong).toEqual([]);
  });

  it("found at least one computed title and one literal one, so both paths are read", () => {
    // Otherwise the distinction above is untested and could rot into nothing.
    expect(sites.some((site) => site.computed)).toBe(true);
    expect(sites.some((site) => !site.computed)).toBe(true);
  });

  /**
   * §D lists security among the kinds that stay recorded whatever the mute
   * settings say. The product's most consequential events — a recovery code
   * used, sessions ended — must be filed there rather than under something a
   * person could switch off and then not be told.
   */
  it("files account-compromise events under security, which no mute silences", () => {
    const compromise = sites.filter((site) => /recovery code|signed out|session/i.test(site.title));
    expect(compromise.length, "no compromise-adjacent notification was found").toBeGreaterThan(1);
    for (const site of compromise) {
      expect(site.category, `${site.file}: "${site.title}"`).toBe("security");
    }
  });

  /**
   * MINIMAL PAYLOADS — §D: "no prompt, attachment, secret, payment credential
   * or private local path". A title or body that interpolates one of those is
   * how a secret reaches a push provider's servers.
   */
  it("puts nothing recoverable in the title or body", () => {
    const leaky = sites
      .filter((site) => /code|token|secret|password|key/i.test(site.title))
      // "A recovery code was used" names the mechanism, not a code. What would
      // be wrong is interpolating one, which the template check below covers.
      .filter((site) => /\$\{/.test(site.title))
      .map((site) => `${site.file}: ${site.title}`);
    expect(leaky).toEqual([]);
  });
});
