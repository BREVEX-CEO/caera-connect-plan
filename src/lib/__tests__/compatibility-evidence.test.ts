import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CompatibilityEvidenceCancelledError,
  authorizeCompatibilityLab,
  authorizeSupportOperation,
  createCompatibilityPack,
  redactCompatibilityEvidence,
  signEvidencePayload,
  validateCompatibilityPolicy,
  verifyCompatibilityPack,
  verifyFaultRecovery,
  verifyHardwareAttestation,
} from "../../../scripts/compatibility-evidence.mjs";

const policy = JSON.parse(readFileSync("release/OCADE_COMPATIBILITY_LAB_POLICY.json", "utf8"));
const planKeys = generateKeyPairSync("ed25519");
const testerKeys = generateKeyPairSync("ed25519");
const now = new Date("2026-07-30T12:00:00.000Z");
const plan = {
  planId: "plan-1",
  buildDigest: "b".repeat(64),
  applicationVersion: "1.2.3",
  deviceClass: "windows-x64-gpu",
  benchmarkDigest: "c".repeat(64),
  probes: ["cpu.logical-cores", "memory.total-mib"],
  consentRequired: true,
  expiresAt: "2026-07-31T12:00:00.000Z",
};
const attestation = {
  receiptId: "receipt-1",
  ...plan,
  probes: undefined,
  consentRequired: undefined,
  expiresAt: undefined,
  consentGranted: true,
  environmentFingerprint: "d".repeat(64),
  results: [
    { probeId: "cpu.logical-cores", value: 8 },
    { probeId: "memory.total-mib", value: 16_384 },
  ],
};

describe("signed remote hardware and physical-device evidence", () => {
  it("accepts only the signed, scoped, consented, privacy-safe attestation", () => {
    expect(validateCompatibilityPolicy(policy)).toEqual({ ok: true, issues: [] });
    expect(
      verifyHardwareAttestation({
        policy,
        signedPlan: signEvidencePayload(plan, planKeys.privateKey),
        signedAttestation: signEvidencePayload(attestation, testerKeys.privateKey),
        planPublicKey: planKeys.publicKey,
        testerPublicKey: testerKeys.publicKey,
        seenReceiptIds: new Set(),
        now,
      }),
    ).toMatchObject({
      ok: true,
      receipt: { evidenceClass: "REAL TARGET CANDIDATE - INDEPENDENT REVIEW REQUIRED" },
    });
  });

  it("rejects forgery, expiry, wrong build/device/app, altered benchmark and duplicates", () => {
    const result = verifyHardwareAttestation({
      policy,
      signedPlan: signEvidencePayload(
        { ...plan, expiresAt: "2026-07-29T12:00:00.000Z" },
        planKeys.privateKey,
      ),
      signedAttestation: signEvidencePayload(
        {
          ...attestation,
          buildDigest: "wrong",
          applicationVersion: "9.9.9",
          deviceClass: "wrong-device",
          benchmarkDigest: "wrong",
        },
        testerKeys.privateKey,
      ),
      planPublicKey: planKeys.publicKey,
      testerPublicKey: planKeys.publicKey,
      seenReceiptIds: new Set(["receipt-1"]),
      now,
    });
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "attestation_signature",
        "plan_expired",
        "buildDigest_mismatch",
        "applicationVersion_mismatch",
        "deviceClass_mismatch",
        "benchmark_mismatch",
        "duplicate",
      ]),
    );
  });

  it("rejects undeclared probes, personal fields and impossible hardware claims", () => {
    const unsafe = {
      ...attestation,
      hostName: "private-machine",
      results: [
        { probeId: "cpu.logical-cores", value: 5000 },
        { probeId: "serial.read", value: "secret" },
      ],
    };
    const result = verifyHardwareAttestation({
      policy,
      signedPlan: signEvidencePayload(plan, planKeys.privateKey),
      signedAttestation: signEvidencePayload(unsafe, testerKeys.privateKey),
      planPublicKey: planKeys.publicKey,
      testerPublicKey: testerKeys.publicKey,
      seenReceiptIds: new Set(),
      now,
    });
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["probe_scope", "privacy_field", "impossible_claim"]),
    );
  });

  it("cancels before verifying or accepting evidence", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      verifyHardwareAttestation({
        signal: controller.signal,
      }),
    ).toThrow(CompatibilityEvidenceCancelledError);
  });
});

