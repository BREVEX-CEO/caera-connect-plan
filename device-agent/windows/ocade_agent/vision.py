"""Image-based target checks for the last-resort click (concept 36, readiness visual_grounding).

`ui.inspect` remembers the window image the planner saw. Before `ui.click_point` acts, the
window is captured again and the small patch around the chosen point is matched against
what was seen: an exact match clicks; a small shift (scrolling, a moved panel) is followed to
the patch's new place; a changed target, an overlay or a resized window is refused. The
confidence is 1 − the mean absolute difference of the best match, in [0, 1].

Pillow compares bounded, downscaled colour patches. A competing match refuses the click.
"""

from __future__ import annotations

import math
import time

from PIL import Image, ImageChops, ImageStat

from .sandbox import Refused

PATCH = 24  # pixels (after downscaling) around the point
SEARCH = 16  # how far the patch may have moved, in the same pixels
SCALE = 2  # downscale factor
MIN_CONFIDENCE = 0.9
MIN_SEPARATION = 0.025
MAX_OBSERVATION_AGE = 120
MAX_OBSERVATIONS = 8


def remember(cache: dict, key: str, shot: Image.Image) -> None:
    cache.pop(key, None)
    if len(cache) >= MAX_OBSERVATIONS:
        cache.pop(next(iter(cache)))
    cache[key] = (time.monotonic(), shot)


def last_observation(cache: dict, key: str) -> Image.Image:
    captured = cache.get(key)
    if captured is None:
        raise Refused("inspect_first")
    timestamp, shot = captured
    if time.monotonic() - timestamp > MAX_OBSERVATION_AGE:
        cache.pop(key, None)
        raise Refused("stale_image")
    return shot


def changed(before: Image.Image, after: Image.Image) -> bool:
    return before.size != after.size or ImageChops.difference(before.convert("RGB"), after.convert("RGB")).getbbox() is not None


def _small(image: Image.Image) -> Image.Image:
    small = image.convert("RGB")
    return small.resize((max(1, small.width // SCALE), max(1, small.height // SCALE)))


def match(seen: Image.Image, now: Image.Image, x: float, y: float) -> dict:
    """Where the patch the planner pointed at (x, y as window fractions in `seen`) is in `now`.

    Returns {confidence, x, y, reason?}: the corrected fractions when the patch moved a little,
    and a reason when the click must not happen (resized window or confidence below the bar)."""
    if not all(math.isfinite(value) and 0 <= value <= 1 for value in (x, y)):
        return {"confidence": 0.0, "x": x, "y": y, "reason": "point_out_of_bounds"}
    if seen.size != now.size:
        return {"confidence": 0.0, "x": x, "y": y, "reason": "window_resized"}
    before, after = _small(seen), _small(now)
    cx, cy = round(x * before.width), round(y * before.height)
    half = PATCH // 2
    box = (max(0, cx - half), max(0, cy - half), min(before.width, cx + half), min(before.height, cy + half))
    if box[2] - box[0] < 4 or box[3] - box[1] < 4:
        return {"confidence": 0.0, "x": x, "y": y, "reason": "point_at_edge"}
    if ImageChops.difference(before, after).getbbox() is None:
        return {"confidence": 1.0, "x": x, "y": y}
    patch = before.crop(box)
    if max(ImageStat.Stat(patch).stddev) < 3:
        return {"confidence": 0.0, "x": x, "y": y, "reason": "target_not_distinct"}

    best = (1.0, 0, 0)
    candidates = []
    for dy in range(-SEARCH, SEARCH + 1):
        for dx in range(-SEARCH, SEARCH + 1):
            moved = (box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy)
            if moved[0] < 0 or moved[1] < 0 or moved[2] > after.width or moved[3] > after.height:
                continue
            channels = ImageStat.Stat(ImageChops.difference(patch, after.crop(moved))).mean
            difference = sum(channels) / (255 * len(channels))
            if difference < best[0]:
                best = (difference, dx, dy)
            if difference <= 1 - MIN_CONFIDENCE:
                candidates.append((difference, dx, dy))
    confidence = round(1 - best[0], 4)
    result = {"confidence": confidence, "x": round(x + best[1] / before.width, 6),
              "y": round(y + best[2] / before.height, 6)}
    if 1 - best[0] < MIN_CONFIDENCE:
        result["reason"] = "target_changed"
    elif any(difference - best[0] < MIN_SEPARATION and math.hypot(dx - best[1], dy - best[2]) > PATCH / 4
             for difference, dx, dy in candidates):
        result["reason"] = "target_ambiguous"
    return result

