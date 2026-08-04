import { readFileSync } from "node:fs";

const policy = JSON.parse(
  readFileSync(new URL("../release/OCADE_MARKETPLACE_BOUNTY_POLICY.json", import.meta.url), "utf8"),
);
const failures = [];
const requireTrue = (object, keys, prefix) => {
  for (const key of keys) {
    if (object?.[key] !== true) failures.push(`${prefix}.${key} must be true`);
  }
};

if (policy.schemaVersion !== 1) failures.push("schemaVersion must be 1");
if (!policy.owner) failures.push("a production owner is required");
if (policy.runtimeMode !== "LOCAL_REVIEW_AND_PRIORITY_ONLY") {
  failures.push("runtime mode must preserve the local-only boundary");
}
requireTrue(
  policy.marketplace,
  [
    "signatureRequired",
    "sandboxRequired",
    "permissionScopeRequired",
    "versionBindingRequired",
    "independentReviewRequired",
    "localRevalidationRequired",
    "revocationRequired",
    "tenantIsolationRequired",
    "evidenceDigestRequired",
    "emergencyStopRequired",
  ],
  "marketplace",
);
requireTrue(
  policy.bounty,
  [
    "priorityCreditsOnly",
    "realTargetEvidenceRequired",
    "versionMatchRequired",
    "allAcceptanceCriteriaRequired",
    "independentReviewRequired",
    "disputeRequired",
    "laterRevocationRequired",
  ],
  "bounty",
);
if (policy.bounty?.financialPayoutsEnabled !== false) {
  failures.push("financial payouts must remain disabled without compliant infrastructure");
}
if (
  policy.honestBoundaries?.localAdmissionProvesTargetApplicationRuntime !== false ||
  policy.honestBoundaries?.simulatedEvidenceCanWinBounty !== false
) {
  failures.push("marketplace policy must not manufacture real-runtime evidence");
}

if (failures.length > 0) {
  console.error(`Marketplace/bounty gate failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    "Marketplace/bounty gate: signed local admission and non-financial priority flow valid.",
  );
  console.log("Financial payout and contributor identity remain externally blocked.");
}
