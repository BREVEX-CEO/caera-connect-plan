/**
 * Legacy server-routing compatibility surface.
 *
 * OCADE is local-only. Server code is never allowed to select or call an AI
 * model. Actual inference routing happens on-device through the Brain adapters.
 */
export type ProviderRouting = "auto" | "ollama_local" | "local_only";

export interface EngineResolveInput {
  routing: string;
  requestedModel?: string;
  /** Legacy fields are intentionally ignored. */
  hasLovableKey?: boolean;
  hasOpenAIKey?: boolean;
  openaiDirectEnabled?: boolean;
}

export type EngineUnavailableCode = "local_execution_only";
export type EngineResolution = {
  kind: "unavailable";
  code: EngineUnavailableCode;
  reason: string;
};

/**
 * A server can never serve OCADE AI. This function exists only so stale code
 * fails closed during migration instead of selecting a remote provider.
 */
export function resolveOcadeEngine(_input: EngineResolveInput): EngineResolution {
  return {
    kind: "unavailable",
    code: "local_execution_only",
    reason:
      "OCADE AI runs on this device only. Start or download the local engine; no server or cloud-model fallback exists.",
  };
}
