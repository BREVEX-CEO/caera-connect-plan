"""`ui_bridge`: installed and open apps, UI Automation, and last-resort foreground input (P07/P10).

The action ladder (plan.md §25.1) is enforced by what this worker offers:
`ui.invoke`/`ui.set_value` use UIA patterns through pywinauto (no pointer);
`ui.send_keys` types into the leased window only while it is in the foreground;
`ui.click_point` is PyAutoGUI with its fail-safe kept on, window-relative
coordinates and an abort when the person is using the mouse.

Every mutation first proves the window is still the one leased: same handle,
same process id, same executable, same process start time, visible and not
minimized. Then it acts and reads the effect back. Secure desktops, other
sessions, UAC prompts and minimized windows are refused, not attempted.

STATUS: CODED, UNTESTED — needs a real Windows desktop.
"""

from __future__ import annotations

import functools
import os
import subprocess
import sys
import time

from mcp.server.mcpserver import MCPServer

from . import discovery
from .sandbox import Refused, resolve

app = MCPServer("ocade-ui")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
WINDOWS = sys.platform == "win32"


def _evidence(fn):
    @functools.wraps(fn)
    def wrapped(**kwargs):
        if not WINDOWS:
            return {"refused": "windows_only"}
        import pythoncom  # type: ignore[import-not-found]

        pythoncom.CoInitialize()  # UI Automation is COM; tools run on worker threads
        try:
            return fn(**kwargs)
        except Refused as refusal:
            return {"refused": refusal.code}

    return wrapped


def _leased(window: dict):
    """The pywinauto window for an exact, still-valid lease, or a refusal."""
    import win32gui  # type: ignore[import-not-found]
    from pywinauto import Application  # type: ignore[import-not-found]

    hwnd = window["hwnd"]
    if not win32gui.IsWindow(hwnd) or not win32gui.IsWindowVisible(hwnd):
        raise Refused("window_gone")
    if win32gui.IsIconic(hwnd):
        raise Refused("window_minimized")
    now = discovery.window_identity(hwnd)
    if (
        not now
        or now["pid"] != window["pid"]
        or now["exe"] != window["exe"]
        or abs(now["started"] - window["started"]) > 1
    ):
        raise Refused("window_changed")
    return Application(backend="uia").connect(handle=hwnd).window(handle=hwnd)


def _element(window, element: dict):
    from pywinauto.findwindows import ElementAmbiguousError, ElementNotFoundError  # type: ignore[import-not-found]

    criteria = {
        key: element[name]
        for name, key in (("automationId", "auto_id"), ("name", "title"), ("controlType", "control_type"))
        if element.get(name)
    }
    try:
        return window.child_window(**criteria).wrapper_object()
    except ElementAmbiguousError:
        raise Refused("element_ambiguous")
    except ElementNotFoundError:
        raise Refused("element_not_found")


def _describe(wrapper) -> dict:
    info = wrapper.element_info
    out = {
        "name": (info.name or "")[:120],
        "automationId": (info.automation_id or "")[:120],
        "controlType": info.control_type,
        "enabled": wrapper.is_enabled(),
    }
    try:
        out["value"] = str(wrapper.iface_value.CurrentValue)[:200]
    except Exception:
        pass
    return out


@app.tool()
@_evidence
def apps_list() -> dict:
    """Installed apps and open windows (with their exact leases)."""
    return {"installed": discovery.installed_apps(100), "windows": discovery.open_windows(40)}


@app.tool()
@_evidence
def apps_launch(exe: str, open: str | None = None) -> dict:
    """Start an installed app, optionally with one workspace file, and lease its new window."""
    if exe not in {a["exe"] for a in discovery.installed_apps()}:
        raise Refused("app_not_installed")
    path = discovery.app_path(exe)
    if not path:
        raise Refused("app_not_installed")
    before = {w["hwnd"] for w in discovery.open_windows(200)}
    arguments = [path] + ([str(resolve(WORKSPACE, open))] if open else [])
    subprocess.Popen(arguments, close_fds=True)  # argument list, no shell
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        fresh = [w for w in discovery.open_windows(200) if w["exe"] == exe and w["hwnd"] not in before]
        if fresh:
            return {"window": {k: fresh[0][k] for k in ("exe", "pid", "hwnd", "started")}, "title": fresh[0]["title"]}
        time.sleep(0.5)
    raise Refused("no_window_appeared")


@app.tool()
@_evidence
def ui_inspect(window: dict) -> dict:
    """A bounded list of the window's accessible elements."""
    target = _leased(window)
    elements = []
    for wrapper in target.descendants()[:150]:
        described = _describe(wrapper)
        if described["name"] or described["automationId"]:
            elements.append(described)
    return {"title": target.window_text()[:200], "elements": elements}


@app.tool()
@_evidence
def ui_invoke(window: dict, element: dict) -> dict:
    """Invoke (or toggle/select) one element through its UIA pattern; no pointer is moved."""
    wrapper = _element(_leased(window), element)
    if not wrapper.is_enabled():
        raise Refused("element_disabled")
    for pattern in ("invoke", "toggle", "select"):
        method = getattr(wrapper, pattern, None)
        if method:
            try:
                method()
                return {"pattern": pattern, "after": _describe(wrapper)}
            except Exception:
                continue
    raise Refused("pattern_unsupported")


@app.tool()
@_evidence
def ui_set_value(window: dict, element: dict, value: str) -> dict:
    """Set an element's value through UIA, then read it back."""
    wrapper = _element(_leased(window), element)
    try:
        wrapper.iface_value.SetValue(value)
    except Exception:
        raise Refused("pattern_unsupported")
    after = _describe(wrapper)
    return {"after": after, "matches": after.get("value") == value[:200]}


@app.tool()
@_evidence
def ui_send_keys(window: dict, keys: str) -> dict:
    """Type a shortcut or text into the leased window, only while it holds the foreground."""
    import win32gui  # type: ignore[import-not-found]
    from pywinauto.keyboard import send_keys  # type: ignore[import-not-found]

    target = _leased(window)
    target.set_focus()
    if win32gui.GetForegroundWindow() != window["hwnd"]:
        raise Refused("focus_lost")
    send_keys(keys, pause=0.02)
    return {"title": target.window_text()[:200]}


@app.tool()
@_evidence
def ui_click_point(window: dict, x: float, y: float, expectTitle: str) -> dict:
    """Last resort: one click at a window-relative point, fail-safe on, aborted if the person is moving the mouse."""
    import pyautogui  # type: ignore[import-not-found]
    import win32gui  # type: ignore[import-not-found]

    pyautogui.FAILSAFE = True  # a corner flick always stops it
    target = _leased(window)
    if expectTitle not in target.window_text():
        raise Refused("unexpected_window")
    target.set_focus()
    if win32gui.GetForegroundWindow() != window["hwnd"]:
        raise Refused("focus_lost")
    left, top, right, bottom = win32gui.GetWindowRect(window["hwnd"])
    point = (int(left + x * (right - left)), int(top + y * (bottom - top)))
    width, height = pyautogui.size()
    if not (0 <= point[0] < width and 0 <= point[1] < height):
        raise Refused("point_off_screen")
    first = pyautogui.position()
    time.sleep(0.2)
    if pyautogui.position() != first:
        raise Refused("user_active")
    pyautogui.click(*point)
    return {"clicked": list(point), "title": target.window_text()[:200]}


if __name__ == "__main__":
    app.run("stdio")
