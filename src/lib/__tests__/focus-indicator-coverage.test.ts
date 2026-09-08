import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY TEXT CONTROL SHOWS WHERE THE FOCUS IS.
 *
 * `outline-none` removes the browser's own focus ring, which is the only
 * indicator a control has by default. Removing it and putting nothing back is
 * the single most common way a product becomes unusable with a keyboard, and it
 * is invisible to everybody who uses a mouse — including, usually, whoever
 * wrote it.
 *
 * The accessibility run found two of these on rendered pages and could only
 * find them on the routes it walks. This finds them everywhere, from the
 * source, which is the only way to cover a form that needs a particular state
 * to appear at all — a recovery-code field, a device rename, a command palette.
 *
 * THE DESIGN SYSTEM ALREADY DOES IT RIGHT. `components/ui/input.tsx` and
 * `textarea.tsx` carry `focus-visible:ring`, so a control built from those is
 * correct by construction; this rule is about the raw elements that bypass them.
 *
 * A BORDER TINT IS NOT AN INDICATOR. `focus:border-primary` alone is a hue
 * change on one pixel — hard to see, invisible to some readers, and the same
 * "meaning carried by colour alone" this product refuses elsewhere. It does not
 * satisfy this rule.
 */

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
      continue;
    }
    if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Raw form elements written as JSX, with their attributes. */
function rawControls(source: string): string[] {
  return [...source.matchAll(/<(input|textarea|select)\b[\s\S]{0,900}?\/>/g)].map((m) => m[0]);
}

const HAS_RING = /focus-visible:ring|focus:ring|\bring-1\b|\bring-2\b/;

describe("focus indicators", () => {
  const files = sourceFiles("src");

  it("finds the source at all, so a broken scan cannot pass", () => {
    expect(files.length).toBeGreaterThan(150);
    const controls = files.flatMap((file) => rawControls(readFileSync(file, "utf8")));
    expect(controls.length).toBeGreaterThan(20);
  });

  it("never removes the browser's focus ring without providing one", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      /*
       * A ring drawn on a WRAPPER counts, and is sometimes the only correct
       * answer: a transparent, borderless input inside a bordered box has no
       * visible edge of its own, so `focus-within` puts the indicator on the
       * thing a person can actually see.
       */
      const wrapperRing = /focus-within:ring|peer-focus-visible:ring/.test(source);
      for (const control of rawControls(source)) {
        if (!control.includes("outline-none")) continue;
        if (control.includes("sr-only") || control.includes('type="hidden"')) continue;
        if (HAS_RING.test(control)) continue;
        if (wrapperRing) continue;
        offenders.push(`${file}: ${control.replace(/\s+/g, " ").slice(0, 100)}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("still recognises the defect, so the exemptions did not disarm the rule", () => {
    const bad = '<input className="w-full bg-transparent outline-none" />';
    expect(bad.includes("outline-none")).toBe(true);
    expect(HAS_RING.test(bad)).toBe(false);
    // And a border tint is explicitly not enough.
    const tintOnly = '<input className="outline-none focus:border-primary/60" />';
    expect(HAS_RING.test(tintOnly)).toBe(false);
  });

  it("keeps the design system's own controls correct by construction", () => {
    for (const file of ["src/components/ui/input.tsx", "src/components/ui/textarea.tsx"]) {
      expect(readFileSync(file, "utf8"), file).toMatch(/focus-visible:ring/);
    }
  });
});
