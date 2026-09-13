#!/usr/bin/env node
/**
 * Deterministic tracked-source LOC measurement for OCADE.
 *
 * The same command is used at every checkpoint required by docs/TESTING.md:
 * the PLAN Phase 0 baseline and PLAN completion.
 *
 * Method:
 *   - enumerate git-tracked files only (`git ls-files -z`);
 *   - keep files whose extension is in INCLUDED_EXTENSIONS;
 *   - drop files matching EXCLUDED_PATH_PREFIXES or EXCLUDED_FILES
 *     (generated output, dependency/vendor trees, design reference assets);
 *   - count newline-delimited lines, counting a final unterminated line once.
 *
 * Usage:
 *   node scripts/measure-loc.mjs            # summary
 *   node scripts/measure-loc.mjs --json     # machine-readable summary
 *   node scripts/measure-loc.mjs --by-dir   # summary plus per top-level totals
 */

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const INCLUDED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".sql",
  ".rs",
  ".py",
  ".java",
  ".kt",
  ".swift",
  ".html",
  ".sh",
]);

const EXCLUDED_PATH_PREFIXES = [
  "node_modules/",
  "dist/",
  "build/",
  "docs/design-references/",
  "vendor/",
];

const EXCLUDED_FILES = new Set(["src/routeTree.gen.ts", "src/integrations/supabase/types.ts"]);

const EXCLUDED_SUFFIXES = [".gen.ts", ".gen.tsx", ".d.ts"];

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 1024 ** 3 });
  return out.split("\0").filter(Boolean);
}

function isIncluded(file) {
  if (!INCLUDED_EXTENSIONS.has(path.extname(file))) return false;
  if (EXCLUDED_FILES.has(file)) return false;
  if (EXCLUDED_PATH_PREFIXES.some((prefix) => file.startsWith(prefix))) return false;
  if (EXCLUDED_SUFFIXES.some((suffix) => file.endsWith(suffix))) return false;
  return true;
}

function countLines(file) {
  let stats;
  try {
    stats = statSync(file);
  } catch {
    return 0;
  }
  if (!stats.isFile()) return 0;
  const text = readFileSync(file, "utf8");
  if (text.length === 0) return 0;
  let lines = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) lines += 1;
  }
  if (text.charCodeAt(text.length - 1) !== 10) lines += 1;
  return lines;
}

const files = trackedFiles().filter(isIncluded).sort();
const perDir = new Map();
let totalLines = 0;

for (const file of files) {
  const lines = countLines(file);
  totalLines += lines;
  const top = file.includes("/") ? file.slice(0, file.indexOf("/")) : ".";
  const entry = perDir.get(top) ?? { files: 0, lines: 0 };
  entry.files += 1;
  entry.lines += lines;
  perDir.set(top, entry);
}

const summary = {
  method: "git ls-files, approved source extensions, generated/vendor/reference excluded",
  extensions: [...INCLUDED_EXTENSIONS].sort(),
  excludedPrefixes: EXCLUDED_PATH_PREFIXES,
  excludedSuffixes: EXCLUDED_SUFFIXES,
  excludedFiles: [...EXCLUDED_FILES],
  totalFiles: files.length,
  totalLines,
};

if (process.argv.includes("--json")) {
  const byDir = Object.fromEntries([...perDir.entries()].sort((a, b) => b[1].lines - a[1].lines));
  process.stdout.write(`${JSON.stringify({ ...summary, byDir }, null, 2)}\n`);
} else {
  process.stdout.write(`files: ${summary.totalFiles}\nlines: ${summary.totalLines}\n`);
  if (process.argv.includes("--by-dir")) {
    const rows = [...perDir.entries()].sort((a, b) => b[1].lines - a[1].lines);
    for (const [dir, entry] of rows) {
      process.stdout.write(
        `  ${dir.padEnd(24)} ${String(entry.files).padStart(6)} files ${String(entry.lines).padStart(9)} lines\n`,
      );
    }
  }
}
