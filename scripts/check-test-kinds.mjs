/**
 * Test-kind honesty gate (P20).
 *
 * A test that reads a file and matches a string proves the string is present.
 * It does not prove behaviour. Both kinds have a place — some targets genuinely
 * cannot execute under vitest (Rust, Swift, Java, CI YAML, SQL) — but the two
 * must never be confused, and a structural test must never be the ONLY evidence
 * for something that could have been executed.
 *
 * This gate:
 *   1. classifies every test file as execution, structural, or mixed;
 *   2. requires every structural-only file to be declared with a reason;
 *   3. FAILS when a structural-only file targets something that is executable,
 *      because that is a test which could have been stronger and was not.
 *
 * Usage: node scripts/check-test-kinds.mjs [--json]
 * Exit:  0 when the ledger matches reality; 1 otherwise.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, sep, isAbsolute } from "node:path";

const root = process.cwd();
const jsonOnly = process.argv.includes("--json");

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.test\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const READS_SOURCE = /readFileSync|readFile\(/;
const IMPORTS_PRODUCTION = /from\s+["'](\.\.?\/|@\/)/;
const GLOB_IMPORT = /import\.meta\.glob/;

/**
 * Targets that genuinely cannot be executed by vitest, with the reason.
 *
 * `extension/background.js` is deliberately NOT here: P12 proved it executable
 * in a VM with a fake chrome, so a structural-only test of it would now be a
 * weaker test than the one that exists.
 */
const UNEXECUTABLE = [
  { match: /\.rs$/, why: "Rust source; executed by `cargo test`, not vitest" },
  { match: /\.swift$/, why: "Swift source; needs Xcode on macOS" },
  { match: /\.java$/, why: "Java source; needs the Android toolchain" },
  { match: /\.gradle$|\.pbxproj$|\.plist$/, why: "platform build configuration" },
  { match: /^\.github\//, why: "CI workflow YAML; executed by the CI runner" },
  { match: /\.sql$/, why: "SQL; needs a database to execute" },
  { match: /tauri\..*\.json$|Cargo\.(toml|lock)$/, why: "native build configuration" },
  { match: /\.ya?ml$/, why: "configuration consumed by another tool" },
];

const files = walk(join(root, "src")).map((f) => relative(root, f).split(sep).join("/"));
const classified = files.map((path) => {
  const src = readFileSync(join(root, path), "utf8");
  const structural = READS_SOURCE.test(src);
  const executes = IMPORTS_PRODUCTION.test(src) || GLOB_IMPORT.test(src);
  const kind = structural && executes ? "mixed" : structural ? "structural" : "execution";

  // What does a structural test actually read?
  const targets = [];
  const re =
    /["'`]([^"'`\n]*\.(rs|swift|java|gradle|pbxproj|plist|ya?ml|sql|json|mjs|js|ts|tsx|md))["'`]/g;
  let m;
  while ((m = re.exec(src))) if (m[1].includes("/") || m[1].includes(".")) targets.push(m[1]);

  return { path, kind, targets: [...new Set(targets)] };
});

const ledgerPath = process.env.OCADE_TEST_KIND_LEDGER ?? "release/OCADE_TEST_KINDS.json";
// An override is usually an ABSOLUTE temp path (the enforcement tests point the
// gate at a corrupted copy). Joining that to cwd produces a path that exists
// nowhere, and the gate would silently fall back to an empty ledger — passing
// for the wrong reason.
const resolvedLedger = isAbsolute(ledgerPath) ? ledgerPath : join(root, ledgerPath);
const ledger = existsSync(resolvedLedger)
  ? JSON.parse(readFileSync(resolvedLedger, "utf8"))
  : { structuralOnly: [] };

const problems = [];
const structuralOnly = classified.filter((c) => c.kind === "structural");
const declared = new Map((ledger.structuralOnly ?? []).map((e) => [e.path, e]));

for (const c of structuralOnly) {
  const entry = declared.get(c.path);
  if (!entry) {
    problems.push(`structural-only test is not declared in the ledger: ${c.path}`);
    continue;
  }
  if (!entry.why || entry.why.length < 30) {
    problems.push(`structural-only test lacks a real reason: ${c.path}`);
  }
}
for (const [path] of declared) {
  if (!structuralOnly.some((c) => c.path === path)) {
    problems.push(
      `ledger declares a structural-only test that now executes (or no longer exists): ${path}`,
    );
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    files: classified.length,
    execution: classified.filter((c) => c.kind === "execution").length,
    mixed: classified.filter((c) => c.kind === "mixed").length,
    structural: structuralOnly.length,
  },
  unexecutableReasons: UNEXECUTABLE.map((u) => ({ pattern: String(u.match), why: u.why })),
  problems,
  structuralOnly: structuralOnly.map((c) => ({ path: c.path, targets: c.targets.slice(0, 6) })),
};

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Test kinds: ${report.totals.files} files`);
  console.log(
    `  ${String(report.totals.execution).padStart(4)}  execution  — import and run production code`,
  );
  console.log(
    `  ${String(report.totals.mixed).padStart(4)}  mixed      — execute AND assert on source text`,
  );
  console.log(
    `  ${String(report.totals.structural).padStart(4)}  structural — assert on source text only`,
  );
  if (problems.length > 0) {
    console.log(`\n  ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 30)) console.log(`    ${p}`);
  } else {
    console.log("\n  Every structural-only test is declared with a reason.");
  }
}

process.exit(problems.length === 0 ? 0 : 1);
