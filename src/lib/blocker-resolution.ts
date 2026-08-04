const SHA256 = /^[a-f0-9]{64}$/;

export const BLOCKER_RESOLUTION_STRATEGIES = [
  { id: "portable_runtime", label: "Portable runtime or WebAssembly" },
  { id: "hosted_clean_runner", label: "Hosted clean runner" },
  { id: "emulator_or_simulator", label: "Emulator or simulator" },
  { id: "free_equivalent", label: "Legitimate free or open-source equivalent" },
  { id: "existing_owned_device", label: "Another device the user already owns" },
  { id: "authorised_remote_worker", label: "Authorised remote worker with a legitimate tool" },
  { id: "peer_to_peer", label: "Peer-to-peer transport" },
  { id: "signed_external_evidence", label: "Signed external evidence bundle" },
  { id: "community_skill_or_bounty", label: "Community skill or compatibility bounty" },
  { id: "one_step_human_action", label: "One explicit owner action" },
] as const;

export type BlockerStrategyId = (typeof BLOCKER_RESOLUTION_STRATEGIES)[number]["id"];
export type BlockerAttemptOutcome = "AVAILABLE" | "FAILED" | "NOT_APPLICABLE" | "EXTERNAL_ACTION";

export interface BlockerEvidence {
  readonly sha256: string;
  readonly observedAt: string;
  readonly source: string;
  readonly verifier: string;
}

export interface BlockerAttempt {
  readonly strategyId: BlockerStrategyId;
  readonly outcome: BlockerAttemptOutcome;
  readonly reason: string;
  readonly evidence: BlockerEvidence;
  readonly ownerAction?: {
    readonly category: "legal" | "credential" | "signing" | "store" | "licence" | "physical_device";
    readonly owner: string;
    readonly instruction: string;
  };
}

export interface BlockerAssessment {
  readonly id: string;
  readonly tenantId: string;
  readonly requirementId: string;
  readonly owner: string;
  readonly attempts: readonly BlockerAttempt[];
}

export type BlockerClassification =
  | {
      readonly classification: "RESOLVABLE";
      readonly recommendedStrategy: BlockerStrategyId;
      readonly evidenceSha256: string;
      readonly reason: string;
    }
  | {
      readonly classification: "EXTERNALLY_BLOCKED";
      readonly ownerAction: NonNullable<BlockerAttempt["ownerAction"]>;
      readonly evidenceSha256: string;
      readonly reason: string;
    }
  | {
      readonly classification: "UNVERIFIED";
      readonly missingOrInvalid: readonly BlockerStrategyId[];
      readonly reason: string;
    };

const ALLOWED_OWNER_ACTIONS = [
  "legal",
  "credential",
  "signing",
  "store",
  "licence",
  "physical_device",
] as const;

function isFreshEvidence(evidence: BlockerEvidence, now: Date, owner: string): boolean {
  const at = Date.parse(evidence?.observedAt);
  return (
    SHA256.test(evidence?.sha256 ?? "") &&
    evidence?.source?.trim().length > 2 &&
    evidence?.verifier?.trim().length > 2 &&
    evidence.verifier !== owner &&
    Number.isFinite(at) &&
    at <= now.getTime() + 5 * 60_000 &&
    now.getTime() - at <= 30 * 24 * 60 * 60_000
  );
}

function joinedEvidence(attempts: readonly BlockerAttempt[]): string {
  return attempts
    .map((attempt) => `${attempt.strategyId}:${attempt.evidence.sha256}`)
    .sort()
    .join("|");
}

/**
 * Evaluate alternatives in the exact mandated order. An external classification
 * is impossible until every alternative has current retained evidence.
 */
