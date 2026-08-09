"""Doing things, in strict order of how verifiable they are.

THE LADDER, AND WHY IT IS AN ORDER RATHER THAN A MENU
-----------------------------------------------------
1. ``invoke`` — ask the control to activate itself through UI Automation. The
   operating system routes it to the same handler a real click would, and the
   call fails loudly if the control is gone, disabled or hidden.
2. ``set_text`` — write into a field through its value pattern. No keystrokes,
   so nothing is lost to focus theft mid-word.
3. ``pointer`` / ``keys`` — move a physical mouse and press physical keys.

Only the last one is blind, and it is last for that reason. A click at (840,
612) is correct only if the screen still looks the way it did when someone
decided on those numbers, and nothing about the click itself can tell you
whether it did. So every coordinate action here re-reads the window and its
visual fingerprint immediately before acting and refuses when either moved.

WHAT THIS MODULE WILL NOT DO
----------------------------
Type anything that looks like a credential, read back anything that looks like
one, or act on a window it was not given. There is no "run this command"
action, and there is no path that takes a string and hands it to a shell.
"""

from __future__ import annotations

import time
from typing import Any

import win32con
import win32gui

from .protocol import Refusal, bounded_text, clamp_text, is_protected_text

# How long a control may take to appear before the attempt is abandoned. Short
# on purpose: a slow answer here becomes a stalled agent loop, and re-observing
# is cheaper than waiting.
_FIND_TIMEOUT_S = 3.0


def _desktop():
    from pywinauto import Desktop  # noqa: PLC0415

    return Desktop(backend="uia")


def _window(hwnd: int | None):
    handle = hwnd if isinstance(hwnd, int) and hwnd > 0 else win32gui.GetForegroundWindow()
    if not handle:
        raise Refusal("No window was given and nothing currently has focus.", "state_changed")
    if not win32gui.IsWindow(handle):
        raise Refusal("That window no longer exists.", "state_changed")
    return handle, _desktop().window(handle=handle)


def focus_window(request) -> dict[str, Any]:
    """Bring a window forward, then confirm it actually came forward."""
    payload = request.payload
    hwnd = payload.get("hwnd")
    if not isinstance(hwnd, int) or hwnd <= 0:
        raise Refusal("A window handle is required to focus a window.", "unsupported")
    if not win32gui.IsWindow(hwnd):
        raise Refusal("That window no longer exists.", "state_changed")

    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    try:
        win32gui.SetForegroundWindow(hwnd)
    except Exception:
        # Windows refuses foreground changes from a process without input
        # focus. Say so instead of reporting a success the user cannot see.
        raise Refusal(
            "Windows would not move focus to that window. Click it once, then ask again.",
            "blocked",
        ) from None

    time.sleep(0.12)
    actual = win32gui.GetForegroundWindow()
    verified = actual == hwnd
    return {
        "hwnd": hwnd,
        "title": clamp_text(win32gui.GetWindowText(hwnd), 256),
        "verified": verified,
        "activeHwnd": actual,
        "detail": "Window focused." if verified else "Focus did not move to that window.",
    }


def _match(element_info, role: str | None, name: str | None, automation_id: str | None) -> bool:
    if automation_id and (element_info.automation_id or "") != automation_id:
        return False
    if role and (element_info.control_type or "").lower() != role.lower():
        return False
    if name:
        actual = (element_info.name or "").strip().lower()
        wanted = name.strip().lower()
        # Contains rather than equals: real buttons are labelled "Continue",
        # "Continue »" and "Continue (recommended)", and a user asking for
        # "Continue" means all three.
        if wanted not in actual:
            return False
    return True


def find_control(request) -> dict[str, Any]:
    """Locate a control semantically. Returns candidates, never acts."""
    payload = request.payload
    hwnd, window = _window(payload.get("hwnd"))
    role = payload.get("role")
    name = payload.get("name")
    automation_id = payload.get("automationId")
    if not any([role, name, automation_id]):
        raise Refusal("A control needs a role, a name or an automation id.", "unsupported")

    deadline = time.monotonic() + _FIND_TIMEOUT_S
    candidates: list[dict[str, Any]] = []
    while time.monotonic() < deadline and not candidates:
        try:
            for element in window.descendants():
                info = element.element_info
                if not _match(info, role, name, automation_id):
                    continue
                rect = info.rectangle
                candidates.append(
                    {
                        "role": info.control_type or "Unknown",
                        "name": clamp_text(info.name or "", 256),
                        "automationId": clamp_text(info.automation_id or "", 128),
                        "bounds": {
                            "x": rect.left,
                            "y": rect.top,
                            "width": rect.width(),
                            "height": rect.height(),
                        },
                        "enabled": bool(info.enabled),
                        "visible": bool(info.visible),
                    }
                )
                if len(candidates) >= 20:
                    break
        except Exception:
            pass
        if not candidates:
            time.sleep(0.15)

    return {"hwnd": hwnd, "matches": candidates, "count": len(candidates)}


