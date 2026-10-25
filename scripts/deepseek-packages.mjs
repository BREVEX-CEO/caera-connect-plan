/**
 * The DeepSeek Harness workspace's own package resolution, read from its package manifests:
 * `@deepseek-ai/x[/sub]` → the `src/` file that package exports for that subpath.
 * Shared by scripts/deepseek-vendor.mjs and the dev-only upstream-spec run (vitest.deepseek.config.ts).
 */
import fs from "node:fs";
import path from "node:path";

const asSource = (target) =>
  target
    .replace(/^\.\//, "")
    .replace(/^lib\/types\//, "src/")
    .replace(/^lib\//, "src/")
    .replace(/\.d\.ts$/, ".ts")
    .replace(/\.[cm]?js$/, ".ts");

export const firstFile = (base) =>
  [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find(
    (c) => fs.existsSync(c) && fs.statSync(c).isFile(),
  );

export function upstreamResolver(root) {
  const packages = new Map();
  (function scan(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "lib", "tests", "test"].includes(e.name) || e.name.startsWith("."))
        continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) scan(p);
      else if (e.name === "package.json") {
        const json = JSON.parse(fs.readFileSync(p, "utf8"));
        if (json.name?.startsWith("@deepseek-ai/")) packages.set(json.name, { dir, json });
      }
    }
  })(path.join(root, "packages"));
  for (const name of fs.readdirSync(path.join(root, "vendor"))) {
    const p = path.join(root, "vendor", name, "package.json");
    if (!fs.existsSync(p)) continue;
    const json = JSON.parse(fs.readFileSync(p, "utf8"));
    packages.set(json.name, { dir: path.dirname(p), json });
  }

  function resolveSpecifier(specifier) {
    const [, name, sub] = specifier.match(/^(@deepseek-ai\/[^/]+)(\/.*)?$/) ?? [];
    const pkg = packages.get(name);
    if (!pkg) return null;
    const key = sub ? `.${sub}` : ".";
    const exported = pkg.json.exports?.[key];
    const target = exported
      ? typeof exported === "string"
        ? exported
        : (exported.default ?? exported.import ?? exported.types)
      : key === "."
        ? "src/index.ts"
        : key;
    return firstFile(path.join(pkg.dir, key.startsWith("./src/") ? key : asSource(target)));
  }

  return { packages, resolveSpecifier };
}
