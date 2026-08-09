import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { signEvidencePayload } from "../../../scripts/compatibility-evidence.mjs";
import {
  authorizeBurstCompute,
  authorizeLanOnlyConnection,
  authorizeMeshJob,
  openBurstPayload,
  sealBurstPayload,
  validatePrivateComputePolicy,
  verifyBurstResult,
  verifyMeshNode,
} from "../../../scripts/private-compute.mjs";

const policy = JSON.parse(readFileSync("release/OCADE_PRIVATE_COMPUTE_POLICY.json", "utf8"));
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const NOW = new Date("2026-07-30T17:05:00.000Z");
const FUTURE = "2026-07-30T18:05:00.000Z";
const providerKeys = generateKeyPairSync("ed25519");
const nodeKeys = generateKeyPairSync("ed25519");
const requesterKeys = generateKeyPairSync("ed25519");
const payload = Buffer.from("minimum transformed workload");

const burstRequest = {
  tenantId: "tenant-a",
  userId: "user-a",
  jobId: "burst-1",
  providerId: "operator-approved-burst",
  dataClass: "internal",
  containsProtectedData: false,
  consentGranted: true,
  consentExpiresAt: FUTURE,
  payloadMinimized: true,
  transformedWorkload: true,
  retentionDisclosure: "discard after result",
  pricingDisclosure: "operator-approved price applies",
  timeoutMilliseconds: 60000,
  retryCount: 0,
  inputDigest: sha(payload),
  outputContractDigest: sha("output-contract"),
  localFallbackId: "local-cpu-fallback",
};
const node = {
  nodeId: "node-1",
  tenantId: "tenant-a",
  userId: "user-a",
  logicalCores: 16,
  memoryMiB: 32768,
  capabilities: ["render", "inference"],
  transport: "lan-mutual-tls",
  address: "192.168.1.20",
  certificateFingerprint: sha("node-cert"),
  online: true,
  revoked: false,
  expiresAt: FUTURE,
};
const meshJob = {
  jobId: "mesh-1",
  tenantId: "tenant-a",
  userId: "user-a",
  capability: "render",
  inputDigest: sha("mesh-input"),
  retryCount: 0,
  protectedData: false,
};
const lanRequest = {
  tenantId: "tenant-a",
  userId: "user-a",
  nodeId: "node-1",
  pairingMethod: "qr",
  pairingProofValid: true,
  mutualAuthentication: true,
  localCertificateFingerprint: sha("node-cert"),
  expectedCertificateFingerprint: sha("node-cert"),
  certificateExpired: false,
  certificateRevoked: false,
  networkScopeIndicator: "LAN ONLY",
  subnetChanged: false,
  reauthenticatedAfterSubnetChange: false,
  trace: {
    dnsQueries: [],
    relayUsed: false,
    destinations: ["192.168.1.20", "10.0.0.4", "fd00::1"],
  },
};

