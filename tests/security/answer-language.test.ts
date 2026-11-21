/** Answer language: Automatic adds nothing; a choice is one short instruction naming it. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ANSWER_LANGUAGES, languageInstruction } from "../../src/lib/chat/answer-language.ts";

test("one instruction per chosen language, none for Automatic", () => {
  assert.equal(languageInstruction("Automatic"), null);
  assert.match(languageInstruction("हिन्दी (Hindi)") ?? "", /^Answer in Hindi,/);
  assert.match(languageInstruction("English") ?? "", /^Answer in English,/);
  assert.equal(new Set(ANSWER_LANGUAGES).size, ANSWER_LANGUAGES.length);
});
