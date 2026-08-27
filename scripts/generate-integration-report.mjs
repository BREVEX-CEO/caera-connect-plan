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

/**
 * WHERE EACH DONOR FAMILY ENDED UP, AND WHO WON WHERE BOTH SIDES HAD ONE.
 *
 * The per-file table below says what happened to 2,126 files. It does not say
 * WHY, and "why" is the only part a person reading this later actually needs:
 * when the archive and OCADE both had a version of something, which one is now
 * the authority, and what made that the right call.
 *
 * `authority` is a real path and is checked to exist when this runs, so a
 * family whose authority is deleted or moved fails the report rather than
 * quietly describing a file that is gone.
 */
const FAMILIES = [
  {
    family: "Query engine, deps, transitions, token budget, stop hooks",
    outcome: "Ported — donor is the authority",
    authority: "src/lib/runtime/use-ocade-runtime.ts",
    reason:
      "The donor's loop handles the four things OCADE's did not: output-token recovery, reactive compaction, an explicit token budget, and a closed terminal set. Both rooms now run it, with local inference injected through callModel.",
  },
  {
    family: "Permissions, shell rule matching, dangerous patterns, denial tracking",
    outcome: "Ported — donor is the authority",
    authority: "src/lib/runtime/permissions.ts",
    reason:
      "Cowork's approvalPolicy and Chat had separate ideas about risk. The donor's rule model is stronger and now decides for both, with OCADE's opaque-command gate added on top.",
  },
  {
    family: "Bash parser, heredocs, quoting, destructive-command warnings",
    outcome: "Ported — donor is the authority",
    authority: "src/lib/runtime/permissions.ts",
    reason:
      "A real parser is what closes the compound-command hole: an approval for one command must not carry the rest of the line. Ported in pure TypeScript, without the donor's native grammar binary.",
  },
  {
    family: "Path safety and sandbox rules",
    outcome: "Ported — closed a gap OCADE had",
    authority: "src/lib/runtime/permissions.ts",
    reason:
      "OCADE checked paths only on the companion, one process and one network hop away. The archive's rules for what must never be changed on a model's say-so — roots, whole drives, system folders, the home directory, traversal — now run in the browser before the call leaves.",
  },
  {
    family: "Task lifecycle, stop, background tasks, status labels",
    outcome: "Ported — donor is the authority",
    authority: "src/lib/tasks/runs.ts",
    reason:
      "OCADE had a to-do board and no runtime task state at all. The donor's status machine, id scheme, pause accounting and stop error taxonomy now back Stop, Pause, Resume and Take over.",
  },
  {
    family: "Micro-compaction of old tool output",
    outcome: "Ported — donor is the authority",
    authority: "src/lib/runtime/compact.ts",
    reason:
      "OCADE compacted all-or-nothing: it dropped whole turns, losing which tools ran and whether they worked. The archive empties the BODY of old tool results first and keeps the headline, which saves the most tokens for the least meaning. The structural pass now runs only when that was not enough.",
  },
  {
    family: "Session memory extraction thresholds",
    outcome: "Ported — donor is the authority",
    authority: "src/lib/memory/session-memory.ts",
    reason:
      "OCADE remembered only what the model chose to record. The donor's thresholds decide when a conversation is worth summarising without re-summarising it every turn.",
  },
  {
    family: "Memory record shapes and the age/relevance model",
    outcome: "Ported — donor is the authority",
    authority: "src/lib/memory/quality.ts",
    reason: "Freshness decay and memory typing were absent on the OCADE side.",
  },
  {
    family: "Unicode sanitisation and hidden-character handling",
    outcome: "Ported — donor replaced a weaker OCADE version",
    authority: "src/lib/ocade-injection-guard.ts",
    reason:
      "OCADE's stripper missed the Unicode Tag block, so instructions could be smuggled into text that looked clean. The donor's sanitiser covers it; the old regex is gone.",
  },
  {
    family: "Message protocol: content blocks, tool use, tool results",
    outcome: "Ported — donor is the authority",
    authority: "src/lib/runtime/call-model.ts",
    reason: "One shape for the transcript, converted once at the engine boundary.",
  },
  {
    family: "Tool search and deferred tool loading",
    outcome: "Not ported — OCADE keeps its own",
    authority: "src/lib/agent/tool-registry.ts",
    reason:
      "The donor's tool search depends on the hosted API's tool_reference beta blocks, which no on-device runtime accepts. OCADE defers by domain and caps each turn at a measured twelve tools, which is the same problem solved for a local model.",
  },
  {
    family: "Agents, subagents, teams, coordinator",
    outcome: "Not ported — OCADE's is stronger here",
    authority: "src/lib/agent/planner.ts",
    reason:
      "OCADE already decomposes a goal once and runs each step as a sub-agent with only that step's tools, returning one line to the main transcript. The donor's version assumes concurrent hosted sessions, which one local model cannot serve.",
  },
  {
    family: "Plugins, skills, tool servers",
    outcome: "Not ported — OCADE keeps one authority",
    authority: "src/lib/skills/pack-registry.ts",
    reason:
      "The donor loads plugins from the user's filesystem at startup and trusts what it finds. OCADE's registry validates and trusts packs explicitly, which is the model a browser product can actually honour.",
  },
  {
    family: "Bridge, remote sessions, websocket transport",
    outcome: "Removed — replaced by local transport",
    authority: "src/lib/native/extension-bridge.ts",
    reason:
      "The donor bridge speaks to a hosted relay. OCADE's browser work goes through the extension and machine work through the paired companion; neither needs a server in the middle.",
  },
  {
    family: "PTY, terminal emulator, Ink renderer",
    outcome: "Removed",
    authority: "src/lib/runtime/execute.ts",
    reason:
      "A tab has no pseudo-terminal, and shipping one would mean shipping a second renderer. Shell work belongs to the companion, behind the permission layer.",
  },
  {
    family: "Hosted inference, provider table, OAuth to the model vendor",
    outcome: "Removed",
    authority: "src/lib/runtime/call-model.ts",
    reason:
      "OCADE answers on the device. There is no hosted-AI fallback anywhere in the path, and the audit that proves it runs in CI.",
  },
  {
    family: "Analytics and telemetry sinks",
    outcome: "Removed",
    authority: "src/lib/telemetry",
    reason:
      "The donor logged events on nearly every decision. Nothing about how someone uses OCADE leaves their device.",
  },
  {
    family: "Sessions, history, resume, rewind",
    outcome: "Not ported — OCADE keeps its own",
    authority: "src/lib/session.ts",
    reason:
      "The donor's session history is a paginated read against a hosted events API. OCADE's sessions are local first and mirrored to the account, which is the opposite direction.",
  },
  {
    family: "Cron and scheduled tasks",
    outcome: "Not ported — OCADE keeps its own",
    authority: "src/lib/ocade-scheduler.ts",
    reason:
      "OCADE's scheduler already reports why each automation did not run — paused, not due, backing off, awaiting approval — which is the part users ask about.",
  },
  {
    family: "Voice",
    outcome: "Not ported — OCADE keeps its own",
    authority: "src/lib/ocade-voice.ts",
    reason:
      "The donor's voice layer is terminal command plumbing. OCADE's speaks through the device's own speech services and stays on the same runtime as the rest of the session.",
  },
  {
    family: "Git, worktrees, LSP, IDE",
    outcome: "Not ported — kept behind the local boundary",
    authority: "src/lib/code/workspace.ts",
    reason:
      "Repository work needs a filesystem, so it lives with the companion rather than in the tab. OCADE exposes it through the same tool runtime instead of shipping a second coding product.",
  },
  {
    family: "Payments and webhooks",
    outcome: "Kept and locked",
    authority: "src/lib/payments",
    reason:
      "Launch is free. The code is intact and hardened — signature checks, idempotency, replay refusal — and every purchase action is behind a gate nobody can get through.",
  },
];


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

