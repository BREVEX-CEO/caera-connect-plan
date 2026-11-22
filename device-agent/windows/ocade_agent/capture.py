"""OCADE LIVE VISION: one continuous capture per target window, shared (plan 14F.8-14F.10, V04-V06).

A window an agent watches gets ONE capture stream, kept in this worker and shared by every
watcher (every agent's desktop steps run in the one desktop lane, so one worker sees them all).
The stream is the operating system's own window capture where it exists, which delivers a frame
only when the window's content changes:

- Windows: Windows.Graphics.Capture for the window's HWND (Direct3D 11 frame pool, free-threaded).
- macOS: ScreenCaptureKit, an SCStream filtered to the one window (Screen Recording permission).
- Otherwise: a bounded capture of the window's rectangle at most AI_FPS times a second, labelled
  "polling" so nobody mistakes it for the native stream.

Frames stay on the computer. At most AI_FPS frames a second are turned into images; a frame that
looks the same as the last is not kept; only the latest KEEP are held (bounded memory); a stream
nobody has used for IDLE_SECONDS stops. Changed pixels are evidence of change only, never of a
saved result. A capture that ends (window gone, permission revoked) is reported as unavailable,
never replaced by a wider capture.
"""

from __future__ import annotations

import asyncio
import sys
import threading
import time
from collections import deque
from contextlib import contextmanager
from dataclasses import dataclass
from functools import cache

from PIL import Image

from . import vision
from .sandbox import Refused

KEEP = 8
AI_FPS = 4
IDLE_SECONDS = 20


@dataclass(frozen=True)
class Frame:
    seq: int
    at: float  # time.monotonic() when it arrived
    image: Image.Image


class Stream:
    """The latest distinct frames of one window, and who is waiting for the next one."""

    def __init__(self, start) -> None:
        self._frames: deque[Frame] = deque(maxlen=KEEP)
        self._ready = threading.Condition()
        self._seq = 0
        self.ended: str | None = None
        self.users = 0
        self.idle_since = time.monotonic()
        self.backend, self._stop = start(self._arrived, self._end)

    def _arrived(self, image: Image.Image) -> None:
        with self._ready:
            last = self._frames[-1] if self._frames else None
            if last is not None and not vision.changed(last.image, image):
                return
            self._seq += 1
            self._frames.append(Frame(self._seq, time.monotonic(), image))
            self._ready.notify_all()

    def _end(self, reason: str) -> None:
        with self._ready:
            self.ended = self.ended or reason
            self._ready.notify_all()

    def latest(self) -> Frame | None:
        with self._ready:
            return self._frames[-1] if self._frames else None

    def wait(self, after: int, timeout: float) -> Frame | None:
        """The first frame newer than `after`, or None when the time passes or the stream ends."""
        deadline = time.monotonic() + timeout
        with self._ready:
            while True:
                if self._frames and self._frames[-1].seq > after:
                    return next(frame for frame in self._frames if frame.seq > after)
                left = deadline - time.monotonic()
                if self.ended or left <= 0:
                    return None
                self._ready.wait(left)

    def since(self, seq: int) -> list[Frame]:
        with self._ready:
            return [frame for frame in self._frames if frame.seq >= seq]

    def close(self) -> None:
        self._end("closed")
        try:
            self._stop()
        except Exception:  # noqa: BLE001, S110 - a capture the OS already tore down
            pass


class Hub:
    """One stream per window key, opened on first use and closed after IDLE_SECONDS unused."""

    def __init__(self) -> None:
        self._streams: dict[str, Stream] = {}
        self._lock = threading.Lock()

    @contextmanager
    def use(self, key: str, start):
        with self._lock:
            now = time.monotonic()
            for other, stream in list(self._streams.items()):
                if stream.ended or (stream.users == 0 and now - stream.idle_since > IDLE_SECONDS):
                    self._streams.pop(other).close()
            stream = self._streams.get(key)
            if stream is None:
                stream = self._streams[key] = Stream(start)
            stream.users += 1
        try:
            yield stream
        finally:
            with self._lock:
                stream.users -= 1
                stream.idle_since = time.monotonic()


