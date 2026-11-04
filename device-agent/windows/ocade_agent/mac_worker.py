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
from datetime import datetime
from pathlib import Path

from mcp.server.mcpserver import MCPServer

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
                found.setdefault(exe.lower(), {"name": bundle.stem[:120], "exe": exe.lower(), "path": str(bundle)})
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
    import ApplicationServices as AX  # type: ignore[import-not-found]

    if value is None:
        return None
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
    for candidate in _attribute(AX.AXUIElementCreateApplication(window["pid"]), "AXWindows") or []:
        if _attribute(candidate, "AXMinimized"):
            continue
        position, size = _point(_attribute(candidate, "AXPosition")), _point(_attribute(candidate, "AXSize"))
        if position and size and abs(position[0] - x) < 2 and abs(position[1] - y) < 2 \
                and abs(size[0] - width) < 2 and abs(size[1] - height) < 2:
            return candidate, now["bounds"]
    raise Refused("window_changed")


def _walk(element, depth: int = 0):
    yield element
    if depth < 12:
        for child in _attribute(element, "AXChildren") or []:
            yield from _walk(child, depth + 1)


def _describe(element, bounds) -> dict:
    x, y, width, height = bounds
    out = {
        "name": str(_attribute(element, "AXTitle") or _attribute(element, "AXDescription") or "")[:120],
        "automationId": str(_attribute(element, "AXIdentifier") or "")[:120],
        "controlType": str(_attribute(element, "AXRole") or "")[:40],
        "enabled": bool(_attribute(element, "AXEnabled") if _attribute(element, "AXEnabled") is not None else True),
    }
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


def _front(pid: int) -> None:
    import AppKit  # type: ignore[import-not-found]

    running = AppKit.NSRunningApplication.runningApplicationWithProcessIdentifier_(pid)
    if running is None:
        raise Refused("window_gone")
    mark_effect()
    running.activateWithOptions_(AppKit.NSApplicationActivateIgnoringOtherApps)
    for _ in range(20):
        if AppKit.NSWorkspace.sharedWorkspace().frontmostApplication().processIdentifier() == pid:
            return
        time.sleep(0.1)
    raise Refused("focus_lost")


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
def ui_inspect(window: dict) -> dict:
    """The window's accessible elements with their boxes (window fractions) and an image of it."""
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
    if not _screen_capture_allowed():
        # Controls still work through Accessibility; only the picture needs Screen Recording.
        return {"title": title, "elements": elements, "previewUnavailable": "screen_recording_permission_needed"}
    shot = ImageGrab.grab(bbox=(x, y, x + width, y + height))
    _seen[json.dumps(window, sort_keys=True)] = shot  # what a later ui.click_point is checked against
    return {"title": title, "elements": elements, "preview": preview_jpeg(shot, 30_000)}


@app.tool()
@_evidence
def ui_invoke(window: dict, element: dict) -> dict:
    """Press one element through its AX action; no pointer is moved."""
    import ApplicationServices as AX  # type: ignore[import-not-found]

    target, bounds = _leased(window)
    control = _element(target, element)
    _person_quiet()
    mark_effect()
    if AX.AXUIElementPerformAction(control, "AXPress") != 0:
        raise Refused("pattern_unsupported")
    return {"pattern": "press", "after": _describe(control, bounds)}


@app.tool()
@_evidence
def ui_set_value(window: dict, element: dict, value: str) -> dict:
    """Set an element's value through AX, then read it back."""
    import ApplicationServices as AX  # type: ignore[import-not-found]

    target, bounds = _leased(window)
    control = _element(target, element)
    _person_quiet()
    mark_effect()
    if AX.AXUIElementSetAttributeValue(control, "AXValue", value) != 0:
        raise Refused("pattern_unsupported")
    actual = _attribute(control, "AXValue")
    after = _describe(control, bounds)
    return {"after": after, "matches": actual is not None and str(actual) == value}


@app.tool()
@_evidence
def ui_send_keys(window: dict, keys: str, element: dict | None = None) -> dict:
    """Type text into the leased window (into `element` when given), only while it is frontmost."""
    import ApplicationServices as AX  # type: ignore[import-not-found]
    import Quartz  # type: ignore[import-not-found]

    target, _ = _leased(window)
    control = _element(target, element) if element is not None else None
    _person_quiet()
    try:
        _front(window["pid"])
        if control is not None:
            mark_effect()
            AX.AXUIElementSetAttributeValue(control, "AXFocused", True)
        for character in keys:
            for down in (True, False):
                event = Quartz.CGEventCreateKeyboardEvent(None, 0, down)
                Quartz.CGEventKeyboardSetUnicodeString(event, 1, character)
                mark_effect()
                Quartz.CGEventPostToPid(window["pid"], event)
            time.sleep(0.01)
    finally:
        _own_input["at"] = time.monotonic()
    return {"title": str(_attribute(target, "AXTitle") or "")[:200]}


@app.tool()
@_evidence
def ui_click_point(window: dict, x: float, y: float, expectTitle: str) -> dict:
    """Last resort: one click at a window-relative point, never while the person is using the Mac."""
    import Quartz  # type: ignore[import-not-found]

    import json

    from PIL import ImageGrab

    from . import vision

    target, (left, top, width, height) = _leased(window)
    if expectTitle not in str(_attribute(target, "AXTitle") or ""):
        raise Refused("unexpected_window")
    if not _screen_capture_allowed():
        raise Refused("screen_recording_permission_needed")  # no picture to ground a point in
    seen = _seen.get(json.dumps(window, sort_keys=True))
    if seen is None:
        raise Refused("inspect_first")  # a point is only grounded in an image of this window
    checked = vision.match(seen, ImageGrab.grab(bbox=(left, top, left + width, top + height)), x, y)
    if "reason" in checked:
        raise Refused(checked["reason"])  # nothing was clicked: look again with ui.inspect
    x, y = checked["x"], checked["y"]
    _person_quiet()
    point = (left + x * width, top + y * height)
    try:
        _front(window["pid"])
        for kind in (Quartz.kCGEventLeftMouseDown, Quartz.kCGEventLeftMouseUp):
            mark_effect()
            Quartz.CGEventPost(Quartz.kCGHIDEventTap,
                               Quartz.CGEventCreateMouseEvent(None, kind, point, Quartz.kCGMouseButtonLeft))
            time.sleep(0.05)
    finally:
        _own_input["at"] = time.monotonic()
    return {"clicked": [round(point[0]), round(point[1])], "title": str(_attribute(target, "AXTitle") or "")[:200],
            "confidence": checked["confidence"]}


if __name__ == "__main__":
    app.run("stdio")