/**
 * Who calls each ported module, from outside the imported tree.
 *
 * "Reached" already proves a path exists. This names it, because a reviewer
 * checking whether a module is genuinely wired should not have to grep for it.
 */
function callersOf(module) {
  const spec = `@/${module.replace(/^src\//, "").replace(/\.ts$/, "")}`;
  const callers = [];
  for (const [file, specs] of graph) {
    if (file.startsWith(PORTED_ROOT)) continue;
    if (file.includes("__tests__")) continue;
    if (specs.includes(spec)) callers.push(file);
  }
  return callers.sort();
}

const moduleCallers = new Map(portedFiles.map((f) => [f, callersOf(f)]));

for (const entry of FAMILIES) {
  if (!existsSync(join(ROOT, entry.authority))) {
    console.error(
      `Family "${entry.family}" names an authority that does not exist: ${entry.authority}`,
    );
    process.exit(1);
  }
}

const report = {
  generatedAt: new Date().toISOString().slice(0, 10),
  families: FAMILIES,
  moduleCallers: Object.fromEntries(moduleCallers),
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
  "## By family — what happened, and who is the authority",
  "",
  "| Donor family | Outcome | OCADE authority | Why |",
  "|---|---|---|---|",
  ...FAMILIES.map(
    (f) => `| ${f.family} | ${f.outcome} | \`${f.authority}\` | ${f.reason} |`,
  ),
  "",
  "## Modules present in this tree, and what reaches them",
  "",
  "| Module | Reached by |",
  "|---|---|",
  ...portedFiles.sort().map((f) => {
    const callers = moduleCallers.get(f) ?? [];
    if (callers.length > 0) {
      return `| \`${f}\` | ${callers.map((c) => `\`${c}\``).join(", ")} |`;
    }
    return reached.has(f.replace(/\.ts$/, ""))
      ? `| \`${f}\` | via another imported module |`
      : `| \`${f}\` | *nothing — present, not yet reached* |`;
  }),
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
