"""A continuous view of the screen, so looking is never the slow part.

WHAT WAS WRONG WITH THE ONE-OFF SCREENSHOT
-------------------------------------------
`vision_action` grabbed a fresh frame every time it needed to look. Measured on
this machine that is ~250 ms for a capture plus an OCR pass, and it happened
INSIDE the action -- so every verified click paid it twice, once to find the
target and once to confirm the result. Worse, it all happened after the user
finished speaking: the clock started at the end of the sentence.

A person watching a screen does not start looking when they are asked. The
frame is already in their eye. This keeps a frame already in ours.

THE THREE PROPERTIES THAT MAKE THIS SAFE TO LEAVE RUNNING
----------------------------------------------------------
A background thread that screenshots forever is a battery bug wearing a
feature's clothes, so:

  * CAPTURE IS CHEAP, ANALYSIS IS NOT, AND THEY ARE SEPARATE. Grabbing a frame
    and JPEG-encoding it costs a few milliseconds. Running OCR over it costs
    ~250 ms and real CPU. The loop only ever does the first. OCR happens when
    somebody actually asks a question about the screen -- which is what
    "evaluates frames only when an action is requested" has to mean if it is to
    mean anything.

  * IT STOPS ON ITS OWN. The thread shuts down after `idle_timeout` with no
    reader. Nothing has to remember to turn it off, and forgetting to call
    `stop()` costs thirty seconds of capture rather than a flat battery.

  * MEMORY IS BOUNDED BY CONSTRUCTION. A ring of `frames` JPEGs, oldest
    dropped. Three 1080p frames at quality 70 is around 600 KB, and it cannot
    grow -- there is no path that appends without evicting.

WHY FRAMES ARE STORED AT FULL RESOLUTION
-----------------------------------------
The obvious saving is to downscale, and it was rejected. OCR accuracy falls off
a cliff on small text, and every bound this returns is a COORDINATE SOMETHING
WILL BE CLICKED AT -- a scale factor between what was read and what is clicked
is a whole class of off-by-a-few bugs that only ever appear on somebody else's
display scaling. JPEG at quality 70 gets the size down without touching the
geometry.
"""

from __future__ import annotations

import hashlib
import io
import threading
import time
from typing import Any

__all__ = ["Frame", "ScreenBuffer", "buffer", "prewarm"]

#: How often the background thread grabs a frame. 400 ms is under the ~500 ms
#: it takes a person to finish a sentence, so by the time a request is parsed
#: the frame behind it is already current.
DEFAULT_INTERVAL = 0.4

#: Frames kept. Three is enough to answer "what changed" without becoming a
#: video recorder: the current frame, the one before an action, and one spare.
DEFAULT_FRAMES = 3

#: The thread stops itself this long after the last read.
DEFAULT_IDLE_TIMEOUT = 30.0

#: JPEG quality for stored frames. 70 is visually lossy and OCR-transparent:
#: Windows OCR read identical text off quality-70 and lossless captures in
#: testing, at a quarter of the bytes.
JPEG_QUALITY = 70

#: A frame older than this is not trusted for a coordinate. Windows can change
#: completely in a second, and a stale bound is the one failure mode of this
#: whole idea -- so callers that need certainty get a fresh capture instead.
DEFAULT_MAX_AGE = 1.2


class Frame:
    """One captured screen, and where on the desktop it came from."""

    __slots__ = ("data", "captured_at", "origin", "digest", "_ocr")

    def __init__(self, data: bytes, origin: dict[str, int]) -> None:
        self.data = data
        self.captured_at = time.monotonic()
        self.origin = origin
        # A cheap identity for the pixels. Hashing 150 KB costs well under a
        # millisecond; the OCR pass it can save costs 250.
        self.digest = hashlib.blake2b(data, digest_size=16).digest()
        # OCR is computed at most once per frame and then remembered. Asking
        # the same question twice about a still screen is free.
        self._ocr: list[dict[str, Any]] | None = None

    @property
    def age(self) -> float:
        return time.monotonic() - self.captured_at

    def lines(self) -> list[dict[str, Any]]:
        """OCR for this frame, in DESKTOP coordinates, computed on demand."""
        if self._ocr is None:
            from core.perception import _ocr_lines  # noqa: PLC0415

            raw = _ocr_lines(self.data)
            for line in raw:
                line["bounds"]["x"] += self.origin["x"]
                line["bounds"]["y"] += self.origin["y"]
            self._ocr = raw
        return self._ocr

    def text(self) -> str:
        return " ".join(line["text"] for line in self.lines()).strip()


