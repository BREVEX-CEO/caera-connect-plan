"""`ui_bridge`: installed and open apps, UI Automation, and last-resort foreground input (P07/P10).

The action ladder (plan.md §25.1) is enforced by what this worker offers:
`ui.invoke`/`ui.set_value` use UIA patterns through pywinauto (no pointer);
`ui.send_keys` types into the leased window only while it is in the foreground;
`ui.click_point` is PyAutoGUI with its fail-safe kept on and window-relative
coordinates. No mutation runs while the person is using the keyboard or mouse.

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
from .sandbox import Refused, guarded, mark_effect, preview_jpeg, resolve

app = MCPServer("ocade-ui")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
WINDOWS = sys.platform == "win32"
PERSON_QUIET_MS = 1500  # a person's keyboard or mouse input this recent pauses JARVIS's hands
_own_input = {"at": 0.0}  # monotonic time this worker last sent input of its own


def _evidence(fn):
    protected = guarded(fn)

    @functools.wraps(fn)
    def wrapped(**kwargs):
        if not WINDOWS:
            return {"refused": "windows_only", "maybeChanged": False}
        import pythoncom  # type: ignore[import-not-found]

        try:
            pythoncom.CoInitializeEx(pythoncom.COINIT_APARTMENTTHREADED)
        except pythoncom.com_error as error:
            if (error.hresult & 0xFFFFFFFF) != 0x80010106:  # RPC_E_CHANGED_MODE
                raise
            # Match an existing MTA and balance only this call's extra initialization.
            pythoncom.CoInitializeEx(pythoncom.COINIT_MULTITHREADED)
        try:
            return protected(**kwargs)
        finally:
            # S_OK and S_FALSE both add one initialization owned by this call.
            pythoncom.CoUninitialize()

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


def _person_quiet() -> None:
    """Refuse to act while the person is using the keyboard or mouse (their input is newer
    than ours). UIA patterns send no input; ui.send_keys and ui.click_point record theirs."""
    import ctypes.wintypes

    class LastInput(ctypes.Structure):
        _fields_ = [("cbSize", ctypes.wintypes.UINT), ("dwTime", ctypes.wintypes.DWORD)]

    info = LastInput(ctypes.sizeof(LastInput), 0)
    if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info)):
        raise Refused("input_state_unknown")
    idle_ms = (ctypes.windll.kernel32.GetTickCount() - info.dwTime) & 0xFFFFFFFF
    ours_ms = (time.monotonic() - _own_input["at"]) * 1000
    if idle_ms < PERSON_QUIET_MS and idle_ms + 250 < ours_ms:
        raise Refused("user_active")


def _element(window, element: dict):
    from pywinauto.findwindows import ElementAmbiguousError, ElementNotFoundError  # type: ignore[import-not-found]

    criteria = {
        key: element[name]
        for name, key in (("automationId", "auto_id"), ("name", "title"), ("controlType", "control_type"))
        if element.get(name)
    }
    if not criteria:
        raise Refused("element_ambiguous")  # no description would match whatever comes first
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
    mark_effect()
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
    """The window's accessible elements, each with its box as window fractions (what
    ui.click_point takes), and a preview of the window as the screen shows it."""
    import json

    import win32gui  # type: ignore[import-not-found]
    from PIL import ImageGrab

    target = _leased(window)
    left, top, right, bottom = win32gui.GetWindowRect(window["hwnd"])
    width, height = max(1, right - left), max(1, bottom - top)
    elements = []
    for wrapper in target.descendants()[:150]:
        described = _describe(wrapper)
        if not (described["name"] or described["automationId"]):
            continue
        box = wrapper.rectangle()
        if box.width() > 0 and box.height() > 0:
            described["box"] = [round((box.left - left) / width, 3), round((box.top - top) / height, 3),
                                round((box.right - left) / width, 3), round((box.bottom - top) / height, 3)]
        elements.append(described)
        if len(json.dumps(elements)) > 13_000:  # the gateway refuses evidence over 16 KB
            break
    shot = ImageGrab.grab(bbox=(left, top, right, bottom), all_screens=True)
    return {"title": target.window_text()[:200], "elements": elements, "preview": preview_jpeg(shot, 30_000)}


@app.tool()
@_evidence
def ui_invoke(window: dict, element: dict) -> dict:
    """Invoke (or toggle/select) one element through its UIA pattern; no pointer is moved."""
    from pywinauto.uia_defines import NoPatternInterfaceError  # type: ignore[import-not-found]

    wrapper = _element(_leased(window), element)
    _person_quiet()
    if not wrapper.is_enabled():
        raise Refused("element_disabled")
    for pattern, interface_name, method_name in (
        ("invoke", "iface_invoke", "Invoke"),
        ("toggle", "iface_toggle", "Toggle"),
        ("select", "iface_selection_item", "Select"),
    ):
        try:
            interface = getattr(wrapper, interface_name)
        except (NoPatternInterfaceError, AttributeError):
            continue
        if interface is None:
            continue
        method = getattr(interface, method_name)
        mark_effect()
        method()
        return {"pattern": pattern, "after": _describe(wrapper)}
    raise Refused("pattern_unsupported")


@app.tool()
@_evidence
def ui_set_value(window: dict, element: dict, value: str) -> dict:
    """Set an element's value through UIA, then read it back."""
    from pywinauto.uia_defines import NoPatternInterfaceError  # type: ignore[import-not-found]

    wrapper = _element(_leased(window), element)
    _person_quiet()
    try:
        interface = wrapper.iface_value
    except (NoPatternInterfaceError, AttributeError):
        raise Refused("pattern_unsupported")
    if interface is None:
        raise Refused("pattern_unsupported")
    mark_effect()
    interface.SetValue(value)
    actual = interface.CurrentValue
    after = _describe(wrapper)
    return {"after": after, "matches": actual is not None and str(actual) == value}


