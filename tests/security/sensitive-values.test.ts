/**
 * Intelligent Privacy (R12-03): valid card numbers and IBANs become stable placeholders before
 * anything reaches the model, and only this task's own placeholders turn back into the exact
 * values in the step sent to the person's computer. Invalid numbers and other text are untouched.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { maskSensitive, unmaskArguments } from "../../src/lib/jarvis/sensitive-values.ts";

test("card numbers and IBANs are placeholders for the model, exact values for the form", () => {
  const seen = new Map<string, string>();
  const text = "Card 4111 1111 1111 1111, IBAN DE89 3704 0044 0532 0130 00, order 1234567890123.";
  const masked = maskSensitive(text, seen);
  assert.equal(masked.includes("4111"), false);
  assert.equal(masked.includes("DE89"), false);
  assert.match(masked, /Card ⟦card·[0-9a-f]{8}⟧, IBAN ⟦iban·[0-9a-f]{8}⟧, order 1234567890123\./);
  assert.equal(maskSensitive(text, new Map()), masked, "the same value is the same placeholder");
  const [card, iban] = [...seen.keys()];
  const step = unmaskArguments({ selector: "#card", value: card, rows: [[iban]] }, seen);
  assert.deepEqual(step, {
    selector: "#card",
    value: "4111 1111 1111 1111",
    rows: [["DE89 3704 0044 0532 0130 00"]],
  });
  assert.equal(unmaskArguments("⟦card·deadbeef⟧", seen), "⟦card·deadbeef⟧", "only this task's own");
});
