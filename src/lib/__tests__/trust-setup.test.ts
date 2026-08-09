import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  authorizeSigningPath,
  evaluateCommunitySigningEligibility,
  inspectCredentialPresence,
  removeCredential,
  rotateCredential,
  validateTrustSetupPolicy,
  withScopedCredential,
} from "../../../scripts/trust-setup.mjs";

const policy = JSON.parse(readFileSync("release/OCADE_TRUST_SETUP_POLICY.json", "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const NOW = new Date("2026-07-30T17:18:00.000Z");
const fixtureValue = "fixture-credential-value-not-real";

function store(initial: Record<string, unknown> | null = null) {
  let metadata = initial;
  let value: string | null = initial ? fixtureValue : null;
  const removedVersions: string[] = [];
  return {
    backend: "test-memory-store",
    describe: async () => metadata,
    read: async () => value,
    write: async (
      _tenantId: string,
      _capability: string,
      nextValue: string,
      nextMetadata: Record<string, unknown>,
    ) => {
      value = nextValue;
      metadata = nextMetadata;
    },
    removeVersion: async (_tenantId: string, _capability: string, version: string) => {
      removedVersions.push(version);
    },
    remove: async () => {
      value = null;
      metadata = null;
    },
    removedVersions,
  };
}

const metadata = {
  credentialId: "credential-fixture-1",
  keyVersion: "v1",
  projectId: "project-a",
  scopes: ["project.read", "database.migrate"],
  revoked: false,
  expiresAt: "2026-07-30T18:18:00.000Z",
};
const request = {
  capability: "supabase.staging",
  tenantId: "tenant-a",
  userId: "user-a",
  consumer: "migration-verifier",
  expectedProjectId: "project-a",
};

describe("trust setup", () => {
  it("validates OS secure stores, scoped capabilities, test-trust boundaries and signing eligibility", () => {
    expect(validateTrustSetupPolicy(policy)).toEqual({ ok: true, issues: [] });
  });

  it("reports missing credential presence with exact setup instructions and no fake working claim", async () => {
    expect(
      await inspectCredentialPresence(policy, request, store(), { testMode: true, now: NOW }),
    ).toMatchObject({
      ok: true,
      status: {
        present: false,
        provider: "supabase",
        setupUrl: "https://supabase.com/dashboard/projects",
      },
    });
  });

  it("reports only safe presence, project, scope, rotation and revocation metadata", async () => {
    const result = await inspectCredentialPresence(policy, request, store(metadata), {
      testMode: true,
      now: NOW,
    });
    expect(result).toMatchObject({
      ok: true,
      status: {
        present: true,
        credentialId: "credential-fixture-1",
        keyVersion: "v1",
        projectId: "project-a",
        revoked: false,
        expired: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain(fixtureValue);
  });

  it("refuses a secure-store adapter that leaks a secret through metadata", async () => {
    const result = await inspectCredentialPresence(
      policy,
      request,
      store({ ...metadata, secret: fixtureValue }),
      { testMode: true, now: NOW },
    );
    expect(result).toMatchObject({ ok: false, issues: [{ code: "metadata_leak" }] });
  });

  it("leases a credential only to an allowed consumer and emits secret-free postcondition evidence", async () => {
    const logs: unknown[] = [];
    const result = await withScopedCredential(
      policy,
      request,
      store(metadata),
      async (secret) => {
        expect(secret).toBe(fixtureValue);
        return { ok: true, postconditionDigest: sha("verified-provider-observation") };
      },
      { testMode: true, now: NOW, logger: (entry) => logs.push(entry) },
    );
    expect(result).toMatchObject({
      ok: true,
      receipt: {
        operation: "credential.consume",
        outcome: "POSTCONDITION_VERIFIED",
      },
    });
    expect(JSON.stringify({ result, logs })).not.toContain(fixtureValue);
  });

  it("refuses wrong project, unapproved consumer, revoked key and missing least-privilege scopes", async () => {
    const result = await withScopedCredential(
      policy,
      { ...request, expectedProjectId: "project-b", consumer: "unknown-consumer" },
      store({ ...metadata, revoked: true, scopes: [] }),
      async () => ({ ok: true, postconditionDigest: sha("unused") }),
      { testMode: true, now: NOW },
    );
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["consumer", "wrong_project", "revoked", "scope"]),
    );
  });

  it("refuses a consumer response that echoes the credential or lacks an observed digest", async () => {
    const result = await withScopedCredential(
      policy,
      request,
      store(metadata),
      async (secret) => ({ ok: true, postconditionDigest: "bad", output: secret }),
      { testMode: true, now: NOW },
    );
    expect(result).toMatchObject({ ok: false, issues: [{ code: "consumer_evidence" }] });
  });

  it("refuses an arbitrary memory adapter outside explicit test mode", async () => {
    expect(
      await inspectCredentialPresence(policy, request, store(metadata), { now: NOW }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "backend" }],
    });
  });

  it("rotates, verifies the new metadata and removes the previous key version without logging values", async () => {
    const adapter = store(metadata);
    const result = await rotateCredential(
      policy,
      {
        ...request,
        newValue: "rotated-fixture-value-not-real",
        newMetadata: { ...metadata, keyVersion: "v2" },
        previousKeyVersion: "v1",
      },
      adapter,
      { testMode: true },
    );
    expect(result).toMatchObject({
      ok: true,
      receipt: { keyVersion: "v2", outcome: "ROTATED_AND_PREVIOUS_REMOVED" },
    });
    expect(adapter.removedVersions).toEqual(["v1"]);
    expect(JSON.stringify(result)).not.toContain("rotated-fixture-value-not-real");
  });

  it("removes a credential and independently verifies complete absence", async () => {
    expect(
      await removeCredential(policy, request, store(metadata), { testMode: true }),
    ).toMatchObject({
      ok: true,
      receipt: { outcome: "REMOVAL_VERIFIED" },
    });
  });

  it("keeps every current component ineligible until the owner licences and publishes source", () => {
    for (const component of policy.components) {
      expect(evaluateCommunitySigningEligibility(policy, component).eligible).toBe(false);
    }
    expect(
      policy.components.find((component: { id: string }) => component.id === "ocade-product"),
    ).toMatchObject({ eligibility: "COMMUNITY OPEN-SOURCE SIGNING PROHIBITED" });
  });

  it("recognises a hypothetical owner-approved, public, reproducible and notice-complete component", () => {
    const candidate = {
      ...policy.components[0],
      publicSourceUrl: "https://example.org/ocade/browser-extension",
      spdxLicence: "Apache-2.0",
      ownerApproved: true,
    };
    expect(evaluateCommunitySigningEligibility(policy, candidate)).toEqual({
      ok: true,
      eligible: true,
      issues: [],
    });
  });

  it("never routes proprietary artifacts through community signing", () => {
    expect(
      authorizeSigningPath(policy, {
        componentId: "ocade-product",
        route: "community-open-source",
      }),
    ).toMatchObject({
      ok: false,
      eligible: false,
      route: "REFUSED",
      signed: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: "proprietary" })]),
    });
  });

  it("labels ephemeral self-signing as test-only and refuses absent production identity", () => {
    expect(
      authorizeSigningPath(policy, {
        componentId: "browser-extension",
        route: "self-signed-test",
        environment: "test",
        keyClass: "ephemeral-test",
      }),
    ).toMatchObject({
      ok: true,
      route: "EPHEMERAL SELF-SIGNED TEST TRUST ONLY",
      signed: false,
      publicTrust: false,
    });
    expect(
      authorizeSigningPath(policy, {
        componentId: "ocade-product",
        route: "production-commercial",
        keyClass: "placeholder",
        identityPresent: false,
      }),
    ).toMatchObject({
      ok: false,
      route: "REFUSED",
      signed: false,
      issues: [{ code: "production_identity" }],
    });
  });

  it("honours cancellation before secure-store access", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      inspectCredentialPresence(policy, request, store(metadata), {
        testMode: true,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/cancelled/);
  });
});
