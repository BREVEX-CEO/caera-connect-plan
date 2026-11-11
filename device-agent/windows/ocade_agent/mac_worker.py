"""`ui_bridge` on macOS: installed and open apps, Accessibility (AX), last-resort pointer input.

The same operations and the same rules as the Windows bridge (windows_worker.py), so the
planner and the protocol see one capability, not a platform branch:

- a window lease is {exe: the app's executable name, pid, hwnd: the window number,
  started: the process start time}; every action first proves the window is still that one
  (same pid, executable and start time, still on screen, not minimized), else it refuses;
- ui.invoke / ui.set_value use AX actions and values (no pointer); ui.send_keys types only
  while the app is frontmost; ui.click_point is the last resort, window-relative;
- nothing changes while the person is using the keyboard or mouse.

Needs the person's Accessibility permission for the companion (System Settings > Privacy &
Security > Accessibility); without it every tool refuses with `accessibility_not_granted`.
"""

from __future__ import annotations

import functools
import os
import plistlib
import subprocess
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from mcp.server.mcpserver import MCPServer

from . import keys as key_contract
from . import vision
from .sandbox import Refused, guarded, mark_effect, preview_jpeg, resolve

_seen: dict = {}  # the last image ui.inspect captured of each leased window
app = MCPServer("ocade-ui")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
PERSON_QUIET_SECONDS = 1.5
_own_input = {"at": 0.0}


def _evidence(fn):
    protected = guarded(fn)

    @functools.wraps(fn)
    def wrapped(**kwargs):
        import ApplicationServices as AX  # type: ignore[import-not-found]

        if not AX.AXIsProcessTrusted():
            return {"refused": "accessibility_not_granted", "maybeChanged": False}
        return protected(**kwargs)

    return wrapped


def _app_dirs() -> list[Path]:
    return [Path("/Applications"), Path("/System/Applications"), Path.home() / "Applications"]


def installed_apps(limit: int = 300) -> list[dict]:
    """[{name, exe, path}] for app bundles a person can open, by their executable name."""
    found: dict[str, dict] = {}
    for folder in _app_dirs():
        for bundle in sorted(folder.glob("*.app")) if folder.is_dir() else []:
            try:
                info = plistlib.loads((bundle / "Contents/Info.plist").read_bytes())
            except (OSError, plistlib.InvalidFileException):
                continue
            exe = str(info.get("CFBundleExecutable", ""))
            if exe and len(exe) <= 80:
                found.setdefault(exe.lower(), {"name": bundle.stem[:120], "exe": exe.lower(), "path": str(bundle),
                                               "program": str(bundle / "Contents/MacOS" / exe)})
    return sorted(found.values(), key=lambda a: a["name"].lower())[:limit]


