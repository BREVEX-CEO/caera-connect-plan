from __future__ import annotations

import json
import os
import sys
import threading
import time
import traceback
from pathlib import Path
from typing import Any

from . import __version__
from .adb_adapter import probe_loopback_ports
from .application_discovery import discover_applications, inspect_application
from .capture import capture_frame, ocr_window, set_of_mark
from .gesture import run_camera
from .policy import MAX_REQUEST_BYTES, PolicyError, validate_request
from .system_adapter import read_system
from .voice import capture as capture_voice
from .voice import devices as voice_devices
from .voice import speak, transcribe
from .windows_adapter import (
    click_pointer,
    enable_dpi_awareness,
    focus_window,
    launch_app,
    list_windows,
    move_pointer,
    press_key,
    read_window,
    type_text,
)

ROOT = Path(__file__).resolve().parents[1]
MODEL_ROOT = Path(os.environ.get("LOCALAPPDATA", str(ROOT))) / "OCADE" / "models"
BUNDLED_ROOT = Path(getattr(sys, "_MEIPASS", ROOT))
STOP = threading.Event()
WRITE_LOCK = threading.Lock()


def emit(payload: dict[str, Any]) -> None:
    encoded = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    with WRITE_LOCK:
        sys.stdout.write(encoded + "\n")
        sys.stdout.flush()


def progress(request_id: str | int, payload: dict[str, Any]) -> None:
    emit({"id": request_id, "event": payload})


def execute(command: str, params: dict[str, Any], request_id: str | int) -> Any:
    match command:
        case "health":
            return {
                "version": __version__,
                "pid": os.getpid(),
                "transport": "inherited-stdio-only",
                "networkListener": False,
            }
        case "system.read":
            return read_system()
        case "apps.discover":
            return discover_applications(int(params.get("limit", 100)))
        case "app.inspect":
            return inspect_application(str(params["appId"]))
        case "windows.list":
            return list_windows(int(params.get("limit", 40)))
        case "window.read":
            return read_window(int(params["handle"]))
        case "window.focus":
            return focus_window(int(params["handle"]))
        case "app.launch":
            return launch_app(str(params["app"]))
        case "text.type":
            return type_text(int(params["handle"]), str(params["text"]))
        case "pointer.move":
            return move_pointer(
                float(params["x"]), float(params["y"]), int(params.get("durationMs", 0))
            )
        case "pointer.click":
            return click_pointer(
                float(params["x"]), float(params["y"]), str(params.get("button", "left"))
            )
        case "key.press":
            return press_key(str(params["key"]))
        case "capture.frame":
            return capture_frame(int(params.get("monitor", 0)), params.get("redact", []))
        case "ocr.window":
            return ocr_window(int(params["handle"]))
        case "vision.som":
            return set_of_mark(int(params["handle"]))
        case "gesture.probe" | "gesture.run":
            STOP.clear()
            installed_model = MODEL_ROOT / "hand_landmarker.task"
            bundled_model = BUNDLED_ROOT / "models" / "hand_landmarker.task"
            model = installed_model if installed_model.is_file() else bundled_model
            return run_camera(
                model,
                float(params.get("durationSeconds", 5)),
                command == "gesture.run",
                STOP,
                lambda event: progress(request_id, event),
            )
        case "voice.devices":
            return voice_devices()
        case "voice.capture":
            return capture_voice(float(params.get("seconds", 2)), params.get("device"))
        case "voice.transcribe":
            return transcribe(
                str(params["wavBase64"]),
                str(params.get("model", "tiny.en")),
                MODEL_ROOT / "whisper",
                lambda event: progress(request_id, event),
            )
        case "voice.speak":
            return speak(str(params["text"]), lambda event: progress(request_id, event))
        case "adb.devices":
            return probe_loopback_ports()
        case "emergency.stop":
            STOP.set()
            return {"stopped": True}
        case _:
            raise PolicyError("command is not implemented")


def handle(payload: Any) -> None:
    request_id = payload.get("id", "invalid") if isinstance(payload, dict) else "invalid"
    started = time.perf_counter()
    try:
        request_id, command, params, _ = validate_request(payload)
        result = execute(command, params, request_id)
        emit(
            {
                "id": request_id,
                "ok": True,
                "result": result,
                "elapsedMs": round((time.perf_counter() - started) * 1_000, 2),
            }
        )
    except Exception as error:
        emit(
            {
                "id": request_id,
                "ok": False,
                "error": {"type": type(error).__name__, "message": str(error)[:2_000]},
                "elapsedMs": round((time.perf_counter() - started) * 1_000, 2),
            }
        )
        if os.environ.get("OCADE_PYTHON_DEBUG") == "1":
            traceback.print_exc(file=sys.stderr)


def main() -> int:
    enable_dpi_awareness()
    workers: list[threading.Thread] = []
    for raw in sys.stdin.buffer:
        if len(raw) > MAX_REQUEST_BYTES:
            emit(
                {
                    "id": "invalid",
                    "ok": False,
                    "error": {"type": "PolicyError", "message": "request exceeds 64 KiB"},
                }
            )
            continue
        try:
            payload = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            emit(
                {
                    "id": "invalid",
                    "ok": False,
                    "error": {"type": "PolicyError", "message": "invalid JSON"},
                }
            )
            continue
        worker = threading.Thread(target=handle, args=(payload,), daemon=False)
        workers.append(worker)
        worker.start()
    STOP.set()
    for worker in workers:
        worker.join(timeout=5)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
