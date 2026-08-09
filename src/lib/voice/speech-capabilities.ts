/**
 * What this device can actually hear and say, per language.
 *
 * THE PROBLEM WITH THE OLD LIST. `LANGUAGE_PACKS` hard-coded one entry —
 * English, `verified: { stt: true, tts: true, … }` — and everything else was
 * absent. That is honest about English and silent about the rest: a Hindi
 * speaker saw one option and no explanation.
 *
 * The deeper problem is that the claim was not checkable. Whether OCADE can
 * speak Tamil is not a fact about OCADE; it is a fact about the voices
 * installed on the machine and the recogniser the browser ships. A Mac with the
 * Indian voice pack installed can speak Tamil; the same browser on a bare
 * Windows install cannot. A static list is wrong on both.
 *
 * So capability is PROBED, not declared:
 *
 *   - SPOKEN OUTPUT comes from `speechSynthesis.getVoices()`, matched on the
 *     primary subtag, so `ta-IN` satisfies `ta`.
 *   - SPEECH INPUT comes from the presence of the recognition API. The browser
 *     exposes no per-language enumeration, so this is reported as "the API is
 *     here and this language is one it is documented to accept" rather than as
 *     a guarantee — and the UI says so in those words.
 *
 * `getVoices()` IS ASYNCHRONOUS IN PRACTICE. Chrome returns an empty array on
 * first call and fires `voiceschanged` once the list is ready, so a probe run
 * during mount reports "no voices" on a machine full of them. `loadVoices`
 * waits for that event with a timeout.
 */

/** The languages OCADE offers, beyond whatever the device adds. */
export interface LanguageCandidate {
  /** Primary subtag. */
  code: string;
  /** English label, for a picker that may render before the language loads. */
  label: string;
  /** Endonym — what speakers call it. Shown first. */
  nativeLabel: string;
  /** Preferred BCP-47 tag when asking for recognition or a voice. */
  preferredTag: string;
}

/**
 * Candidates, not promises.
 *
 * Indian languages lead because that is where this product's first users are,
 * and because they are the ones a hard-coded English-only list failed hardest.
 * Presence here means OCADE will look for support; `probeLanguage` decides
 * whether it found any.
 */
export const LANGUAGE_CANDIDATES: LanguageCandidate[] = [
  { code: "en", label: "English", nativeLabel: "English", preferredTag: "en-US" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", preferredTag: "hi-IN" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", preferredTag: "ta-IN" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", preferredTag: "te-IN" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা", preferredTag: "bn-IN" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी", preferredTag: "mr-IN" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", preferredTag: "gu-IN" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", preferredTag: "kn-IN" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം", preferredTag: "ml-IN" },
  { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", preferredTag: "pa-IN" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو", preferredTag: "ur-IN" },
  { code: "es", label: "Spanish", nativeLabel: "Español", preferredTag: "es-ES" },
  { code: "fr", label: "French", nativeLabel: "Français", preferredTag: "fr-FR" },
  { code: "de", label: "German", nativeLabel: "Deutsch", preferredTag: "de-DE" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português", preferredTag: "pt-BR" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", preferredTag: "ar-SA" },
  { code: "zh", label: "Chinese", nativeLabel: "中文", preferredTag: "zh-CN" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", preferredTag: "ja-JP" },
];

export interface VoiceDescriptor {
  name: string;
  lang: string;
  localService: boolean;
}

export interface LanguageCapability {
  code: string;
  label: string;
  nativeLabel: string;
  preferredTag: string;
  /** A voice for this language is installed on this device. */
  canSpeak: boolean;
  /** The recognition API exists. Per-language accuracy is not knowable here. */
  canListen: boolean;
  /** Voices found, best (local) first. */
  voices: VoiceDescriptor[];
  /** One sentence for the screen. Never claims more than was found. */
  summary: string;
}

/** Primary subtag, lowercased. `ta-IN` and `ta_in` both give `ta`. */
export function primarySubtag(tag: string): string {
  return (tag ?? "").toLowerCase().split(/[-_]/)[0];
}

/**
 * Wait for the voice list to be populated.
 *
 * Chrome returns `[]` synchronously on a cold page and fills the list later,
 * so probing during mount without this reports every language as unspeakable.
 * Resolves early on `voiceschanged`, and gives up after `timeoutMs` rather
 * than hanging a settings screen forever on a browser that never fires it.
 */
export function loadVoices(
  synth: SpeechSynthesis | undefined = typeof window === "undefined"
    ? undefined
    : window.speechSynthesis,
  timeoutMs = 1500,
): Promise<VoiceDescriptor[]> {
  if (!synth) return Promise.resolve([]);

  const read = (): VoiceDescriptor[] =>
    synth.getVoices().map((v) => ({ name: v.name, lang: v.lang, localService: v.localService }));

  const immediate = read();
  if (immediate.length > 0) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener?.("voiceschanged", finish);
      clearTimeout(timer);
      resolve(read());
    };
    const timer = setTimeout(finish, timeoutMs);
    synth.addEventListener?.("voiceschanged", finish);
  });
}

