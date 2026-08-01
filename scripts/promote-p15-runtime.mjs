/**
 * Promote only the requirements the P15 harness actually observed.
 *
 * Each promotion below names the evidence step that justifies it, and the
 * script verifies that step exists AND was observed before writing. A step that
 * merely ran is not enough; a skipped or failed step promotes nothing.
 *
 * The neighbouring requirements in the same areas are deliberately NOT promoted:
 * redirect following, citation composition, sandbox acceptance workflow,
 * workspace creation, patches, diff review and cleanup were never exercised by
 * the harness. Promoting a whole area because part of it was verified is the
 * bulk-promotion habit that produced the 29-point gap this work exists to close.
 *
 * Usage: node scripts/promote-p15-runtime.mjs [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";

const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const EVIDENCE = "release/OCADE_P15_RESEARCH_SANDBOX_RUNTIME_EVIDENCE.json";
const write = process.argv.includes("--write");

/** requirement id → [evidence step ids, what those steps observed] */
const PROMOTIONS = new Map([
  ["AZ-149", [["A01", "A02"], "URL validation executed against hostile and allowlisted URLs"]],
  [
    "AZ-150",
    [
      ["A01"],
      "SSRF defence refusing cloud metadata, loopback, private range, plain HTTP, credentialed URLs and nonstandard ports — refused even when those hosts were explicitly allowlisted",
    ],
  ],
  ["AZ-151", [["A03"], "a real HTTPS GET over a real socket through the production fetcher"]],
  ["AZ-153", [["A03"], "content extraction from the real response body"]],
  [
    "AZ-154",
    [["A04"], "an end-to-end run producing sub-answers with honest single_source confidence"],
  ],
  [
    "AZ-156",
    [
      ["A01", "A03b"],
      "failure classification: off-allowlist and hostile URLs classified hard rather than transient",
    ],
  ],
  [
    "AZ-239",
    [
      ["B01"],
      "a real spawned child process executing generated code and returning captured output",
    ],
  ],
  [
    "AZ-240",
    [["B05"], "path confinement refusing a traversal write even when declared as an output"],
  ],
  [
    "AZ-241",
    [
      ["B02"],
      "no network primitive reachable inside the sandbox context, observed by probing the context rather than by reading the host's hard-coded networkDenied field",
    ],
  ],
  [
    "AZ-242",
    [
      ["B02"],
      "no process or require primitive reachable, so child processes cannot be spawned from generated code",
    ],
  ],
  ["AZ-243", [["B06"], "the wall-time budget terminating a real infinite loop"]],
  [
    "AZ-244",
    [
      ["B03", "B04"],
      "a declared output captured and hashed, and an undeclared write refused at the point of writing",
    ],
  ],
  [
    "AZ-232",
    [
      ["C01", "C02", "C03"],
      "repository mapping, symbol lookup and import-edge resolution over real repository sources",
    ],
  ],
]);

const evidence = JSON.parse(readFileSync(EVIDENCE, "utf8"));
const stepById = new Map(evidence.steps.map((s) => [s.id, s]));

// Refuse to promote on anything not actually observed.
const problems = [];
for (const [id, [stepIds]] of PROMOTIONS) {
  for (const stepId of stepIds) {
    const step = stepById.get(stepId);
    if (!step) problems.push(`${id} cites ${stepId}, which is not in the evidence file`);
    else if (step.status !== "observed")
      problems.push(`${id} cites ${stepId}, whose status is "${step.status}"`);
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
  delta += 1 - (req.weight ?? 0);
  req.status = "REAL TARGET RUNTIME VERIFIED";
  req.weight = 1;
  req.evidence =
    `REAL TARGET RUNTIME VERIFIED — ${EVIDENCE} step(s) ${stepIds.join(", ")}: ${what}. ` +
    `Observed on ${evidence.host.platform}/${evidence.host.arch} node ${evidence.host.node}.`;
  req.resolvedInPhase = "P15-runtime-evidence";
  req.caveat = evidence.caveat;
  promoted += 1;
}

console.log(`Promoted ${promoted} requirement(s) to REAL TARGET RUNTIME VERIFIED.`);
console.log(`Declared readiness change: +${delta.toFixed(1)} points.`);

if (write) {
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${SNAPSHOT}.`);
} else {
  console.log("\nDry run. Pass --write to apply.");
}