HUB = Hub()


def polling(grab):
    """The fallback source: the window's rectangle at most AI_FPS times a second."""

    def start(arrived, end):
        stop = threading.Event()

        def run():
            while not stop.is_set():
                try:
                    arrived(grab())
                except Refused as refused:
                    end(refused.code)
                    return
                except Exception:  # noqa: BLE001 - reported as an ended capture, never hidden
                    end("capture_failed")
                    return
                stop.wait(1 / AI_FPS)

        threading.Thread(target=run, daemon=True, name="ocade-capture").start()
        return "polling", stop.set

    return start


def _throttled(convert, arrived, end, stop: threading.Event, dirty: threading.Event):
    """Turn the newest native frame into an image at most AI_FPS times a second."""
    last = 0.0
    while not stop.is_set():
        if not dirty.wait(0.5):
            continue
        stop.wait(max(0.0, last + 1 / AI_FPS - time.monotonic()))
        dirty.clear()
        last = time.monotonic()
        try:
            image = convert()
        except Exception:  # noqa: BLE001 - reported as an ended capture, never hidden
            end("capture_failed")
            return
        if image is not None:
            arrived(image)


async def _copy(software_bitmap, surface):
    return await software_bitmap.create_copy_from_surface_async(surface)


def windows_graphics_capture(hwnd: int):
    """Windows.Graphics.Capture for one window: frames arrive only when its content changes."""

    def start(arrived, end):
        from winrt.windows.graphics.capture import Direct3D11CaptureFramePool
        from winrt.windows.graphics.capture.interop import create_for_window
        from winrt.windows.graphics.directx import DirectXPixelFormat
        from winrt.windows.graphics.directx.direct3d11.interop import (
            create_direct3d11_device,
        )
        from winrt.windows.graphics.imaging import (
            BitmapBufferAccessMode,
            SoftwareBitmap,
        )

        item = create_for_window(hwnd)
        device = create_direct3d11_device()
        size = item.size
        pool = Direct3D11CaptureFramePool.create_free_threaded(
            device, DirectXPixelFormat.B8_G8_R8_A8_UINT_NORMALIZED, 2, size)
        session = pool.create_capture_session(item)
        for setting in ("is_border_required", "is_cursor_capture_enabled"):
            try:
                setattr(session, setting, False)  # no yellow border, no pointer: only the app
            except Exception:  # noqa: BLE001, S110 - older Windows 10 builds keep the defaults
                pass
        stop, dirty = threading.Event(), threading.Event()
        current = {"size": (size.width, size.height)}

        def convert():
            newest = None
            while (frame := pool.try_get_next_frame()) is not None:
                if newest is not None:
                    newest.close()
                newest = frame
            if newest is None:
                return None
            try:
                content = newest.content_size
                if (content.width, content.height) != current["size"]:
                    current["size"] = (content.width, content.height)
                    pool.recreate(device, DirectXPixelFormat.B8_G8_R8_A8_UINT_NORMALIZED, 2, content)
                bitmap = asyncio.run(_copy(SoftwareBitmap, newest.surface))
            finally:
                newest.close()
            with bitmap.lock_buffer(BitmapBufferAccessMode.READ) as buffer:
                plane = buffer.get_plane_description(0)
                reference = buffer.create_reference()
                data = bytes(memoryview(reference))
            image = Image.frombuffer("RGBA", (bitmap.pixel_width, bitmap.pixel_height), data,
                                     "raw", "BGRA", plane.stride, 1)
            # The pool's surface can be larger than the window's content (the first frames, before
            # the pool is recreated at the content size): only the content is the window's picture,
            # so a still window gives same-sized, identical frames (hosted windows-2022 UIA-021).
            width, height = current["size"]
            return image.crop((0, 0, min(width, image.width), min(height, image.height))).convert("RGB")

        pool.add_frame_arrived(lambda *_: dirty.set())
        item.add_closed(lambda *_: end("window_gone"))
        session.start_capture()
        # The whole pipeline is proved on the first frame, or the fallback is used instead.
        if not dirty.wait(2) or (first := convert()) is None:
            session.close()
            pool.close()
            raise RuntimeError("no first frame")
        arrived(first)
        threading.Thread(target=_throttled, args=(convert, arrived, end, stop, dirty),
                         daemon=True, name="ocade-capture").start()

        def close():
            stop.set()
            session.close()
            pool.close()

        return "windows_graphics_capture", close

    return start


