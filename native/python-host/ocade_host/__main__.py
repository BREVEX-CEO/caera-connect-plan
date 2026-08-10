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

from . import act, audio, capture, desktop, observe, system, voice, workspace
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
    "input.type": act.type_text,
    "input.key": act.press_keys,
    "input.release": act.release_input,
    # Files, inside OCADE's own temporary folder and nowhere else.
    "workspace.info": workspace.workspace_info,
    "workspace.list": workspace.list_files,
    "workspace.read": workspace.read_file,
    "workspace.write": workspace.write_file,
    "workspace.copy": workspace.copy_file,
    "workspace.move": workspace.move_file,
    "workspace.discard": workspace.discard_file,
    "workspace.open": workspace.open_file,
    # Applications, displays and window placement.
    "app.launch": desktop.launch_application,
    "app.focus": desktop.focus_application,
    "display.list": desktop.list_displays,
    "window.arrange": desktop.arrange_window,
    # The microphone. Bounded listens only — see audio.py.
    "audio.microphones": audio.list_microphones,
    "audio.listen": audio.listen,
    # OCADE's own voice, from what this operating system already has.
    "voice.list": voice.list_voices,
    "voice.speak": voice.speak,
    "voice.render": voice.render_speech,
    "voice.clear_cache": voice.clear_cache,
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
        ("displays", _probe_displays),
        ("voice", _probe_voice),
        ("microphone", _probe_microphone),
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


def _probe_displays() -> int:
    return int(desktop.list_displays()["count"])


def _probe_voice() -> str:
    """Which free system voice OCADE would use here, named rather than assumed."""
    report = voice.list_voices()
    preferred = report.get("preferred")
    name = (preferred or {}).get("name") if isinstance(preferred, dict) else None
    return f"{report['engine']}: {name or 'system default'}"


def _probe_microphone() -> str:
    report = audio.list_microphones()
    return f"{report['count']} input device(s); {report['reason']}"


def main() -> None:
    if "--self-test" in sys.argv:
        sys.stdout.write(json.dumps(self_test()) + "\n")
        sys.stdout.flush()
        return
    serve(HANDLERS)


if __name__ == "__main__":
    main()
