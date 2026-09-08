/**
 * Refresh the immutable donor facts in the canonical disposition ledger.
 *
 * This command is intentionally separate from the normal integration check.
 * The raw archive is provenance material and does not ship in the repository,
 * so refresh requires an explicitly supplied, disposable extraction directory.
 * Normal CI validates the checked-in ledger and regenerates the human report
 * without needing or executing donor source.
 *
 * Usage:
 *   node scripts/generate-donor-disposition.mjs --archive <rar> --archive-root <directory>
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const EXPECTED_ARCHIVE_SHA256 = "FD831F6C817AF1DBADCD6CBC67EC17CD11D0A8EDB7E01343FA60766FF11B17CD";
const EXPECTED_ARCHIVE_BYTES = 10_143_937;
const EXPECTED_FILES = 2126;
const OUTPUT = "imports/ocade-primary-logic/OCADE_PRIMARY_LOGIC_DISPOSITION.jsonl";
const SEED_REPORT = "imports/ocade-primary-logic/INTEGRATION_REPORT.json";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".json"]);
const RESOLUTION_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];
const DONOR_COUNTERPARTS = Object.freeze({
  "src/utils/bash/bashParser.ts": "src/primary-logic/commands/bashParser.ts",
  "src/tools/BashTool/destructiveCommandWarning.ts":
    "src/primary-logic/commands/destructiveCommandWarning.ts",
  "src/utils/powershell/dangerousCmdlets.ts":
    "src/primary-logic/commands/powershellCodeExecution.ts",
  "src/tools/PowerShellTool/destructiveCommandWarning.ts":
    "src/primary-logic/commands/powershellDestructiveWarning.ts",
  "src/utils/bash/treeSitterAnalysis.ts": "src/primary-logic/commands/treeSitterAnalysis.ts",
  "src/memdir/memoryAge.ts": "src/primary-logic/memory/memoryAge.ts",
  "src/memdir/memoryTypes.ts": "src/primary-logic/memory/memoryTypes.ts",
  "src/services/SessionMemory/sessionMemoryUtils.ts":
    "src/primary-logic/memory/sessionMemoryPolicy.ts",
  "src/utils/hooks/ssrfGuard.ts": "src/primary-logic/net/mappedAddress.ts",
  "src/utils/permissions/dangerousPatterns.ts":
    "src/primary-logic/permissions/dangerousPatterns.ts",
  "src/utils/permissions/denialTracking.ts": "src/primary-logic/permissions/denialTracking.ts",
  "src/utils/permissions/pathValidation.ts": "src/primary-logic/permissions/pathSafety.ts",
  "src/utils/permissions/PermissionMode.ts": "src/primary-logic/permissions/PermissionMode.ts",
  "src/utils/permissions/PermissionRule.ts": "src/primary-logic/permissions/PermissionRule.ts",
  "src/utils/permissions/permissionRuleParser.ts":
    "src/primary-logic/permissions/permissionRuleParser.ts",
  "src/utils/permissions/PermissionUpdateSchema.ts":
    "src/primary-logic/permissions/PermissionUpdateSchema.ts",
  "src/utils/settings/permissionValidation.ts": "src/primary-logic/permissions/ruleReview.ts",
  "src/utils/permissions/shellRuleMatching.ts":
    "src/primary-logic/permissions/shellRuleMatching.ts",
  "src/types/permissions.ts": "src/primary-logic/permissions/types.ts",
  "src/types/ocadeModelProtocol.ts": "src/primary-logic/protocol/modelProtocol.ts",
  "src/utils/combinedAbortSignal.ts": "src/primary-logic/query/abortSignals.ts",
  "src/utils/tokenBudget.ts": "src/primary-logic/query/budgetText.ts",
  "src/utils/contextAnalysis.ts": "src/primary-logic/query/contextAnalysis.ts",
  "src/query/deps.ts": "src/primary-logic/query/deps.ts",
  "src/services/compact/microCompact.ts": "src/primary-logic/query/microCompact.ts",
  "src/query.ts": "src/primary-logic/query/query.ts",
  "src/utils/QueryGuard.ts": "src/primary-logic/query/queryGuard.ts",
  "src/utils/conversationRecovery.ts": "src/primary-logic/query/resume.ts",
  "src/query/tokenBudget.ts": "src/primary-logic/query/tokenBudget.ts",
  "src/query/transitions.ts": "src/primary-logic/query/transitions.ts",
  "src/types/ocadeFeatureFlags.ts": "src/primary-logic/shims/featureFlags.ts",
  "src/Task.ts": "src/primary-logic/tasks/lifecycle.ts",
  "src/tasks/pillLabel.ts": "src/primary-logic/tasks/pillLabel.ts",
  "src/tasks/stopTask.ts": "src/primary-logic/tasks/stopTask.ts",
  "src/utils/lazySchema.ts": "src/primary-logic/text/lazySchema.ts",
  "src/utils/sanitization.ts": "src/primary-logic/text/sanitization.ts",
  "src/utils/semanticBoolean.ts": "src/primary-logic/text/semanticValues.ts",
});
const MERGED_FAMILIES = new Set([
  "Abort composition and cancellation",
  "Argument coercion at the tool boundary",
  "Bash parser, heredocs, quoting, destructive-command warnings",
  "Constants, shims and platform detection",
  "Context analysis: where the room went",
  "Conversation recovery and resume repair",
  "Memory record shapes and the age/relevance model",
  "Message protocol: content blocks, tool use, tool results",
  "Micro-compaction of old tool output",
  "Path safety and sandbox rules",
  "Payments and webhooks",
  "Permission rule review: validation and shadow detection",
  "Permissions, shell rule matching, dangerous patterns, denial tracking",
  "PowerShell code-execution cmdlets",
  "Query engine, deps, transitions, token budget, stop hooks",
  "Run re-entrancy: one query at a time",
  "SSRF guard: IPv4 addresses written as IPv6",
  "Session memory extraction thresholds",
  "Task lifecycle, stop, background tasks, status labels",
  "Unicode sanitisation and hidden-character handling",
]);
const REPLACED_FAMILIES = new Set([
  "Agents, subagents, teams, coordinator",
  "Bridge, remote sessions, websocket transport",
  "Buddy: the status and approval companion",
  "Cron and scheduled tasks",
  "Git, worktrees, LSP, IDE",
  "Plugins, skills, tool servers",
  "Server-only entry points and local HTTP host",
  "Sessions, history, resume, rewind",
  "Tool implementations, tool contracts and tool search",
  "Voice",
]);

const archiveRootIndex = process.argv.indexOf("--archive-root");
const archiveIndex = process.argv.indexOf("--archive");
if (
  archiveRootIndex < 0 ||
  !process.argv[archiveRootIndex + 1] ||
  archiveIndex < 0 ||
  !process.argv[archiveIndex + 1]
) {
  console.error(
    "Usage: node scripts/generate-donor-disposition.mjs --archive <rar> --archive-root <directory>",
  );
  process.exit(2);
}

const root = resolve(process.argv[archiveRootIndex + 1]);
const archive = resolve(process.argv[archiveIndex + 1]);
if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`Archive root is not a directory: ${root}`);
  process.exit(2);
}
if (!existsSync(archive) || !statSync(archive).isFile()) {
  console.error(`Archive is not a file: ${archive}`);
  process.exit(2);
}
const archiveBytes = readFileSync(archive);
const archiveSha256 = createHash("sha256").update(archiveBytes).digest("hex").toUpperCase();
if (archiveBytes.length !== EXPECTED_ARCHIVE_BYTES || archiveSha256 !== EXPECTED_ARCHIVE_SHA256) {
  console.error(
    `Archive identity mismatch: ${archiveBytes.length} bytes, SHA-256 ${archiveSha256}.`,
  );
  process.exit(1);
}

function walk(directory, output = []) {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path, output);
    else output.push(path);
  }
  return output;
}

const normalize = (path) => path.replace(/\\/g, "/");
const archiveFiles = walk(root)
  .map((absolutePath) => ({
    absolutePath,
    archivePath: normalize(relative(root, absolutePath)),
  }))
  .sort((left, right) =>
    left.archivePath < right.archivePath ? -1 : left.archivePath > right.archivePath ? 1 : 0,
  );

if (archiveFiles.length !== EXPECTED_FILES) {
  console.error(`Expected ${EXPECTED_FILES} archive files; found ${archiveFiles.length}.`);
  process.exit(1);
}

const seed = JSON.parse(readFileSync(SEED_REPORT, "utf8"));
if (seed.dispositions?.length !== EXPECTED_FILES) {
  console.error(`${SEED_REPORT} does not contain ${EXPECTED_FILES} seed dispositions.`);
  process.exit(1);
}
const seedByPath = new Map(seed.dispositions.map((item) => [item.file, item]));
const familyByName = new Map(seed.families.map((item) => [item.family, item]));

const sourcePaths = new Set(
  archiveFiles
    .filter(({ archivePath }) => SOURCE_EXTENSIONS.has(extname(archivePath).toLowerCase()))
    .map(({ archivePath }) => archivePath),
);

function importSpecifiers(source) {
  const specs = [];
  const patterns = [
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specs.push(match[1]);
  }
  return specs;
}

function resolveRelative(fromPath, specifier) {
  if (!specifier.startsWith(".")) return null;
  const raw = normalize(join(dirname(fromPath), specifier));
  const withoutJs = /\.(?:js|jsx|mjs|cjs)$/.test(raw)
    ? raw.replace(/\.(?:js|jsx|mjs|cjs)$/, "")
    : raw;
  const candidates = new Set();
  for (const base of [raw, withoutJs]) {
    for (const extension of RESOLUTION_EXTENSIONS) candidates.add(`${base}${extension}`);
    for (const extension of RESOLUTION_EXTENSIONS.slice(1))
      candidates.add(`${base}/index${extension}`);
  }
  return [...candidates].find((candidate) => sourcePaths.has(candidate)) ?? undefined;
}

const donorGraph = new Map();
const donorImports = new Map();
for (const { absolutePath, archivePath } of archiveFiles) {
  if (!sourcePaths.has(archivePath)) continue;
  const source = readFileSync(absolutePath, "utf8");
  const internalDependencies = [];
  const brokenRelativeImports = [];
  for (const specifier of importSpecifiers(source)) {
    const resolvedPath = resolveRelative(archivePath, specifier);
    if (resolvedPath) internalDependencies.push(resolvedPath);
    else if (specifier.startsWith(".") || specifier.startsWith("@/")) {
      /*
       * The donor's independent graph does not assume a project-wide @ alias:
       * it exists only in the disconnected web client's tsconfig. Recording
       * these as unresolved is intentional and reproduces the physical archive
       * evidence instead of silently granting the donor a build configuration
       * its primary source tree does not have.
       */
      brokenRelativeImports.push(specifier);
    }
  }
  donorGraph.set(archivePath, [...new Set(internalDependencies)].sort());
  donorImports.set(archivePath, {
    internalDependencies: [...new Set(internalDependencies)].sort(),
    brokenRelativeImports,
  });
}

