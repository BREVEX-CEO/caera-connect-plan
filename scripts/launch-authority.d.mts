export interface LaunchAuthorityResult {
  ready: boolean;
  issues: string[];
  stages: Record<
    "signing" | "deployment" | "support_readiness" | "announcement",
    {
      ready: boolean;
      classification: "REAL_TARGET_RUNTIME_VERIFIED" | "EXTERNALLY_BLOCKED";
      reason: string;
    }
  >;
}

export function validateLaunchAuthorityPolicy(policy: unknown): {
  ok: boolean;
  issues: string[];
};
export function evaluateLaunchAuthority(
  policy: unknown,
  evidence?: Record<string, Record<string, unknown>>,
  options?: { now?: Date; signal?: AbortSignal },
): LaunchAuthorityResult;