export function classifyHardwareOrToolingBlocker(
  assessment: BlockerAssessment,
  options: { readonly now?: Date; readonly signal?: AbortSignal } = {},
): BlockerClassification {
  if (options.signal?.aborted) {
    throw new DOMException("Blocker assessment cancelled.", "AbortError");
  }
  const now = options.now ?? new Date();
  if (!assessment.id || !assessment.tenantId || !assessment.requirementId || !assessment.owner) {
    return {
      classification: "UNVERIFIED",
      missingOrInvalid: BLOCKER_RESOLUTION_STRATEGIES.map((strategy) => strategy.id),
      reason: "Blocker, tenant, requirement and accountable owner are required.",
    };
  }

  const byStrategy = new Map<BlockerStrategyId, BlockerAttempt[]>();
  for (const attempt of assessment.attempts) {
    byStrategy.set(attempt.strategyId, [...(byStrategy.get(attempt.strategyId) ?? []), attempt]);
  }
  const missingOrInvalid = BLOCKER_RESOLUTION_STRATEGIES.flatMap((strategy) => {
    const attempts = byStrategy.get(strategy.id) ?? [];
    if (
      attempts.length !== 1 ||
      !attempts[0].reason.trim() ||
      !isFreshEvidence(attempts[0].evidence, now, assessment.owner)
    ) {
      return [strategy.id];
    }
    if (strategy.id !== "one_step_human_action" && attempts[0].outcome === "EXTERNAL_ACTION") {
      return [strategy.id];
    }
    return [];
  });
  if (assessment.attempts.length !== BLOCKER_RESOLUTION_STRATEGIES.length) {
    missingOrInvalid.push("one_step_human_action");
  }
  if (missingOrInvalid.length > 0) {
    return {
      classification: "UNVERIFIED",
      missingOrInvalid,
      reason: "All ten ordered alternatives require one fresh, digest-bound evidence record.",
    };
  }

  const ordered = BLOCKER_RESOLUTION_STRATEGIES.map(
    (strategy) => byStrategy.get(strategy.id)?.[0] as BlockerAttempt,
  );
  const available = ordered.find((attempt) => attempt.outcome === "AVAILABLE");
  if (available) {
    return {
      classification: "RESOLVABLE",
      recommendedStrategy: available.strategyId,
      evidenceSha256: joinedEvidence(ordered),
      reason: `${available.strategyId} is available; external-blocker classification is refused.`,
    };
  }

  const finalAttempt = ordered.at(-1) as BlockerAttempt;
  const priorOutcomesValid = ordered
    .slice(0, -1)
    .every((attempt) => ["FAILED", "NOT_APPLICABLE"].includes(attempt.outcome));
  const ownerAction = finalAttempt.ownerAction;
  if (
    !priorOutcomesValid ||
    finalAttempt.outcome !== "EXTERNAL_ACTION" ||
    !ownerAction ||
    !(ALLOWED_OWNER_ACTIONS as readonly string[]).includes(ownerAction.category) ||
    !ownerAction.owner.trim() ||
    !ownerAction.instruction.trim()
  ) {
    return {
      classification: "UNVERIFIED",
      missingOrInvalid: ["one_step_human_action"],
      reason:
        "An external blocker must reduce to exactly one lawful credential, legal, signing, store, licence or physical-device owner action.",
    };
  }

  return {
    classification: "EXTERNALLY_BLOCKED",
    ownerAction,
    evidenceSha256: joinedEvidence(ordered),
    reason: `All ten alternatives were evaluated; remaining action belongs to ${ownerAction.owner}.`,
  };
}

export interface RetainedBlockerAssessment {
  readonly assessment: BlockerAssessment;
  readonly classification: BlockerClassification;
  readonly retainedAt: string;
}

export interface BlockerAssessmentStore {
  load(tenantId: string): Promise<readonly RetainedBlockerAssessment[]>;
  save(tenantId: string, records: readonly RetainedBlockerAssessment[]): Promise<void>;
}

export async function retainBlockerAssessment(
  store: BlockerAssessmentStore,
  assessment: BlockerAssessment,
  classification: BlockerClassification,
  now = new Date(),
): Promise<RetainedBlockerAssessment> {
  if (classification.classification === "UNVERIFIED") {
    throw new Error("Unverified blocker assessments cannot become retained completion evidence.");
  }
  const records = await store.load(assessment.tenantId);
  if (records.some((record) => record.assessment.id === assessment.id)) {
    throw new Error("Blocker assessment IDs are idempotent and cannot be overwritten.");
  }
  const retained = { assessment, classification, retainedAt: now.toISOString() };
  await store.save(assessment.tenantId, [...records, retained]);
  return retained;
}
