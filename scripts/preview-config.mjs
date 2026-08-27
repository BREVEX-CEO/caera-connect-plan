#!/usr/bin/env node
/*
 * DERIVE THE PREVIEW CONFIG FROM THE ONE THE BUILD ACTUALLY PRODUCED.
 *
 * The first attempt at this was a hand-written `wrangler.preview.json` at the
 * repository root, and it could never have deployed. Nitro's cloudflare-module
 * preset does not deploy from the root config: it COPIES it into
 * `.output/server/wrangler.json` and adds the four things only the build knows
 * — `main`, `assets.directory`, `assets.binding`, `no_bundle` and the ESModule
 * rules. A root config deployed directly is missing all of them, and wrangler
 * rejects it: "The `assets` property in your configuration is missing the
 * required `directory` property."
 *
 * So the preview is not a second source config. It is the generated one with
 * three edits, applied after the build:
 *
 *   name         → a different Worker entirely, so a preview deploy can never
 *                  overwrite production and rolling it back is deleting
 *                  something nothing points at.
 *   routes       → REMOVED. No route means no request for ocade.in or
 *                  www.ocade.in can arrive here, whatever is deployed.
 *   workers_dev  → true, because a preview with no reachable URL is not a
 *                  preview. Production keeps it false and keeps its domain.
 *
 * Everything else is inherited, so the preview runs the same bundle, the same
 * compatibility date and the same assets as production. A preview that differs
 * from production in any other way is not evidence about production.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const GENERATED = ".output/server/wrangler.json";
const PREVIEW = ".output/server/wrangler.preview.json";
const PRODUCTION_NAME = "ocade-web";
const PREVIEW_NAME = "ocade-web-preview";

if (!existsSync(GENERATED)) {
  console.error(`${GENERATED} is missing — run the build first.`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(GENERATED, "utf8"));

if (config.name !== PRODUCTION_NAME) {
  console.error(`Expected the generated config to be ${PRODUCTION_NAME}, found ${config.name}.`);
  process.exit(1);
}

config.name = PREVIEW_NAME;
config.workers_dev = true;
delete config.routes;
delete config.preview_urls;

/*
 * The guard is the point of this script, not a formality. Every way this could
 * go wrong ends with a preview build answering on the production domain, so
 * each one is checked here rather than trusted.
 */
const problems = [];
if (config.name === PRODUCTION_NAME) problems.push("preview would take the production Worker name");
if ("routes" in config) problems.push("preview still declares routes");
if (config.workers_dev !== true) problems.push("preview has no reachable URL");
if (!config.main) problems.push("preview lost the entry point the build produced");
if (!config.assets?.directory)
  problems.push("preview lost the assets directory the build produced");
if (problems.length) {
  for (const problem of problems) console.error(`REFUSED: ${problem}`);
  process.exit(1);
}

writeFileSync(PREVIEW, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Wrote ${PREVIEW}`);
console.log(`  name        ${config.name}`);
console.log(`  routes      none`);
console.log(`  workers_dev ${config.workers_dev}`);
console.log(`  main        ${config.main}`);
console.log(`  assets      ${config.assets.directory}`);
console.log(`\nDeploy with:\n  npx wrangler deploy --config ${PREVIEW}`);
