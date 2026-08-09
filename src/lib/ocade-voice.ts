import type { MultimodalRegistry, VoiceProvider } from "./providers/multimodal-registry";
/**
 * OCADE Voice (Plan §22, decisions #22–#27).
 *
 * An original OCADE voice experience — it does not imitate any copyrighted
 * character, voice, or dialogue. Speech synthesis and recognition are supplied
 * by the browser/operating system. Recognition may use a remote service unless
 * the engine explicitly exposes local processing, so OCADE never promises that
 * microphone audio stays on-device merely because the Web Speech API exists.
 *
 * Design rules encoded here:
 *  - No assumed default voice: the user picks male or female in onboarding.
 *  - Address defaults to FIRST NAME with NO title, and a title is NEVER inferred
 *    from a name, voice, or appearance — only used when the user supplies one.
 *  - The wake phrase is OPT-IN and matched locally; nothing is streamed while
 *    idle.
 *  - A language is not advertised as supported until its pack passes
 *    verification.
 *
 * Pure helpers are unit-tested; browser engines are injected so nothing here
 * requires a DOM at test time.
 */

export type VoiceGender = "male" | "female" | "unknown";
export type AddressStyle = "first_name" | "full_name" | "custom_title" | "none";

/* ------------------------------------------------------------ wake phrase -- */

export const DEFAULT_WAKE_PHRASES = ["hello ocade", "hey ocade"] as const;

export type PriorityVoiceCommand = "pause_work" | "continue_work" | "quiet";

/**
 * High-priority commands are intentionally exact and local. They never enter
 * the model prompt, so stopping does not depend on inference latency and an
 * incidental sentence containing the word "stop" cannot halt the computer.
 */
export function matchPriorityVoiceCommand(transcript: string): PriorityVoiceCommand | null {
  const text = normalizeTranscript(transcript);
  if (/^ocade (?:stop talking|quiet)(?: please)?$/.test(text)) return "quiet";
  if (/^ocade stop(?: now| please)?$/.test(text)) return "pause_work";
  if (/^ocade continue(?: now| please)?$/.test(text)) return "continue_work";
  return null;
}

export interface PriorityVoiceCommandDeps {
  stopSpeech(): void;
  pauseWork(): void;
  releaseHeldInput(): void | Promise<void>;
  reobserveAndContinue(): void | Promise<void>;
  now?(): number;
}

export interface PriorityVoiceCommandResult {
  command: PriorityVoiceCommand;
  immediateMs: number;
  settledMs: number;
  nativeAcknowledged: boolean;
  reason?: string;
}

/** Execute the deterministic stop/continue path and retain both latency edges. */
export async function executePriorityVoiceCommand(
  command: PriorityVoiceCommand,
  deps: PriorityVoiceCommandDeps,
): Promise<PriorityVoiceCommandResult> {
  const now = deps.now ?? (() => performance.now());
  const started = now();
  if (command === "quiet") {
    deps.stopSpeech();
    const stopped = now();
    return {
      command,
      immediateMs: Math.max(0, stopped - started),
      settledMs: Math.max(0, stopped - started),
      nativeAcknowledged: true,
    };
  }
  if (command === "pause_work") {
    // These two calls are synchronous by contract: outgoing speech and the
    // local AbortController stop before any IPC round trip is awaited.
    deps.stopSpeech();
    deps.pauseWork();
    const immediate = now();
    try {
      await deps.releaseHeldInput();
      return {
        command,
        immediateMs: Math.max(0, immediate - started),
        settledMs: Math.max(0, now() - started),
        nativeAcknowledged: true,
      };
    } catch (error) {
      return {
        command,
        immediateMs: Math.max(0, immediate - started),
        settledMs: Math.max(0, now() - started),
        nativeAcknowledged: false,
        reason:
          error instanceof Error
            ? error.message
            : "The native input host did not acknowledge the stop.",
      };
    }
  }
  try {
    await deps.reobserveAndContinue();
    return {
      command,
      immediateMs: Math.max(0, now() - started),
      settledMs: Math.max(0, now() - started),
      nativeAcknowledged: true,
    };
  } catch (error) {
    return {
      command,
      immediateMs: Math.max(0, now() - started),
      settledMs: Math.max(0, now() - started),
      nativeAcknowledged: false,
      reason:
        error instanceof Error ? error.message : "The target could not be re-observed safely.",
    };
  }
}

