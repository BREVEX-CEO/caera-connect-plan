/**
 * Validate the canonical 2,126-record donor ledger and generate its two report
 * views. The raw archive is deliberately absent from the product; immutable
 * archive facts are refreshed only with generate-donor-disposition.mjs against
 * an explicitly supplied disposable extraction directory.
 *
 * Usage: node scripts/generate-integration-report.mjs [--check]
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const argumentValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const LEDGER =
  argumentValue("--ledger") ?? "imports/ocade-primary-logic/OCADE_PRIMARY_LOGIC_DISPOSITION.jsonl";
const OUT_JSON = "imports/ocade-primary-logic/INTEGRATION_REPORT.json";
const OUT_MD = "imports/ocade-primary-logic/INTEGRATION_REPORT.md";
const PORTED_ROOT = "src/primary-logic";
const EXPECTED = Object.freeze({
  archiveSha256: "FD831F6C817AF1DBADCD6CBC67EC17CD11D0A8EDB7E01343FA60766FF11B17CD",
  files: 2126,
  directories: 346,
  uncompressedBytes: 33940440,
  sourceGraphFiles: 2104,
  reachable: 1830,
  unreachable: 274,
  brokenOccurrences: 623,
  brokenPairs: 498,
  portedModules: 37,
});
const FINAL_DISPOSITIONS = ["KEEP", "FIX", "COMPLETE", "MERGE", "REPLACE", "REMOVE"];
const REQUIRED_FIELDS = [
  "archiveSha256",
  "archivePath",
  "size",
  "sha256",
  "language",
  "family",
  "internalDependencies",
  "brokenRelativeImports",
  "runtimeAssumptions",
  "platformClass",
  "donorReachability",
  "exactCurrentSourceMatches",
  "currentOcadeEquivalent",
  "currentOcadeReachability",
  "usefulBehavior",
  "qualityRepairNeeds",
  "canonicalDestination",
  "migrationAction",
  "requiredCallers",
  "requiredTests",
  "verificationTest",
  "finalDisposition",
  "legacyOutcome",
  "sourceMapReason",
  "exactReason",
];

function walk(directory, output = []) {
  if (!existsSync(directory)) return output;
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path, output);
    else output.push(relative(ROOT, path).replace(/\\/g, "/"));
  }
  return output;
}

function readLedger() {
  if (!existsSync(LEDGER)) throw new Error(`Missing canonical donor ledger: ${LEDGER}`);
  return readFileSync(LEDGER, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${LEDGER}:${index + 1} is not valid JSON: ${error.message}`);
      }
    });
}

function importGraph() {
  const files = walk(join(ROOT, "src")).filter((file) => /\.tsx?$/.test(file));
  const graph = new Map();
  for (const file of files) {
    const source = readFileSync(join(ROOT, file), "utf8");
    const specs = new Set();
    for (const match of source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) specs.add(match[1]);
    for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      specs.add(match[1]);
    }
    graph.set(file, [...specs]);
  }
  return graph;
}

function reachablePorted(graph) {
  const reached = new Set();
  for (const [file, specs] of graph) {
    if (file.startsWith(PORTED_ROOT) || file.includes("__tests__")) continue;
    for (const spec of specs) {
      if (spec.startsWith("@/primary-logic/")) reached.add(spec.replace("@/", "src/"));
    }
  }
  const queue = [...reached];
  while (queue.length) {
    const current = queue.pop();
    const base = current.endsWith(".js") ? current.slice(0, -3) : current;
    const candidates = [base, `${base}.ts`, `${base}/index.ts`];
    const file = candidates.find((candidate) => existsSync(join(ROOT, candidate)));
    if (!file) continue;
    reached.add(file.replace(/\.ts$/, ""));
    for (const spec of graph.get(file) ?? []) {
      if (!spec.startsWith(".")) continue;
      const resolved = join(file, "..", spec).replace(/\\/g, "/");
      if (!reached.has(resolved)) {
        reached.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return reached;
}

function callersOf(module, graph) {
  /*
   * BOTH IMPORT FORMS, because this list was blind to one of them.
   *
   * It matched the `@/` alias only. A product file that reaches a module by
   * RELATIVE path was reported as not calling it — which is how
   * `src/lib/runtime/call-model.ts`, with twenty-six donor records merged into
   * it, reads as having no caller at all when in fact `use-ocade-runtime.ts`
   * imports it as `./call-model`. A caller list that can under-report is worse
   * than no list, because the missing entry looks like stranded behaviour.
   */
  const bare = module.replace(/\.tsx?$/, "");
  const alias = `@/${bare.replace(/^src\//, "")}`;
  const callers = [];
  for (const [file, specs] of graph) {
    if (file.startsWith(PORTED_ROOT) || file.includes("__tests__")) continue;
    const reaches = specs.some((spec) => {
      if (spec === alias) return true;
      if (!spec.startsWith(".")) return false;
      const resolved = join(file, "..", spec).replace(/\\/g, "/").replace(/\.js$/, "");
      return resolved === bare || resolved === `${bare}/index`;
    });
    if (reaches) callers.push(file);
  }
  return callers.sort();
}

