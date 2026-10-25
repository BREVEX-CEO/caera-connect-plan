import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vitest/config";
import { lowerVendored } from "./src/deepseek/resolve";
// @ts-expect-error -- a plain ESM script shared with scripts/deepseek-vendor.mjs, without types.
import { upstreamResolver } from "./scripts/deepseek-packages.mjs";

/**
 * DEV-ONLY: upstream's own DeepSeek Harness specs, run against the source OCADE vendors, under the
 * browser's semantics. `npm run deepseek:specs` (needs `git submodule update --init`).
 *
 * The vendored files (src/deepseek/upstream/MANIFEST.json) get exactly what the browser build
 * gives them (lowerVendored): the stand-ins in src/deepseek/shims for every Node built-in,
 * async context included. Upstream's test kits and fixtures keep Node's own, as upstream runs them. A spec
 * that passes here is upstream's contract holding for the code OCADE ships to the browser.
 */
const ROOT = import.meta.dirname;
const UPSTREAM = path.join(ROOT, "external/deepseek-harness/upstream");
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/deepseek/upstream/MANIFEST.json"), "utf8"),
) as { files: Record<string, string> };
const vendored = new Set(Object.keys(manifest.files).map((file) => path.join(UPSTREAM, file)));

function upstreamSpecs(): Plugin {
  const { resolveSpecifier } = upstreamResolver(UPSTREAM) as {
    resolveSpecifier(specifier: string): string | undefined;
  };
  return {
    name: "ocade-deepseek-specs",
    enforce: "pre",
    resolveId(source) {
      return source.startsWith("@deepseek-ai/") ? (resolveSpecifier(source) ?? null) : null;
    },
    transform(code, id) {
      if (!id.startsWith(UPSTREAM) || !id.endsWith(".ts")) return null;
      // DEEPSEEK_NATIVE=1: the same run on Node's own built-ins, to tell a stand-in failure from any other.
      const browser = vendored.has(id) && !process.env.DEEPSEEK_NATIVE;
      return lowerVendored(code, id, browser ? "browser" : "none");
    },
  };
}

export default defineConfig({
  plugins: [upstreamSpecs()],

  test: {
    root: UPSTREAM,
    environment: "node",
    include: (process.env.DEEPSEEK_SPECS ?? "packages/core/agent-loop/tests/*.spec.ts").split(","),
  },
});
