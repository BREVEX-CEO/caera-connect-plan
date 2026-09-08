import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AN INVISIBLE CONTROL IN THE TAB ORDER.
 *
 * `sr-only` clips an element to one pixel and leaves it FOCUSABLE. That is
 * correct for text a screen reader should hear, and wrong for a file input that
 * a visible button already opens: a keyboard user tabs onto something they
 * cannot see, with no focus indicator — because there is nothing there to
 * indicate — and then tabs again onto the button that does the same thing.
 *
 * The accessibility run found it on /ocade as "every keyboard stop shows a
 * focus indicator — input", which is what the defect looks like from outside.
 *
 * THE RULE IS NOT "HIDDEN INPUTS ARE NEVER FOCUSABLE". Where the trigger is a
 * `<label htmlFor>` rather than a button, the input is the ONLY way to reach the
 * control with a keyboard, and removing it would make the feature
 * mouse-only. That case keeps its tab stop and shows the ring on the label.
 *
 * So the rule is: a visually-hidden focusable input must either be out of the
 * tab order, or have a visible focus indicator somewhere a person can see.
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

/** Every `<input …>` element in a file, as source text. */
function inputElements(source: string): string[] {
  return [...source.matchAll(/<input\b[\s\S]{0,700}?\/>/g)].map((match) => match[0]);
}

describe("visually hidden inputs", () => {
  const files = sourceFiles("src");

  it("finds the source at all, so a broken scan cannot pass", () => {
    expect(files.length).toBeGreaterThan(150);
    const anyFileInput = files.some((file) =>
      inputElements(readFileSync(file, "utf8")).some((element) => element.includes('type="file"')),
    );
    expect(anyFileInput, "no file input found — the scan is broken").toBe(true);
  });

  it("never leaves an sr-only input focusable without a visible indicator", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const element of inputElements(source)) {
        if (!/className="[^"]*\bsr-only\b/.test(element)) continue;
        // Out of the tab order is one correct answer.
        if (/tabIndex=\{-1\}/.test(element)) continue;
        // Being the `peer` of something that shows a ring is the other: the
        // input stays reachable and the indicator appears on what is visible.
        if (/className="[^"]*\bpeer\b/.test(element) && /peer-focus-visible:/.test(source)) {
          continue;
        }
        offenders.push(`${file}: ${element.replace(/\s+/g, " ").slice(0, 90)}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("still recognises the defect, so the exemptions did not disarm the rule", () => {
    // The exemptions above are the whole risk in a rule like this.
    const bad = '<input type="file" className="sr-only" aria-label="Attach" />';
    expect(/className="[^"]*\bsr-only\b/.test(bad)).toBe(true);
    expect(/tabIndex=\{-1\}/.test(bad)).toBe(false);
    expect(/className="[^"]*\bpeer\b/.test(bad)).toBe(false);
  });

  it("keeps the avatar picker reachable by keyboard rather than hiding it", () => {
    /*
     * The one that must NOT be taken out of the tab order: its trigger is a
     * label, and a label is not focusable, so the input is the control.
     */
    const source = readFileSync("src/components/settings/DeviceAvatarEditor.tsx", "utf8");
    expect(source).toContain('className="peer sr-only"');
    expect(source).not.toMatch(/type="file"[\s\S]{0,200}tabIndex=\{-1\}/);
    expect(source).toContain("peer-focus-visible:ring-2");
  });
});
