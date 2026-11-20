/**
 * Anti-Scam Guardian (28.2.6): explainable signs with evidence for look-alike domains, punycode,
 * bare IPs, gift-card/crypto/wire demands, urgent verification and changed payment details; the
 * real brand's own domain and an ordinary page raise nothing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { flaggedSites, scamSigns } from "../../src/lib/jarvis/scam.ts";

test("look-alike, punycode and bare-IP addresses are flagged; real ones are not", () => {
  assert.match(scamSigns("https://paypal-secure-login.com/x", "")[0]!.sign, /looks like paypal/);
  assert.match(scamSigns("https://micros0ft-support.net", "")[0]!.sign, /looks like microsoft/);
  assert.ok(
    scamSigns("https://xn--pypal-4ve.com", "").some((s) => /internationalised/.test(s.sign)),
  );
  assert.ok(scamSigns("https://203.0.113.9/login", "").some((s) => /IP address/.test(s.sign)));
  assert.deepEqual(scamSigns("https://www.paypal.com/signin", "Log in to PayPal"), []);
  assert.deepEqual(scamSigns("https://login.microsoftonline.com/", ""), []);
  assert.deepEqual(scamSigns("https://example.com/", "Opening hours and prices."), []);
});

test("payment pressure and a payee swap in page text are flagged with the evidence", () => {
  const signs = scamSigns(
    "https://vendor.example/invoice",
    "Please note our NEW BANK DETAILS below. Pay with Google Play cards within the day.",
  );
  assert.deepEqual(
    signs.map((s) => s.sign),
    ["asks for gift cards", "changed payment details"],
  );
  assert.equal(signs[1]!.evidence, "NEW BANK DETAILS");
  const urgent = scamSigns("https://x.example", "Verify your account within 24 hours or lose it");
  assert.equal(urgent[0]!.sign, "urgent account verification");
});

test("only pages this task opened, grouped by site", () => {
  const flagged = flaggedSites([
    {
      intent: { operation: "web.read", target: { site: "vendor.example" } },
      receipt: { evidence: { url: "https://vendor.example/a", text: "wire the money today" } },
    },
    {
      intent: { operation: "fs.read_text" },
      receipt: { evidence: { text: "gift cards" } },
    },
  ]);
  assert.deepEqual([...flagged.keys()], ["vendor.example"]);
});
