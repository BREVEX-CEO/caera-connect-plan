#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { unzipSync } from "fflate";

const ROOT = resolve(process.cwd());
const STAGING = join(ROOT, "imports", "ocade-primary-logic");
const SOURCE = join(STAGING, "source");
const PROVENANCE = join(STAGING, "provenance", "legacy-docs");
const ZIP_ROOT = "OCADE_PRIMARY_LOGIC/";
const ZIP_PATH = process.argv[2] ? resolve(process.argv[2]) : null;
const replace = process.argv.includes("--replace");

if (!ZIP_PATH || !existsSync(ZIP_PATH)) {
  console.error("Usage: node scripts/import-ocade-primary-logic.mjs <path-to-zip> [--replace]");
  process.exit(2);
}

if (existsSync(SOURCE)) {
  if (!replace) {
    console.error(`Refusing to overwrite ${relative(ROOT, SOURCE)}. Re-run with --replace after reviewing the current import.`);
    process.exit(2);
  }
  rmSync(SOURCE, { recursive: true, force: true });
}

mkdirSync(SOURCE, { recursive: true });
mkdirSync(PROVENANCE, { recursive: true });

const archiveBytes = readFileSync(ZIP_PATH);
const archiveSha256 = createHash("sha256").update(archiveBytes).digest("hex");
const files = unzipSync(new Uint8Array(archiveBytes));

const inventory = [];
const staleDocNames = new Set(["Skill.md", "agent.md"]);

function assertSafeRelativePath(input) {
  if (!input || input.includes("\0")) throw new Error(`Unsafe empty/NUL path: ${JSON.stringify(input)}`);
  const unix = input.replaceAll("\\", "/");
  if (unix.startsWith("/") || /^[A-Za-z]:\//.test(unix)) throw new Error(`Absolute archive path rejected: ${input}`);
  const normalized = normalize(unix).replaceAll("\\", "/");
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Archive traversal path rejected: ${input}`);
  }
  return normalized;
}

function categoryFor(path) {
  if (path === "src/QueryEngine.ts" || path === "src/Task.ts" || path === "src/Tool.ts" || path === "src/tools.ts") return "core-agent";
  if (path.startsWith("src/tools/")) return "tools";
  if (path.startsWith("src/commands/")) return "commands";
  if (path.startsWith("src/components/") || path.startsWith("src/ink/") || path.startsWith("src/screens/")) return "terminal-ui";
  if (path.startsWith("src/tasks/") || path.startsWith("src/coordinator/")) return "tasks-multi-agent";
  if (path.startsWith("src/bridge/") || path.startsWith("src/remote/") || path.startsWith("src/server/")) return "remote-server";
  if (path.startsWith("src/services/")) return "services";
  if (path.startsWith("src/hooks/") || path.startsWith("src/state/") || path.startsWith("src/context/")) return "state-hooks";
  if (path.startsWith("src/memdir/") || /session|history|memory/i.test(path)) return "session-memory";
  if (path.startsWith("web/")) return "next-web-reference";
  if (path.startsWith("docker/") || path.startsWith("scripts/") || path === "Dockerfile") return "build-dev";
  return "supporting-source";
}

function dispositionFor(path, category) {
  if (staleDocNames.has(path)) return "PROVENANCE_ONLY";
  if (path.startsWith("web/")) return "REFERENCE_ONLY";
  if (path.startsWith("src/services/api/") || path.startsWith("src/services/oauth/") || path.startsWith("src/bridge/") || path.startsWith("src/remote/") || path.startsWith("src/server/")) return "QUARANTINE";
  if (/analytics|updater|remoteManagedSettings/i.test(path)) return "DO_NOT_WIRE";
  if (/BashTool|PowerShellTool|node-pty|native-ts/i.test(path)) return "LOCAL_COMPANION_ONLY";
  if (category === "terminal-ui") return "REFERENCE_ONLY";
  if (category === "tasks-multi-agent") return "ADAPT_LATER";
  if (category === "core-agent" || category === "tools" || category === "state-hooks" || category === "session-memory") return "ADAPT_SELECTIVELY";
  return "REVIEW";
}

for (const [rawName, data] of Object.entries(files)) {
  if (!rawName.startsWith(ZIP_ROOT)) continue;
  const stripped = rawName.slice(ZIP_ROOT.length);
  if (!stripped || stripped.endsWith("/")) continue;
  const safe = assertSafeRelativePath(stripped);
  if (safe === ".DS_Store" || safe.endsWith("/.DS_Store")) continue;

  const targetRoot = staleDocNames.has(safe) ? PROVENANCE : SOURCE;
  const target = resolve(targetRoot, staleDocNames.has(safe) ? safe : safe);
  const boundary = `${targetRoot}${sep}`;
  if (target !== targetRoot && !target.startsWith(boundary)) throw new Error(`Extraction boundary violation: ${safe}`);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);

  const bytes = Buffer.from(data);
  const category = categoryFor(safe);
  inventory.push({
    path: safe,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    category,
    disposition: dispositionFor(safe, category),
  });
}

inventory.sort((a, b) => a.path.localeCompare(b.path));
const countsByCategory = Object.fromEntries(
  [...new Set(inventory.map((item) => item.category))]
    .sort()
    .map((category) => [category, inventory.filter((item) => item.category === category).length]),
);
const countsByDisposition = Object.fromEntries(
  [...new Set(inventory.map((item) => item.disposition))]
    .sort()
    .map((disposition) => [disposition, inventory.filter((item) => item.disposition === disposition).length]),
);

const receipt = {
  schemaVersion: 1,
  importedAt: new Date().toISOString(),
  sourceArchive: ZIP_PATH.split(/[\\/]/).pop(),
  archiveSha256,
  archiveBytes: archiveBytes.length,
  extractedFileCount: inventory.length,
  countsByCategory,
  countsByDisposition,
  sourceDirectory: "imports/ocade-primary-logic/source",
  provenanceDirectory: "imports/ocade-primary-logic/provenance",
  status: "STAGED_NOT_PRODUCTION_WIRED",
};

writeFileSync(join(STAGING, "SOURCE_INVENTORY.json"), `${JSON.stringify(inventory, null, 2)}\n`);
writeFileSync(join(STAGING, "IMPORT_RECEIPT.json"), `${JSON.stringify(receipt, null, 2)}\n`);

console.log(JSON.stringify(receipt, null, 2));
console.log("\nImport staged successfully. Do not add this source directory to production imports until modules have been classified, adapted and tested.");
