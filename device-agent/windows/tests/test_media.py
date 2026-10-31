"""IMG-001 / VID-001, native trimming, timeline editing and 3D scene rendering,
through the real gateway and workers, each checked by the separate verifier.

Image *understanding* (describing content, reading text) needs a vision model and
is not covered here: only technical facts are. Web video editors are not covered.
"""

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import anyio
from PIL import Image

from ocade_agent.gateway import Gateway
from tests import web_fixture
from tests.test_web import BROWSER, intent

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
    def test_preview_lets_the_planner_see_images_and_video(self):
        import base64
        import io

        Image.new("RGB", (3840, 2160), (180, 10, 10)).save(self.root / "big.png")
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=duration=6:size=640x360:rate=25",
                        str(self.root / "clip.mp4")], check=True)
        image, video, picked, missing = self.run_all([
            ("media.preview", {"path": "big.png"}),
            ("media.preview", {"path": "clip.mp4"}),
            ("media.preview", {"path": "clip.mp4", "at": [1, 4.5]}),
            ("media.preview", {"path": "nothing.png"}),
        ])
        for result, kind in ((image, "image"), (video, "video"), (picked, "video")):
            self.assertEqual(result["status"], "observed", result)
            self.assertEqual(result["evidence"]["kind"], kind)
            self.assertNotIn("preview", result["evidence"])  # beside the evidence, never inside it
            jpeg = base64.b64decode(result["preview"])
            self.assertLessEqual(len(jpeg), 45_000)
            with Image.open(io.BytesIO(jpeg)) as seen:
                self.assertEqual(seen.format, "JPEG")
        self.assertEqual((image["evidence"]["width"], image["evidence"]["height"]), (3840, 2160))
        self.assertEqual(len(video["evidence"]["frames"]), 9)
        self.assertEqual(picked["evidence"]["frames"], [1.0, 4.5])
        self.assertEqual((missing["status"], missing["errorCode"]), ("not_applied", "not_a_file"))

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

    @unittest.skipUnless(HAS_FFMPEG, "needs ffmpeg and ffprobe")
    def test_timeline_edit_is_exact_and_independently_measured(self):
        for name, pattern, tone in (("a.mp4", "testsrc2", "sine=frequency=110:duration=8"),
                                    ("b.mp4", "smptebars", "anoisesrc=d=8:c=brown:a=0.4")):
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"{pattern}=duration=8:size=640x360:rate=25",
                            "-f", "lavfi", "-i", tone, "-shortest", "-c:v", "libx264", "-c:a", "aac",
                            str(self.root / name)], check=True)
        originals = {n: (self.root / n).read_bytes() for n in ("a.mp4", "b.mp4")}
        edit = {
            "output": "OCADE output/edit.mp4", "duration": 10, "width": 640, "height": 360, "fps": 24,
            "clips": [
                {"source": "a.mp4", "in": 0.5, "out": 6, "grade": {"contrast": 1.1, "saturation": 1.2, "vignette": 0.4},
                 "motion": {"zoomFrom": 1.0, "zoomTo": 1.1, "panX": 0.3}},
                {"source": "b.mp4", "in": 1, "out": 2.5, "speed": 0.5, "transition": {"type": "smoothleft", "duration": 0.6}},
                {"source": "a.mp4", "in": 6, "out": 7},  # a hard cut, then a transition after it
                {"source": "b.mp4", "in": 5, "out": 7, "transition": {"type": "hblur", "duration": 0.3}},
            ],
            "titles": [{"text": "Test: 100% \\ it's 'quoted'", "start": 1, "end": 4, "size": 28, "position": "lower_third"},
                       {"text": "TOP", "start": 6, "end": 9, "size": 28, "position": "top", "font": "DejaVu Sans"}],
            "audio": [
                {"synth": {"kind": "noise", "color": "pink"}, "start": 4.6, "duration": 1.2, "highpass": 400,
                 "fadeIn": 0.6, "fadeOut": 0.5, "gain": -6},
                {"synth": {"kind": "sine", "frequency": 55, "decay": 6}, "start": 5.4, "duration": 1.5},
                {"synth": {"kind": "sine", "frequency": 220}, "start": 0, "duration": 10, "role": "music", "gain": -12},
            ],
            "overlays": [{"image": "card.png", "start": 7.5, "end": 10, "width": 640, "fadeIn": 0.5, "zoomTo": 1.05}],
            "letterbox": 2.39, "fadeIn": 0.5, "fadeOut": 1.0,
        }
        Image.new("RGBA", (400, 200), (220, 20, 20, 255)).save(self.root / "card.png")
        analyze, render, bad_range, bad_place, verify = self.run_all([
            ("media.analyze", {"path": "a.mp4"}),
            ("media.render_timeline", edit),
            ("media.render_timeline", {**edit, "output": "OCADE output/x.mp4", "clips": [{"source": "a.mp4", "in": 0, "out": 30}]}),
            ("media.render_timeline", {**edit, "output": "elsewhere.mp4"}),
            ("verify.checks", {"checks": [
                {"id": "deliverable", "description": "10 s, 640x360", "kind": "media_quality",
                 "params": {"path": "OCADE output/edit.mp4", "value": 10, "width": 640, "height": 360}},
                {"id": "wrong_length", "description": "12 s", "kind": "media_quality",
                 "params": {"path": "OCADE output/edit.mp4", "value": 12, "width": 640, "height": 360}},
                {"id": "too_small", "description": "1080p", "kind": "media_quality",
                 "params": {"path": "OCADE output/edit.mp4", "value": 10, "width": 1920, "height": 1080}},
            ]}),
        ])
        shots = analyze["evidence"]["shots"]
        self.assertTrue(analyze["evidence"]["hasAudio"] and shots and shots[0]["soundDb"] is not None, analyze)
        self.assertEqual(render["status"], "observed", render)
        self.assertEqual(render["evidence"]["frames"], 240)
        self.assertEqual((bad_range["status"], bad_range["errorCode"]), ("not_applied", "clip_out_of_range"))
        # The shared contract now refuses an output outside 'OCADE output/' before any worker runs;
        # the sandbox's own write_outside_output refusal stays as the second layer (test_sandbox).
        self.assertEqual((bad_place["status"], bad_place["errorCode"]), ("not_applied", "invalid_intent"))
        self.assertEqual(verify["evidence"]["predicates"], {"deliverable": True, "wrong_length": False, "too_small": False})
        self.assertEqual({n: (self.root / n).read_bytes() for n in originals}, originals)
        # The card is composited only inside its window: absent at 5 s, centred red at 9 s.
        def pixel(at, row=180):
            frame = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(at), "-i", str(self.root / "OCADE output/edit.mp4"),
                                    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
            at_pixel = (row * 640 + 320) * 3
            return tuple(frame[at_pixel:at_pixel + 3])
        self.assertGreater(pixel(9)[0], 150)
        self.assertNotEqual(pixel(5), pixel(9))
        self.assertLess(max(pixel(9, row=30)), 30)  # the letterbox stays on top of a full-frame image

    @unittest.skipUnless(BROWSER, "needs a Chromium executable")
    def test_scene_render_is_bound_to_its_saved_project(self):
        os.environ["OCADE_BROWSER_EXECUTABLE"] = web_fixture.browser_wrapper(BROWSER, "none")
        # A display that is not there must not matter to a headless render.
        self.addCleanup(os.environ.__setitem__, "DISPLAY", os.environ.get("DISPLAY", ""))
        os.environ["DISPLAY"] = ":77"
        scene = {
            "camera": {"position": [3, 1.5, 4], "target": [0, 0.4, 0], "fov": 40},
            "environment": {"sky": [[0.1, 0.1, 0.12], [0.4, 0.4, 0.45]],
                            "floor": {"color": [0.1, 0.1, 0.1], "roughness": 0.4, "reflectance": 0.1}},
            "lights": [{"kind": "sun", "direction": [0.3, 1, 0.2], "color": [1, 1, 1], "intensity": 3}],
            "materials": [{"id": "paint", "color": [0.7, 0.05, 0.05], "clearcoat": 1, "roughness": 0.3}],
            "parts": [{"id": "body", "shapes": [
                {"shape": "box", "size": [1, 0.3, 0.5], "round": 0.1, "material": "paint", "position": [0, 0.4, 0]},
                {"shape": "sphere", "size": [0.3], "op": "subtract", "position": [1, 0.6, 0]}]}],
            "render": {"width": 96, "height": 54, "samples": 1},
        }
        render, broken, verify = self.run_all([
            ("scene.render", {"scene": scene, "output": "OCADE output/still.png", "project": "OCADE output/scene.json"}),
            ("scene.render", {"scene": {**scene, "render": {"samples": 1}}, "output": "OCADE output/y.png",
                              "project": "OCADE output/y.json"}),
            ("verify.checks", {"checks": [
                {"id": "bound", "description": "from its scene", "kind": "scene_render", "params": {"path": "OCADE output/still.png"}},
                {"id": "size", "description": "96x54", "kind": "image_size",
                 "params": {"path": "OCADE output/still.png", "width": 96, "height": 54}},
            ]}),
        ])
        self.assertEqual(render["status"], "observed", render)
        self.assertEqual((render["evidence"]["shapes"], render["evidence"]["materials"]), (2, 1))
        self.assertEqual((broken["status"], broken["errorCode"]), ("not_applied", "invalid_intent"))
        self.assertEqual(verify["evidence"]["predicates"], {"bound": True, "size": True})
        with Image.open(self.root / "OCADE output/still.png") as still:
            self.assertGreater(len(still.convert("L").getcolors(256)), 20)  # shaded, not a flat fill
        # The project is the editable scene; edited after rendering, the still no longer proves it.
        project = self.root / "OCADE output/scene.json"
        self.assertEqual(json.loads(project.read_text())["parts"][0]["id"], "body")
        project.write_text(project.read_text().replace("0.7", "0.2"))
        [again] = self.run_all([("verify.checks", {"checks": [
            {"id": "bound", "description": "from its scene", "kind": "scene_render", "params": {"path": "OCADE output/still.png"}}]})])
        self.assertEqual(again["evidence"]["predicates"], {"bound": False})


if __name__ == "__main__":
    unittest.main()
