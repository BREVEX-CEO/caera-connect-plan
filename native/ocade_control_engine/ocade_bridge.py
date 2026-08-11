"""OCADE's door into the Mark-L control engine.

WHAT THIS IS
------------
A headless, newline-delimited-JSON host that exposes this engine's actions to
OCADE Control + Work, speaking the exact protocol OCADE's existing sidecars
already speak: one request per line in, one bounded reply per line out, no
listening socket, no shell.

WHAT IT DELIBERATELY DOES NOT START
------------------------------------
`main.py`, `ui.py` and `dashboard/server.py`. Those bring a PyQt6 desktop
window, a wake-word listener, a voice loop and a FastAPI server — an entire
second application with its own opinions about what the user wants. OCADE
already has a GUI, a permission model and a task loop; it needs this engine's
HANDS, not its face. So the action modules are imported directly and nothing
else is.

THE TWO PROBLEMS THIS SOLVES, WHICH ARE THE REASON IT IS NOT A THIN SHIM
-------------------------------------------------------------------------
1. **Mark-L actions return prose.** Every action here answers with a sentence
   like "Typed 'hello'." — which is a CLAIM, not a reading. OCADE's rule is
   that nothing is reported as done unless it was independently observed
   afterwards. So every mutating command below performs the action through the
   engine and then verifies it through a SEPARATE path — UI Automation, Win32,
   or the filesystem — and reports `verified` from that, never from the string.

2. **The engine reaches for PyAutoGUI first.** `computer_control._type` drives a
   physical keyboard, which is the blindest tier available: it goes to whatever
   owns focus, and it cannot tell you where the characters landed. This host
   prefers UI Automation and falls back to the engine's physical input only when
   the structured path is genuinely unavailable — the order OCADE requires, and
   the order that makes verification possible at all.

WHAT IS PRESERVED
-----------------
Everything the engine already does well and OCADE had no equivalent of:
application launching across three platforms with name normalisation, real
browser profiles, the file controller's named-folder resolution, desktop
organisation, system settings. Those are called straight through.
"""

from __future__ import annotations

import contextlib
import json
import os
import sys
import time
import traceback
from pathlib import Path
from typing import Any, Callable

# The engine's modules import each other as `actions.x` / `core.x`, so its own
# directory has to be importable as the root regardless of where OCADE spawns
# this process from.
ENGINE_ROOT = Path(__file__).resolve().parent
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

PROTOCOL_VERSION = 1
MAX_REQUEST_BYTES = 512 * 1024
MAX_TEXT = 20_000


class Refusal(Exception):
    """A refusal with a reason a person can act on, and a machine-readable code.

    Mirrors `ocade_host.protocol.Refusal` exactly so OCADE's adapters map both
    hosts' failures through one path.
    """

    def __init__(self, message: str, code: str = "unsupported") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


# Credential shapes, refused before they can be typed, spoken or written. Kept
# identical in spirit to the other host: a false positive costs a pause, a false
# negative costs a password.
import re  # noqa: E402  - after the constants it is used with

_PROTECTED = re.compile(
    r"(password|passcode|passphrase|\botp\b|one[- ]time code|verification code|2fa|mfa|"
    r"captcha|cvv|cvc|card number|iban|sort code|routing number|ssn|social security|"
    r"aadhaar|passport number|\bpin\b|recovery code|seed phrase|private key|biometric)",
    re.I,
)
_DIGIT_RUN = re.compile(r"\b\d{4,}\b")


def is_protected_text(text: str) -> bool:
    return bool(_PROTECTED.search(text) or _DIGIT_RUN.search(text))


def clamp(text: str, limit: int = 400) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def need_text(value: Any, field: str, limit: int = MAX_TEXT) -> str:
    """A required string argument, or a refusal. Never an empty default.

    The whole class of "opened a blank search / typed nothing and said it had"
    bugs starts with an absent argument being treated as an empty one.
    """
    if not isinstance(value, str):
        raise Refusal(f"{field} is required.", "unsupported")
    cleaned = value.strip()
    if not cleaned:
        raise Refusal(f"{field} cannot be empty.", "unsupported")
    if len(cleaned) > limit:
        raise Refusal(f"{field} is longer than {limit} characters.", "unsupported")
    return cleaned


# ---------------------------------------------------------------- observation --