@cache
def _screen_capture_output_type():
    import objc  # type: ignore[import-not-found]
    from CoreMedia import CMSampleBufferGetImageBuffer  # type: ignore[import-not-found]
    from Foundation import NSObject  # type: ignore[import-not-found]

    # Objective-C registers each class name once per process, even across streams.
    class OcadeScreenCaptureOutput(NSObject, protocols=[objc.protocolNamed("SCStreamOutput"),
                                                       objc.protocolNamed("SCStreamDelegate")]):
        def stream_didOutputSampleBuffer_ofType_(self, _stream, sample, kind):
            if kind == 0:  # screen frames
                pixels = CMSampleBufferGetImageBuffer(sample)
                if pixels is not None and not self.stopping.is_set():
                    self.latest["pixels"] = pixels
                    self.dirty.set()

        def stream_didStopWithError_(self, _stream, _error):
            self.on_end("capture_stopped")

    return OcadeScreenCaptureOutput


def screen_capture_kit(window_id: int):
    """ScreenCaptureKit for one window (an SCStream with a single-window filter)."""

    def start(arrived, end):
        import Quartz  # type: ignore[import-not-found]
        import ScreenCaptureKit as SCK  # type: ignore[import-not-found]
        from CoreMedia import CMTimeMake  # type: ignore[import-not-found]

        found, ready = {}, threading.Event()

        def shareable(content, error):
            found["content"], found["error"] = content, error
            ready.set()

        SCK.SCShareableContent.getShareableContentExcludingDesktopWindows_onScreenWindowsOnly_completionHandler_(
            True, False, shareable)
        if not ready.wait(5) or found.get("error") is not None or found.get("content") is None:
            raise Refused("screen_recording_permission_needed")
        window = next((w for w in found["content"].windows() if w.windowID() == window_id), None)
        if window is None:
            raise Refused("window_gone")
        frame = window.frame()
        configuration = SCK.SCStreamConfiguration.alloc().init()
        configuration.setWidth_(max(1, int(frame.size.width * 2)))
        configuration.setHeight_(max(1, int(frame.size.height * 2)))
        configuration.setMinimumFrameInterval_(CMTimeMake(1, AI_FPS))
        configuration.setShowsCursor_(False)
        configuration.setPixelFormat_(1111970369)  # 'BGRA'
        content_filter = SCK.SCContentFilter.alloc().initWithDesktopIndependentWindow_(window)
        latest: dict = {}
        stop, dirty = threading.Event(), threading.Event()

        output = _screen_capture_output_type().alloc().init()
        output.latest, output.stopping, output.dirty, output.on_end = latest, stop, dirty, end
        stream = SCK.SCStream.alloc().initWithFilter_configuration_delegate_(content_filter, configuration, output)
        ok, _error = stream.addStreamOutput_type_sampleHandlerQueue_error_(output, 0, None, None)
        if not ok:
            raise Refused("capture_failed")
        started = threading.Event()

        def start_completed(error):
            found["start"] = error
            started.set()

        def stop_completed(_error):
            # The delegate must outlive the stream.
            output.latest.clear()

        def close():
            stop.set()
            stream.stopCaptureWithCompletionHandler_(stop_completed)

        stream.startCaptureWithCompletionHandler_(start_completed)
        if not started.wait(5) or found.get("start") is not None:
            raise Refused("screen_recording_permission_needed")

        def convert():
            pixels = latest.pop("pixels", None)
            if pixels is None:
                return None
            Quartz.CVPixelBufferLockBaseAddress(pixels, 1)
            try:
                width, height = Quartz.CVPixelBufferGetWidth(pixels), Quartz.CVPixelBufferGetHeight(pixels)
                stride = Quartz.CVPixelBufferGetBytesPerRow(pixels)
                base = Quartz.CVPixelBufferGetBaseAddress(pixels)
                data = bytes(base.as_buffer(stride * height))
            finally:
                Quartz.CVPixelBufferUnlockBaseAddress(pixels, 1)
            return Image.frombuffer("RGBA", (width, height), data, "raw", "BGRA", stride, 1).convert("RGB")

        try:
            if not dirty.wait(2) or (first := convert()) is None:
                raise RuntimeError("no first frame")
        except Exception:
            close()
            raise
        arrived(first)
        threading.Thread(target=_throttled, args=(convert, arrived, end, stop, dirty),
                         daemon=True, name="ocade-capture").start()

        return "screen_capture_kit", close

    return start