function validate(records, portedFiles, reached) {
  const problems = [];
  const seen = new Set();
  const allPaths = new Set(records.map((record) => record.archivePath));
  let prior = "";
  for (const record of records) {
    for (const field of REQUIRED_FIELDS) {
      if (!(field in record))
        problems.push(`${record.archivePath ?? "(unknown)"}: missing ${field}`);
    }
    if (!record.archivePath || seen.has(record.archivePath)) {
      problems.push(`${record.archivePath ?? "(empty)"}: duplicate or empty archivePath`);
    }
    seen.add(record.archivePath);
    if (prior && prior > record.archivePath) {
      problems.push(`${record.archivePath}: ledger paths are not sorted`);
    }
    prior = record.archivePath;
    if (record.archivePath.includes("\\") || record.archivePath.startsWith("/")) {
      problems.push(`${record.archivePath}: archivePath is not canonical`);
    }
    if (record.archiveSha256 !== EXPECTED.archiveSha256) {
      problems.push(`${record.archivePath}: wrong archive identity`);
    }
    if (!Number.isInteger(record.size) || record.size < 0) {
      problems.push(`${record.archivePath}: invalid byte size`);
    }
    if (!/^[a-f0-9]{64}$/.test(record.sha256)) {
      problems.push(`${record.archivePath}: invalid SHA-256`);
    }
    if (!FINAL_DISPOSITIONS.includes(record.finalDisposition)) {
      problems.push(`${record.archivePath}: invalid final disposition`);
    }
    for (const field of [
      "internalDependencies",
      "brokenRelativeImports",
      "runtimeAssumptions",
      "exactCurrentSourceMatches",
      "requiredCallers",
      "requiredTests",
    ]) {
      if (!Array.isArray(record[field]))
        problems.push(`${record.archivePath}: ${field} must be an array`);
    }
    for (const field of [
      "language",
      "family",
      "platformClass",
      "usefulBehavior",
      "qualityRepairNeeds",
      "migrationAction",
      "verificationTest",
      "exactReason",
    ]) {
      if (typeof record[field] !== "string" || !record[field].trim()) {
        problems.push(`${record.archivePath}: ${field} must be non-empty`);
      }
    }
    /*
     * THE DESTINATION MUST STILL BE THERE, WHATEVER THE DISPOSITION.
     *
     * This was checked for MERGE and REPLACE only, on the reasoning that those
     * are the ones that name an authority. But every record names one — a
     * REMOVE record says where the behaviour went instead, and a KEEP record
     * says what it was compared against — and a destination that no longer
     * exists makes the record unreadable rather than merely untidy: "removed,
     * because `src/lib/x.ts` already did it" is not a disposition once
     * `src/lib/x.ts` is gone, it is a claim nobody can check.
     *
     * The refactoring phases delete and move files by design, and this ledger
     * is the record that has to survive them. Checking all 2,126 costs nothing
     * and turns "somebody will notice" into a build failure.
     */
    if (record.canonicalDestination && !existsSync(record.canonicalDestination)) {
      problems.push(
        `${record.archivePath}: authority does not exist: ${record.canonicalDestination}`,
      );
    }
    if (record.currentOcadeEquivalent && !existsSync(record.currentOcadeEquivalent)) {
      problems.push(
        `${record.archivePath}: OCADE equivalent does not exist: ${record.currentOcadeEquivalent}`,
      );
    }
    if (["MERGE", "REPLACE"].includes(record.finalDisposition)) {
      if (!record.currentOcadeEquivalent || !record.canonicalDestination) {
        problems.push(
          `${record.archivePath}: ${record.finalDisposition} requires one OCADE authority`,
        );
      }
      if (!record.requiredTests.length || !record.requiredTests.includes(record.verificationTest)) {
        problems.push(
          `${record.archivePath}: ${record.finalDisposition} requires a named verification test`,
        );
      }
    }
    for (const test of record.requiredTests ?? []) {
      if (!existsSync(test))
        problems.push(`${record.archivePath}: required test does not exist: ${test}`);
    }
    for (const dependency of record.internalDependencies ?? []) {
      if (!allPaths.has(dependency)) {
        problems.push(`${record.archivePath}: dependency is absent from ledger: ${dependency}`);
      }
    }
  }

  if (records.length !== EXPECTED.files)
    problems.push(`Expected ${EXPECTED.files} records; found ${records.length}`);
  const bytes = records.reduce((sum, record) => sum + record.size, 0);
  if (bytes !== EXPECTED.uncompressedBytes) {
    problems.push(`Expected ${EXPECTED.uncompressedBytes} uncompressed bytes; found ${bytes}`);
  }
  const sourceGraphFiles = records.filter(
    (record) => record.donorReachability !== "NOT_SOURCE",
  ).length;
  const donorReachable = records.filter(
    (record) => record.donorReachability === "REACHABLE",
  ).length;
  const donorUnreachable = records.filter(
    (record) => record.donorReachability === "UNREACHABLE",
  ).length;
  const brokenOccurrences = records.reduce(
    (sum, record) => sum + record.brokenRelativeImports.length,
    0,
  );
  const brokenPairs = records.reduce(
    (sum, record) => sum + new Set(record.brokenRelativeImports).size,
    0,
  );
  for (const [name, actual, expected] of [
    ["source graph files", sourceGraphFiles, EXPECTED.sourceGraphFiles],
    ["reachable donor files", donorReachable, EXPECTED.reachable],
    ["unreachable donor files", donorUnreachable, EXPECTED.unreachable],
    ["broken relative-import occurrences", brokenOccurrences, EXPECTED.brokenOccurrences],
    ["unique broken file/import pairs", brokenPairs, EXPECTED.brokenPairs],
    ["ported modules", portedFiles.length, EXPECTED.portedModules],
    [
      "reached modules",
      portedFiles.filter((file) => reached.has(file.replace(/\.ts$/, ""))).length,
      EXPECTED.portedModules,
    ],
  ]) {
    if (actual !== expected) problems.push(`Expected ${expected} ${name}; found ${actual}`);
  }
  const nonEmptyExactMatches = records.filter(
    (record) => record.size > 0 && record.exactCurrentSourceMatches.length > 0,
  );
  if (nonEmptyExactMatches.length) {
    problems.push(
      `Substantive exact donor copies remain: ${nonEmptyExactMatches.map((item) => item.archivePath).join(", ")}`,
    );
  }
  for (const file of portedFiles) {
    if (!records.some((record) => record.currentOcadeEquivalent === file)) {
      problems.push(`${file}: reachable adapted module is absent from donor ledger`);
    }
  }
  return problems;
}

