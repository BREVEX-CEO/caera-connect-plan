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
import ntpath
import os
import subprocess
import sys
import time

from mcp.server.mcpserver import MCPServer

from . import discovery, vision
from . import keys as key_contract
from .sandbox import Refused, guarded, mark_effect, preview_jpeg, resolve

_seen: dict = {}  # the last image ui.inspect captured of each leased window
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


def _actable(window: dict):
    """`_leased`, and its window takes input: a dialog of its app (a modal one disables its
    owner) is answered first, as a window of its own. Refused before anything is attempted."""
    import win32gui  # type: ignore[import-not-found]

    target = _leased(window)
    if not win32gui.IsWindowEnabled(window["hwnd"]):
        raise Refused("window_blocked")
    return target


def _not_in_front(window: dict) -> Refused:
    """Why the leased window did not take the foreground: another window of its own app (a
    dialog) holds it, or something else does."""
    import win32gui  # type: ignore[import-not-found]
    import win32process  # type: ignore[import-not-found]

    front = win32gui.GetForegroundWindow()
    if front and win32process.GetWindowThreadProcessId(front)[1] == window["pid"]:
        return Refused("window_blocked")
    return Refused("focus_lost")


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
        or now["started"] != window["started"]
    ):
        raise Refused("window_changed")
    if _elevated(window["pid"]) and not _elevated(os.getpid()):
        # Windows silently drops input and many UIA calls from a lower integrity level (UIPI):
        # an action could report success while nothing happened. Refused, never attempted.
        raise Refused("window_elevated")
    try:
        # WM_NULL has no application effect. A bounded round trip tests the actual
        # message loop; IsHungAppWindow can miss a suspended thread waiting for input.
        win32gui.SendMessageTimeout(hwnd, 0, 0, 0, 0x0002 | 0x0020, 1000)
    except win32gui.error as error:
        if error.winerror in (0, 1460):  # generic failure or ERROR_TIMEOUT
            # its app is busy or frozen: acting now would queue blindly
            raise Refused("window_not_responding") from None
        raise Refused("window_probe_failed") from None
    return Application(backend="uia").connect(handle=hwnd).window(handle=hwnd)


def _elevated(pid: int) -> bool:
    """Whether a process runs elevated (administrator). One this process may not even query
    is treated as elevated: that is what blocks it."""
    import win32api  # type: ignore[import-not-found]
    import win32con  # type: ignore[import-not-found]
    import win32security  # type: ignore[import-not-found]

    try:
        handle = win32api.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        token = win32security.OpenProcessToken(handle, win32con.TOKEN_QUERY)
        return bool(win32security.GetTokenInformation(token, win32security.TokenElevation))
    except Exception:
        return True


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


def _password_state(element) -> bool | None:
    try:
        value = element.CurrentIsPassword
        return None if value is None else bool(value)
    except Exception:
        return None


def _describe(wrapper) -> dict:
    info = wrapper.element_info
    protected = _password_state(info.element)
    out = {
        "name": "Protected text field" if protected else (info.name or "")[:120],
        "automationId": "" if protected else (info.automation_id or "")[:120],
        "controlType": info.control_type,
        "enabled": wrapper.is_enabled(),
    }
    if protected is True:
        out["protected"] = True
    elif protected is False:
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
    before = {w["hwnd"] for w in discovery.open_windows(200)}
    folder = None
    if exe.startswith("pkg-"):
        if open is not None:
            raise Refused("packaged_app_file_activation_unsupported")
        if not discovery.launch_packaged(exe, mark_effect):
            raise Refused("app_not_installed")
    else:
        path = discovery.app_path(exe)
        if not path:
            raise Refused("app_not_installed")
        folder = ntpath.dirname(path).lower()
        arguments = [path] + ([str(resolve(WORKSPACE, open))] if open else [])
        mark_effect()
        subprocess.Popen(arguments, close_fds=True)  # argument list, no shell
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        # The new window is the app's own, or that of the program in the same folder a launcher
        # handed over to (the launcher may have exited by now, or passed the file to a running copy).
        fresh = [w for w in discovery.open_windows(200) if w["hwnd"] not in before
                 and (w["exe"] == exe or (folder is not None and discovery.window_folder(w["hwnd"]) == folder))]
        if len(fresh) > 1:
            raise Refused("window_ambiguous")
        if fresh:
            return {"window": {k: fresh[0][k] for k in ("exe", "pid", "hwnd", "started")}, "title": fresh[0]["title"]}
        time.sleep(0.5)
    raise Refused("no_window_appeared")


