export interface LifecyclePolicy {
  schemaVersion: 1;
  owner: string;
  maximumObservationAgeMs: number;
  trustedAdvisoryHosts: string[];
  driftSignals: string[];
  severityActions: Record<string, string>;
  patchRequirements: Record<string, boolean>;
  automaticPatchApplication: false;
  invalidatePrivateRecipesOnDrift: true;
  revokeAffectedSkillsOnCriticalOrHigh: true;
  currentRuntime: Record<string, false>;
  externalBoundary: string;
}

export interface ApplicationLifecycleState {
  appId: string;
  version: string;
  fingerprint: string;
  capabilityDigest: string;
  layoutRevision: string;
  plugins: string[];
  observedAt: string;
}

export interface SecurityAdvisory {
  id: string;
  appId: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedVersions: string[];
  fixedVersion: string;
  sourceUrl: string;
  advisorySha256: string;
  signatureVerified: boolean;
  observedAt: string;
}

export function validateLifecyclePolicy(policy: unknown): { ok: boolean; issues: string[] };
export function evaluateApplicationDrift(
  policy: LifecyclePolicy,
  baseline: ApplicationLifecycleState,
  observation: ApplicationLifecycleState,
  options?: { now?: Date; signal?: AbortSignal },
): {
  valid: boolean;
  executionAllowed: boolean;
  invalidated: boolean;
  reasons: string[];
  action?: string;
  recovery?: string;
};
export function evaluateSecurityPatch(
  policy: LifecyclePolicy,
  advisory: SecurityAdvisory,
  installedVersion: string,
  evidence?: Record<string, unknown>,
  options?: { now?: Date; signal?: AbortSignal },
): {
  valid: boolean;
  affected: boolean;
  executionBlocked: boolean;
  stagingReady: boolean;
  applied: false;
  action?: string;
  reasons: string[];
  externalAction?: string | null;
};
export class MemoryLifecycleEvidenceStore {
  save(receipt: Record<string, unknown>): void;
  all(): Record<string, unknown>[];
}
export function coordinateLifecycleReview(input: {
  policy: LifecyclePolicy;
  baseline: ApplicationLifecycleState;
  observation: ApplicationLifecycleState;
  advisory: SecurityAdvisory;
  patchEvidence: Record<string, unknown>;
  skillIds: string[];
  revocations: {
    revokeAllVersions(skillId: string, reason: string, at?: string): void;
  };
  store: MemoryLifecycleEvidenceStore;
  receiptId: string;
  sourceRevision: string;
  now: Date;
  signal?: AbortSignal;
}): Promise<{
  drift: ReturnType<typeof evaluateApplicationDrift>;
  patch: ReturnType<typeof evaluateSecurityPatch>;
  receipt: Record<string, unknown>;
}>;
