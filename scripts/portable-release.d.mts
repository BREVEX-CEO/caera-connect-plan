export declare class PortableReleaseCancelledError extends Error {}

export declare function validatePortableReleaseManifest(
  manifest: Record<string, unknown>,
  options?: { readonly signal?: AbortSignal },
): {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<{ readonly code: string; readonly message: string }>;
};

export declare function createProviderPlan(
  manifest: Record<string, unknown>,
  providerId: string,
  options?: { readonly signal?: AbortSignal },
): Record<string, unknown>;

export declare function createArtifactProvenance(
  input: Record<string, unknown>,
  options?: { readonly signal?: AbortSignal },
): Record<string, unknown>;

export declare function verifyIndependentArtifact(
  primary: Record<string, unknown>,
  independent: Record<string, unknown>,
  options?: { readonly signal?: AbortSignal },
): {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<{ readonly code: string; readonly message: string }>;
  readonly artifacts: ReadonlyArray<{
    readonly path: string;
    readonly classification: "exact" | "normalized-equivalent";
  }>;
};

export declare function resolveSidecar(
  manifest: Record<string, unknown>,
  request: Record<string, unknown>,
  options?: { readonly signal?: AbortSignal },
): Record<string, unknown>;

export declare function validateCleanMachineReceipt(
  manifest: Record<string, unknown>,
  receipt: Record<string, unknown>,
  options?: { readonly signal?: AbortSignal },
): {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<{ readonly code: string; readonly message: string }>;
};
