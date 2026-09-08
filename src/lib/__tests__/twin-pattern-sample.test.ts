import { describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";

/**
 * The piece that decides whether a table can be attacked at all.
 *
 * `plantRow` must construct a row before the cross-tenant suite can try to read
 * it as the wrong account. When it cannot satisfy a column's regex CHECK, the
 * table is skipped — and the suite reports that in a warning rather than a
 * failure, which is exactly the shape a coverage hole hides in. So the sampler
 * is tested directly, including the patterns it must REFUSE: a string that
 * satisfies the regex it was shown and violates a different constraint would be
 * reported as a mystery insert failure rather than as "not handled".
 */
describe("building a string that satisfies a column's regex", () => {
  it("handles the fixed-length class the billing tables use", () => {
    expect(DatabaseTwin.sampleForPattern("^[A-Z]{3}$")).toBe("AAA");
    expect(DatabaseTwin.sampleForPattern("^[0-9a-f]{64}$")).toBe("0".repeat(64));
  });

  it("handles a sequence of classes, which is what a slug is", () => {
    // The real constraint on ocade_organizations.slug. Until this worked, no
    // organization could be planted, so no membership could be either, and the
    // isolation suite skipped both tables.
    const pattern = "^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$";
    const sample = DatabaseTwin.sampleForPattern(pattern);
    // Three characters, one per class — the shortest the pattern accepts. Which
    // character each class contributes is the sampler's business; that the
    // result SATISFIES the constraint is the requirement.
    expect(sample).toHaveLength(3);
    expect(new RegExp(pattern).test(sample as string)).toBe(true);
  });

  it("takes the shortest count a range allows, not the longest", () => {
    // A longer string risks tripping a separate length constraint on the same
    // column, which would present as an unexplained insert failure.
    expect(DatabaseTwin.sampleForPattern("^[a-z]{2,40}$")).toBe("aa");
    expect(DatabaseTwin.sampleForPattern("^[a-z]+$")).toBe("a");
    expect(DatabaseTwin.sampleForPattern("^[a-z][0-9]*$")).toBe("a");
  });

  it("keeps literal characters that are part of the pattern", () => {
    const sample = DatabaseTwin.sampleForPattern("^[a-z]{2}-[0-9]{2}$");
    expect(sample).toBe("aa-00");
    expect(/^[a-z]{2}-[0-9]{2}$/.test(sample as string)).toBe(true);
  });

  it("refuses anything it does not model, rather than guessing", () => {
    expect(DatabaseTwin.sampleForPattern("^(alpha|beta)$")).toBeNull();
    expect(DatabaseTwin.sampleForPattern("^[^a-z]{3}$")).toBeNull();
    expect(DatabaseTwin.sampleForPattern("^\\d{3}$")).toBeNull();
    expect(DatabaseTwin.sampleForPattern("[a-z]{3}")).toBeNull(); // unanchored
    expect(DatabaseTwin.sampleForPattern("^[a-z$")).toBeNull(); // unterminated class
  });

  it("every sample it returns actually matches the pattern it was given", () => {
    for (const pattern of [
      "^[A-Z]{3}$",
      "^[0-9a-f]{64}$",
      "^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$",
      "^[a-z]{2,40}$",
      "^[a-z]{2}-[0-9]{2}$",
      "^[A-Z][a-z]{4}$",
    ]) {
      const sample = DatabaseTwin.sampleForPattern(pattern);
      expect(sample, pattern).not.toBeNull();
      expect(new RegExp(pattern).test(sample as string), `${pattern} -> ${sample}`).toBe(true);
    }
  });
});