def native_or_polling(native, grab):
    """The operating system's window capture, else the bounded fallback (named as such)."""

    def start(arrived, end):
        try:
            return native(arrived, end)
        except Refused:
            raise
        except Exception as error:  # noqa: BLE001 - the native stream could not start
            if isinstance(error, ImportError):
                # Loader errors are local diagnostics. Receipts keep only the failure type.
                print(f"OCADE window capture bindings could not load: {error}", file=sys.stderr)
            _, stop = polling(grab)(arrived, end)
            # This label becomes a receipt. Exceptions can contain private window or file names.
            return f"polling ({type(error).__name__})", stop

    return start


def window_source(window: dict, grab):
    if sys.platform == "win32":
        return native_or_polling(windows_graphics_capture(int(window["hwnd"])), grab)
    if sys.platform == "darwin":
        return native_or_polling(screen_capture_kit(int(window["hwnd"])), grab)
    return polling(grab)


def keyframes(frames: list[Frame]) -> list[Frame]:
    """At most four, oldest first: the first and the three newest."""
    return frames[:1] + frames[-3:] if len(frames) > 4 else frames


def filmstrip(shown: list[Frame], height: int = 360) -> Image.Image:
    """Frames side by side, oldest first: a short ordered sequence for temporal context (V07)."""
    scaled = [frame.image.convert("RGB").resize(
        (max(1, frame.image.width * height // max(1, frame.image.height)), height)) for frame in shown]
    strip = Image.new("RGB", (sum(image.width for image in scaled) + 8 * (len(scaled) - 1), height), "white")
    x = 0
    for image in scaled:
        strip.paste(image, (x, 0))
        x += image.width + 8
    return strip


def watch(stream: Stream, region: list | None, timeout_ms: int, show: bool = False) -> dict:
    """`ui.watch` on the shared stream: from the window's current picture, wait until a region
    changes (compared locally, no model call per frame) or `timeout_ms` passes. With `show`, the
    ordered keyframes from the start to the change come back as one small picture."""
    started = time.monotonic()
    first = stream.latest() or stream.wait(0, max(0.5, timeout_ms / 1000))
    if first is None:
        raise Refused(stream.ended or "capture_unavailable")
    baseline = vision.view(first.image, region)
    seen, frames = first.seq, 1
    while True:
        left = timeout_ms / 1000 - (time.monotonic() - started)
        now = stream.wait(seen, max(0.0, left))
        waited = round((time.monotonic() - started) * 1000)
        if now is None:
            if stream.ended:
                raise Refused(stream.ended, waitedMs=waited, frames=frames)
            raise Refused("not_changed", waitedMs=waited, frames=frames, capture=stream.backend)
        seen, frames = now.seq, frames + 1
        regions = vision.changed_regions(baseline, vision.view(now.image, region))
        if regions:
            facts = {"changed": True, "regions": regions[:32], "waitedMs": waited, "frames": frames,
                     "capture": stream.backend}
            if show:
                from .sandbox import preview_jpeg

                shown = keyframes(stream.since(first.seq))
                facts["keyframesAtMs"] = [round((frame.at - first.at) * 1000) for frame in shown]
                facts["preview"] = preview_jpeg(filmstrip(
                    [Frame(f.seq, f.at, vision.view(f.image, region)) for f in shown]), 30_000)
            return facts
