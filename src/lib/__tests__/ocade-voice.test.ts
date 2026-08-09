import { describe, it, expect } from "vitest";
import { MultimodalRegistry } from "../providers/multimodal-registry";
import {
  createSystemVoiceProvider,
  registerSystemVoice,
  normalizeTranscript,
  matchesWakePhrase,
  buildGreeting,
  timeOfDayGreeting,
  classifyVoiceGender,
  toVoiceOptions,
  pickVoice,
  isLanguageSupported,
  supportedLanguages,
  detectVoiceCapabilities,
  languageStatus,
  resolveVoiceLanguage,
  captionSentenceAt,
  DEFAULT_WAKE_PHRASES,
  matchPriorityVoiceCommand,
  executePriorityVoiceCommand,
  type LanguagePack,
} from "../ocade-voice";

describe("deterministic priority voice commands", () => {
  it.each([
    ["OCADE stop", "pause_work"],
    ["ocade stop now", "pause_work"],
    ["OCADE continue", "continue_work"],
    ["OCADE stop talking", "quiet"],
    ["ocade quiet please", "quiet"],
  ])("recognises %s locally", (text, command) => {
    expect(matchPriorityVoiceCommand(text)).toBe(command);
  });

  it.each(["please stop", "OCADE should stop after this", "don't stop talking", "continue"])(
    "does not over-trigger on %s",
    (text) => expect(matchPriorityVoiceCommand(text)).toBeNull(),
  );

  it("stops speech and local work before awaiting native input release", async () => {
    const order: string[] = [];
    const ticks = [0, 2, 19];
    const result = await executePriorityVoiceCommand("pause_work", {
      stopSpeech: () => order.push("speech"),
      pauseWork: () => order.push("work"),
      releaseHeldInput: async () => {
        order.push("native");
      },
      reobserveAndContinue: async () => undefined,
      now: () => ticks.shift() ?? 19,
    });
    expect(order).toEqual(["speech", "work", "native"]);
    expect(result).toMatchObject({ immediateMs: 2, settledMs: 19, nativeAcknowledged: true });
  });

  it("quiet stops only speech", async () => {
    const calls: string[] = [];
    await executePriorityVoiceCommand("quiet", {
      stopSpeech: () => calls.push("speech"),
      pauseWork: () => calls.push("work"),
      releaseHeldInput: () => {
        calls.push("native");
      },
      reobserveAndContinue: () => {
        calls.push("continue");
      },
      now: () => 1,
    });
    expect(calls).toEqual(["speech"]);
  });
});

describe("wake phrase (local, opt-in)", () => {
  it("normalises punctuation and spacing", () => {
    expect(normalizeTranscript("  Hello, OCADE!! ")).toBe("hello ocade");
  });

  it.each(["Hello OCADE", "hey ocade", "Hello, Okade.", "hey o cade"])("matches %s", (t) =>
    expect(matchesWakePhrase(t)).toBe(true),
  );

  it.each(["hello there", "what is ocade", "hey team", ""])(
    "does not match unrelated speech: %s",
    (t) => expect(matchesWakePhrase(t)).toBe(false),
  );

  it("exposes both default phrases", () => {
    expect(DEFAULT_WAKE_PHRASES).toContain("hello ocade");
    expect(DEFAULT_WAKE_PHRASES).toContain("hey ocade");
  });
});

