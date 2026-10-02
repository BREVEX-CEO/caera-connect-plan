"""OCADE's own wake model: one signed authority, cheap when quiet, the same on the phone."""
import base64
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))
import ocade_wake as W  # noqa: E402

REPO = HERE.parents[2]
JAVAC = Path(os.environ.get("JAVA_HOME") or r"C:\Program Files\Android\Android Studio\jbr") / "bin" / (
    "javac.exe" if os.name == "nt" else "javac")


def random_model(path: Path, seed: int = 3) -> None:
    """A model with the shipped layout and random weights: what parity and plumbing need."""
    rng = np.random.default_rng(seed)
    widths, kernels = [W.MELS, 48, 48, 64, 64], [5, 5, 5, 3]
    weights = {}
    for i in range(4):
        weights[f"c{i + 1}.weight"] = rng.normal(0, 0.15, (widths[i + 1], widths[i], kernels[i]))
        weights[f"c{i + 1}.bias"] = rng.normal(0, 0.05, widths[i + 1])
    weights.update({"f1.weight": rng.normal(0, 0.2, (32, 64)), "f1.bias": rng.normal(0, 0.05, 32),
                    "f2.weight": rng.normal(0, 0.2, (1, 32)), "f2.bias": rng.normal(0, 0.05, 1),
                    "mean": rng.normal(-5, 1, W.MELS), "std": rng.uniform(1, 3, W.MELS),
                    "threshold": np.float32(0.5)})
    np.savez(path, **{k: np.asarray(v, dtype=np.float32) for k, v in weights.items()},
             dilations=np.array([1, 2, 4, 8], dtype=np.int32))


class ManifestTest(unittest.TestCase):
    def setUp(self):
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        self.folder = Path(tempfile.mkdtemp())
        random_model(self.folder / "model.npz")
        self.key = Ed25519PrivateKey.generate()
        self.public = base64.b64encode(self.key.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
        self.write({"version": "1.0.0", "phrases": ["OCADE", "Hey OCADE"], "file": "model.npz",
                    "sha256": hashlib.sha256((self.folder / "model.npz").read_bytes()).hexdigest()})

    def write(self, manifest: dict, sign_with=None) -> None:
        body = json.dumps(manifest).encode()
        (self.folder / "manifest.json").write_bytes(body)
        (self.folder / "manifest.sig").write_text(base64.b64encode((sign_with or self.key).sign(body)).decode())

    def test_the_model_runs_only_as_signed(self):
        self.assertEqual(W.verify(self.folder, self.public)["version"], "1.0.0")
        model = self.folder / "model.npz"
        model.write_bytes(model.read_bytes()[:-10] + b"0123456789")
        with self.assertRaisesRegex(W.WakeUnavailable, "damaged"):
            W.verify(self.folder, self.public)

    def test_a_manifest_not_signed_by_ocade_is_refused(self):
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        self.write({"version": "9.9.9", "file": "model.npz", "sha256": "0" * 64}, Ed25519PrivateKey.generate())
        with self.assertRaisesRegex(W.WakeUnavailable, "not OCADE's"):
            W.verify(self.folder, self.public)
        (self.folder / "manifest.json").unlink()
        with self.assertRaisesRegex(W.WakeUnavailable, "not installed"):
            W.verify(self.folder, self.public)

    def test_the_bundled_model_is_ocades(self):
        if not (W.bundled() / "manifest.sig").exists():
            self.skipTest("no wake model exported yet")
        manifest = W.verify()
        self.assertEqual(manifest["phrases"], ["OCADE", "Hey OCADE"])
        self.assertIn("Hugging Face", manifest["provenance"]["notUsed"])


class ListenerTest(unittest.TestCase):
    class Scripted:
        threshold = 0.5

        def __init__(self, scores):
            self.scores = list(scores)

        def score(self, _features):
            return self.scores.pop(0) if self.scores else 0.0

    def test_quiet_costs_nothing_and_one_saying_wakes_once(self):
        now = [0.0]
        woke = []
        model = self.Scripted([0.9, 0.9, 0.9, 0.9, 0.1, 0.9, 0.9])
        listener = W.Listener(model, lambda: woke.append(now[0]), clock=lambda: now[0])
        silence = np.zeros(W.STEP_SAMPLES, dtype=np.float32)
        for _ in range(600):  # a minute of a quiet room
            now[0] += 0.1
            listener.feed(silence)
        self.assertEqual((listener.looked, woke), (0, []))
        speech = (np.sin(np.arange(W.STEP_SAMPLES) / 5) * 0.1).astype(np.float32)
        for _ in range(4):
            now[0] += 0.1
            listener.feed(speech)
        self.assertEqual(len(woke), 1)  # two looks in a row, then two seconds of rest
        for _ in range(25):
            now[0] += 0.1
            listener.feed(speech)
        self.assertEqual(len(woke), 2)
        listener.feed((speech * 32767).astype(np.int16))  # whole-number samples are scaled, not misread


class PhoneParityTest(unittest.TestCase):
    @unittest.skipUnless(JAVAC.exists(), "needs a JDK")
    def test_the_phone_scores_audio_as_the_computer_does(self):
        work = Path(tempfile.mkdtemp())
        random_model(work / "model.npz")
        sha = hashlib.sha256((work / "model.npz").read_bytes()).hexdigest()
        rng = np.random.default_rng(1)
        t = np.arange(W.WINDOW_SAMPLES) / W.SAMPLE_RATE
        windows = np.stack([
            (rng.standard_normal(W.WINDOW_SAMPLES) * 0.05),
            0.2 * np.sin(2 * np.pi * 440 * t) * np.exp(-t),
            0.1 * np.sin(2 * np.pi * (200 + 300 * t) * t) + rng.standard_normal(W.WINDOW_SAMPLES) * 0.01,
        ]).astype(np.float32)
        (work / "windows.f32").write_bytes(windows.astype("<f4").tobytes())
        model = W.Model(work / "model.npz")
        expected = [model.score(W.log_mel(w)) for w in windows]
        classes = work / "classes"
        subprocess.run([str(JAVAC), "-d", str(classes), str(REPO / "android/src/in/ocade/app/WakeModel.java"),
                        str(REPO / "android/test/WakeParity.java")], check=True, capture_output=True)
        java = JAVAC.with_name("java.exe" if os.name == "nt" else "java")
        ran = subprocess.run([str(java), "-cp", str(classes), "WakeParity", str(work / "model.npz"), sha,
                              str(work / "windows.f32")], capture_output=True, text=True)
        self.assertEqual(ran.returncode, 0, ran.stderr[-1500:])
        got = [float(line) for line in ran.stdout.split()]
        np.testing.assert_allclose(got, expected, atol=2e-3)
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
