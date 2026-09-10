import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE PORTED DONOR LOGIC IS A LEAF, NOT A SECOND LAYER.
 *
 * `PLAN.md` Phase 6's gate is "maximum useful donor behaviour with no parallel
 * donor product architecture", and `CLAUDE.md` says the same thing from the
 * other side: never ship a duplicate router, store, database client, auth stack,
 * task manager, agent loop, tool registry, model installer, usage authority,
 * payment stack, notification stack, browser bridge or design system "merely to
 * increase donor file usage".
 *
 * That gate is easy to pass on the day and easy to lose later, because the way
 * a parallel architecture arrives is never a decision. It arrives one import at
 * a time: a ported parser needs a setting, so it reaches for the settings
 * store; the store needs the Supabase client; and a directory of pure functions
 * has quietly become a second application with its own opinions about identity,
 * transport and state.
 *
 * The shape that prevents it is the one the port already has and this asserts:
 * every module under `src/primary-logic/` depends on NOTHING but its own
 * relatives. The canonical authorities import it; it imports none of them. A
 * leaf cannot become a layer.
 *
 * The complementary facts live elsewhere and are not repeated here:
 * `import-proof.test.ts` proves the ported logic RUNS rather than merely
 * compiling, and `generate-integration-report.mjs` proves all 37 modules are
 * reached from non-test product code — a module nothing imports is not
 * integrated, however pure it is.
 */

const ROOT = "src/primary-logic";

function sourceFiles(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      // Tests may reach out — that is how a port is proved against the
      // authority it was merged into. Only shipped modules are constrained.
      if (entry === "__tests__") continue;
      out.push(...sourceFiles(path));
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

/**
 * Blank out comments and string bodies before scanning.
 *
 * Without this the scan reads prose. Three of this file's first six "findings"
 * were sentences: a comment saying a sidebar entry "was renamed from 'Control +
 * Work' to 'Work'" matched the import pattern exactly, and reporting it as a
 * cross-layer dependency would have been a defect report about English.
 */
function stripNoise(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

/** Every module specifier a file imports, static and dynamic. */
function importsOf(file: string): string[] {
  const source = stripNoise(readFileSync(file, "utf8"));
  const specifiers = new Set<string>();
  for (const match of source.matchAll(/\bfrom\s*["']([^"']+)["']/g)) specifiers.add(match[1]!);
  for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    specifiers.add(match[1]!);
  }
  for (const match of source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    specifiers.add(match[1]!);
  }
  return [...specifiers];
}

/**
 * Does this specifier leave `src/primary-logic`?
 *
 * A THIRD-PARTY PACKAGE DOES NOT, and the first draft of this test said it did
 * — flagging `zod/v4`, which three permission schemas import and which the rest
 * of the repository uses everywhere. That was the rule stated wrongly rather
 * than a finding: zod is a leaf, and a ported module depending on the same
 * validation library as the code around it is the opposite of a parallel
 * architecture. What matters is reaching an OCADE MODULE — by alias, by
 * absolute path, or by a relative path that climbs out of the directory.
 */
function leavesTheLeaf(file: string, specifier: string): boolean {
  if (specifier.startsWith("@/") || specifier.startsWith("src/")) return true;
  if (!specifier.startsWith(".")) return false;
  const resolved = join(file, "..", specifier).replace(/\\/g, "/");
  return !resolved.startsWith(`${ROOT}/`);
}

const MODULES = sourceFiles(ROOT);

describe("the ported donor logic", () => {
  it("is actually there, so an empty directory cannot pass", () => {
    // Every assertion below is vacuously true over an empty list, which is the
    // classic way a structural test stops testing anything.
    expect(MODULES.length).toBeGreaterThanOrEqual(37);
  });

  it("reaches no OCADE module, by alias, path or climb", () => {
    const reaching = MODULES.flatMap((file) =>
      importsOf(file)
        .filter((specifier) => leavesTheLeaf(file, specifier))
        .map((specifier) => `${file} → ${specifier}`),
    );
    expect(
      reaching,
      "a ported module reached out of src/primary-logic, which is how a leaf becomes a second layer",
    ).toEqual([]);
  });

  it("carries no runtime, transport or storage of its own", () => {
    /*
     * The named ones, because a relative import could still pull in a copy.
     * Each of these is a canonical authority OCADE already has exactly one of,
     * and a donor module holding its own would be the duplicate the rules
     * forbid rather than the behaviour they ask for.
     */
    const forbidden = [
      /\bfrom\s*["']react["']/,
      /\bfrom\s*["']@supabase\//,
      /\bfrom\s*["']@tanstack\//,
      /\bcreateClient\s*\(/,
      /\bfetch\s*\(/,
      /\blocalStorage\b/,
      /\bindexedDB\b/,
      /\bnavigator\.storage\b/,
    ];
    const offenders: string[] = [];
    for (const file of MODULES) {
      const source = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        if (pattern.test(source)) offenders.push(`${file} matches ${pattern}`);
      }
    }
    expect(offenders, "a ported module carries its own runtime, transport or storage").toEqual([]);
  });
});
