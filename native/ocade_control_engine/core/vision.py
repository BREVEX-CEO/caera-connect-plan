"""Seeing: the desktop and the webcam, described in words the session can hold.

WHY A DESCRIPTION AND NOT AN IMAGE
-----------------------------------
The model that runs OCADE's conversation is a small text model. Handing it a
PNG does nothing — it has no image channel — so "pipe the screen into the
session" cannot mean "attach a screenshot to the prompt". It has to mean:
capture, get a vision model to READ the capture, and put the reading into the
conversation as text the small model can actually use.

That is what this does. `look()` captures, sends the frame to the local vision
model over Ollama, and returns prose. The prose goes into the session; the image
comes back too, base64-encoded, so the interface can show the user exactly what
OCADE was looking at when it said what it said.

SHOWING THE FRAME IS NOT A NICETY
----------------------------------
A description with no picture is unfalsifiable. When OCADE says "your screen
shows a spreadsheet with a red error in column D" the user has to be able to
glance at the thumbnail and see that it was looking at the right monitor. Every
observation here carries its own evidence.

THE WEBCAM IS OFF UNTIL IT IS ASKED FOR, AND CLOSED THE MOMENT IT IS DONE
--------------------------------------------------------------------------
`cv2.VideoCapture` holds the device — the privacy light stays on — for as long
as the object is alive. So the capture is wrapped in a try/finally that releases
it on every path including the failure paths, and a few frames are read and
discarded first because the first frame off most webcams is black or badly
exposed while the sensor's auto-gain settles. A black frame described confidently
is worse than no frame.

NOTHING IS WRITTEN TO DISK.
Frames live in memory, go over the local socket to Ollama, and are dropped. A
folder of quietly accumulated webcam stills is not a feature anybody asked for.
"""

from __future__ import annotations

import base64
import io
import json
import time
import urllib.error
import urllib.request
from typing import Any

#: The local vision model. Shared with `core.perception` deliberately — a
#: second vision model would be a second multi-gigabyte download for the same
#: capability, and the two would disagree about the same screen.
VISION_MODEL = "qwen2.5vl:7b"
DEFAULT_BRIDGE = "http://127.0.0.1:11434"

#: Frames are scaled to this width before they are sent. A 4K screenshot is
#: four megabytes of base64 and takes minutes; the model reads a 900px frame
#: about as well and answers in seconds.
FRAME_WIDTH = 900

#: Describing is slower than locating — it is generating a paragraph, not a
#: coordinate — but a minute is the outside of what a person will wait while
#: looking at a "Looking…" line.
VISION_TIMEOUT = 60.0

#: How many frames to pull and throw away before keeping one. Measured on two
#: laptops: the first frame was black on both, the second correct on one.
_WARMUP_FRAMES = 5

#: A thumbnail small enough to travel through the JSON protocol without
#: bloating every transcript it lands in.
_THUMBNAIL_WIDTH = 480


class VisionUnavailable(RuntimeError):
    """Seeing is not possible here, with a reason the user can act on."""


def _pillow():
    try:
        from PIL import Image  # noqa: PLC0415

        return Image
    except Exception as error:  # noqa: BLE001
        raise VisionUnavailable("Seeing needs the 'pillow' package.") from error


def _encode(image, width: int) -> tuple[str, int, int]:
    """Scale, PNG-encode and base64 an image. Returns the payload and its size."""
    full_w, full_h = image.size
    if full_w > width:
        scale = width / full_w
        image = image.resize((width, max(1, int(full_h * scale))))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode(), image.size[0], image.size[1]


# ---------------------------------------------------------------- capture --


def capture_screen(hwnd: int | None = None) -> Any:
    """A PIL image of one window, or of the whole desktop."""
    Image = _pillow()
    try:
        import mss  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise VisionUnavailable("Screen capture needs the 'mss' package.") from error

    region = None
    if hwnd:
        try:
            import win32gui  # noqa: PLC0415

            left, top, right, bottom = win32gui.GetWindowRect(hwnd)
            if right > left and bottom > top:
                region = {"left": left, "top": top, "width": right - left, "height": bottom - top}
        except Exception:  # noqa: BLE001
            region = None

    with mss.mss() as sct:
        target = region or sct.monitors[1]
        raw = sct.grab(target)
        return Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")


def capture_webcam(device: int = 0) -> Any:
    """A PIL image from the webcam, with the device released before returning."""
    Image = _pillow()
    try:
        import cv2  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise VisionUnavailable(
            "The webcam needs the 'opencv-python' package, which is not installed."
        ) from error
    try:
        import numpy  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise VisionUnavailable("The webcam needs the 'numpy' package.") from error

    camera = cv2.VideoCapture(int(device))
    try:
        if not camera.isOpened():
            raise VisionUnavailable(
                f"Camera {device} could not be opened. Another application may be using it, "
                "or camera access may be switched off in privacy settings."
            )
        frame = None
        # Discard the first few. The sensor's exposure has not settled and the
        # frames are black — described confidently, which is the worst outcome.
        for _ in range(_WARMUP_FRAMES):
            ok, candidate = camera.read()
            if ok and candidate is not None:
                frame = candidate
            time.sleep(0.05)
        if frame is None:
            raise VisionUnavailable(f"Camera {device} opened but returned no usable frame.")
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return Image.fromarray(numpy.asarray(rgb))
    finally:
        # THE RELEASE IS IN A FINALLY, NOT AFTER THE READ. Every failure path
        # above leaves the camera open otherwise — light on, device locked,
        # nothing left holding a reference to close it.
        try:
            camera.release()
        except Exception:  # noqa: BLE001, S110
            pass


