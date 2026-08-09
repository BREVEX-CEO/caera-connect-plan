"""Pixels, and the text inside them — the fallback when structure is absent.

WHY THIS IS A FALLBACK AND NOT THE MAIN ROUTE
---------------------------------------------
Reading a button from a bitmap means inferring a fact the operating system was
willing to state outright. ``observe.py`` asks it directly. This module exists
for the windows that answer nothing — custom-drawn canvases, games, remote
desktop sessions, Electron apps with a broken accessibility bridge — and for
confirming that something on screen genuinely changed.

ONE WINDOW, NEVER THE DESKTOP
------------------------------
Capture is scoped to a window handle. A desktop capture would sweep in every
other application the user has open, which is both a privacy problem and a
waste: the task concerns one window, and the extra pixels only dilute whatever
looks at them afterwards.

OCR IS REGION-SCOPED WHERE IT CAN BE
-------------------------------------
Running recognition over a full 1920x1080 frame for the sake of one dialog is
slow and returns mostly chrome. Callers may pass a region; the whole-window
path exists for the case where nothing narrower is known yet.
"""

from __future__ import annotations

import asyncio
import hashlib
import time
from typing import Any

import numpy as np
import win32gui

from .protocol import MAX_TEXT, Refusal, clamp_text, is_protected_text

_dxcam_camera = None
_dxcam_failed = False


def _window_bounds(hwnd: int) -> tuple[int, int, int, int]:
    if not win32gui.IsWindow(hwnd):
        raise Refusal("That window no longer exists.", "state_changed")
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    if right - left <= 0 or bottom - top <= 0:
        raise Refusal("That window has no visible area to capture.", "state_changed")
    return left, top, right, bottom


def _grab(region: tuple[int, int, int, int]) -> np.ndarray:
    """Capture a screen region, preferring DXCam and falling back to MSS.

    DXCam uses the Desktop Duplication API and is markedly faster, but it fails
    on some display configurations — remote sessions and certain hybrid-GPU
    laptops in particular. Falling back rather than failing keeps capture
    working on machines where the fast path simply is not available, and the
    result records which one was used so a latency figure can be read honestly.
    """
    global _dxcam_camera, _dxcam_failed

    if not _dxcam_failed:
        try:
            import dxcam  # noqa: PLC0415 - lazy, initialising it is expensive

            if _dxcam_camera is None:
                _dxcam_camera = dxcam.create(output_color="RGB")
            if _dxcam_camera is not None:
                frame = _dxcam_camera.grab(region=region)
                if frame is not None:
                    return frame
        except Exception:
            _dxcam_failed = True

    import mss  # noqa: PLC0415

    left, top, right, bottom = region
    with mss.mss() as sct:
        shot = sct.grab({"left": left, "top": top, "width": right - left, "height": bottom - top})
        return np.array(shot)[:, :, :3][:, :, ::-1]


def capture_window(request) -> dict[str, Any]:
    payload = getattr(request, "payload", {}) or {}
    hwnd = payload.get("hwnd")
    if not isinstance(hwnd, int) or hwnd <= 0:
        hwnd = win32gui.GetForegroundWindow()
    if not hwnd:
        raise Refusal("No window was given and nothing currently has focus.", "state_changed")

    started = time.monotonic()
    bounds = _window_bounds(hwnd)
    frame = _grab(bounds)
    png = _encode_png(frame)
    digest = hashlib.sha256(png).hexdigest()
    return {
        "hwnd": hwnd,
        "title": clamp_text(win32gui.GetWindowText(hwnd), 256),
        "bounds": {
            "x": bounds[0],
            "y": bounds[1],
            "width": bounds[2] - bounds[0],
            "height": bounds[3] - bounds[1],
        },
        "backend": "mss" if _dxcam_failed else "dxcam",
        "sha256": digest,
        # A perceptual-ish fingerprint of the frame. Cheap, and enough to answer
        # "did this window change since I looked?" without keeping the bitmap.
        "fingerprint": _fingerprint(frame),
        "bytes": len(png),
        "elapsedMs": int((time.monotonic() - started) * 1000),
    }


