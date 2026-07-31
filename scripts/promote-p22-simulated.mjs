/**
 * Promote only the requirements the P22 twin campaign actually exercised.
 *
 * Six neighbours in the same two areas are deliberately left at UNIT TESTED,
 * because the campaign never touched them:
 *
 *   AZ-290 test cards            - the twin models checkout sessions, not cards
 *   AZ-292 invoices              - no invoice is generated anywhere in the run
 *   AZ-295 portal                - the billing GUI was not driven
 *   AZ-282 plan catalogue        - only one plan was used; the catalogue was
 *                                  never enumerated or its refusal path walked
 *   AZ-283 trials                - the trial_2d plan was never exercised
 *   AZ-288 offline verification  - no offline path was run
 *
 * Promoting all fourteen because eight were proven is precisely the
 * bulk-promotion habit that produced the gap this programme has been closing.
 *
 * Usage: node scripts/promote-p22-simulated.mjs [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";

const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const EVIDENCE = "release/OCADE_P22_SIMULATED_EVIDENCE.json";
const write = process.argv.includes("--write");

/** requirement id → [evidence step ids, what those steps observed] */
const PROMOTIONS = new Map([
  ["AZ-289", [["S02", "S03"], "a checkout created through the twin, and a repeated idempotency key returning the same session rather than a second subscription"]],
  ["AZ-291", [["S04", "S05", "S06", "S07"], "a real HMAC-signed webhook admitted, and forged-signature, tampered-payload and duplicate-delivery refusals observed with their specific refusal codes"]],
  ["AZ-293", [["S09", "S10", "S11"], "a failed renewal entering grace with access retained, a retry NOT extending the grace window, and access lapsing when grace expires"]],
  ["AZ-294", [["S13", "S14"], "a refund for a non-existent payment refused, and a genuine refund revoking access immediately with no grace"]],
  ["AZ-284", [["S04", "S08"], "paid periods tracked across checkout and renewal, with the period end genuinely advancing"]],
  ["AZ-285", [["S04", "S05", "S06"], "entitlement state changing only on a cryptographically verified event, and staying unchanged when the signature is forged or the payload tampered"]],
  ["AZ-286", [["S04", "S11", "S14"], "access gating derived from entitlement state: granted while active, withdrawn after grace lapses, withdrawn immediately on refund"]],
  ["AZ-287", [["S09", "S10", "S11"], "the grace window opening once, not re-opening on retry, and expiring"]],
]);

const evidence = JSON.parse(readFileSync(EVIDENCE, "utf8"));
const stepById = new Map(evidence.steps.map((s) => [s.id, s]));

const problems = [];
for (const [id, [stepIds]] of PROMOTIONS) {
  for (const stepId of stepIds) {
    const step = stepById.get(stepId);
    if (!step) problems.push(`${id} cites ${stepId}, which is not in the evidence file`);
    else if (step.status !== "observed") problems.push(`${id} cites ${stepId}, whose status is "${step.status}"`);
  }
}
if (problems.length > 0) {
  console.error(`REFUSING TO PROMOTE — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const byId = new Map(snapshot.requirements.map((r) => [r.id, r]));

let promoted = 0;
let delta = 0;
for (const [id, [stepIds, what]] of PROMOTIONS) {
  const req = byId.get(id);
  if (!req) throw new Error(`Unknown requirement ${id}`);
  if (req.status !== "UNIT TESTED") {
    throw new Error(`${id} is "${req.status}"; expected UNIT TESTED before a simulated promotion`);
  }
  delta += 0.7 - req.weight;
  req.status = "SIMULATED RUNTIME VERIFIED";
  req.weight = 0.7;
  req.evidence =
    `SIMULATED RUNTIME VERIFIED — ${EVIDENCE} step(s) ${stepIds.join(", ")}: ${what}. ` +
    `Driven end to end against the deterministic payment twin with real HMAC signing and the production entitlement state machine.`;
  req.resolvedInPhase = "P22-simulated-campaign";
  req.caveat = evidence.caveat;
  promoted += 1;
}

console.log(`Promoted ${promoted} requirement(s) to SIMULATED RUNTIME VERIFIED.`);
console.log(`Declared readiness change: +${delta.toFixed(1)} points.`);

if (write) {
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${SNAPSHOT}.`);
} else {
  console.log("\nDry run. Pass --write to apply.");
}