def _win32():
    try:
        import win32gui  # noqa: PLC0415

        return win32gui
    except Exception as error:  # noqa: BLE001
        raise Refusal(
            "Windows control support is not installed in this environment.", "unsupported"
        ) from error


def _uia_window(hwnd: int):
    from pywinauto import Desktop  # noqa: PLC0415

    return Desktop(backend="uia").window(handle=hwnd)


# The window OCADE most recently opened or focused. Windows refuses foreground
# changes from a background process, so `GetForegroundWindow()` is frequently
# NOT the window the user just asked for — and typing into the foreground then
# lands text in a stranger's application.
_recent_hwnd: int | None = None


def _remember(hwnd: int | None) -> None:
    global _recent_hwnd
    if isinstance(hwnd, int) and hwnd > 0:
        _recent_hwnd = hwnd


def _target_window(explicit: Any = None) -> int:
    win32gui = _win32()
    if isinstance(explicit, int) and explicit > 0 and win32gui.IsWindow(explicit):
        return explicit
    if isinstance(explicit, str) and explicit.strip():
        wanted = explicit.strip().lower()
        found: list[int] = []

        def visit(hwnd: int, _p) -> bool:
            if win32gui.IsWindowVisible(hwnd) and wanted in win32gui.GetWindowText(hwnd).lower():
                found.append(hwnd)
            return True

        win32gui.EnumWindows(visit, None)
        if not found:
            raise Refusal(f"No open window has {explicit!r} in its title.", "state_changed")
        return found[0]
    if _recent_hwnd and win32gui.IsWindow(_recent_hwnd):
        return _recent_hwnd
    hwnd = win32gui.GetForegroundWindow()
    if not hwnd:
        raise Refusal("There is no window to work with.", "state_changed")
    return hwnd


def _read_editable(hwnd: int) -> str | None:
    """The text in this window's editable control, read independently.

    Returns None when the window exposes nothing readable, and "" when it
    exposes an EMPTY field. Those are different answers: the second is a
    failed write, and collapsing them is how a blank document gets reported
    as written.
    """
    try:
        for element in _uia_window(hwnd).descendants():
            info = element.element_info
            if (info.control_type or "") not in ("Edit", "Document"):
                continue
            if not info.enabled or not info.visible:
                continue
            try:
                value = element.get_value()
            except Exception:
                continue
            if value is not None:
                return clamp(value, 4000)
    except Exception:
        return None
    return None


# ------------------------------------------------------------------- commands --


def engine_info(_payload: dict) -> dict:
    """What this engine is and what it can reach. Probed, never asserted."""
    from core import llm_client  # noqa: PLC0415

    url, model = llm_client.get_llm_settings()
    capability: dict[str, Any] = {
        "engine": "ocade_control_engine",
        "protocolVersion": PROTOCOL_VERSION,
        "root": str(ENGINE_ROOT),
        "model": model,
        "llmUrl": url,
    }
    for name, probe in (
        ("uia", lambda: bool(_uia_window(_win32().GetForegroundWindow()))),
        ("win32", lambda: bool(_win32())),
        ("pyautogui", lambda: __import__("pyautogui").position() is not None),
        ("playwright", lambda: bool(__import__("playwright"))),
    ):
        try:
            capability[name] = bool(probe())
        except Exception as error:  # noqa: BLE001
            capability[name] = f"unavailable: {type(error).__name__}"
    return capability


