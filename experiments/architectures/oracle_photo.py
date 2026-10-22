"""
Independent check of the cinematic photo task (TASK 3), from the files alone.

    python3 oracle_photo.py <workspace> <sha256 of the original lake.jpg>

Pass needs all of: lake.jpg unchanged; lake-cinematic.jpg is this photo, edited (after the best
matching crop and scale, its structure correlates with the original at 0.85 or more: a
generated or replaced picture does not); a cinematic frame (width / height of 1.85 or wider);
a real edit (not the original's tones: mean absolute difference of at least 6 levels after
alignment); highlights kept (under 1% of pixels clipped white); and a before/after image whose
halves match the original and the edit.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def gray(img: Image.Image, size: tuple[int, int]) -> np.ndarray:
    return np.asarray(img.convert("L").resize(size, Image.Resampling.BILINEAR), dtype=np.float32)


def corr(a: np.ndarray, b: np.ndarray) -> float:
    a, b = a - a.mean(), b - b.mean()
    return float((a * b).sum() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-9))


def edges(a: np.ndarray) -> np.ndarray:
    """Structure, not tone: a colour grade changes levels, never where the edges are."""
    return np.hypot(np.diff(a, axis=0)[:, :-1], np.diff(a, axis=1)[:-1, :])


def best_crop(original: Image.Image, edit: Image.Image) -> tuple[float, tuple]:
    """The vertical band of the original (full width, any height and offset) that the edit is."""
    W, H = original.size
    w, h = 320, max(8, round(320 * edit.height / edit.width))
    target = edges(gray(edit, (w, h)))
    best = (-1.0, (0, 0, W, H))
    band = round(W * edit.height / edit.width)  # the original's height at the edit's aspect
    for scale in np.linspace(0.7, 1.0, 13):
        bw, bh = round(W * scale), round(band * scale)
        if bh > H:
            continue
        for x in np.linspace(0, W - bw, 9).astype(int):
            for y in np.linspace(0, H - bh, 25).astype(int):
                box = (int(x), int(y), int(x) + bw, int(y) + bh)
                c = corr(edges(gray(original.crop(box), (w, h))), target)
                if c > best[0]:
                    best = (c, box)
    return best


def check(ws: Path, original_sha: str) -> dict:
    lake, edit_path, pair = ws / "lake.jpg", ws / "lake-cinematic.jpg", ws / "lake-before-after.jpg"
    out: dict = {"originalUnchanged": lake.is_file() and hashlib.sha256(lake.read_bytes()).hexdigest() == original_sha}
    if not edit_path.is_file():
        return {**out, "edit": False, "pass": False}
    original, edit = Image.open(lake).convert("RGB"), Image.open(edit_path).convert("RGB")
    c, box = best_crop(original, edit)
    aligned = np.asarray(original.crop(box).resize(edit.size, Image.Resampling.BILINEAR), dtype=np.float32)
    shown = np.asarray(edit, dtype=np.float32)
    out.update({
        "editSize": edit.size, "aspect": round(edit.width / edit.height, 3),
        "structureCorrelation": round(c, 3), "matchedCrop": box,
        "toneChange": round(float(np.abs(shown - aligned).mean()), 2),
        "clippedWhite": round(float((shown.min(axis=2) >= 254).mean()), 4),
        "meanRGB": [round(float(v), 1) for v in shown.reshape(-1, 3).mean(axis=0)],
        "originalMeanRGB": [round(float(v), 1) for v in aligned.reshape(-1, 3).mean(axis=0)],
    })
    if pair.is_file():
        both = Image.open(pair).convert("RGB")
        half = both.width // 2
        # Each half's middle 80%, so labels, borders and margins around the pictures do not count.
        def middle(x0: int) -> Image.Image:
            return both.crop((x0 + half // 10, both.height // 10, x0 + half - half // 10, both.height - both.height // 10))
        # The "before" may show the whole original or the same crop as the edit.
        same_crop = Image.fromarray(aligned.astype(np.uint8))
        out["beforeAfter"] = {
            "left~original": round(max(best_crop(original, middle(0))[0],
                                       best_crop(same_crop, middle(0))[0]), 3),
            "right~edit": round(best_crop(edit, middle(half))[0], 3),
        }
    ba = out.get("beforeAfter", {})
    out["pass"] = bool(out["originalUnchanged"] and c >= 0.85 and out["aspect"] >= 1.85
                       and out["toneChange"] >= 6 and out["clippedWhite"] < 0.01
                       and ba.get("left~original", 0) >= 0.6 and ba.get("right~edit", 0) >= 0.6)
    return out


if __name__ == "__main__":
    print(json.dumps(check(Path(sys.argv[1]), sys.argv[2]), indent=1))
