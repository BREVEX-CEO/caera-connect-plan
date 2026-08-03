import { describe, it, expect } from "vitest";
import {
  redactSpokenSecrets,
  redactForSpeech,
  redactBeforeCloud,
  safeRedactionMetadata,
  REDACTION_MASK,
  SPOKEN_MASK,
} from "../voice/transcript-redaction";

/**
 * Protected-speech redaction. One shared redactor for microphone transcripts,
 * captions, stored transcripts, voice history, audit records, TTS output,
 * mobile voice messages and exports.
 *
 * The suite is split in two halves that pull against each other on purpose:
 * secrets MUST be caught, and ordinary speech MUST survive intact.
 */

const r = (s: string) => redactSpokenSecrets(s);
const masked = (s: string) => r(s).text;

describe("cued secrets are redacted, cue word kept", () => {
  it("masks a spoken OTP but keeps the sentence readable", () => {
    const out = r("My one-time code is 402913, please use it.");
    expect(out.text).toBe(`My one-time code is ${REDACTION_MASK}, please use it.`);
    expect(out.categories).toContain("otp");
  });

  it("masks a short PIN because the cue makes it protected", () => {
    expect(masked("The PIN is 4417")).toBe(`The PIN is ${REDACTION_MASK}`);
  });

  it("masks a spoken password value after an explicit 'is'", () => {
    const out = r("my password is hunter2");
    expect(out.text).toBe(`my password is ${REDACTION_MASK}`);
    expect(out.categories).toContain("password");
  });

  it("masks a value after a colon separator", () => {
    expect(masked("passcode: swordfish")).toBe(`passcode: ${REDACTION_MASK}`);
  });

  it("masks digits spoken as words after a cue", () => {
    expect(masked("my pin is four four one seven")).toBe(`my pin is ${REDACTION_MASK}`);
  });

  it("covers CVV, recovery codes, API keys, tokens and auth answers", () => {
    expect(r("cvv 419").categories).toContain("cvv");
    expect(r("my recovery code is 8842").categories).toContain("recovery-code");
    expect(r("api key = abcd1234efgh").categories).toContain("api-key");
    expect(r("access token is zzzyyy").categories).toContain("access-token");
    expect(r("my mother's maiden name is Fairbanks").categories).toContain("auth-answer");
  });

  it("does not match a cue inside a longer word", () => {
    expect(masked("He pinned the note to the board")).toBe("He pinned the note to the board");
  });

  it("leaves a cue with no value alone", () => {
    expect(masked("I need to reset my password")).toBe("I need to reset my password");
  });

  it("does not swallow the next word when there is no assignment signal", () => {
    // "I forgot my password yesterday" — nothing was disclosed.
    expect(masked("I forgot my password yesterday")).toBe("I forgot my password yesterday");
  });
});

describe("uncued secrets are redacted by shape alone", () => {
  it("masks spaced spoken digits", () => {
    expect(masked("the code is 4 0 2 9 1 3")).toContain(REDACTION_MASK);
    expect(masked("4 0 2 9 1 3")).toBe(REDACTION_MASK);
  });

  it("masks a spoken digit-by-digit run with no cue at all", () => {
    const out = r("four zero two nine one three");
    expect(out.text).toBe(REDACTION_MASK);
    expect(out.categories).toContain("spoken-digits");
  });

  it("masks a grouped card number", () => {
    const out = r("4111 1111 1111 1111");
    expect(out.text).toBe(REDACTION_MASK);
    expect(out.categories).toContain("card");
  });

  it("masks a social security number shape", () => {
    expect(r("123-45-6789").categories).toContain("ssn");
  });

  it("masks any contiguous run of six or more digits", () => {
    expect(masked("call back on 8675309")).toBe(`call back on ${REDACTION_MASK}`);
  });

  it("masks a JWT, an sk- API key and an AWS key id", () => {
    expect(r("token eyJhbGciOi.eyJzdWIiOi.SflKxwRJSM").categories).toContain("access-token");
    expect(r("sk-abcdefghijklmnopqrstuvwx").categories).toContain("api-key");
    expect(r("AKIAIOSFODNN7EXAMPLE").categories).toContain("api-key");
  });

  it("masks a PEM private key block whole", () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKC\n-----END RSA PRIVATE KEY-----";
    const out = r(`here it is ${pem} done`);
    expect(out.text).toBe(`here it is ${REDACTION_MASK} done`);
    expect(out.text).not.toContain("MIIEowIBAAKC");
  });

  it("mixes spoken and numeric protected values in one utterance", () => {
    const out = r("my pin is four four one seven and the card is 4111 1111 1111 1111");
    expect(out.text).not.toMatch(/four four one seven/);
    expect(out.text).not.toContain("4111");
    expect(out.redactionCount).toBeGreaterThanOrEqual(2);
  });
});

