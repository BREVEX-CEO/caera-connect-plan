from __future__ import annotations

import base64
import hashlib
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import cv2
import mss
import numpy as np
import pytesseract
from pywinauto import Desktop

SENSITIVE = re.compile(r"password|passcode|pin|cvv|secret|token|private key", re.I)
for candidate in (
    os.environ.get("TESSERACT_CMD"),
    str(Path(getattr(sys, "_MEIPASS", "")) / "Tesseract-OCR" / "tesseract.exe"),
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
):
    if candidate and Path(candidate).is_file():
        pytesseract.pytesseract.tesseract_cmd = candidate
        break


def _frame(monitor: int = 0) -> tuple[np.ndarray[Any, Any], dict[str, int], float]:
    started = time.perf_counter()
    with mss.mss() as session:
        index = max(0, min(monitor, len(session.monitors) - 1))
        bounds = dict(session.monitors[index])
        bgra = np.asarray(session.grab(bounds))
    return cv2.cvtColor(bgra, cv2.COLOR_BGRA2BGR), bounds, (time.perf_counter() - started) * 1_000


def _redact(image: np.ndarray[Any, Any], regions: list[list[int]]) -> None:
    height, width = image.shape[:2]
    for region in regions[:64]:
        if len(region) != 4:
            continue
        left, top, right, bottom = (int(value) for value in region)
        left, right = sorted((max(0, left), min(width, right)))
        top, bottom = sorted((max(0, top), min(height, bottom)))
        if right > left and bottom > top:
            image[top:bottom, left:right] = 0


def capture_frame(monitor: int = 0, regions: list[list[int]] | None = None) -> dict[str, Any]:
    image, bounds, capture_ms = _frame(monitor)
    _redact(image, regions or [])
    encoded, jpeg = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 82])
    if not encoded:
        raise RuntimeError("JPEG encoding failed")
    payload = jpeg.tobytes()
    if len(payload) > 3 * 1024 * 1024:
        raise RuntimeError("captured frame exceeds the 3 MiB response limit")
    return {
        "bounds": bounds,
        "width": image.shape[1],
        "height": image.shape[0],
        "captureMs": round(capture_ms, 2),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "jpegBase64": base64.b64encode(payload).decode("ascii"),
    }


def ocr_window(handle: int) -> dict[str, Any]:
    started = time.perf_counter()
    window = Desktop(backend="uia").window(handle=handle)
    rectangle = window.rectangle()
    with mss.mss() as session:
        bounds = {
            "left": rectangle.left,
            "top": rectangle.top,
            "width": rectangle.width(),
            "height": rectangle.height(),
        }
        image = cv2.cvtColor(np.asarray(session.grab(bounds)), cv2.COLOR_BGRA2BGR)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    text = pytesseract.image_to_string(gray, config="--psm 6")
    return {
        "handle": handle,
        "title": window.window_text(),
        "text": text[:20_000],
        "elapsedMs": round((time.perf_counter() - started) * 1_000, 2),
    }


def set_of_mark(handle: int) -> dict[str, Any]:
    window = Desktop(backend="uia").window(handle=handle)
    marks: list[dict[str, Any]] = []
    for control in window.descendants()[:300]:
        try:
            rectangle = control.rectangle()
            name = control.window_text().strip()
            control_type = control.element_info.control_type
            if rectangle.width() < 4 or rectangle.height() < 4 or not control.is_visible():
                continue
            marks.append(
                {
                    "mark": len(marks) + 1,
                    "name": "[REDACTED]" if SENSITIVE.search(name) else name[:300],
                    "type": control_type,
                    "rectangle": [rectangle.left, rectangle.top, rectangle.right, rectangle.bottom],
                    "sensitive": bool(SENSITIVE.search(name)) or control_type == "Password",
                }
            )
        except (RuntimeError, OSError):
            continue
    layout = "|".join(
        f"{item['type']}:{item['name']}:{','.join(map(str, item['rectangle']))}" for item in marks
    )
    return {
        "handle": handle,
        "title": window.window_text(),
        "marks": marks,
        "layoutHash": hashlib.sha256(layout.encode()).hexdigest(),
    }
