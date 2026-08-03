import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SHA256 = /^[a-f0-9]{64}$/;
const REFUSAL_SCENARIOS = new Map([
  ["device-absence", ["device_absent", "Select another declared adapter or attach a device."]],
  [
    "permission-denial",
    ["permission_denied", "Grant the scoped permission and start a new session."],
  ],
  [
    "hot-unplug",
    ["device_unplugged", "Release the adapter, restore the checkpoint and reconnect."],
  ],
  ["malformed-frame", ["malformed_frame", "Discard the frame and restore the last checkpoint."]],
  ["resource-limit", ["resource_limit", "Reduce the fixture below the declared resource limit."]],
]);

export class MediaLabCancelledError extends Error {
  constructor() {
    super("Media-lab operation cancelled.");
    this.name = "MediaLabCancelledError";
  }
}

const stopIfCancelled = (signal) => {
  if (signal?.aborted) throw new MediaLabCancelledError();
};
const digest = (value) => createHash("sha256").update(value).digest("hex");
const issue = (code, message) => ({ code, message });

export function validateMediaLabPolicy(policy) {
  const issues = [];
  const adapterIds = new Set();
  const fixtureIds = new Set();
  if (policy?.schemaVersion !== 1) issues.push(issue("schema", "schemaVersion must be 1."));
  if (typeof policy?.owner !== "string" || policy.owner.length < 3) {
    issues.push(issue("owner", "A production owner is required."));
  }
  if (
    policy?.runtimeBoundary !== "CI_OR_DISPOSABLE_VM_ONLY" ||
    policy?.disposableRuntimeRequired !== true
  ) {
    issues.push(issue("isolation", "Media-lab execution must remain in CI or a disposable VM."));
  }
  if (
    policy?.evidenceClass !== "SIMULATED MEDIA-LAB EVIDENCE ONLY" ||
    policy?.rawPayloadEvidenceAllowed !== false ||
    policy?.protectedContentRetentionAllowed !== false
  ) {
    issues.push(
      issue("evidence_truth", "Simulated evidence and payload-retention boundaries are required."),
    );
  }
  for (const adapter of policy?.adapters ?? []) {
    if (!adapter?.id || !adapter?.permission || adapterIds.has(adapter.id)) {
      issues.push(issue("adapter", "Every adapter needs a unique id and scoped permission."));
    }
    adapterIds.add(adapter?.id);
  }
  for (const fixture of policy?.fixtures ?? []) {
    if (
      !fixture?.id ||
      fixtureIds.has(fixture.id) ||
      !adapterIds.has(fixture?.adapter) ||
      typeof fixture?.seed !== "string" ||
      !Number.isInteger(fixture?.bytes) ||
      fixture.bytes < 1
    ) {
      issues.push(
        issue("fixture", "Every fixture must be unique, deterministic and adapter-bound."),
      );
    }
    fixtureIds.add(fixture?.id);
  }
  const scenarios = new Set((policy?.fixtures ?? []).map((fixture) => fixture.scenario));
  for (const required of [
    "device-absence",
    "permission-denial",
    "hot-unplug",
    "silence",
    "noise",
    "long-stream",
    "malformed-frame",
    "protected-speech",
    "resource-limit",
  ]) {
    if (!scenarios.has(required)) issues.push(issue("scenario", `Missing ${required} fixture.`));
  }
  const limits = policy?.limits ?? {};
  if (
    !Number.isInteger(limits.maxSessionMilliseconds) ||
    limits.maxSessionMilliseconds < 1 ||
    limits.maxSessionMilliseconds > 60000 ||
    !Number.isInteger(limits.maxFixtureBytes) ||
    limits.maxFixtureBytes < 1 ||
    limits.maxConcurrentSessions !== 1
  ) {
    issues.push(issue("limits", "Media-lab time, payload and concurrency limits are invalid."));
  }
  const recovery = policy?.recovery ?? {};
  if (
    recovery.checkpointBeforeRun !== true ||
    recovery.maximumRetries !== 1 ||
    recovery.releaseAdaptersOnExit !== true ||
    recovery.clearClipboardOnExit !== true ||
    recovery.userVisibleReasonRequired !== true ||
    recovery.auditReceiptRequired !== true
  ) {
    issues.push(
      issue(
        "recovery",
        "Checkpoint, bounded retry, cleanup, reason and audit recovery are required.",
      ),
    );
  }
  return { ok: issues.length === 0, issues };
}

