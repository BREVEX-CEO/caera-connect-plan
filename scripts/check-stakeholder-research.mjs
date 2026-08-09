import { readFileSync } from "node:fs";

const policy = JSON.parse(
  readFileSync(
    new URL("../release/OCADE_STAKEHOLDER_RESEARCH_POLICY.json", import.meta.url),
    "utf8",
  ),
);
const required = [
  "interviews",
  "workflow_observation",
  "pain_points",
  "task_frequency",
  "risk_mapping",
  "accessibility",
  "regional_needs",
];
const failures = [];
if (policy.schemaVersion !== 1 || !policy.owner) failures.push("schema and owner are required");
if (JSON.stringify(policy.dimensions) !== JSON.stringify(required)) {
  failures.push("all seven stakeholder dimensions are required");
}
for (const key of [
  "explicitConsentRequired",
  "withdrawalRequired",
  "observationAuthorisationRequired",
  "pseudonymisationRequired",
  "independentReviewRequired",
  "tenantIsolationRequired",
]) {
  if (policy[key] !== true) failures.push(`${key} must be true`);
}
if (
  policy.rawContentRetentionAllowed !== false ||
  policy.protectedDataRetentionAllowed !== false ||
  policy.syntheticFixturesCountAsProductionEvidence !== false ||
  policy.currentProductionParticipantsRecorded !== 0
) {
  failures.push(
    "the current source checkpoint must not fabricate human evidence or retain raw data",
  );
}
if (failures.length > 0) {
  console.error(`Stakeholder-research gate failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    "Stakeholder-research gate: intake contract valid; 0 production participants recorded.",
  );
  console.log("Stakeholder research remains blocked on authorised human participation.");
}
