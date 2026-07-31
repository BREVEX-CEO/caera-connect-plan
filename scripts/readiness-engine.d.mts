export declare const STATUS_WEIGHTS: Readonly<Record<string, number>>;

export declare class ReadinessCancelledError extends Error {}

export type ReadinessIssue = {
  readonly code: string;
  readonly message: string;
  readonly requirementId?: string;
};

export type ReadinessCalculation = {
  readonly schemaVersion: 1;
  readonly calculatedAt: string;
  readonly sourceRevision: string | null;
  readonly targetVersion: string | null;
  readonly evidenceBindings: Record<string, unknown>;
  readonly snapshotFresh: boolean;
  readonly denominator: number;
  readonly declared: {
    readonly numerator: number;
    readonly denominator: number;
    readonly percent: number;
  };
  readonly evidenceBound: {
    readonly numerator: number;
    readonly denominator: number;
    readonly percent: number;
  };
  readonly productionReady: boolean;
  readonly counts: Record<string, number>;
  readonly dimensions: ReadonlyArray<Record<string, string | number>>;
  readonly requirements: ReadonlyArray<Record<string, string | number | boolean>>;
  readonly issues: ReadonlyArray<ReadinessIssue>;
};

export declare function evaluateRequirementReadiness(
  snapshot: Record<string, unknown>,
  options?: {
    readonly expectedRequirementCount?: number;
    readonly expectedHead?: string;
    readonly expectedTargetVersion?: string;
    readonly expectedEvidenceBindings?: Readonly<Record<string, unknown>>;
    readonly targetVersion?: string;
    readonly maxSnapshotAgeMs?: number;
    readonly now?: Date;
    readonly signal?: AbortSignal;
  },
): ReadinessCalculation;

export declare function validateProductionClaim(
  claim: Record<string, unknown>,
  calculation: ReadinessCalculation,
): ReadinessIssue[];

export declare function buildReadinessRecoveryPlan(
  calculation: ReadinessCalculation,
): ReadonlyArray<{
  readonly code: string;
  readonly action: string;
}>;

export declare function createReadinessPublication(
  calculation: ReadinessCalculation,
  context?: {
    readonly branch?: string;
    readonly currentHead?: string;
  },
): Record<string, unknown>;