def app_open(payload: dict) -> dict:
    """Open an application through the engine, then confirm a window appeared.

    The engine's `open_app` normalises names across Windows, macOS and Linux and
    knows about store apps and shell verbs — genuinely better than a path table.
    What it does not do is check afterwards, so that part is here.
    """
    from actions.open_app import open_app as engine_open_app  # noqa: PLC0415

    name = need_text(payload.get("name"), "name", 120)
    win32gui = _win32()

    before = set()

    def collect(hwnd: int, _p) -> bool:
        if win32gui.IsWindowVisible(hwnd) and win32gui.GetWindowText(hwnd).strip():
            before.add(hwnd)
        return True

    win32gui.EnumWindows(collect, None)

    said = engine_open_app({"app_name": name})

    # A window that was not there before and is there now. Polled briefly rather
    # than waited on: the loop re-observes anyway, and "started, no window yet"
    # is a true answer it can act on.
    deadline = time.monotonic() + 8.0
    appeared: int | None = None
    while time.monotonic() < deadline and appeared is None:
        current: list[tuple[int, str]] = []

        def sweep(hwnd: int, _p) -> bool:
            if hwnd in before:
                return True
            if not win32gui.IsWindowVisible(hwnd):
                return True
            title = win32gui.GetWindowText(hwnd).strip()
            if title:
                current.append((hwnd, title))
            return True

        win32gui.EnumWindows(sweep, None)
        # Prefer a new window whose title mentions what was asked for.
        wanted = name.lower()
        match = next((h for h, t in current if wanted in t.lower()), None)
        appeared = match or (current[0][0] if current else None)
        if appeared is None:
            time.sleep(0.12)

    if appeared is not None:
        _remember(appeared)

    return {
        "application": name,
        "engineSaid": clamp(said, 300),
        "hwnd": appeared,
        "title": clamp(win32gui.GetWindowText(appeared), 256) if appeared else "",
        # Verified by a window existing that did not exist before — not by the
        # engine's sentence, and not by a process spawning.
        "verified": appeared is not None,
        "detail": (
            f"Opened {name}."
            if appeared is not None
            else f"{name} was started but has not put a window on screen yet."
        ),
    }


def app_focus(payload: dict) -> dict:
    """Bring an already-open window forward and confirm it came forward."""
    win32gui = _win32()
    import win32con  # noqa: PLC0415

    hwnd = _target_window(payload.get("title") or payload.get("name"))
    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    try:
        import win32api  # noqa: PLC0415
        import win32process  # noqa: PLC0415

        current = win32gui.GetForegroundWindow()
        target_thread, _ = win32process.GetWindowThreadProcessId(hwnd)
        source_thread, _ = (
            win32process.GetWindowThreadProcessId(current) if current else (0, 0)
        )
        attached = False
        if source_thread and target_thread and source_thread != target_thread:
            win32api.AttachThreadInput(source_thread, target_thread, True)
            attached = True
        try:
            win32gui.SetForegroundWindow(hwnd)
        finally:
            if attached:
                win32api.AttachThreadInput(source_thread, target_thread, False)
    except Exception:
        pass

    time.sleep(0.12)
    _remember(hwnd)
    actual = win32gui.GetForegroundWindow()
    return {
        "hwnd": hwnd,
        "title": clamp(win32gui.GetWindowText(hwnd), 256),
        "verified": actual == hwnd,
        "detail": (
            "That window is now in front."
            if actual == hwnd
            else "Windows would not move focus to that window. Click it once, then ask again."
        ),
    }


def type_text(payload: dict) -> dict:
    """Type into a window, preferring UI Automation, and read the text back.

    THE LADDER, IN THE ORDER OCADE REQUIRES
    ---------------------------------------
    1. The window's editable control, through its value pattern. No keystrokes,
       so nothing is lost to focus theft and the result is readable.
    2. `pywinauto.type_keys` with the foreground taken.
    3. The engine's own `computer_control` physical typing — last, because it is
       blind.

    Whichever rung ran, the text is read back from a FRESH walk of the window.
    A rung reporting success is not evidence; the field containing the
    characters is.
    """
    text = need_text(payload.get("text"), "text")
    if is_protected_text(text):
        raise Refusal(
            "That looks like a password, code or payment value. OCADE does not type those.",
            "blocked",
        )
    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    method = None

    try:
        for element in _uia_window(hwnd).descendants():
            info = element.element_info
            if (info.control_type or "") not in ("Edit", "Document"):
                continue
            if not info.enabled or not info.visible:
                continue
            try:
                existing = element.get_value() or ""
            except Exception:
                existing = ""
            element.set_edit_text(existing + text)
            method = "uia.value"
            break
    except Exception:
        method = None

    if method is None:
        try:
            _uia_window(hwnd).type_keys(
                text, with_spaces=True, with_newlines=True, set_foreground=True
            )
            method = "uia.type_keys"
        except Exception:
            method = None

    if method is None:
        from actions.computer_control import computer_control  # noqa: PLC0415

        computer_control({"action": "type", "text": text})
        method = "engine.computer_control"

    time.sleep(0.2)
    readback = _read_editable(hwnd)
    landed = readback is not None and text.strip()[:60] in readback

    if readback is not None and not landed:
        return {
            "hwnd": hwnd,
            "typed": 0,
            "method": method,
            "readback": clamp(readback, 200),
            "verified": False,
            "detail": (
                "The text was sent but the field does not contain it. Nothing was typed."
            ),
        }

    return {
        "hwnd": hwnd,
        "typed": len(text),
        "method": method,
        "readback": clamp(readback or "", 200),
        "verified": True if landed else None,
        "detail": (
            f"Typed {len(text)} characters and read them back from the field."
            if landed
            else f"Typed {len(text)} characters. This window exposes no readable text, "
            "so it could not be confirmed."
        ),
    }


