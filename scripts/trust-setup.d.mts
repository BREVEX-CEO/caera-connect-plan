type Issue = { readonly code: string; readonly message: string };
type Options = {
  readonly signal?: AbortSignal;
  readonly now?: Date;
  readonly testMode?: boolean;
  readonly logger?: (entry: Record<string, any>) => void;
};
type Result = {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<Issue>;
  readonly [key: string]: any;
};

export declare function validateTrustSetupPolicy(policy: Record<string, any>): Result;
export declare function inspectCredentialPresence(
  policy: Record<string, any>,
  request: Record<string, any>,
  adapter: Record<string, any>,
  options?: Options,
): Promise<Result>;
export declare function withScopedCredential(
  policy: Record<string, any>,
  request: Record<string, any>,
  adapter: Record<string, any>,
  consumer: (secret: string, options: Options) => Promise<Record<string, any>>,
  options?: Options,
): Promise<Result>;
export declare function rotateCredential(
  policy: Record<string, any>,
  request: Record<string, any>,
  adapter: Record<string, any>,
  options?: Options,
): Promise<Result>;
export declare function removeCredential(
  policy: Record<string, any>,
  request: Record<string, any>,
  adapter: Record<string, any>,
  options?: Options,
): Promise<Result>;
export declare function evaluateCommunitySigningEligibility(
  policy: Record<string, any>,
  component: Record<string, any>,
): Result;
export declare function authorizeSigningPath(
  policy: Record<string, any>,
  request: Record<string, any>,
): Result;
