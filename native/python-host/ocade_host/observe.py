"""What OCADE can see on this computer, as structure rather than pixels.

STRUCTURE FIRST IS NOT AN OPTIMISATION, IT IS THE WHOLE DESIGN
--------------------------------------------------------------
A screenshot tells you where light is. UI Automation tells you that a thing is
a button, that it is called "Continue", that it is enabled, that it can take
keyboard focus, and exactly where its bounds are. Clicking the second is a
verifiable act; clicking the first is a guess dressed as one.

So this module returns roles, names, automation ids, bounds and state — the
same shape ``src/lib/control/perception.ts`` already declares as its
``accessibility`` source and has never been given. Capture and OCR live in
``capture.py`` and are the fallback for windows that expose nothing.

BOUNDED ON PURPOSE
------------------
The consumer is a language model with a context window. An unbounded UIA walk
of a modern application returns tens of thousands of nodes, most of them
layout scaffolding. Depth and count are capped, invisible and zero-area nodes
are dropped, and the caller is told the walk was truncated rather than being
handed a silently partial tree.
"""

from __future__ import annotations

import time
from typing import Any

import psutil
from ._win32 import win32api, win32con, win32gui, win32process

from .protocol import MAX_ELEMENTS, MAX_WINDOWS, Refusal, clamp_text, is_protected_text

# A control that is smaller than this in either axis cannot be a meaningful
# target; including them buries real controls in scrollbar thumbs and splitters.
_MIN_USEFUL_EDGE = 4
_MAX_DEPTH = 6


def _rect(bounds) -> dict[str, int]:
    left, top, right, bottom = bounds
    return {"x": int(left), "y": int(top), "width": int(right - left), "height": int(bottom - top)}


def _process_for(hwnd: int) -> dict[str, Any]:
    try:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        proc = psutil.Process(pid)
        return {"pid": pid, "process": proc.name(), "executable": proc.exe()}
    except Exception:
        return {"pid": None, "process": None, "executable": None}


def list_windows(_request=None) -> dict[str, Any]:
    """Every top-level window a user could actually be looking at."""
    found: list[dict[str, Any]] = []

    def visit(hwnd: int, _param) -> bool:
        if len(found) >= MAX_WINDOWS:
            return False
        if not win32gui.IsWindowVisible(hwnd):
            return True
        title = win32gui.GetWindowText(hwnd)
        if not title.strip():
            return True
        try:
            bounds = win32gui.GetWindowRect(hwnd)
        except Exception:
            return True
        rect = _rect(bounds)
        if rect["width"] <= _MIN_USEFUL_EDGE or rect["height"] <= _MIN_USEFUL_EDGE:
            return True
        entry = {"hwnd": hwnd, "title": clamp_text(title, 256), "bounds": rect}
        entry.update(_process_for(hwnd))
        entry["minimised"] = bool(win32gui.IsIconic(hwnd))
        found.append(entry)
        return True

    win32gui.EnumWindows(visit, None)
    return {"windows": found, "count": len(found), "truncated": len(found) >= MAX_WINDOWS}


def active_window(_request=None) -> dict[str, Any]:
    """The window with focus, which is what 'my screen' usually means."""
    hwnd = win32gui.GetForegroundWindow()
    if not hwnd:
        raise Refusal("No window currently has focus on this computer.", "state_changed")
    title = win32gui.GetWindowText(hwnd)
    rect = _rect(win32gui.GetWindowRect(hwnd))
    info: dict[str, Any] = {
        "hwnd": hwnd,
        "title": clamp_text(title, 256),
        "bounds": rect,
        "minimised": bool(win32gui.IsIconic(hwnd)),
        "maximised": _is_maximised(hwnd),
    }
    info.update(_process_for(hwnd))
    info["cursor"] = dict(zip(("x", "y"), win32api.GetCursorPos()))
    info["displays"] = _displays()
    return info


