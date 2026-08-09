/** Promote only rows directly proven by the final real-runtime receipts. */
import { readFileSync, writeFileSync } from "node:fs";

const snapshotPath = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const unknownPath = "release/OCADE_UNKNOWN_APP_RUNTIME_EVIDENCE.json";
const longPath = "release/OCADE_LONG_DOCUMENT_RUNTIME_EVIDENCE.json";
const blockersPath = "release/OCADE_RELEASE_BLOCKERS.json";
const write = process.argv.includes("--write");
const unknown = JSON.parse(readFileSync(unknownPath, "utf8"));
const longDocument = JSON.parse(readFileSync(longPath, "utf8"));
const blockers = JSON.parse(readFileSync(blockersPath, "utf8"));

if (
  unknown.result !== "PASS" ||
  unknown.boundary !== "PROBED_AND_REHEARSED" ||
  unknown.target?.selectedDynamically !== true ||
  unknown.target?.hardcodedProductAdapter !== false ||
  unknown.learning?.status !== "verified" ||
  unknown.learning?.private !== true ||
  unknown.observation?.windows < 1
) {
  throw new Error(
    "Unknown-app evidence does not meet its bounded real-runtime promotion contract.",
  );
}
if (
  longDocument.result !== "PASS" ||
  !Object.values(longDocument.checks ?? {}).every(Boolean) ||
  longDocument.streaming?.progressiveRequests < 1 ||
  longDocument.streaming?.transportChunks < 3 ||
  longDocument.completion?.ok !== true
) {
  throw new Error("Long-document evidence does not meet its real-runtime promotion contract.");
}

const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
const byId = new Map(snapshot.requirements.map((row) => [row.id, row]));
const unknownPromotions = new Map([
  ["AZ-220", "dynamic installed-application detection from the live Windows inventory"],
  ["AZ-221", "native and accessibility/file route discovery for the exact executable identity"],
  ["AZ-222", "a separate read-only rehearsal against the launched real application"],
  ["AZ-223", "bounded no-op shadow execution through the real native inspection host"],
  ["AZ-224", "a fingerprinted application digital twin built from the real observed structure"],
  ["AZ-225", "a private exact-version skill compiled only after fresh independent verification"],
]);

let delta = 0;
for (const [id, observation] of unknownPromotions) {
  const row = byId.get(id);
  if (!row) throw new Error(`Missing requirement ${id}`);
  delta += 1 - row.weight;
  row.status = "REAL TARGET RUNTIME VERIFIED";
  row.weight = 1;
  row.evidence =
    `REAL TARGET RUNTIME VERIFIED — ${unknownPath}: ${observation}. ` +
    `${unknown.discovery.installedApplicationsObserved} real installed applications were discovered; ` +
    `${unknown.target.displayName} ${unknown.target.version} was selected dynamically, launched, re-read and closed.`;
  row.resolvedInPhase = "FINAL-unknown-app-runtime";
  row.caveat = unknown.claimBoundary;
}

for (const [id, observation] of [
  [
    "AZ-134",
    `${longDocument.streaming.transportChunks} real Ollama HTTP chunks and ${longDocument.streaming.tokenCallbacks} token callbacks, including ${longDocument.streaming.progressiveRequests} progressive request(s)`,
  ],
  [
    "AZ-325",
    `long-document first progress at ${longDocument.progress.firstEvent.elapsedMs} ms, one persisted cancellation checkpoint, exact restart resume and completed reduction`,
  ],
]) {
  const row = byId.get(id);
  if (!row) throw new Error(`Missing requirement ${id}`);
  delta += 1 - row.weight;
  row.status = "REAL TARGET RUNTIME VERIFIED";
  row.weight = 1;
  row.evidence = `REAL TARGET RUNTIME VERIFIED — ${longPath}: ${observation}.`;
  row.resolvedInPhase = "FINAL-long-document-runtime";
  row.caveat = longDocument.claimBoundary;
}

const browser = blockers.blockers.find((blocker) => blocker.id === "browser-cdp-real-matrix");
if (!browser) throw new Error("Corrected extensionless browser blocker is absent.");
for (const row of snapshot.requirements) {
  if (!String(row.evidence ?? "").includes('"browser-extension-store"')) continue;
  row.evidence =
    `EXTERNALLY BLOCKED by "${browser.id}" (${browser.area}), recorded in ${blockersPath}. ` +
    `Clearing it requires: ${browser.requiredEvidence.join("; ")}. ` +
    "This binds the BLOCKED claim only — it is not evidence that the requirement works.";
  row.resolvedInPhase = "FINAL-extensionless-browser-reconciliation";
}

console.log(`Validated and prepared ${unknownPromotions.size + 2} real-runtime promotions.`);
console.log(`Declared readiness change: +${delta.toFixed(1)} points.`);
if (write) {
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Wrote ${snapshotPath}.`);
} else {
  console.log("Dry run. Pass --write to apply.");
}