/** Is a speech-recognition API present at all? */
export function speechRecognitionAvailable(scope: unknown = globalThis): boolean {
  const w = scope as Record<string, unknown>;
  return (
    typeof w?.SpeechRecognition === "function" || typeof w?.webkitSpeechRecognition === "function"
  );
}

/**
 * Decide what one language can do on this device.
 *
 * Pure: it takes the voice list and the recogniser flag rather than reading
 * globals, so every combination — voice but no recogniser, recogniser but no
 * voice, neither — is reachable from a test.
 */
export function probeLanguage(
  candidate: LanguageCandidate,
  voices: VoiceDescriptor[],
  recognitionAvailable: boolean,
): LanguageCapability {
  const matching = voices
    .filter((v) => primarySubtag(v.lang) === candidate.code)
    // A locally installed voice does not need the network and sounds better.
    .sort((a, b) => Number(b.localService) - Number(a.localService));

  const canSpeak = matching.length > 0;
  const canListen = recognitionAvailable;

  return {
    code: candidate.code,
    label: candidate.label,
    nativeLabel: candidate.nativeLabel,
    preferredTag: matching[0]?.lang ?? candidate.preferredTag,
    canSpeak,
    canListen,
    voices: matching,
    summary: summarise(candidate, canSpeak, canListen),
  };
}

function summarise(candidate: LanguageCandidate, canSpeak: boolean, canListen: boolean): string {
  if (canSpeak && canListen) {
    return `OCADE can listen and reply aloud in ${candidate.label} on this device.`;
  }
  if (canSpeak) {
    // Worth distinguishing: the fix is a different browser, not a font pack.
    return `OCADE can reply aloud in ${candidate.label}, but this browser has no speech input.`;
  }
  if (canListen) {
    return `OCADE can listen in ${candidate.label}. No ${candidate.label} voice is installed on this device, so replies will be text only — adding the language to your system settings enables spoken replies.`;
  }
  return `This device has no ${candidate.label} voice and no speech input. Typing in ${candidate.label} still works.`;
}

/** Probe every candidate at once. */
export function probeAll(
  voices: VoiceDescriptor[],
  recognitionAvailable: boolean,
  candidates: LanguageCandidate[] = LANGUAGE_CANDIDATES,
): LanguageCapability[] {
  return candidates.map((c) => probeLanguage(c, voices, recognitionAvailable));
}

/**
 * Read the device and report. The one impure entry point.
 */
export async function detectSpeechCapabilities(): Promise<LanguageCapability[]> {
  const voices = await loadVoices();
  return probeAll(voices, speechRecognitionAvailable());
}

/**
 * What OCADE tells the model about the language to answer in.
 *
 * TEXT AND SPEECH ARE SEPARATE CAPABILITIES, and conflating them is the trap
 * here. A local model can usually WRITE Tamil whether or not the device owns a
 * Tamil voice; the voice only decides whether the reply can be spoken. So this
 * never gates the written answer on `canSpeak` — it asks for the language and
 * lets the speech layer fall back to text.
 */
export function languageInstruction(candidate: LanguageCandidate): string {
  if (candidate.code === "en") return "";
  return (
    `Reply in ${candidate.label} (${candidate.nativeLabel}) unless the user writes in another language, ` +
    `in which case match the language they used. Keep technical terms and code in their original form.`
  );
}