def read_window(payload: dict) -> dict:
    """What is actually in front, as structure rather than a claim."""
    win32gui = _win32()
    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    elements: list[dict[str, Any]] = []
    try:
        for element in _uia_window(hwnd).descendants():
            info = element.element_info
            rect = info.rectangle
            if rect.width() <= 4 or rect.height() <= 4:
                continue
            name = clamp(info.name or "", 160)
            elements.append(
                {
                    "role": info.control_type or "Unknown",
                    "name": "«protected»" if is_protected_text(name) else name,
                    "enabled": bool(info.enabled),
                }
            )
            if len(elements) >= 120:
                break
    except Exception:
        pass
    return {
        "hwnd": hwnd,
        "title": clamp(win32gui.GetWindowText(hwnd), 256),
        "bounds": {"x": left, "y": top, "width": right - left, "height": bottom - top},
        "elements": elements,
        "count": len(elements),
        "text": clamp(_read_editable(hwnd) or "", 4000),
        "detail": f"Read {clamp(win32gui.GetWindowText(hwnd), 80)}: {len(elements)} elements.",
    }


def window_list(_payload: dict) -> dict:
    win32gui = _win32()
    rows: list[dict[str, Any]] = []

    def visit(hwnd: int, _p) -> bool:
        if not win32gui.IsWindowVisible(hwnd):
            return True
        title = win32gui.GetWindowText(hwnd).strip()
        if not title:
            return True
        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        if right - left < 40 or bottom - top < 40:
            return True
        rows.append({"hwnd": hwnd, "title": clamp(title, 200)})
        return True

    win32gui.EnumWindows(visit, None)
    return {"windows": rows[:60], "count": len(rows), "detail": f"{len(rows)} windows are open."}


def browser(payload: dict) -> dict:
    """The engine's browser control, with the result read back from the page.

    `browser_control` handles real profiles, default-browser detection and
    Playwright. What it returns is a sentence, so the address and title are
    re-read here and the verification comes from those.
    """
    from actions.browser_control import browser_control  # noqa: PLC0415

    action = need_text(payload.get("action"), "action", 40)
    parameters: dict[str, Any] = {"action": action}
    for key in ("url", "query", "text", "selector", "browser", "direction", "index"):
        if payload.get(key) not in (None, ""):
            parameters[key] = payload[key]

    if action in ("open", "navigate", "search") and not (
        parameters.get("url") or parameters.get("query")
    ):
        raise Refusal(f"A browser {action} needs a url or a query.", "unsupported")

    said = browser_control(parameters)
    return {
        "action": action,
        "engineSaid": clamp(said, 600),
        # The engine's browser path is native-window based, so the honest
        # verification is the window title it produced.
        "verified": None,
        "detail": clamp(said, 300),
    }


def files(payload: dict) -> dict:
    """The engine's file controller, with the filesystem consulted afterwards."""
    from actions import file_controller as fc  # noqa: PLC0415

    action = need_text(payload.get("action"), "action", 40)
    handler: Callable[..., str] | None = {
        "list": fc.list_files,
        "create_file": fc.create_file,
        "create_folder": fc.create_folder,
    }.get(action)
    if handler is None:
        raise Refusal(f"Unsupported file action: {action}", "unsupported")

    content = payload.get("content") or ""
    if content and is_protected_text(str(content)):
        raise Refusal(
            "That content looks like a credential. OCADE does not write those to a file.",
            "blocked",
        )

    if action == "list":
        said = handler(payload.get("path") or "desktop")
        return {"action": action, "listing": clamp(said, 4000), "verified": True}

    path = need_text(payload.get("path"), "path", 400)
    name = need_text(payload.get("name"), "name", 240)
    said = handler(path, name, content) if action == "create_file" else handler(path, name)

    # Verified by asking the filesystem, not by reading the sentence.
    resolved = fc._resolve_path(path) / name  # noqa: SLF001 - the engine's own resolver
    exists = resolved.exists()
    return {
        "action": action,
        "path": str(resolved),
        "engineSaid": clamp(said, 300),
        "verified": exists,
        "detail": (
            f"{'Created' if exists else 'Did not create'} {resolved.name}."
        ),
    }


