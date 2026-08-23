import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";

/**
 * OCADE Phase-5 production wiring gate.
 *
 * The historical authority defined a module as production-wired only when it is
 * transitively reachable from a production entry point. Test imports do not
 * count. A historical module may also be materially resolved by an explicit,
 * production-owned replacement/retirement, but only when this gate can verify
 * the replacement and the old capability is not advertised as live.
 */

const ROOT = process.cwd();
const SRC = resolve(ROOT, "src");

const LIVE_HISTORICAL_MODULES = [
  "src/lib/research/research-run.ts",
  "src/lib/research/http-source.ts",
  "src/lib/research/research-cache.ts",
  "src/lib/research/source-fallback.ts",
  "src/lib/mobile/secure-channel.ts",
  "src/lib/mobile/transport-adapters.ts",
  "src/lib/mobile/reconnect-protocol.ts",
  "src/lib/providers/free-tool-adapters.ts",
  "src/lib/code/generated-sandbox-node.ts",
];

const REPLACED_HISTORICAL_MODULES = [
  {
    path: "src/lib/packaging/update-signature.ts",
    replacement: "Tauri native updater signature verification",
    evidence: [
      {
        path: "native/companion/tauri/Cargo.toml",
        patterns: [/tauri-plugin-updater\s*=\s*"2"/],
      },
      {
        path: "native/companion/tauri/src/main.rs",
        patterns: [
          /tauri_plugin_updater::Builder::new\(\)\.build\(\)/,
          /unsigned or mis-signed bundle is\s*\n?\s*\/\/ rejected/i,
        ],
      },
      {
        path: ".github/workflows/release.yml",
        patterns: [/workflow_dispatch:/, /if:\s*\$\{\{\s*false\s*\}\}/],
      },
      {
        path: "src/routes/download.tsx",
        patterns: [/FREE_LAUNCH_MODE/, /redirect\(\{\s*to:\s*"\/"\s*\}\)/],
      },
    ],
  },
];

const REQUIRED_CI_FILES = [
  ".github/workflows/ci.yml",
  ".github/workflows/platforms.yml",
  ".github/workflows/ocade-77-readiness.yml",
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

function verifyReplacement(item) {
  if (!existsSync(resolve(ROOT, item.path))) {
    return {
      ok: false,
      reason: `${item.path}: historical source file is missing without an explicit deletion record`,
    };
  }
  for (const proof of item.evidence) {
    const abs = resolve(ROOT, proof.path);
    if (!existsSync(abs)) {
      return {
        ok: false,
        reason: `${item.path}: replacement evidence file is missing: ${proof.path}`,
      };
    }
    const text = readFileSync(abs, "utf8");
    for (const pattern of proof.patterns) {
      if (!pattern.test(text)) {
        return {
          ok: false,
          reason: `${item.path}: replacement evidence no longer matches ${proof.path} (${pattern})`,
        };
      }
    }
  }
  return { ok: true };
}

const errors = [];
let wiredCount = 0;
let replacedCount = 0;

for (const path of LIVE_HISTORICAL_MODULES) {
  const abs = resolve(ROOT, path);
  if (!existsSync(abs)) {
    errors.push(`${path}: source file is missing`);
    continue;
  }
  if (!reachable.has(abs)) {
    errors.push(`${path}: NOT reachable from any production entry point`);
    continue;
  }
  wiredCount += 1;
  console.log(`wired: ${path}`);
  console.log(`  ${chainFor(abs).join(" -> ")}`);
}

for (const item of REPLACED_HISTORICAL_MODULES) {
  const verdict = verifyReplacement(item);
  if (!verdict.ok) {
    errors.push(verdict.reason);
    continue;
  }
  replacedCount += 1;
  console.log(`replaced/retired: ${item.path}`);
  console.log(`  production owner: ${item.replacement}`);
  console.log(
    "  public desktop distribution remains disabled until external signing/device proof exists",
  );
}

for (const path of REQUIRED_CI_FILES) {
  if (!existsSync(resolve(ROOT, path))) errors.push(`${path}: required CI workflow is not tracked`);
  else console.log(`tracked CI owner: ${path}`);
}

if (entrypoints.length === 0) errors.push("No production entry points were discovered.");

const totalHistorical = LIVE_HISTORICAL_MODULES.length + REPLACED_HISTORICAL_MODULES.length;
if (wiredCount + replacedCount !== totalHistorical) {
  errors.push(
    `historical production-wiring dispositions: expected ${totalHistorical}, proved ${wiredCount + replacedCount}`,
  );
}

if (errors.length > 0) {
  console.error("OCADE Phase-5 production wiring FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OCADE Phase-5 production wiring OK");
console.log(`- production entry points scanned: ${entrypoints.length}`);
console.log(`- production source modules reachable: ${reachable.size}`);
console.log(
  `- historical modules directly/transitively production-wired: ${wiredCount}/${totalHistorical}`,
);
console.log(
  `- historical modules replaced/retired with production proof: ${replacedCount}/${totalHistorical}`,
);
console.log(
  `- historical Phase-5 dispositions materially resolved: ${wiredCount + replacedCount}/${totalHistorical}`,
);
console.log(
  "- runtime availability, signed public release, hardware success and hosted CI are NOT inferred by this source gate",
);
