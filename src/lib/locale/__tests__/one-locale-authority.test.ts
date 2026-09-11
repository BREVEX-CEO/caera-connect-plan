import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

/*
 * ONE ANSWER TO "WHICH LOCALE?", ENFORCED — PLAN.md Phase 18.
 *
 * `format.ts` was written to be that answer and its own header says why: the
 * product had `toLocaleString()` with no argument in fifty-one places, the
 * same thing spelled `toLocaleDateString(undefined, …)` in twelve more, and a
 * hard-coded `"en-GB"` in seven. Every one of those reads the browser or a
 * guess rather than the locale the person chose in Settings.
 *
 * The module shipped and then nothing used it: two support pages, out of
 * seventy-one call sites. A shared authority nobody calls is not an authority,
 * it is a file — so this is the check that keeps the conversion done.
 *
 * WHAT THE DRIFT ACTUALLY COSTS. `9/3/2026` is the third of September to a
 * British or Indian reader and the ninth of March to an American one, and
 * nothing on screen says which. `1,234,567` is unreadable to somebody who
 * groups digits `12,34,567`. Both are wrong answers delivered confidently.
 */

/** Product source. Tests and the locale module itself are the exceptions. */
function productSources(): string[] {
  return globSync("src/**/*.{ts,tsx}").filter(
    (file) =>
      !file.includes("__tests__") &&
      !file.includes("/locale/") &&
      // Donor logic kept verbatim for provenance; it is not a product surface.
      !file.includes("/primary-logic/"),
  );
}

/**
 * A call that formats through the browser instead of the chosen locale.
 *
 * Matched on the source line, with comments stripped: the modules that were
 * converted explain what they used to do, and a comment about a defect is not
 * the defect.
 */
const RAW_LOCALE_CALL = /\.toLocale(?:String|DateString|TimeString)\s*\(/;

function offendingLines(source: string): string[] {
  const lines = source.split("\n");
  const offenders: string[] = [];
  let inBlockComment = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      continue;
    }
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    if (RAW_LOCALE_CALL.test(line)) offenders.push(trimmed);
  }
  return offenders;
}

describe("every date, time and number goes through the locale authority", () => {
  it("has no product source formatting through the browser's locale", () => {
    const offenders: string[] = [];
    for (const file of productSources()) {
      for (const line of offendingLines(readFileSync(file, "utf8"))) {
        offenders.push(`${file}: ${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no hard-coded locale tag outside the authority", () => {
    /*
     * `"en-GB"` in seven places was the other half of the same problem: it is
     * not the browser's guess, it is somebody else's country.
     *
     * THE ONE EXEMPTION, AND WHY IT IS NAMED. A few formatters exist to make a
     * decision rather than to be read — validating a time-zone name, pulling a
     * 24-hour number back out with `parseInt`, inspecting the trailing digits
     * of a price against a rule. A reader's locale would change those strings
     * and break the code that parses them. Each is marked
     * `locale-independent:` with the reason, so an exemption is a sentence
     * somebody wrote rather than a silence.
     */
    const offenders: string[] = [];
    for (const file of productSources()) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (
          !/Intl\.(?:DateTimeFormat|NumberFormat|RelativeTimeFormat)\(\s*["'][a-z]{2}-[A-Z]{2}["']/.test(
            line,
          )
        ) {
          return;
        }
        const nearby = lines.slice(Math.max(0, index - 4), index + 1).join("\n");
        if (!nearby.includes("locale-independent:")) offenders.push(`${file}:${index + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("recognises the shapes it is meant to catch", () => {
    // The detector itself, proven rather than trusted.
    expect(offendingLines(`const x = new Date().toLocaleString();`)).toHaveLength(1);
    expect(offendingLines(`const x = value.toLocaleDateString(undefined, {});`)).toHaveLength(1);
    expect(offendingLines(`const x = value.toLocaleTimeString("en-GB");`)).toHaveLength(1);
    expect(offendingLines(`// it used to call toLocaleString() here`)).toHaveLength(0);
    expect(offendingLines(`/*\n * toLocaleString() was the old way.\n */`)).toHaveLength(0);
    expect(offendingLines(`const x = formatters.dateTime(value);`)).toHaveLength(0);
  });
});
