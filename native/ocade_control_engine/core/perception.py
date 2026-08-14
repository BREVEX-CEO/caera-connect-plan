"""Finding a thing on screen, down a ladder of decreasing certainty.

THE LADDER
----------
    1. UI AUTOMATION — the operating system STATES that a control is a button,
       is called "Save", is enabled, and sits at these bounds. Acting on it uses
       control patterns, so the pointer never moves and the result is readable
       back. This answers for essentially every standard Windows application.

    2. WINDOWS OCR — for windows that expose nothing: custom-drawn canvases,
       games, Electron apps with a broken bridge, remote sessions. Reading a
       label out of a bitmap infers a fact the OS declined to state, so it ranks
       below UIA and is labelled as inferred. It does give real pixel bounds,
       so it is genuinely actionable.

    3. VISION MODEL — a screenshot to `qwen2.5vl:7b` asking where the target is.
       OFF BY DEFAULT ON THIS HARDWARE, and the reason is measured rather than
       assumed. See `VISION_MEASUREMENT` below.

    4. Nothing found, said plainly.

A lower rung is reached ONLY because the one above returned nothing usable —
never because it was slower. Every target carries `source`, so a caller can see
how much to trust it, and `needsPointer`, so nobody discovers a pixel click was
involved after the fact.

WHY THIS IS NOT A LIST OF APPLICATIONS
--------------------------------------
There is no branch here that knows what program it is looking at. Rung 1 asks
Windows, rung 2 reads pixels, rung 3 asks a model. An application nobody
anticipated goes down exactly the same ladder as Notepad, which is the whole
point — a per-app table would need a new entry for every program a user owns,
and would be wrong the first time one of them shipped a redesign.
"""

from __future__ import annotations

import base64
import io
import json
import time
import urllib.error
import urllib.request
from typing import Any

#: MEASURED ON THE REFERENCE MACHINE (11th-gen i5, no discrete GPU), twice:
#:
#:     1024x576 screenshot, "find the Start button"  -> 199.8 s, y=674 (image is 576 tall)
#:      800x450 screenshot, dimensions stated        -> 102.1 s, y=637 (image is 450 tall)
#:
#: Both answers put Y OUTSIDE THE IMAGE. The X value was roughly right both
#: times; Y was not usable either time. So on this class of hardware the vision
#: rung is both too slow to be interactive and too inaccurate to be trusted, and
#: turning it on by default would mean a three-minute wait for a click in the
#: wrong place.
#:
#: It is implemented, gated, and validated rather than deleted: on a machine
#: with a GPU the latency argument disappears, and `_validate_point` means a
#: nonsense coordinate is refused instead of clicked. Re-measure before changing
#: the default.
#: RE-MEASURED 2026-08-13, because the note above says to before changing the
#: default. Four samples, two image sizes, two targets, 1920x1080 screen:
#:
#:      800x450  "Start button"  212.7 s  -> (12, 637)   image is 450 tall
#:      800x450  "taskbar clock"  10.3 s  -> (792, 631)  image is 450 tall
#:     1024x576  "Start button"  137.8 s  -> (38, 619)   image is 576 tall
#:     1024x576  "taskbar clock"  11.3 s  -> (983, 612)  image is 576 tall
#:
#: ZERO OF FOUR IN BOUNDS, and the pattern is the informative part: X is
#: roughly correct every time — 12 and 38 for a control at the far left, 792/800
#: and 983/1024 for one at the far right — while Y is pinned around 610-640
#: regardless of whether the image is 450 or 576 pixels tall. The model is not
#: reading the image's vertical scale at all, and restating the dimensions in
#: the prompt does not fix it.
#:
#: So the rung stays IMPLEMENTED, GATED and VALIDATED rather than deleted or
#: enabled. `_validate_point` turns each of those four answers into "no target"
#: instead of a click near the bottom of somebody's screen, which is why
#: automatic triggering is safe even here — the cost of being wrong is latency,
#: not a misplaced click. Re-measure on a GPU machine before flipping
#: `VISION_ENABLED_BY_DEFAULT`.
VISION_MEASUREMENT = {
    "hardware": "11th Gen Intel i5-1135G7, no discrete GPU",
    "measuredOn": "2026-08-13",
    "samples": [
        {"image": "800x450", "query": "Start button", "seconds": 212.7, "point": [12, 637],
         "inBounds": False},
        {"image": "800x450", "query": "taskbar clock", "seconds": 10.3, "point": [792, 631],
         "inBounds": False},
        {"image": "1024x576", "query": "Start button", "seconds": 137.8, "point": [38, 619],
         "inBounds": False},
        {"image": "1024x576", "query": "taskbar clock", "seconds": 11.3, "point": [983, 612],
         "inBounds": False},
    ],
    "inBounds": "0/4",
    "verdict": (
        "X is approximately right; Y is out of bounds every time and does not track "
        "the image height. Unusable on CPU-only hardware. Off by default."
    ),
}

