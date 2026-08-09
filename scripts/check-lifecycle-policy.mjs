import { readFileSync } from "node:fs";
import {
  evaluateApplicationDrift,
  evaluateSecurityPatch,
  validateLifecyclePolicy,
} from "./lifecycle-policy.mjs";

const path = process.env.OCADE_LIFECYCLE_POLICY ?? "release/OCADE_APP_DRIFT_SECURITY_POLICY.json";
const policy = JSON.parse(readFileSync(path, "utf8"));
const validation = validateLifecyclePolicy(policy);
const now = new Date("2026-07-30T18:00:00.000Z");
const baseline = {
  appId: "example.app",
  version: "1.2.3",
  fingerprint: "fp-1",
  capabilityDigest: "a".repeat(64),
  layoutRevision: "layout-1",
  plugins: ["core"],
  observedAt: now.toISOString(),
};
const drift = evaluateApplicationDrift(
  policy,
  baseline,
  { ...baseline, version: "2.0.0", observedAt: now.toISOString() },
  { now },
);
const patch = evaluateSecurityPatch(
  policy,
  {
    id: "CVE-2026-0001",
    appId: baseline.appId,
    severity: "critical",
    affectedVersions: [baseline.version],
    fixedVersion: "1.2.4",
    sourceUrl: "https://nvd.nist.gov/vuln/detail/CVE-2026-0001",
    advisorySha256: "b".repeat(64),
    signatureVerified: true,
    observedAt: now.toISOString(),
  },
  baseline.version,
  {},
  { now },
);
const issues = [...validation.issues];
if (!drift.invalidated || drift.executionAllowed) {
  issues.push("version drift did not invalidate the adapter");
}
if (!patch.executionBlocked || patch.stagingReady || patch.applied) {
  issues.push("critical affected application did not fail closed before host evidence");
}
if (issues.length > 0) {
  console.error(`Application lifecycle gate failed:\n- ${issues.join("\n- ")}`);
  process.exit(1);
}
console.log("Application lifecycle gate: policy is internally consistent.");
console.log("- App drift invalidates adapters and private recipes before execution.");
console.log("- Critical/high security patches block affected adapters before staging.");
console.log("- Runtime boundary: no advisory feed, host patch executor or applied-patch claim.");
