"""Image-based target checks before a last-resort click (concept 36): the patch the planner
pointed at is found again, followed when it moved a little, and refused when it changed."""

import random
import time
import unittest

from PIL import Image, ImageDraw

from ocade_agent import vision


def window(offset=(0, 0), overlay=False, size=(640, 400)):
    rng = random.Random(7)
    image = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(image)
    for _ in range(60):  # a busy, unlabelled toolbar and canvas
        x, y = rng.randrange(0, size[0] - 40), rng.randrange(0, size[1] - 40)
        draw.rectangle((x + offset[0], y + offset[1], x + offset[0] + rng.randrange(8, 40),
                        y + offset[1] + rng.randrange(8, 40)), fill=tuple(rng.randrange(256) for _ in range(3)))
    if overlay:
        draw.rectangle((200, 120, 460, 300), fill=(30, 30, 30))  # a dialog that appeared since
    return image


class TargetCheck(unittest.TestCase):
    def test_unchanged_target_is_clicked_where_it_was_seen(self):
        result = vision.match(window(), window(), 0.5, 0.5)
        self.assertEqual((result["confidence"], result["x"], result["y"]), (1.0, 0.5, 0.5))
        self.assertNotIn("reason", result)

    def test_a_small_shift_is_followed(self):
        started = time.monotonic()
        result = vision.match(window(), window(offset=(12, -8)), 0.5, 0.5)
        self.assertLess(time.monotonic() - started, 1.0, "a check must be cheap")
        self.assertGreaterEqual(result["confidence"], vision.MIN_CONFIDENCE, result)
        self.assertNotIn("reason", result)
        self.assertAlmostEqual(result["x"], 0.5 + 12 / 640, delta=1 / 320)
        self.assertAlmostEqual(result["y"], 0.5 - 8 / 400, delta=1 / 200)

    def test_two_equivalent_moved_patches_are_not_interchangeable(self):
        rng = random.Random(71)
        patch = Image.new("RGB", (48, 48))
        patch.putdata([tuple(rng.randrange(256) for _ in range(3)) for _ in range(48 * 48)])
        seen = Image.new("RGB", (240, 160))
        seen.paste(patch, (96, 56))
        now = Image.new("RGB", seen.size)
        now.paste(patch, (66, 56))
        now.paste(patch, (126, 56))
        self.assertEqual(vision.match(seen, now, 0.5, 0.5)["reason"], "target_ambiguous")

    def test_a_moved_target_still_has_a_unique_match(self):
        result = vision.match(window(), window(offset=(12, -8)), 0.5, 0.5)
        self.assertNotIn("reason", result)
        self.assertAlmostEqual(result["x"], 0.5 + 12 / 640, delta=1 / 320)
        self.assertAlmostEqual(result["y"], 0.5 - 8 / 400, delta=1 / 200)

    def test_observations_expire_and_cannot_grow_without_bound(self):
        from unittest.mock import patch
        from ocade_agent.sandbox import Refused

        cache = {}
        shot = window()
        with patch.object(vision.time, "monotonic", return_value=1):
            for index in range(vision.MAX_OBSERVATIONS + 1):
                vision.remember(cache, str(index), shot)
            self.assertEqual(len(cache), vision.MAX_OBSERVATIONS)
            self.assertNotIn("0", cache)
            self.assertIs(vision.last_observation(cache, "1"), shot)
        with patch.object(vision.time, "monotonic", return_value=2 + vision.MAX_OBSERVATION_AGE):
            with self.assertRaisesRegex(Refused, "stale_image"):
                vision.last_observation(cache, "1")
        self.assertNotIn("1", cache)

    def test_an_overlay_or_resize_is_refused(self):
        covered = vision.match(window(), window(overlay=True), 0.5, 0.5)
        self.assertEqual(covered["reason"], "target_changed")
        self.assertLess(covered["confidence"], vision.MIN_CONFIDENCE)
        resized = vision.match(window(), window(size=(800, 400)), 0.5, 0.5)
        self.assertEqual(resized["reason"], "window_resized")


if __name__ == "__main__":
    unittest.main()
