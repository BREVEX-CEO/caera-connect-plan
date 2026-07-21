/**
 * Client-safe OCADE model catalog and provider metadata.
 *
 * IMPORTANT: this file exposes DISPLAY names, capabilities and provider
 * identifiers only. No secrets, no gateway URLs, no keys. Server-only code
 * lives in ai-gateway.server.ts and ocade-providers.functions.ts.
 *
 * Provider identity is technical truth: OCADE is the assistant, but the
 * underlying provider (Lovable AI Gateway, OpenAI direct, Ollama local,
 * future CAERA CADANE native) is always visible here and in diagnostics.
 */

export type OcadeProviderId = "lovable_gateway" | "openai_direct" | "ollama_local" | "caera_native";
export type OcadeRoutingMode = "auto" | OcadeProviderId;
export type PrivacyPref = "local_first" | "balanced" | "cloud_ok";
export type CostPref = "cheapest" | "balanced" | "best_quality";
export type SpeedPref = "fastest" | "balanced" | "best_quality";

export interface OcadeProviderInfo {
  id: OcadeProviderId;
  displayName: string;
  locality: "cloud" | "local";
  requiresNative: boolean;
  requiresSecret: boolean;
  description: string;
  status: "active" | "setup_required" | "planned";
  disabledReason?: string;
}

export const OCADE_PROVIDERS: OcadeProviderInfo[] = [
  {
    id: "lovable_gateway",
    displayName: "Lovable AI Gateway",
    locality: "cloud",
    requiresNative: false,
    requiresSecret: false,
    description: "Managed cloud routing to Google, OpenAI and others. Metered usage on your workspace credits.",
    status: "active",
  },
  {
    id: "openai_direct",
    displayName: "OpenAI (direct)",
    locality: "cloud",
    requiresNative: false,
    requiresSecret: true,
    description: "Direct calls with your own OpenAI API key. Metered by OpenAI — this is not free.",
    status: "setup_required",
    disabledReason: "Add an OPENAI_API_KEY server secret and enable OpenAI Direct.",
  },
  {
    id: "ollama_local",
    displayName: "Ollama (local)",
    locality: "local",
    requiresNative: true,
    requiresSecret: false,
    description: "Runs on your own machine. No cloud transfer. Requires the Native Companion or a local bridge URL.",
    status: "setup_required",
    disabledReason: "Native Companion or local bridge URL required.",
  },
  {
    id: "caera_native",
    displayName: "CAERA CADANE native model",
    locality: "cloud",
    requiresNative: false,
    requiresSecret: false,
    description: "Future first-party CAERA CADANE model. Reserved for a later release.",
    status: "planned",
    disabledReason: "Not yet released. This slot is reserved.",
  },
];

export interface OcadeCapabilities {
  text: boolean;
  image: boolean;   // vision (image input understanding)
  files: boolean;   // document input understanding
  voice: boolean;   // audio input/output the model itself supports
  contextTokens: number; // approximate max context window
  speedTier: "fast" | "balanced" | "slow";
  costTier: "cheap" | "balanced" | "premium";
}

export type OcadeModelId =
  | "google/gemini-3.5-flash"
  | "google/gemini-3.1-pro-preview"
  | "google/gemini-3.1-flash-lite"
  | "openai/gpt-5.4-mini"
  | "openai/gpt-5.5";

export interface OcadeModelInfo {
  id: OcadeModelId;
  display: string;
  provider: OcadeProviderId;
  providerDisplay: string;
  locality: "cloud" | "local";
  vision: boolean;
  description: string;
  capabilities: OcadeCapabilities;
}

