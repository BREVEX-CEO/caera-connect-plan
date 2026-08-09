from __future__ import annotations

import ctypes
import subprocess
import time
from typing import Any

import pyautogui
import win32gui
from pywinauto import Desktop
from pywinauto.application import Application

from .application_discovery import resolve_discovered_executable
from .policy import APP_ALIASES, SAFE_KEYS, PolicyError

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.02


def enable_dpi_awareness() -> None:
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except (AttributeError, OSError):
        ctypes.windll.user32.SetProcessDPIAware()


def virtual_screen() -> dict[str, int]:
    user32 = ctypes.windll.user32
    return {
        "left": int(user32.GetSystemMetrics(76)),
        "top": int(user32.GetSystemMetrics(77)),
        "width": int(user32.GetSystemMetrics(78)),
        "height": int(user32.GetSystemMetrics(79)),
    }


def list_windows(limit: int = 40) -> list[dict[str, Any]]:
    active = win32gui.GetForegroundWindow()
    result: list[dict[str, Any]] = []
    for window in Desktop(backend="uia").windows(visible_only=True):
        try:
            handle = int(window.handle)
            rectangle = window.rectangle()
            title = window.window_text().strip()
            if not title or rectangle.width() < 2 or rectangle.height() < 2:
                continue
            result.append(
                {
                    "handle": handle,
                    "title": title[:300],
                    "active": handle == active,
                    "rectangle": {
                        "left": rectangle.left,
                        "top": rectangle.top,
                        "right": rectangle.right,
                        "bottom": rectangle.bottom,
                    },
                }
            )
        except (RuntimeError, OSError):
            continue
        if len(result) >= max(1, min(limit, 100)):
            break
    return result


def read_window(handle: int) -> dict[str, Any]:
    window = Desktop(backend="uia").window(handle=handle)
    controls: list[dict[str, Any]] = []
    for control in window.descendants()[:300]:
        try:
            rectangle = control.rectangle()
            controls.append(
                {
                    "type": control.element_info.control_type,
                    "name": control.window_text()[:500],
                    "automationId": control.element_info.automation_id,
                    "enabled": control.is_enabled(),
                    "visible": control.is_visible(),
                    "rectangle": [rectangle.left, rectangle.top, rectangle.right, rectangle.bottom],
                }
            )
        except (RuntimeError, OSError):
            continue
    return {"handle": handle, "title": window.window_text(), "controls": controls}


def launch_app(alias: str) -> dict[str, Any]:
    command = APP_ALIASES.get(alias)
    if command is None:
        discovered = resolve_discovered_executable(alias)
        command = [discovered] if discovered else None
    if command is None:
        raise PolicyError("application was not returned by the current discovery session")
    process = subprocess.Popen(command, close_fds=True)
    return {"pid": process.pid, "app": alias}


def focus_window(handle: int) -> dict[str, Any]:
    window = Desktop(backend="uia").window(handle=handle)
    window.set_focus()
    time.sleep(0.1)
    return {"handle": handle, "active": win32gui.GetForegroundWindow() == handle}


def type_text(handle: int, text: str) -> dict[str, Any]:
    if not text or len(text) > 4_000:
        raise PolicyError("text must contain 1 to 4000 characters")
    window = Application(backend="uia").connect(handle=handle).window(handle=handle)
    window.set_focus()
    focused = Desktop(backend="uia").get_active()
    focused.type_keys(text, with_spaces=True, set_foreground=False, pause=0.002)
    return {"handle": handle, "characters": len(text)}


def _pixel(x: float, y: float) -> tuple[int, int]:
    screen = virtual_screen()
    return (
        screen["left"] + round(x * max(0, screen["width"] - 1)),
        screen["top"] + round(y * max(0, screen["height"] - 1)),
    )


def move_pointer(x: float, y: float, duration_ms: int = 0) -> dict[str, Any]:
    px, py = _pixel(x, y)
    pyautogui.moveTo(px, py, duration=max(0, min(duration_ms, 2_000)) / 1_000)
    observed = pyautogui.position()
    return {"requested": [px, py], "observed": [observed.x, observed.y]}


def click_pointer(x: float, y: float, button: str = "left") -> dict[str, Any]:
    if button not in {"left", "right", "middle"}:
        raise PolicyError("unsupported pointer button")
    px, py = _pixel(x, y)
    pyautogui.click(px, py, button=button)
    return {"point": [px, py], "button": button}


def press_key(key: str) -> dict[str, Any]:
    if key not in SAFE_KEYS:
        raise PolicyError("key chord is not allowlisted")
    parts = key.split("+")
    if len(parts) == 1:
        pyautogui.press(parts[0])
    else:
        pyautogui.hotkey(*parts)
    return {"key": key}
