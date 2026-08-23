/**
 * OCADE capability labels (Plan §10, decisions #14–18).
 *
 * Ordinary user interfaces — chat, model/assistant selectors, onboarding,
 * marketing, routine errors — must show OCADE CAPABILITY labels, never raw
 * runtime / provider / foundation-model names. The exact model, version,
 * provider and licence remain available ONLY in authorised technical settings,
 * admin diagnostics, security logs and legal/licence notices.
 *
 * This module is the single source of truth for the user-facing labels and the
 * mapping from an internal engine descriptor to a label. It intentionally
 * contains NO raw model names.
 */

export type OcadeCapabilityLabel =
  | "OCADE Local"
  | "OCADE Local Fast"
  | "OCADE Local Vision"
  | "OCADE Local Code"
  | "OCADE Automatic";

export const OCADE_CAPABILITY_LABELS: readonly OcadeCapabilityLabel[] = [
  "OCADE Automatic",
  "OCADE Local",
  "OCADE Local Fast",
  "OCADE Local Vision",
  "OCADE Local Code",
] as const;

/** Internal capability profile of a local engine. Never shown raw to users. */
export type OcadeLocalProfile = "general" | "fast" | "vision" | "code";

export interface EngineDescriptor {
  /** Where inference runs. */
  locality: "local";
  /** For local engines, the capability profile that produced the label. */
  profile?: OcadeLocalProfile;
  /** True when routing was decided by "Automatic" rather than a fixed choice. */
  automatic?: boolean;
}

const LOCAL_PROFILE_LABEL: Record<OcadeLocalProfile, OcadeCapabilityLabel> = {
  general: "OCADE Local",
  fast: "OCADE Local Fast",
  vision: "OCADE Local Vision",
  code: "OCADE Local Code",
};

/**
 * Map an engine descriptor to the user-facing capability label. Pure and total:
 * any unexpected shape falls back to the safe generic labels, never a raw name.
 */
export function capabilityLabelFor(engine: EngineDescriptor): OcadeCapabilityLabel {
  if (engine.automatic) return "OCADE Automatic";
  return engine.profile ? LOCAL_PROFILE_LABEL[engine.profile] : "OCADE Local";
}

/** True when a label denotes local (on-device) execution. */
export function isLocalLabel(label: OcadeCapabilityLabel): boolean {
  return label.startsWith("OCADE Local");
}

/**
 * Guard for user-facing surfaces: returns true if a string appears to leak a
 * raw provider/model identity (used in tests and dev assertions to keep chat,
 * selectors and errors clean).
 */
const RAW_IDENTITY_PATTERN =
  /(openai|gpt-?\d|gemini|claude|anthropic|llama|mistral|qwen|phi-?\d|ollama|google\/)/i;

export function leaksRawModelIdentity(text: string): boolean {
  return RAW_IDENTITY_PATTERN.test(text);
}

/**
 * Replace raw provider/model names with the neutral OCADE wording.
 *
 * Used before an assistant reply is PERSISTED: a leaked vendor name in stored
 * history is re-fed as context on every later turn, so it must not survive even
 * though the streamed copy already reached the user once.
 *
 * Deliberately a targeted substitution rather than dropping the message — the
 * answer is usually still useful, and silently discarding it would be worse.
 */
export function redactRawModelIdentity(text: string): string {
  if (!text) return text;
  return text.replace(new RegExp(RAW_IDENTITY_PATTERN.source, "gi"), "the OCADE engine");
}
