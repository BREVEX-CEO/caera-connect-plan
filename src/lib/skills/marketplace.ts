import {
  evaluateSkillTrust,
  versionsCompatible,
  type RevocationEntry,
  type TrustInput,
} from "./skill-trust";

const SHA256 = /^[a-f0-9]{64}$/;

export const MARKETPLACE_RUNTIME_BOUNDARY = {
  owner: "application-compatibility-marketplace-owner",
  mode: "LOCAL_REVIEW_AND_PRIORITY_ONLY",
  minimumPublisherReputation: 0.8,
  financialPayoutsEnabled: false,
  productionClaim:
    "A locally admitted skill is not evidence that its target application ran on this device.",
} as const;

export type MarketplaceEvidenceTier = "SIMULATED_RUNTIME_VERIFIED" | "REAL_TARGET_RUNTIME_VERIFIED";

export interface AcceptanceResult {
  readonly id: string;
  readonly passed: boolean;
  readonly evidenceSha256: string;
}

export interface MarketplaceSubmission {
  readonly tenantId: string;
  readonly submittedBy: string;
  readonly reviewedBy: string;
  readonly publisherReputation: number;
  readonly trust: TrustInput;
  readonly sandboxProfileId: "ocade-skill-v1";
  readonly localRevalidation: {
    readonly observedAt: string;
    readonly fixtureSha256: string;
    readonly results: readonly AcceptanceResult[];
  };
  readonly evidenceTier: MarketplaceEvidenceTier;
  readonly expiresAt: string;
}

export interface MarketplaceReceipt {
  readonly kind: "marketplace_admission";
  readonly tenantId: string;
  readonly skillId: string;
  readonly skillVersion: string;
  readonly targetAppId: string;
  readonly targetAppVersion: string;
  readonly admittedAt: string;
  readonly evidenceTier: MarketplaceEvidenceTier;
  readonly evidenceSha256: string;
  readonly productionRuntimeProven: boolean;
  readonly requiredInteractiveApprovals: readonly string[];
}

export type MarketplaceAdmission =
  | { readonly admitted: true; readonly receipt: MarketplaceReceipt }
  | { readonly admitted: false; readonly code: string; readonly reason: string };

function refuse(code: string, reason: string): MarketplaceAdmission {
  return { admitted: false, code, reason };
}

function stopIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Marketplace operation cancelled.", "AbortError");
  }
}

function validEvidence(results: readonly AcceptanceResult[]): boolean {
  return (
    results.length > 0 &&
    results.every(
      (result) =>
        result.id.trim().length > 0 && result.passed === true && SHA256.test(result.evidenceSha256),
    )
  );
}

/**
 * Admit a skill only after the repository's cryptographic trust evaluator and
 * a fresh, local acceptance run both pass. Admission never upgrades simulated
 * evidence into a real-application claim.
 */
export async function evaluateMarketplaceSubmission(
  submission: MarketplaceSubmission,
  options: { readonly now?: Date; readonly signal?: AbortSignal } = {},
): Promise<MarketplaceAdmission> {
  stopIfCancelled(options.signal);
  const now = options.now ?? new Date();
  const manifest = submission.trust.skill.manifest;

  if (!submission.tenantId || !submission.submittedBy || !submission.reviewedBy) {
    return refuse("identity_required", "Tenant, submitter and independent reviewer are required.");
  }
  if (submission.submittedBy === submission.reviewedBy) {
    return refuse("independent_review_required", "A publisher cannot approve their own skill.");
  }
  if (
    !Number.isFinite(submission.publisherReputation) ||
    submission.publisherReputation < MARKETPLACE_RUNTIME_BOUNDARY.minimumPublisherReputation
  ) {
    return refuse("low_reputation", "Publisher reputation is below the admission threshold.");
  }
  if (submission.sandboxProfileId !== "ocade-skill-v1") {
    return refuse("sandbox_required", "The reviewed OCADE skill sandbox is required.");
  }
  if (
    !Number.isFinite(Date.parse(submission.expiresAt)) ||
    Date.parse(submission.expiresAt) <= now.getTime()
  ) {
    return refuse("stale_submission", "Marketplace review evidence is expired.");
  }
  if (
    !Number.isFinite(Date.parse(submission.localRevalidation.observedAt)) ||
    Date.parse(submission.localRevalidation.observedAt) > now.getTime() + 5 * 60_000 ||
    !SHA256.test(submission.localRevalidation.fixtureSha256)
  ) {
    return refuse("invalid_revalidation", "Local revalidation metadata is missing or invalid.");
  }
  if (!validEvidence(submission.localRevalidation.results)) {
    return refuse(
      "acceptance_failed",
      "Every declared acceptance test must pass with digest-bound evidence.",
    );
  }

  const trust = await evaluateSkillTrust(submission.trust);
  stopIfCancelled(options.signal);
  if (!trust.trusted) {
    return refuse(`trust_${trust.refusal}`, trust.reason);
  }

  const evidenceSha256 = submission.localRevalidation.results
    .map((result) => result.evidenceSha256)
    .sort()
    .join(":");
  return {
    admitted: true,
    receipt: {
      kind: "marketplace_admission",
      tenantId: submission.tenantId,
      skillId: manifest.id,
      skillVersion: manifest.version,
      targetAppId: manifest.targetAppId,
      targetAppVersion: manifest.targetAppVersion,
      admittedAt: now.toISOString(),
      evidenceTier: submission.evidenceTier,
      evidenceSha256,
      productionRuntimeProven: submission.evidenceTier === "REAL_TARGET_RUNTIME_VERIFIED",
      requiredInteractiveApprovals: trust.needsApproval,
    },
  };
}

