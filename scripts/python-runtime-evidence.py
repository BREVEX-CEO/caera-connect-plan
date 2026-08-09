from __future__ import annotations

import base64
import importlib.metadata
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import dxcam
import pyautogui
import pyttsx3
from ocade_native.adb_adapter import probe_loopback_ports
from ocade_native.capture import capture_frame, ocr_window, set_of_mark
from ocade_native.gesture import run_camera
from ocade_native.system_adapter import read_system
from ocade_native.voice import capture as capture_voice
from ocade_native.voice import devices as voice_devices
from ocade_native.voice import speak, transcribe
from ocade_native.windows_adapter import launch_app, list_windows, virtual_screen
from pynput import keyboard
from pywinauto import Desktop

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "release" / "OCADE_PYTHON_RUNTIME_EVIDENCE.json"
MODEL_ROOT = Path(os.environ["LOCALAPPDATA"]) / "OCADE" / "models"
SENTINEL = "OCADE PYTHON OCR 73"

PACKAGES = [
    "pywin32",
    "pywinauto",
    "PyAutoGUI",
    "pynput",
    "psutil",
    "opencv-contrib-python",
    "mediapipe",
    "mss",
    "dxcam",
    "pytesseract",
    "sounddevice",
    "faster-whisper",
    "webrtcvad-wheels",
    "pyttsx3",
    "adb-shell",
    "pytest",
    "ruff",
    "mypy",
    "pyinstaller",
]

LICENSES = {
    "pywin32": "PSF-2.0",
    "pywinauto": "BSD-3-Clause",
    "PyAutoGUI": "BSD-3-Clause",
    "pynput": "LGPL-3.0-only",
    "psutil": "BSD-3-Clause",
    "opencv-contrib-python": "Apache-2.0",
    "mediapipe": "Apache-2.0",
    "mss": "MIT",
    "dxcam": "MIT",
    "pytesseract": "Apache-2.0",
    "sounddevice": "MIT",
    "faster-whisper": "MIT",
    "webrtcvad-wheels": "MIT",
    "pyttsx3": "MPL-2.0",
    "adb-shell": "Apache-2.0",
    "pytest": "MIT",
    "ruff": "MIT",
    "mypy": "MIT",
    "pyinstaller": "GPL-2.0-or-later WITH Bootloader-exception",
}


def observe(name: str, action: Callable[[], Any]) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        result = action()
        return {
            "name": name,
            "status": "passed",
            "elapsedMs": round((time.perf_counter() - started) * 1_000, 2),
            "result": result,
        }
    except Exception as error:  # noqa: BLE001 - evidence boundary records exact runtime failure
        return {
            "name": name,
            "status": "blocked",
            "elapsedMs": round((time.perf_counter() - started) * 1_000, 2),
            "error": {"type": type(error).__name__, "message": str(error)},
        }


def package_inventory() -> list[dict[str, str]]:
    result = []
    for package in PACKAGES:
        metadata = importlib.metadata.metadata(package)
        result.append(
            {
                "package": package,
                "version": importlib.metadata.version(package),
                "license": LICENSES[package],
                "homepage": metadata.get("Home-page", metadata.get("Project-URL", "")),
            }
        )
    return result