describe("harmless speech survives (false-positive resistance)", () => {
  const harmless = [
    "The quarterly report shows revenue rose in three regions.",
    "In 2024 we shipped 12 features and hired 4 people.",
    "The years 2024 2025 2026 were the strongest.",
    "Meet me at 3 pm on the 21st of March.",
    "It costs 45 dollars and weighs 1200 grams.",
    "There are one or two things left to do.",
    "Chapter 12 covers the first 40 pages.",
  ];

  for (const line of harmless) {
    it(`leaves untouched: ${line}`, () => {
      const out = r(line);
      expect(out.text).toBe(line);
      expect(out.redactionCount).toBe(0);
      expect(out.categories).toEqual([]);
    });
  }

  it("does not treat a four-digit year as a code", () => {
    expect(masked("It happened in 1999")).toBe("It happened in 1999");
  });
});

describe("text-to-speech refuses to read secrets aloud", () => {
  it("uses a spoken mask, not bracket punctuation", () => {
    const out = redactForSpeech("your one-time code is 402913");
    expect(out.text).toBe(`your one-time code is ${SPOKEN_MASK}`);
    expect(out.text).not.toContain("[");
    expect(out.containedProtected).toBe(true);
  });

  it("reports clean speech as safe and unchanged", () => {
    const out = redactForSpeech("The build finished successfully.");
    expect(out.containedProtected).toBe(false);
    expect(out.text).toBe("The build finished successfully.");
  });

  it("never leaves the secret digits in what would be spoken", () => {
    expect(redactForSpeech("read back 4 0 2 9 1 3").text).not.toMatch(/\d/);
  });
});

describe("audit, history and cloud surfaces keep metadata only", () => {
  it("exposes category and count without the value", () => {
    const meta = safeRedactionMetadata(r("my password is hunter2 and pin is 4417"));
    expect(meta.redactionCount).toBe(2);
    expect(meta.categories).toContain("password");
    expect(JSON.stringify(meta)).not.toContain("hunter2");
    expect(JSON.stringify(meta)).not.toContain("4417");
  });

  it("redacts locally before anything is sent to a cloud provider", () => {
    const out = redactBeforeCloud("transcribe this: my otp is 402913");
    expect(out.containedProtected).toBe(true);
    expect(out.text).not.toContain("402913");
  });

  it("categories are sorted and de-duplicated for stable audit records", () => {
    const out = r("pin is 1111 and pin is 2222");
    expect(out.categories).toEqual(["pin"]);
    expect(out.redactionCount).toBe(2);
  });
});

describe("casing, punctuation and spacing do not defeat redaction", () => {
  it("matches cues in any case", () => {
    expect(masked("MY PASSWORD IS Hunter2")).toBe(`MY PASSWORD IS ${REDACTION_MASK}`);
    expect(masked("My Otp Is 402913")).toBe(`My Otp Is ${REDACTION_MASK}`);
  });

  it("survives surrounding punctuation", () => {
    expect(masked("(pin 4417)")).toBe(`(pin ${REDACTION_MASK})`);
    expect(masked("otp: 402913.")).toBe(`otp: ${REDACTION_MASK}.`);
    expect(masked('He said "my pin is 4417", loudly.')).not.toContain("4417");
  });

  it("survives irregular whitespace between cue and value", () => {
    expect(masked("otp    is    402913")).toContain(REDACTION_MASK);
    expect(masked("pin\tis\t4417")).not.toContain("4417");
  });

  it("redacts every occurrence when a value repeats", () => {
    const out = r("pin 1111, again pin 1111, once more pin 1111");
    expect(out.text).not.toContain("1111");
    expect(out.redactionCount).toBe(3);
    expect(out.categories).toEqual(["pin"]);
  });

  it("handles several different secret kinds in one utterance", () => {
    const out = r("password is swordfish, my cvv 419, card 4111 1111 1111 1111");
    expect(out.text).not.toContain("swordfish");
    expect(out.text).not.toContain("419");
    expect(out.text).not.toContain("4111");
    expect(out.categories).toEqual(expect.arrayContaining(["password", "cvv", "card"]));
  });
});

describe("structured data that must NOT be mistaken for a secret", () => {
  const safe = [
    "Upgrade to version 1.2.3 before Friday.",
    "The release date is 2026-07-27 as planned.",
    "It measures 1200 by 800 millimetres.",
    "Section 4.5.6 explains the rule.",
    "We reached 99.9 percent uptime.",
    "The temperature dropped to -12 degrees.",
  ];
  for (const line of safe) {
    it(`leaves untouched: ${line}`, () => {
      expect(r(line).redactionCount).toBe(0);
      expect(r(line).text).toBe(line);
    });
  }
});