def _encode_png(frame: np.ndarray) -> bytes:
    import cv2  # noqa: PLC0415

    ok, buffer = cv2.imencode(".png", frame[:, :, ::-1])
    if not ok:
        raise Refusal("The captured frame could not be encoded.", "retryable_failure")
    return buffer.tobytes()


def _fingerprint(frame: np.ndarray) -> str:
    """A 64-bit average hash. Survives cursor blink; changes when content does."""
    import cv2  # noqa: PLC0415

    grey = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
    small = cv2.resize(grey, (8, 8), interpolation=cv2.INTER_AREA)
    bits = (small > small.mean()).flatten()
    value = 0
    for bit in bits:
        value = (value << 1) | int(bit)
    return f"{value:016x}"


async def _recognise(png: bytes) -> list[dict[str, Any]]:
    from winsdk.windows.graphics.imaging import BitmapDecoder  # noqa: PLC0415
    from winsdk.windows.media.ocr import OcrEngine  # noqa: PLC0415
    from winsdk.windows.storage.streams import DataWriter, InMemoryRandomAccessStream  # noqa: PLC0415

    engine = OcrEngine.try_create_from_user_profile_languages()
    if engine is None:
        raise Refusal(
            "Windows has no OCR language installed, so text cannot be read from the screen.",
            "unsupported",
        )
    stream = InMemoryRandomAccessStream()
    writer = DataWriter(stream)
    writer.write_bytes(png)
    await writer.store_async()
    await writer.flush_async()
    stream.seek(0)
    decoder = await BitmapDecoder.create_async(stream)
    bitmap = await decoder.get_software_bitmap_async()
    result = await engine.recognize_async(bitmap)

    lines: list[dict[str, Any]] = []
    for line in result.lines:
        text = clamp_text(line.text, 512)
        if not text.strip():
            continue
        words = list(line.words)
        if not words:
            continue
        left = min(w.bounding_rect.x for w in words)
        top = min(w.bounding_rect.y for w in words)
        right = max(w.bounding_rect.x + w.bounding_rect.width for w in words)
        bottom = max(w.bounding_rect.y + w.bounding_rect.height for w in words)
        protected = is_protected_text(text)
        lines.append(
            {
                "text": "«protected»" if protected else text,
                "protected": protected,
                "bounds": {
                    "x": int(left),
                    "y": int(top),
                    "width": int(right - left),
                    "height": int(bottom - top),
                },
            }
        )
    return lines


def ocr_window(request) -> dict[str, Any]:
    """Read visible text from a window, optionally within one region."""
    payload = getattr(request, "payload", {}) or {}
    hwnd = payload.get("hwnd")
    if not isinstance(hwnd, int) or hwnd <= 0:
        hwnd = win32gui.GetForegroundWindow()
    if not hwnd:
        raise Refusal("No window was given and nothing currently has focus.", "state_changed")

    started = time.monotonic()
    left, top, right, bottom = _window_bounds(hwnd)
    region = payload.get("region")
    if isinstance(region, dict):
        # Region is expressed in window coordinates so a caller never has to
        # know where the window sits on a multi-monitor desktop.
        rx, ry = int(region.get("x", 0)), int(region.get("y", 0))
        rw, rh = int(region.get("width", 0)), int(region.get("height", 0))
        if rw > 0 and rh > 0:
            left, top = left + rx, top + ry
            right, bottom = left + rw, top + rh

    frame = _grab((left, top, right, bottom))
    png = _encode_png(frame)
    lines = asyncio.run(_recognise(png))
    text = clamp_text("\n".join(line["text"] for line in lines), MAX_TEXT)
    return {
        "hwnd": hwnd,
        "source": "windows-ocr",
        "origin": {"x": left, "y": top},
        "lines": lines[:300],
        "lineCount": len(lines),
        "text": text,
        "elapsedMs": int((time.monotonic() - started) * 1000),
    }