export function createMediaLabSession(policy, request, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  const now = (options.now ?? new Date()).getTime();
  if (!request?.tenantId || !request?.userId) {
    issues.push(issue("identity", "Tenant and user identity are required."));
  }
  if (request?.disposableRuntime !== true) {
    issues.push(issue("isolation", "A disposable runtime is required."));
  }
  if (request?.emergencyStop === true || request?.revoked === true) {
    issues.push(issue("revoked", "The session is stopped or revoked."));
  }
  if (
    !Number.isInteger(request?.durationMilliseconds) ||
    request.durationMilliseconds < 1 ||
    request.durationMilliseconds > policy.limits.maxSessionMilliseconds
  ) {
    issues.push(issue("duration", "Session duration exceeds the bounded policy."));
  }
  const adapters = new Map(policy.adapters.map((adapter) => [adapter.id, adapter]));
  const requested = [...new Set(request?.adapters ?? [])];
  if (requested.length === 0) issues.push(issue("adapters", "At least one adapter is required."));
  for (const adapterId of requested) {
    const adapter = adapters.get(adapterId);
    if (!adapter) issues.push(issue("adapter_scope", `${adapterId} is not a declared adapter.`));
    else if (!(request?.permissions ?? []).includes(adapter.permission)) {
      issues.push(issue("permission", `${adapter.permission} was not granted.`));
    }
  }
  return {
    ok: issues.length === 0,
    issues,
    session:
      issues.length === 0
        ? {
            sessionId: request.sessionId ?? randomUUID(),
            tenantId: request.tenantId,
            userId: request.userId,
            adapters: requested,
            startedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + request.durationMilliseconds).toISOString(),
            checkpointId: request.checkpointId,
            evidenceClass: policy.evidenceClass,
          }
        : null,
  };
}

export function generateMediaFixture(policy, fixtureId, options = {}) {
  stopIfCancelled(options.signal);
  const fixture = policy.fixtures.find((entry) => entry.id === fixtureId);
  if (!fixture) throw new Error(`Unknown media fixture: ${fixtureId}`);
  const seed = Buffer.from(`${fixture.id}:${fixture.seed}:`);
  const payload = Buffer.alloc(fixture.bytes);
  for (let offset = 0; offset < payload.length; offset += 1) {
    payload[offset] = seed[offset % seed.length] ^ (offset % 251);
  }
  return { fixture, payload, digest: digest(payload) };
}

