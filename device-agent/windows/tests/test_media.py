"""IMG-001 / VID-001 and native video trimming, through the real gateway and workers.

Image *understanding* (describing content, reading text) needs a vision model and
is not covered here: only technical facts are. Web video editors are not covered.
"""

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import anyio
from PIL import Image

from ocade_agent.gateway import Gateway
from tests.test_web import intent

HAS_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


class Media(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())

    def run_all(self, steps):
        async def go():
            async with Gateway(str(self.root)) as gateway:
                return [await gateway.run(intent(op, args), gateway.epoch) for op, args in steps]

        return anyio.run(go)

    def test_image_facts(self):
        image = Image.new("RGB", (640, 360), (10, 120, 200))
        exif = Image.Exif()
        exif[274] = 6  # rotated 90°: shown as portrait
        image.save(self.root / "sample.jpg", exif=exif)
        [facts] = self.run_all([("media.inspect", {"path": "sample.jpg"})])
        evidence = facts["evidence"]
        self.assertEqual((evidence["kind"], evidence["format"]), ("image", "JPEG"))
        self.assertEqual((evidence["width"], evidence["height"], evidence["orientation"]), (360, 640, "portrait"))

    @unittest.skipUnless(HAS_FFMPEG, "needs ffmpeg and ffprobe")
    def test_video_inspect_trim_and_verify(self):
        subprocess.run(
            ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=duration=6:size=320x240:rate=25",
             "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-shortest", "-c:v", "libx264", "-c:a", "aac",
             str(self.root / "clip.mp4")],
            check=True,
        )
        original = (self.root / "clip.mp4").read_bytes()
        inspect, trim, verify = self.run_all([
            ("media.inspect", {"path": "clip.mp4"}),
            ("media.trim", {"source": "clip.mp4", "start": 1.0, "end": 3.5, "output": "OCADE output/clip-trimmed.mp4"}),
            ("verify.checks", {"checks": [
                {"id": "trimmed_length", "description": "2.5 s", "kind": "media_duration",
                 "params": {"path": "OCADE output/clip-trimmed.mp4", "value": 2.5}},
                {"id": "wrong_length", "description": "6 s", "kind": "media_duration",
                 "params": {"path": "OCADE output/clip-trimmed.mp4", "value": 6}},
            ]}),
        ])
        facts = inspect["evidence"]
        video = next(s for s in facts["streams"] if s["type"] == "video")
        self.assertAlmostEqual(facts["duration"], 6.0, delta=0.1)
        self.assertEqual((video["codec"], video["width"], video["height"], video["fps"]), ("h264", 320, 240, "25/1"))
        self.assertTrue(any(s["type"] == "audio" for s in facts["streams"]))
        self.assertEqual(trim["status"], "observed", trim)
        self.assertEqual(verify["evidence"]["predicates"], {"trimmed_length": True, "wrong_length": False})
        self.assertEqual((self.root / "clip.mp4").read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