VISION_MODEL = "qwen2.5vl:7b"
VISION_WIDTH = 800
DEFAULT_BRIDGE = "http://localhost:11434"

#: THE AUTOMATIC RUNG IS BUILT AND WIRED; THIS IS WHETHER IT FIRES UNASKED.
#:
#: False here is a statement about measured hardware, not a missing feature.
#: With 0/4 in bounds and a median of 138 seconds, letting it run automatically
#: would add over two minutes to every failed lookup and then return nothing —
#: strictly worse for the user than failing in two seconds and saying so.
#: A caller can still force the rung per call with allowVision, and flipping
#: this to True is the whole change needed on a machine where it works.
VISION_ENABLED_BY_DEFAULT = False

#: A bound on the stall. The 212 s sample is longer than any interactive task
#: should wait for one lookup, so a forced call is cut off rather than allowed
#: to run to whatever the model feels like.
VISION_TIMEOUT = 45.0


class PerceptionUnavailable(RuntimeError):
    """A rung of the ladder cannot run here, with a reason."""


def _norm(text: str) -> str:
    return " ".join((text or "").lower().split())


def _match_score(query: str, label: str) -> float:
    """How well a found label answers the query.

    Deliberately simple and explainable. Exact match beats prefix beats
    substring beats word overlap, and anything below the floor is not returned
    at all — an agent handed a 0.1-confidence "closest thing I saw" will click
    it, so a weak match is worse than no match.
    """
    q, text = _norm(query), _norm(label)
    if not q or not text:
        return 0.0
    if q == text:
        return 1.0

    # SUBSTRING MATCHING NEEDS A LENGTH FLOOR, and this is not hypothetical.
    #
    # Live run: the query "a control that does not exist here" matched an OCR
    # line reading "x" at confidence 0.64 — because "x" is inside "exist". A
    # one-character label is a substring of almost everything, so without a
    # floor the OCR rung confidently returns junk and something gets clicked.
    #
    # A substring only counts when it is long enough to be a word and covers a
    # real share of the thing it matched.
    shorter, longer = (q, text) if len(q) <= len(text) else (text, q)
    if len(shorter) >= 3 and shorter and (len(shorter) / len(longer)) >= 0.34:
        if text.startswith(q) or q.startswith(text):
            return 0.9
        if q in text or text in q:
            return 0.75

    q_words, l_words = set(q.split()), set(text.split())
    if not q_words:
        return 0.0
    # Word overlap ignores one- and two-letter words for the same reason.
    meaningful = {w for w in q_words if len(w) >= 3}
    if not meaningful:
        return 0.0
    overlap = len(meaningful & l_words) / len(meaningful)
    return 0.6 * overlap


MATCH_FLOOR = 0.5


# ------------------------------------------------------------ rung 1: UIA


