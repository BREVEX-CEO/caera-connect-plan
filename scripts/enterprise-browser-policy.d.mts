type Issue = { readonly code: string; readonly message: string };
type Options = { readonly signal?: AbortSignal; readonly now?: Date };
type Result = {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<Issue>;
  readonly [key: string]: any;
};

export declare function validateEnterpriseBrowserPolicy(policy: Record<string, any>): Result;
export declare function generateEnterpriseBrowserPolicyBundle(
  policy: Record<string, any>,
  input: Record<string, any>,
  privateKey: unknown,
  options?: Options,
): Result;
export declare function verifyEnterpriseBrowserPolicyBundle(
  policy: Record<string, any>,
  envelope: Record<string, any>,
  publicKey: unknown,
  input?: Record<string, any> & Options,
): Result;
