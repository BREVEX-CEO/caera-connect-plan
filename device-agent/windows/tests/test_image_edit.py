"""Non-destructive image editing (W5): a new image under OCADE output, the original untouched,
each step measurable on the saved file by an independent read."""

import tempfile
import unittest
from pathlib import Path

import anyio
from PIL import Image

from ocade_agent.gateway import Gateway
from ocade_agent.sandbox import sha256
from tests.test_gateway import intent


class ImageEdits(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        photo = Image.new("RGBA", (400, 200), (200, 40, 40, 255))
        for x in range(200, 400):
            for y in range(0, 200, 4):
                photo.putpixel((x, y), (20, 200, 20, 255))
        photo.save(self.root / "photo.png")
        self.before = sha256(self.root / "photo.png")

    def run_all(self, *intents):
        async def go():
            async with Gateway(str(self.root)) as gateway:
                return [await gateway.run(i, gateway.epoch) for i in intents]

        return anyio.run(go)

    def test_steps_apply_in_order_and_the_original_is_untouched(self):
        resized, cropped, gray, captioned = self.run_all(
            intent("image.edit", {"source": "photo.png", "output": "OCADE output/small.jpg",
                                  "steps": [{"op": "resize", "width": 200}]}),
            intent("image.edit", {"source": "photo.png", "output": "OCADE output/left.png",
                                  "steps": [{"op": "crop", "left": 0, "top": 0, "right": 200, "bottom": 200},
                                            {"op": "rotate", "degrees": 90}]}),
            intent("image.edit", {"source": "photo.png", "output": "OCADE output/gray.png",
                                  "steps": [{"op": "grayscale"}, {"op": "brightness", "factor": 1.5}]}),
            intent("image.edit", {"source": "photo.png", "output": "OCADE output/caption.png",
                                  "steps": [{"op": "text", "text": "Draft", "x": 10, "y": 10, "size": 40}]}),
        )
        for result in (resized, cropped, gray, captioned):
            self.assertEqual(result["status"], "observed", result)
            self.assertTrue(result["evidence"]["sourceUnchanged"])
        self.assertEqual(sha256(self.root / "photo.png"), self.before)
        out = self.root / "OCADE output"
        with Image.open(out / "small.jpg") as small:
            self.assertEqual((small.size, small.format, small.mode), ((200, 100), "JPEG", "RGB"))
        with Image.open(out / "left.png") as left:
            self.assertEqual(left.size, (200, 200))
            red, green, *_ = left.convert("RGB").getpixel((100, 100))
            self.assertGreater(red, green, "the crop kept the red half")
        with Image.open(out / "gray.png") as gray_image:
            self.assertEqual(gray_image.mode, "L")
            self.assertGreater(gray_image.getpixel((10, 10)), Image.open(self.root / "photo.png").convert("L").getpixel((10, 10)))
        with Image.open(out / "caption.png") as caption, Image.open(self.root / "photo.png") as original:
            self.assertNotEqual(caption.convert("RGB").crop((0, 0, 120, 60)).tobytes(),
                                original.convert("RGB").crop((0, 0, 120, 60)).tobytes())

    def test_refusals_change_nothing(self):
        (self.root / "notes.txt").write_text("not an image")
        outside, existing, not_image, same = self.run_all(
            intent("image.edit", {"source": "photo.png", "output": "OCADE output/x.png",
                                  "steps": [{"op": "crop", "left": 0, "top": 0, "right": 999, "bottom": 10}]}),
            intent("image.edit", {"source": "photo.png", "output": "OCADE output/y.png", "steps": [{"op": "grayscale"}]}),
            intent("image.edit", {"source": "notes.txt", "output": "OCADE output/z.png", "steps": [{"op": "grayscale"}]}),
            intent("image.edit", {"source": "photo.png", "output": "OCADE output/y.png", "steps": [{"op": "grayscale"}]}),
        )
        self.assertEqual(outside["errorCode"], "crop_outside_image")
        self.assertEqual(existing["status"], "observed")
        self.assertEqual(not_image["errorCode"], "not_an_image")
        self.assertEqual(same["errorCode"], "output_exists")
        self.assertFalse((self.root / "OCADE output" / "x.png").exists())
        self.assertEqual(sha256(self.root / "photo.png"), self.before)


if __name__ == "__main__":
    unittest.main()
