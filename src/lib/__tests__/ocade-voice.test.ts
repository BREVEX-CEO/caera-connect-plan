import { describe, it, expect } from "vitest";
import {
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
  DEFAULT_WAKE_PHRASES,
} from "../ocade-voice";

describe("wake phrase (local, opt-in)", () => {
  it("normalises punctuation and spacing", () => {
    expect(normalizeTranscript("  Hello, OCADE!! ")).toBe("hello ocade");
  });

  it.each(["Hello OCADE", "hey ocade", "Hello, Okade.", "hey o cade"])(
    "matches %s",
    (t) => expect(matchesWakePhrase(t)).toBe(true),
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
      isLanguageSupported({ code: "x", label: "X", verified: { stt: true, tts: true, wake: true, commands: true } }),
    ).toBe(true);
    expect(
      isLanguageSupported({ code: "y", label: "Y", verified: { stt: true, tts: true, wake: false, commands: true } }),
    ).toBe(false);
  });

  it("advertises only verified languages", () => {
    const packs = supportedLanguages([
      { code: "en", label: "English", verified: { stt: true, tts: true, wake: true, commands: true } },
      { code: "de", label: "German", verified: { stt: true, tts: false, wake: false, commands: false } },
    ]);
    expect(packs.map((p) => p.code)).toEqual(["en"]);
  });
});

describe("capability detection", () => {
  it("reports full capability", () => {
    const c = detectVoiceCapabilities({ speechSynthesis: {}, SpeechRecognition: {} });
    expect(c).toMatchObject({ synthesis: true, recognition: true, wakePhrase: true });
    expect(c.reason).toBeUndefined();
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