export function observeMediaFixture(policy, session, observation, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  const now = (options.now ?? new Date()).getTime();
  if (!session || observation?.tenantId !== session.tenantId) {
    issues.push(issue("tenant", "Observation is not bound to the session tenant."));
  }
  if (Date.parse(String(session?.expiresAt ?? "")) < now) {
    issues.push(issue("expired", "Media-lab session expired."));
  }
  if (observation?.emergencyStop === true || observation?.revoked === true) {
    issues.push(issue("revoked", "Observation was stopped or revoked."));
  }
  const generated = policy.fixtures.some((entry) => entry.id === observation?.fixtureId)
    ? generateMediaFixture(policy, observation.fixtureId)
    : null;
  if (!generated) {
    issues.push(issue("fixture", "Observation references an unknown fixture."));
  } else {
    if (!session?.adapters.includes(generated.fixture.adapter)) {
      issues.push(issue("adapter_scope", "Fixture adapter is outside the session scope."));
    }
    if (
      generated.fixture.bytes > policy.limits.maxFixtureBytes ||
      observation?.consumedBytes > policy.limits.maxFixtureBytes
    ) {
      issues.push(issue("resource_limit", "Fixture exceeds the byte limit."));
    }
    if (
      observation?.inputDigest !== generated.digest ||
      observation?.consumedBytes !== generated.payload.length
    ) {
      issues.push(
        issue("consumption_mismatch", "The observed input differs from the deterministic fixture."),
      );
    }
    const refusal = REFUSAL_SCENARIOS.get(generated.fixture.scenario);
    if (refusal) issues.push(issue(refusal[0], refusal[1]));
    if (
      generated.fixture.scenario === "protected-speech" &&
      (observation?.rawPayloadRetained === true || observation?.transcriptRetained === true)
    ) {
      issues.push(
        issue(
          "protected_retention",
          "Protected speech cannot be retained as payload or transcript.",
        ),
      );
    }
  }
  if (
    !Number.isInteger(observation?.frames) ||
    observation.frames < 0 ||
    observation.frames > policy.limits.maxFrames
  ) {
    issues.push(issue("frames", "Observed frame count exceeds the limit."));
  }
  if (observation?.rawPayloadRetained !== false) {
    issues.push(issue("raw_payload", "Raw media cannot be retained in evidence."));
  }
  if (!SHA256.test(String(observation?.emittedDigest ?? ""))) {
    issues.push(issue("emitted_digest", "Emitted output needs a SHA-256 observation digest."));
  }
  const recoveryRequired = issues.length > 0;
  return {
    ok: !recoveryRequired,
    issues,
    receipt: {
      sessionId: session?.sessionId,
      fixtureId: observation?.fixtureId,
      inputDigest: observation?.inputDigest,
      consumedBytes: observation?.consumedBytes,
      emittedDigest: observation?.emittedDigest,
      frames: observation?.frames,
      protectedContentRedacted: generated?.fixture.scenario === "protected-speech",
      rawPayloadRetained: false,
      evidenceClass: policy.evidenceClass,
      outcome: recoveryRequired
        ? "REFUSED_AND_RECOVERY_REQUIRED"
        : "SIMULATED_OBSERVATION_VERIFIED",
      recovery: recoveryRequired
        ? {
            checkpointId: session?.checkpointId,
            retryLimit: policy.recovery.maximumRetries,
            releaseAdapters: true,
            clearClipboard: true,
          }
        : null,
    },
  };
}

export function assertMediaEvidenceClaim(policy, claim) {
  return claim?.evidenceClass === policy.evidenceClass && claim?.realHardware !== true
    ? { ok: true, issues: [] }
    : {
        ok: false,
        issues: [
          issue(
            "false_runtime_claim",
            "Media-lab output is simulated evidence and cannot be published as physical-device proof.",
          ),
        ],
      };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const policy = JSON.parse(readFileSync("release/OCADE_MEDIA_LAB_POLICY.json", "utf8"));
  const result = validateMediaLabPolicy(policy);
  if (!result.ok) {
    console.error(`Media-lab gate failed (${result.issues.length}):`);
    for (const entry of result.issues) console.error(`- ${entry.code}: ${entry.message}`);
    process.exit(1);
  }
  const digests = new Set(
    policy.fixtures.map((fixture) => generateMediaFixture(policy, fixture.id).digest),
  );
  if (digests.size !== policy.fixtures.length) {
    console.error("Media-lab gate failed: deterministic fixtures are not unique.");
    process.exit(1);
  }
  console.log(
    `Media-lab gate: ${policy.adapters.length} adapters, ${policy.fixtures.length} deterministic fixtures, ${digests.size} unique digests.`,
  );
  console.log(`${policy.evidenceClass}; physical acoustic and camera proof remains external.`);
}
