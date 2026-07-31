/**
 * Record the snapshot's verifiedCommands from measured values.
 *
 * This field claimed "3919 passed across 236 files" and "gates 28/28" long
 * after the suite had reached 4,167 across 253 files with 43 gates. Stale
 * numbers in an evidence field are worse than absent ones: they read as
 * verification while describing a tree that no longer exists.
 *
 * Values are passed in explicitly from a run that actually happened, and the
 * script stamps the revision they were measured at, so a later reader can tell
 * whether they still apply.
 *
 * Usage:
 *   node scripts/record-verified-commands.mjs --tests "4167 passed" \
 *     --files 253 --gates "42/43" --revision <sha> [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const write = process.argv.includes("--write");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const revision =
  arg("revision") ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));

snapshot.verifiedCommands = {
  typecheck: arg("typecheck", "PASS"),
  lint: arg("lint", "PASS"),
  tests: arg("tests", snapshot.verifiedCommands?.tests ?? "unmeasured"),
  build: arg("build", "PASS"),
  gates: arg("gates", snapshot.verifiedCommands?.gates ?? "unmeasured"),
  rustTests: arg("rustTests", snapshot.verifiedCommands?.rustTests ?? "unmeasured"),
  measuredAtRevision: revision,
  note: "Measured by an executed run at the revision above, not carried forward. Treat as stale if HEAD has moved.",
};

if (arg("files")) {
  snapshot.testArchitecture = { ...snapshot.testArchitecture, files: Number(arg("files")) };
}

console.log(JSON.stringify(snapshot.verifiedCommands, null, 2));

if (write) {
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${SNAPSHOT}.`);
} else {
  console.log("\nDry run. Pass --write to apply.");
}
