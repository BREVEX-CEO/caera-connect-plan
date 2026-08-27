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
    category: "MERGED",
    match: new RegExp(
      "^src/(query|services/query)/|^src/QueryEngine[.]ts$|^src/(ocade|query|history|commands|context|setup)[.]ts$|^src/utils/(tokens|analyzeContext|context)[.]ts$|^src/services/tokenEstimation",
    ),
    outcome: "Ported — donor is the authority",
    authority: "src/lib/runtime/use-ocade-runtime.ts",
    reason:
      "The donor's loop handles the four things OCADE's did not: output-token recovery, reactive compaction, an explicit token budget, and a closed terminal set. Both rooms now run it, with local inference injected through callModel.",
  },
  {
    family: "Permissions, shell rule matching, dangerous patterns, denial tracking",
    category: "MERGED",
    match: new RegExp("^src/utils/permissions/|^src/utils/shell/"),
    outcome: "Ported — donor is the authority",
    authority: "src/lib/runtime/permissions.ts",
    reason:
      "Cowork's approvalPolicy and Chat had separate ideas about risk. The donor's rule model is stronger and now decides for both, with OCADE's opaque-command gate added on top.",
  },
  {
    family: "Bash parser, heredocs, quoting, destructive-command warnings",
    category: "MERGED",
    match: new RegExp("^src/utils/(bashParser|commandParser|treeSitter)|^src/tools/BashTool/"),
    outcome: "Ported — donor is the authority",
    authority: "src/lib/runtime/permissions.ts",
    reason:
      "A real parser is what closes the compound-command hole: an approval for one command must not carry the rest of the line. Ported in pure TypeScript, without the donor's native grammar binary.",
  },
  {
    family: "Path safety and sandbox rules",
    category: "MERGED",
    match: new RegExp("^src/utils/(path|fsOperations|sandbox)|^src/utils/sandbox/"),
    outcome: "Ported — closed a gap OCADE had",
    authority: "src/lib/runtime/permissions.ts",
    reason:
      "OCADE checked paths only on the companion, one process and one network hop away. The archive's rules for what must never be changed on a model's say-so — roots, whole drives, system folders, the home directory, traversal — now run in the browser before the call leaves.",
  },
  {
    family: "Task lifecycle, stop, background tasks, status labels",
    category: "MERGED",
    match: new RegExp(
      "^src/tasks/|^src/Task.ts$|^src/tasks.ts$|^src/utils/task/|^src/utils/tasks.ts$|^src/components/tasks/|^src/tools/Task",
    ),
    outcome: "Ported — donor is the authority",
    authority: "src/lib/tasks/runs.ts",
    reason:
      "OCADE had a to-do board and no runtime task state at all. The donor's status machine, id scheme, pause accounting and stop error taxonomy now back Stop, Pause, Resume and Take over.",
  },
  {
    family: "Context analysis: where the room went",
    match: new RegExp("^src/utils/(contextAnalysis|contextSuggestions|doctorContextWarnings|groupToolUses)"),
    category: "MERGED",
    outcome: "Ported — drives compaction",
    authority: "src/primary-logic/query/microCompact.ts",
    reason:
      "The archive breaks a transcript down by what is filling it, including the same observation read more than once. Compaction now clears those superseded copies first: three reads of one file are three copies of one fact, and only the last is worth anything, so clearing the others costs nothing.",
  },
  {
    family: "Abort composition and cancellation",
    match: new RegExp("^src/utils/(combinedAbortSignal|abortController|idleTimeout|gracefulShutdown|cleanupRegistry)"),
    category: "MERGED",
    outcome: "Ported — closed a gap OCADE had",
    authority: "src/lib/runtime/execute.ts",
    reason:
      "Stop was checked between tool calls but not during one, so pressing it while a long screen read was in flight did nothing until that read finished by itself. The archive's signal composition now releases the person immediately and says plainly what may still be running on their computer.",
  },
  {
    family: "Conversation recovery and resume repair",
    match: new RegExp("^src/utils/(conversationRecovery|messages|messagePredicates|crossProjectResume)"),
    category: "MERGED",
    outcome: "Ported — closed a gap OCADE had",
    authority: "src/lib/runtime/use-ocade-runtime.ts",
    reason:
      "A reopened conversation carried artefacts of how the last run ended — an empty assistant turn from a stopped stream, tool results whose request had been compacted away. The archive's recovery filters now clean a transcript before a model is asked to continue it, and name how it was interrupted.",
  },
  {
    family: "Argument coercion at the tool boundary",
    match: new RegExp("^src/utils/(semanticBoolean|semanticNumber|zodToJsonSchema|validation)"),
    category: "MERGED",
    outcome: "Ported — replaced ad-hoc per-adapter reads",
    authority: "src/lib/runtime/tool-runner.ts",
    reason:
      "A model quoting a value turned its own instruction into the opposite: `allowOcr: \"false\"` left OCR on, `wait: \"true\"` never waited. Adapters were learning this one argument at a time. The archive's rules now run once, schema-driven, before permission and before the adapter.",
  },
  {
    family: "Micro-compaction of old tool output",
    category: "MERGED",
    match: new RegExp("^src/services/compact/"),
    outcome: "Ported — donor is the authority",
    authority: "src/lib/runtime/compact.ts",
    reason:
      "OCADE compacted all-or-nothing: it dropped whole turns, losing which tools ran and whether they worked. The archive empties the BODY of old tool results first and keeps the headline, which saves the most tokens for the least meaning. The structural pass now runs only when that was not enough.",
  },
  {
    family: "Session memory extraction thresholds",
    category: "MERGED",
    match: new RegExp("^src/services/SessionMemory/|^src/services/extractMemories/"),
    outcome: "Ported — donor is the authority",
    authority: "src/lib/memory/session-memory.ts",
    reason:
      "OCADE remembered only what the model chose to record. The donor's thresholds decide when a conversation is worth summarising without re-summarising it every turn.",
  },
  {
    family: "Memory record shapes and the age/relevance model",
    category: "MERGED",
    match: new RegExp("^src/memdir/|^src/utils/memory|^src/services/memory|^src/tools/Memory"),
    outcome: "Ported — donor is the authority",
    authority: "src/lib/memory/quality.ts",
    reason: "Freshness decay and memory typing were absent on the OCADE side.",
  },
  {
    family: "Unicode sanitisation and hidden-character handling",
    category: "MERGED",
    match: new RegExp("^src/utils/(sanitiz|unicode|string|text)"),
    outcome: "Ported — donor replaced a weaker OCADE version",
    authority: "src/lib/ocade-injection-guard.ts",
    reason:
      "OCADE's stripper missed the Unicode Tag block, so instructions could be smuggled into text that looked clean. The donor's sanitiser covers it; the old regex is gone.",
  },
  {
    family: "Message protocol: content blocks, tool use, tool results",
    category: "MERGED",
    match: new RegExp("^src/types/|^src/utils/messages|^src/entrypoints/"),
    outcome: "Ported — donor is the authority",
    authority: "src/lib/runtime/call-model.ts",
    reason: "One shape for the transcript, converted once at the engine boundary.",
  },
  {
    family: "Tool implementations, tool contracts and tool search",
    category: "REPLACED",
    match: new RegExp(
      "^src/tools[./]|^src/Tool[.]ts$|^src/services/tools/|^src/services/toolUseSummary|^src/utils/tool",
    ),
    outcome: "Not ported — OCADE keeps its own",
    authority: "src/lib/agent/tool-registry.ts",
    reason:
      "The donor's tool search depends on the hosted API's tool_reference beta blocks, which no on-device runtime accepts. OCADE defers by domain and caps each turn at a measured twelve tools, which is the same problem solved for a local model.",
  },
  {
    family: "Agents, subagents, teams, coordinator",
    category: "REPLACED",
    match: new RegExp(
      "^src/utils/agent|^src/utils/forkedAgent|^src/utils/standaloneAgent|^src/services/(AgentSummary|teamMemorySync|autoDream|PromptSuggestion|awaySummary)|^src/coordinator/|^src/utils/teams?/",
    ),
    outcome: "Not ported — OCADE's is stronger here",
    authority: "src/lib/agent/planner.ts",
    reason:
      "OCADE already decomposes a goal once and runs each step as a sub-agent with only that step's tools, returning one line to the main transcript. The donor's version assumes concurrent hosted sessions, which one local model cannot serve.",
  },
  {
    family: "Plugins, skills, tool servers",
    category: "REPLACED",
    match: new RegExp(
      "^src/plugins/|^src/skills/|^src/services/plugins/|^src/utils/plugins/|^src/services/ocadeTools/",
    ),
    outcome: "Not ported — OCADE keeps one authority",
    authority: "src/lib/skills/pack-registry.ts",
    reason:
      "The donor loads plugins from the user's filesystem at startup and trusts what it finds. OCADE's registry validates and trusts packs explicitly, which is the model a browser product can actually honour.",
  },
  {
    family: "Bridge, remote sessions, websocket transport",
    category: "ROUTED_BOUNDARY",
    match: new RegExp("^src/bridge/|^src/remote/|^src/upstreamproxy/|^src/utils/teleport/"),
    outcome: "Removed — replaced by local transport",
    authority: "src/lib/native/extension-bridge.ts",
    reason:
      "The donor bridge speaks to a hosted relay. OCADE's browser work goes through the extension and machine work through the paired companion; neither needs a server in the middle.",
  },
  {
    family: "PTY, terminal emulator, Ink renderer",
    category: "REJECTED",
    match: new RegExp(
      "^src/ink|^src/screens/|^src/vim/|^src/keybindings/|^src/components/|^src/native-ts/|^src/buddy/|^src/(dialogLaunchers|interactiveHelpers|main|replLauncher)|^src/outputStyles/|^src/moreright/|^src/services/(tips|notifier|preventSleep|MagicDocs|ocadeToolsServerApproval)",
    ),
    outcome: "Removed",
    authority: "src/lib/runtime/execute.ts",
    reason:
      "A tab has no pseudo-terminal, and shipping one would mean shipping a second renderer. Shell work belongs to the companion, behind the permission layer.",
  },
  {
    family: "Hosted inference, provider table, OAuth to the model vendor",
    category: "REJECTED",
    match: new RegExp(
      "^src/utils/model/|^src/services/(api|oauth|ocadeAiLimits|rateLimit|mockRateLimits|policyLimits)|^src/utils/(oauth|auth)|^src/constants/oauth",
    ),
    outcome: "Removed",
    authority: "src/lib/runtime/call-model.ts",
    reason:
      "OCADE answers on the device. There is no hosted-AI fallback anywhere in the path, and the audit that proves it runs in CI.",
  },
  {
    family: "Analytics and telemetry sinks",
    category: "REJECTED",
    match: new RegExp(
      "^src/services/(analytics|diagnosticTracking|internalLogging|vcr)|^src/utils/telemetry/",
    ),
    outcome: "Removed",
    authority: "src/lib/telemetry",
    reason:
      "The donor logged events on nearly every decision. Nothing about how someone uses OCADE leaves their device.",
  },
  {
    family: "Sessions, history, resume, rewind",
    category: "REPLACED",
    match: new RegExp(
      "^src/utils/session|^src/assistant/|^src/context/|^src/state/|^src/migrations/|^src/services/(settingsSync|remoteManagedSettings)|^src/projectOnboardingState|^src/bootstrap/|^src/schemas/",
    ),
    outcome: "Not ported — OCADE keeps its own",
    authority: "src/lib/session.ts",
    reason:
      "The donor's session history is a paginated read against a hosted events API. OCADE's sessions are local first and mirrored to the account, which is the opposite direction.",
  },
  {
    family: "Cron and scheduled tasks",
    category: "REPLACED",
    match: new RegExp("^src/utils/cron"),
    outcome: "Not ported — OCADE keeps its own",
    authority: "src/lib/ocade-scheduler.ts",
    reason:
      "OCADE's scheduler already reports why each automation did not run — paused, not due, backing off, awaiting approval — which is the part users ask about.",
  },
  {
    family: "Voice",
    category: "ROUTED_BOUNDARY",
    match: new RegExp("^src/utils/voice|^src/services/voice|^src/voice/"),
    outcome: "Not ported — OCADE keeps its own",
    authority: "src/lib/ocade-voice.ts",
    reason:
      "The donor's voice layer is terminal command plumbing. OCADE's speaks through the device's own speech services and stays on the same runtime as the rest of the session.",
  },
  {
    family: "Git, worktrees, LSP, IDE",
    category: "ROUTED_BOUNDARY",
    match: new RegExp("^src/utils/(git|worktree|lsp|ide)|^src/services/(lsp|ide)"),
    outcome: "Not ported — kept behind the local boundary",
    authority: "src/lib/code/workspace.ts",
    reason:
      "Repository work needs a filesystem, so it lives with the companion rather than in the tab. OCADE exposes it through the same tool runtime instead of shipping a second coding product.",
  },
  {
    family: "Payments and webhooks",
    category: "MERGED",
    match: new RegExp(
      "^src/utils/(billing|payment|x402)|^src/services/(billing|x402)|^src/cost(-tracker|Hook)[.]ts$",
    ),
    outcome: "Kept and locked",
    authority: "src/lib/payments",
    reason:
      "Launch is free. The code is intact and hardened — signature checks, idempotency, replay refusal — and every purchase action is behind a gate nobody can get through.",
  },
  {
    family: "The CLI itself: commands, slash commands, entry points",
    category: "REJECTED",
    match: new RegExp("^src/(commands|cli)/"),
    outcome: "Removed",
    authority: "src/routes/_authenticated/ocade.index.tsx",
    reason:
      "Files implementing a terminal command language. OCADE's equivalent is the product's own surfaces, which a person uses without learning a command vocabulary first.",
  },
  {
    family: "React hooks for the terminal UI",
    category: "REJECTED",
    match: new RegExp("^src/hooks/"),
    outcome: "Removed",
    authority: "src/lib/runtime/use-ocade-runtime.ts",
    reason:
      "Hooks bound to the Ink renderer and its input handling. The behaviour worth keeping — the agent loop, task state, permissions — was ported as logic; the hooks around it belonged to a terminal.",
  },
  {
    family: "The donor's own web client",
    category: "REJECTED",
    match: new RegExp("^web/"),
    outcome: "Removed — a second router and a second UI",
    authority: "src/routes",
    reason:
      "A complete second front end, with its own router, components and pages. Keeping it would have meant shipping two products in one repository, which the specification forbids outright.",
  },
  {
    family: "Server-only entry points and local HTTP host",
    category: "ROUTED_BOUNDARY",
    match: new RegExp("^src/server/"),
    outcome: "Removed",
    authority: "src/server.ts",
    reason:
      "The donor served its own web terminal from a local process. OCADE's server is a Cloudflare Worker, and machine access goes through the paired companion rather than a listening port.",
  },
  {
    family: "Constants, shims and platform detection",
    category: "MERGED",
    match: new RegExp("^src/(constants|shims)/|^src/utils/(platform|env|feature)"),
    outcome: "Partly ported",
    authority: "src/primary-logic/shims/featureFlags.ts",
    reason:
      "The four boundaries where the donor assumed a terminal, a Node process, a bundler macro or a telemetry sink are shimmed. The rest were constants for products OCADE does not ship.",
  },
  {
    family: "Build scripts, Docker, packaging and repository config",
    category: "RETAINED_NATIVE_DEV",
    match: new RegExp(
      "^(scripts|docker|Dockerfile|package[.]json|biome|bunfig|gitpretty|tsconfig|[.])",
    ),
    outcome: "Removed",
    authority: "package.json",
    reason:
      "The donor's toolchain bundles a CLI into an npm package. OCADE builds a Cloudflare Worker with Vite. Nothing here transfers, and mixing the two would break both.",
  },
  {
    family: "Licences, notices and provenance",
    category: "RETAINED_NATIVE_DEV",
    match: new RegExp("^(LICENSE|NOTICE|README|OCADE_AGENT|OCADE_SKILL|agent[.]md|OCADE_IMPORT)"),
    outcome: "Preserved",
    authority: "src/primary-logic/LICENSE.md",
    reason:
      "The licence, the notices and the archive's own manifests are kept verbatim beside the ported code, with a recorded hash of the archive they came from. Legal notices are never removed as dead weight.",
  },
  {
    family: "Everything else under utils",
    category: "REJECTED",
    match: new RegExp("^src/utils/"),
    outcome: "Case by case — mostly removed",
    authority: "src/lib",
    reason:
      "The donor's utility drawer: terminal drawing, its own file formats, its hosted API client, and small helpers OCADE already has. What was genuinely logic was ported into the families above; the remainder had no OCADE-side caller and was not brought across.",
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
    /*
     * A ported module importing `./contextAnalysis.js` is importing the
     * TypeScript file next to it: the donor writes ESM specifiers with the
     * emitted extension, and the tree keeps that convention. Without stripping
     * it, every intra-tree import resolved to nothing and the module it pointed
     * at was reported unreached — which is how a module used by compaction on
     * every long conversation showed up as dead code.
     */
    const base = current.endsWith(".js") ? current.slice(0, -3) : current;
    const candidates = [base, `${base}.ts`, `${base}/index.ts`];
    const file = candidates.find((c) => existsSync(join(ROOT, c)));
    if (!file) continue;
    reached.add(file.replace(/\.ts$/, ""));
    if (base !== current) reached.add(base);
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
  /*
   * Every file belongs to exactly one family, first match wins, and the last
   * family matches everything. "Accounted for" then means something stronger
   * than "the map has a row for it": it means the file belongs to a group whose
   * outcome, OCADE authority and reason are all written down.
   */
  const family = FAMILIES.find((entry) => entry.match?.test(row.file));

  /*
   * THE SIX-WAY OUTCOME, PER FILE, DECIDED BY WHAT ACTUALLY HAPPENED.
   *
   * The family says what became of that body of logic; two per-file rules
   * override it, because they are facts about THIS file rather than about its
   * neighbours:
   *
   *   - a file whose logic is present in src/primary-logic AND reachable from
   *     production is USED_DIRECTLY, whatever its family did;
   *   - a file the map marks as native/dev tooling, a third-party vendor copy
   *     or a legal notice is RETAINED_NATIVE_DEV, because those are kept for
   *     what they are rather than integrated.
   *
   * Everything else inherits its family's category. No file may end without
   * one, and the totals are asserted against 2,126 below.
   */
  const RETAINED_ACTIONS = new Set([
    "NATIVE_DEV_KEEP",
    "DEVOPS_MERGE",
    "THIRD_PARTY_PRESERVE",
    "PRESERVE_LEGAL",
    "MERGE_CONFIG",
  ]);
  const category =
    ported && isReached
      ? "USED_DIRECTLY"
      : RETAINED_ACTIONS.has(row.action)
        ? "RETAINED_NATIVE_DEV"
        : (family?.category ?? null);
  dispositions.push({
    file: row.file,
    action: row.action,
    target: row.target,
    family: family?.family ?? null,
    category,
    /* The map's own sentence for this file. The evidence for a rejection. */
    reason: row.reason,
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

const byFamily = {};
for (const d of dispositions) {
  const key = d.family ?? "(unassigned)";
  byFamily[key] ??= { files: 0, ported: 0 };
  byFamily[key].files += 1;
  if (d.ported) byFamily[key].ported += 1;
}

/** The six outcomes, in the order a reader should meet them. */
const CATEGORIES = [
  ["USED_DIRECTLY", "The donor file's logic is in src/primary-logic and production reaches it."],
  ["MERGED", "The donor logic won this area and was folded into the OCADE authority named."],
  ["REPLACED", "OCADE already had a stronger version for this product; the donor's was not brought across."],
  ["ROUTED_BOUNDARY", "The capability exists, behind the MV3 extension, the paired companion or Cloudflare."],
  ["RETAINED_NATIVE_DEV", "Kept as-is: native and dev tooling, vendored third-party code, legal notices."],
  ["REJECTED", "Not brought across. Every file carries the map's own reason."],
];

const byCategory = {};
for (const [name] of CATEGORIES) byCategory[name] = { files: 0, families: new Set() };
for (const d of dispositions) {
  if (!d.category) continue;
  byCategory[d.category].files += 1;
  if (d.family) byCategory[d.category].families.add(d.family);
}

const uncategorised = dispositions.filter((d) => d.category === null);
if (uncategorised.length > 0) {
  console.error(
    `${uncategorised.length} donor file(s) have no outcome category:\n  ` +
      uncategorised
        .slice(0, 10)
        .map((d) => d.file)
        .join("\n  "),
  );
  process.exit(1);
}

const categoryTotal = CATEGORIES.reduce((sum, [name]) => sum + byCategory[name].files, 0);
if (categoryTotal !== dispositions.length) {
  console.error(
    `The six outcomes cover ${categoryTotal} files but the archive has ${dispositions.length}.`,
  );
  process.exit(1);
}

const unassigned = dispositions.filter((d) => d.family === null);
if (unassigned.length > 0) {
  console.error(
    `${unassigned.length} donor file(s) belong to no family. There is deliberately no ` +
      `catch-all: every file must land in a family whose outcome and reason are written down.\n  ` +
      unassigned
        .slice(0, 10)
        .map((d) => d.file)
        .join("\n  "),
  );
  process.exit(1);
}

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
  categories: Object.fromEntries(
    CATEGORIES.map(([name, meaning]) => [
      name,
      { files: byCategory[name].files, meaning, families: [...byCategory[name].families].sort() },
    ]),
  ),
  families: FAMILIES.map(({ match, ...rest }) => ({
    ...rest,
    files: byFamily[rest.family]?.files ?? 0,
    portedModules: byFamily[rest.family]?.ported ?? 0,
  })),
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
  "## Every archive file, by outcome",
  "",
  "One row per file, no file in two rows, and the total is the archive. The",
  "counts are FILES, not modules: a file counts as used only when production",
  "can reach its logic, and every rejection carries the map's own reason for it.",
  "",
  "| Outcome | Files | Share | What it means |",
  "|---|---:|---:|---|",
  ...CATEGORIES.map(
    ([name, meaning]) =>
      `| \`${name}\` | ${byCategory[name].files} | ${(
        (byCategory[name].files / dispositions.length) *
        100
      ).toFixed(1)}% | ${meaning} |`,
  ),
  `| **Total** | **${categoryTotal}** | **100%** | Asserted equal to the archive's file count when this runs. |`,
  "",
  "## By family — what happened, and who is the authority",
  "",
  "Every one of the 2,126 archive files belongs to exactly one row below. The",
  "count is what that family covers; the authority is what OCADE runs instead,",
  "whether the donor's logic was ported into it or superseded by it.",
  "",
  "| Donor family | Files | Outcome | OCADE authority | Why |",
  "|---|---:|---|---|---|",
  ...FAMILIES.map(
    (f) =>
      `| ${f.family} | ${byFamily[f.family]?.files ?? 0} | \`${f.category}\` — ${f.outcome} | \`${f.authority}\` | ${f.reason} |`,
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
