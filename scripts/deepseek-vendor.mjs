#!/usr/bin/env node
/**
 * Pinned DeepSeek Harness source, vendored verbatim.
 *
 *   node scripts/deepseek-vendor.mjs          copy the closure from the submodule, write the
 *                                             manifest and the tsconfig `paths` that resolve it
 *   node scripts/deepseek-vendor.mjs --check  prove every vendored file is byte-identical to the
 *                                             pinned upstream blob (CI has no submodule, so the
 *                                             manifest's git blob ids are the record)
 *
 * The closure is every file the entry packages import, type-only imports included (tsc reads
 * them), walked through each package's own `exports`. Files are never edited here: a change an
 * OCADE runtime needs is a shim in src/deepseek/shims/, chosen by the importer (vite.config.ts).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { firstFile, upstreamResolver } from "./deepseek-packages.mjs";

const PIN = "687f282e8625c6b8d11ff58211a90524be2e4317";
const ENTRIES = ["@deepseek-ai/dsh-agent-loop"];
const ROOT = process.cwd();
const UPSTREAM = path.join(ROOT, "external/deepseek-harness/upstream");
const OUT = path.join(ROOT, "src/deepseek/upstream");
const MANIFEST = path.join(OUT, "MANIFEST.json");
/** Licence and notice files that travel with the source. */
const NOTICES = ["LICENSE", "THIRD_PARTY_NOTICES.md"];

const blobId = (bytes) =>
  createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

if (process.argv.includes("--check")) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const problems = [];
  if (manifest.pin !== PIN) problems.push(`manifest pin ${manifest.pin} is not ${PIN}`);
  for (const [file, id] of Object.entries(manifest.files)) {
    const at = path.join(OUT, file);
    if (!fs.existsSync(at)) problems.push(`missing ${file}`);
    else if (blobId(fs.readFileSync(at)) !== id) problems.push(`edited ${file}`);
    const pinned = path.join(UPSTREAM, file);
    if (fs.existsSync(pinned) && blobId(fs.readFileSync(pinned)) !== id) {
      problems.push(`differs from the checked-out submodule: ${file}`);
    }
  }
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : [path.relative(OUT, p).split(path.sep).join("/")];
    });
  for (const file of walk(OUT)) {
    if (file !== "MANIFEST.json" && !(file in manifest.files)) problems.push(`unlisted ${file}`);
  }
  if (problems.length) {
    console.error(`deepseek:check FAILED\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`deepseek:check ok: ${Object.keys(manifest.files).length} files verbatim at ${PIN}`);
  process.exit(0);
}

if (!fs.existsSync(path.join(UPSTREAM, "package.json"))) {
  console.error("The submodule is not checked out: git submodule update --init");
  process.exit(1);
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
  const source = fs.readFileSync(file, "utf8");
  for (const m of source.matchAll(IMPORT)) {
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

fs.rmSync(OUT, { recursive: true, force: true });
const manifest = { pin: PIN, entries: ENTRIES, externals: [...externals].sort(), files: {} };
const copy = (absolute) => {
  const rel = path.relative(UPSTREAM, absolute).split(path.sep).join("/");
  const bytes = fs.readFileSync(absolute);
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
  fs.writeFileSync(path.join(OUT, rel), bytes);
  manifest.files[rel] = blobId(bytes);
};
for (const file of [...files].sort()) copy(file);
for (const notice of NOTICES) copy(path.join(UPSTREAM, notice));
// Each contributing package's manifest (name, version, licence; dsh-llm reads its own version
// from it at run time) and, for the vendored third-party packages, their own licence.
for (const { dir } of packages.values()) {
  if (![...files].some((f) => f.startsWith(dir + path.sep))) continue;
  copy(path.join(dir, "package.json"));
  const licence = path.join(dir, "LICENSE");
  if (fs.existsSync(licence)) copy(licence);
}
manifest.files = Object.fromEntries(Object.entries(manifest.files).sort());
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

// The same resolution for tsc, Vite (tsconfigPaths) and Vitest (it reads these paths).
/*
 * One resolution, three readers. Vite and Vitest run the vendored source (aliases.json). The
 * upstream code is type-checked as upstream compiles it (tsconfig.upstream.json, its own strict
 * options; Cordis relaxed as in vendor/cordis/tsconfig.json), and OCADE's own program reads the
 * declarations that check emits, so OCADE's options never re-judge upstream source.
 */
const sorted = [...specifiers]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([spec, file]) => [spec, path.relative(UPSTREAM, file).split(path.sep).join("/")]);
const DEEPSEEK = path.join(ROOT, "src/deepseek");
fs.writeFileSync(
  path.join(DEEPSEEK, "aliases.json"),
  `${JSON.stringify(Object.fromEntries(sorted.map(([s, f]) => [s, `src/deepseek/upstream/${f}`])), null, 2)}\n`,
);
fs.writeFileSync(
  path.join(DEEPSEEK, "tsconfig.paths.json"),
  `${JSON.stringify(
    {
      compilerOptions: {
        paths: {
          ...Object.fromEntries(sorted.map(([s, f]) => [s, [`./upstream/${f}`]])),
        },
      },
    },
    null,
    2,
  )}\n`,
);
// tsconfig.json holds comments, so only its `paths` object is rewritten.
const tsconfigPath = path.join(ROOT, "tsconfig.json");
const declared = sorted.map(
  ([spec, file]) =>
    `      "${spec}": ["./src/deepseek/.types/${file.replace(/^(packages|vendor)\//, "$1/").replace(/\.tsx?$/, ".d.ts")}"]`,
);
const tsconfig = fs
  .readFileSync(tsconfigPath, "utf8")
  .replace(
    /"paths": \{[^}]*\}/,
    `"paths": {\n      "@/*": ["./src/*"],\n${declared.join(",\n")}\n    }`,
  );
fs.writeFileSync(tsconfigPath, tsconfig);

// Generated configs in the repository's own format.
execFileSync(
  "npx",
  ["prettier", "--write", "--log-level=warn", "tsconfig.json", "src/deepseek/*.json"],
  { stdio: "inherit" },
);

console.log(
  `vendored ${files.size} source files (${specifiers.size} package entry points) at ${PIN}; externals: ${manifest.externals.join(", ") || "none"}`,
);
