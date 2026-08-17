import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";

/**
 * OCADE Phase-5 production wiring gate.
 *
 * The historical authority defined a module as production-wired only when it is
 * transitively reachable from a production entry point. Test imports do not
 * count. This gate reconstructs that reachability from source imports and fails
 * if any of the ten historically test-only modules becomes orphaned again.
 */

const ROOT = process.cwd();
const SRC = resolve(ROOT, "src");

const HISTORICAL_ORPHANS = [
  "src/lib/research/research-run.ts",
  "src/lib/research/http-source.ts",
  "src/lib/research/research-cache.ts",
  "src/lib/research/source-fallback.ts",
  "src/lib/mobile/secure-channel.ts",
  "src/lib/mobile/transport-adapters.ts",
  "src/lib/mobile/reconnect-protocol.ts",
  "src/lib/packaging/update-signature.ts",
  "src/lib/providers/free-tool-adapters.ts",
  "src/lib/code/generated-sandbox-node.ts",
];

const REQUIRED_CI_FILES = [
  ".github/workflows/ci.yml",
  ".github/workflows/platforms.yml",
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const INDEX_SUFFIXES = [
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
  "/index.mjs",
  "/index.cjs",
];

function posix(path) {
  return path.split(sep).join("/");
}

function repoPath(abs) {
  return posix(relative(ROOT, abs));
}

function isTestLike(path) {
  const p = posix(path).toLowerCase();
  return (
    p.includes("/__tests__/") ||
    p.includes("/test/") ||
    p.includes("/tests/") ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(p)
  );
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (["node_modules", ".git", "dist", "coverage"].includes(name)) continue;
      walk(abs, out);
      continue;
    }
    if (SOURCE_EXTENSIONS.has(extname(name)) && !isTestLike(abs)) out.push(resolve(abs));
  }
  return out;
}

const sourceFiles = new Set(walk(SRC));

function resolveSourceCandidate(base) {
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = normalize(`${base}${suffix}`);
    if (sourceFiles.has(candidate)) return candidate;
  }
  for (const suffix of INDEX_SUFFIXES) {
    const candidate = normalize(`${base}${suffix}`);
    if (sourceFiles.has(candidate)) return candidate;
  }
  return null;
}

function resolveImport(fromFile, specifier) {
  if (!specifier || specifier.startsWith("node:")) return null;
  if (specifier.startsWith("@/")) {
    return resolveSourceCandidate(resolve(SRC, specifier.slice(2)));
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return resolveSourceCandidate(resolve(dirname(fromFile), specifier));
  }
  return null;
}

function importsFor(file) {
  const text = readFileSync(file, "utf8");
  const specs = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) specs.add(match[1]);
  }
  return [...specs]
    .map((specifier) => resolveImport(file, specifier))
    .filter((value) => value !== null);
}

const graph = new Map();
for (const file of sourceFiles) graph.set(file, importsFor(file));

const entrypoints = [...sourceFiles].filter((abs) => {
  const p = repoPath(abs);
  return (
    p.startsWith("src/routes/") ||
    ["src/server.ts", "src/start.ts", "src/router.tsx", "src/routeTree.gen.ts"].includes(p)
  );
});

const reachable = new Set(entrypoints);
const parent = new Map();
const queue = [...entrypoints];
while (queue.length > 0) {
  const current = queue.shift();
  for (const dependency of graph.get(current) ?? []) {
    if (reachable.has(dependency)) continue;
    reachable.add(dependency);
    parent.set(dependency, current);
    queue.push(dependency);
  }
}

function chainFor(target) {
  const chain = [target];
  let cursor = target;
  while (parent.has(cursor)) {
    cursor = parent.get(cursor);
    chain.push(cursor);
    if (chain.length > 40) break;
  }
  return chain.reverse().map(repoPath);
}

const errors = [];
for (const path of HISTORICAL_ORPHANS) {
  const abs = resolve(ROOT, path);
  if (!existsSync(abs)) {
    errors.push(`${path}: source file is missing`);
    continue;
  }
  if (!reachable.has(abs)) {
    errors.push(`${path}: NOT reachable from any production entry point`);
    continue;
  }
  console.log(`wired: ${path}`);
  console.log(`  ${chainFor(abs).join(" -> ")}`);
}

for (const path of REQUIRED_CI_FILES) {
  if (!existsSync(resolve(ROOT, path))) errors.push(`${path}: required CI workflow is not tracked`);
  else console.log(`tracked CI owner: ${path}`);
}

if (entrypoints.length === 0) errors.push("No production entry points were discovered.");

if (errors.length > 0) {
  console.error("OCADE Phase-5 production wiring FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OCADE Phase-5 production wiring OK");
console.log(`- production entry points scanned: ${entrypoints.length}`);
console.log(`- production source modules reachable: ${reachable.size}`);
console.log(`- historical test-only modules reachable: ${HISTORICAL_ORPHANS.length}/${HISTORICAL_ORPHANS.length}`);
console.log("- runtime availability is NOT inferred by this source-graph gate");
