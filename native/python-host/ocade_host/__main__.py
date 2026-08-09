"""OCADE native-control sidecar entry point.

The command table below is the whole of what this process can be asked to do.
There is no dispatcher that falls through to ``getattr``, no eval, no shell.
Adding a capability means adding a named function here, which is the point:
the surface is reviewable by reading one list.

Run ``python -m ocade_host --self-test`` to have it report what this machine
can actually support, in the same shape the browser host uses.
"""

from __future__ import annotations

import json
import sys

from . import act, capture, observe, system
from .protocol import PROTOCOL_VERSION, serve

HANDLERS = {
    # Observation — structure first.
    "window.list": observe.list_windows,
    "window.active": observe.active_window,
    "accessibility.tree": observe.accessibility_tree,
    # Observation — pixels, as fallback.
    "screen.capture": capture.capture_window,
    "screen.ocr": capture.ocr_window,
    # Action — semantic before physical.
    "window.focus": act.focus_window,
    "control.find": act.find_control,
    "control.invoke": act.invoke_control,
    "control.set_text": act.set_text,
    "pointer": act.pointer,
    "input.release": act.release_input,
    # Machine facts.
    "system.snapshot": system.snapshot,
    "system.processes": system.top_processes,
    "system.applications": system.installed_applications,
    "system.volume": system.set_volume,
}


def self_test() -> dict[str, object]:
    """Report real capability, never a hopeful list."""
    report: dict[str, object] = {"protocolVersion": PROTOCOL_VERSION, "commands": sorted(HANDLERS)}
    for name, probe in (
        ("uia", _probe_uia),
        ("capture", _probe_capture),
        ("ocr", _probe_ocr),
        ("input", _probe_input),
    ):
        try:
            report[name] = probe()
        except Exception as error:  # noqa: BLE001
            report[name] = f"unavailable: {type(error).__name__}: {error}"[:200]
    return report


def _probe_uia() -> bool:
    from pywinauto import Desktop

    Desktop(backend="uia")
    return True


def _probe_capture() -> str:
    import mss

    with mss.mss() as sct:
        return "mss" if sct.monitors else "none"


def _probe_ocr() -> str:
    from winsdk.windows.media.ocr import OcrEngine

    engine = OcrEngine.try_create_from_user_profile_languages()
    return engine.recognizer_language.language_tag if engine else "no-language"


def _probe_input() -> bool:
    import pyautogui

    pyautogui.position()
    return True


def main() -> None:
    if "--self-test" in sys.argv:
        sys.stdout.write(json.dumps(self_test()) + "\n")
        sys.stdout.flush()
        return
    serve(HANDLERS)


if __name__ == "__main__":
    main()