/** Normalise a transcript for tolerant, local wake-phrase matching. */
export function normalizeTranscript(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Local wake-phrase match. Tolerates common mishearings of "OCADE" so the
 * phrase is usable, without matching unrelated speech.
 */
export function matchesWakePhrase(
  transcript: string,
  phrases: readonly string[] = DEFAULT_WAKE_PHRASES,
): boolean {
  const t = normalizeTranscript(transcript);
  if (!t) return false;
  const variants = ["ocade", "okade", "ocado", "o cade", "oh cade"];
  for (const phrase of phrases) {
    const [greet] = phrase.split(" ");
    if (!t.includes(greet)) continue;
    if (variants.some((v) => t.includes(v))) return true;
  }
  return false;
}

/* -------------------------------------------------------------- greeting -- */

export interface GreetingPrefs {
  /** What the user asked to be called. Never guessed. */
  preferredName?: string;
  fullName?: string;
  /** Only used when the user explicitly supplied one. */
  customTitle?: string;
  style?: AddressStyle;
  /** Turn greetings off entirely. */
  enabled?: boolean;
}

export function timeOfDayGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Build a personalised greeting. Defaults to first name with no title; falls
 * back to a neutral line when no name is known. Never invents a title.
 */
export function buildGreeting(prefs: GreetingPrefs, hour = 12): string {
  if (prefs.enabled === false) return "";
  const lead = timeOfDayGreeting(hour);
  const style = prefs.style ?? "first_name";

  if (style === "none") return `${lead}. How may I help?`;

  if (style === "custom_title" && prefs.customTitle?.trim()) {
    return `${lead}, ${prefs.customTitle.trim()}.`;
  }
  if (style === "full_name" && prefs.fullName?.trim()) {
    return `${lead}, ${prefs.fullName.trim()}.`;
  }
  const first = (prefs.preferredName ?? prefs.fullName ?? "").trim().split(/\s+/)[0];
  if (first) return `${lead}, ${first}.`;
  return `${lead}. How may I help?`;
}

/* ---------------------------------------------------------------- voices -- */

export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  gender: VoiceGender;
}

const FEMALE_HINTS =
  /(female|woman|zira|aria|jenny|samantha|victoria|karen|serena|sonia|amelie|hazel|eva|nora|clara|lucia|emma|ava)/i;
const MALE_HINTS =
  /(male|man|david|mark|george|guy|ryan|daniel|alex|fred|thomas|liam|william|james|diego|jorge)/i;

/**
 * Best-effort gender classification of a platform voice. Returns "unknown"
 * rather than guessing when the name gives no signal — OCADE never asserts a
 * gender it cannot determine.
 */
export function classifyVoiceGender(voiceName: string): VoiceGender {
  if (FEMALE_HINTS.test(voiceName)) return "female";
  if (MALE_HINTS.test(voiceName)) return "male";
  return "unknown";
}

export function toVoiceOptions(
  voices: { name: string; lang: string; voiceURI?: string }[],
): VoiceOption[] {
  return voices.map((v) => ({
    id: v.voiceURI ?? v.name,
    name: v.name,
    lang: v.lang,
    gender: classifyVoiceGender(v.name),
  }));
}

/**
 * Pick a voice for the requested gender + language. Language match takes
 * priority (a right-language voice of unknown gender beats a wrong-language
 * voice of the right gender). Returns null when nothing matches.
 */
export function pickVoice(
  options: VoiceOption[],
  want: { gender?: VoiceGender; lang?: string },
): VoiceOption | null {
  if (options.length === 0) return null;
  const langPrefix = (want.lang ?? "").split("-")[0].toLowerCase();
  const sameLang = langPrefix
    ? options.filter((o) => o.lang.split("-")[0].toLowerCase() === langPrefix)
    : options;
  const pool = sameLang.length > 0 ? sameLang : options;
  if (want.gender && want.gender !== "unknown") {
    const byGender = pool.filter((o) => o.gender === want.gender);
    if (byGender.length > 0) return byGender[0];
  }
  return pool[0];
}

/* ------------------------------------------------------- language packs -- */

export interface LanguagePack {
  code: string;
  label: string;
  /** A pack is only advertised once STT, TTS, wake phrase and commands pass. */
  verified: { stt: boolean; tts: boolean; wake: boolean; commands: boolean };
}

export function isLanguageSupported(pack: LanguagePack): boolean {
  const v = pack.verified;
  return v.stt && v.tts && v.wake && v.commands;
}