def cameras(limit: int = 4) -> dict[str, Any]:
    """Which camera indices actually open on this machine.

    PROBED, NOT ASSUMED. There is no portable enumeration API in OpenCV, so the
    only honest answer comes from opening each index and seeing. Each probe is
    closed immediately, so the privacy light blinks once per index rather than
    staying on.
    """
    try:
        import cv2  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise VisionUnavailable("Listing cameras needs the 'opencv-python' package.") from error

    found: list[dict[str, Any]] = []
    for index in range(max(1, min(int(limit), 8))):
        camera = cv2.VideoCapture(index)
        try:
            if camera.isOpened():
                width = int(camera.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
                height = int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
                found.append({"device": index, "width": width, "height": height})
        finally:
            try:
                camera.release()
            except Exception:  # noqa: BLE001, S110
                pass

    return {
        "cameras": found,
        "count": len(found),
        "verified": True,
        "detail": (
            f"{len(found)} camera(s) available."
            if found
            else "No camera responded on this computer."
        ),
    }


# ------------------------------------------------------------- describing --


def _ask_vision(encoded: str, prompt: str, *, bridge: str = DEFAULT_BRIDGE) -> str:
    body = json.dumps(
        {
            "model": VISION_MODEL,
            "stream": False,
            "messages": [{"role": "user", "content": prompt, "images": [encoded]}],
            # Low but not zero: a description at temperature 0 repeats the same
            # opening clause on every frame, which reads as a stuck loop.
            "options": {"temperature": 0.2, "num_predict": 320},
        }
    ).encode()
    request = urllib.request.Request(  # noqa: S310
        f"{bridge.rstrip('/')}/api/chat",
        data=body,
        headers={"content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=VISION_TIMEOUT) as response:  # noqa: S310
            payload = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise VisionUnavailable(
            f"The vision model could not be reached at {bridge}. "
            f"Check that Ollama is running and that {VISION_MODEL} is pulled."
        ) from error
    return str((payload.get("message") or {}).get("content") or "").strip()


_SCREEN_PROMPT = (
    "Describe what is on this computer screen for somebody who cannot see it. "
    "Name the application in front, what it is showing, and any text that matters — "
    "errors, headings, values, the state of controls. Be specific and factual. "
    "Do not speculate about what the user should do."
)

_WEBCAM_PROMPT = (
    "Describe what this camera can see, factually and briefly. "
    "Say what is in the frame and what is happening. "
    "Do not guess at anybody's identity, age, mood or health."
)


def look(
    *,
    source: str = "screen",
    hwnd: int | None = None,
    device: int = 0,
    question: str = "",
) -> dict[str, Any]:
    """Capture, read, and return both the words and the picture.

    `question` narrows the description to something specific — "what does the
    error say", "is anybody at the desk" — which is what makes this useful
    mid-task rather than merely descriptive.
    """
    kind = " ".join((source or "screen").split()).lower()
    if kind not in ("screen", "webcam", "camera"):
        raise VisionUnavailable(f"{source!r} is not something OCADE can look at. Use screen or webcam.")

    started = time.monotonic()
    if kind == "screen":
        image = capture_screen(hwnd)
        base_prompt = _SCREEN_PROMPT
    else:
        image = capture_webcam(device)
        base_prompt = _WEBCAM_PROMPT

    asked = " ".join((question or "").split())[:400]
    prompt = f"{base_prompt}\n\nThe person asked specifically: {asked}" if asked else base_prompt

    encoded, width, height = _encode(image, FRAME_WIDTH)
    description = _ask_vision(encoded, prompt)
    thumbnail, thumb_w, thumb_h = _encode(image, _THUMBNAIL_WIDTH)

    return {
        "source": kind,
        "question": asked,
        "description": description,
        # The evidence for the sentence above, in a form the interface can
        # render directly with no round trip back to the engine.
        "image": f"data:image/png;base64,{thumbnail}",
        "frame": {"width": width, "height": height},
        "thumbnail": {"width": thumb_w, "height": thumb_h},
        "model": VISION_MODEL,
        "elapsedMs": int((time.monotonic() - started) * 1000),
        # Verified means A FRAME WAS CAPTURED AND A MODEL READ IT. It is not a
        # claim that the description is correct — which is why the frame is
        # returned alongside it for the user to check.
        "verified": bool(description),
        "detail": (
            description[:500]
            if description
            else "A frame was captured but the vision model returned nothing."
        ),
    }
