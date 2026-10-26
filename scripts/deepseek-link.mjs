#!/usr/bin/env node
/**
 * DeepSeek Harness source, built directly from the pinned submodule.
 *
 *   node scripts/deepseek-link.mjs          walk the closure of ENTRIES in the submodule and write
 *                                           the resolution every tool reads (aliases.json for Vite and
 *                                           Vitest, tsconfig paths and file lists for tsc, closure.json)
 *   node scripts/deepseek-link.mjs --check  fail unless the submodule is checked out at PIN, every
 *                                           closure file is unmodified there, and the committed
 *                                           resolution is what the walk produces
 *
 * There is no copy: Vite, Vitest and tsc compile `external/deepseek-harness/upstream` itself
 * (`git submodule update --init`; CI checks it out). The closure is every file the entry packages
 * import, type-only imports included (tsc reads them), walked through each package's own
 * `exports`. Files are never edited: a change an OCADE runtime needs is a shim in
 * src/deepseek/shims/, applied by src/deepseek/resolve.ts.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { firstFile, upstreamResolver } from "./deepseek-packages.mjs";

const PIN = "687f282e8625c6b8d11ff58211a90524be2e4317";
const ENTRIES = [
  "@deepseek-ai/dsh-agent-loop",
  "@deepseek-ai/dsh-tool-todo",
  "@deepseek-ai/dsh-tool-ask-user",
];
const ROOT = process.cwd();
const SUBMODULE = "external/deepseek-harness/upstream";
const UPSTREAM = path.join(ROOT, SUBMODULE);
const DEEPSEEK = path.join(ROOT, "src/deepseek");
const CLOSURE = path.join(DEEPSEEK, "closure.json");
const ALIASES = path.join(DEEPSEEK, "aliases.json");

const git = (...args) =>
  execFileSync("git", ["-C", UPSTREAM, ...args], { encoding: "utf8" }).trim();
const fail = (problems) => {
  console.error(`deepseek:check FAILED\n  ${problems.join("\n  ")}`);
  process.exit(1);
};

if (!fs.existsSync(path.join(UPSTREAM, "package.json"))) {
  fail([`${SUBMODULE} is not checked out: git submodule update --init ${SUBMODULE}`]);
}

const { packages, resolveSpecifier } = upstreamResolver(UPSTREAM);
const files = new Set();
const specifiers = new Map();
const externals = new Set();
// Imports, re-exports, dynamic imports, side-effect imports, and `declare module` augmentations.
const IMPORT =
  /(?:import|export)\s+(?:type\s+)?[^'";]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]|^declare module\s+['"]([^'"]+)['"]/gm;
function walk(file) {
  if (files.has(file)) return;
  files.add(file);
  for (const m of fs.readFileSync(file, "utf8").matchAll(IMPORT)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (spec.startsWith(".")) {
      const next = firstFile(path.resolve(path.dirname(file), spec).replace(/\.js$/, ".ts"));
      if (next) walk(next);
    } else if (spec.startsWith("@deepseek-ai/")) {
      const next = resolveSpecifier(spec);
      if (!next) throw new Error(`${path.relative(UPSTREAM, file)}: cannot resolve ${spec}`);
      specifiers.set(spec, next);
      walk(next);
    } else if (!spec.startsWith("node:"))
      externals.add(
        spec
          .split("/")
          .slice(0, spec.startsWith("@") ? 2 : 1)
          .join("/"),
      );
  }
}
for (const entry of ENTRIES) {
  const file = resolveSpecifier(entry);
  specifiers.set(entry, file);
  walk(file);
}

const rel = (file) => path.relative(UPSTREAM, file).split(path.sep).join("/");
const sources = [...files].map(rel).sort();
const contributing = [...packages.values()]
  .filter(({ dir }) => [...files].some((f) => f.startsWith(dir + path.sep)))
  .map(({ json }) => json.name)
  .sort();
const closure = {
  pin: PIN,
  entries: ENTRIES,
  packages: contributing,
  externals: [...externals].sort(),
  files: sources,
};
const sorted = [...specifiers]
  .map(([spec, file]) => [spec, rel(file)])
  .sort(([a], [b]) => a.localeCompare(b));
const aliases = Object.fromEntries(sorted.map(([s, f]) => [s, `${SUBMODULE}/${f}`]));

if (process.argv.includes("--check")) {
  const problems = [];
  let head = "";
  try {
    head = git("rev-parse", "HEAD");
  } catch {
    problems.push(`${SUBMODULE} is not a git checkout`);
  }
  if (head && head !== PIN) problems.push(`${SUBMODULE} is at ${head}, not the pin ${PIN}`);
  if (head) {
    const changed = git("status", "--porcelain", "--", ...sources);
    if (changed) problems.push(`closure files differ from the pin:\n${changed}`);
  }
  const committed = (file) => JSON.stringify(JSON.parse(fs.readFileSync(file, "utf8")));
  if (committed(CLOSURE) !== JSON.stringify(closure))
    problems.push("src/deepseek/closure.json is stale: npm run deepseek:link");
  if (committed(ALIASES) !== JSON.stringify(aliases))
    problems.push("src/deepseek/aliases.json is stale: npm run deepseek:link");
  if (problems.length) fail(problems);
  console.log(
    `deepseek:check ok: ${sources.length} files from ${contributing.length} packages, built from ${SUBMODULE} at ${PIN}`,
  );
  process.exit(0);
}

fs.writeFileSync(CLOSURE, `${JSON.stringify(closure, null, 2)}\n`);
fs.writeFileSync(ALIASES, `${JSON.stringify(aliases, null, 2)}\n`);

/*
 * One resolution, three readers. Vite and Vitest compile the submodule's files (aliases.json). The
 * upstream code is type-checked as upstream compiles it (tsconfig.upstream.json, its own strict
 * options; Cordis relaxed as in vendor/cordis/tsconfig.json), and OCADE's own program reads the
 * declarations that check emits, so OCADE's options never re-judge upstream source.
 */