def pointer_round_trip() -> dict[str, Any]:
    original = pyautogui.position()
    screen = virtual_screen()
    target = (
        screen["left"] + max(20, screen["width"] // 3),
        screen["top"] + max(20, screen["height"] // 3),
    )
    started = time.perf_counter()
    pyautogui.moveTo(*target, duration=0)
    latency = (time.perf_counter() - started) * 1_000
    observed = pyautogui.position()
    pyautogui.moveTo(original.x, original.y, duration=0)
    if abs(observed.x - target[0]) > 2 or abs(observed.y - target[1]) > 2:
        raise RuntimeError(f"pointer readback mismatch: {observed} != {target}")
    listener = keyboard.Listener(on_press=lambda _key: None)
    listener.start()
    listener.stop()
    return {
        "requested": target,
        "observed": [observed.x, observed.y],
        "restored": [original.x, original.y],
        "moveAndReadbackMs": round(latency, 2),
        "pynputEmergencyListenerStarted": True,
    }


def dxcam_capture() -> dict[str, Any]:
    camera = dxcam.create(output_idx=0)
    try:
        started = time.perf_counter()
        frame = camera.grab()
        elapsed = (time.perf_counter() - started) * 1_000
        if frame is None:
            raise RuntimeError("DXCam returned no frame")
        return {"shape": list(frame.shape), "captureMs": round(elapsed, 2)}
    finally:
        camera.release()


def notepad_workflow() -> dict[str, Any]:
    before = {window["handle"] for window in list_windows(100)}
    launched = launch_app("notepad")
    deadline = time.monotonic() + 10
    window = None
    while time.monotonic() < deadline:
        candidates = [
            item
            for item in Desktop(backend="uia").windows(visible_only=True)
            if int(item.handle) not in before
            and "notepad" in item.window_text().lower()
        ]
        if candidates:
            window = candidates[0]
            break
        time.sleep(0.15)
    if window is None:
        raise RuntimeError("new Notepad window was not observed")
    handle = int(window.handle)
    window_spec = Desktop(backend="uia").window(handle=handle)
    try:
        window_spec.set_focus()
        controls = [
            control
            for control in window_spec.wrapper_object().descendants()
            if control.element_info.control_type in {"Document", "Edit"}
            and control.is_visible()
            and control.is_enabled()
        ]
        if not controls:
            raise RuntimeError(
                "Notepad exposed no visible UIA Document or Edit control"
            )
        document = max(
            controls,
            key=lambda control: (
                control.rectangle().width() * control.rectangle().height()
            ),
        )
        document.set_focus()
        typed_at = time.perf_counter()
        document.type_keys(SENTINEL, with_spaces=True, pause=0.01)
        type_ms = (time.perf_counter() - typed_at) * 1_000
        value = str(document.iface_value.CurrentValue)
        if SENTINEL not in value:
            raise RuntimeError(f"UIA readback missed sentinel: {value!r}")
        ocr = ocr_window(handle)
        compact_ocr = " ".join(str(ocr["text"]).upper().split())
        if SENTINEL not in compact_ocr:
            raise RuntimeError(f"OCR readback missed sentinel: {compact_ocr!r}")
        som = set_of_mark(handle)
        return {
            "pid": launched["pid"],
            "handle": handle,
            "typeAndReadbackMs": round(type_ms, 2),
            "uiaReadback": value,
            "ocrReadback": compact_ocr,
            "ocrMs": ocr["elapsedMs"],
            "setOfMarkCount": len(som["marks"]),
            "layoutHash": som["layoutHash"],
        }
    finally:
        try:
            window_spec.close()
            time.sleep(0.4)
            dialog = Desktop(backend="uia").window(title_re=".*Notepad.*")
            button = dialog.child_window(
                title_re="Don.t Save|Discard", control_type="Button"
            )
            if button.exists(timeout=1):
                button.click_input()
        except Exception:  # noqa: BLE001 - fallback closes only the process launched above
            subprocess.run(
                ["taskkill", "/PID", str(launched["pid"]), "/T", "/F"], check=False
            )


def gesture_probe() -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    return {
        **run_camera(
            MODEL_ROOT / "hand_landmarker.task",
            8,
            False,
            threading.Event(),
            events.append,
        ),
        "events": events,
        "cursorMutationEnabled": False,
    }


def tts_stt_round_trip() -> dict[str, Any]:
    text = "OCADE local voice verification seventy three"
    tts = speak(text, lambda _event: None)
    engine = pyttsx3.init("sapi5")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temporary:
        path = Path(temporary.name)
    try:
        engine.save_to_file(text, str(path))
        engine.runAndWait()
        payload = base64.b64encode(path.read_bytes()).decode("ascii")
        stt = transcribe(
            payload, "tiny.en", MODEL_ROOT / "whisper", lambda _event: None
        )
        normalized = stt["text"].lower()
        if "voice verification" not in normalized or "73" not in normalized:
            raise RuntimeError(
                f"STT did not recover the verification phrase: {stt['text']!r}"
            )
        return {"tts": tts, "stt": stt}
    finally:
        path.unlink(missing_ok=True)


def main() -> int:
    observations = [
        observe("python-packages", package_inventory),
        observe("psutil-system", read_system),
        observe("pyautogui-pynput-pointer", pointer_round_trip),
        observe(
            "mss-opencv-capture",
            lambda: {k: v for k, v in capture_frame(0).items() if k != "jpegBase64"},
        ),
        observe("dxcam-capture", dxcam_capture),
        observe("pywin32-pywinauto-notepad-ocr-som", notepad_workflow),
        observe("mediapipe-hand-landmarker-camera", gesture_probe),
        observe("voice-devices", voice_devices),
        observe(
            "microphone-capture-vad",
            lambda: {k: v for k, v in capture_voice(1).items() if k != "wavBase64"},
        ),
        observe("local-female-tts-and-stt", tts_stt_round_trip),
        observe("adb-readonly-probe", probe_loopback_ports),
        observe(
            "tesseract-version",
            lambda: subprocess.check_output(
                [r"C:\Program Files\Tesseract-OCR\tesseract.exe", "--version"],
                text=True,
                stderr=subprocess.STDOUT,
            ).splitlines()[0],
        ),
    ]
    summary = {
        "passed": sum(item["status"] == "passed" for item in observations),
        "blocked": sum(item["status"] == "blocked" for item in observations),
    }
    report = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(UTC).isoformat(),
        "target": "real-local-windows",
        "python": sys.version,
        "summary": summary,
        "observations": observations,
    }
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"output": str(OUTPUT), **summary}, indent=2))
    core = {
        "python-packages",
        "psutil-system",
        "pyautogui-pynput-pointer",
        "mss-opencv-capture",
        "pywin32-pywinauto-notepad-ocr-som",
        "tesseract-version",
    }
    return (
        1
        if any(
            item["name"] in core and item["status"] != "passed" for item in observations
        )
        else 0
    )


if __name__ == "__main__":
    raise SystemExit(main())