@app.tool()
@_evidence
def ui_send_keys(window: dict, keys: str, element: dict | None = None) -> dict:
    """Type a shortcut or text into the leased window (into `element` when given), only while it holds the foreground."""
    import win32gui  # type: ignore[import-not-found]
    from pywinauto.keyboard import send_keys  # type: ignore[import-not-found]

    target = _leased(window)
    control = _element(target, element) if element is not None else None
    _person_quiet()
    try:  # focusing can itself send input (pywinauto taps Alt to take the foreground)
        mark_effect()
        target.set_focus()
        if win32gui.GetForegroundWindow() != window["hwnd"]:
            raise Refused("focus_lost")
        if control is not None:
            control.set_focus()
        send_keys(keys, pause=0.02, with_spaces=True)  # default drops every space in typed text
    finally:
        _own_input["at"] = time.monotonic()
    return {"title": target.window_text()[:200]}


@app.tool()
@_evidence
def ui_click_point(window: dict, x: float, y: float, expectTitle: str) -> dict:
    """Last resort: one click at a window-relative point, fail-safe on, never while the person is using the PC."""
    import pyautogui  # type: ignore[import-not-found]
    import win32gui  # type: ignore[import-not-found]

    pyautogui.FAILSAFE = True  # a corner flick always stops it
    target = _leased(window)
    if expectTitle not in target.window_text():
        raise Refused("unexpected_window")
    _person_quiet()
    try:
        mark_effect()
        target.set_focus()
        if win32gui.GetForegroundWindow() != window["hwnd"]:
            raise Refused("focus_lost")
        left, top, right, bottom = win32gui.GetWindowRect(window["hwnd"])
        point = (int(left + x * (right - left)), int(top + y * (bottom - top)))
        width, height = pyautogui.size()
        if not (0 <= point[0] < width and 0 <= point[1] < height):
            raise Refused("point_off_screen")
        pyautogui.click(*point)
    finally:
        _own_input["at"] = time.monotonic()
    return {"clicked": list(point), "title": target.window_text()[:200]}


if __name__ == "__main__":
    app.run("stdio")