export const OCADE_MODELS: OcadeModelInfo[] = [
  {
    id: "google/gemini-3.5-flash",
    display: "Gemini 3.5 Flash",
    provider: "lovable_gateway",
    providerDisplay: "Google via Lovable AI",
    locality: "cloud",
    vision: true,
    description: "Balanced default. Fast, accepts images.",
    capabilities: { text: true, image: true, files: true, voice: false, contextTokens: 1_000_000, speedTier: "fast", costTier: "balanced" },
  },
  {
    id: "google/gemini-3.1-pro-preview",
    display: "Gemini 3.1 Pro (preview)",
    provider: "lovable_gateway",
    providerDisplay: "Google via Lovable AI",
    locality: "cloud",
    vision: true,
    description: "Stronger reasoning for complex tasks.",
    capabilities: { text: true, image: true, files: true, voice: false, contextTokens: 1_000_000, speedTier: "balanced", costTier: "premium" },
  },
  {
    id: "google/gemini-3.1-flash-lite",
    display: "Gemini 3.1 Flash Lite",
    provider: "lovable_gateway",
    providerDisplay: "Google via Lovable AI",
    locality: "cloud",
    vision: true,
    description: "Cheapest cloud option for high-volume tasks.",
    capabilities: { text: true, image: true, files: true, voice: false, contextTokens: 1_000_000, speedTier: "fast", costTier: "cheap" },
  },
  {
    id: "openai/gpt-5.4-mini",
    display: "GPT-5.4 mini",
    provider: "lovable_gateway",
    providerDisplay: "OpenAI via Lovable AI",
    locality: "cloud",
    vision: true,
    description: "OpenAI alternative for varied styles.",
    capabilities: { text: true, image: true, files: false, voice: false, contextTokens: 400_000, speedTier: "balanced", costTier: "balanced" },
  },
  {
    id: "openai/gpt-5.5",
    display: "GPT-5.5",
    provider: "lovable_gateway",
    providerDisplay: "OpenAI via Lovable AI",
    locality: "cloud",
    vision: true,
    description: "Highest-quality reasoning; premium cost.",
    capabilities: { text: true, image: true, files: false, voice: false, contextTokens: 400_000, speedTier: "slow", costTier: "premium" },
  },
];

export const OCADE_DEFAULT_MODEL_ID: OcadeModelId = "google/gemini-3.5-flash";

export function getOcadeModel(id: string): OcadeModelInfo {
  return OCADE_MODELS.find((m) => m.id === id) ?? OCADE_MODELS[0];
}

export function getOcadeProvider(id: OcadeProviderId): OcadeProviderInfo {
  return OCADE_PROVIDERS.find((p) => p.id === id) ?? OCADE_PROVIDERS[0];
}

/**
 * Pick the best model given the user's preferences. Client-safe and pure so
 * it can be used both when composing a request and when previewing the
 * "Auto" selection in the model-control centre.
 *
 * Rules:
 *  1. Session override wins if set and present in the catalog.
 *  2. If vision required, drop non-vision models.
 *  3. If privacy = local_first, prefer Ollama-backed models (none in catalog yet → fall back with a flag).
 *  4. Sort by weighted (cost, speed, quality) score matching prefs.
 */
export function autoSelectModel(prefs: {
  privacy: PrivacyPref;
  cost: CostPref;
  speed: SpeedPref;
  visionRequired: boolean;
  sessionOverride?: string | null;
}): { model: OcadeModelInfo; reasons: string[]; localFallbackNeeded: boolean } {
  const reasons: string[] = [];
  if (prefs.sessionOverride) {
    const forced = OCADE_MODELS.find((m) => m.id === prefs.sessionOverride);
    if (forced) return { model: forced, reasons: ["Per-session override active."], localFallbackNeeded: false };
  }

  const localFallbackNeeded = prefs.privacy === "local_first";
  if (localFallbackNeeded) {
    reasons.push("Local-first requested — cloud fallback shown until a local model is available.");
  }

  let candidates = OCADE_MODELS.slice();
  if (prefs.visionRequired) {
    const withVision = candidates.filter((m) => m.vision);
    if (withVision.length > 0) {
      candidates = withVision;
      reasons.push("Filtered to vision-capable models.");
    } else {
      reasons.push("No vision-capable model available; keeping full catalog.");
    }
  }

  const costRank = { cheap: 0, balanced: 1, premium: 2 } as const;
  const speedRank = { fast: 0, balanced: 1, slow: 2 } as const;
  const qualityRank = { cheap: 0, balanced: 1, premium: 2 } as const;

  const scored = candidates.map((m) => {
    let score = 0;
    if (prefs.cost === "cheapest") score += costRank[m.capabilities.costTier] * 2;
    if (prefs.cost === "best_quality") score += (2 - qualityRank[m.capabilities.costTier]) * 2;
    if (prefs.speed === "fastest") score += speedRank[m.capabilities.speedTier] * 2;
    if (prefs.speed === "best_quality") score += (2 - speedRank[m.capabilities.speedTier]) * 2;
    return { m, score };
  });
  scored.sort((a, b) => a.score - b.score);
  const winner = scored[0].m;
  reasons.push(`Selected ${winner.display} for ${prefs.cost}/${prefs.speed} preference.`);
  return { model: winner, reasons, localFallbackNeeded };
}