describe("private compute", () => {
  it("validates one owner and fail-closed burst, mesh and LAN policies", () => {
    expect(validatePrivateComputePolicy(policy)).toEqual({ ok: true, issues: [] });
  });

  it("authorizes only a fresh, minimized, disclosed and bounded burst job", () => {
    expect(authorizeBurstCompute(policy, burstRequest, { now: NOW })).toMatchObject({
      ok: true,
      plan: {
        jobId: "burst-1",
        localFallbackId: "local-cpu-fallback",
        evidenceClass: "ENCRYPTED BURST EXECUTION CANDIDATE - PROVIDER RUNTIME REQUIRED",
      },
    });
  });

  it("refuses protected data, stale consent, unknown providers, missing disclosure and excessive retry", () => {
    const result = authorizeBurstCompute(
      policy,
      {
        ...burstRequest,
        providerId: "unapproved",
        dataClass: "protected",
        consentExpiresAt: "2026-07-30T16:00:00.000Z",
        payloadMinimized: false,
        retentionDisclosure: "",
        retryCount: 2,
      },
      { now: NOW },
    );
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "provider",
        "protected",
        "consent",
        "minimisation",
        "disclosure",
        "limits",
      ]),
    );
    expect(result.plan).toMatchObject({
      outcome: "REFUSED_USE_LOCAL_FALLBACK",
      localFallbackId: "local-cpu-fallback",
    });
  });

  it("encrypts the exact minimal payload with tenant/job/provider binding and detects tampering", () => {
    const plan = authorizeBurstCompute(policy, burstRequest, { now: NOW }).plan;
    const key = Buffer.alloc(32, 7);
    const sealed = sealBurstPayload(plan, payload, key, { nonce: Buffer.alloc(12, 3) });
    expect(sealed.ciphertext).not.toContain(payload.toString());
    expect(openBurstPayload(plan, sealed, key).equals(payload)).toBe(true);
    expect(() =>
      openBurstPayload(plan, { ...sealed, tag: Buffer.alloc(16).toString("base64") }, key),
    ).toThrow();
  });

  it("verifies a complete signed provider result without claiming a live provider was contacted", () => {
    const plan = authorizeBurstCompute(policy, burstRequest, { now: NOW }).plan;
    const result = signEvidencePayload(
      {
        ...plan,
        status: "complete",
        partial: false,
        outputDigest: sha("burst-output"),
        retentionApplied: "as-disclosed",
      },
      providerKeys.privateKey,
    );
    expect(verifyBurstResult(policy, plan, result, providerKeys.publicKey)).toMatchObject({
      ok: true,
      receipt: {
        outputDigest: sha("burst-output"),
        evidenceClass: "ENCRYPTED BURST EXECUTION CANDIDATE - PROVIDER RUNTIME REQUIRED",
      },
    });
  });

  it("routes provider outage, partial output, retention drift and evidence mismatch to local fallback", () => {
    const plan = authorizeBurstCompute(policy, burstRequest, { now: NOW }).plan;
    const result = signEvidencePayload(
      {
        ...plan,
        inputDigest: sha("wrong-input"),
        status: "outage",
        partial: true,
        outputDigest: "",
        retentionApplied: "retained",
      },
      providerKeys.privateKey,
    );
    expect(verifyBurstResult(policy, plan, result, providerKeys.publicKey)).toMatchObject({
      ok: false,
      receipt: {
        outcome: "PROVIDER_RESULT_REFUSED_USE_LOCAL_FALLBACK",
        localFallbackId: "local-cpu-fallback",
      },
    });
  });

  it("verifies a signed measured home node on a private mutual-TLS address", () => {
    const result = verifyMeshNode(
      policy,
      signEvidencePayload(node, nodeKeys.privateKey),
      nodeKeys.publicKey,
      { now: NOW },
    );
    expect(result).toMatchObject({
      ok: true,
      node: {
        nodeId: "node-1",
        addressMutable: true,
        evidenceClass: "AUTHORISED MESH EXECUTION CANDIDATE - NODE RUNTIME REQUIRED",
      },
    });
  });

  it("refuses revoked, offline, expired, impossible, malicious or public-address node claims", () => {
    const malicious = {
      ...node,
      revoked: true,
      online: false,
      expiresAt: "2026-07-30T16:00:00.000Z",
      logicalCores: 100000,
      memoryMiB: 999999999,
      address: "8.8.8.8",
    };
    const result = verifyMeshNode(
      policy,
      signEvidencePayload(malicious, nodeKeys.privateKey),
      nodeKeys.publicKey,
      { now: NOW },
    );
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["unavailable", "expired", "malicious_claim", "network_isolation"]),
    );
  });

  it("accepts a signed tenant/user/capability-bound mesh job once", () => {
    const verified = verifyMeshNode(
      policy,
      signEvidencePayload(node, nodeKeys.privateKey),
      nodeKeys.publicKey,
      { now: NOW },
    ).node;
    expect(
      authorizeMeshJob(
        policy,
        verified,
        signEvidencePayload(meshJob, requesterKeys.privateKey),
        requesterKeys.publicKey,
        { seenJobIds: new Set() },
      ),
    ).toMatchObject({
      ok: true,
      receipt: {
        nodeId: "node-1",
        jobId: "mesh-1",
        transport: "lan-mutual-tls",
      },
    });
  });

  it("refuses duplicate jobs, tenant drift, capability drift, protected data and excessive retry", () => {
    const verified = verifyMeshNode(
      policy,
      signEvidencePayload(node, nodeKeys.privateKey),
      nodeKeys.publicKey,
      { now: NOW },
    ).node;
    const badJob = {
      ...meshJob,
      tenantId: "tenant-b",
      capability: "unknown",
      protectedData: true,
      retryCount: 2,
    };
    const result = authorizeMeshJob(
      policy,
      verified,
      signEvidencePayload(badJob, requesterKeys.privateKey),
      requesterKeys.publicKey,
      { seenJobIds: new Set(["mesh-1"]) },
    );
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["tenantId", "capability", "duplicate", "retry", "protected"]),
    );
  });

  it("binds node identity to its certificate rather than a changing private IP address", () => {
    const first = verifyMeshNode(
      policy,
      signEvidencePayload(node, nodeKeys.privateKey),
      nodeKeys.publicKey,
      { now: NOW },
    ).node;
    const moved = { ...node, address: "192.168.2.44" };
    const second = verifyMeshNode(
      policy,
      signEvidencePayload(moved, nodeKeys.privateKey),
      nodeKeys.publicKey,
      { now: NOW },
    ).node;
    expect(first.identityBinding).toBe(second.identityBinding);
  });

  it("accepts mutually authenticated LAN-only pairing with zero DNS, relay or public destinations", () => {
    expect(authorizeLanOnlyConnection(policy, lanRequest)).toMatchObject({
      ok: true,
      receipt: {
        scope: "LAN ONLY",
        dnsQueries: 0,
        relayUsed: false,
        evidenceClass: "LAN-ONLY POLICY VERIFIED - LIVE NETWORK CAPTURE REQUIRED",
      },
    });
  });

  it("refuses rogue pairing, certificate drift, hidden scope, DNS, relay and public traffic", () => {
    const result = authorizeLanOnlyConnection(policy, {
      ...lanRequest,
      pairingProofValid: false,
      expectedCertificateFingerprint: sha("rogue-cert"),
      networkScopeIndicator: "",
      trace: {
        dnsQueries: ["example.com"],
        relayUsed: true,
        destinations: ["1.1.1.1", "provider.example"],
      },
    });
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "pairing",
        "certificate",
        "indicator",
        "dns",
        "relay",
        "public_network",
      ]),
    );
  });

  it("requires certificate-backed reauthentication after subnet change and honours local stop", () => {
    const result = authorizeLanOnlyConnection(policy, {
      ...lanRequest,
      subnetChanged: true,
      reauthenticatedAfterSubnetChange: false,
      emergencyStop: true,
    });
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["subnet", "revoked"]),
    );
  });

  it("honours cancellation before burst, mesh and LAN authorisation", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      authorizeBurstCompute(policy, burstRequest, { signal: controller.signal }),
    ).toThrow(/cancelled/);
    expect(() =>
      verifyMeshNode(policy, signEvidencePayload(node, nodeKeys.privateKey), nodeKeys.publicKey, {
        signal: controller.signal,
      }),
    ).toThrow(/cancelled/);
    expect(() =>
      authorizeLanOnlyConnection(policy, lanRequest, { signal: controller.signal }),
    ).toThrow(/cancelled/);
  });
});
