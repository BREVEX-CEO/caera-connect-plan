/**
 * Registry of voice, vision, media and headless connectors.
 *
 * Registration is deliberately strict. A registry that accepts anything and
 * silently overwrites on a repeated id is a hijack seam: whatever registers
 * last wins, so a later registration could quietly replace the provider that
 * speech and transcription flow through. Both are refused here.
 */

export type VoiceProviderType = "system" | "local" | "licensed";
export type MultimodalConnectorState = "uninitialized" | "ready" | "failed";

/** Provider-specific tuning. Unknown rather than `any`, so callers must narrow. */
export type ProviderOptions = Record<string, unknown>;

/**
 * A voice provider.
 *
 * `synthesize` and `transcribe` are OPTIONAL, and that is deliberate. This
 * contract originally required both, which no shipping provider could satisfy:
 * the browser's Web Speech API speaks through an utterance and never hands back
 * audio bytes, and its recognition runs on a live microphone rather than on a
 * buffer you pass it. Requiring both meant the one provider that actually
 * exists could only be registered by stubbing two methods that would throw or
 * return empty audio — a placeholder executor wearing a real interface.
 *
 * So capabilities are declared by which methods a provider actually has. A
 * provider must supply at least one; registration is refused otherwise, because
 * a provider that can do nothing is not a provider.
 */
export interface VoiceProvider {
  id: string;
  type: VoiceProviderType;
  name: string;
  isAvailable: () => Promise<boolean>;
  /** Speaks aloud through the platform. No audio buffer is produced. */
  speakAloud?: (text: string, options?: ProviderOptions) => Promise<void>;
  /** Returns rendered audio. Only engines that can hand back bytes have this. */
  synthesize?: (text: string, options?: ProviderOptions) => Promise<ArrayBuffer>;
  /** Transcribes a recorded buffer. Live-microphone engines do not have this. */
  transcribe?: (audio: ArrayBuffer, options?: ProviderOptions) => Promise<string>;
}

export interface VisionConnector {
  id: string;
  name: string;
  isAvailable: () => Promise<boolean>;
  analyzeImage: (imageBytes: Uint8Array, prompt: string) => Promise<string>;
}

export interface MediaConnector {
  id: string;
  name: string;
  isAvailable: () => Promise<boolean>;
  extractMetadata: (mediaBytes: Uint8Array) => Promise<Record<string, unknown>>;
  transcode: (mediaBytes: Uint8Array, targetFormat: string) => Promise<Uint8Array>;
}

export interface HeadlessConnector {
  id: string;
  name: string;
  isAvailable: () => Promise<boolean>;
  executeScript: (script: string, context?: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Rejects a malformed or duplicate registration.
 *
 * `label` names the kind of thing being registered so the failure says what
 * was wrong, and `methods` are the functions this kind must actually provide —
 * an entry missing one would fail later, at the point of use, where the cause
 * is much harder to see.
 */
function admit<T extends { id: string; name: string }>(
  into: Map<string, T>,
  entry: T,
  label: string,
  methods: Array<keyof T>,
): void {
  if (!entry || typeof entry !== "object") {
    throw new Error(`A ${label} must be an object.`);
  }
  if (typeof entry.id !== "string" || entry.id.trim().length === 0) {
    throw new Error(`A ${label} needs a non-empty id.`);
  }
  if (typeof entry.name !== "string" || entry.name.trim().length === 0) {
    throw new Error(`The ${label} "${entry.id}" needs a non-empty name.`);
  }
  for (const method of methods) {
    if (typeof entry[method] !== "function") {
      throw new Error(`The ${label} "${entry.id}" is missing ${String(method)}().`);
    }
  }
  if (into.has(entry.id)) {
    // Silent replacement would let a later registration take over the path
    // speech and transcription run through.
    throw new Error(`A ${label} with id "${entry.id}" is already registered.`);
  }
  into.set(entry.id, entry);
}

export class MultimodalRegistry {
  private voiceProviders: Map<string, VoiceProvider> = new Map();
  private visionConnectors: Map<string, VisionConnector> = new Map();
  private mediaConnectors: Map<string, MediaConnector> = new Map();
  private headlessConnectors: Map<string, HeadlessConnector> = new Map();

  registerVoiceProvider(provider: VoiceProvider) {
    if (!["system", "local", "licensed"].includes(provider?.type)) {
      throw new Error(`Voice provider "${provider?.id}" has an unknown type.`);
    }
    // At least one real capability. A provider that can neither speak, render
    // audio nor transcribe would register cleanly and then fail at the point of
    // use, which is precisely the failure this registry exists to prevent.
    const capabilities = (["speakAloud", "synthesize", "transcribe"] as const).filter(
      (method) => typeof provider?.[method] === "function",
    );
    if (capabilities.length === 0) {
      throw new Error(
        `Voice provider "${provider?.id}" declares no capability: it must speak aloud, synthesize or transcribe.`,
      );
    }
    admit(this.voiceProviders, provider, "voice provider", ["isAvailable"]);
  }

  /** Providers that can speak aloud, for a surface choosing how to talk. */
  getSpeakingProviders(): VoiceProvider[] {
    return this.getVoiceProviders().filter((p) => typeof p.speakAloud === "function");
  }

  getVoiceProvider(id: string): VoiceProvider | undefined {
    return this.voiceProviders.get(id);
  }

  getVoiceProviders(): VoiceProvider[] {
    return Array.from(this.voiceProviders.values());
  }

  registerVisionConnector(connector: VisionConnector) {
    admit(this.visionConnectors, connector, "vision connector", ["isAvailable", "analyzeImage"]);
  }

  getVisionConnector(id: string): VisionConnector | undefined {
    return this.visionConnectors.get(id);
  }

  registerMediaConnector(connector: MediaConnector) {
    admit(this.mediaConnectors, connector, "media connector", [
      "isAvailable",
      "extractMetadata",
      "transcode",
    ]);
  }

  getMediaConnector(id: string): MediaConnector | undefined {
    return this.mediaConnectors.get(id);
  }

  registerHeadlessConnector(connector: HeadlessConnector) {
    admit(this.headlessConnectors, connector, "headless connector", ["isAvailable", "executeScript"]);
  }

  getHeadlessConnector(id: string): HeadlessConnector | undefined {
    return this.headlessConnectors.get(id);
  }
}

export const globalMultimodalRegistry = new MultimodalRegistry();