/**
 * Only verified packs may be presented as supported languages (decision #27).
 * English ships verified; others are listed as in-progress until they pass.
 */
export const LANGUAGE_PACKS: LanguagePack[] = [
  { code: "en", label: "English", verified: { stt: true, tts: true, wake: true, commands: true } },
];

export function supportedLanguages(packs: LanguagePack[] = LANGUAGE_PACKS): LanguagePack[] {
  return packs.filter(isLanguageSupported);
}

/**
 * The sentence being spoken at `charIndex`, for output captions.
 *
 * Speech synthesis reports a character offset as it progresses; showing the
 * whole answer at once defeats the point of a caption, and showing a single
 * word loses the meaning. A sentence is the readable unit.
 *
 * Total: any index, empty text, or text with no sentence punctuation still
 * returns something displayable rather than throwing or returning "".
 */
export function captionSentenceAt(text: string, charIndex: number, maxLength = 200): string {
  const src = text ?? "";
  if (!src.trim()) return "";

  // Clamp to the LAST CHARACTER, not to `length`. An index at or past the end
  // would otherwise sit after the final sentence mark, making the backward walk
  // start on a boundary and produce an empty slice.
  const idx = Math.min(Math.max(charIndex || 0, 0), Math.max(src.length - 1, 0));
  const BOUNDARY = /[.!?]/;

  // Walk back to just after the previous sentence-ending mark.
  let start = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (BOUNDARY.test(src[i])) {
      start = i + 1;
      break;
    }
  }

  // Walk forward to the next sentence-ending mark, inclusive.
  let end = src.length;
  for (let i = idx; i < src.length; i++) {
    if (BOUNDARY.test(src[i])) {
      end = i + 1;
      break;
    }
  }

  const sentence = src.slice(start, end).trim();
  // No punctuation at all — fall back to a bounded window rather than the lot.
  const chosen = sentence || src.slice(0, maxLength).trim();
  return chosen.length > maxLength ? `${chosen.slice(0, maxLength - 1)}…` : chosen;
}

export type LanguageStatus =
  { supported: true; pack: LanguagePack } | { supported: false; reason: string; missing: string[] };

const PART_LABELS: Record<keyof LanguagePack["verified"], string> = {
  stt: "speech input",
  tts: "spoken replies",
  wake: "the wake phrase",
  commands: "voice commands",
};

/**
 * Honest status for a language code.
 *
 * Filtering unsupported languages out of the picker silently leaves a
 * non-English speaker staring at a single option with no explanation. This
 * reports WHY a language is unavailable — either it has no pack at all, or its
 * pack exists but some part is unverified — so the UI can say so plainly.
 *
 * Matching is on the primary subtag, so "en-GB" and "en-US" both resolve to the
 * "en" pack rather than reporting a false negative.
 */
export function languageStatus(
  code: string,
  packs: LanguagePack[] = LANGUAGE_PACKS,
): LanguageStatus {
  const primary = (code ?? "").toLowerCase().split(/[-_]/)[0];
  const pack = packs.find((p) => p.code.toLowerCase().split(/[-_]/)[0] === primary);

  if (!pack) {
    return {
      supported: false,
      reason: "OCADE Voice doesn't support this language yet.",
      missing: Object.values(PART_LABELS),
    };
  }
  if (isLanguageSupported(pack)) return { supported: true, pack };

  const missing = (Object.keys(PART_LABELS) as (keyof LanguagePack["verified"])[])
    .filter((k) => !pack.verified[k])
    .map((k) => PART_LABELS[k]);

  return {
    supported: false,
    reason: `${pack.label} isn't fully verified yet — ${missing.join(", ")} still need work.`,
    missing,
  };
}

/**
 * The language OCADE Voice will actually use, given what the device asks for.
 * Falls back to the first verified pack rather than failing outright.
 */
export function resolveVoiceLanguage(
  requested: string,
  packs: LanguagePack[] = LANGUAGE_PACKS,
): { code: string; fellBack: boolean; status: LanguageStatus } {
  const status = languageStatus(requested, packs);
  if (status.supported) return { code: status.pack.code, fellBack: false, status };
  const fallback = supportedLanguages(packs)[0];
  return { code: fallback?.code ?? "en", fellBack: true, status };
}

/* --------------------------------------------------------- speech engine -- */

export interface SpeakOptions {
  voiceId?: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
  onError?: (reason: string) => void;
}

export interface SpeechEngine {
  getVoices(): { name: string; lang: string; voiceURI?: string }[];
  speak(utterance: unknown): void;
  cancel(): void;
  speaking: boolean;
}

