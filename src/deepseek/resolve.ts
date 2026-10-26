import { transform } from "esbuild";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import aliases from "./aliases.json";

const ROOT = resolve(import.meta.dirname, "../..");
const UPSTREAM = resolve(ROOT, "external/deepseek-harness/upstream");
const SHIMS = resolve(import.meta.dirname, "shims");
/** Node built-ins the upstream source imports, and the browser stand-in for each. */
const BROWSER_SHIMS: Record<string, string> = {
  "node:async_hooks": "async_hooks.ts",
  "node:buffer": "buffer.ts",
  "node:crypto": "crypto.ts",
  "node:fs": "fs.ts",
  "node:module": "module.ts",
  "node:os": "os.ts",
  "node:path": "path.ts",
  "node:util/types": "util-types.ts",
};

/**
 * One upstream DeepSeek file as OCADE runs it. Its standard decorators and `using` declarations
 * are lowered (Vite 8's own transformer leaves decorators as written, and no shipped runtime
 * parses them). Its Node built-ins become the stand-ins in src/deepseek/shims: always
 * `node:module` (it only reads upstream's own version, which a Worker cannot read from disk),
 * and every one of them for the browser. The rewrite is in the source, not in resolution,
 * because test runners resolve built-ins before any plugin sees them. `none` only lowers
 * (upstream's own test kits in vitest.deepseek.config.ts).
 */
export async function lowerVendored(
  code: string,
  id: string,
  runtime: "browser" | "server" | "none",
): Promise<{ code: string; map: string }> {
  const lowered = await transform(code, {
    loader: "ts",
    format: "esm",
    target: "es2022",
    sourcefile: id,
    sourcemap: true,
  });
  const shimmed = lowered.code.replace(/(from |import )"(node:[\w/]+)"/g, (whole, lead, name) => {
    const shim = BROWSER_SHIMS[name];
    const wanted = runtime === "browser" || (runtime === "server" && name === "node:module");
    return shim && wanted ? `${lead}${JSON.stringify(resolve(SHIMS, shim))}` : whole;
  });
  return { code: shimmed, map: lowered.map };
}

/**
 * Runs the pinned DeepSeek Harness submodule's own source in Vite and Vitest
 * (scripts/deepseek-link.mjs): its package names resolve to the files in the submodule. `browser` gives every environment the browser's stand-ins, so
 * Vitest can prove the source under the browser's semantics; otherwise only Vite's client does.
 */
export function deepseekUpstream(options: { browser?: boolean } = {}): Plugin {
  const entries = aliases as Record<string, string>;
  return {
    name: "ocade-deepseek-upstream",
    enforce: "pre",
    resolveId(source) {
      return source in entries ? resolve(ROOT, entries[source]!) : null;
    },
    transform(code, id) {
      if (!id.startsWith(UPSTREAM) || !id.endsWith(".ts")) return null;
      const browser = options.browser || this.environment?.config.consumer === "client";
      return lowerVendored(code, id, browser ? "browser" : "server");
    },
  };
}
