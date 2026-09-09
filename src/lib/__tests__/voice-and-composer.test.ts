import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  LANGUAGE_CANDIDATES,
  primarySubtag,
  probeLanguage,
  probeAll,
  speechRecognitionAvailable,
  languageInstruction,
  loadVoices,
  type VoiceDescriptor,
} from "../voice/speech-capabilities";

/**
 * WHAT OCADE CAN ACTUALLY HEAR AND SAY.
 *
 * The old `LANGUAGE_PACKS` declared one verified language — English — and said
 * nothing about any other. That was honest about English and useless to a Hindi
 * or Tamil speaker, and worse, it was not a checkable claim: whether a device
 * can speak Tamil depends on the voices installed on it, not on anything in
 * this repository.
 *
 * So capability is probed and these tests pin the probe, including the cases
 * that are easy to get wrong — a voice but no recogniser, a recogniser but no
 * voice, and a regional tag that must satisfy its primary subtag.
 */

const voice = (lang: string, localService = true, name = lang): VoiceDescriptor => ({
  name,
  lang,
  localService,
});

describe("language tags resolve on their primary subtag", () => {
  it("treats ta-IN, ta_in and ta as the same language", () => {
    expect(primarySubtag("ta-IN")).toBe("ta");
    expect(primarySubtag("ta_in")).toBe("ta");
    expect(primarySubtag("TA")).toBe("ta");
  });

  it("matches a regional voice to its language", () => {
    // The trap: a device installs `hi-IN` and a naive equality check against
    // "hi" reports Hindi as unsupported on a machine that speaks it.
    const hindi = LANGUAGE_CANDIDATES.find((c) => c.code === "hi")!;
    const capability = probeLanguage(hindi, [voice("hi-IN")], true);
    expect(capability.canSpeak).toBe(true);
    expect(capability.preferredTag).toBe("hi-IN");
  });
});

describe("capability is reported per device, never assumed", () => {
  const tamil = LANGUAGE_CANDIDATES.find((c) => c.code === "ta")!;

  it("reports both when a voice and a recogniser are present", () => {
    const capability = probeLanguage(tamil, [voice("ta-IN")], true);
    expect(capability.canSpeak).toBe(true);
    expect(capability.canListen).toBe(true);
    expect(capability.summary).toMatch(/listen and reply aloud in Tamil/);
  });

  it("separates 'can hear' from 'can speak', because they fail separately", () => {
    // Recogniser but no installed voice: the fix is a system language pack.
    const listenOnly = probeLanguage(tamil, [], true);
    expect(listenOnly.canListen).toBe(true);
    expect(listenOnly.canSpeak).toBe(false);
    expect(listenOnly.summary).toMatch(/replies will be text only/);
    expect(listenOnly.summary).toMatch(/system settings/);

    // Voice but no recogniser: the fix is a different browser.
    const speakOnly = probeLanguage(tamil, [voice("ta-IN")], false);
    expect(speakOnly.canSpeak).toBe(true);
    expect(speakOnly.canListen).toBe(false);
    expect(speakOnly.summary).toMatch(/no speech input/);
  });

  it("still says typing works when neither is available", () => {
    const none = probeLanguage(tamil, [], false);
    expect(none.summary).toMatch(/Typing in Tamil still works/);
  });

  it("prefers a locally installed voice over a network one", () => {
    // A local voice needs no connection and does not send text to a server —
    // which matters more here than on most products.
    const capability = probeLanguage(
      tamil,
      [voice("ta-IN", false, "remote"), voice("ta-IN", true, "local")],
      true,
    );
    expect(capability.voices[0].name).toBe("local");
  });

  it("covers Hindi, Tamil and the other Indian languages asked for", () => {
    const codes = LANGUAGE_CANDIDATES.map((c) => c.code);
    for (const code of ["hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa", "ur"]) {
      expect(codes, `${code} is not offered`).toContain(code);
    }
  });

  it("labels every language in its own script", () => {
    // A picker listing "Hindi" to someone who reads only Devanagari is a
    // picker they cannot use.
    for (const candidate of LANGUAGE_CANDIDATES) {
      expect(candidate.nativeLabel.trim().length).toBeGreaterThan(0);
      if (candidate.code !== "en") {
        expect(candidate.nativeLabel).not.toBe(candidate.label);
      }
    }
  });

  it("probes every candidate at once without throwing", () => {
    const all = probeAll([voice("hi-IN"), voice("en-US")], true);
    expect(all).toHaveLength(LANGUAGE_CANDIDATES.length);
    expect(all.find((c) => c.code === "hi")!.canSpeak).toBe(true);
    expect(all.find((c) => c.code === "ta")!.canSpeak).toBe(false);
  });
});

