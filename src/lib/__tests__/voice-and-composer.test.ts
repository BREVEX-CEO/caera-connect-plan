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

const MENU = readFileSync("src/components/ocade/chat/ComposerMenu.tsx", "utf8");
const DICTATE = readFileSync("src/components/ocade/chat/DictateButton.tsx", "utf8");
const HOOK = readFileSync("src/lib/voice/use-dictation.ts", "utf8");

describe("the + menu does not cover the message being written", () => {
  it("anchors above the composer card rather than the button", () => {
    /*
     * Measured in a browser: anchored to the button, the menu overlapped the
     * text area by 50px, because the + sits in the control row BELOW it. The
     * wrapper is `contents` so the menu positions against the composer's own
     * relative card instead.
     */
    expect(MENU).toMatch(/cn\("contents", className\)/);
    expect(MENU).toMatch(/absolute bottom-full/);
  });

  it("returns focus to the trigger when dismissed with Escape", () => {
    // Without this the next Tab starts from the top of the document.
    expect(MENU).toMatch(/triggerRef\.current\?\.focus\(\)/);
  });

  it("offers the four actions the composer owns", () => {
    for (const label of ["New chat", "Upload image", "Upload file", "Add link"]) {
      expect(MENU, `${label} is missing from the menu`).toContain(label);
    }
  });

  it("explains an unavailable action rather than hiding it", () => {
    // A capability that vanishes leaves the user unsure it exists at all.
    expect(MENU).toMatch(/disabledReason/);
    expect(MENU).toMatch(/action\.disabledReason \?\?/);
  });

  it("answers a sign-in gate instead of greying the item out", () => {
    /*
     * THE DEAD CONTROL THIS REPLACES. Upload image, upload file and add link
     * were rendered `disabled` for every demo visitor — three greyed rows that
     * could not be pressed and did not say why. A disabled control is the right
     * answer to a CAPABILITY limit ("this browser cannot read images") and the
     * wrong answer to an ACCOUNT one, because the second has a remedy and the
     * user is the one who can apply it.
     *
     * Gated items now stay pressable and swap the menu to "Sign in to upload
     * files" with the button that does it.
     */
    expect(MENU, "the gate is not distinguished from a capability limit").toMatch(/requiresSignIn/);
    expect(MENU, "pressing a gated action does not offer sign-in").toMatch(/Sign in to \{gated\}/);
    // It must NOT simply disable them, which is what it used to do.
    expect(MENU).toMatch(/setGated\(action\.label\.toLowerCase\(\)\)/);
  });

  it("keeps text chat open when uploads are gated", () => {
    // The 8-minute demo has to remain a usable chat, not a locked shell.
    const DEMO = readFileSync("src/routes/demo.ocade.tsx", "utf8");
    expect(DEMO).toMatch(/signedIn=\{false\}/);
    expect(DEMO, "the composer itself was disabled").not.toMatch(/<ChatComposer[^>]*\sdisabled\b/);
  });
});

describe("the microphone is unmistakable when it is open", () => {
  it("draws the recording ring outside motion-safe, so a motion preference cannot hide it", () => {
    /*
     * The pulse is decorative and respects `prefers-reduced-motion`. The ring
     * is not: losing the "we are recording" indicator to an accessibility
     * preference would be a privacy failure wearing an accessibility badge.
     */
    const ring = /ring-2 ring-\[color:var\(--state-danger\)\]\/60/;
    expect(DICTATE).toMatch(ring);
    const ringLine = DICTATE.split("\n").find((l) => ring.test(l)) ?? "";
    expect(ringLine).not.toMatch(/motion-safe/);
    // And the pulse, separately, does respect it.
    expect(DICTATE).toMatch(/motion-safe:animate-ping/);
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