/*
 * Roots are files the extracted product itself names as runnable/build input:
 * package entry points, build scripts, CLI entry points and Next application
 * entries. A no-incoming-edge file is not automatically a root; treating every
 * orphan as an entry would make reachability tautological.
 */
const roots = [...sourcePaths]
  .filter((path) => path === "package.json" || /^src\/entrypoints\//.test(path))
  .sort();
const reachable = new Set();
const queue = [...roots];
while (queue.length) {
  const current = queue.pop();
  if (!current || reachable.has(current) || !sourcePaths.has(current)) continue;
  reachable.add(current);
  for (const dependency of donorGraph.get(current) ?? []) queue.push(dependency);
}

function trackedFiles() {
  try {
    const bytes = execFileSync("git", ["ls-files", "-z"]);
    return bytes
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .filter((path) => !path.startsWith("imports/ocade-primary-logic/source/"));
  } catch {
    return [];
  }
}

const currentHashes = new Map();
for (const path of trackedFiles()) {
  if (!existsSync(path) || statSync(path).isDirectory()) continue;
  const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
  const matches = currentHashes.get(hash) ?? [];
  matches.push(normalize(path));
  currentHashes.set(hash, matches);
}

const languageByExtension = new Map([
  [".ts", "TypeScript"],
  [".tsx", "TypeScript JSX"],
  [".js", "JavaScript"],
  [".json", "JSON"],
  [".md", "Markdown"],
  [".css", "CSS"],
  [".html", "HTML"],
  [".svg", "SVG"],
  [".sh", "Shell"],
  [".toml", "TOML"],
  [".yml", "YAML"],
  [".example", "Environment template"],
  [".gitkeep", "Empty placeholder"],
]);

function languageOf(path) {
  if (path === "Dockerfile") return "Dockerfile";
  return languageByExtension.get(extname(path).toLowerCase()) ?? "Plain text";
}

function platformClass(path, source) {
  if (/^(README|LICENSE|NOTICE|agent|OCADE_).*[.]md$/i.test(path)) return "documentation";
  if (/^(docker|scripts)\//.test(path) || /(?:Dockerfile|tsconfig|biome|bunfig)/.test(path)) {
    return "development";
  }
  if (/^web\//.test(path) || /\b(?:window|document|navigator|chrome)\b/.test(source)) {
    return "browser";
  }
  if (/^src\/(?:server|upstreamproxy)\//.test(path)) return "server";
  if (/^src\/(?:native-ts|cli|ink)\//.test(path) || /\b(?:node:|process\.|Bun\.)/.test(source)) {
    return "native";
  }
  return "shared";
}

function runtimeAssumptionsOf(path, source) {
  const assumptions = [];
  if (/\b(?:node:|process\.|Buffer\b)/.test(source)) assumptions.push("Node.js process APIs");
  if (/\bBun\./.test(source) || /bunfig|bun-plugin/.test(path))
    assumptions.push("Bun runtime or build tool");
  if (/from\s*['"]ink['"]|@inkjs|^src\/ink\//.test(source) || /^src\/ink\//.test(path)) {
    assumptions.push("Terminal React/Ink renderer");
  }
  if (/\b(?:window|document|navigator|chrome)\b/.test(source) || /^web\//.test(path)) {
    assumptions.push("Browser DOM or extension APIs");
  }
  if (/^src\/(?:server|upstreamproxy)\//.test(path))
    assumptions.push("Long-lived local/server process");
  if (/^src\/native-ts\//.test(path)) assumptions.push("Native companion boundary");
  if (assumptions.length === 0)
    assumptions.push("No runtime-specific assumption detected statically");
  return assumptions;
}

const TEST_BY_AUTHORITY = [
  [/runtime\/permissions/, "src/lib/runtime/__tests__/permissions.test.ts"],
  [/runtime\/use-ocade-runtime/, "src/lib/runtime/__tests__/shared-runtime.test.ts"],
  [/runtime\/execute/, "src/lib/runtime/__tests__/execute.test.ts"],
  [/runtime\/compact/, "src/lib/runtime/__tests__/compact.test.ts"],
  [/tasks\/runs/, "src/lib/tasks/__tests__/runs.test.ts"],
  [/memory/, "src/lib/memory/__tests__/session-memory.test.ts"],
  [/research\/public-network/, "src/lib/__tests__/ssrf-guard.test.ts"],
  [/code\/workspace/, "src/lib/__tests__/code-workspace.test.ts"],
  [/payments/, "src/lib/payments/__tests__/webhook-apply.test.ts"],
  [/native/, "src/lib/__tests__/native-extension-bridge.test.ts"],
  [/skills/, "src/lib/__tests__/skills.test.ts"],
];

function requiredTests(authority) {
  const tests = ["src/lib/__tests__/integration-report.test.ts"];
  const match = TEST_BY_AUTHORITY.find(([pattern]) => pattern.test(authority));
  if (match && existsSync(match[1])) tests.push(match[1]);
  return [...new Set(tests)];
}

function finalDisposition(seedItem, archivePath) {
  if (DONOR_COUNTERPARTS[archivePath] || MERGED_FAMILIES.has(seedItem.family)) return "MERGE";
  if (REPLACED_FAMILIES.has(seedItem.family)) return "REPLACE";
  if (/(?:LICENSE|NOTICE|OCADE_IMPORT_MANIFEST)/i.test(archivePath)) return "KEEP";
  return "REMOVE";
}

const records = archiveFiles.map(({ absolutePath, archivePath }) => {
  const seedItem = seedByPath.get(archivePath);
  if (!seedItem) throw new Error(`No prior disposition for ${archivePath}`);
  const family = familyByName.get(seedItem.family);
  if (!family) throw new Error(`No family authority for ${archivePath}: ${seedItem.family}`);
  const bytes = readFileSync(absolutePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const source = SOURCE_EXTENSIONS.has(extname(archivePath).toLowerCase())
    ? bytes.toString("utf8")
    : "";
  const imports = donorImports.get(archivePath) ?? {
    internalDependencies: [],
    brokenRelativeImports: [],
  };
  const destination = DONOR_COUNTERPARTS[archivePath] ?? family.authority;
  const disposition = finalDisposition(seedItem, archivePath);
  const familyReason = family.reason ?? family.usefulBehavior;
  if (!familyReason) throw new Error(`No family rationale for ${archivePath}: ${seedItem.family}`);
  const exactMatches = (currentHashes.get(sha256) ?? []).filter(
    (path) => !path.startsWith("imports/ocade-primary-logic/"),
  );
  return {
    archiveSha256: EXPECTED_ARCHIVE_SHA256,
    archivePath,
    size: bytes.length,
    sha256,
    language: languageOf(archivePath),
    family: seedItem.family,
    internalDependencies: imports.internalDependencies,
    brokenRelativeImports: imports.brokenRelativeImports,
    runtimeAssumptions: runtimeAssumptionsOf(archivePath, source),
    platformClass: platformClass(archivePath, source),
    donorReachability: !sourcePaths.has(archivePath)
      ? "NOT_SOURCE"
      : reachable.has(archivePath)
        ? "REACHABLE"
        : "UNREACHABLE",
    exactCurrentSourceMatches: exactMatches.sort(),
    currentOcadeEquivalent: destination,
    currentOcadeReachability: DONOR_COUNTERPARTS[archivePath]
      ? "PRODUCTION_REACHABLE"
      : existsSync(destination)
        ? "AUTHORITY_PRESENT"
        : "NOT_PRESENT",
    usefulBehavior: familyReason,
    qualityRepairNeeds:
      imports.brokenRelativeImports.length > 0
        ? `Repair or replace ${imports.brokenRelativeImports.length} unresolved relative import occurrence(s) before any behavior is adopted.`
        : archivePath === "package.json"
          ? "Malformed JSON and donor package authority must not be used."
          : "No archive-local broken relative import was detected; adoption still requires OCADE interface, safety and provenance review.",
    canonicalDestination: destination,
    migrationAction: seedItem.action,
    requiredCallers: seed.moduleCallers?.[destination] ?? [],
    requiredTests: requiredTests(destination),
    verificationTest: requiredTests(destination)[0],
    finalDisposition: disposition,
    legacyOutcome: seedItem.category,
    sourceMapReason: seedItem.reason,
    exactReason: `${seedItem.reason} ${familyReason}`.replace(/\s+/g, " ").trim(),
  };
});

const text = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
writeFileSync(OUTPUT, text, "utf8");

const summary = {
  archiveSha256: EXPECTED_ARCHIVE_SHA256,
  files: records.length,
  sourceGraphFiles: sourcePaths.size,
  reachable: records.filter((item) => item.donorReachability === "REACHABLE").length,
  unreachable: records.filter((item) => item.donorReachability === "UNREACHABLE").length,
  brokenOccurrences: records.reduce((sum, item) => sum + item.brokenRelativeImports.length, 0),
  brokenPairs: records
    .filter((item) => item.brokenRelativeImports.length > 0)
    .reduce((sum, item) => sum + new Set(item.brokenRelativeImports).size, 0),
  exactMatches: records.reduce((sum, item) => sum + item.exactCurrentSourceMatches.length, 0),
};
console.log(`Wrote ${OUTPUT}`);
console.log(JSON.stringify(summary, null, 2));
