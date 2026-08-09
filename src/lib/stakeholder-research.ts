const SHA256 = /^[a-f0-9]{64}$/;
const PII_SHAPE = /@|https?:\/\/|(?:\+?\d[\d ().-]{7,}\d)/;

export const STAKEHOLDER_RESEARCH_DIMENSIONS = [
  { id: "interviews", key: "interviews", label: "Interviews" },
  { id: "workflow-observation", key: "workflow_observation", label: "Workflow observation" },
  { id: "pain-points", key: "pain_points", label: "Pain points" },
  { id: "task-frequency", key: "task_frequency", label: "Task frequency" },
  { id: "risk-mapping", key: "risk_mapping", label: "Risk mapping" },
  { id: "accessibility", key: "accessibility", label: "Accessibility" },
  { id: "regional-needs", key: "regional_needs", label: "Regional needs" },
] as const;

export type ResearchDimensionKey = (typeof STAKEHOLDER_RESEARCH_DIMENSIONS)[number]["key"];

export interface StakeholderResearchEvidence {
  readonly evidenceId: string;
  readonly tenantId: string;
  readonly dimension: ResearchDimensionKey;
  readonly participantPseudonym: string;
  readonly participantType: "external_human" | "synthetic_fixture";
  readonly consentReceiptSha256: string;
  readonly evidenceSha256: string;
  readonly occurredAt: string;
  readonly researcherId: string;
  readonly reviewerId: string;
  readonly observationAuthorised: boolean;
  readonly withdrawalSupported: boolean;
  readonly rawContentRetained: false;
  readonly protectedDataRetained: false;
  readonly coverageTags: readonly string[];
}

export type ResearchEvidenceValidation =
  | { readonly valid: true; readonly evidence: StakeholderResearchEvidence }
  | { readonly valid: false; readonly code: string; readonly reason: string };

export function validateStakeholderResearchEvidence(
  evidence: StakeholderResearchEvidence,
  options: { readonly now?: Date; readonly allowSyntheticFixture?: boolean } = {},
): ResearchEvidenceValidation {
  const now = options.now ?? new Date();
  if (
    !evidence.evidenceId ||
    !evidence.tenantId ||
    !evidence.participantPseudonym ||
    PII_SHAPE.test(evidence.participantPseudonym)
  ) {
    return {
      valid: false,
      code: "identity_or_pii",
      reason: "Tenant, evidence ID and a non-identifying participant pseudonym are required.",
    };
  }
  if (evidence.participantType === "synthetic_fixture" && options.allowSyntheticFixture !== true) {
    return {
      valid: false,
      code: "synthetic_not_production",
      reason: "Synthetic research fixtures cannot satisfy a human stakeholder requirement.",
    };
  }
  if (
    !SHA256.test(evidence.consentReceiptSha256) ||
    !SHA256.test(evidence.evidenceSha256) ||
    evidence.observationAuthorised !== true ||
    evidence.withdrawalSupported !== true ||
    evidence.rawContentRetained !== false ||
    evidence.protectedDataRetained !== false
  ) {
    return {
      valid: false,
      code: "privacy_or_consent",
      reason: "Consent, withdrawal, authorisation, digest binding and no-raw-content rules failed.",
    };
  }
  if (
    !evidence.researcherId ||
    !evidence.reviewerId ||
    evidence.researcherId === evidence.reviewerId
  ) {
    return {
      valid: false,
      code: "independent_review",
      reason: "Researcher and evidence reviewer must be distinct.",
    };
  }
  const occurredAt = Date.parse(evidence.occurredAt);
  if (
    !Number.isFinite(occurredAt) ||
    occurredAt > now.getTime() + 5 * 60_000 ||
    now.getTime() - occurredAt > 180 * 24 * 60 * 60_000
  ) {
    return {
      valid: false,
      code: "stale_or_future",
      reason: "Stakeholder evidence must be current and cannot be future-dated.",
    };
  }
  if (
    !STAKEHOLDER_RESEARCH_DIMENSIONS.some((dimension) => dimension.key === evidence.dimension) ||
    evidence.coverageTags.length === 0 ||
    evidence.coverageTags.some((tag) => !tag.trim() || PII_SHAPE.test(tag))
  ) {
    return {
      valid: false,
      code: "coverage",
      reason: "A known research dimension and non-identifying coverage tags are required.",
    };
  }
  return { valid: true, evidence };
}

export interface StakeholderResearchStore {
  load(tenantId: string): Promise<readonly StakeholderResearchEvidence[]>;
  save(tenantId: string, records: readonly StakeholderResearchEvidence[]): Promise<void>;
}

export async function retainStakeholderResearchEvidence(
  store: StakeholderResearchStore,
  evidence: StakeholderResearchEvidence,
  options: {
    readonly now?: Date;
    readonly allowSyntheticFixture?: boolean;
    readonly signal?: AbortSignal;
  } = {},
): Promise<StakeholderResearchEvidence> {
  if (options.signal?.aborted) {
    throw new DOMException("Stakeholder research intake cancelled.", "AbortError");
  }
  const validation = validateStakeholderResearchEvidence(evidence, options);
  if (!validation.valid) throw new Error(validation.reason);
  const records = await store.load(evidence.tenantId);
  if (records.some((record) => record.evidenceId === evidence.evidenceId)) {
    throw new Error("Research evidence IDs are idempotent and cannot be overwritten.");
  }
  await store.save(evidence.tenantId, [...records, evidence]);
  return evidence;
}

export interface StakeholderProgrammeAssessment {
  readonly productionReady: boolean;
  readonly classification: "EXTERNALLY_BLOCKED" | "REAL_PARTICIPANT_EVIDENCE_COMPLETE";
  readonly distinctExternalParticipants: number;
  readonly missingDimensions: readonly ResearchDimensionKey[];
  readonly reason: string;
}

/**
 * Five distinct external participants per dimension is a minimum coverage gate,
 * not a statistical-validity claim. Synthetic fixtures are always excluded.
 */
export function assessStakeholderResearchProgramme(
  records: readonly StakeholderResearchEvidence[],
  options: { readonly minimumParticipantsPerDimension?: number; readonly now?: Date } = {},
): StakeholderProgrammeAssessment {
  const minimum = options.minimumParticipantsPerDimension ?? 5;
  const now = options.now ?? new Date();
  const validExternal = records.filter(
    (record) =>
      record.participantType === "external_human" &&
      validateStakeholderResearchEvidence(record, { now }).valid,
  );
  const missingDimensions = STAKEHOLDER_RESEARCH_DIMENSIONS.filter((dimension) => {
    const participants = new Set(
      validExternal
        .filter((record) => record.dimension === dimension.key)
        .map((record) => record.participantPseudonym),
    );
    return participants.size < minimum;
  }).map((dimension) => dimension.key);
  const distinctExternalParticipants = new Set(
    validExternal.map((record) => record.participantPseudonym),
  ).size;
  return missingDimensions.length === 0
    ? {
        productionReady: true,
        classification: "REAL_PARTICIPANT_EVIDENCE_COMPLETE",
        distinctExternalParticipants,
        missingDimensions: [],
        reason: "Every stakeholder dimension has the minimum current external-human coverage.",
      }
    : {
        productionReady: false,
        classification: "EXTERNALLY_BLOCKED",
        distinctExternalParticipants,
        missingDimensions,
        reason:
          "Authorised external-human interviews and observations remain an owner-coordinated action.",
      };
}
