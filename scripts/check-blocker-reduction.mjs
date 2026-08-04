import { readFileSync } from "node:fs";

const policy = JSON.parse(
  readFileSync(new URL("../release/OCADE_BLOCKER_REDUCTION_POLICY.json", import.meta.url), "utf8"),
);
const expected = [
  "portable_runtime",
  "hosted_clean_runner",
  "emulator_or_simulator",
  "free_equivalent",
  "existing_owned_device",
  "authorised_remote_worker",
  "peer_to_peer",
  "signed_external_evidence",
  "community_skill_or_bounty",
  "one_step_human_action",
];
const failures = [];
if (policy.schemaVersion !== 1 || !policy.owner) failures.push("schema and owner are required");
if (JSON.stringify(policy.strategiesInRequiredOrder) !== JSON.stringify(expected)) {
  failures.push("all ten blocker-reduction strategies must remain in the mandated order");
}
for (const key of [
  "externalClassificationRequiresAllStrategies",
  "availableAlternativeRefusesExternalClassification",
  "digestBoundEvidenceRequired",
  "independentVerifierRequired",
  "tenantScopedRetentionRequired",
]) {
  if (policy[key] !== true) failures.push(`${key} must be true`);
}
if (
  policy.duplicateStrategyEvidenceAllowed !== false ||
  policy.unverifiedEvidenceRetainableAsCompletion !== false
) {
  failures.push("duplicates and unverified completion evidence must be refused");
}
if (failures.length > 0) {
  console.error(`Blocker-reduction gate failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("Blocker-reduction gate: all ten alternatives are ordered and evidence-gated.");
}