function countByFor(items, field) {
  return Object.fromEntries(
    [...new Set(items.map((item) => item[field]))]
      .sort()
      .map((value) => [value, items.filter((item) => item[field] === value).length]),
  );
}

const records = readLedger();
const graph = importGraph();
const reached = reachablePorted(graph);
const portedFiles = walk(join(ROOT, PORTED_ROOT)).filter(
  (file) => /\.ts$/.test(file) && !file.includes("__tests__"),
);
const problems = validate(records, portedFiles, reached);
if (problems.length) {
  console.error("The canonical donor disposition ledger is invalid:");
  for (const problem of problems.slice(0, 100)) console.error(`  - ${problem}`);
  if (problems.length > 100) console.error(`  - ...and ${problems.length - 100} more`);
  process.exit(1);
}

const countBy = (field) => countByFor(records, field);
const moduleCallers = Object.fromEntries(
  portedFiles.sort().map((file) => [file, callersOf(file, graph)]),
);
const families = [...new Set(records.map((record) => record.family))].sort().map((family) => {
  const items = records.filter((record) => record.family === family);
  const destinations = Object.entries(
    items.reduce((counts, item) => {
      counts[item.canonicalDestination] = (counts[item.canonicalDestination] ?? 0) + 1;
      return counts;
    }, {}),
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    family,
    files: items.length,
    finalDispositions: countByFor(items, "finalDisposition"),
    authority: destinations[0]?.[0] ?? "",
    usefulBehavior: items[0].usefulBehavior,
  };
});
const totals = {
  archiveFiles: records.length,
  dispositioned: records.length,
  directories: EXPECTED.directories,
  uncompressedBytes: records.reduce((sum, record) => sum + record.size, 0),
  sourceGraphFiles: records.filter((record) => record.donorReachability !== "NOT_SOURCE").length,
  donorReachable: records.filter((record) => record.donorReachability === "REACHABLE").length,
  donorUnreachable: records.filter((record) => record.donorReachability === "UNREACHABLE").length,
  brokenRelativeImportOccurrences: records.reduce(
    (sum, record) => sum + record.brokenRelativeImports.length,
    0,
  ),
  brokenRelativeImportPairs: records.reduce(
    (sum, record) => sum + new Set(record.brokenRelativeImports).size,
    0,
  ),
  exactCurrentSourceMatches: records.reduce(
    (sum, record) => sum + record.exactCurrentSourceMatches.length,
    0,
  ),
  substantiveExactCurrentSourceMatches: records.filter(
    (record) => record.size > 0 && record.exactCurrentSourceMatches.length,
  ).length,
  portedModules: portedFiles.length,
  reachedModules: portedFiles.filter((file) => reached.has(file.replace(/\.ts$/, ""))).length,
};
const ledgerText = readFileSync(LEDGER, "utf8");
const report = {
  generatorVersion: 2,
  archive: {
    path: ".incoming/OCADE_PRIMARY_LOGIC.rar",
    gitBlobSha1: "453f36dcd2a7a65c7101c071d64161e311d2f87a",
    sha256: EXPECTED.archiveSha256,
    extractedRoot: "OCADE_PRIMARY_LOGIC",
    rawArchiveShipped: false,
  },
  ledger: {
    path: LEDGER,
    sha256: createHash("sha256").update(ledgerText).digest("hex"),
    schemaFields: REQUIRED_FIELDS,
  },
  totals,
  byFinalDisposition: countBy("finalDisposition"),
  byLegacyOutcome: countBy("legacyOutcome"),
  byMigrationAction: countBy("migrationAction"),
  byPlatformClass: countBy("platformClass"),
  byLanguage: countBy("language"),
  families,
  moduleCallers,
  /* Compatibility view for historical tooling; JSONL remains authoritative. */
  dispositions: records.map((record) => ({
    file: record.archivePath,
    action: record.migrationAction,
    target: record.canonicalDestination,
    family: record.family,
    category: record.legacyOutcome,
    reason: record.sourceMapReason,
    ported: record.currentOcadeEquivalent.startsWith(`${PORTED_ROOT}/`),
    reached: record.currentOcadeReachability === "PRODUCTION_REACHABLE",
    portedAs: record.currentOcadeEquivalent.startsWith(`${PORTED_ROOT}/`)
      ? [record.currentOcadeEquivalent]
      : [],
  })),
};
const json = `${JSON.stringify(report, null, 2)}\n`;
const dispositionRows = Object.entries(report.byFinalDisposition)
  .map(([name, count]) => `| \`${name}\` | ${count} |`)
  .join("\n");
