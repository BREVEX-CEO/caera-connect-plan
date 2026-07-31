type Issue = { readonly code: string; readonly message: string };
type Options = { readonly signal?: AbortSignal; readonly now?: Date };
type Result = {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<Issue>;
  readonly [key: string]: any;
};

export declare function validatePrivateComputePolicy(policy: Record<string, any>): Result;
export declare function authorizeBurstCompute(
  policy: Record<string, any>,
  request: Record<string, any>,
  options?: Options,
): Result;
export declare function sealBurstPayload(
  plan: Record<string, any>,
  payload: Buffer,
  key: Buffer,
  options?: Options & { readonly nonce?: Buffer },
): Record<string, any>;
export declare function openBurstPayload(
  plan: Record<string, any>,
  envelope: Record<string, any>,
  key: Buffer,
): Buffer;
export declare function verifyBurstResult(
  policy: Record<string, any>,
  plan: Record<string, any>,
  signedResult: Record<string, any>,
  providerPublicKey: unknown,
  options?: Options,
): Result;
export declare function verifyMeshNode(
  policy: Record<string, any>,
  signedNode: Record<string, any>,
  publicKey: unknown,
  input?: Record<string, any> & Options,
): Result;
export declare function authorizeMeshJob(
  policy: Record<string, any>,
  node: Record<string, any> | null,
  signedJob: Record<string, any>,
  requesterPublicKey: unknown,
  input?: Record<string, any> & Options,
): Result;
export declare function authorizeLanOnlyConnection(
  policy: Record<string, any>,
  request: Record<string, any>,
  options?: Options,
): Result;
