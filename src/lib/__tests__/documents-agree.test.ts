/**
 * TWO "FINAL" DOCUMENTS MAY NOT DISAGREE ABOUT THE SAME MEASURED FACT.
 *
 * The audit report's summary table said the Cowork extension suite covered 52
 * scenarios. Its own section five, two hundred lines further down, said 45 —
 * and the suite, when actually run, printed 69. Three numbers for one
 * measurement in one document, none of them current.
 *
 * That is worse than an out-of-date number, because a reader has no way to
 * tell which one to believe, and a reviewer who checks the first one and stops
 * comes away confident about something false. This test does not decide what
 * the number IS — only the suite can do that — it refuses to let the documents
 * carry two different answers.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const DOCS = [
  "docs/OCADE-AUDIT-REPORT.md",
  "CHECKPOINT.md",
  "README.md",
  "docs/ocade-77-readiness.md",
  "release/OCADE_RELEASE_CHECKLIST.md",
].filter((path) => existsSync(path));

/** Every "<n>/<n> scenarios" claim about the extension suite, by document. */
function scenarioClaims(text: string): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(/(\d+)\s*\/\s*(\d+)\s+scenarios/g)) {
    if (match[1] === match[2]) found.add(Number(match[1]));
  }
  for (const match of text.matchAll(/Cowork\s+—\s+(\d+)\s+scenarios/g)) {
    found.add(Number(match[1]));
  }
  return [...found];
}

describe("the documents agree with each other about the Cowork suite", () => {
  it("states exactly one scenario count across every published document", () => {
    const byDocument = new Map<string, number[]>();
    for (const path of DOCS) {
      const claims = scenarioClaims(readFileSync(path, "utf8"));
      if (claims.length > 0) byDocument.set(path, claims);
    }

    const all = new Set([...byDocument.values()].flat());
    expect(
      [...all],
      `Documents disagree about how many Cowork scenarios exist: ${JSON.stringify(
        Object.fromEntries(byDocument),
      )}. Run \`npm run extension:e2e\`, take the number it prints, and use that one everywhere.`,
    ).toHaveLength(1);
  });

  it("counts the scenarios the suite actually defines, and matches the documents", () => {
    /*
     * The suite's own source is the arbiter. Counting its `scenario(` calls is
     * not the same thing as running it — a scenario can be defined and fail —
     * but it does prove the documented number is not simply invented, and it
     * moves the moment somebody adds or removes a case.
     */
    const suite = readFileSync("extension/tests/cowork-e2e.mjs", "utf8");
    const defined = [...suite.matchAll(/^\s*(?:await\s+)?(?:check|scenario|expect)\(/gm)].length;
    expect(defined).toBeGreaterThan(0);

    const documented = scenarioClaims(readFileSync("docs/OCADE-AUDIT-REPORT.md", "utf8"));
    expect(documented).toHaveLength(1);
    expect(documented[0]).toBe(defined);
  });
});

describe("no document claims an extension capability the manifest cannot back", () => {
  it("does not promise uploads or downloads through the extension", () => {
    const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
    const declared = [...(manifest.permissions ?? []), ...(manifest.optional_permissions ?? [])];
    expect(
      declared.includes("downloads"),
      "The downloads permission is declared again. Either wire chrome.downloads or take it back out — an optional permission is still a prompt somebody is asked to accept.",
    ).toBe(false);
  });
});