def _is_maximised(hwnd: int) -> bool:
    """Whether a window is maximised.

    Via GetWindowPlacement rather than IsZoomed: pywin32 does not expose
    IsZoomed on win32gui, and reaching for it raised AttributeError at runtime
    on the very first live call — caught by driving the host against real
    windows rather than by reading the module list.
    """
    try:
        placement = win32gui.GetWindowPlacement(hwnd)
        return placement[1] == win32con.SW_SHOWMAXIMIZED
    except Exception:
        return False


def _displays() -> list[dict[str, Any]]:
    out = []
    for handle, _hdc, rect in win32api.EnumDisplayMonitors():
        try:
            info = win32api.GetMonitorInfo(handle)
            out.append(
                {
                    "bounds": _rect(info["Monitor"]),
                    "workArea": _rect(info["Work"]),
                    "primary": bool(info["Flags"] & win32con.MONITORINFOF_PRIMARY),
                }
            )
        except Exception:
            out.append({"bounds": _rect(rect), "workArea": _rect(rect), "primary": False})
    return out


def _uia_desktop():
    """Imported lazily: pywinauto's UIA backend is slow to initialise COM."""
    from pywinauto import Desktop  # noqa: PLC0415 - deliberate lazy import

    return Desktop(backend="uia")


def _node(element, depth: int) -> dict[str, Any] | None:
    try:
        info = element.element_info
        rect = info.rectangle
        width, height = rect.width(), rect.height()
        if width <= _MIN_USEFUL_EDGE or height <= _MIN_USEFUL_EDGE:
            return None
        name = clamp_text(info.name or "", 256)
        # A name that looks like a credential is redacted here, not downstream.
        # The model never needs it, and a tree is a very easy thing to log.
        redacted = is_protected_text(name)
        return {
            "id": f"{info.control_type or 'Unknown'}:{info.automation_id or ''}:{depth}:{rect.left},{rect.top}",
            "role": info.control_type or "Unknown",
            "name": "«protected»" if redacted else name,
            "automationId": clamp_text(info.automation_id or "", 128),
            "className": clamp_text(info.class_name or "", 128),
            "bounds": {"x": rect.left, "y": rect.top, "width": width, "height": height},
            "enabled": bool(info.enabled),
            "visible": bool(info.visible),
            "protected": redacted,
            "depth": depth,
        }
    except Exception:
        return None


def accessibility_tree(request) -> dict[str, Any]:
    """Read the live UI Automation tree for one window.

    Scoped to a window by design. A desktop-wide walk is both enormous and a
    privacy problem: it would return the contents of every application the user
    has open, including ones they never pointed OCADE at.
    """
    payload = getattr(request, "payload", {}) or {}
    hwnd = payload.get("hwnd")
    if not isinstance(hwnd, int) or hwnd <= 0:
        hwnd = win32gui.GetForegroundWindow()
    if not hwnd:
        raise Refusal("No window was given and nothing currently has focus.", "state_changed")

    started = time.monotonic()
    try:
        window = _uia_desktop().window(handle=hwnd)
        window.wait("exists", timeout=2)
    except Exception as error:
        raise Refusal(
            f"This window does not expose an accessibility tree: {type(error).__name__}.",
            "unsupported",
        ) from None

    elements: list[dict[str, Any]] = []
    truncated = False

    def walk(element, depth: int) -> None:
        nonlocal truncated
        if len(elements) >= MAX_ELEMENTS:
            truncated = True
            return
        if depth > _MAX_DEPTH:
            return
        node = _node(element, depth)
        if node is not None:
            elements.append(node)
        try:
            children = element.children()
        except Exception:
            return
        for child in children:
            if len(elements) >= MAX_ELEMENTS:
                truncated = True
                return
            walk(child, depth + 1)

    walk(window, 0)
    return {
        "hwnd": hwnd,
        "title": clamp_text(win32gui.GetWindowText(hwnd), 256),
        "source": "uia",
        "elements": elements,
        "count": len(elements),
        "truncated": truncated,
        "elapsedMs": int((time.monotonic() - started) * 1000),
    }
