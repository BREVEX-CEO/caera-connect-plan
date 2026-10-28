import fs from "node:fs";
import path from "node:path";
import { normalizePath } from "vite";
import { defineConfig, type Plugin } from "vitest/config";
import { lowerVendored } from "./src/deepseek/resolve";
// @ts-expect-error -- a plain ESM script shared with scripts/deepseek-link.mjs, without types.
import { upstreamResolver } from "./scripts/deepseek-packages.mjs";

/**
 * DEV-ONLY: upstream's own DeepSeek Harness specs, run against the source OCADE builds, under the
 * browser's semantics. `npm run deepseek:specs` (needs `git submodule update --init`).
 *
 * The files OCADE ships (src/deepseek/closure.json) get exactly what the browser build
 * gives them (lowerVendored): the stand-ins in src/deepseek/shims for every Node built-in,
 * async context included. Upstream's test kits and fixtures keep Node's own, as upstream runs them. A spec
 * that passes here is upstream's contract holding for the code OCADE ships to the browser.
 */
const ROOT = import.meta.dirname;
const UPSTREAM = normalizePath(path.join(ROOT, "external/deepseek-harness/upstream"));
const closure = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/deepseek/closure.json"), "utf8"),
) as { files: string[] };
const shipped = new Set(closure.files.map((file) => normalizePath(path.join(UPSTREAM, file))));

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
      id = normalizePath(id);
      if (!id.startsWith(`${UPSTREAM}/`) || !id.endsWith(".ts")) return null;
      // DEEPSEEK_NATIVE=1: the same run on Node's own built-ins, to tell a stand-in failure from any other.
      const browser = shipped.has(id) && !process.env.DEEPSEEK_NATIVE;
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