describe("honest scope: spoken-number words are English-only", () => {
  it("catches the English spoken digit run", () => {
    expect(r("four zero two nine one three").redactionCount).toBe(1);
  });

  it("does NOT claim to catch other languages' number words", () => {
    // "cuatro cero dos nueve uno tres" is a Spanish digit run. The redactor is
    // English-only today, so it does not fire. This asserts the REAL, honest
    // limitation rather than pretending multilingual coverage exists; the
    // numeric forms below still protect non-English speakers who say digits.
    const out = r("cuatro cero dos nueve uno tres");
    expect(out.redactionCount).toBe(0);
  });

  it("still protects non-English speech that contains numeric or cued forms", () => {
    expect(r("mi código es 402913").redactionCount).toBeGreaterThan(0);
    expect(r("mein PIN ist 4417").text).not.toContain("4417");
  });
});

describe("receipts, exports and mobile messages reuse the same redactor", () => {
  it("an evidence receipt carries the masked line and safe metadata only", () => {
    const spoken = "confirm my otp 402913 to continue";
    const red = redactSpokenSecrets(spoken);
    const receipt = {
      step: "voice.confirm",
      transcript: red.text,
      ...safeRedactionMetadata(red),
    };
    expect(JSON.stringify(receipt)).not.toContain("402913");
    expect(receipt.redactionCount).toBe(1);
    expect(receipt.categories).toContain("otp");
  });

  it("an exported transcript is masked before it leaves the device", () => {
    const lines = ["Agent: what is the code?", "User: my code is 402913"];
    const exported = lines.map((l) => redactSpokenSecrets(l).text).join("\n");
    expect(exported).not.toContain("402913");
    expect(exported).toContain("Agent: what is the code?");
  });

  it("a mobile voice message is masked before synchronisation", () => {
    const out = redactBeforeCloud("voice note: card 4111 1111 1111 1111");
    expect(out.containedProtected).toBe(true);
    expect(out.text).not.toContain("4111");
  });
});

describe("wired into every production speech surface (reachability guard)", () => {
  const read = async (rel: string) =>
    (await import("node:fs")).readFileSync(new URL(rel, import.meta.url), "utf8");

  it("the chat route redacts BOTH the microphone transcript and read-aloud", async () => {
    const src = await read("../../routes/_authenticated/ocade.tsx");
    expect(src).toContain("voice/transcript-redaction");
    // Microphone: the draft that feeds the composer, the model and storage.
    expect(src).toContain("redactSpokenSecrets(final)");
    expect(src).toContain("redactSpokenSecrets(interim)");
    expect(src).toMatch(/setDraft\(\(d\) => \(d \? d \+ " " : ""\) \+ safeFinal\)/);
    // Text-to-speech: never read a secret out loud.
    expect(src).toContain("redactForSpeech(stripCitationMarkers(raw))");
  });

  it("the voice settings preview also speaks through the redactor", async () => {
    const src = await read("../../routes/_authenticated/settings.voice.tsx");
    expect(src).toContain("voice/transcript-redaction");
    expect(src).toContain("redactForSpeech(");
  });

  it("no speech surface constructs an utterance from unredacted text", async () => {
    for (const rel of [
      "../../routes/_authenticated/ocade.tsx",
      "../../routes/_authenticated/settings.voice.tsx",
    ]) {
      const src = await read(rel);
      // Every SpeechSynthesisUtterance argument must trace back to a redacted
      // value: either `text` (assigned from redactForSpeech) or a direct call.
      const utterances = src.match(/new SpeechSynthesisUtterance\(([^)]*)/g) ?? [];
      expect(utterances.length).toBeGreaterThan(0);
      for (const u of utterances) {
        expect(u).toMatch(/redactForSpeech|\btext\b/);
      }
    }
  });
});

describe("total and deterministic", () => {
  it("returns the same output for the same input", () => {
    const line = "my otp is 402913";
    expect(r(line).text).toBe(r(line).text);
  });

  it("handles empty and non-string input without throwing", () => {
    expect(r("").text).toBe("");
    // @ts-expect-error deliberate wrong type
    expect(() => redactSpokenSecrets(null)).not.toThrow();
    // @ts-expect-error deliberate wrong type
    expect(redactSpokenSecrets(undefined).text).toBe("");
  });

  it("does not mutate its input", () => {
    const line = "my pin is 4417";
    r(line);
    expect(line).toBe("my pin is 4417");
  });
});
