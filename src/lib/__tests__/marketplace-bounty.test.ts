import { describe, expect, it } from "vitest";
import {
  CompatibilityBountyEngine,
  MarketplaceRegistry,
  evaluateMarketplaceSubmission,
  type AcceptanceResult,
  type BountyStore,
  type CompatibilityBounty,
  type InstalledMarketplaceSkill,
  type MarketplaceStore,
  type MarketplaceSubmission,
} from "../skills/marketplace";
import type { RevocationEntry, SkillCapability, TrustInput } from "../skills/skill-trust";

const NOW = new Date("2026-07-30T17:30:00.000Z");
const DIGEST = "a".repeat(64);
const EVIDENCE = "b".repeat(64);

async function keypair() {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
  return {
    pair,
    publicKeyBase64: btoa(String.fromCharCode(...new Uint8Array(raw))),
  };
}

async function sign(privateKey: CryptoKey, digest: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(digest),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function submission(
  overrides: Partial<MarketplaceSubmission> = {},
): Promise<MarketplaceSubmission> {
  const { pair, publicKeyBase64 } = await keypair();
  const manifest = {
    id: "skill.community.editor",
    version: "1.2.0",
    publisher: "community",
    contentSha256: DIGEST,
    capabilities: ["read_screen", "click"] as SkillCapability[],
    targetAppId: "app.editor",
    targetAppVersion: "4.2.0",
  };
  const trust: TrustInput = {
    skill: {
      manifest,
      signatureBase64: await sign(pair.privateKey, manifest.contentSha256),
    },
    publishers: [{ publisher: "community", publicKeyBase64 }],
    revocations: [],
    grantedCapabilities: ["read_screen", "click"],
    observedAppVersion: "4.2.3",
  };
  return {
    tenantId: "tenant-a",
    submittedBy: "publisher-user",
    reviewedBy: "reviewer-user",
    publisherReputation: 0.92,
    trust,
    sandboxProfileId: "ocade-skill-v1",
    localRevalidation: {
      observedAt: "2026-07-30T17:29:00.000Z",
      fixtureSha256: "c".repeat(64),
      results: [{ id: "opens-document", passed: true, evidenceSha256: EVIDENCE }],
    },
    evidenceTier: "SIMULATED_RUNTIME_VERIFIED",
    expiresAt: "2026-07-31T17:30:00.000Z",
    ...overrides,
  };
}

function memoryStore<T>() {
  const records = new Map<string, readonly T[]>();
  return {
    load: async (tenantId: string) => records.get(tenantId) ?? [],
    save: async (tenantId: string, next: readonly T[]) => {
      records.set(tenantId, structuredClone(next));
    },
    records,
  };
}

describe("signed application-skill marketplace", () => {
  it("admits a genuinely signed, independently reviewed, locally revalidated skill", async () => {
    const result = await evaluateMarketplaceSubmission(await submission(), { now: NOW });
    expect(result.admitted).toBe(true);
    if (result.admitted) {
      expect(result.receipt).toMatchObject({
        tenantId: "tenant-a",
        skillId: "skill.community.editor",
        productionRuntimeProven: false,
        evidenceTier: "SIMULATED_RUNTIME_VERIFIED",
      });
    }
  });

  it("labels real target evidence without upgrading simulated evidence", async () => {
    const result = await evaluateMarketplaceSubmission(
      await submission({ evidenceTier: "REAL_TARGET_RUNTIME_VERIFIED" }),
      { now: NOW },
    );
    expect(result.admitted && result.receipt.productionRuntimeProven).toBe(true);
  });

  it.each([
    ["self review", { reviewedBy: "publisher-user" }, "independent_review_required"],
    ["low reputation", { publisherReputation: 0.79 }, "low_reputation"],
    ["wrong sandbox", { sandboxProfileId: "unsafe" as never }, "sandbox_required"],
    ["expired evidence", { expiresAt: "2026-07-30T17:29:59.000Z" }, "stale_submission"],
  ])("refuses %s", async (_label, override, code) => {
    const result = await evaluateMarketplaceSubmission(await submission(override), { now: NOW });
    expect(result).toMatchObject({ admitted: false, code });
  });

  it("refuses unsigned and revoked skills through the real trust evaluator", async () => {
    const unsigned = await submission();
    unsigned.trust.skill.signatureBase64 = null;
    await expect(evaluateMarketplaceSubmission(unsigned, { now: NOW })).resolves.toMatchObject({
      admitted: false,
      code: "trust_unsigned",
    });

    const revoked = await submission();
    revoked.trust.revocations.push({
      skillId: revoked.trust.skill.manifest.id,
      reason: "malicious selector",
      revokedAt: NOW.toISOString(),
    });
    await expect(evaluateMarketplaceSubmission(revoked, { now: NOW })).resolves.toMatchObject({
      admitted: false,
      code: "trust_skill_revoked",
    });
  });

  it("refuses failed, missing, malformed and future-dated local revalidation", async () => {
    for (const localRevalidation of [
      {
        observedAt: NOW.toISOString(),
        fixtureSha256: "c".repeat(64),
        results: [{ id: "opens-document", passed: false, evidenceSha256: EVIDENCE }],
      },
      { observedAt: NOW.toISOString(), fixtureSha256: "c".repeat(64), results: [] },
      {
        observedAt: NOW.toISOString(),
        fixtureSha256: "not-a-digest",
        results: [{ id: "opens-document", passed: true, evidenceSha256: EVIDENCE }],
      },
      {
        observedAt: "2026-07-30T18:30:00.000Z",
        fixtureSha256: "c".repeat(64),
        results: [{ id: "opens-document", passed: true, evidenceSha256: EVIDENCE }],
      },
    ]) {
      const result = await evaluateMarketplaceSubmission(await submission({ localRevalidation }), {
        now: NOW,
      });
      expect(result.admitted).toBe(false);
    }
  });

  it("honours cancellation before trust evaluation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      evaluateMarketplaceSubmission(await submission(), { now: NOW, signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("persists tenant-scoped installs, refuses duplicates and re-checks app versions", async () => {
    const store = memoryStore<InstalledMarketplaceSkill>();
    const registry = new MarketplaceRegistry(store as MarketplaceStore);
    const admission = await evaluateMarketplaceSubmission(await submission(), { now: NOW });
    await registry.install("tenant-a", "installer", admission, NOW);
    await expect(registry.install("tenant-a", "installer", admission, NOW)).rejects.toThrow(
      /already installed/i,
    );
    await expect(registry.install("tenant-b", "installer", admission, NOW)).rejects.toThrow(
      /cross-tenant/i,
    );
    await expect(registry.resolve("tenant-a", "skill.community.editor", "4.2.9")).resolves.not.toBe(
      null,
    );
    await expect(
      registry.resolve("tenant-a", "skill.community.editor", "4.3.0"),
    ).resolves.toBeNull();
    await expect(
      registry.resolve("tenant-b", "skill.community.editor", "4.2.9"),
    ).resolves.toBeNull();
  });

  it("makes emergency revocation durable and immediately removes resolution", async () => {
    const store = memoryStore<InstalledMarketplaceSkill>();
    const registry = new MarketplaceRegistry(store as MarketplaceStore);
    const admission = await evaluateMarketplaceSubmission(await submission(), { now: NOW });
    await registry.install("tenant-a", "installer", admission, NOW);
    await registry.revoke("tenant-a", "skill.community.editor", "unsafe selector", NOW);
    await expect(
      registry.resolve("tenant-a", "skill.community.editor", "4.2.1"),
    ).resolves.toBeNull();
    expect(store.records.get("tenant-a")?.[0]).toMatchObject({
      revokedAt: NOW.toISOString(),
      revocationReason: "unsafe selector",
    });
  });
});

