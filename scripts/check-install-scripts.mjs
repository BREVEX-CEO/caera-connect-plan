#!/usr/bin/env node
/**
 * SUPPLY-05: only reviewed packages may run code at install time.
 *
 * `npm ci` runs every dependency's install scripts. The lockfile marks each package that has one;
 * this gate fails when a package not on the reviewed list gains one, so a new or compromised
 * dependency cannot run code on a developer machine or CI runner unnoticed.
 */
import { readFileSync } from "node:fs";

// Reviewed: each downloads or links its own platform binary and does nothing else.
const REVIEWED = new Set(["esbuild", "fsevents", "workerd"]);

const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const unreviewed = Object.entries(lock.packages ?? {})
  .filter(([, entry]) => entry.hasInstallScript)
  .map(([path]) => path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length))
  .filter((name) => !REVIEWED.has(name));

if (unreviewed.length) {
  console.error(`Install scripts not reviewed: ${unreviewed.join(", ")}.`);
  console.error("Review each script, then add the package to REVIEWED in this file.");
  process.exit(1);
}
console.log(`Install scripts: only the ${REVIEWED.size} reviewed packages run code at install.`);