describe("greetings", () => {
  it.each([
    [9, "Good morning"],
    [13, "Good afternoon"],
    [20, "Good evening"],
  ])("uses time of day at %i:00", (h, expected) => {
    expect(timeOfDayGreeting(h)).toBe(expected);
  });

  it("defaults to first name with no title", () => {
    expect(buildGreeting({ preferredName: "Haans" }, 9)).toBe("Good morning, Haans.");
  });

  it("takes only the first name from a full name", () => {
    expect(buildGreeting({ fullName: "Haans Antoni" }, 13)).toBe("Good afternoon, Haans.");
  });

  it("never invents a title when none was supplied", () => {
    const g = buildGreeting({ preferredName: "Haans", style: "first_name" }, 9);
    expect(g).not.toMatch(/\b(sir|ma'?am|mr|mrs|ms|miss)\b/i);
  });

  it("uses a custom title only when the user supplied one", () => {
    expect(buildGreeting({ customTitle: "Mr Antoni", style: "custom_title" }, 20)).toBe(
      "Good evening, Mr Antoni.",
    );
    // style requested but no title given -> falls back, does not fabricate
    expect(buildGreeting({ preferredName: "Haans", style: "custom_title" }, 20)).toBe(
      "Good evening, Haans.",
    );
  });

  it("supports a neutral, nameless style", () => {
    expect(buildGreeting({ style: "none" }, 9)).toBe("Good morning. How may I help?");
  });

  it("falls back gracefully with no name at all", () => {
    expect(buildGreeting({}, 9)).toBe("Good morning. How may I help?");
  });

  it("can be turned off entirely", () => {
    expect(buildGreeting({ preferredName: "Haans", enabled: false })).toBe("");
  });
});

describe("voice selection", () => {
  it("classifies obvious platform voice names", () => {
    expect(classifyVoiceGender("Microsoft Zira Desktop")).toBe("female");
    expect(classifyVoiceGender("Microsoft David Desktop")).toBe("male");
  });

  it("returns unknown rather than guessing", () => {
    expect(classifyVoiceGender("Voice 3")).toBe("unknown");
  });

  const raw = [
    { name: "Microsoft David Desktop", lang: "en-US", voiceURI: "david" },
    { name: "Microsoft Zira Desktop", lang: "en-US", voiceURI: "zira" },
    { name: "Voice 3", lang: "fr-FR", voiceURI: "v3" },
  ];

  it("maps platform voices to options", () => {
    const opts = toVoiceOptions(raw);
    expect(opts).toHaveLength(3);
    expect(opts[1].gender).toBe("female");
  });

  it("prefers the requested gender within the requested language", () => {
    const opts = toVoiceOptions(raw);
    expect(pickVoice(opts, { gender: "female", lang: "en-US" })?.id).toBe("zira");
    expect(pickVoice(opts, { gender: "male", lang: "en-US" })?.id).toBe("david");
  });

  it("prioritises language over gender", () => {
    const opts = toVoiceOptions(raw);
    // No female French voice exists -> stays in French rather than switching language.
    expect(pickVoice(opts, { gender: "female", lang: "fr-FR" })?.id).toBe("v3");
  });

  it("returns null when there are no voices", () => {
    expect(pickVoice([], { gender: "male" })).toBeNull();
  });
});

describe("language packs", () => {
  it("only counts a pack as supported when every check passes", () => {
    expect(
      isLanguageSupported({
        code: "x",
        label: "X",
        verified: { stt: true, tts: true, wake: true, commands: true },
      }),
    ).toBe(true);
    expect(
      isLanguageSupported({
        code: "y",
        label: "Y",
        verified: { stt: true, tts: true, wake: false, commands: true },
      }),
    ).toBe(false);
  });

  it("advertises only verified languages", () => {
    const packs = supportedLanguages([
      {
        code: "en",
        label: "English",
        verified: { stt: true, tts: true, wake: true, commands: true },
      },
      {
        code: "de",
        label: "German",
        verified: { stt: true, tts: false, wake: false, commands: false },
      },
    ]);
    expect(packs.map((p) => p.code)).toEqual(["en"]);
  });
});

describe("capability detection", () => {
  it("reports browser speech without falsely promising local wake recognition", () => {
    const c = detectVoiceCapabilities({
      speechSynthesis: {},
      SpeechRecognition: function BrowserRecognition() {},
    });
    expect(c).toMatchObject({ synthesis: true, recognition: true, wakePhrase: false });
    expect(c.reason).toBeUndefined();
  });

  it("offers wake phrase only when the engine exposes explicit local processing", () => {
    function LocalRecognition() {}
    LocalRecognition.prototype.processLocally = false;
    const c = detectVoiceCapabilities({
      speechSynthesis: {},
      SpeechRecognition: LocalRecognition,
    });
    expect(c.wakePhrase).toBe(true);
  });

  it("explains a listen-only or speak-only device honestly", () => {
    expect(detectVoiceCapabilities({ speechSynthesis: {} }).reason).toMatch(/not listen/i);
    expect(detectVoiceCapabilities({ webkitSpeechRecognition: {} }).reason).toMatch(/not speak/i);
  });

  it("reports voice unavailable when the browser has neither", () => {
    const c = detectVoiceCapabilities({});
    expect(c.synthesis).toBe(false);
    expect(c.recognition).toBe(false);
    expect(c.reason).toMatch(/unavailable/i);
  });
});

/**
 * Filtering unverified languages out of the picker silently leaves a
 * non-English speaker with one option and no explanation. These pin that the
 * reason is always available, and that a partial pack can never be presented
 * as working.
 */
describe("language status", () => {
  const packs: LanguagePack[] = [
    {
      code: "en",
      label: "English",
      verified: { stt: true, tts: true, wake: true, commands: true },
    },
    {
      code: "hi",
      label: "Hindi",
      verified: { stt: true, tts: true, wake: false, commands: false },
    },
  ];

  it("reports a fully verified language as supported", () => {
    const s = languageStatus("en", packs);
    expect(s.supported).toBe(true);
  });

  it("matches on the primary subtag, so en-GB is not a false negative", () => {
    expect(languageStatus("en-GB", packs).supported).toBe(true);
    expect(languageStatus("en_US", packs).supported).toBe(true);
    expect(languageStatus("EN", packs).supported).toBe(true);
  });

  it("names exactly which parts are unverified", () => {
    const s = languageStatus("hi", packs);
    expect(s.supported).toBe(false);
    if (s.supported) throw new Error("unreachable");
    expect(s.missing).toEqual(["the wake phrase", "voice commands"]);
    expect(s.reason).toContain("Hindi");
  });

  it("explains an unknown language rather than failing silently", () => {
    const s = languageStatus("ja", packs);
    expect(s.supported).toBe(false);
    if (s.supported) throw new Error("unreachable");
    expect(s.reason).toMatch(/doesn't support/i);
    expect(s.missing.length).toBeGreaterThan(0);
  });

  it("handles an empty or malformed code without throwing", () => {
    expect(languageStatus("", packs).supported).toBe(false);
    expect(languageStatus("---", packs).supported).toBe(false);
  });

  /** A partially verified pack must never be offered as a choice. */
  it("keeps a partial pack out of the supported list", () => {
    expect(supportedLanguages(packs).map((p) => p.code)).toEqual(["en"]);
  });
});

describe("resolving the language actually used", () => {
  const packs: LanguagePack[] = [
    {
      code: "en",
      label: "English",
      verified: { stt: true, tts: true, wake: true, commands: true },
    },
    {
      code: "hi",
      label: "Hindi",
      verified: { stt: true, tts: true, wake: false, commands: false },
    },
  ];

  it("uses the requested language when it is verified", () => {
    const r = resolveVoiceLanguage("en-GB", packs);
    expect(r.code).toBe("en");
    expect(r.fellBack).toBe(false);
  });

  it("falls back to a verified language and SAYS it fell back", () => {
    const r = resolveVoiceLanguage("hi-IN", packs);
    expect(r.code).toBe("en");
    expect(r.fellBack).toBe(true);
    expect(r.status.supported).toBe(false);
  });

  it("still returns a usable code when nothing is verified", () => {
    const r = resolveVoiceLanguage("ja", [
      {
        code: "hi",
        label: "Hindi",
        verified: { stt: false, tts: false, wake: false, commands: false },
      },
    ]);
    expect(r.code).toBe("en");
    expect(r.fellBack).toBe(true);
  });
});

/**
 * Output captions: what OCADE is READING ALOUD, for anyone who cannot hear it.
 * Speech synthesis reports a character offset as it progresses, so this must be
 * total — any index, any text, never a throw and never an empty caption.
 */
describe("output caption windowing", () => {
  const text = "First sentence here. Second one follows! Third and last?";

  it("shows the sentence containing the current offset", () => {
    expect(captionSentenceAt(text, 3)).toBe("First sentence here.");
    expect(captionSentenceAt(text, 25)).toBe("Second one follows!");
    expect(captionSentenceAt(text, 45)).toBe("Third and last?");
  });

  it("handles ! and ? as sentence boundaries, not just full stops", () => {
    expect(captionSentenceAt("Stop! Go on.", 1)).toBe("Stop!");
    expect(captionSentenceAt("Why? Because.", 1)).toBe("Why?");
  });

  it("clamps an out-of-range index instead of throwing", () => {
    expect(() => captionSentenceAt(text, -50)).not.toThrow();
    expect(() => captionSentenceAt(text, 99_999)).not.toThrow();
    expect(captionSentenceAt(text, -50)).toBe("First sentence here.");
    expect(captionSentenceAt(text, 99_999)).toBe("Third and last?");
  });

  it("returns a bounded window when there is no punctuation at all", () => {
    const long = "word ".repeat(200);
    const caption = captionSentenceAt(long, 10);
    expect(caption.length).toBeLessThanOrEqual(200);
    expect(caption.length).toBeGreaterThan(0);
  });

  it("truncates an overlong sentence with an ellipsis", () => {
    const long = `${"a".repeat(500)}.`;
    const caption = captionSentenceAt(long, 5);
    expect(caption.length).toBeLessThanOrEqual(200);
    expect(caption.endsWith("…")).toBe(true);
  });

  it("returns nothing for empty or whitespace-only text", () => {
    expect(captionSentenceAt("", 0)).toBe("");
    expect(captionSentenceAt("   ", 0)).toBe("");
  });

  it("never returns an empty caption for real text", () => {
    for (let i = 0; i < text.length; i++) {
      expect(captionSentenceAt(text, i).length).toBeGreaterThan(0);
    }
  });
});

/**
 * The platform speech engine as a registrable provider.
 *
 * The multimodal registry's VoiceProvider contract used to require both
 * `synthesize` (returning audio bytes) and `transcribe` (reading a buffer).
 * The Web Speech API can do neither: it speaks through an utterance and listens
 * to a live microphone. Registering the real engine therefore required stubbing
 * two methods that could only throw — a placeholder wearing a real interface.
 * These tests pin the corrected contract: declare only what the platform can do.
 */
describe("the system voice provider claims only what a browser can do", () => {
  const engine = () => {
    const spoken: string[] = [];
    const win = {
      speechSynthesis: {
        speak: (u: unknown) => {
          spoken.push("spoken");
          (u as { onend?: () => void }).onend?.();
        },
        cancel: () => {},
      },
      SpeechSynthesisUtterance: class {
        onend: (() => void) | null = null;
        onerror: ((e: { error?: string }) => void) | null = null;
        constructor(public text: string) {}
      },
    };
    return { win, spoken };
  };

  it("declares speakAloud but NOT synthesize or transcribe", () => {
    // The browser cannot hand back audio bytes, so it must not claim to.
    const provider = createSystemVoiceProvider(engine().win as never);
    expect(provider).not.toBeNull();
    expect(typeof provider!.speakAloud).toBe("function");
    expect(provider!.synthesize).toBeUndefined();
    expect(provider!.transcribe).toBeUndefined();
    expect(provider!.type).toBe("system");
  });

  it("returns null when the browser has no speech engine", () => {
    // No provider at all is the honest answer; a non-functional one is not.
    expect(createSystemVoiceProvider({} as never)).toBeNull();
    expect(createSystemVoiceProvider({ speechSynthesis: {} } as never)).toBeNull();
  });

  it("really speaks, and resolves only when the utterance ends", async () => {
    const { win, spoken } = engine();
    const provider = createSystemVoiceProvider(win as never)!;
    await provider.speakAloud!("hello");
    expect(spoken).toHaveLength(1);
  });

  it("rejects rather than resolving when the utterance errors", async () => {
    // A speak that silently "succeeds" after failing is a fake-success path.
    const win = {
      speechSynthesis: {
        speak: (u: unknown) =>
          (u as { onerror?: (e: { error: string }) => void }).onerror?.({
            error: "synthesis-failed",
          }),
        cancel: () => {},
      },
      SpeechSynthesisUtterance: class {
        onend: (() => void) | null = null;
        onerror: ((e: { error?: string }) => void) | null = null;
        constructor(public text: string) {}
      },
    };
    const provider = createSystemVoiceProvider(win as never)!;
    await expect(provider.speakAloud!("hello")).rejects.toThrow(/synthesis-failed/);
  });

  it("re-probes availability instead of trusting a cached answer", async () => {
    const win: { speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown } = engine().win;
    const provider = createSystemVoiceProvider(win as never)!;
    await expect(provider.isAvailable()).resolves.toBe(true);
    // Synthesis can disappear; a stale probe would keep claiming it can speak.
    delete win.speechSynthesis;
    await expect(provider.isAvailable()).resolves.toBe(false);
  });
});

describe("registering the system voice reports what happened", () => {
  const workingWin = {
    speechSynthesis: { speak: () => {}, cancel: () => {} },
    SpeechSynthesisUtterance: class {
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  };

  it("registers the real provider into the registry", () => {
    const registry = new MultimodalRegistry();
    const result = registerSystemVoice(registry, workingWin as never);
    expect(result.registered).toBe(true);
    expect(registry.getVoiceProvider("system-speech")).toBeDefined();
    expect(registry.getSpeakingProviders()).toHaveLength(1);
  });

  it("is idempotent — a second call does not throw on the duplicate id", () => {
    // The voice surface may mount more than once; that must not crash it.
    const registry = new MultimodalRegistry();
    registerSystemVoice(registry, workingWin as never);
    const again = registerSystemVoice(registry, workingWin as never);
    expect(again.registered).toBe(false);
    expect(again.reason).toMatch(/already registered/i);
    expect(registry.getVoiceProviders()).toHaveLength(1);
  });

  it("gives an honest reason when the browser cannot speak at all", () => {
    const registry = new MultimodalRegistry();
    const result = registerSystemVoice(registry, {} as never);
    expect(result.registered).toBe(false);
    expect(result.reason).toMatch(/no speech synthesis/i);
    expect(registry.getVoiceProviders()).toHaveLength(0);
  });
});
