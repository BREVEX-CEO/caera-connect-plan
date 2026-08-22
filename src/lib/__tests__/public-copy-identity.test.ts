import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { leaksRawModelIdentity } from "../ocade-capability-labels";

/**
 * The identity rule, applied to the copy OCADE ships — not only to what the
 * model says.
 *
 * `ocade-capability-labels` already redacts vendor names out of assistant
 * replies before they are stored, and the chat system prompt asks the model not
 * to print them. Neither of those touches the marketing page, the sign-in page
 * or a settings description. The landing page carried "OCADE routes between
 * Ollama on your device and metered cloud models" — the first sentence about
 * the engine that most people would ever read, naming the runtime, on a surface
 * with no session and no redaction anywhere near it.
 *
 * So the same detector that guards the model's output now guards the strings
 * committed alongside it.
 *
 * WHAT IS DELIBERATELY NOT COVERED. Advanced settings and developer
 * diagnostics may name a runtime — that is where a user goes precisely to find
 * out what is actually running, and hiding it there would be the dishonest
 * choice. Those files are listed by name below, with the reason, so the
 * exemption cannot quietly widen.
 */

/**
 * Surfaces that may name a runtime, and why.
 *
 * Each entry is a maintainability or transparency case, not a convenience one.
 */
const MAY_NAME_A_RUNTIME: Record<string, string> = {
  "src/routes/_authenticated/ocade.models.tsx":
    "The advanced model screen exists to show which engine and weights are installed. Concealing the runtime on the page whose purpose is to disclose it would defeat the screen.",
  "src/routes/_authenticated/settings.browser.tsx":
    "Browser-engine settings name the in-browser runtimes so a user can tell which one their device supports before downloading several gigabytes.",
};

/** User-facing route and component copy. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") sourceFiles(path, out);
    } else if (/\.tsx$/.test(path) && !/\.test\.tsx$/.test(path)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Strings a user could read, extracted from JSX.
 *
 * Comments and identifiers are excluded on purpose: a comment explaining WHY a
 * vendor name must not be printed would otherwise fail the check it documents,
 * and `import { ollamaBridgeUrl }` is a symbol, not copy.
 */
function userVisibleStrings(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  const out: string[] = [];
  // Quoted strings of prose length — short ones are class names and keys.
  for (const m of withoutComments.matchAll(/"([^"\\]{25,})"/g)) out.push(m[1]);
  for (const m of withoutComments.matchAll(/`([^`\\$]{25,})`/g)) out.push(m[1]);
  // Text between JSX tags.
  for (const m of withoutComments.matchAll(/>\s*([A-Z][^<>{}]{24,})</g)) out.push(m[1]);
  return out;
}

describe("shipped copy never names the engine behind OCADE", () => {
  const files = [...sourceFiles("src/routes"), ...sourceFiles("src/components")];

  it("scanned a meaningful number of files", () => {
    // A glob that matched nothing would make every assertion below vacuous.
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files.filter((f) => !MAY_NAME_A_RUNTIME[f]))("%s", (file) => {
    const offenders = userVisibleStrings(readFileSync(file, "utf8")).filter(leaksRawModelIdentity);
    expect(offenders, `${file} names a provider or model in user-facing copy`).toEqual([]);
  });

  it("keeps the exemption list short, specific and justified", () => {
    expect(Object.keys(MAY_NAME_A_RUNTIME).length).toBeLessThanOrEqual(4);
    for (const [file, reason] of Object.entries(MAY_NAME_A_RUNTIME)) {
      expect(files, `${file} is exempted but does not exist`).toContain(file);
      expect(reason.length, `${file} needs a real reason`).toBeGreaterThan(60);
    }
  });
});
