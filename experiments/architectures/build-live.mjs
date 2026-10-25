#!/usr/bin/env node
/**
 * Bundle live.ts for Node: node experiments/architectures/build-live.mjs <out.mjs>
 *
 * The product loop runs on the vendored DeepSeek Harness source, resolved here as Vite resolves
 * it (src/deepseek/aliases.json). esbuild lowers its decorators and `using` itself. Its one
 * `node:module` use reads upstream's own version, which a bundle cannot read, so it gets the
 * same stand-in the app ships.
 */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const aliases = JSON.parse(readFileSync(path.join(ROOT, "src/deepseek/aliases.json"), "utf8"));
const UPSTREAM = path.join(ROOT, "src/deepseek/upstream");

await build({
  entryPoints: [path.join(import.meta.dirname, "live.ts")],
  outfile: process.argv[2] ?? "/tmp/live.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  banner: {
    js: "import { createRequire as __ocadeRequire } from 'node:module'; const require = __ocadeRequire(import.meta.url);",
  },
  logLevel: "warning",
  plugins: [
    {
      name: "ocade-deepseek",
      setup(b) {
        b.onResolve({ filter: /^@deepseek-ai\// }, (args) =>
          aliases[args.path] ? { path: path.join(ROOT, aliases[args.path]) } : undefined,
        );
        b.onResolve({ filter: /^node:module$/ }, (args) =>
          args.importer.startsWith(UPSTREAM)
            ? { path: path.join(ROOT, "src/deepseek/shims/module.ts") }
            : undefined,
        );
      },
    },
  ],
});