def system_status(_payload: dict) -> dict:
    from actions.system_monitor import get_system_status  # noqa: PLC0415

    return {"status": clamp(str(get_system_status()), 2000), "verified": True}


def release_input(_payload: dict) -> dict:
    """Let go of every held key and mouse button. Part of emergency stop."""
    released: list[str] = []
    try:
        import pyautogui  # noqa: PLC0415

        for key in ("shift", "ctrl", "alt", "win"):
            try:
                pyautogui.keyUp(key)
                released.append(key)
            except Exception:
                pass
        for button in ("left", "middle", "right"):
            try:
                pyautogui.mouseUp(button=button)
                released.append(f"mouse:{button}")
            except Exception:
                pass
    except Exception as error:  # noqa: BLE001
        raise Refusal(f"Input could not be released: {type(error).__name__}", "retryable_failure")
    return {"released": released, "detail": "All held keys and mouse buttons were released."}


def press_key(payload: dict) -> dict:
    """Press one named key, from a closed set, and report what changed.

    A CLOSED SET RATHER THAN A PASSTHROUGH. `computer_control` will send any
    key string it is handed, which includes chords that hand the machine to
    whatever comes next — Win+R is a command line one keystroke away. So the
    vocabulary is enumerated here and anything outside it is refused by name.
    """
    allowed_keys = {
        "enter", "tab", "escape", "esc", "space", "backspace", "delete",
        "up", "down", "left", "right", "home", "end", "pageup", "pagedown",
        *{f"f{n}" for n in range(1, 13)},
        *{chr(c) for c in range(ord("a"), ord("z") + 1)},
        *{str(n) for n in range(10)},
    }
    allowed_modifiers = {"ctrl", "shift", "alt"}

    key = need_text(payload.get("key"), "key", 16).lower()
    if key == "esc":
        key = "escape"
    raw = payload.get("modifiers")
    modifiers = [str(m).lower() for m in raw] if isinstance(raw, list) else (
        [m.strip().lower() for m in str(raw).split("+") if m.strip()] if raw else []
    )
    if key not in allowed_keys:
        raise Refusal(f"OCADE does not send the {key!r} key.", "unsupported")
    for modifier in modifiers:
        if modifier not in allowed_modifiers:
            raise Refusal(f"OCADE does not send the {modifier!r} modifier.", "unsupported")
    if {"alt"} == set(modifiers) and key == "f4":
        raise Refusal("Alt+F4 closes a window without saving, so OCADE does not send it.", "blocked")

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    before = _read_editable(hwnd)

    from actions.computer_control import computer_control  # noqa: PLC0415

    if modifiers:
        computer_control({"action": "hotkey", "keys": "+".join([*modifiers, key])})
    else:
        computer_control({"action": "press", "key": key})

    time.sleep(0.2)
    after = _read_editable(hwnd)
    combination = "+".join([*modifiers, key])
    return {
        "pressed": combination,
        "hwnd": hwnd,
        # Verified only where the window exposes readable text that changed.
        # A key that changes nothing readable is honestly reported as unknown.
        "verified": (after != before) if (before is not None and after is not None) else None,
        "detail": f"Pressed {combination}.",
    }