const familyRows = families
  .map(
    (item) =>
      `| ${item.family.replace(/\|/g, "\\|")} | ${item.files} | \`${item.authority}\` | ${Object.entries(
        item.finalDispositions,
      )
        .map(([name, count]) => `${name} ${count}`)
        .join(", ")} |`,
  )
  .join("\n");
const moduleRows = portedFiles
  .map((file) => {
    const callers = moduleCallers[file];
    return `| \`${file}\` | ${callers.length ? callers.map((caller) => `\`${caller}\``).join(", ") : "via another adapted module"} |`;
  })
  .join("\n");
const markdown = `# OCADE donor integration — current report

> Generated from \`${LEDGER}\` by \`scripts/generate-integration-report.mjs\`.
> The JSONL ledger is authoritative; do not edit this report by hand.

## Evidence boundary

The raw archive is not shipped or executed. It was reconstructed from historical Git blob
\`453f36dcd2a7a65c7101c071d64161e311d2f87a\` only in disposable external storage,
integrity-tested, and matched SHA-256
\`${EXPECTED.archiveSha256}\`. Its physical extraction contains ${EXPECTED.files} files,
${EXPECTED.directories} directories and ${EXPECTED.uncompressedBytes.toLocaleString("en-US")} bytes.

This is repository-side provenance-risk reduction, not a claim of legal certification.

## Totals

| Archive files | Dispositioned | Source graph | Donor reachable | Donor unreachable | Broken occurrences | Broken pairs | Adapted modules | Production reached |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${totals.archiveFiles} | ${totals.dispositioned} | ${totals.sourceGraphFiles} | ${totals.donorReachable} | ${totals.donorUnreachable} | ${totals.brokenRelativeImportOccurrences} | ${totals.brokenRelativeImportPairs} | ${totals.portedModules} | ${totals.reachedModules} |

The only byte-identical match with current tracked source is an empty file; there are zero
substantive exact donor copies.

## Final disposition

| Disposition | Files |
| --- | ---: |
${dispositionRows}

Every record names its exact source hash, dependencies, broken imports, runtime assumptions,
platform class, donor and OCADE reachability, useful behavior, repair needs, canonical
destination, migration action, required callers, verification tests, final disposition and
reason in the JSONL ledger.

## Families and canonical authorities

| Donor family | Files | OCADE authority | Dispositions |
| --- | ---: | --- | --- |
${familyRows}

## Adapted modules and production callers

| Module | Reached by |
| --- | --- |
${moduleRows}
`;

if (process.argv.includes("--check")) {
  const stale = [
    [OUT_JSON, json],
    [OUT_MD, markdown],
  ]
    .filter(([path, expected]) => !existsSync(path) || readFileSync(path, "utf8") !== expected)
    .map(([path]) => path);
  if (stale.length) {
    console.error(`Generated donor report is stale: ${stale.join(", ")}`);
    console.error("Run `npm run integration:report`.");
    process.exit(1);
  }
  console.log(
    `Integration evidence current: ${records.length} dispositions, ${totals.reachedModules}/${totals.portedModules} adapted modules reached.`,
  );
  process.exit(0);
}

writeFileSync(OUT_JSON, json, "utf8");
writeFileSync(OUT_MD, markdown, "utf8");
console.log(`Wrote ${OUT_JSON} and ${OUT_MD} from ${LEDGER}.`);
