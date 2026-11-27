/**
 * Item 136: nothing on the customer-facing site promises what cannot be verified. A fixed list of
 * absolute or unprovable phrases may not appear in the files that hold customer wording; a phrase a
 * file legitimately needs goes in `allowed` with the reason.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const BANNED: [string, RegExp][] = [
  ["a guarantee", /\bguarantee[ds]?\b/i],
  ["100 percent", /\b100\s?%(?!\s*(?:of the viewport|width|height))/i],
  ["never fails", /\bnever\s+(?:fails?|breaks?|makes?\s+mistakes?|wrong)\b/i],
  ["always works", /\balways\s+works?\b/i],
  ["perfect", /\bperfect(?:ly)?\b/i],
  ["flawless", /\bflawless(?:ly)?\b/i],
  ["risk free", /\brisk[- ]free\b/i],
  [
    "any app",
    /\b(?:works with|control|controls|use|uses)\s+(?:any|every|all)\s+(?:app|application|program)s?\b/i,
  ],
  ["bank grade", /\b(?:bank|military)[- ]grade\b/i],
  ["fully autonomous", /\bfully\s+autonomous\b/i],
];
/** file -> phrase names it may contain, with the reason. */
const allowed: Record<string, string[]> = {
  // Disclaimers: the wording denies a guarantee or perfect operation, it does not give one.
  "src/components/legal/LegalContent.tsx": ["a guarantee", "perfect"],
  // "These are OCADE's own rule checks, not a guarantee either way."
  "src/jarvis/JarvisPanels.tsx": ["a guarantee"],
};

const roots = ["src/routes", "src/components", "src/jarvis", "public"];
const skip = (path: string) =>
  path.includes("/admin") || path.includes("/_authenticated/admin") || path.endsWith(".json");
const files = (folder: string): string[] =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx|html|md|txt)$/.test(name) && !skip(path) ? [path] : [];
  });

test("customer wording holds no absolute or unprovable promise", () => {
  const found: string[] = [];
  let checked = 0;
  for (const file of roots.flatMap(files)) {
    checked += 1;
    const text = readFileSync(file, "utf8");
    for (const [name, pattern] of BANNED) {
      if (pattern.test(text) && !(allowed[file] ?? []).includes(name))
        found.push(`${file}: ${name}`);
    }
  }
  assert.ok(checked > 40, `only ${checked} files were checked`);
  assert.deepEqual(found, []);
});

test("the phrase list does catch what it names", () => {
  for (const [sample, name] of [
    ["We guarantee your files are safe", "a guarantee"],
    ["JARVIS never fails", "never fails"],
    ["Works with any app on your computer", "any app"],
    ["Bank-grade security", "bank grade"],
  ] as const) {
    assert.ok(
      BANNED.some(([n, p]) => n === name && p.test(sample)),
      sample,
    );
  }
});
