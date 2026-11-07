"""Credentials never leave the computer inside evidence (176); ordinary facts stay exact."""

import tempfile
import unittest
from pathlib import Path

import anyio

from ocade_agent.gateway import Gateway
from ocade_agent.redact import REDACTED, redact, redact_text
from tests.test_gateway import intent

# Built at run time so no credential-shaped literal sits in the repository.
GITHUB = "ghp_" + "a1B2" * 9
AWS = "AKIA" + "ABCDEFGHIJKLMNOP"
JWT = "eyJ" + "hbGciOiJIUzI1NiJ9" + ".eyJ" + "zdWIiOiIxMjM0In0" + "." + "s1gnatureS1gnature"
OPENAI = "sk-" + "proj-" + "x" * 30
PEM = "-----BEGIN " + "PRIVATE KEY-----\nMIIEvQIBADANBg\n-----END " + "PRIVATE KEY-----"


class Patterns(unittest.TestCase):
    def test_credentials_are_replaced(self):
        cases = {
            f"token={GITHUB}": GITHUB, f"key {AWS} here": AWS, f"session {JWT}": JWT,
            f"OPENAI_API_KEY={OPENAI}": OPENAI, f"cert:\n{PEM}\nend": "MIIEvQIBADANBg",
            "Authorization: Bearer abc.def-ghi": "abc.def-ghi", "password = hunter22": "hunter22",
            '{"client_secret": "s3cr3tvalue"}': "s3cr3tvalue",
            "git clone https://alice:pa55word@example.test/repo.git": "pa55word",
        }
        for text, secret in cases.items():
            cleaned, count = redact_text(text)
            self.assertNotIn(secret, cleaned, text)
            self.assertIn(REDACTED, cleaned, text)
            self.assertGreaterEqual(count, 1, text)
        self.assertIn("Authorization:", redact_text("Authorization: Bearer abc.def-ghi")[0], "the label stays readable")

    def test_ordinary_facts_stay_exact(self):
        for text in ("sha256 " + "ab12" * 16, "task 0f8e3b2a-1c4d-4e5f-8a9b-0c1d2e3f4a5b",
                     "Reset your password from the account page.", "total 3048.92 rows=7",
                     "https://example.test/path?x=1", "secret garden chapter 3"):
            self.assertEqual(redact_text(text), (text, 0), text)

    def test_nested_values_are_copied_not_changed(self):
        evidence = {"text": f"a {GITHUB}", "lines": [f"b {AWS}", 3], "n": 4}
        cleaned, count = redact(evidence)
        self.assertEqual(count, 2)
        self.assertEqual(cleaned["n"], 4)
        self.assertIn(GITHUB, evidence["text"], "the original object is not modified")


class GatewayBoundary(unittest.TestCase):
    def test_a_read_file_secret_never_reaches_the_receipt(self):
        root = Path(tempfile.mkdtemp())
        (root / ".env").write_text(f"DATABASE_URL=postgres://app:pa55word@db.example.test/app\nGITHUB_TOKEN={GITHUB}\nPORT=8080\n")

        async def go():
            async with Gateway(str(root)) as gateway:
                return await gateway.run(intent("fs.read_text", {"path": ".env"}), gateway.epoch)

        receipt = anyio.run(go)
        self.assertEqual(receipt["status"], "observed", receipt)
        text = str(receipt["evidence"])
        self.assertNotIn(GITHUB, text)
        self.assertNotIn("pa55word", text)
        self.assertIn("PORT=8080", text, "the rest of the file is still readable")
        self.assertEqual(receipt["evidence"]["redactedValues"], 2)
        self.assertIn(GITHUB, (root / ".env").read_text(), "the file itself is unchanged")


if __name__ == "__main__":
    unittest.main()
