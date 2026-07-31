export declare class MediaLabCancelledError extends Error {}

type Issue = { readonly code: string; readonly message: string };
type Options = { readonly signal?: AbortSignal; readonly now?: Date };

export declare function validateMediaLabPolicy(policy: Record<string, unknown>): {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<Issue>;
};
export declare function createMediaLabSession(
  policy: Record<string, any>,
  request: Record<string, any>,
  options?: Options,
): {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<Issue>;
  readonly session: Record<string, any> | null;
};
export declare function generateMediaFixture(
  policy: Record<string, any>,
  fixtureId: string,
  options?: Options,
): { readonly fixture: Record<string, any>; readonly payload: Buffer; readonly digest: string };
export declare function observeMediaFixture(
  policy: Record<string, any>,
  session: Record<string, any> | null,
  observation: Record<string, any>,
  options?: Options,
): {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<Issue>;
  readonly receipt: Record<string, any>;
};
export declare function assertMediaEvidenceClaim(
  policy: Record<string, any>,
  claim: Record<string, any>,
): { readonly ok: boolean; readonly issues: ReadonlyArray<Issue> };
