export declare class CompatibilityEvidenceCancelledError extends Error {}

type Issue = { readonly code: string; readonly message: string };
type Options = { readonly signal?: AbortSignal; readonly now?: Date };

export declare function signEvidencePayload(
  payload: Record<string, unknown>,
  privateKey: unknown,
): { readonly payload: Record<string, unknown>; readonly signature: string };
export declare function verifyEvidenceEnvelope(
  envelope: Record<string, unknown>,
  publicKey: unknown,
): boolean;
export declare function validateCompatibilityPolicy(policy: Record<string, unknown>): {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<Issue>;
};
export declare function verifyHardwareAttestation(input: Record<string, unknown> & Options): {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<Issue>;
  readonly receipt: Record<string, unknown> | null;
};
export declare function redactCompatibilityEvidence(
  input: Record<string, unknown> & Options,
): Record<string, unknown>;
export declare function authorizeCompatibilityLab(
  policy: Record<string, unknown>,
  request: Record<string, unknown>,
  options?: Options,
): { readonly ok: boolean; readonly issues: ReadonlyArray<Issue>; readonly mode: string };
export declare function authorizeSupportOperation(
  policy: Record<string, unknown>,
  request: Record<string, unknown>,
  options?: Options,
): { readonly ok: boolean; readonly issues: ReadonlyArray<Issue> };
export declare function verifyFaultRecovery(
  policy: Record<string, unknown>,
  trace: Record<string, unknown>,
  options?: Options,
): { readonly ok: boolean; readonly issues: ReadonlyArray<Issue>; readonly evidenceClass: string };
export declare function createCompatibilityPack(
  payload: Record<string, unknown>,
  privateKey: unknown,
): { readonly payload: Record<string, unknown>; readonly signature: string };
export declare function verifyCompatibilityPack(input: Record<string, unknown> & Options): {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<Issue>;
};