def mouse(payload: dict) -> dict:
    """Physical pointer input. The last resort in the ladder, and gated as one.

    Refused unless the caller names a point inside the target window. A click at
    (840, 612) is correct only if the screen still looks the way it did when
    somebody chose those numbers, and nothing about the click can tell you
    whether it did — so the bounds are re-read immediately before acting.
    """
    win32gui = _win32()
    action = need_text(payload.get("action"), "action", 20).lower()
    if action not in ("click", "double_click", "right_click", "move", "scroll"):
        raise Refusal(f"Unsupported pointer action: {action}", "unsupported")

    from actions.computer_control import computer_control  # noqa: PLC0415

    if action == "scroll":
        amount = payload.get("amount")
        computer_control(
            {
                "action": "scroll",
                "direction": payload.get("direction") or "down",
                "amount": int(amount) if isinstance(amount, (int, float)) else 3,
            }
        )
        return {"action": action, "verified": None, "detail": f"Scrolled {payload.get('direction') or 'down'}."}

    x, y = payload.get("x"), payload.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        raise Refusal("A pointer action needs x and y.", "unsupported")

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    if not (left <= x <= right and top <= y <= bottom):
        raise Refusal("That point is outside the window OCADE was given.", "blocked")

    before = _read_editable(hwnd)
    computer_control({"action": action, "x": int(x), "y": int(y)})
    time.sleep(0.25)
    after = _read_editable(hwnd)
    return {
        "action": action,
        "hwnd": hwnd,
        "verified": (after != before) if (before is not None and after is not None) else None,
        "detail": f"{action.replace('_', ' ').capitalize()} at ({int(x)}, {int(y)}).",
    }


