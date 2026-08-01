/**
 * Rebind the requirement snapshot to the current HEAD.
 *
 * WHY THIS EXISTS
 * ---------------
 * After every code commit the readiness gate correctly reports drift: the
 * evidence describes a tree that has moved. Clearing it means updating three
 * fields in the snapshot — `head`, `evidenceBindings.sourceRevision` and the
 * rebind note — and then republishing. That was being done by hand each time,
 * which is both error-prone and exactly the kind of hand-maintained derived
 * data `resync-snapshot-summary.mjs` exists to eliminate.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It does not decide whether rebinding is APPROPRIATE. Rebinding is only
 * correct when no requirement's status changed — when the commit fixed tooling,
 * documentation or tests rather than moving a row up the evidence ladder. If a
 * row's status did change, the row must be re-evidenced, not the binding moved.
 * This script therefore refuses to run when the working tree is dirty, so the
 * rebind always describes a committed, inspectable state.
 *
 * Usage: node scripts/rebind-evidence.mjs [--write]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const write = process.argv.includes("--write");

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const head = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  // The snapshot and its publication are the files this script rewrites, so
  // their being dirty is expected. Anything else means the rebind would
  // describe a state nobody has reviewed.
  .filter(
    (l) =>
      !l.endsWith("OCADE_REQUIREMENT_STATUS_SNAPSHOT.json") &&
      !l.endsWith("OCADE_P29_FINAL_READINESS.json") &&
      !l.endsWith("src/routeTree.gen.ts"),
  );

if (dirty.length > 0) {
  console.error("Refusing to rebind: the working tree has uncommitted changes.");
  for (const line of dirty) console.error(`- ${line}`);
  console.error("Commit them first, so the binding describes a state that can be inspected.");
  process.exit(1);
}

const raw = readFileSync(SNAPSHOT, "utf8");
const current = JSON.parse(raw);

if (current.head === head && current.evidenceBindings?.sourceRevision === head) {
  console.log(`Already bound to ${head.slice(0, 7)} — nothing to do.`);
  process.exit(0);
}

const updated = raw
  .split(`"head": "${current.head}"`)
  .join(`"head": "${head}"`)
  .split(`"sourceRevision": "${current.evidenceBindings.sourceRevision}"`)
  .join(`"sourceRevision": "${head}"`)
  .replace(
    /"headRebindNote": "Bound to [0-9a-f]+\./,
    `"headRebindNote": "Bound to ${head.slice(0, 7)}.`,
  );

const check = JSON.parse(updated);
if (check.head !== head || check.evidenceBindings.sourceRevision !== head) {
  console.error("Rebind produced a snapshot that does not name HEAD. Refusing to write it.");
  process.exit(1);
}

console.log(`${current.head.slice(0, 7)} -> ${head.slice(0, 7)}`);
if (write) {
  writeFileSync(SNAPSHOT, updated);
  console.log(`Wrote ${SNAPSHOT}. Run resync-snapshot-summary.mjs --write and readiness:publish.`);
} else {
  console.log("(dry run — pass --write)");
}