describe("written and spoken language are separate concerns", () => {
  it("asks the model for the language regardless of whether a voice exists", () => {
    /*
     * The trap this avoids: gating the WRITTEN answer on whether the device
     * owns a voice. A local model can usually write Tamil on a machine with no
     * Tamil voice installed; only speaking it aloud needs the voice.
     */
    const tamil = LANGUAGE_CANDIDATES.find((c) => c.code === "ta")!;
    const instruction = languageInstruction(tamil);
    expect(instruction).toMatch(/Reply in Tamil/);
    expect(instruction).toMatch(/தமிழ்/);
    // And it must not force the language when the user switches mid-conversation.
    expect(instruction).toMatch(/match the language they used/);
  });

  it("adds no instruction for English, the model's default", () => {
    const english = LANGUAGE_CANDIDATES.find((c) => c.code === "en")!;
    expect(languageInstruction(english)).toBe("");
  });
});

describe("the probe survives a browser that has nothing", () => {
  it("reports no recogniser when the API is absent", () => {
    expect(speechRecognitionAvailable({})).toBe(false);
    expect(speechRecognitionAvailable({ SpeechRecognition: function () {} })).toBe(true);
    expect(speechRecognitionAvailable({ webkitSpeechRecognition: function () {} })).toBe(true);
  });

  it("resolves to an empty list with no speech synthesis at all", async () => {
    await expect(loadVoices(undefined)).resolves.toEqual([]);
  });

  it("waits for voiceschanged rather than reporting a cold empty list", async () => {
    /*
     * Chrome returns [] synchronously on a cold page and fills the list later.
     * Probing during mount without waiting reports every language as
     * unspeakable on a machine full of voices.
     */
    let listener: (() => void) | null = null;
    let ready = false;
    const synth = {
      getVoices: () => (ready ? [voice("hi-IN")] : []),
      addEventListener: (_: string, fn: () => void) => {
        listener = fn;
      },
      removeEventListener: () => {},
    } as unknown as SpeechSynthesis;

    const pending = loadVoices(synth, 2000);
    ready = true;
    listener!();
    await expect(pending).resolves.toHaveLength(1);
  });

  it("gives up rather than hanging when voiceschanged never fires", async () => {
    const synth = {
      getVoices: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as SpeechSynthesis;
    await expect(loadVoices(synth, 10)).resolves.toEqual([]);
  });
});

/* ---------------------------------------------------------------- composer */

const COMPOSER = readFileSync("src/components/ocade/chat/ChatComposer.tsx", "utf8");
const HOOK = readFileSync("src/lib/voice/use-dictation.ts", "utf8");

/*
 * THE `+` MENU IS GONE, AND SO ARE ITS TESTS.
 *
 * `ComposerMenu.tsx` and `DictateButton.tsx` were a second composer: a `+`
 * menu with New chat / Upload image / Upload file / Add link, and a dictation
 * button with its own recording indicator. Nothing rendered either of them —
 * only this file and two others imported them — while the composer people
 * actually type into lived inside the Chat route with its own attach buttons
 * and its own hold-to-talk control.
 *
 * So the rules asserted here were true of code no user could reach. `PLAN.md`
 * Phase 1 allows one authority per subsystem: the shipped composer took the
 * name and the unshipped pair was removed. The one rule that was genuinely
 * about the PRODUCT rather than about that component — that an open microphone
 * is unmistakable, and that its indicator survives a reduced-motion preference
 * — moved onto the shipped composer, and is asserted against it below.
 *
 * Whether the composer should collapse its attach controls back behind one
 * trigger is a question for the final interface pass, not something to keep an
 * unreachable component alive for.
 */

describe("the microphone is unmistakable when it is open", () => {
  it("draws the recording ring outside motion-safe, so a motion preference cannot hide it", () => {
    const ring = /ring-2 ring-destructive\/60/;
    expect(COMPOSER).toMatch(ring);
    const ringLine = COMPOSER.split("\n").find((line) => ring.test(line)) ?? "";
    expect(ringLine).not.toMatch(/motion-safe/);
    // And the pulse, separately, does respect it.
    expect(COMPOSER).toMatch(/motion-safe:animate-ping/);
  });

  it("keeps text chat usable rather than disabling the whole composer", () => {
    // A signed-out or capability-limited visitor gets a usable chat, not a
    // locked shell. The box is disabled only while a reply is streaming.
    expect(COMPOSER).not.toMatch(/<Textarea[\s\S]{0,400}disabled=\{!signedIn\}/);
    expect(COMPOSER).toMatch(/disabled=\{streaming\}/);
  });

  it("names every failure with the action that fixes it", () => {
    for (const [code, phrase] of [
      ["not-allowed", "permission"],
      ["audio-capture", "No microphone was found"],
      ["network", "needs a connection"],
      ["no-speech", "did not hear anything"],
    ] as const) {
      expect(HOOK, `${code} has no actionable message`).toContain(phrase);
    }
  });

  it("does not send by itself", () => {
    // The recogniser mishears names, numbers and punctuation constantly. A
    // message that sends itself gives nobody a chance to fix it.
    expect(HOOK).toMatch(/autoSend = false/);
  });

  it("closes the microphone when the component goes away", () => {
    // A live recording indicator after unmount reads as the product spying.
    expect(HOOK).toMatch(/recognitionRef\.current\?\.abort\(\)/);
  });

  it("does not report a deliberate stop as an error", () => {
    expect(HOOK).toMatch(/if \(event\.error === "aborted"\) return;/);
  });
});
