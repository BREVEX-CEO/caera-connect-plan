import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  MediaLabCancelledError,
  assertMediaEvidenceClaim,
  createMediaLabSession,
  generateMediaFixture,
  observeMediaFixture,
  validateMediaLabPolicy,
} from "../../../scripts/media-lab.mjs";

const policy = JSON.parse(readFileSync("release/OCADE_MEDIA_LAB_POLICY.json", "utf8"));
const NOW = new Date("2026-07-30T16:45:00.000Z");
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const request = {
  sessionId: "media-session-1",
  tenantId: "tenant-a",
  userId: "user-a",
  adapters: ["audio-output", "microphone", "camera", "display", "clipboard"],
  permissions: policy.adapters.map((adapter: { permission: string }) => adapter.permission),
  disposableRuntime: true,
  durationMilliseconds: 30000,
  checkpointId: "checkpoint-1",
};

function session() {
  const result = createMediaLabSession(policy, request, { now: NOW });
  expect(result.ok).toBe(true);
  return result.session!;
}

function observation(fixtureId: string, overrides: Record<string, unknown> = {}) {
  const generated = generateMediaFixture(policy, fixtureId);
  return {
    tenantId: "tenant-a",
    fixtureId,
    inputDigest: generated.digest,
    consumedBytes: generated.payload.length,
    emittedDigest: sha(`emitted:${fixtureId}`),
    frames: 1,
    rawPayloadRetained: false,
    ...overrides,
  };
}

describe("HWE-09 virtual media laboratory", () => {
  it("validates the owner, deterministic adapters, required scenarios and recovery policy", () => {
    expect(validateMediaLabPolicy(policy)).toEqual({ ok: true, issues: [] });
    expect(policy.fixtures).toHaveLength(12);
  });

  it("creates a tenant-bound, permission-scoped, disposable and expiring session", () => {
    expect(session()).toMatchObject({
      tenantId: "tenant-a",
      userId: "user-a",
      evidenceClass: "SIMULATED MEDIA-LAB EVIDENCE ONLY",
      checkpointId: "checkpoint-1",
    });
  });

  it("refuses missing permissions, persistent runtimes, excessive duration and emergency stop", () => {
    const result = createMediaLabSession(
      policy,
      {
        ...request,
        permissions: [],
        disposableRuntime: false,
        durationMilliseconds: 60001,
        emergencyStop: true,
      },
      { now: NOW },
    );
    expect(result.ok).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["isolation", "revoked", "duration", "permission"]),
    );
  });

  it("generates byte-identical fixtures and distinct digests", () => {
    const first = generateMediaFixture(policy, "microphone.noise");
    const second = generateMediaFixture(policy, "microphone.noise");
    const other = generateMediaFixture(policy, "camera.nominal");
    expect(first.payload.equals(second.payload)).toBe(true);
    expect(first.digest).toBe(second.digest);
    expect(first.digest).not.toBe(other.digest);
  });

  it.each([
    "audio.nominal",
    "microphone.silence",
    "microphone.noise",
    "camera.nominal",
    "display.long",
    "clipboard.nominal",
  ])(
    "binds exact consumption and emission observations for %s without raw payload evidence",
    (fixtureId) => {
      const result = observeMediaFixture(policy, session(), observation(fixtureId), { now: NOW });
      expect(result.ok).toBe(true);
      expect(result.receipt).toMatchObject({
        fixtureId,
        rawPayloadRetained: false,
        evidenceClass: "SIMULATED MEDIA-LAB EVIDENCE ONLY",
        outcome: "SIMULATED_OBSERVATION_VERIFIED",
      });
    },
  );

  it.each([
    ["device.absent", "device_absent"],
    ["permission.denied", "permission_denied"],
    ["device.unplugged", "device_unplugged"],
    ["camera.malformed", "malformed_frame"],
    ["resource.exhausted", "resource_limit"],
  ])("refuses and returns bounded recovery for %s", (fixtureId, code) => {
    const result = observeMediaFixture(policy, session(), observation(fixtureId), { now: NOW });
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code }));
    expect(result.receipt).toMatchObject({
      outcome: "REFUSED_AND_RECOVERY_REQUIRED",
      recovery: {
        checkpointId: "checkpoint-1",
        retryLimit: 1,
        releaseAdapters: true,
        clearClipboard: true,
      },
    });
  });

  it("refuses tenant drift, tampered consumption, excessive frames and raw payload retention", () => {
    const result = observeMediaFixture(
      policy,
      session(),
      observation("camera.nominal", {
        tenantId: "tenant-b",
        inputDigest: sha("tampered"),
        frames: 601,
        rawPayloadRetained: true,
      }),
      { now: NOW },
    );
    expect(result.ok).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["tenant", "consumption_mismatch", "frames", "raw_payload"]),
    );
  });

  it("allows protected speech only as redacted digest evidence", () => {
    const accepted = observeMediaFixture(policy, session(), observation("microphone.protected"), {
      now: NOW,
    });
    const rejected = observeMediaFixture(
      policy,
      session(),
      observation("microphone.protected", { transcriptRetained: true }),
      { now: NOW },
    );
    expect(accepted.ok).toBe(true);
    expect(accepted.receipt.protectedContentRedacted).toBe(true);
    expect(rejected.issues).toContainEqual(
      expect.objectContaining({ code: "protected_retention" }),
    );
  });

  it("cancels before session, fixture or observation work", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => createMediaLabSession(policy, request, { signal: controller.signal })).toThrow(
      MediaLabCancelledError,
    );
    expect(() =>
      generateMediaFixture(policy, "camera.nominal", { signal: controller.signal }),
    ).toThrow(MediaLabCancelledError);
    expect(() =>
      observeMediaFixture(policy, session(), observation("camera.nominal"), {
        signal: controller.signal,
      }),
    ).toThrow(MediaLabCancelledError);
  });

  it("fails closed when simulated output is described as real hardware proof", () => {
    expect(
      assertMediaEvidenceClaim(policy, {
        evidenceClass: "SIMULATED MEDIA-LAB EVIDENCE ONLY",
        realHardware: false,
      }).ok,
    ).toBe(true);
    expect(
      assertMediaEvidenceClaim(policy, {
        evidenceClass: "REAL TARGET RUNTIME VERIFIED",
        realHardware: true,
      }),
    ).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: "false_runtime_claim",
        }),
      ],
    });
  });
});