export interface InstalledMarketplaceSkill {
  readonly receipt: MarketplaceReceipt;
  readonly installedBy: string;
  readonly installedAt: string;
  readonly revokedAt?: string;
  readonly revocationReason?: string;
}

export interface MarketplaceStore {
  load(tenantId: string): Promise<readonly InstalledMarketplaceSkill[]>;
  save(tenantId: string, records: readonly InstalledMarketplaceSkill[]): Promise<void>;
}

export class MarketplaceRegistry {
  constructor(private readonly store: MarketplaceStore) {}

  async install(
    tenantId: string,
    userId: string,
    admission: MarketplaceAdmission,
    now = new Date(),
  ): Promise<InstalledMarketplaceSkill> {
    if (!admission.admitted)
      throw new Error("A refused marketplace submission cannot be installed.");
    if (admission.receipt.tenantId !== tenantId) throw new Error("Cross-tenant install refused.");
    const records = [...(await this.store.load(tenantId))];
    const duplicate = records.some(
      (record) =>
        !record.revokedAt &&
        record.receipt.skillId === admission.receipt.skillId &&
        record.receipt.skillVersion === admission.receipt.skillVersion,
    );
    if (duplicate) throw new Error("This exact skill version is already installed.");
    const installed = {
      receipt: admission.receipt,
      installedBy: userId,
      installedAt: now.toISOString(),
    };
    await this.store.save(tenantId, [...records, installed]);
    return installed;
  }

  async resolve(
    tenantId: string,
    skillId: string,
    observedAppVersion: string,
  ): Promise<InstalledMarketplaceSkill | null> {
    const matches = (await this.store.load(tenantId)).filter(
      (record) =>
        record.receipt.skillId === skillId &&
        !record.revokedAt &&
        versionsCompatible(record.receipt.targetAppVersion, observedAppVersion),
    );
    return matches.at(-1) ?? null;
  }

  async revoke(tenantId: string, skillId: string, reason: string, now = new Date()): Promise<void> {
    if (!reason.trim()) throw new Error("A revocation reason is required.");
    const records = await this.store.load(tenantId);
    let changed = false;
    const next = records.map((record) => {
      if (record.receipt.skillId !== skillId || record.revokedAt) return record;
      changed = true;
      return { ...record, revokedAt: now.toISOString(), revocationReason: reason };
    });
    if (!changed) throw new Error("No active tenant-scoped skill matched the revocation.");
    await this.store.save(tenantId, next);
  }
}

export interface CompatibilityBounty {
  readonly id: string;
  readonly tenantId: string;
  readonly requestedBy: string;
  readonly targetAppId: string;
  readonly targetAppVersion: string;
  readonly capabilityId: string;
  readonly acceptanceCriteria: readonly string[];
  readonly priorityCredits: number;
  readonly status: "OPEN" | "CLAIMED" | "SUBMITTED" | "VERIFIED" | "DISPUTED" | "REVOKED";
  readonly claimedBy?: string;
  readonly submittedEvidence?: {
    readonly targetAppVersion: string;
    readonly tier: MarketplaceEvidenceTier;
    readonly results: readonly AcceptanceResult[];
  };
  readonly reviewedBy?: string;
  readonly audit: readonly string[];
}

export interface BountyStore {
  load(tenantId: string): Promise<readonly CompatibilityBounty[]>;
  save(tenantId: string, records: readonly CompatibilityBounty[]): Promise<void>;
}

export class CompatibilityBountyEngine {
  constructor(private readonly store: BountyStore) {}

