"""
"Hey OCADE" on the computer: heard locally, and only in Background/Wake Mode.

The microphone audio stays on this computer: a small local model
(core/wake_word.py, openwakeword) listens for the phrase, and nothing is sent
anywhere until it is heard. Then OCADE JARVIS opens with voice on, and from
that moment the person is talking to OCADE as if they had pressed Voice.

The model is `wake/hey_ocade.onnx` in the agent's home. OCADE does not ship
one yet, so until it exists wake is reported unavailable rather than faked
with another phrase.
"""
from __future__ import annotations

import webbrowser
from pathlib import Path

FRAME = 1280  # 80 ms at 16 kHz, what openwakeword expects


def model_path(home: Path) -> Path:
    return home / "wake" / "hey_ocade.onnx"


def available(home: Path) -> bool:
    from core import wake_word
    return wake_word.is_installed() and model_path(home).exists()


def open_voice(server: str) -> None:
    webbrowser.open(f"{server.rstrip('/')}/ocade-jarvis?voice=1")


def listen(home: Path, server: str, stop) -> bool:
    """Listen until `stop` is set. False when wake cannot run on this computer."""
    if not available(home):
        return False
    import sounddevice
    from core.wake_word import WakeWordDetector
    detector = WakeWordDetector(on_detect=lambda: open_voice(server), model=str(model_path(home)))
    if not detector.start():
        return False
    with sounddevice.InputStream(samplerate=16000, channels=1, dtype="int16", blocksize=FRAME,
                                 callback=lambda data, *_: detector.feed(data)):
        stop.wait()
    detector.stop()
    return True