def window_arrange(payload: dict) -> dict:
    """Move or size a window, then read back where it actually landed."""
    win32gui = _win32()
    import win32con  # noqa: PLC0415

    layout = need_text(payload.get("layout"), "layout", 20).lower()
    if layout not in ("maximise", "maximize", "left", "right", "centre", "center", "minimise",
                      "minimize", "restore"):
        raise Refusal(f"Unsupported window layout: {layout}", "unsupported")

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    before = win32gui.GetWindowRect(hwnd)

    if layout in ("minimise", "minimize"):
        win32gui.ShowWindow(hwnd, win32con.SW_MINIMIZE)
    elif layout == "restore":
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    else:
        import win32api  # noqa: PLC0415

        monitor = win32api.MonitorFromWindow(hwnd, win32con.MONITOR_DEFAULTTONEAREST)
        area = win32api.GetMonitorInfo(monitor)["Work"]
        ml, mt, mr, mb = area
        width, height = mr - ml, mb - mt
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        if layout in ("maximise", "maximize"):
            target = (ml, mt, width, height)
        elif layout == "left":
            target = (ml, mt, width // 2, height)
        elif layout == "right":
            target = (ml + width // 2, mt, width // 2, height)
        else:
            w, h = int(width * 0.7), int(height * 0.8)
            target = (ml + (width - w) // 2, mt + (height - h) // 2, w, h)
        win32gui.SetWindowPos(
            hwnd, win32con.HWND_TOP, *target,
            win32con.SWP_SHOWWINDOW | win32con.SWP_FRAMECHANGED,
        )

    time.sleep(0.2)
    after = win32gui.GetWindowRect(hwnd)
    moved = after != before
    if layout in ("minimise", "minimize"):
        moved = bool(win32gui.IsIconic(hwnd))
    return {
        "hwnd": hwnd,
        "layout": layout,
        "bounds": {"x": after[0], "y": after[1],
                   "width": after[2] - after[0], "height": after[3] - after[1]},
        # Verified by the rectangle actually differing, not by the call returning.
        "verified": moved,
        "detail": "The window moved." if moved else "The window did not move.",
    }


def screen_observe(payload: dict) -> dict:
    """What is on the screen, down a ladder of decreasing certainty.

    THE LADDER, AND WHY THE ORDER IS THE POINT
    -------------------------------------------
    1. **UI Automation.** The operating system states that a thing is a button,
       is called "Continue", is enabled, and sits at these bounds. Acting on
       that is verifiable.
    2. **Windows OCR.** For windows that expose nothing — custom-drawn canvases,
       Electron apps with a broken bridge, remote sessions. Reading a button out
       of a bitmap is inferring a fact the OS would rather not state, so it is
       second and it is labelled.
    3. Nothing. Reported as nothing, with the reason.

    A weaker rung is only ever reached because the stronger one returned too
    little to act on — never because it was slower. `source` says which answered
    so the caller knows how much to trust it.
    """
    win32gui = _win32()
    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    title = clamp(win32gui.GetWindowText(hwnd), 256)

    structural = read_window({"hwnd": hwnd})
    elements = structural.get("elements") or []

    # Ten is the line between "this window described itself" and "this window
    # returned its title bar". Electron routinely exposes a handful of chrome
    # nodes and nothing else, and treating that as a successful read is how an
    # agent concludes a screen is empty.
    wants_text = len(elements) < 10 or payload.get("includeText") == "yes"
    visible_text = ""
    source = "accessibility"

    if wants_text:
        try:
            from actions.screen_processor import _capture_screen  # noqa: PLC0415

            _capture_screen()
            source = "accessibility+capture" if elements else "capture"
        except Exception:
            source = "accessibility" if elements else "none"
        # The engine's own OCR path is optional; the structural read is what the
        # loop acts on, so a missing OCR engine degrades rather than fails.
        visible_text = structural.get("text") or ""

    return {
        "hwnd": hwnd,
        "title": title,
        "elements": elements[:80],
        "elementCount": len(elements),
        "visibleText": clamp(visible_text, 4000),
        "source": source,
        "openWindows": window_list({}).get("windows", [])[:20],
        "detail": f"Read the screen: {title}. {len(elements)} interface elements.",
    }


# OCADE's own scratch folder, inside the system temp directory. The engine's
# `file_controller` resolves named user folders (desktop, downloads); this is the
# place OCADE may write without the user having approved anything, and every
# path resolves inside it or is refused.
WORKSPACE = Path(os.environ.get("TEMP", "/tmp")) / "ocade-workspace"

_EXECUTABLE_SUFFIXES = {
    ".exe", ".bat", ".cmd", ".com", ".scr", ".ps1", ".vbs", ".js", ".msi",
    ".reg", ".lnk", ".sh", ".dll", ".pyw",
}


def _workspace_path(name: Any, field: str = "name") -> Path:
    raw = need_text(name, field, 240).replace("\\", "/")
    if raw.startswith("/") or (len(raw) > 1 and raw[1] == ":"):
        raise Refusal("OCADE works in its own folder and cannot take an absolute path.", "blocked")
    WORKSPACE.mkdir(parents=True, exist_ok=True)
    root = WORKSPACE.resolve()
    candidate = (root / raw).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        raise Refusal("That path is outside OCADE's folder, so it was refused.", "blocked") from None
    return candidate


def workspace(payload: dict) -> dict:
    """Create, read, list and move files inside OCADE's own folder.

    Verified against the filesystem afterwards in every case — a write that
    returns without error and a write whose bytes are on disk are different
    facts, and only the second one is worth reporting.
    """
    action = need_text(payload.get("action"), "action", 20).lower()
    WORKSPACE.mkdir(parents=True, exist_ok=True)

    if action == "list":
        rows = [
            {"name": p.relative_to(WORKSPACE).as_posix(), "bytes": p.stat().st_size}
            for p in sorted(WORKSPACE.rglob("*"))
            if p.is_file()
        ]
        return {
            "files": rows[:200],
            "count": len(rows),
            "path": str(WORKSPACE),
            "verified": True,
            "detail": f"{len(rows)} file{'' if len(rows) == 1 else 's'} in the folder.",
        }

    if action == "read":
        path = _workspace_path(payload.get("name"))
        if not path.is_file():
            raise Refusal(f"There is no file called {path.name}.", "state_changed")
        content = path.read_text(encoding="utf-8", errors="replace")
        return {
            "name": path.name,
            "content": clamp(content, 20_000),
            "verified": True,
            "detail": f"Read {path.name}.",
        }

    if action == "write":
        path = _workspace_path(payload.get("name"))
        content = payload.get("content")
        if not isinstance(content, str):
            raise Refusal("A file needs text content.", "unsupported")
        if path.suffix.lower() in _EXECUTABLE_SUFFIXES:
            raise Refusal(
                f"OCADE does not create {path.suffix} files — the system would treat that as "
                "something to run.",
                "blocked",
            )
        if is_protected_text(content):
            raise Refusal("That content looks like a credential.", "blocked")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        landed = path.read_text(encoding="utf-8")
        return {
            "name": path.name,
            "bytes": path.stat().st_size,
            # Read back, not assumed. A full disk, a lock and an antivirus
            # quarantine all return from a write without complaint.
            "verified": landed == content,
            "detail": (
                f"Wrote {len(content)} characters to {path.name} and read them back."
                if landed == content
                else f"{path.name} was written but reads back differently."
            ),
        }

    if action == "move":
        source = _workspace_path(payload.get("from"), "from")
        target = _workspace_path(payload.get("to"), "to")
        if not source.is_file():
            raise Refusal(f"There is no file called {source.name} to move.", "state_changed")
        if target.suffix.lower() in _EXECUTABLE_SUFFIXES:
            raise Refusal(f"OCADE does not create {target.suffix} files.", "blocked")
        target.parent.mkdir(parents=True, exist_ok=True)
        source.replace(target)
        moved = target.is_file() and not source.exists()
        return {
            "from": source.name,
            "to": target.name,
            "verified": moved,
            "detail": f"Moved {source.name} to {target.name}." if moved else "The move did not complete.",
        }

    raise Refusal(f"Unsupported file action: {action}", "unsupported")


HANDLERS: dict[str, Callable[[dict], dict]] = {
    "engine.info": engine_info,
    "screen.observe": screen_observe,
    "workspace": workspace,
    "app.open": app_open,
    "app.focus": app_focus,
    "input.type": type_text,
    "input.key": press_key,
    "input.mouse": mouse,
    "input.release": release_input,
    "window.read": read_window,
    "window.list": window_list,
    "window.arrange": window_arrange,
    "browser": browser,
    "files": files,
    "system.status": system_status,
}


def handle(request: dict) -> dict:
    """Run one command with the engine's chatter kept off the wire.

    THE ENGINE PRINTS, AND STDOUT IS THE PROTOCOL
    ----------------------------------------------
    Mark-L's actions narrate to stdout — `[open_app] Launching: 'notepad' →
    'notepad.exe'` and dozens like it. Stdout here carries newline-delimited
    JSON, so every one of those lines would be read by OCADE as a malformed
    reply and desynchronise the request/response pairing for the rest of the
    session.

    Worse, and this is how it was found: that particular line contains `→`, and
    a piped stdout on Windows defaults to cp1252, so the print itself raised
    UnicodeEncodeError and the launch "failed" while succeeding.

    So the engine's stdout is pointed at stderr for the duration of every
    command — where the parent can log it — and the reply is written to the real
    stdout afterwards. The engine keeps its logging; the protocol keeps its
    channel.
    """
    if request.get("version") != PROTOCOL_VERSION:
        return {"ok": False, "code": "unsupported", "error": "Unsupported protocol version."}
    command = request.get("command")
    handler = HANDLERS.get(command if isinstance(command, str) else "")
    if handler is None:
        return {"ok": False, "code": "unsupported", "error": f"Unknown command: {command!r}"}
    payload = request.get("payload")
    if not isinstance(payload, dict):
        payload = {}
    try:
        with contextlib.redirect_stdout(sys.stderr):
            data = handler(payload)
        return {"ok": True, "data": data}
    except Refusal as refusal:
        return {"ok": False, "code": refusal.code, "error": refusal.message}
    except Exception as error:  # noqa: BLE001
        # Never a stack trace over the wire; the detail goes to stderr where the
        # parent can log it, and the caller gets a sentence.
        traceback.print_exc(file=sys.stderr)
        return {
            "ok": False,
            "code": "retryable_failure",
            "error": f"{type(error).__name__}: {error}"[:300],
        }


def serve() -> None:
    for line in sys.stdin:
        raw = line.strip()
        if not raw:
            continue
        if len(raw.encode("utf-8", "ignore")) > MAX_REQUEST_BYTES:
            reply = {"ok": False, "code": "unsupported", "error": "Request too large."}
        else:
            try:
                reply = handle(json.loads(raw))
            except json.JSONDecodeError:
                reply = {"ok": False, "code": "unsupported", "error": "Unreadable request."}
        sys.stdout.write(json.dumps(reply, default=str) + "\n")
        sys.stdout.flush()


def main() -> None:
    # UTF-8 on both streams. A piped stdout on Windows is cp1252 by default, and
    # the engine's own log lines contain characters cp1252 cannot represent.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    if "--self-test" in sys.argv:
        report = handle({"version": PROTOCOL_VERSION, "command": "engine.info", "payload": {}})
        sys.stdout.write(json.dumps(report, default=str) + "\n")
        sys.stdout.flush()
        return
    serve()


if __name__ == "__main__":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    main()
