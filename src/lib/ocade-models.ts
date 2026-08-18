/**
 * Client-safe OCADE model authority.
 *
 * OCADE is LOCAL-ONLY. There is no cloud model catalog and there is no cloud
 * fallback. The product label deliberately hides runtime implementation names
 * from ordinary UI while diagnostics may still expose the local engine facts.
 */

export type OcadeProviderId = "local_runtime";
export type OcadeRoutingMode = "local_only" | "auto";
export type PrivacyPref = "local_first";
export type CostPref = "local";
export type SpeedPref = "balanced" | "fastest";

export interface OcadeProviderInfo {
  id: OcadeProviderId;
  displayName: string;
  locality: "local";
  requiresNative: boolean;
  requiresSecret: false;
  description: string;
  status: "active";
}

export const OCADE_PROVIDERS: OcadeProviderInfo[] = [
  {
    id: "local_runtime",
    displayName: "OCADE Local",
    locality: "local",
    requiresNative: false,
    requiresSecret: false,
    description:
      "Runs on this device through the desktop local runtime or the browser-local WebGPU/WASM engine. Prompts are never routed to a cloud model.",
    status: "active",
  },
];

export interface OcadeCapabilities {
  text: boolean;
  image: boolean;
  files: boolean;
  voice: boolean;
  contextTokens: number;
  speedTier: "fast" | "balanced";
  costTier: "local";
}

export type OcadeModelId = "ocade/local";

export interface OcadeModelInfo {
  id: OcadeModelId;
  display: string;
  provider: OcadeProviderId;
  providerDisplay: string;
  locality: "local";
  vision: boolean;
  description: string;
  capabilities: OcadeCapabilities;
}

/**
 * A capability label, not a promise that one particular set of weights is used
 * in every environment. Desktop currently uses the fixed local engine;
 * browser-local uses the proven WebGPU/WASM tier selected by the browser engine.
 */
export const OCADE_MODELS: OcadeModelInfo[] = [
  {
    id: "ocade/local",
    display: "OCADE Local",
    provider: "local_runtime",
    providerDisplay: "On-device engine",
    locality: "local",
    vision: false,
    description: "Runs entirely on this device. No cloud-model fallback exists.",
    capabilities: {
      text: true,
      image: false,
      files: true,
      voice: false,
      contextTokens: 32_768,
      speedTier: "balanced",
      costTier: "local",
    },
  },
];

export const OCADE_DEFAULT_MODEL_ID: OcadeModelId = "ocade/local";

export function getOcadeModel(_id: string): OcadeModelInfo {
  return OCADE_MODELS[0];
}

export function getOcadeProvider(_id: OcadeProviderId): OcadeProviderInfo {
  return OCADE_PROVIDERS[0];
}

/** Compatibility surface for callers that used the old provider fabric. */
export const OCADE_MODEL_FABRIC_PROVIDERS: readonly never[] = [];
export function getModelFabricProvider(_id: string): null {
  return null;
}

/** Auto selection always selects local capability; device routing happens later. */
export function autoSelectModel(_prefs?: {
  privacy?: PrivacyPref;
  cost?: CostPref;
  speed?: SpeedPref;
  visionRequired?: boolean;
  sessionOverride?: string | null;
}): { model: OcadeModelInfo; reasons: string[]; localFallbackNeeded: false } {
  return {
    model: OCADE_MODELS[0],
    reasons: ["OCADE is local-only; cloud model routing is disabled by architecture."],
    localFallbackNeeded: false,
  };
}
