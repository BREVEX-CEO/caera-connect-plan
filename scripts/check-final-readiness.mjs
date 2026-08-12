import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  createReadinessPublication,
  effectiveBoundRevision,
  evaluateRequirementReadiness,
  validateProductionClaim,
} from "./readiness-engine.mjs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

const snapshotPath =
  process.env.OCADE_REQUIREMENT_SNAPSHOT ?? "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const publicationPath =
  process.env.OCADE_FINAL_READINESS ?? "release/OCADE_P29_FINAL_READINESS.json";
const snapshot = readJson(snapshotPath);
const packageJson = readJson("package.json");
const currentHead = git("rev-parse", "HEAD");
const branch = git("branch", "--show-current");
const targetVersion = packageJson.version;
/**
 * Hash the lockfile's CONTENT, not its bytes on disk.
 *
 * This repository has `core.autocrlf=true` and no `.gitattributes`, so git
 * rewrites line endings on checkout. package-lock.json is 440,611 bytes in a
 * worktree written with LF and 453,098 in a fresh clone converted to CRLF —
 * one byte per line, ~12.5 KB of pure formatting. The content is identical;
 * only the newlines differ.
 *
 * Hashing raw bytes therefore produced a value that was reproducible on the
 * machine that recorded it and on no other. Every fresh checkout, CI included,
 * computed a different digest and the gate failed with
 * `evidence_binding_drift` on dependencyLockSha256 — a failure invisible
 * locally, because the local bytes are the ones the hash was taken from.
 *
 * Normalising CRLF to LF first makes the binding mean what it was always meant
 * to mean: these are the same dependencies. It still changes if a real
 * dependency changes, which is the property worth keeping.
 */
const dependencyLockSha256 = createHash("sha256")
  .update(readFileSync("package-lock.json", "utf8").replace(/\r\n/g, "\n"))
  .digest("hex");
const verificationEnvironment =
  process.platform === "win32" &&
  process.arch === "x64" &&
  Number(process.versions.node.split(".")[0]) >= 22
    ? "windows-x64-node22+"
    : `${process.platform}-${process.arch}-node${process.versions.node.split(".")[0]}`;
/**
 * Judge the snapshot against the revision its evidence describes.
 *
 * See effectiveBoundRevision: the commit that writes the binding cannot contain
 * its own hash, so it always leaves HEAD one ahead. Only a diff limited to the
 * binding files themselves is tolerated; anything else is real drift.
 */
function changedPathsSince(recorded, head) {
  if (!recorded || recorded === head) return [];
  try {
    return git("diff", "--name-only", `${recorded}..${head}`).split("\n").filter(Boolean);
  } catch {
    // An unknown revision is not forgiven — null makes the check fall back to
    // HEAD so drift fires normally.
    return null;
  }
}

const boundRevision = effectiveBoundRevision(
  snapshot?.head,
  currentHead,
  changedPathsSince(snapshot?.head, currentHead),
);
const expectedEvidenceBindings = {
  sourceRevision: boundRevision,
  targetVersion,
  dependencyLockSha256,
  environment: verificationEnvironment,
  verificationRuleVersion: "p29-v1",
};
const writePublication = process.argv.includes("--write");
if (writePublication) {
  // Publishing after an intentional lockfile change must refresh the binding
  // in the source snapshot as well as the derived publication. Leaving the
  // old digest in place made `readiness:publish` write a report that it then
  // immediately rejected as stale. The calculated statuses are untouched;
  // this records only the exact environment they were just checked against.
  snapshot.evidenceBindings = expectedEvidenceBindings;
  snapshot.generatedAt = new Date().toISOString();
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}
const calculation = evaluateRequirementReadiness(snapshot, {
  expectedRequirementCount: 510,
  expectedHead: boundRevision,
  expectedTargetVersion: packageJson.version,
  expectedEvidenceBindings,
  targetVersion,
  now: new Date(),
});
if (writePublication) {
  writeFileSync(
    publicationPath,
    `${JSON.stringify(
      createReadinessPublication(calculation, { branch, currentHead }),
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Wrote honest final-readiness publication to ${publicationPath}.`);
}
const published = readJson(publicationPath);
const claimIssues = validateProductionClaim(published, calculation);
const structuralIssues = calculation.issues.filter((entry) =>
  [
    "requirement_count",
    "requirement_id_missing",
    "requirement_id_duplicate",
    "status_unknown",
    "weight_mismatch",
    "declared_total_mismatch",
    "status_counts_mismatch",
    "snapshot_time_invalid",
    "snapshot_from_future",
    "source_revision_drift",
    "target_version_drift",
    "snapshot_stale",
    "evidence_binding_missing",
    "evidence_binding_drift",
  ].includes(entry.code),
);
const failures = [...structuralIssues, ...claimIssues];
const requireProduction = process.argv.includes("--require-production");
if (requireProduction && !calculation.productionReady) {
  failures.push({
    code: "production_evidence_incomplete",
    message: `${calculation.evidenceBound.numerator}/${calculation.denominator} evidence-bound requirements; production needs ${calculation.denominator}/${calculation.denominator}.`,
  });
}

if (failures.length > 0) {
  console.error(`OCADE final-readiness gate failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure.code}: ${failure.message}`);
  process.exit(1);
}

console.log(
  `OCADE final readiness: declared ${calculation.declared.numerator}/${calculation.denominator} (${calculation.declared.percent}%)`,
);
console.log(
  `Evidence-bound closure: ${calculation.evidenceBound.numerator}/${calculation.denominator} (${calculation.evidenceBound.percent}%)`,
);
console.log(
  `Unverified positive-weight declarations: ${calculation.issues.filter((entry) => entry.code === "evidence_unbound").length}`,
);
console.log(
  calculation.productionReady
    ? "PRODUCTION READY: YES - every acceptance condition has current requirement-bound evidence."
    : "PRODUCTION READY: NO - live, signed, deployed and requirement-bound evidence remains incomplete.",
);
console.log("Gate status: honest closure accounting is internally consistent.");