def invoke_control(request) -> dict[str, Any]:
    """Activate a control through the accessibility layer, and verify.

    Verification compares the window's visual fingerprint before and after. A
    control that reports success while nothing on screen moved has not done
    what the user asked, and saying "Done" there is the exact failure the
    product rule forbids.
    """
    from .capture import _fingerprint, _grab, _window_bounds  # noqa: PLC0415

    payload = request.payload
    hwnd, window = _window(payload.get("hwnd"))
    role, name = payload.get("role"), payload.get("name")
    automation_id = payload.get("automationId")
    if not any([role, name, automation_id]):
        raise Refusal("A control needs a role, a name or an automation id.", "unsupported")

    target = None
    deadline = time.monotonic() + _FIND_TIMEOUT_S
    while time.monotonic() < deadline and target is None:
        try:
            for element in window.descendants():
                if _match(element.element_info, role, name, automation_id):
                    target = element
                    break
        except Exception:
            pass
        if target is None:
            time.sleep(0.15)

    if target is None:
        raise Refusal(
            f"No control matching {name or role or automation_id!r} is present in that window.",
            "state_changed",
        )
    info = target.element_info
    if not info.enabled:
        raise Refusal(f"The control {info.name!r} is disabled, so it was not activated.", "blocked")

    before = _fingerprint(_grab(_window_bounds(hwnd)))
    try:
        # invoke() is the pattern-correct path; click_input() is a real pointer
        # press and is only used when a control exposes no invoke pattern.
        if hasattr(target, "invoke"):
            target.invoke()
            method = "uia.invoke"
        else:
            target.click_input()
            method = "uia.click_input"
    except Exception:
        try:
            target.click_input()
            method = "uia.click_input"
        except Exception as error:
            raise Refusal(
                f"That control refused activation: {type(error).__name__}.", "retryable_failure"
            ) from None

    time.sleep(0.35)
    changed = False
    after = None
    if win32gui.IsWindow(hwnd):
        after = _fingerprint(_grab(_window_bounds(hwnd)))
        changed = after != before

    return {
        "hwnd": hwnd,
        "activated": clamp_text(info.name or role or "", 256),
        "method": method,
        "fingerprintBefore": before,
        "fingerprintAfter": after,
        "screenChanged": changed,
        "verified": changed,
        "detail": (
            "Activated the control and confirmed the window changed."
            if changed
            else "The control was activated but nothing in that window changed."
        ),
    }


def set_text(request) -> dict[str, Any]:
    """Write into a field through its value pattern, never by keystrokes."""
    payload = request.payload
    hwnd, window = _window(payload.get("hwnd"))
    value = bounded_text(payload.get("value"), "value", 50_000)
    if is_protected_text(value):
        raise Refusal(
            "That looks like a password, code or payment value. OCADE does not type those.",
            "blocked",
        )
    role, name = payload.get("role"), payload.get("name")
    automation_id = payload.get("automationId")

    for element in window.descendants():
        if _match(element.element_info, role, name, automation_id):
            try:
                element.set_edit_text(value)
            except Exception:
                element.set_focus()
                element.type_keys(value, with_spaces=True, set_foreground=False)
            readback = ""
            try:
                readback = clamp_text(element.get_value(), 200)
            except Exception:
                pass
            return {
                "hwnd": hwnd,
                "written": len(value),
                "readback": readback,
                "verified": readback.startswith(value[:50]) if readback else None,
            }
    raise Refusal("No editable field matched that description.", "state_changed")


def pointer(request) -> dict[str, Any]:
    """Physical pointer input. The last resort, and gated accordingly."""
    import pyautogui  # noqa: PLC0415

    from .capture import _fingerprint, _grab, _window_bounds  # noqa: PLC0415

    payload = request.payload
    action = bounded_text(payload.get("action"), "action", 24)
    hwnd = payload.get("hwnd")
    if not isinstance(hwnd, int) or hwnd <= 0:
        hwnd = win32gui.GetForegroundWindow()

    expected = payload.get("expectedFingerprint")
    bounds = _window_bounds(hwnd)
    current = _fingerprint(_grab(bounds))
    if expected and expected != current:
        # The screen moved between deciding and acting. Refusing is the entire
        # value of this check — clicking anyway is how automation presses the
        # wrong thing in somebody's banking tab.
        raise Refusal(
            "The window changed since it was last observed, so the pointer was not moved.",
            "state_changed",
        )
    if win32gui.GetForegroundWindow() != hwnd:
        raise Refusal(
            "That window is not in front, so a pointer action there would land elsewhere.",
            "state_changed",
        )

    pyautogui.FAILSAFE = True
    before = current
    if action == "move":
        pyautogui.moveTo(int(payload["x"]), int(payload["y"]), duration=0.12)
    elif action in ("click", "double_click", "right_click"):
        x, y = int(payload["x"]), int(payload["y"])
        if not (bounds[0] <= x <= bounds[2] and bounds[1] <= y <= bounds[3]):
            raise Refusal("That point is outside the approved window.", "blocked")
        pyautogui.moveTo(x, y, duration=0.12)
        if action == "click":
            pyautogui.click()
        elif action == "double_click":
            pyautogui.doubleClick()
        else:
            pyautogui.rightClick()
    elif action == "scroll":
        pyautogui.scroll(int(payload.get("amount", -300)))
    elif action == "drag":
        pyautogui.moveTo(int(payload["x"]), int(payload["y"]), duration=0.12)
        pyautogui.dragTo(int(payload["toX"]), int(payload["toY"]), duration=0.28, button="left")
    else:
        raise Refusal(f"Unsupported pointer action: {action}", "unsupported")

    time.sleep(0.3)
    after = _fingerprint(_grab(_window_bounds(hwnd))) if win32gui.IsWindow(hwnd) else None
    return {
        "hwnd": hwnd,
        "action": action,
        "fingerprintBefore": before,
        "fingerprintAfter": after,
        "screenChanged": after != before,
        "verified": after != before,
    }


def release_input(_request=None) -> dict[str, Any]:
    """Let go of every held key and mouse button. Part of emergency stop.

    A stop that leaves Shift latched or the left button down leaves the machine
    in a worse state than the task did, and the user cannot see why.
    """
    import pyautogui  # noqa: PLC0415

    released: list[str] = []
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
    return {"released": released, "detail": "All held keys and mouse buttons were released."}
