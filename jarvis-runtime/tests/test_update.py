"""Signed updates: only OCADE-signed, checksum-matching, healthy builds switch; failures roll back.

Run: python -m unittest discover -s jarvis-runtime/tests -p 'test_update.py'
"""
import base64
import hashlib
import io
import json
import sys
import tempfile
import unittest
import zipfile
from unittest import mock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ocade_update as up  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402


PROGRAM = up._executable(Path(".")).name  # ocade-agent.exe on Windows


def build(healthy: bool, program: str = PROGRAM) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as bundle:
        info = zipfile.ZipInfo(program)
        info.external_attr = 0o755 << 16
        bundle.writestr(info, "healthy" if healthy else "sick")
    return out.getvalue()


def fake_health(exe: Path) -> bool:
    """The platform's real process launch is replaced by reading the fixture's verdict."""
    return exe.read_text() == "healthy"


class UpdateTest(unittest.TestCase):
    def setUp(self):
        self.key = Ed25519PrivateKey.generate()
        self.public = base64.b64encode(self.key.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
        self.root = Path(tempfile.mkdtemp())
        patcher = mock.patch.object(up, "_health", fake_health)
        patcher.start()
        self.addCleanup(patcher.stop)

    def release(self, version: str, archive: bytes) -> tuple[bytes, str, dict]:
        manifest = json.dumps({"version": version, "platforms": {up.platform_key(): {
            "url": "https://ocade.test/agent/x.zip", "sha256": hashlib.sha256(archive).hexdigest()}}}).encode()
        return manifest, base64.b64encode(self.key.sign(manifest)).decode(), json.loads(manifest)

    def test_refuses_unsigned_tampered_or_unkeyed_releases(self):
        manifest, signature, _ = self.release("1.0.0", build(True))
        with self.assertRaises(up.UpdateRefused):
            up.verify_manifest(manifest, signature, None)
        with self.assertRaises(up.UpdateRefused):
            up.verify_manifest(manifest.replace(b"1.0.0", b"9.9.9"), signature, self.public)
        self.assertEqual(up.verify_manifest(manifest, signature, self.public)["version"], "1.0.0")

    def test_installs_a_healthy_signed_build_and_keeps_one_to_roll_back_to(self):
        for version in ("1.0.0", "1.1.0", "1.2.0"):
            archive = build(True)
            _, _, manifest = self.release(version, archive)
            self.assertEqual(up.install(self.root, manifest, archive), version)
        layout = json.loads((self.root / "current.json").read_text())
        self.assertEqual((layout["current"], layout["previous"]), ("1.2.0", "1.1.0"))
        self.assertEqual(sorted(p.name for p in (self.root / "versions").iterdir()), ["1.1.0", "1.2.0"])

    def test_a_download_that_does_not_match_is_refused(self):
        _, _, manifest = self.release("1.0.0", build(True))
        with self.assertRaises(up.UpdateRefused):
            up.install(self.root, manifest, build(False))

    def test_an_unhealthy_build_never_becomes_current(self):
        good = build(True)
        up.install(self.root, self.release("1.0.0", good)[2], good)
        bad = build(False)
        with self.assertRaises(up.UpdateRefused):
            up.install(self.root, self.release("2.0.0", bad)[2], bad)
        self.assertEqual(json.loads((self.root / "current.json").read_text())["current"], "1.0.0")
        self.assertFalse((self.root / "versions/2.0.0").exists())

    def test_rolls_back_after_repeated_failed_starts(self):
        for version in ("1.0.0", "2.0.0"):
            archive = build(True)
            up.install(self.root, self.release(version, archive)[2], archive)
        self.assertEqual(up.launch_target(self.root).parent.name, "2.0.0")
        up.launch_target(self.root)  # it never reported healthy: second failed start
        self.assertEqual(up.launch_target(self.root).parent.name, "1.0.0")
        up.mark_healthy(self.root)
        self.assertEqual(json.loads((self.root / "current.json").read_text())["failedStarts"], 0)

    def test_a_release_without_the_program_or_a_broken_archive_changes_nothing(self):
        good = build(True)
        up.install(self.root, self.release("1.0.0", good)[2], good)
        for archive in (build(True, program="something-else"), b"not a zip at all"):
            with self.assertRaises(up.UpdateRefused):
                up.install(self.root, self.release("2.0.0", archive)[2], archive)
            self.assertEqual(json.loads((self.root / "current.json").read_text())["current"], "1.0.0")
            self.assertFalse((self.root / "versions/2.0.0").exists())


if __name__ == "__main__":
    unittest.main()
