/**
 * JARVIS's voice (155): an answer is read without Markdown marks or link addresses, in the
 * person's chosen voice, else a natural female-presenting one of the page's language.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { pickVoice, speakable } from "../../src/jarvis/use-voice.ts";

test("an answer is read as words, not Markdown", () => {
  assert.equal(
    speakable("## Done\n**Saved** `report.docx` — see [the folder](file:///C:/x) | ok"),
    "Done Saved report.docx — see the folder ok",
  );
});

test("the person's chosen voice wins; otherwise a matching natural voice", () => {
  const voice = (name: string, lang: string) =>
    ({ name, lang, voiceURI: name }) as unknown as SpeechSynthesisVoice;
  const voices = [
    voice("David", "en-US"),
    voice("Aria Online (Natural)", "en-US"),
    voice("Hortense", "fr-FR"),
  ];
  assert.equal(pickVoice(voices, "David", "en-GB")?.name, "David");
  assert.equal(pickVoice(voices, null, "en-GB")?.name, "Aria Online (Natural)");
  assert.equal(pickVoice([voice("David", "en-US")], null, "en"), null);
});
