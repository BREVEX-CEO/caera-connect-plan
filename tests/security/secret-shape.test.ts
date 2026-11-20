/** KEY-16: credential shapes in a message are recognised before sending; ordinary text is not. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { secretShape } from "../../src/lib/security/secret-shape.ts";

test("common credential shapes are recognised", () => {
  const fakes: [string, RegExp][] = [
    ["key sk-" + "a".repeat(40), /OpenAI/],
    ["sk-ant-" + "b".repeat(40), /OpenAI/],
    ["AIza" + "c".repeat(35), /Google/],
    ["ghp_" + "d".repeat(36), /GitHub/],
    ["AKIA" + "E".repeat(16), /AWS/],
    ["sk_live_" + "f".repeat(24), /Stripe/],
    ["-----BEGIN RSA PRIVATE KEY-----\nMIIE", /private key/],
  ];
  for (const [text, expected] of fakes) assert.match(secretShape(text) ?? "", expected, text);
});

test("ordinary messages are not flagged", () => {
  for (const text of [
    "Summarise the risk section of my sk report",
    "What does AKIA mean?",
    "My task-list has 40 items",
    "Explain how ghp tokens differ from OAuth apps",
  ]) {
    assert.equal(secretShape(text), null, text);
  }
});