const criteria = ["launches", "exports"];
const evidenceResults: AcceptanceResult[] = criteria.map((id, index) => ({
  id,
  passed: true,
  evidenceSha256: (index === 0 ? "d" : "e").repeat(64),
}));

function bountyInput() {
  return {
    id: "bounty-1",
    tenantId: "tenant-a",
    requestedBy: "requester",
    targetAppId: "app.editor",
    targetAppVersion: "4.2.0",
    capabilityId: "export-document",
    acceptanceCriteria: criteria,
    priorityCredits: 50,
  };
}

describe("community compatibility bounty engine", () => {
  it("creates a bounded, non-financial priority request and rejects duplicates", async () => {
    const store = memoryStore<CompatibilityBounty>();
    const engine = new CompatibilityBountyEngine(store as BountyStore);
    await expect(engine.create(bountyInput())).resolves.toMatchObject({
      status: "OPEN",
      priorityCredits: 50,
      audit: ["request_created_without_financial_escrow"],
    });
    await expect(engine.create({ ...bountyInput(), id: "bounty-2" })).rejects.toThrow(
      /already active/i,
    );
  });

  it("rejects unbounded requests and requester self-claims", async () => {
    const engine = new CompatibilityBountyEngine(memoryStore<CompatibilityBounty>() as BountyStore);
    await expect(engine.create({ ...bountyInput(), priorityCredits: 101 })).rejects.toThrow(
      /bounded/i,
    );
    await engine.create(bountyInput());
    await expect(engine.claim("tenant-a", "bounty-1", "requester")).rejects.toThrow(
      /cannot independently/i,
    );
  });

  it("prevents duplicate claims and cross-tenant mutation", async () => {
    const engine = new CompatibilityBountyEngine(memoryStore<CompatibilityBounty>() as BountyStore);
    await engine.create(bountyInput());
    await engine.claim("tenant-a", "bounty-1", "contributor");
    await expect(engine.claim("tenant-a", "bounty-1", "other")).rejects.toThrow(/only an open/i);
    await expect(engine.claim("tenant-b", "bounty-1", "other")).rejects.toThrow(/not found/i);
  });

  it.each([
    [
      "simulated evidence",
      { targetAppVersion: "4.2.0", tier: "SIMULATED_RUNTIME_VERIFIED", results: evidenceResults },
    ],
    [
      "version mismatch",
      {
        targetAppVersion: "4.3.0",
        tier: "REAL_TARGET_RUNTIME_VERIFIED",
        results: evidenceResults,
      },
    ],
    [
      "partial completion",
      {
        targetAppVersion: "4.2.0",
        tier: "REAL_TARGET_RUNTIME_VERIFIED",
        results: evidenceResults.slice(0, 1),
      },
    ],
    [
      "failed acceptance",
      {
        targetAppVersion: "4.2.0",
        tier: "REAL_TARGET_RUNTIME_VERIFIED",
        results: [{ ...evidenceResults[0], passed: false }, evidenceResults[1]],
      },
    ],
  ])("rejects %s", async (_label, submitted) => {
    const engine = new CompatibilityBountyEngine(memoryStore<CompatibilityBounty>() as BountyStore);
    await engine.create(bountyInput());
    await engine.claim("tenant-a", "bounty-1", "contributor");
    await expect(
      engine.submit("tenant-a", "bounty-1", "contributor", submitted as never),
    ).rejects.toThrow(/real, version-matched evidence/i);
  });

  it("rejects evidence for unpublished criteria and a non-claimant submission", async () => {
    const engine = new CompatibilityBountyEngine(memoryStore<CompatibilityBounty>() as BountyStore);
    await engine.create(bountyInput());
    await engine.claim("tenant-a", "bounty-1", "contributor");
    await expect(
      engine.submit("tenant-a", "bounty-1", "other", {
        targetAppVersion: "4.2.0",
        tier: "REAL_TARGET_RUNTIME_VERIFIED",
        results: evidenceResults,
      }),
    ).rejects.toThrow(/active claimant/i);
    await expect(
      engine.submit("tenant-a", "bounty-1", "contributor", {
        targetAppVersion: "4.2.0",
        tier: "REAL_TARGET_RUNTIME_VERIFIED",
        results: [{ ...evidenceResults[0], id: "different" }, evidenceResults[1]],
      }),
    ).rejects.toThrow(/published acceptance/i);
  });

  it("verifies complete real evidence but never reports or executes a payout", async () => {
    const engine = new CompatibilityBountyEngine(memoryStore<CompatibilityBounty>() as BountyStore);
    await engine.create(bountyInput());
    await engine.claim("tenant-a", "bounty-1", "contributor");
    await engine.submit("tenant-a", "bounty-1", "contributor", {
      targetAppVersion: "4.2.0",
      tier: "REAL_TARGET_RUNTIME_VERIFIED",
      results: evidenceResults,
    });
    await expect(engine.verify("tenant-a", "bounty-1", "contributor")).rejects.toThrow(
      /independent review/i,
    );
    await expect(engine.verify("tenant-a", "bounty-1", "reviewer")).resolves.toMatchObject({
      status: "VERIFIED",
      payout: "EXTERNALLY_BLOCKED",
      reviewedBy: "reviewer",
    });
  });

  it("supports disputes and later revocation with an audit record", async () => {
    const first = new CompatibilityBountyEngine(memoryStore<CompatibilityBounty>() as BountyStore);
    await first.create(bountyInput());
    await expect(first.dispute("tenant-a", "bounty-1", "fraud suspected")).resolves.toMatchObject({
      status: "DISPUTED",
    });

    const second = new CompatibilityBountyEngine(memoryStore<CompatibilityBounty>() as BountyStore);
    await second.create(bountyInput());
    await second.claim("tenant-a", "bounty-1", "contributor");
    await second.submit("tenant-a", "bounty-1", "contributor", {
      targetAppVersion: "4.2.0",
      tier: "REAL_TARGET_RUNTIME_VERIFIED",
      results: evidenceResults,
    });
    await second.verify("tenant-a", "bounty-1", "reviewer");
    const revocations: RevocationEntry[] = [];
    await expect(
      second.revoke("tenant-a", "bounty-1", "evidence later disproved", revocations),
    ).resolves.toMatchObject({ status: "REVOKED" });
    expect(revocations[0]).toMatchObject({
      skillId: "bounty:bounty-1",
      reason: "evidence later disproved",
    });
  });
});