@app.tool()
@_evidence
def ui_inspect(window: dict, region: list | None = None) -> dict:
    """The window's accessible elements, each with its box as window fractions (what
    ui.click_point takes), and a preview of the window (or of one `region` of it, at full
    detail) as the screen shows it."""
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
    key = json.dumps(window, sort_keys=True)
    title = target.window_text()[:200]
    if any(element.get("protected") for element in elements):
        _seen.pop(key, None)
        return {"title": title, "elements": elements, "previewUnavailable": "protected_content"}
    shot = ImageGrab.grab(bbox=(left, top, right, bottom), all_screens=True)
    seen = vision.view(shot, region)  # refused before anything is remembered
    vision.remember(_seen, key, shot)  # a click is always matched against the whole window
    return {"title": title, "elements": elements, "preview": preview_jpeg(seen, 30_000),
            **({"previewRegion": list(region)} if region else {})}


@app.tool()
@_evidence
def ui_invoke(window: dict, element: dict) -> dict:
    """Invoke (or toggle/select) one element through its UIA pattern; no pointer is moved."""
    from pywinauto.uia_defines import NoPatternInterfaceError  # type: ignore[import-not-found]

    wrapper = _element(_actable(window), element)
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

    wrapper = _element(_actable(window), element)
    if _password_state(wrapper.element_info.element) is not False:
        raise Refused("protected_control")
    _person_quiet()
    try:
        interface = wrapper.iface_value
    except (NoPatternInterfaceError, AttributeError):
        raise Refused("pattern_unsupported")
    if interface is None:
        raise Refused("pattern_unsupported")
    mark_effect()
    interface.SetValue(value)
    actual = interface.CurrentValue if _password_state(wrapper.element_info.element) is False else None
    after = _describe(wrapper)
    return {"after": after, "matches": actual is not None and str(actual) == value}


@app.tool()
@_evidence
def ui_send_keys(window: dict, keys: list, element: dict | None = None) -> dict:
    """Type text and press keys in the leased window (in `element` when given), only while it holds the foreground."""
    import win32gui  # type: ignore[import-not-found]
    from pywinauto.keyboard import send_keys  # type: ignore[import-not-found]
    from pywinauto.uia_defines import IUIA  # type: ignore[import-not-found]

    sequence = key_contract.windows_sequence(keys)  # refused here, before anything is focused
    target = _actable(window)
    control = _element(target, element) if element is not None else None
    if control is not None and _password_state(control.element_info.element) is not False:
        raise Refused("protected_control")
    _person_quiet()
    try:
        # Bringing the leased window forward (UI Automation SetFocus, no synthetic input) changes
        # which window has focus, never what a document holds, so a refusal here changed nothing
        # and is safe to plan again; the fence for unknown effects starts with the app's own code.
        target.set_focus()
        if win32gui.GetForegroundWindow() != window["hwnd"]:
            raise _not_in_front(window)
        if control is not None:
            mark_effect()  # focusing a control runs the app's handlers (a pending edit may commit)
            control.set_focus()
        automation = IUIA().iuia
        focused = automation.GetFocusedElement()
        if focused is None or _password_state(focused) is not False:
            raise Refused("protected_control")
        if win32gui.GetForegroundWindow() != window["hwnd"]:
            raise Refused("focus_lost")
        if control is not None:
            if not automation.CompareElements(focused, control.element_info.element):
                raise Refused("focus_lost")
        elif focused.CurrentProcessId != window["pid"]:
            raise Refused("focus_lost")
        mark_effect()
        send_keys(sequence, pause=0.02, with_spaces=True)  # default drops every space in typed text
    finally:
        _own_input["at"] = time.monotonic()
    return {"title": target.window_text()[:200]}


