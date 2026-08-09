from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

MAX_REQUEST_BYTES = 64 * 1024
MAX_TEXT = 4_000
MAX_COLLECTION = 64


class PolicyError(ValueError):
    """A request is outside the companion-owned capability contract."""


@dataclass(frozen=True)
class CommandPolicy:
    mutates: bool
    scope: str | None
    timeout_s: float


COMMANDS: dict[str, CommandPolicy] = {
    "health": CommandPolicy(False, None, 5),
    "system.read": CommandPolicy(False, None, 5),
    "apps.discover": CommandPolicy(False, "desktop.inspect", 30),
    "app.inspect": CommandPolicy(False, "desktop.inspect", 30),
    "windows.list": CommandPolicy(False, None, 5),
    "window.read": CommandPolicy(False, None, 8),
    "window.focus": CommandPolicy(True, "desktop.focus", 8),
    "app.launch": CommandPolicy(True, "desktop.launch", 10),
    "text.type": CommandPolicy(True, "desktop.input", 10),
    "pointer.move": CommandPolicy(True, "desktop.pointer", 5),
    "pointer.click": CommandPolicy(True, "desktop.pointer", 5),
    "key.press": CommandPolicy(True, "desktop.input", 5),
    "capture.frame": CommandPolicy(False, "screen.capture", 10),
    "ocr.window": CommandPolicy(False, "screen.ocr", 20),
    "vision.som": CommandPolicy(False, "screen.capture", 15),
    "gesture.probe": CommandPolicy(False, "camera.capture", 15),
    "gesture.run": CommandPolicy(True, "desktop.gesture", 3_600),
    "voice.devices": CommandPolicy(False, None, 5),
    "voice.capture": CommandPolicy(False, "microphone.capture", 30),
    "voice.transcribe": CommandPolicy(False, "microphone.transcribe", 300),
    "voice.speak": CommandPolicy(False, "speaker.output", 120),
    "adb.devices": CommandPolicy(False, "mobile.developer", 10),
    "emergency.stop": CommandPolicy(True, None, 2),
}

APP_ALIASES = {
    "notepad": ["notepad.exe"],
    "explorer": ["explorer.exe"],
    "calculator": ["calc.exe"],
}

DISCOVERED_APP_ID = re.compile(r"^winapp:[0-9a-f]{64}$")

SAFE_KEYS = {
    "enter",
    "esc",
    "tab",
    "space",
    "backspace",
    "delete",
    "left",
    "right",
    "up",
    "down",
    "home",
    "end",
    "pageup",
    "pagedown",
    "ctrl+c",
    "ctrl+v",
    "ctrl+a",
    "ctrl+s",
    "alt+tab",
}


def _bounded(value: Any, depth: int = 0) -> None:
    if depth > 6:
        raise PolicyError("request nesting is too deep")
    if isinstance(value, str):
        if len(value) > MAX_TEXT:
            raise PolicyError("string parameter exceeds the 4000-character limit")
    elif isinstance(value, dict):
        if len(value) > MAX_COLLECTION:
            raise PolicyError("object parameter has too many fields")
        for key, item in value.items():
            if not isinstance(key, str):
                raise PolicyError("object keys must be strings")
            _bounded(item, depth + 1)
    elif isinstance(value, list):
        if len(value) > MAX_COLLECTION:
            raise PolicyError("array parameter has too many items")
        for item in value:
            _bounded(item, depth + 1)
    elif value is not None and not isinstance(value, (bool, int, float)):
        raise PolicyError("unsupported parameter type")


def validate_request(payload: Any) -> tuple[str | int, str, dict[str, Any], CommandPolicy]:
    if not isinstance(payload, dict):
        raise PolicyError("request must be an object")
    _bounded(payload)
    request_id = payload.get("id")
    command = payload.get("command")
    params = payload.get("params", {})
    valid_id = (
        (isinstance(request_id, str) and bool(request_id) and len(request_id) <= 128)
        or (isinstance(request_id, int) and 0 < request_id < 2**63)
    )
    if not valid_id:
        raise PolicyError("request id is required and bounded")
    assert isinstance(request_id, (str, int))
    if not isinstance(command, str) or command not in COMMANDS:
        raise PolicyError("command is not allowlisted")
    if not isinstance(params, dict):
        raise PolicyError("params must be an object")
    policy = COMMANDS[command]
    if policy.scope is not None and (
        payload.get("approved") is not True or payload.get("scope") != policy.scope
    ):
        raise PolicyError(f"explicit {policy.scope} approval is required")
    if command == "app.launch":
        app = params.get("app")
        if not isinstance(app, str) or (
            app not in APP_ALIASES and DISCOVERED_APP_ID.fullmatch(app) is None
        ):
            raise PolicyError(
                "application must be an approved alias or a discovered application id"
            )
    if command == "app.inspect":
        app_id = params.get("appId")
        if not isinstance(app_id, str) or DISCOVERED_APP_ID.fullmatch(app_id) is None:
            raise PolicyError("application id must come from discovery")
    if command == "apps.discover" and not (
        isinstance(params.get("limit", 100), int) and 1 <= int(params.get("limit", 100)) <= 250
    ):
        raise PolicyError("application discovery limit must be between 1 and 250")
    if command == "key.press" and params.get("key") not in SAFE_KEYS:
        raise PolicyError("key chord is not allowlisted")
    for name in ("x", "y"):
        if name in params and not (
            isinstance(params[name], (int, float)) and 0 <= params[name] <= 1
        ):
            raise PolicyError(f"{name} must be a normalized coordinate")
    return request_id, command, params, policy