export interface VoiceCapabilities {
  synthesis: boolean;
  recognition: boolean;
  /** Wake phrase requires an engine that explicitly supports local processing. */
  wakePhrase: boolean;
  wakeReason?: string;
  reason?: string;
}

/**
 * Honest capability probe — reports what the current device/browser can
 * actually do rather than assuming.
 */
export function detectVoiceCapabilities(win: {
  speechSynthesis?: unknown;
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}): VoiceCapabilities {
  const synthesis = Boolean(win.speechSynthesis);
  const recognitionEngine = win.SpeechRecognition || win.webkitSpeechRecognition;
  const recognition = Boolean(recognitionEngine);
  const prototype =
    typeof recognitionEngine === "function"
      ? (recognitionEngine as { prototype?: object }).prototype
      : undefined;
  const wakePhrase = Boolean(prototype && "processLocally" in prototype);
  const caps: VoiceCapabilities = {
    synthesis,
    recognition,
    wakePhrase,
    wakeReason:
      recognition && !wakePhrase
        ? "This speech engine does not prove that recognition stays on-device, so continuous wake-phrase listening is disabled."
        : undefined,
  };
  if (!synthesis && !recognition) {
    caps.reason =
      "This browser doesn't provide speech input or output. OCADE Voice is unavailable here.";
  } else if (!recognition) {
    caps.reason = "This browser can speak but not listen. Push-to-talk is unavailable.";
  } else if (!synthesis) {
    caps.reason = "This browser can listen but not speak. Replies will be text only.";
  }
  return caps;
}

/**
 * The browser's own speech engine, as a registrable voice provider.
 *
 * This exists so the multimodal registry holds the provider that actually
 * ships. It declares ONLY `speakAloud`, because that is all the Web Speech API
 * can honestly do: `speechSynthesis` speaks through an utterance and never
 * returns audio bytes, and its recognition reads a live microphone rather than
 * a buffer. A `synthesize` or `transcribe` here would have to throw or return
 * empty audio, which is a placeholder executor — so neither is declared.
 *
 * `isAvailable` re-probes on every call rather than caching: speech synthesis
 * can disappear (a permissions change, a different tab, a browser without it),
 * and a provider that answers from a stale probe would claim it can speak when
 * it cannot.
 */
export function createSystemVoiceProvider(win: {
  speechSynthesis?: {
    speak: (utterance: unknown) => void;
    cancel: () => void;
  };
  SpeechSynthesisUtterance?: new (text: string) => object;
}): VoiceProvider | null {
  // No synthesis here means there is no provider to register. Registering a
  // non-functional one would be exactly the false claim to avoid.
  if (!win.speechSynthesis || !win.SpeechSynthesisUtterance) return null;

  return {
    id: "system-speech",
    type: "system",
    name: "System speech",
    isAvailable: async () => Boolean(win.speechSynthesis && win.SpeechSynthesisUtterance),
    speakAloud: (text: string) =>
      new Promise<void>((resolve, reject) => {
        const synthesis = win.speechSynthesis;
        const Utterance = win.SpeechSynthesisUtterance;
        if (!synthesis || !Utterance) {
          reject(new Error("Speech synthesis disappeared before the utterance started."));
          return;
        }
        const utterance = new Utterance(text) as {
          onend: (() => void) | null;
          onerror: ((event: { error?: string }) => void) | null;
        };
        utterance.onend = () => resolve();
        utterance.onerror = (event) =>
          reject(new Error(event?.error ?? "The utterance failed before it finished."));
        synthesis.speak(utterance);
      }),
  };
}

/**
 * Registers the platform's speech provider, if there is one.
 *
 * Returns what happened so a caller can surface an honest reason rather than a
 * silent no-op. Re-registration is not an error: the registry refuses duplicate
 * ids, and a voice surface may mount more than once.
 */
export function registerSystemVoice(
  registry: MultimodalRegistry,
  win: Parameters<typeof createSystemVoiceProvider>[0],
): { registered: boolean; reason: string } {
  const provider = createSystemVoiceProvider(win);
  if (!provider) {
    return { registered: false, reason: "This browser provides no speech synthesis engine." };
  }
  if (registry.getVoiceProvider(provider.id)) {
    return { registered: false, reason: "The system speech provider is already registered." };
  }
  registry.registerVoiceProvider(provider);
  return { registered: true, reason: "System speech is available and registered." };
}