def _window_point(rect, x: float, y: float) -> tuple[int, int]:
    left, top, right, bottom = rect
    if not (left < right and top < bottom and 0 <= x < 1 and 0 <= y < 1):
        raise Refused("point_off_screen")
    return left + int(x * (right - left)), top + int(y * (bottom - top))


def _check_point(hwnd: int, point: tuple[int, int], win32api, win32gui) -> None:
    if not win32api.MonitorFromPoint(point, 0):  # MONITOR_DEFAULTTONULL, includes negative origins
        raise Refused("point_off_screen")
    hit = win32gui.WindowFromPoint(point)
    if not hit or win32gui.GetAncestor(hit, 2) != hwnd:  # GA_ROOT: an exact child of the leased window
        raise Refused("point_obscured")


@app.tool()
@_evidence
def ui_click_point(window: dict, x: float, y: float, expectTitle: str) -> dict:
    """Last resort: one fresh, unambiguous click in the exact leased window."""
    import json

    import pyautogui  # type: ignore[import-not-found]
    import win32api  # type: ignore[import-not-found]
    import win32gui  # type: ignore[import-not-found]
    from PIL import ImageGrab

    pyautogui.FAILSAFE = True
    pyautogui.failSafeCheck()
    target = _actable(window)
    title = target.window_text()[:200]
    if expectTitle not in title:
        raise Refused("unexpected_window")
    seen = vision.last_observation(_seen, json.dumps(window, sort_keys=True))
    hwnd = window["hwnd"]
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    if seen.size != (right - left, bottom - top):
        raise Refused("window_resized")
    _person_quiet()
    try:
        if win32gui.GetForegroundWindow() != hwnd:
            target.set_focus()  # not an effect: see ui_send_keys
        if win32gui.GetForegroundWindow() != hwnd:
            raise _not_in_front(window)
        target = _leased(window)
        rect = win32gui.GetWindowRect(hwnd)
        fresh = ImageGrab.grab(bbox=rect, all_screens=True)
        checked = vision.match(seen, fresh, x, y)
        if "reason" in checked:
            raise Refused(checked["reason"])
        if win32gui.GetWindowRect(hwnd) != rect or win32gui.GetForegroundWindow() != hwnd:
            raise Refused("window_changed")
        point = _window_point(rect, checked["x"], checked["y"])
        _person_quiet()
        if win32gui.GetWindowRect(hwnd) != rect or win32gui.GetForegroundWindow() != hwnd:
            raise Refused("window_changed")
        _check_point(hwnd, point, win32api, win32gui)
        mark_effect()
        pyautogui.click(*point)
    finally:
        _own_input["at"] = time.monotonic()
    result = {"clicked": list(point), "title": title, "confidence": checked["confidence"]}
    try:
        after = _leased(window)
        after_rect = win32gui.GetWindowRect(hwnd)
        after_image = ImageGrab.grab(bbox=after_rect, all_screens=True)
        result["after"] = {"title": after.window_text()[:200], "imageChanged": vision.changed(fresh, after_image)}
    except Exception:
        result["after"] = {"unavailable": True}
    return result


if __name__ == "__main__":
    if WINDOWS:
        import ctypes

        # Per-monitor DPI awareness v2: window rectangles, screenshots and clicks all use real
        # pixels on every monitor, whatever its scaling (125%, 150%, mixed setups).
        ctypes.windll.user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
    app.run("stdio")
