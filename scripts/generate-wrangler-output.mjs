#!/usr/bin/env node
/**
 * Materialize the deployable Wrangler configuration after Nitro builds.
 *
 * `wrangler.json` is the checked-in source of truth. Nitro owns the output
 * paths, but its current Cloudflare preset treats the entire `assets` object
 * as an override when it adds `binding` and `directory`; that produced a
 * warning even though OCADE's `run_worker_first` and `html_handling` settings
 * are intentional security controls. Deploy-config generation is therefore
 * disabled in Nitro and this small deterministic adapter adds only the paths
 * that are knowable after the build.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const sourcePath = resolve(root, "wrangler.json");
const serverEntry = resolve(root, ".output", "server", "index.mjs");
const outputPath = resolve(root, ".output", "server", "wrangler.json");

if (!existsSync(serverEntry)) {
  throw new Error("Nitro server output is missing; run this only after a successful build.");
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
for (const generatedOnly of ["main", "no_bundle", "rules"]) {
  if (generatedOnly in source) {
    throw new Error(`wrangler.json must not define generated field ${generatedOnly}.`);
  }
}
if (source.assets?.binding || source.assets?.directory) {
  throw new Error("wrangler.json must not hard-code generated asset binding or directory paths.");
}

const { $schema: _schema, ...portableSource } = source;
const generated = {
  ...portableSource,
  main: "index.mjs",
  assets: {
    ...portableSource.assets,
    binding: "ASSETS",
    directory: "../public",
  },
  no_bundle: true,
  rules: [{ type: "ESModule", globs: ["**/*.mjs", "**/*.js"] }],
};

writeFileSync(outputPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
console.log("Generated .output/server/wrangler.json from the checked-in deployment authority.");
