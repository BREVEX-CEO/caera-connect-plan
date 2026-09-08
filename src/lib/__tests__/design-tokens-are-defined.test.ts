import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * EVERY DESIGN TOKEN A COMPONENT ASKS FOR EXISTS SOMEWHERE.
 *
 * `--state-danger` did not, and neither did `--warning`. Eight call sites
 * between them — the recording ring on the dictate button, the vault's unlock
 * error, the error line on `/data-rights`, the memory-panel warnings and a
 * caution panel in the workspace — and none of them rendered in the colour they
 * asked for, because a `var()` with no definition and no fallback is invalid at
 * computed-value time. `color` then inherits and a ring falls back to
 * `currentcolor`, so the failure is SILENT: the alert text renders in the wrong
 * colour and the "we are recording" ring stops being red. Nothing in the
 * console, nothing in the build, nothing in a type check, and nothing a
 * screenshot diff would flag as an error rather than a design choice.
 *
 * Both were second names for tokens that already existed — `--destructive` and
 * `--state-warning` — so they were duplicate authorities that were never
 * actually created. That is the shape of the mistake this guards: not a typo
 * inside a value, but a NAME nobody defined.
 *
 * WHERE A TOKEN MAY LEGITIMATELY COME FROM, all three of which count here:
 *   1. `src/styles.css`, which is the palette;
 *   2. the same file, for a self-contained document (the pre-launch shell ships
 *      its own inline stylesheet) or a Tailwind arbitrary property such as
 *      `[--mouse-x:50vw]`;
 *   3. `element.style.setProperty("--x", …)` at runtime, for the values that
 *      follow a pointer or a chosen cursor.
 * Anything else is a reference to nothing.
 */

const CSS = readFileSync("src/styles.css", "utf8");

/** Every custom property declared in a stylesheet or a Tailwind arbitrary property. */
function declarationsIn(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/(^|[;{\s[])(--[a-z0-9-]+)\s*:/gi)) names.add(match[2]);
  return names;
}

/** Every custom property written at runtime, anywhere in the product. */
function runtimeWrites(sources: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const file of sources) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/setProperty\(\s*["'`](--[a-z0-9-]+)/gi)) {
      names.add(match[1]);
    }
  }
  return names;
}

/**
 * Every token a source READS without supplying a fallback.
 *
 * `var(--a, var(--b))` is a read of `--a` WITH a fallback, so only `--b` has to
 * exist. The comma is looked for before the matching close paren rather than
 * matched in one pattern, because the fallback may itself contain parentheses.
 */
function referencedTokens(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
    const after = source.slice((match.index ?? 0) + match[0].length);
    const close = after.indexOf(")");
    const comma = after.indexOf(",");
    const hasFallback = comma >= 0 && (close < 0 || comma < close);
    if (!hasFallback) out.push(match[1]);
  }
  return out;
}

/** Set by a library on its own elements, not by OCADE's palette. */
const LIBRARY_OWNED = /^--(radix|tw)-/;

const SOURCES = globSync("src/**/*.{ts,tsx}").filter(
  (file) => !file.includes("__tests__") && !file.includes("/primary-logic/"),
);
const CSS_TOKENS = declarationsIn(CSS);
const RUNTIME_TOKENS = runtimeWrites(SOURCES);

describe("design tokens", () => {
  it("finds sources to check, so an empty glob cannot pass", () => {
    expect(SOURCES.length).toBeGreaterThan(200);
    expect(CSS_TOKENS.size).toBeGreaterThan(50);
  });

  it("declares every token the stylesheet's own rules read", () => {
    const missing = referencedTokens(CSS).filter(
      (token) => !CSS_TOKENS.has(token) && !RUNTIME_TOKENS.has(token),
    );
    expect([...new Set(missing)]).toEqual([]);
  });

  it("declares every token a component reads", () => {
    const missing: string[] = [];
    for (const file of SOURCES) {
      const source = readFileSync(file, "utf8");
      const local = declarationsIn(source);
      for (const token of referencedTokens(source)) {
        if (LIBRARY_OWNED.test(token)) continue;
        if (CSS_TOKENS.has(token) || RUNTIME_TOKENS.has(token) || local.has(token)) continue;
        missing.push(`${file}: ${token}`);
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});