describe("local redaction, lab and scoped support", () => {
  it("redacts protected values locally and retains only an original digest", () => {
    const result = redactCompatibilityEvidence({
      originalBytes: Buffer.from("private image bytes"),
      containsScreenshot: true,
      maskAppliedBeforeCapture: true,
      structuredFields: {
        title: "Jane Doe at C:\\Users\\Jane\\secret.txt",
        note: "OTP 123456 and card 4111 1111 1111 1111",
      },
      protectedValues: ["Jane Doe"],
      redactionCoverage: 0.4,
      policyVersion: "v1",
    });
    expect(result).toMatchObject({
      ok: true,
      publishable: true,
      classification: "REDACTED EVIDENCE",
    });
    expect(JSON.stringify(result)).not.toContain("Jane Doe");
    expect(JSON.stringify(result)).not.toContain("4111");
  });

  it("refuses unmasked screenshots and keeps over-redacted proof local", () => {
    expect(
      redactCompatibilityEvidence({
        originalBytes: Buffer.from("raw"),
        containsScreenshot: true,
        maskAppliedBeforeCapture: false,
      }),
    ).toMatchObject({ ok: false, code: "masking_unverified" });
    expect(
      redactCompatibilityEvidence({
        originalBytes: Buffer.from("masked"),
        containsScreenshot: true,
        maskAppliedBeforeCapture: true,
        structuredFields: {},
        redactionCoverage: 0.9,
      }),
    ).toMatchObject({ ok: true, publishable: false, classification: "LOCALLY VERIFIED ONLY" });
  });

  it("requires low risk, rehearsal, scoped permission, budget and publication consent", () => {
    expect(
      authorizeCompatibilityLab(policy, {
        lowRisk: true,
        rehearsalPassed: true,
        permissionGranted: true,
        actionBudget: 10,
        publish: false,
      }),
    ).toMatchObject({ ok: true, mode: "local-only" });
    expect(
      authorizeCompatibilityLab(policy, {
        lowRisk: false,
        rehearsalPassed: false,
        permissionGranted: false,
        actionBudget: 99,
        publish: true,
        publicationConsent: false,
      }).issues.map((entry) => entry.code),
    ).toEqual(expect.arrayContaining(["risk", "rehearsal", "permission", "budget", "publication"]));
  });

  it("lets support request redacted diagnostics but never direct or unapproved mutation", () => {
    const base = {
      supporterId: "supporter-1",
      sessionId: "session-1",
      expiresAt: "2026-07-30T12:30:00.000Z",
    };
    expect(
      authorizeSupportOperation(
        policy,
        { ...base, operation: "request-redacted-diagnostics" },
        { now },
      ),
    ).toEqual({ ok: true, issues: [] });
    expect(
      authorizeSupportOperation(
        policy,
        {
          ...base,
          operation: "repair-driver",
          localApproval: false,
          directControl: true,
          protectedContentRequested: true,
        },
        { now },
      ).issues.map((entry) => entry.code),
    ).toEqual(expect.arrayContaining(["approval", "direct_control", "protected"]));
  });
});

describe("fault recovery and signed offline compatibility packs", () => {
  it("accepts only test-shim faults with checkpoint, bounded retry, rollback and unique mutations", () => {
    expect(
      verifyFaultRecovery(policy, {
        fault: "gpu-loss",
        testShim: true,
        checkpointPreserved: true,
        retryCount: 1,
        userVisibleReason: "GPU disappeared; restored the prior checkpoint.",
        rollbackVerified: true,
        mutationIds: ["mutation-1"],
      }),
    ).toEqual({ ok: true, issues: [], evidenceClass: "SIMULATED FAULT ONLY" });
    expect(
      verifyFaultRecovery(policy, {
        fault: "unknown",
        testShim: false,
        retryCount: 5,
        mutationIds: ["same", "same"],
      }).issues.map((entry) => entry.code),
    ).toEqual(
      expect.arrayContaining([
        "fault_scope",
        "production_injection",
        "checkpoint",
        "retry",
        "reason",
        "rollback",
        "duplicate_mutation",
      ]),
    );
  });

  it("round-trips a signed tenant-bound offline pack and rejects tampering", () => {
    const payload = {
      packId: "pack-1",
      tenantId: "tenant-a",
      targetPlatform: "windows-x64",
      version: "1.2.0",
      rollbackVersion: "1.1.0",
      expiresAt: "2026-08-01T00:00:00.000Z",
      components: [
        {
          id: "companion",
          version: "1.2.0",
          bytes: Buffer.from("verified component"),
          licenceNotice: "MIT",
        },
      ],
    };
    const envelope = createCompatibilityPack(payload, planKeys.privateKey);
    expect(
      verifyCompatibilityPack({
        envelope,
        publicKey: planKeys.publicKey,
        targetPlatform: "windows-x64",
        tenantId: "tenant-a",
        installedVersion: "1.1.0",
        components: [{ id: "companion", bytes: Buffer.from("verified component") }],
        seenPackIds: new Set(),
        now,
      }),
    ).toEqual({ ok: true, issues: [] });
    expect(
      verifyCompatibilityPack({
        envelope,
        publicKey: testerKeys.publicKey,
        targetPlatform: "linux-x64",
        tenantId: "tenant-b",
        installedVersion: "9.0.0",
        components: [{ id: "companion", bytes: Buffer.from("tampered") }],
        seenPackIds: new Set(["pack-1"]),
        now: new Date("2026-09-01T00:00:00.000Z"),
      }).issues.map((entry) => entry.code),
    ).toEqual(
      expect.arrayContaining([
        "signature",
        "platform",
        "tenant",
        "expired",
        "replay",
        "downgrade",
        "component",
      ]),
    );
  });
});
