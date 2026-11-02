"""Real media engines must not follow nested sources outside the chosen workspace.

All canaries and HTTP endpoints are disposable test data. The control commands
prove the engine and trap work; production workers retain their own flags.
"""

import json
import shutil
import subprocess
import tempfile
import threading
import unittest
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import anyio
from PIL import Image

from ocade_agent.gateway import Gateway
from tests.test_gateway import intent

HAS_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


@unittest.skipUnless(HAS_FFMPEG, "needs real ffmpeg and ffprobe")
class NestedMediaScope(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.canary_folder = tempfile.TemporaryDirectory()
        cls.canary = Path(cls.canary_folder.name) / "outside-canary.ts"
        subprocess.run([
            "ffmpeg", "-nostdin", "-v", "error",
            "-f", "lavfi", "-i", "testsrc2=duration=3:size=160x96:rate=25",
            "-f", "lavfi", "-i", "sine=frequency=523:duration=3",
            "-shortest", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-ac", "2", "-ar", "48000", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-f", "mpegts", str(cls.canary),
        ], check=True, capture_output=True, timeout=45)

    @classmethod
    def tearDownClass(cls):
        cls.canary_folder.cleanup()

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.workspace = Path(self.folder.name)

    def run_steps(self, steps):
        async def run():
            async with Gateway(str(self.workspace)) as gateway:
                return [await gateway.run(intent(operation, arguments), gateway.epoch)
                        for operation, arguments in steps]
        return anyio.run(run)

    def hls(self, source, name=None):
        path = self.workspace / (name or (uuid.uuid4().hex + ".dat"))
        path.write_text(
            "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:3\n"
            "#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:3.0,\n" + source + "\n#EXT-X-ENDLIST\n",
            encoding="utf-8",
        )
        return path.name

    def concat(self):
        # The manifest entry itself is safe and relative; its symlink resolves
        # outside. Guarding only the manifest's path cannot contain this read.
        link = self.workspace / "nested.ts"
        link.symlink_to(self.canary)
        path = self.workspace / (uuid.uuid4().hex + ".ffconcat")
        path.write_text("ffconcat version 1.0\nfile 'nested.ts'\n", encoding="utf-8")
        return path.name

    def serve_canary(self):
        requests = []
        lock = threading.Lock()
        body = self.canary.read_bytes()
        route = "/" + uuid.uuid4().hex + ".ts"

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                with lock:
                    requests.append(self.path)
                if self.path != route:
                    self.send_response(404)
                    self.end_headers()
                    return
                self.send_response(200)
                self.send_header("content-type", "video/mp2t")
                self.send_header("content-length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(thread.join, 3)
        self.addCleanup(server.shutdown)
        return f"http://127.0.0.1:{server.server_port}" + route, requests, lock

    def assert_refused(self, result):
        self.assertEqual(result["status"], "not_applied", result)
        self.assertIs(result["maybeChanged"], False, result)
        self.assertIn("errorCode", result)
        self.assertNotIn("streams", result["evidence"], "outside canary facts must never be returned")

    def test_real_inside_media_stays_usable_without_modifying_original(self):
        inside = self.workspace / "inside.ts"
        shutil.copyfile(self.canary, inside)
        before = inside.read_bytes()
        inspected, trimmed, verified = self.run_steps([
            ("media.inspect", {"path": inside.name}),
            ("media.trim", {"source": inside.name, "start": 0.25, "end": 1.25,
                            "output": "OCADE output/inside.mp4"}),
            ("verify.checks", {"checks": [
                {"id": "inside_duration", "description": "The original has three seconds",
                 "kind": "media_duration", "params": {"path": inside.name, "value": 3.0}},
                {"id": "wrong_duration", "description": "A measurable wrong duration must fail",
                 "kind": "media_duration", "params": {"path": inside.name, "value": 30.0}},
            ]}),
        ])
        self.assertEqual(inspected["status"], "observed", inspected)
        self.assertTrue(any(stream.get("width") == 160 and stream.get("height") == 96
                            for stream in inspected["evidence"]["streams"]), inspected)
        self.assertEqual(trimmed["status"], "observed", trimmed)
        self.assertGreater((self.workspace / "OCADE output/inside.mp4").stat().st_size, 0)
        self.assertEqual(verified["evidence"]["predicates"],
                         {"inside_duration": True, "wrong_duration": False}, verified)
        self.assertEqual(inside.read_bytes(), before)

    def test_hls_and_relative_concat_cannot_reveal_outside_canary(self):
        for kind in ("hls", "concat"):
            with self.subTest(kind=kind):
                source = self.hls(self.canary.as_uri()) if kind == "hls" else self.concat()
                control = subprocess.run([
                    "ffprobe", "-v", "error", "-show_entries", "stream=width,height",
                    "-of", "json", str(self.workspace / source),
                ], check=True, capture_output=True, text=True, timeout=15)
                self.assertTrue(any(stream.get("width") == 160
                                    for stream in json.loads(control.stdout)["streams"]),
                                "the real unconfined engine control must read the outside canary")
                [result] = self.run_steps([("media.inspect", {"path": source})])
                self.assert_refused(result)

    def test_nested_source_cannot_be_copied_into_a_trimmed_deliverable(self):
        source = self.hls(self.canary.as_uri())
        output = self.workspace / "OCADE output/leaked.mp4"
        [result] = self.run_steps([("media.trim", {
            "source": source, "start": 0.25, "end": 1.25, "output": "OCADE output/leaked.mp4",
        })])
        self.assert_refused(result)
        self.assertFalse(output.exists(), "outside canary frames must not be published as a deliverable")
        if output.parent.exists():
            self.assertEqual(list(output.parent.glob(".ocade-*")), [])

    def test_verifier_does_not_prove_predicates_from_outside_nested_media(self):
        sources = (self.hls(self.canary.as_uri()), self.concat())
        checks = []
        for index, source in enumerate(sources):
            checks.extend([
                {"id": f"duration_{index}", "description": "No outside duration proof",
                 "kind": "media_duration", "params": {"path": source, "value": 3.0}},
                {"id": f"quality_{index}", "description": "No outside media quality proof",
                 "kind": "media_quality", "params": {"path": source, "value": 3.0,
                                                     "width": 160, "height": 96}},
            ])
        [result] = self.run_steps([("verify.checks", {"checks": checks})])
        self.assertEqual(result["status"], "observed", result)
        self.assertEqual(result["evidence"]["predicates"], {check["id"]: None for check in checks}, result)

    def test_literal_overlay_filename_is_not_an_outside_image_sequence(self):
        inside = self.workspace / "inside.ts"
        shutil.copyfile(self.canary, inside)
        literal = self.workspace / "overlay%02d.png"
        Image.new("RGB", (320, 240), (0, 220, 0)).save(literal)
        original = literal.read_bytes()
        outside = Path(self.canary_folder.name) / (uuid.uuid4().hex + ".png")
        Image.new("RGB", (320, 240), (240, 0, 0)).save(outside)
        canary_bytes = outside.read_bytes()
        (self.workspace / "overlay00.png").symlink_to(outside)
        [result] = self.run_steps([("media.render_timeline", {
            "output": "OCADE output/overlay.mp4", "duration": 1,
            "clips": [{"source": inside.name, "in": 0, "out": 1, "audio": False}],
            "width": 320, "height": 240, "fps": 25,
            "overlays": [{"image": literal.name, "start": 0, "end": 1, "width": 320,
                          "x": 0.5, "y": 0.5, "fadeIn": 0, "fadeOut": 0}],
        })])
        self.assertEqual(result["status"], "observed", result)
        decoded = subprocess.run([
            "ffmpeg", "-nostdin", "-v", "error", "-ss", "0.5",
            "-i", str(self.workspace / "OCADE output/overlay.mp4"),
            "-frames:v", "1", "-vf", "scale=1:1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-",
        ], check=True, capture_output=True, timeout=15).stdout
        self.assertEqual(len(decoded), 3)
        red, green, blue = decoded
        self.assertGreater(green, red + 100, "the literal inside green raster must win over outside red sequence")
        self.assertGreater(green, blue + 100)
        self.assertEqual(literal.read_bytes(), original)
        self.assertEqual(outside.read_bytes(), canary_bytes)

    def test_active_image_formats_are_not_selected_as_passive_rasters(self):
        # Harmless EPS fixture. Never disable interpreter safety or access any
        # customer file; acceptance here only proves an active decoder format was selected.
        source = self.workspace / "active.eps"
        source.write_text(
            "%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 16 16\n"
            "0 0 1 setrgbcolor 0 0 16 16 rectfill\nshowpage\n%%EOF\n",
            encoding="ascii",
        )
        before = source.read_bytes()
        inspected, previewed = self.run_steps([
            ("media.inspect", {"path": source.name}),
            ("media.preview", {"path": source.name}),
        ])
        self.assert_refused(inspected)
        self.assert_refused(previewed)
        self.assertEqual(source.read_bytes(), before)

    def test_loopback_nested_fetch_has_zero_hits_with_a_real_engine_control(self):
        url, requests, lock = self.serve_canary()
        # Independent direct controls establish an actual reachable trap and
        # decodable media. They are not the production worker under test.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(url, timeout=5) as response:
            self.assertEqual(response.read(), self.canary.read_bytes())
        control = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "json", url,
        ], check=True, capture_output=True, text=True, timeout=15)
        self.assertTrue(any(stream.get("width") == 160 for stream in json.loads(control.stdout)["streams"]))
        with lock:
            self.assertGreaterEqual(len(requests), 2, "the real controls must reach the trap")
            requests.clear()

        source = self.hls(url)
        inspected, trimmed, verified = self.run_steps([
            ("media.inspect", {"path": source}),
            ("media.trim", {"source": source, "start": 0.25, "end": 1.25,
                            "output": "OCADE output/network.mp4"}),
            ("verify.checks", {"checks": [{
                "id": "network", "description": "No private network media proof",
                "kind": "media_duration", "params": {"path": source, "value": 3.0},
            }]}),
        ])
        with lock:
            self.assertEqual(requests, [], "no product request may reach the loopback canary")
        self.assert_refused(inspected)
        self.assert_refused(trimmed)
        self.assertIsNone(verified["evidence"]["predicates"]["network"], verified)
        self.assertFalse((self.workspace / "OCADE output/network.mp4").exists())


if __name__ == "__main__":
    unittest.main()
