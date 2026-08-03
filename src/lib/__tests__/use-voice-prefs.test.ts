import { describe, it, expect } from "vitest";
import { parseVoicePrefs, saveVoicePrefs, DEFAULT_VOICE_PREFS } from "../use-voice-prefs";

describe("voice preference defaults", () => {
  it("assumes no voice and no title, and keeps the wake phrase OFF", () => {
    // Decisions #22/#23/#25/#26: never assume a voice, never infer a title,
    // wake phrase is opt-in.
    expect(DEFAULT_VOICE_PREFS.gender).toBe("unknown");
    expect(DEFAULT_VOICE_PREFS.wakeEnabled).toBe(false);
    expect(DEFAULT_VOICE_PREFS.addressStyle).toBe("first_name");
    expect(DEFAULT_VOICE_PREFS.preferredTitle).toBe("");
    expect(DEFAULT_VOICE_PREFS.muted).toBe(false);
  });
});

describe("parseVoicePrefs", () => {
  it("returns defaults for missing storage", () => {
    expect(parseVoicePrefs(null)).toEqual(DEFAULT_VOICE_PREFS);
  });

  it("returns defaults for corrupt JSON rather than throwing", () => {
    expect(parseVoicePrefs("{not json")).toEqual(DEFAULT_VOICE_PREFS);
  });

  it("merges stored values over defaults", () => {
    const p = parseVoicePrefs(
      JSON.stringify({ gender: "female", wakeEnabled: true, preferredName: "Haans" }),
    );
    expect(p.gender).toBe("female");
    expect(p.wakeEnabled).toBe(true);
    expect(p.preferredName).toBe("Haans");
    // Untouched keys keep their defaults.
    expect(p.captionsEnabled).toBe(DEFAULT_VOICE_PREFS.captionsEnabled);
  });

  it("clamps rate and pitch into a safe range", () => {
    const hi = parseVoicePrefs(JSON.stringify({ rate: 99, pitch: -5 }));
    expect(hi.rate).toBe(2);
    expect(hi.pitch).toBe(0.5);
  });

  it("rejects a nonsense gender instead of trusting it", () => {
    expect(parseVoicePrefs(JSON.stringify({ gender: "robot" })).gender).toBe("unknown");
  });

  it("bounds name and title length", () => {
    const p = parseVoicePrefs(
      JSON.stringify({ preferredName: "n".repeat(500), preferredTitle: "t".repeat(500) }),
    );
    expect(p.preferredName.length).toBe(80);
    expect(p.preferredTitle.length).toBe(40);
  });

  it("ignores non-string name values", () => {
    expect(parseVoicePrefs(JSON.stringify({ preferredName: 42 })).preferredName).toBe("");
  });

  it("validates every persisted enum, boolean, string and device id", () => {
    const p = parseVoicePrefs(
      JSON.stringify({
        voiceName: 42,
        language: "<script>",
        wakeEnabled: "yes",
        captionsEnabled: 1,
        autoSpeak: {},
        muted: null,
        addressStyle: "your_highness",
        greetingEnabled: "true",
        microphoneId: "m".repeat(500),
        outputId: 17,
      }),
    );
    expect(p).toMatchObject({
      voiceName: null,
      language: DEFAULT_VOICE_PREFS.language,
      wakeEnabled: DEFAULT_VOICE_PREFS.wakeEnabled,
      captionsEnabled: DEFAULT_VOICE_PREFS.captionsEnabled,
      autoSpeak: DEFAULT_VOICE_PREFS.autoSpeak,
      muted: DEFAULT_VOICE_PREFS.muted,
      addressStyle: DEFAULT_VOICE_PREFS.addressStyle,
      greetingEnabled: DEFAULT_VOICE_PREFS.greetingEnabled,
      outputId: DEFAULT_VOICE_PREFS.outputId,
    });
    expect(p.microphoneId).toHaveLength(160);
  });

  it("reports a storage failure instead of claiming the preference was saved", () => {
    const storage = {
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    const result = saveVoicePrefs(storage, { ...DEFAULT_VOICE_PREFS, muted: true });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/couldn't save/i);
  });

  it("serialises an exact validated preference snapshot", () => {
    let stored = "";
    const result = saveVoicePrefs(
      { setItem: (_key, value) => (stored = value) },
      { ...DEFAULT_VOICE_PREFS, rate: 1.4 },
    );
    expect(result.ok).toBe(true);
    expect(JSON.parse(stored)).toMatchObject({ rate: 1.4, wakeEnabled: false });
  });
});