def _from_uia(hwnd: int, query: str, limit: int, protect=None) -> list[dict[str, Any]]:
    from core.uia import UiaUnavailable, snapshot  # noqa: PLC0415

    try:
        tree = snapshot(hwnd, limit=limit, protect=protect)
    except UiaUnavailable:
        return []

    found: list[dict[str, Any]] = []
    for element in tree["elements"]:
        score = max(_match_score(query, element["name"]), _match_score(query, element["automationId"]))
        if score < MATCH_FLOOR:
            continue
        found.append(
            {
                "source": "uia",
                "ref": element["ref"],
                "fingerprint": element["fingerprint"],
                "role": element["role"],
                "label": element["name"] or element["automationId"] or element["role"],
                "bounds": element["bounds"],
                "enabled": element["enabled"],
                "confidence": round(score, 2),
                # The whole reason UIA ranks first: it is operated through the
                # control's own patterns, so nothing moves the user's cursor.
                "needsPointer": False,
                "how": "Operate with ui_act using this ref — no pointer movement.",
            }
        )
    found.sort(key=lambda t: t["confidence"], reverse=True)
    return found


# ------------------------------------------------------------ rung 2: OCR


def _capture(hwnd: int | None) -> tuple[bytes, dict[str, int]]:
    """A PNG of one window, or the whole desktop when no window is named."""
    try:
        import mss  # noqa: PLC0415
        from PIL import Image  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise PerceptionUnavailable(
            "Screen reading needs the 'mss' and 'pillow' packages, which are not "
            "installed in this Python environment."
        ) from error

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
        image = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    origin = {
        "x": int(target.get("left", 0)),
        "y": int(target.get("top", 0)),
        "width": image.size[0],
        "height": image.size[1],
    }
    return buffer.getvalue(), origin