def _started(pid: int) -> float | None:
    """Process start time to the second (the lease's guard against a reused pid)."""
    out = subprocess.run(["ps", "-o", "lstart=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    try:
        return datetime.strptime(" ".join(out.split()), "%a %b %d %H:%M:%S %Y").timestamp()
    except ValueError:
        return None


def _exe(pid: int) -> str | None:
    out = subprocess.run(["ps", "-o", "comm=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    return Path(out).name.lower() if out else None


def open_windows(limit: int = 60) -> list[dict]:
    """On-screen top-level windows: {exe, pid, hwnd, started, title, bounds}."""
    import Quartz  # type: ignore[import-not-found]

    windows = []
    listed = Quartz.CGWindowListCopyWindowInfo(
        Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements, Quartz.kCGNullWindowID)
    for info in listed or []:
        if info.get("kCGWindowLayer", 1) != 0:
            continue  # menus, the Dock and overlays are not app windows
        pid = int(info["kCGWindowOwnerPID"])
        exe, started = _exe(pid), _started(pid)
        if not exe or started is None:
            continue
        bounds = info.get("kCGWindowBounds") or {}
        windows.append({"exe": exe, "pid": pid, "hwnd": int(info["kCGWindowNumber"]), "started": started,
                        "title": str(info.get("kCGWindowName") or "")[:200],
                        "bounds": [bounds.get("X", 0), bounds.get("Y", 0), bounds.get("Width", 0), bounds.get("Height", 0)]})
        if len(windows) >= limit:
            break
    return windows


def _attribute(element, name):
    import ApplicationServices as AX  # type: ignore[import-not-found]

    error, value = AX.AXUIElementCopyAttributeValue(element, name, None)
    return value if error == 0 else None


def _point(value) -> tuple[float, float] | None:
    if value is None:
        return None

    import ApplicationServices as AX  # type: ignore[import-not-found]

    for kind, unpack in ((AX.kAXValueCGPointType, lambda v: (v.x, v.y)), (AX.kAXValueCGSizeType, lambda v: (v.width, v.height))):
        ok, raw = AX.AXValueGetValue(value, kind, None)
        if ok:
            return unpack(raw)
    return None


def _screen_capture_allowed() -> bool:
    """Whether macOS lets this process see other apps' windows (Screen Recording permission).
    Without it a capture shows only the desktop, so no image is offered or matched."""
    import Quartz  # type: ignore[import-not-found]

    preflight = getattr(Quartz, "CGPreflightScreenCaptureAccess", None)
    return bool(preflight()) if preflight else True  # before macOS 10.15 there is no such permission


def _leased(window: dict):
    """(AX window element, CG bounds) for an exact, still-valid lease, or a refusal."""
    import ApplicationServices as AX  # type: ignore[import-not-found]

    if not AX.AXIsProcessTrusted():
        raise Refused("accessibility_permission_needed")  # granted once, or revoked since: never guessed

    now = next((w for w in open_windows(400) if w["hwnd"] == window["hwnd"]), None)
    if now is None:
        # Minimized windows leave the on-screen list; ask Accessibility whether the same process
        # still holds a minimized window. Either way nothing is acted on.
        started = _started(window["pid"])
        alive = started is not None and abs(started - window["started"]) <= 1
        windows = (_attribute(AX.AXUIElementCreateApplication(window["pid"]), "AXWindows") or []) if alive else []
        raise Refused("window_minimized" if any(_attribute(w, "AXMinimized") for w in windows) else "window_gone")
    if now["pid"] != window["pid"] or now["exe"] != window["exe"] or abs(now["started"] - window["started"]) > 1:
        raise Refused("window_changed")
    x, y, width, height = now["bounds"]
    matches = []
    for candidate in _attribute(AX.AXUIElementCreateApplication(window["pid"]), "AXWindows") or []:
        if _attribute(candidate, "AXMinimized"):
            continue
        position, size = _point(_attribute(candidate, "AXPosition")), _point(_attribute(candidate, "AXSize"))
        if position and size and abs(position[0] - x) < 2 and abs(position[1] - y) < 2 \
                and abs(size[0] - width) < 2 and abs(size[1] - height) < 2:
            matches.append(candidate)
    if len(matches) != 1:
        raise Refused("window_ambiguous" if matches else "window_changed")
    return matches[0], now["bounds"]


@contextmanager
def _ax_change_events(window: dict, target, control):
    """Observe native changes on the action's current run loop."""
    import ApplicationServices as AX  # type: ignore[import-not-found]
    import CoreFoundation as CF  # type: ignore[import-not-found]
    import objc  # type: ignore[import-not-found]

    events: list[str] = []

    # PyObjC passes a Python function to C only as a closure built for that callback's signature.
    @objc.callbackFor(AX.AXObserverCreate)
    def received(_observer, _element, notification, _refcon):
        if len(events) < 8:
            events.append(str(notification))

    error, observer = AX.AXObserverCreate(window["pid"], received, None)
    if error or observer is None:
        yield events
        return
    registrations = [
        (target, "AXMoved"), (target, "AXResized"), (target, "AXTitleChanged"),
        (target, "AXUIElementDestroyed"), (control, "AXValueChanged"),
    ]
    registered = [
        (item, event) for item, event in registrations
        if AX.AXObserverAddNotification(observer, item, event, None) == 0
    ]
    if not registered:
        yield events
        return
    source = AX.AXObserverGetRunLoopSource(observer)
    run_loop = CF.CFRunLoopGetCurrent()
    CF.CFRunLoopAddSource(run_loop, source, CF.kCFRunLoopDefaultMode)
    try:
        yield events
        CF.CFRunLoopRunInMode(CF.kCFRunLoopDefaultMode, 0.15, False)
    finally:
        CF.CFRunLoopRemoveSource(run_loop, source, CF.kCFRunLoopDefaultMode)
        for item, event in registered:
            AX.AXObserverRemoveNotification(observer, item, event)

def _walk(element, depth: int = 0):
    yield element
    if depth < 12:
        for child in _attribute(element, "AXChildren") or []:
            yield from _walk(child, depth + 1)


def _protected_control(element) -> bool:
    return _attribute(element, "AXSubrole") == "AXSecureTextField"


def _describe(element, bounds) -> dict:
    x, y, width, height = bounds
    protected = _protected_control(element)
    out = {
        "name": ("Protected text field" if protected else
                 str(_attribute(element, "AXTitle") or _attribute(element, "AXDescription") or "")[:120]),
        "automationId": "" if protected else str(_attribute(element, "AXIdentifier") or "")[:120],
        "controlType": str(_attribute(element, "AXRole") or "")[:40],
        "enabled": bool(_attribute(element, "AXEnabled") if _attribute(element, "AXEnabled") is not None else True),
    }
    if protected:
        out["protected"] = True
    else:
        value = _attribute(element, "AXValue")
        if isinstance(value, (str, int, float)):
            out["value"] = str(value)[:200]
    position, size = _point(_attribute(element, "AXPosition")), _point(_attribute(element, "AXSize"))
    if position and size and width and height and size[0] > 0 and size[1] > 0:
        out["box"] = [round((position[0] - x) / width, 3), round((position[1] - y) / height, 3),
                      round((position[0] + size[0] - x) / width, 3), round((position[1] + size[1] - y) / height, 3)]
    return out


def _element(target, element: dict):
    wanted = {k: v for k, v in element.items() if v}
    if not wanted:
        raise Refused("element_ambiguous")  # no description would match whatever comes first
    matches = []
    for candidate in _walk(target):
        described = _describe(candidate, (0, 0, 1, 1))
        if all(described.get(key) == value for key, value in wanted.items()):
            matches.append(candidate)
    if not matches:
        raise Refused("element_not_found")
    if len(matches) > 1:
        raise Refused("element_ambiguous")
    return matches[0]


def _person_quiet() -> None:
    import Quartz  # type: ignore[import-not-found]

    idle = Quartz.CGEventSourceSecondsSinceLastEventType(
        Quartz.kCGEventSourceStateCombinedSessionState, Quartz.kCGAnyInputEventType)
    if idle < PERSON_QUIET_SECONDS and idle + 0.25 < time.monotonic() - _own_input["at"]:
        raise Refused("user_active")


def _front(pid: int, target) -> None:
    """Bring the leased window to the front as its app's focused window, or refuse.

    Since macOS 14 AppKit no longer lets a background process activate another app, so the
    app is made frontmost and the window raised through Accessibility, which this bridge is
    already trusted for. If the app comes forward but another of its windows (a dialog) keeps
    the focus, that window is answered first: keys never go to a window that was not leased."""
    import AppKit  # type: ignore[import-not-found]
    import ApplicationServices as AX  # type: ignore[import-not-found]
    import CoreFoundation as CF  # type: ignore[import-not-found]

    running = AppKit.NSRunningApplication.runningApplicationWithProcessIdentifier_(pid)
    if running is None:
        raise Refused("window_gone")
    ax_app = AX.AXUIElementCreateApplication(pid)
    mark_effect()
    AX.AXUIElementPerformAction(target, "AXRaise")
    AX.AXUIElementSetAttributeValue(ax_app, "AXFrontmost", True)
    running.activateWithOptions_(AppKit.NSApplicationActivateIgnoringOtherApps)
    in_front = False
    for _ in range(20):
        front = AppKit.NSWorkspace.sharedWorkspace().frontmostApplication()
        in_front = front is not None and front.processIdentifier() == pid
        focused = _attribute(ax_app, "AXFocusedWindow")
        if in_front and focused is not None and CF.CFEqual(focused, target):
            return
        time.sleep(0.1)
    raise Refused("window_blocked" if in_front else "focus_lost")


@app.tool()
@_evidence
def apps_list() -> dict:
    """Installed apps and open windows (with their exact leases)."""
    return {"installed": [{"name": a["name"], "exe": a["exe"]} for a in installed_apps(100)],
            "windows": [{k: w[k] for k in ("exe", "pid", "hwnd", "started", "title")} for w in open_windows(40)]}


@app.tool()
@_evidence
def apps_launch(exe: str, open: str | None = None) -> dict:
    """Open an installed app, optionally with one workspace file, and lease its new window."""
    bundle = next((a for a in installed_apps() if a["exe"] == exe.lower()), None)
    if bundle is None:
        raise Refused("app_not_installed")
    before = {w["hwnd"] for w in open_windows(400)}
    arguments = ["open", "-n", "-a", bundle["path"]] + (["--args", str(resolve(WORKSPACE, open))] if open else [])
    mark_effect()
    subprocess.run(arguments, check=False, capture_output=True)  # argument list, no shell
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        fresh = [w for w in open_windows(400) if w["exe"] == bundle["exe"] and w["hwnd"] not in before]
        if fresh:
            return {"window": {k: fresh[0][k] for k in ("exe", "pid", "hwnd", "started")}, "title": fresh[0]["title"]}
        time.sleep(0.5)
    raise Refused("no_window_appeared")


@app.tool()
@_evidence
def ui_inspect(window: dict, region: list | None = None) -> dict:
    """The window's accessible elements with their boxes (window fractions) and an image of it
    (or of one `region` of it, at full detail)."""
    import json

    from PIL import ImageGrab

    target, bounds = _leased(window)
    elements = []
    for candidate in _walk(target):
        described = _describe(candidate, bounds)
        if described["name"] or described["automationId"]:
            elements.append(described)
        if len(elements) >= 150 or len(json.dumps(elements)) > 13_000:
            break
    x, y, width, height = bounds
    title = str(_attribute(target, "AXTitle") or "")[:200]
    key = json.dumps(window, sort_keys=True)
    if any(element.get("protected") for element in elements):
        _seen.pop(key, None)
        return {"title": title, "elements": elements, "previewUnavailable": "protected_content"}
    if not _screen_capture_allowed():
        # Controls still work through Accessibility; only the picture needs Screen Recording.
        _seen.pop(key, None)
        return {"title": title, "elements": elements, "previewUnavailable": "screen_recording_permission_needed"}
    shot = ImageGrab.grab(bbox=(x, y, x + width, y + height))
    seen = vision.view(shot, region)  # refused before anything is remembered
    vision.remember(_seen, key, shot)  # a click is always matched against the whole window
    return {"title": title, "elements": elements, "preview": preview_jpeg(seen, 30_000),
            **({"previewRegion": list(region)} if region else {})}


@app.tool()
@_evidence
def ui_invoke(window: dict, element: dict) -> dict:
    """Press one element through its AX action; no pointer is moved."""
    import ApplicationServices as AX  # type: ignore[import-not-found]

    target, bounds = _leased(window)
    control = _element(target, element)
    _person_quiet()
    with _ax_change_events(window, target, control) as events:
        mark_effect()
        if AX.AXUIElementPerformAction(control, "AXPress") != 0:
            raise Refused("pattern_unsupported")
    return {"pattern": "press", "after": _describe(control, bounds), "axEvents": events}


@app.tool()
@_evidence
def ui_set_value(window: dict, element: dict, value: str) -> dict:
    """Set an element's value through AX, then read it back."""
    import ApplicationServices as AX  # type: ignore[import-not-found]

    target, bounds = _leased(window)
    control = _element(target, element)
    if _protected_control(control):
        raise Refused("protected_control")
    _person_quiet()
    with _ax_change_events(window, target, control) as events:
        mark_effect()
        if AX.AXUIElementSetAttributeValue(control, "AXValue", value) != 0:
            raise Refused("pattern_unsupported")
    actual = None if _protected_control(control) else _attribute(control, "AXValue")
    after = _describe(control, bounds)
    return {"after": after, "matches": actual is not None and str(actual) == value, "axEvents": events}


@app.tool()
@_evidence
def ui_send_keys(window: dict, keys: list, element: dict | None = None) -> dict:
    """Type text and press keys in the leased window (in `element` when given), only while it is frontmost."""
    import ApplicationServices as AX  # type: ignore[import-not-found]
    import CoreFoundation as CF  # type: ignore[import-not-found]
    import Quartz  # type: ignore[import-not-found]

    events = key_contract.mac_events(keys)  # refused here, before anything is focused
    flags = {"command": Quartz.kCGEventFlagMaskCommand, "control": Quartz.kCGEventFlagMaskControl,
             "option": Quartz.kCGEventFlagMaskAlternate, "shift": Quartz.kCGEventFlagMaskShift}
    target, _ = _leased(window)
    control = _element(target, element) if element is not None else None
    if control is not None and _protected_control(control):
        raise Refused("protected_control")
    _person_quiet()
    try:
        _front(window["pid"], target)
        if control is not None:
            mark_effect()
            AX.AXUIElementSetAttributeValue(control, "AXFocused", True)
        focused = _attribute(AX.AXUIElementCreateApplication(window["pid"]), "AXFocusedUIElement")
        if focused is None or _protected_control(focused):
            raise Refused("protected_control")
        if control is not None and not CF.CFEqual(focused, control):
            raise Refused("focus_lost")
        for kind, value, *modifiers in events:
            # Text goes as characters (whatever the layout); a press as its key with its modifiers.
            for stroke in (value if kind == "text" else [value]):
                for down in (True, False):
                    event = Quartz.CGEventCreateKeyboardEvent(None, 0 if kind == "text" else stroke, down)
                    if kind == "text":
                        Quartz.CGEventKeyboardSetUnicodeString(event, 1, stroke)
                    else:
                        mask = 0
                        for name in modifiers[0]:
                            mask |= flags[name]
                        Quartz.CGEventSetFlags(event, mask)
                    mark_effect()
                    Quartz.CGEventPostToPid(window["pid"], event)
                time.sleep(0.01)
    finally:
        _own_input["at"] = time.monotonic()
    return {"title": str(_attribute(target, "AXTitle") or "")[:200]}


@app.tool()
@_evidence
def ui_click_point(window: dict, x: float, y: float, expectTitle: str) -> dict:
    """Click only a freshly observed point that still belongs to this exact window."""
    import json

    import AppKit  # type: ignore[import-not-found]
    import ApplicationServices as AX  # type: ignore[import-not-found]
    import CoreFoundation as CF  # type: ignore[import-not-found]
    import Quartz  # type: ignore[import-not-found]
    from PIL import ImageGrab

    target, _ = _leased(window)
    title = str(_attribute(target, "AXTitle") or "")[:200]
    if expectTitle not in title:
        raise Refused("unexpected_window")
    if not _screen_capture_allowed():
        raise Refused("screen_recording_permission_needed")
    seen = vision.last_observation(_seen, json.dumps(window, sort_keys=True))
    _person_quiet()
    try:
        mark_effect()
        _front(window["pid"], target)
        target, (left, top, width, height) = _leased(window)
        shot = ImageGrab.grab(bbox=(left, top, left + width, top + height))
        checked = vision.match(seen, shot, x, y)
        if "reason" in checked:
            raise Refused(checked["reason"])
        point = (left + checked["x"] * width, top + checked["y"] * height)
        _, fresh_bounds = _leased(window)
        if tuple(fresh_bounds) != (left, top, width, height):
            raise Refused("window_changed")
        error, hit = AX.AXUIElementCopyElementAtPosition(
            AX.AXUIElementCreateSystemWide(), point[0], point[1], None,
        )
        hit_window = _attribute(hit, "AXWindow") if not error and hit is not None else None
        if hit_window is None or not CF.CFEqual(hit_window, target):
            raise Refused("point_obscured")
        _person_quiet()
        active = AppKit.NSWorkspace.sharedWorkspace().frontmostApplication()
        if active is None or active.processIdentifier() != window["pid"]:
            raise Refused("focus_lost")
        for kind in (Quartz.kCGEventLeftMouseDown, Quartz.kCGEventLeftMouseUp):
            Quartz.CGEventPost(Quartz.kCGHIDEventTap,
                               Quartz.CGEventCreateMouseEvent(None, kind, point, Quartz.kCGMouseButtonLeft))
            time.sleep(0.05)
    finally:
        _own_input["at"] = time.monotonic()
    result = {"clicked": [round(point[0]), round(point[1])], "title": title,
              "confidence": checked["confidence"]}
    try:
        after, (ax, ay, aw, ah) = _leased(window)
        after_image = ImageGrab.grab(bbox=(ax, ay, ax + aw, ay + ah))
        result["after"] = {"title": str(_attribute(after, "AXTitle") or "")[:200],
                           "imageChanged": vision.changed(shot, after_image)}
    except Exception:
        result["after"] = {"unavailable": True}
    return result


if __name__ == "__main__":
    app.run("stdio")
