import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
let checks = 0;

function check(condition, label) {
  checks += 1;
  if (!condition) failures.push(label);
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

const policy = JSON.parse(read("release/OCADE_PRODUCTION_OPERATIONS.json"));
const runbook = read("release/OCADE_INCIDENT_RESPONSE_RUNBOOK.md");
const pkg = JSON.parse(read("package.json"));

check(policy.schemaVersion === 1, "operations schema");
check(policy.releaseVersion === pkg.version, "release version alignment");
check(
  policy.classification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "runtime-honest classification",
);
check(
  Object.values(policy.liveClaims).every((claim) => claim === false),
  "live claims must remain false until evidence is attached",
);
check(
  policy.services.length >= 2 &&
    policy.services.every(
      (service) =>
        service.deploymentOwner === "OWNER_REQUIRED" &&
        service.healthMethod === "GET" &&
        service.healthPath.startsWith("/") &&
        service.expectedStatus === 200 &&
        service.sourceSecretsAllowed === false,
    ),
  "service health, ownership and secret boundaries",
);
check(
  policy.monitoring.provider === "OWNER_REQUIRED" &&
    policy.monitoring.signals.length >= 6 &&
    policy.monitoring.signals.every(
      (signal) =>
        /^SEV[123]$/.test(signal.severity) &&
        signal.windowMinutes > 0 &&
        signal.condition.length >= 20,
    ),
  "bounded alert policy",
);
check(
  /never prompts, documents, ciphertext, credentials/i.test(policy.monitoring.privacy),
  "monitoring privacy allow-list boundary",
);
check(
  Object.values(policy.incident.roles).every((owner) => owner === "OWNER_REQUIRED") &&
    policy.incident.severities.length === 3 &&
    policy.incident.requiredRecords.length >= 7,
  "incident ownership, severity and record contract",
);
check(
  policy.incident.forensics.preserveBeforeMutation === true &&
    policy.incident.forensics.hashExports === true &&
    policy.incident.forensics.redactSecretsAndUserContent === true &&
    policy.incident.postmortemDueBusinessDays <= 5,
  "forensics and postmortem controls",
);
check(
  policy.dataProtection.restoreTarget.includes("isolated") &&
    policy.dataProtection.restoreDrillIntervalDays <= 90 &&
    policy.dataProtection.requiredRestoreEvidence.length >= 7,
  "backup and restore drill contract",
);
check(
  policy.releaseControls.separateDeployApprovalRequired === true &&
    policy.releaseControls.separateRollbackApprovalRequired === true &&
    policy.releaseControls.priorVerifiedVersionRequired === true &&
    policy.releaseControls.independentHealthVerificationRequired === true &&
    policy.releaseControls.databaseApplyAuthorized === false,
  "release approval and verification controls",
);
check(policy.externalInputsRequired.length >= 7, "external prerequisite ledger");
check(
  runbook.includes("## Declare and contain") &&
    runbook.includes("## Triage") &&
    runbook.includes("## Communicate and recover") &&
    runbook.includes("## Review"),
  "incident lifecycle runbook",
);
check(
  runbook.includes("A zero exit is insufficient") &&
    runbook.includes("Keep the incident open when any check is unavailable"),
  "false-success refusal",
);

const secretShape =
  /AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9_-]{20,}/;
check(!secretShape.test(JSON.stringify(policy)), "secret-shaped value in operations policy");
check(!secretShape.test(runbook), "secret-shaped value in runbook");

if (failures.length > 0) {
  console.error(`OCADE production operations gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE production operations gate: ${checks}/${checks} checks passed`);
console.log("STATUS: SOURCE-COMPLETE BUT RUNTIME-BLOCKED");
console.log(
  "No migration, deployment, rollback, backup, restore, alert, signing or publication ran.",
);