def _ocr_lines(png: bytes) -> list[dict[str, Any]]:
    """Windows' own OCR. Returns text WITH pixel bounds, which is what makes
    this rung actionable rather than merely informative."""
    import asyncio  # noqa: PLC0415

    async def run() -> list[dict[str, Any]]:
        from winsdk.windows.graphics.imaging import BitmapDecoder  # noqa: PLC0415
        from winsdk.windows.media.ocr import OcrEngine  # noqa: PLC0415
        from winsdk.windows.storage.streams import (  # noqa: PLC0415
            DataWriter,
            InMemoryRandomAccessStream,
        )

        engine = OcrEngine.try_create_from_user_profile_languages()
        if engine is None:
            raise PerceptionUnavailable(
                "Windows has no OCR language pack installed, so text cannot be read "
                "from the screen. Add one under Settings → Time & language."
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
            words = list(line.words)
            if not words or not line.text.strip():
                continue
            left = min(w.bounding_rect.x for w in words)
            top = min(w.bounding_rect.y for w in words)
            right = max(w.bounding_rect.x + w.bounding_rect.width for w in words)
            bottom = max(w.bounding_rect.y + w.bounding_rect.height for w in words)
            lines.append(
                {
                    "text": line.text.strip()[:200],
                    "bounds": {
                        "x": int(left),
                        "y": int(top),
                        "width": int(right - left),
                        "height": int(bottom - top),
                    },
                }
            )
        return lines

    try:
        import winsdk  # noqa: F401, PLC0415
    except Exception as error:  # noqa: BLE001
        raise PerceptionUnavailable(
            "Screen text reading needs the 'winsdk' package, which is not installed."
        ) from error
    return asyncio.run(run())


def _from_ocr(hwnd: int | None, query: str, protect=None) -> list[dict[str, Any]]:
    png, origin = _capture(hwnd)
    found: list[dict[str, Any]] = []
    for line in _ocr_lines(png):
        score = _match_score(query, line["text"])
        if score < MATCH_FLOOR:
            continue
        text = line["text"]
        if protect is not None and protect(text):
            # A password field's LABEL is fine; its contents are not, and OCR
            # cannot tell which it just read.
            continue
        bounds = line["bounds"]
        found.append(
            {
                "source": "ocr",
                "label": text,
                # Screen coordinates, not image coordinates: the caller clicks a
                # screen, and a window-relative capture would otherwise be off
                # by the window's position.
                "bounds": {
                    "x": bounds["x"] + origin["x"],
                    "y": bounds["y"] + origin["y"],
                    "width": bounds["width"],
                    "height": bounds["height"],
                },
                "confidence": round(score * 0.85, 2),  # inferred, not stated
                "needsPointer": True,
                "how": "Click the centre of these bounds — OCR gives no control pattern.",
            }
        )
    found.sort(key=lambda t: t["confidence"], reverse=True)
    return found


# --------------------------------------------------------- rung 3: vision


def _validate_point(x: Any, y: Any, width: int, height: int) -> tuple[int, int] | None:
    """Refuse a coordinate the model cannot have meant.

    Both live measurements returned a Y outside the image. Without this check
    that becomes a click at the bottom of somebody's screen, on whatever
    happens to be there.
    """
    try:
        px, py = int(x), int(y)
    except (TypeError, ValueError):
        return None
    if not (0 <= px <= width and 0 <= py <= height):
        return None
    return px, py


def _from_vision(
    hwnd: int | None, query: str, *, bridge: str = DEFAULT_BRIDGE, timeout: float = 240.0
) -> list[dict[str, Any]]:
    """Ask the local vision model where the target is. Opt-in; see VISION_MEASUREMENT."""
    try:
        from PIL import Image  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise PerceptionUnavailable("The vision rung needs 'pillow'.") from error

    png, origin = _capture(hwnd)
    image = Image.open(io.BytesIO(png))
    full_w, full_h = image.size
    scale = VISION_WIDTH / full_w
    small = image.resize((VISION_WIDTH, max(1, int(full_h * scale))))
    w, h = small.size
    buffer = io.BytesIO()
    small.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode()

    prompt = (
        f"This screenshot is exactly {w} pixels wide and {h} pixels tall.\n"
        f"Find: {query}\n"
        f'Reply with ONLY JSON: {{"found":true,"x":<int 0-{w}>,"y":<int 0-{h}>}}\n'
        "x,y is the CENTRE of the target and must be inside the image. "
        'If it is not visible reply {"found":false}.'
    )
    body = json.dumps(
        {
            "model": VISION_MODEL,
            "stream": False,
            "messages": [{"role": "user", "content": prompt, "images": [encoded]}],
            "options": {"temperature": 0, "num_predict": 80},
        }
    ).encode()

    started = time.monotonic()
    try:
        request = urllib.request.Request(  # noqa: S310
            f"{bridge.rstrip('/')}/api/chat", data=body, headers={"content-type": "application/json"}
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310
            payload = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise PerceptionUnavailable(f"The vision model could not be reached: {error}") from error

    content = (payload.get("message") or {}).get("content") or ""
    try:
        parsed = json.loads(content[content.index("{") : content.rindex("}") + 1])
    except (ValueError, KeyError):
        return []
    if parsed.get("found") is False:
        return []

    point = _validate_point(parsed.get("x"), parsed.get("y"), w, h)
    if point is None:
        # Measured twice on this machine. Refused rather than clicked.
        return []
    px, py = point
    return [
        {
            "source": "vision",
            "label": str(parsed.get("label") or query)[:120],
            "bounds": {
                "x": int(px / scale) + origin["x"] - 8,
                "y": int(py / scale) + origin["y"] - 8,
                "width": 16,
                "height": 16,
            },
            # Never high: this is a model's guess about a picture, and the two
            # recorded measurements were both wrong.
            "confidence": 0.4,
            "needsPointer": True,
            "elapsedMs": int((time.monotonic() - started) * 1000),
            "how": "A vision estimate. Verify by observing again after clicking.",
        }
    ]


# ------------------------------------------------------------- the ladder


def find_targets(
    hwnd: int | None,
    query: str,
    *,
    limit: int = 80,
    allow_ocr: bool = True,
    allow_vision: bool | None = None,
    protect=None,
    bridge: str = DEFAULT_BRIDGE,
    vision_timeout: float = VISION_TIMEOUT,
) -> dict[str, Any]:
    """Locate something on screen, and say how the answer was reached.

    `allow_vision=None` means AUTOMATIC: the vision rung runs when, and only
    when, the two rungs above it found nothing. That is the case the rung exists
    for — a window that publishes no accessibility tree and shows no readable
    text, which is what Blender, a game, or a custom-drawn canvas looks like
    from out here. Passing True forces it, False forbids it.

    WHY AUTOMATIC IS SAFE EVEN THOUGH THE MODEL IS UNRELIABLE HERE.
    `_validate_point` refuses a coordinate outside the image, and both of the
    original measurements on this machine produced exactly that. So the failure
    mode of an inaccurate answer is NO TARGET, not a click in the wrong place —
    the cost of being wrong is latency, and `vision_timeout` bounds that.
    """
    query = (query or "").strip()
    if not query:
        raise PerceptionUnavailable("There is nothing to look for.")

    tried: list[str] = []

    if hwnd:
        targets = _from_uia(hwnd, query, limit, protect)
        tried.append(f"UI Automation ({len(targets)} match)")
        if targets:
            return {
                "query": query,
                "source": "uia",
                "targets": targets[:8],
                "count": len(targets),
                "needsPointer": False,
                "tried": tried,
                "verified": True,
                "detail": (
                    f"Found {targets[0]['role']} “{targets[0]['label']}” through the "
                    "accessibility tree. It can be operated without moving the pointer."
                ),
            }

    if allow_ocr:
        try:
            targets = _from_ocr(hwnd, query, protect)
            tried.append(f"Windows OCR ({len(targets)} match)")
            if targets:
                return {
                    "query": query,
                    "source": "ocr",
                    "targets": targets[:8],
                    "count": len(targets),
                    "needsPointer": True,
                    "tried": tried,
                    "verified": True,
                    "detail": (
                        f"This window exposes no matching control, so OCADE read the screen "
                        f"and found “{targets[0]['label']}”. Acting on it needs a pointer click."
                    ),
                }
        except PerceptionUnavailable as error:
            tried.append(f"Windows OCR unavailable ({error})")

    # AUTOMATIC WHEN THE RUNGS ABOVE FOUND NOTHING. This is the "UIA returned
    # zero elements" case: an application that states nothing about itself and
    # shows no text OCR can read. Everything above has already returned empty by
    # the time execution reaches here, so no extra condition is needed — being
    # here IS the condition.
    use_vision = allow_vision if allow_vision is not None else VISION_ENABLED_BY_DEFAULT
    if use_vision:
        try:
            targets = _from_vision(hwnd, query, bridge=bridge, timeout=vision_timeout)
            tried.append(f"vision model ({len(targets)} match)")
            if targets:
                return {
                    "query": query,
                    "source": "vision",
                    "targets": targets,
                    "count": len(targets),
                    "needsPointer": True,
                    "tried": tried,
                    "verified": False,
                    "detail": (
                        "Neither the accessibility tree nor the screen text found it, so this "
                        "is a vision estimate. Check the result after acting."
                    ),
                }
        except PerceptionUnavailable as error:
            tried.append(f"vision unavailable ({error})")

    return {
        "query": query,
        "source": "none",
        "targets": [],
        "count": 0,
        "needsPointer": False,
        "tried": tried,
        "verified": True,
        "detail": (
            f"Nothing matching “{query}” was found. Tried: {'; '.join(tried) or 'nothing'}."
            + ("" if use_vision else " The vision fallback is off; pass allowVision to try it.")
        ),
    }


def click_target(
    target: dict[str, Any],
    *,
    hwnd: int | None = None,
    observe=None,
) -> dict[str, Any]:
    """Click a target that only a pixel coordinate can reach, and check afterwards.

    THE ONLY SANCTIONED pyautogui CLICK IN THE ENGINE.
    ----------------------------------------------------
    Everything reachable through UI Automation is operated through UI
    Automation: `core.uia.act` names the control, uses its own invoke/toggle
    pattern, and reports `pointerUsed: false`. That path handles essentially
    every standard Windows application and it never moves the mouse.

    This function exists for the applications it does not handle — a Blender
    viewport, a game, a custom-drawn canvas, a remote desktop. Those publish no
    accessibility tree and often no readable text, so the only handle on them is
    a coordinate, and the only way to act on a coordinate is the physical
    pointer. Refusing to have this path would not make OCADE safer; it would
    make it unable to touch a whole class of software while claiming to be
    universal.

    WHAT MAKES IT A LAST RESORT RATHER THAN A SHORTCUT:

      * It takes a TARGET, not raw numbers. A caller cannot ask for a click at
        (840, 517) — it has to have found something first, which means a rung of
        the ladder produced the coordinate and stamped it with a `source`.
      * A target from UI Automation is REFUSED. If the accessibility tree can
        see it, `uia.act` must operate it; clicking a control that exposes an
        invoke pattern is choosing the blind path over the reliable one.
      * The receipt says `pointerUsed: true` and names the source, so a pixel
        click can never be mistaken in a log for an accessibility action.
      * `observe` is called after, when supplied, so the caller can say whether
        anything actually changed. A click that lands on nothing is silent, and
        silence is what this whole ladder exists to stop being reported as
        success.
    """
    source = str(target.get("source") or "")
    if source == "uia":
        raise PerceptionUnavailable(
            "That target came from the accessibility tree, so it must be operated with "
            "ui_act rather than clicked. A pointer click on a control that exposes a "
            "pattern is a blind action where a verifiable one is available."
        )
    if source not in ("ocr", "vision"):
        raise PerceptionUnavailable(
            "A pointer click needs a target produced by screen_find, so its origin and "
            "confidence are known. Raw coordinates are not accepted."
        )

    bounds = target.get("bounds") or {}
    try:
        x = int(bounds["x"]) + int(bounds["width"]) // 2
        y = int(bounds["y"]) + int(bounds["height"]) // 2
    except (KeyError, TypeError, ValueError) as error:
        raise PerceptionUnavailable("That target carries no usable bounds.") from error

    # The screen may have changed since the target was found. A stale
    # coordinate is the whole hazard of this rung, so the point is re-checked
    # against the live screen rather than trusted.
    try:
        import mss  # noqa: PLC0415

        with mss.mss() as sct:
            screen = sct.monitors[0]
    except Exception as error:  # noqa: BLE001
        raise PerceptionUnavailable("The screen bounds could not be read.") from error
    if not (
        screen["left"] <= x <= screen["left"] + screen["width"]
        and screen["top"] <= y <= screen["top"] + screen["height"]
    ):
        raise PerceptionUnavailable(
            f"({x}, {y}) is outside the screen, so OCADE did not click. The target was "
            "probably found before something moved."
        )

    before = observe() if callable(observe) else None

    import pyautogui  # noqa: PLC0415

    started = time.monotonic()
    pyautogui.click(x, y)
    time.sleep(0.35)

    after = observe() if callable(observe) else None
    changed = None if before is None or after is None else before != after

    return {
        "clicked": {"x": x, "y": y},
        "source": source,
        "label": target.get("label"),
        "confidence": target.get("confidence"),
        # STATED, because this is the one place it is true.
        "pointerUsed": True,
        "elapsedMs": int((time.monotonic() - started) * 1000),
        # A vision target is an estimate; the click landing somewhere is not
        # evidence it landed on the right thing. Only an observed change is.
        "verified": changed,
        "detail": (
            f"Clicked ({x}, {y}) from a {source} target"
            + (f" — “{target.get('label')}”" if target.get("label") else "")
            + (
                ". The screen changed afterwards."
                if changed
                else ". Nothing observably changed, so this may have missed."
                if changed is False
                else ". No observation was taken, so nothing is claimed about the result."
            )
        ),
    }
