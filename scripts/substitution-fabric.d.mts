type Issue = { readonly code: string; readonly message: string };
type Options = { readonly signal?: AbortSignal; readonly now?: Date };
type Result = {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<Issue>;
  readonly [key: string]: any;
};

export declare class SubstitutionCancelledError extends Error {}
export declare function validateSubstitutionPolicy(policy: Record<string, any>): Result;
export declare function resolveOpenSourceEquivalent(
  policy: Record<string, any>,
  request: Record<string, any>,
  options?: Options,
): Result;
export declare function authorizeSubstitution(
  policy: Record<string, any>,
  request: Record<string, any>,
  options?: Options,
): Result;
export declare function verifyLicensedWorkerJob(
  policy: Record<string, any>,
  input: Record<string, any> & Options,
): Result;
export declare function executeWasmFallback(
  policy: Record<string, any>,
  request: Record<string, any>,
  runner: (...args: any[]) => Promise<Record<string, any>>,
  options?: Options,
): Promise<Result>;
export declare function selectLocalInferenceTier(
  policy: Record<string, any>,
  request: Record<string, any>,
  options?: Options,
): Result;
export declare function createModelDownloadState(
  policy: Record<string, any>,
  input: Record<string, any> & Options,
): Result;
export declare function acceptModelChunk(
  policy: Record<string, any>,
  state: Record<string, any> | null,
  index: number,
  bytes: Buffer,
  options?: Options,
): Result;
export declare function finalizeModelDownload(
  policy: Record<string, any>,
  state: Record<string, any> | null,
  options?: Options,
): Result;
export declare function planModelEviction(
  policy: Record<string, any>,
  models: ReadonlyArray<Record<string, any>>,
  storageBudgetMiB: number,
): Result;
