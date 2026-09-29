"""
"Hey OCADE" on the computer: heard locally, and only in Background/Wake Mode.

The microphone audio stays on this computer: a small local model (openwakeword,
detector adapted from the donor's core/wake_word.py) listens for the phrase,
and nothing is sent anywhere until it is heard. Then OCADE JARVIS opens with
voice on.

The model is `wake/hey_ocade.onnx` in the agent's home. It is installed once,
only after its SHA-256 matches the release, and it lives in the agent's home,
so updates and restarts keep it. Until OCADE publishes the model, wake is
reported unavailable rather than faked with another phrase.
"""
from __future__ import annotations

import hashlib
import os
import queue
import threading
import urllib.request
import webbrowser
from pathlib import Path

FRAME = 1280  # 80 ms at 16 kHz, what openwakeword expects
THRESHOLD = 0.5


def model_path(home: Path) -> Path:
    return home / "wake" / "hey_ocade.onnx"


def _engine_present() -> bool:
    import importlib.util
    return importlib.util.find_spec("openwakeword") is not None


def available(home: Path) -> bool:
    return _engine_present() and model_path(home).exists()


def install(home: Path, url: str, sha256: str, opener=urllib.request.urlopen) -> bool:
    """Download the model once and keep it only if its hash matches. True when installed."""
    target = model_path(home)
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == sha256:
        return True  # already here: never downloaded again
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(".part")
    digest = hashlib.sha256()
    with opener(url, timeout=60) as response, open(partial, "wb") as out:
        while chunk := response.read(1 << 16):
            digest.update(chunk)
            out.write(chunk)
    if digest.hexdigest() != sha256:
        partial.unlink(missing_ok=True)
        return False
    os.replace(partial, target)
    return True


def open_voice(server: str) -> None:
    webbrowser.open(f"{server.rstrip('/')}/ocade-jarvis?voice=1")


class Detector:
    """Donor WakeWordDetector: the mic callback only queues; inference runs on its own thread."""

    def __init__(self, model: Path, on_detect):
        from openwakeword.model import Model
        self._model = Model(wakeword_models=[str(model)], inference_framework="onnx")
        self._on_detect = on_detect
        self._queue: queue.Queue = queue.Queue(maxsize=50)
        self._running = True
        threading.Thread(target=self._loop, daemon=True, name="ocade-wake").start()

    def feed(self, frame) -> None:
        if self._running:
            try:
                self._queue.put_nowait(frame[:, 0].copy() if getattr(frame, "ndim", 1) > 1 else frame.copy())
            except queue.Full:
                pass  # a busy moment drops audio, never blocks the microphone

    def stop(self) -> None:
        self._running = False
        self._queue.put(None)

    def _loop(self) -> None:
        import numpy as np
        while self._running:
            frame = self._queue.get()
            if frame is None:
                break
            scores = self._model.predict(np.asarray(frame, dtype=np.int16))
            if max((float(v) for v in scores.values()), default=0.0) >= THRESHOLD:
                while not self._queue.empty():  # one detection per utterance
                    self._queue.get_nowait()
                self._on_detect()


def listen(home: Path, server: str, stop) -> bool:
    """Listen until `stop` is set. False when wake cannot run on this computer."""
    if not available(home):
        return False
    import sounddevice
    detector = Detector(model_path(home), lambda: open_voice(server))
    with sounddevice.InputStream(samplerate=16000, channels=1, dtype="int16", blocksize=FRAME,
                                 callback=lambda data, *_: detector.feed(data)):
        stop.wait()
    detector.stop()
    return True