  async create(input: Omit<CompatibilityBounty, "status" | "audit">): Promise<CompatibilityBounty> {
    if (
      !input.id ||
      !input.tenantId ||
      !input.requestedBy ||
      !input.targetAppId ||
      !input.targetAppVersion ||
      !input.capabilityId ||
      input.acceptanceCriteria.length === 0 ||
      input.acceptanceCriteria.some((criterion) => !criterion.trim()) ||
      !Number.isInteger(input.priorityCredits) ||
      input.priorityCredits < 0 ||
      input.priorityCredits > 100
    ) {
      throw new Error("A complete, bounded compatibility request is required.");
    }
    const records = [...(await this.store.load(input.tenantId))];
    const duplicate = records.some(
      (record) =>
        !["REVOKED", "DISPUTED"].includes(record.status) &&
        record.targetAppId === input.targetAppId &&
        record.targetAppVersion === input.targetAppVersion &&
        record.capabilityId === input.capabilityId,
    );
    if (duplicate) throw new Error("A matching compatibility request is already active.");
    const created: CompatibilityBounty = {
      ...input,
      status: "OPEN",
      audit: ["request_created_without_financial_escrow"],
    };
    await this.store.save(input.tenantId, [...records, created]);
    return created;
  }

  async claim(tenantId: string, id: string, contributorId: string): Promise<CompatibilityBounty> {
    return this.mutate(tenantId, id, (record) => {
      if (record.status !== "OPEN") throw new Error("Only an open request can be claimed.");
      if (record.requestedBy === contributorId) {
        throw new Error("The requester cannot independently satisfy their own bounty.");
      }
      return {
        ...record,
        status: "CLAIMED",
        claimedBy: contributorId,
        audit: [...record.audit, `claimed:${contributorId}`],
      };
    });
  }

  async submit(
    tenantId: string,
    id: string,
    contributorId: string,
    evidence: NonNullable<CompatibilityBounty["submittedEvidence"]>,
  ): Promise<CompatibilityBounty> {
    return this.mutate(tenantId, id, (record) => {
      if (record.status !== "CLAIMED" || record.claimedBy !== contributorId) {
        throw new Error("Only the active claimant can submit evidence.");
      }
      if (
        evidence.targetAppVersion !== record.targetAppVersion ||
        evidence.tier !== "REAL_TARGET_RUNTIME_VERIFIED" ||
        evidence.results.length !== record.acceptanceCriteria.length ||
        !validEvidence(evidence.results)
      ) {
        throw new Error(
          "Real, version-matched evidence for every acceptance criterion is required.",
        );
      }
      const expected = new Set(record.acceptanceCriteria);
      if (evidence.results.some((result) => !expected.has(result.id))) {
        throw new Error("Submitted evidence does not match the published acceptance criteria.");
      }
      return {
        ...record,
        status: "SUBMITTED",
        submittedEvidence: evidence,
        audit: [...record.audit, "real_target_evidence_submitted"],
      };
    });
  }

  async verify(
    tenantId: string,
    id: string,
    reviewerId: string,
  ): Promise<
    CompatibilityBounty & {
      readonly payout: "EXTERNALLY_BLOCKED";
      readonly payoutReason: string;
    }
  > {
    const verified = await this.mutate(tenantId, id, (record) => {
      if (record.status !== "SUBMITTED")
        throw new Error("Only submitted evidence can be reviewed.");
      if (record.claimedBy === reviewerId || record.requestedBy === reviewerId) {
        throw new Error("Independent review is required.");
      }
      return {
        ...record,
        status: "VERIFIED",
        reviewedBy: reviewerId,
        audit: [...record.audit, "acceptance_verified_payout_not_executed"],
      };
    });
    return {
      ...verified,
      payout: "EXTERNALLY_BLOCKED",
      payoutReason:
        "Financial payouts require compliant payment infrastructure and contributor identity checks.",
    };
  }

  async dispute(tenantId: string, id: string, reason: string): Promise<CompatibilityBounty> {
    if (!reason.trim()) throw new Error("A dispute reason is required.");
    return this.mutate(tenantId, id, (record) => ({
      ...record,
      status: "DISPUTED",
      audit: [...record.audit, `disputed:${reason}`],
    }));
  }

  async revoke(
    tenantId: string,
    id: string,
    reason: string,
    revocations: RevocationEntry[],
  ): Promise<CompatibilityBounty> {
    if (!reason.trim()) throw new Error("A revocation reason is required.");
    const record = await this.mutate(tenantId, id, (current) => {
      if (current.status !== "VERIFIED") throw new Error("Only verified evidence can be revoked.");
      return {
        ...current,
        status: "REVOKED",
        audit: [...current.audit, `revoked:${reason}`],
      };
    });
    revocations.push({
      skillId: `bounty:${record.id}`,
      reason,
      revokedAt: new Date().toISOString(),
    });
    return record;
  }

  private async mutate(
    tenantId: string,
    id: string,
    update: (record: CompatibilityBounty) => CompatibilityBounty,
  ): Promise<CompatibilityBounty> {
    const records = [...(await this.store.load(tenantId))];
    const index = records.findIndex((record) => record.id === id && record.tenantId === tenantId);
    if (index < 0) throw new Error("Tenant-scoped compatibility request not found.");
    const next = update(records[index]);
    records[index] = next;
    await this.store.save(tenantId, records);
    return next;
  }
}
