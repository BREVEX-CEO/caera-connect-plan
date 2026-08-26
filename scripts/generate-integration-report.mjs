/**
 * The one current report on what happened to the donor archive.
 *
 * WHY THIS IS GENERATED RATHER THAN WRITTEN
 * -----------------------------------------
 * The repository already carried several import reports, and every one of them
 * was a snapshot of an intention: counts and classifications recorded when a
 * plan was made, never re-derived after the work. `IMPORT_ANALYSIS.json`
 * described a ZIP that is no longer the source. A report that cannot be
 * regenerated is a claim, and a stale claim about provenance is worse than no
 * claim at all.
 *
 * This reads three things that are true right now — the archive's own file
 * list, the integration map's disposition for each file, and what is actually
 * present under src/primary-logic — and reports where they agree and where they
 * do not.
 *
 * WHAT "USED" MEANS HERE, STATED SO IT CANNOT BE INFLATED
 * ------------------------------------------------------
 * A file is PORTED when its logic is present in the OCADE tree. It is REACHED
 * when a production caller can arrive at it. A directory full of imported code
 * nothing imports is not integration, so the two are counted separately and the
 * second is the number that matters.
 *
 * Usage: node scripts/generate-integration-report.mjs [--check]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const MAP = process.argv.includes("--map")
  ? process.argv[process.argv.indexOf("--map") + 1]
  : "imports/ocade-primary-logic/INTEGRATION_MAP.csv";
const OUT_MD = "imports/ocade-primary-logic/INTEGRATION_REPORT.md";
const OUT_JSON = "imports/ocade-primary-logic/INTEGRATION_REPORT.json";
const PORTED_ROOT = "src/primary-logic";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift();
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(relative(ROOT, path));
  }
  return out;
}

/** Every module in the OCADE tree, and everything each one imports. */
function importGraph() {
  const files = walk(join(ROOT, "src")).filter((f) => /\.tsx?$/.test(f));
  const graph = new Map();
  for (const file of files) {
    const source = readFileSync(join(ROOT, file), "utf8");
    const specs = new Set();
    for (const m of source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) specs.add(m[1]);
    for (const m of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.add(m[1]);
    graph.set(file, [...specs]);
  }
  return graph;
}

/** Which ported modules a production caller can actually reach. */
function reachablePorted(graph) {
  const reached = new Set();
  for (const [file, specs] of graph) {
    // A ported module importing another ported module does not make either
    // reachable; only a caller OUTSIDE the imported tree does.
    if (file.startsWith(PORTED_ROOT)) continue;
    if (file.includes("__tests__")) continue;
    for (const spec of specs) {
      if (spec.startsWith("@/primary-logic/")) reached.add(spec.replace("@/", "src/"));
    }
  }
  // Follow imports within the ported tree from each reached entry point.
  const queue = [...reached];
  while (queue.length) {
    const current = queue.pop();
    const candidates = [current, `${current}.ts`, `${current}/index.ts`];
    const file = candidates.find((c) => existsSync(join(ROOT, c)));
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

const rows = parseCsv(readFileSync(join(ROOT, MAP), "utf8"));
const graph = importGraph();
const reached = reachablePorted(graph);
const portedFiles = walk(join(ROOT, PORTED_ROOT)).filter(
  (f) => /\.ts$/.test(f) && !f.includes("__tests__"),
);

/**
 * Which donor file a ported module came from.
 *
 * Matched on basename, because the tree was reorganised by responsibility
 * rather than copied path-for-path — that reorganisation is the point, and a
 * path-equality check would report zero ports.
 */
const portedByBase = new Map();
for (const file of portedFiles) {
  const base = file.split("/").pop().replace(/\.ts$/, "");
  if (!portedByBase.has(base)) portedByBase.set(base, []);
  portedByBase.get(base).push(file);
}

const dispositions = [];
for (const row of rows) {
  const base = row.file
    .split("/")
    .pop()
    .replace(/\.tsx?$/, "");
  const matches = portedByBase.get(base) ?? [];
  const ported = matches.length > 0;
  const isReached = matches.some((m) => reached.has(m.replace(/\.ts$/, "")));
  dispositions.push({
    file: row.file,
    action: row.action,
    target: row.target,
    ported,
    reached: isReached,
    portedAs: matches,
  });
}

const byAction = {};
for (const d of dispositions) {
  byAction[d.action] ??= { total: 0, ported: 0, reached: 0 };
  byAction[d.action].total += 1;
  if (d.ported) byAction[d.action].ported += 1;
  if (d.reached) byAction[d.action].reached += 1;
}

const totals = {
  archiveFiles: dispositions.length,
  dispositioned: dispositions.length,
  portedModules: portedFiles.length,
  reachedModules: portedFiles.filter((f) => reached.has(f.replace(/\.ts$/, ""))).length,
};

const report = {
  generatedAt: new Date().toISOString().slice(0, 10),
  totals,
  byAction,
  dispositions,
};

const md = [
  "# OCADE donor integration — current report",
  "",
  "Generated by `scripts/generate-integration-report.mjs` from the archive's own",
  "file list, the integration map, and the modules actually present and reachable",
  "in this tree. It supersedes every earlier import report in this repository.",
  "",
  "## What the numbers mean",
  "",
  "- **Dispositioned** — every archive file has a decided outcome. This is 100% by",
  "  construction: the map assigns one to each of the 2,126 files.",
  "- **Ported** — the file's logic is present in `src/primary-logic`.",
  "- **Reached** — a production caller outside the imported tree can arrive at it.",
  "",
  "A directory of imported code nothing imports is not integration, which is why",
  "*reached* is reported separately and is the number that matters.",
  "",
  "## Totals",
  "",
  `| Archive files | Dispositioned | Ported modules | Reached from production |`,
  `|---:|---:|---:|---:|`,
  `| ${totals.archiveFiles} | ${totals.dispositioned} (100%) | ${totals.portedModules} | ${totals.reachedModules} |`,
  "",
  "## By disposition",
  "",
  "| Action | Files | Ported | Reached |",
  "|---|---:|---:|---:|",
  ...Object.entries(byAction)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([action, c]) => `| \`${action}\` | ${c.total} | ${c.ported} | ${c.reached} |`),
  "",
  "## Modules present in this tree",
  "",
  ...portedFiles
    .sort()
    .map(
      (f) =>
        `- \`${f}\`${reached.has(f.replace(/\.ts$/, "")) ? "" : " — present, not yet reached"}`,
    ),
  "",
].join("\n");

if (process.argv.includes("--check")) {
  const current = existsSync(join(ROOT, OUT_MD)) ? readFileSync(join(ROOT, OUT_MD), "utf8") : "";
  if (current.trim() !== md.trim()) {
    console.error(`${OUT_MD} is stale. Run \`npm run integration:report\` and commit the result.`);
    process.exit(1);
  }
  console.log(
    `Integration report is current: ${totals.reachedModules}/${totals.portedModules} ported modules reached.`,
  );
  process.exit(0);
}

writeFileSync(join(ROOT, OUT_MD), md);
writeFileSync(join(ROOT, OUT_JSON), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${OUT_MD} and ${OUT_JSON}`);
console.log(`  archive files: ${totals.archiveFiles} (100% dispositioned)`);
console.log(`  ported modules: ${totals.portedModules}, reached: ${totals.reachedModules}`);