const fromDeepseek = (f) =>
  path.relative(DEEPSEEK, path.join(UPSTREAM, f)).split(path.sep).join("/");
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
writeJson(path.join(DEEPSEEK, "tsconfig.paths.json"), {
  compilerOptions: { paths: Object.fromEntries(sorted.map(([s, f]) => [s, [fromDeepseek(f)]])) },
});
// Each project lists exactly its closure files; declarations land in .types/ under upstream's layout.
const project = (name, prefix) => {
  const at = path.join(DEEPSEEK, name);
  const { include: _, ...tsconfig } = JSON.parse(fs.readFileSync(at, "utf8"));
  tsconfig.compilerOptions.rootDir = fromDeepseek("");
  tsconfig.files = sources.filter((f) => f.startsWith(prefix)).map(fromDeepseek);
  writeJson(at, tsconfig);
};
project("tsconfig.upstream.json", "packages/");
project("tsconfig.vendor.json", "vendor/");
// tsconfig.json holds comments, so only its `paths` object is rewritten.
const tsconfigPath = path.join(ROOT, "tsconfig.json");
const declared = sorted.map(
  ([spec, file]) =>
    `      "${spec}": ["./src/deepseek/.types/${file.replace(/\.tsx?$/, ".d.ts")}"]`,
);
fs.writeFileSync(
  tsconfigPath,
  fs
    .readFileSync(tsconfigPath, "utf8")
    .replace(
      /"paths": \{[^}]*\}/,
      `"paths": {\n      "@/*": ["./src/*"],\n${declared.join(",\n")}\n    }`,
    ),
);

// Generated configs in the repository's own format.
execFileSync(
  "npx",
  ["prettier", "--write", "--log-level=warn", "tsconfig.json", "src/deepseek/*.json"],
  { stdio: "inherit" },
);

console.log(
  `linked ${sources.length} source files from ${contributing.length} packages (${specifiers.size} entry points) at ${PIN}; externals: ${closure.externals.join(", ") || "none"}`,
);