class ScreenBuffer:
    """A background capture loop with a bounded ring of recent frames."""

    def __init__(
        self,
        *,
        interval: float = DEFAULT_INTERVAL,
        frames: int = DEFAULT_FRAMES,
        idle_timeout: float = DEFAULT_IDLE_TIMEOUT,
    ) -> None:
        self.interval = interval
        self.capacity = max(1, frames)
        self.idle_timeout = idle_timeout
        self._frames: list[Frame] = []
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._last_read = 0.0
        self._captures = 0
        self._carried = 0
        self._error: str | None = None

    # ------------------------------------------------------------- lifecycle

    def start(self) -> bool:
        """Begin capturing. Safe to call repeatedly; only one thread ever runs."""
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                self._last_read = time.monotonic()
                return True
            self._stop.clear()
            self._last_read = time.monotonic()
            self._thread = threading.Thread(
                target=self._run, name="ocade-screen-buffer", daemon=True
            )
            self._thread.start()
        return True

    def stop(self) -> None:
        self._stop.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=2.0)
        self._thread = None
        with self._lock:
            self._frames.clear()

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    # ---------------------------------------------------------------- capture

    def _grab(self) -> Frame | None:
        try:
            import mss  # noqa: PLC0415
            from PIL import Image  # noqa: PLC0415
        except Exception as error:  # noqa: BLE001
            self._error = f"screen capture needs mss and pillow ({error})"
            return None
        try:
            with mss.mss() as sct:
                monitor = sct.monitors[1]
                raw = sct.grab(monitor)
                image = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
            buf = io.BytesIO()
            image.save(buf, format="JPEG", quality=JPEG_QUALITY)
            return Frame(
                buf.getvalue(),
                {
                    "x": int(monitor.get("left", 0)),
                    "y": int(monitor.get("top", 0)),
                    "width": image.size[0],
                    "height": image.size[1],
                },
            )
        except Exception as error:  # noqa: BLE001
            self._error = str(error)
            return None

    def _run(self) -> None:
        while not self._stop.is_set():
            # SELF-LIMITING. Nobody has looked in `idle_timeout` seconds, so
            # nothing is watching this and the thread has no reason to exist.
            if time.monotonic() - self._last_read > self.idle_timeout:
                break
            frame = self._grab()
            if frame is not None:
                with self._lock:
                    previous = self._frames[-1] if self._frames else None
                    # AN UNCHANGED SCREEN DOES NOT NEED READING TWICE.
                    #
                    # This is where the buffer actually earns its keep, and the
                    # first version of it did not have this line. Measured: a
                    # cold read is ~250 ms and only ~60 ms of that is the
                    # capture -- the rest is OCR. So a buffer that saves the
                    # capture and re-runs the OCR saves almost nothing, and
                    # through a JPEG decode it measured SLOWER (312 ms against
                    # 250 ms) than not bothering at all.
                    #
                    # Identical pixels cannot contain different text, so when
                    # the digest matches, the previous frame's reading is
                    # inherited and the new frame costs nothing. Watching a
                    # still document now costs one OCR pass in total instead of
                    # one every 400 ms.
                    #
                    # THIS IS NOT BACKGROUND ANALYSIS. Nothing is read that was
                    # not already asked for; a result computed on demand is
                    # carried forward, and nothing is carried when the screen
                    # has moved.
                    if (
                        previous is not None
                        and previous._ocr is not None
                        and previous.digest == frame.digest
                    ):
                        frame._ocr = previous._ocr
                        self._carried += 1
                    self._frames.append(frame)
                    # The ring. Bounded here and nowhere else.
                    while len(self._frames) > self.capacity:
                        self._frames.pop(0)
                self._captures += 1
            self._stop.wait(self.interval)

    # ----------------------------------------------------------------- access

    def latest(self, max_age: float | None = DEFAULT_MAX_AGE) -> Frame | None:
        """The most recent frame, or None when it is too old to be trusted.

        Reading also keeps the thread alive: `idle_timeout` measures time since
        the last question, not since the last capture.
        """
        self._last_read = time.monotonic()
        if not self.running:
            self.start()
        with self._lock:
            frame = self._frames[-1] if self._frames else None
        if frame is None:
            return None
        if max_age is not None and frame.age > max_age:
            return None
        return frame

    def frame_now(self) -> Frame:
        """A frame guaranteed to be current, captured synchronously if needed.

        The buffer is an optimisation, never a source of truth: when it has
        nothing recent enough this pays the capture cost rather than handing
        back a stale coordinate.
        """
        frame = self.latest()
        if frame is not None:
            return frame
        self.start()
        fresh = self._grab()
        if fresh is None:
            from core.perception import PerceptionUnavailable  # noqa: PLC0415

            raise PerceptionUnavailable(
                f"The screen could not be captured. {self._error or ''}".strip()
            )
        with self._lock:
            self._frames.append(fresh)
            while len(self._frames) > self.capacity:
                self._frames.pop(0)
        return fresh

    def fresh(self) -> Frame:
        """A frame captured RIGHT NOW, never one from the ring.

        `frame_now` is allowed to answer from the buffer, which is what makes
        the buffer worth having. That is exactly wrong for before/after
        comparison: two calls half a second apart both got the SAME cached
        frame, so the difference between them was zero and every action looked
        stagnant. A comparison against a frame taken before the action is not a
        comparison at all.
        """
        frame = self._grab()
        if frame is None:
            from core.perception import PerceptionUnavailable  # noqa: PLC0415

            raise PerceptionUnavailable(
                f"The screen could not be captured. {self._error or ''}".strip()
            )
        self._last_read = time.monotonic()
        with self._lock:
            self._frames.append(frame)
            while len(self._frames) > self.capacity:
                self._frames.pop(0)
        return frame

    def stats(self) -> dict[str, Any]:
        with self._lock:
            frames = list(self._frames)
        return {
            "running": self.running,
            "frames": len(frames),
            "captures": self._captures,
            "bytes": sum(len(f.data) for f in frames),
            "newestAgeMs": int(frames[-1].age * 1000) if frames else None,
            "analysed": sum(1 for f in frames if f._ocr is not None),
            # Frames that inherited a reading because the screen had not moved.
            # Each one is an OCR pass that did not have to happen.
            "carried": self._carried,
            "intervalMs": int(self.interval * 1000),
            "error": self._error,
        }


#: One buffer for the process. A second capture loop would double the cost and
#: halve the value, since both would be photographing the same screen.
buffer = ScreenBuffer()


def prewarm() -> dict[str, Any]:
    """Start watching now, before anybody asks.

    Called when the microphone opens or a request starts arriving, so the frame
    that answers "what is on my screen" was taken while the sentence was still
    being spoken rather than after it finished.
    """
    buffer.start()
    return buffer.stats()
