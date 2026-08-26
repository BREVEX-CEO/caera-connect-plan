#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { unzipSync } from "fflate";

const ROOT = resolve(process.cwd());
const STAGING = join(ROOT, "imports", "ocade-primary-logic");
const SOURCE = join(STAGING, "source");
const PROVENANCE = join(STAGING, "provenance", "legacy-docs");
const SOURCE_INPUT = process.argv[2] ? resolve(process.argv[2]) : null;
const replace = process.argv.includes("--replace");

if (!SOURCE_INPUT || !existsSync(SOURCE_INPUT)) {
  console.error(
    "Usage: node scripts/import-ocade-primary-logic.mjs <path-to-extracted-directory-or-zip> [--replace]",
  );
  process.exit(2);
}

if (existsSync(SOURCE)) {
  if (!replace) {
    console.error(
      `Refusing to overwrite ${relative(ROOT, SOURCE)}. Re-run with --replace after reviewing the current import.`,
    );
    process.exit(2);
  }
  rmSync(SOURCE, { recursive: true, force: true });
}

mkdirSync(SOURCE, { recursive: true });
mkdirSync(PROVENANCE, { recursive: true });

function assertSafeRelativePath(input) {
  if (!input || input.includes("\0")) throw new Error(`Unsafe empty/NUL path: ${JSON.stringify(input)}`);
  const unix = input.replaceAll("\\", "/");
  if (unix.startsWith("/") || /^[A-Za-z]:\//.test(unix)) {
    throw new Error(`Absolute archive path rejected: ${input}`);
  }
  const normalized = normalize(unix).replaceAll("\\", "/");
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Archive traversal path rejected: ${input}`);
  }
  return normalized.replace(/^\.\//, "");
}

function walkDirectory(root, current = root, output = []) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(root, absolute, output);
    } else if (entry.isFile()) {
      output.push({ path: assertSafeRelativePath(relative(root, absolute)), data: readFileSync(absolute) });
    }
  }
  return output;
}

function stripSingleCommonRoot(entries) {
  const useful = entries.filter((entry) => entry.path && !entry.path.endsWith("/"));
  if (!useful.length) return useful;
  const firstSegments = new Set(useful.map((entry) => entry.path.replaceAll("\\", "/").split("/")[0]));
  if (firstSegments.size !== 1) return useful;
  const [root] = [...firstSegments];
  if (useful.some((entry) => !entry.path.replaceAll("\\", "/").includes("/"))) return useful;
  return useful.map((entry) => ({ ...entry, path: entry.path.replaceAll("\\", "/").slice(root.length + 1) }));
}

function loadInput(inputPath) {
  const stats = statSync(inputPath);

  if (stats.isDirectory()) {
    const entries = stripSingleCommonRoot(walkDirectory(inputPath));
    return {
      kind: "directory",
      inputName: basename(inputPath),
      inputBytes: null,
      inputSha256: null,
      entries,
    };
  }

  const extension = extname(inputPath).toLowerCase();
  if (extension === ".rar") {
    console.error(
      "RAR extraction is intentionally not implemented in Node. Extract the RAR into a temporary directory with a trusted RAR-capable tool, verify the archive SHA-256 first, then pass that extracted directory to this importer.",
    );
    process.exit(2);
  }

  if (extension !== ".zip") {
    console.error(`Unsupported source input: ${inputPath}. Use an extracted directory or ZIP.`);
    process.exit(2);
  }

  const archiveBytes = readFileSync(inputPath);
  const files = unzipSync(new Uint8Array(archiveBytes));
  const entries = stripSingleCommonRoot(
    Object.entries(files)
      .filter(([rawName]) => rawName && !rawName.endsWith("/"))
      .map(([rawName, data]) => ({ path: assertSafeRelativePath(rawName), data: Buffer.from(data) })),
  );

  return {
    kind: "zip",
    inputName: basename(inputPath),
    inputBytes: archiveBytes.length,
    inputSha256: createHash("sha256").update(archiveBytes).digest("hex"),
    entries,
  };
}

function categoryFor(path) {
  if (path === "src/QueryEngine.ts" || path === "src/Task.ts" || path === "src/Tool.ts" || path === "src/tools.ts") {
    return "core-agent";
  }
  if (path.startsWith("src/tools/")) return "tools";
  if (path.startsWith("src/commands/")) return "commands";
  if (path.startsWith("src/components/") || path.startsWith("src/ink/") || path.startsWith("src/screens/")) {
    return "terminal-ui";
  }
  if (path.startsWith("src/tasks/") || path.startsWith("src/coordinator/")) return "tasks-multi-agent";
  if (path.startsWith("src/bridge/") || path.startsWith("src/remote/") || path.startsWith("src/server/")) {
    return "remote-server";
  }
  if (path.startsWith("src/services/")) return "services";
  if (path.startsWith("src/hooks/") || path.startsWith("src/state/") || path.startsWith("src/context/")) {
    return "state-hooks";
  }
  if (path.startsWith("src/memdir/") || /session|history|memory/i.test(path)) return "session-memory";
  if (path.startsWith("web/")) return "next-web-reference";
  if (path.startsWith("docker/") || path.startsWith("scripts/") || path === "Dockerfile") return "build-dev";
  return "supporting-source";
}

function dispositionFor(path, category) {
  if (path === "Skill.md" || path === "agent.md") return "PROVENANCE_ONLY";
  if (path.startsWith("web/")) return "REFERENCE_ONLY";
  if (
    path.startsWith("src/services/api/") ||
    path.startsWith("src/services/oauth/") ||
    path.startsWith("src/bridge/") ||
    path.startsWith("src/remote/") ||
    path.startsWith("src/server/")
  ) {
    return "QUARANTINE";
  }
  if (/analytics|updater|remoteManagedSettings/i.test(path)) return "DO_NOT_WIRE";
  if (/BashTool|PowerShellTool|node-pty|native-ts/i.test(path)) return "LOCAL_COMPANION_ONLY";
  if (category === "terminal-ui") return "REFERENCE_ONLY";
  if (category === "tasks-multi-agent") return "ADAPT_LATER";
  if (category === "core-agent" || category === "tools" || category === "state-hooks" || category === "session-memory") {
    return "ADAPT_SELECTIVELY";
  }
  return "REVIEW";
}

const loaded = loadInput(SOURCE_INPUT);
const inventory = [];
const treeHash = createHash("sha256");

for (const entry of loaded.entries) {
  const safe = assertSafeRelativePath(entry.path);
  if (!safe || safe === ".DS_Store" || safe.endsWith("/.DS_Store")) continue;

  const isProvenanceOnly = safe === "Skill.md" || safe === "agent.md";
  const targetRoot = isProvenanceOnly ? PROVENANCE : SOURCE;
  const target = resolve(targetRoot, safe);
  const boundary = `${targetRoot}${sep}`;
  if (target !== targetRoot && !target.startsWith(boundary)) {
    throw new Error(`Extraction boundary violation: ${safe}`);
  }

  const bytes = Buffer.from(entry.data);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  treeHash.update(`${safe}\0${sha256}\n`);
  const category = categoryFor(safe);
  inventory.push({
    path: safe,
    bytes: bytes.length,
    sha256,
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
  schemaVersion: 2,
  importedAt: new Date().toISOString(),
  sourceInput: loaded.inputName,
  sourceInputKind: loaded.kind,
  sourceInputSha256: loaded.inputSha256,
  sourceInputBytes: loaded.inputBytes,
  sourceTreeSha256: treeHash.digest("hex"),
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
console.log(
  "\nImport staged successfully. Do not add this source directory to production imports until modules have been classified, adapted and tested.",
);
