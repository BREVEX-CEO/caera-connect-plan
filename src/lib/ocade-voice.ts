/**
 * OCADE Voice (Plan §22, decisions #22–#27).
 *
 * An original OCADE voice experience — it does not imitate any copyrighted
 * character, voice, or dialogue. Speech recognition and synthesis run on the
 * device through the browser's speech engines, so push-to-talk and read-aloud
 * work without sending audio to a server.
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

const FEMALE_HINTS = /(female|woman|zira|aria|jenny|samantha|victoria|karen|serena|sonia|amelie|hazel|eva|nora|clara|lucia|emma|ava)/i;
const MALE_HINTS = /(male|man|david|mark|george|guy|ryan|daniel|alex|fred|thomas|liam|william|james|diego|jorge)/i;

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
  /** Wake phrase needs continuous recognition. */
  wakePhrase: boolean;
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
  const recognition = Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  const caps: VoiceCapabilities = { synthesis, recognition, wakePhrase: recognition };
  if (!synthesis && !recognition) {
    caps.reason = "This browser doesn't provide on-device speech. OCADE Voice is unavailable here.";
  } else if (!recognition) {
    caps.reason = "This browser can speak but not listen. Push-to-talk is unavailable.";
  } else if (!synthesis) {
    caps.reason = "This browser can listen but not speak. Replies will be text only.";
  }
  return caps;
}
