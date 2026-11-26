"""`ui_bridge` on Linux, X11 only: open windows, window images and last-resort input (W14).

The same operations and the same lease rules as the Windows and macOS bridges, within what
X11 itself can prove. There is no accessibility tree here (AT-SPI is not used), so:

- a window lease is {exe, pid, hwnd: the X window id, started: the process start time};
  every action first proves the window is still that one (same pid, executable and start
  time, still mapped), else it refuses;
- `ui.inspect` returns the window's title, its image and no elements; `ui.click_point`
  (matched against a fresh image by `vision.match`) and `ui.send_keys` are the only ways to
  act, and keys go only while the leased window holds the keyboard focus;
- `ui.invoke`, `ui.set_value`, `ui.wait` and `ui.scroll` need controls by name, so they refuse
  with `no_accessibility_tree` before anything is touched; protected fields cannot be told
  apart from other pixels, so a protected field is the person's to fill;
- a Wayland session is refused with `wayland_unsupported`: compositors do not let a client
  read other windows or inject input, and X11 windows seen through XWayland are not the
  whole desktop;
- nothing changes while the person is using the keyboard or mouse (XScreenSaver idle time).

Xlib, XTest and XScreenSaver are used through ctypes: no extra package is installed.
STATUS: CODED and tested on a virtual X server (Xvfb); no consumer Linux desktop was available.
"""

from __future__ import annotations

import contextlib
import ctypes
import ctypes.util
import functools
import json
import os
import shlex
import subprocess
import time
from pathlib import Path

from mcp.server.mcpserver import MCPServer

from . import capture, vision
from . import keys as key_contract
from .sandbox import Refused, guarded, mark_effect, preview_jpeg, resolve_openable

_seen: dict = {}  # the last image ui.inspect captured of each leased window
app = MCPServer("ocade-ui")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
PERSON_QUIET_SECONDS = 1.5
_own_input = {"at": 0.0}  # monotonic time this worker last sent input of its own

IS_VIEWABLE = 2  # XWindowAttributes.map_state
REVERT_TO_PARENT = 2
CLIENT_LIST_LIMIT = 400


class _Attributes(ctypes.Structure):
    _fields_ = [
        ("x", ctypes.c_int), ("y", ctypes.c_int), ("width", ctypes.c_int), ("height", ctypes.c_int),
        ("border_width", ctypes.c_int), ("depth", ctypes.c_int), ("visual", ctypes.c_void_p),
        ("root", ctypes.c_ulong), ("cls", ctypes.c_int), ("bit_gravity", ctypes.c_int),
        ("win_gravity", ctypes.c_int), ("backing_store", ctypes.c_int), ("backing_planes", ctypes.c_ulong),
        ("backing_pixel", ctypes.c_ulong), ("save_under", ctypes.c_int), ("colormap", ctypes.c_ulong),
        ("map_installed", ctypes.c_int), ("map_state", ctypes.c_int), ("all_event_masks", ctypes.c_long),
        ("your_event_mask", ctypes.c_long), ("do_not_propagate_mask", ctypes.c_long),
        ("override_redirect", ctypes.c_int), ("screen", ctypes.c_void_p),
    ]


class _ClientMessage(ctypes.Structure):
    _fields_ = [
        ("type", ctypes.c_int), ("serial", ctypes.c_ulong), ("send_event", ctypes.c_int),
        ("display", ctypes.c_void_p), ("window", ctypes.c_ulong), ("message_type", ctypes.c_ulong),
        ("format", ctypes.c_int), ("data", ctypes.c_long * 5),
    ]


class _XEvent(ctypes.Union):
    _fields_ = [("message", _ClientMessage), ("pad", ctypes.c_long * 24)]


class _ScreenSaverInfo(ctypes.Structure):
    _fields_ = [
        ("window", ctypes.c_ulong), ("state", ctypes.c_int), ("kind", ctypes.c_int),
        ("til_or_since", ctypes.c_ulong), ("idle", ctypes.c_ulong), ("event_mask", ctypes.c_ulong),
    ]


_ERRORS: list[int] = []
_ERROR_HANDLER = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p)(
    lambda _display, _event: (_ERRORS.append(1), 0)[1])  # an X error must never end the companion
_libs: dict = {}


def _library(name: str, fallback: str):
    if name not in _libs:
        found = ctypes.util.find_library(name) or fallback
        try:
            _libs[name] = ctypes.CDLL(found)
        except OSError:
            _libs[name] = None
    return _libs[name]


def _x11():
    lib = _library("X11", "libX11.so.6")
    if lib is None:
        raise Refused("display_unavailable")
    if not getattr(lib, "_ocade_typed", False):
        c_void, c_ulong, c_int = ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int
        lib.XOpenDisplay.restype = c_void
        lib.XOpenDisplay.argtypes = [ctypes.c_char_p]
        lib.XCloseDisplay.argtypes = [c_void]
        lib.XDefaultRootWindow.restype = c_ulong
        lib.XDefaultRootWindow.argtypes = [c_void]
        lib.XInternAtom.restype = c_ulong
        lib.XInternAtom.argtypes = [c_void, ctypes.c_char_p, c_int]
        lib.XGetWindowAttributes.argtypes = [c_void, c_ulong, ctypes.POINTER(_Attributes)]
        lib.XTranslateCoordinates.argtypes = [c_void, c_ulong, c_ulong, c_int, c_int,
                                              ctypes.POINTER(c_int), ctypes.POINTER(c_int), ctypes.POINTER(c_ulong)]
        lib.XGetWindowProperty.argtypes = [
            c_void, c_ulong, c_ulong, ctypes.c_long, ctypes.c_long, c_int, c_ulong, ctypes.POINTER(c_ulong),
            ctypes.POINTER(c_int), ctypes.POINTER(c_ulong), ctypes.POINTER(c_ulong),
            ctypes.POINTER(ctypes.POINTER(ctypes.c_ubyte))]
        lib.XFree.argtypes = [c_void]
        lib.XQueryTree.argtypes = [c_void, c_ulong, ctypes.POINTER(c_ulong), ctypes.POINTER(c_ulong),
                                   ctypes.POINTER(ctypes.POINTER(c_ulong)), ctypes.POINTER(ctypes.c_uint)]
        lib.XRaiseWindow.argtypes = [c_void, c_ulong]
        lib.XSetInputFocus.argtypes = [c_void, c_ulong, c_int, c_ulong]
        lib.XGetInputFocus.argtypes = [c_void, ctypes.POINTER(c_ulong), ctypes.POINTER(c_int)]
        lib.XSendEvent.argtypes = [c_void, c_ulong, c_int, ctypes.c_long, ctypes.POINTER(_XEvent)]
        lib.XSync.argtypes = [c_void, c_int]
        lib.XFlush.argtypes = [c_void]
        lib.XKeysymToKeycode.restype = ctypes.c_ubyte
        lib.XKeysymToKeycode.argtypes = [c_void, c_ulong]
        lib.XkbKeycodeToKeysym.restype = c_ulong
        lib.XkbKeycodeToKeysym.argtypes = [c_void, ctypes.c_ubyte, c_int, c_int]
        lib.XSetErrorHandler.argtypes = [ctypes.c_void_p]
        lib.XSetErrorHandler(ctypes.cast(_ERROR_HANDLER, ctypes.c_void_p))
        lib._ocade_typed = True
    return lib


def _xtest():
    lib = _library("Xtst", "libXtst.so.6")
    if lib is None:
        raise Refused("input_unavailable")
    lib.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
    lib.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
    lib.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
    return lib


def _check_session() -> None:
    """Only a plain X11 session is supported; anything else is a named refusal, never a guess."""
    if os.environ.get("XDG_SESSION_TYPE", "").lower() == "wayland" or (
            os.environ.get("WAYLAND_DISPLAY") and not os.environ.get("DISPLAY")):
        raise Refused("wayland_unsupported")
    if not os.environ.get("DISPLAY"):
        raise Refused("display_unavailable")


@contextlib.contextmanager
def _display():
    _check_session()
    lib = _x11()
    display = lib.XOpenDisplay(None)
    if not display:
        raise Refused("display_unavailable")
    _ERRORS.clear()
    try:
        yield lib, display
    finally:
        lib.XCloseDisplay(display)


def _evidence(fn):
    @functools.wraps(fn)
    def checked(**kwargs):
        _check_session()  # inside the guard: a refusal here is a named result, never an exception
        return fn(**kwargs)

    return guarded(checked)


def _atom(lib, display, name: str) -> int:
    return lib.XInternAtom(display, name.encode(), False)


def _property(lib, display, window: int, name: str, kind: int = 0, length: int = 1024):
    """(format, items) of a window property, or (0, [])."""
    actual, fmt = ctypes.c_ulong(), ctypes.c_int()
    count, after = ctypes.c_ulong(), ctypes.c_ulong()
    data = ctypes.POINTER(ctypes.c_ubyte)()
    status = lib.XGetWindowProperty(display, window, _atom(lib, display, name), 0, length, False,
                                    kind, ctypes.byref(actual), ctypes.byref(fmt), ctypes.byref(count),
                                    ctypes.byref(after), ctypes.byref(data))
    if status != 0 or not data or not count.value:
        if data:
            lib.XFree(data)
        return 0, []
    try:
        if fmt.value == 32:
            return 32, list(ctypes.cast(data, ctypes.POINTER(ctypes.c_long))[:count.value])
        return fmt.value, [bytes(data[:count.value])]
    finally:
        lib.XFree(data)


def _children(lib, display, window: int) -> tuple[int, list[int]]:
    root, parent = ctypes.c_ulong(), ctypes.c_ulong()
    kids, count = ctypes.POINTER(ctypes.c_ulong)(), ctypes.c_uint()
    if not lib.XQueryTree(display, window, ctypes.byref(root), ctypes.byref(parent),
                          ctypes.byref(kids), ctypes.byref(count)):
        return 0, []
    try:
        return parent.value, list(kids[:count.value]) if kids else []
    finally:
        if kids:
            lib.XFree(kids)


def _attributes(lib, display, window: int):
    attributes = _Attributes()
    if not lib.XGetWindowAttributes(display, window, ctypes.byref(attributes)) or _ERRORS:
        _ERRORS.clear()
        return None
    return attributes


def _origin(lib, display, root: int, window: int) -> tuple[int, int] | None:
    x, y, child = ctypes.c_int(), ctypes.c_int(), ctypes.c_ulong()
    if not lib.XTranslateCoordinates(display, window, root, 0, 0, ctypes.byref(x), ctypes.byref(y),
                                     ctypes.byref(child)) or _ERRORS:
        _ERRORS.clear()
        return None
    return x.value, y.value


def _title(lib, display, window: int) -> str:
    fmt, items = _property(lib, display, window, "_NET_WM_NAME", _atom(lib, display, "UTF8_STRING"))
    if not items:
        fmt, items = _property(lib, display, window, "WM_NAME")
    return items[0].decode("utf-8", "replace")[:200] if items and isinstance(items[0], bytes) else ""


def _started(pid: int) -> float | None:
    """Process start time to the second (the lease's guard against a reused pid)."""
    try:
        stat = Path(f"/proc/{pid}/stat").read_text()
        ticks = int(stat.rsplit(")", 1)[1].split()[19])  # field 22: start time in clock ticks since boot
        boot = next(int(line.split()[1]) for line in Path("/proc/stat").read_text().splitlines()
                    if line.startswith("btime "))
    except (OSError, ValueError, IndexError, StopIteration):
        return None
    return boot + ticks / os.sysconf("SC_CLK_TCK")


def _exe(pid: int) -> str | None:
    try:
        return Path(os.readlink(f"/proc/{pid}/exe")).name.lower()
    except OSError:
        return None


def _describe_window(lib, display, root: int, window: int) -> dict | None:
    """{exe, pid, hwnd, started, title, bounds} of a mapped, ordinary, top-level window."""
    attributes = _attributes(lib, display, window)
    if attributes is None or attributes.map_state != IS_VIEWABLE or attributes.override_redirect:
        return None
    fmt, pids = _property(lib, display, window, "_NET_WM_PID")
    if not pids or fmt != 32 or pids[0] <= 0:
        return None
    pid = int(pids[0])
    exe, started = _exe(pid), _started(pid)
    origin = _origin(lib, display, root, window)
    if not exe or started is None or origin is None:
        return None
    return {"exe": exe, "pid": pid, "hwnd": int(window), "started": started,
            "title": _title(lib, display, window),
            "bounds": [origin[0], origin[1], attributes.width, attributes.height]}


def open_windows(limit: int = 60) -> list[dict]:
    """Mapped top-level windows, oldest first: {exe, pid, hwnd, started, title, bounds}."""
    with _display() as (lib, display):
        root = lib.XDefaultRootWindow(display)
        fmt, listed = _property(lib, display, root, "_NET_CLIENT_LIST", length=CLIENT_LIST_LIMIT)
        candidates = listed if fmt == 32 else _children(lib, display, root)[1]  # no window manager: the root's children
        windows = []
        for window in candidates[:CLIENT_LIST_LIMIT]:
            described = _describe_window(lib, display, root, int(window))
            if described is not None:
                windows.append(described)
            if len(windows) >= limit:
                break
        return windows


def _leased(window: dict) -> dict:
    """The window as it is now, for an exact, still-valid lease, or a refusal."""
    now = next((w for w in open_windows(CLIENT_LIST_LIMIT) if w["hwnd"] == window["hwnd"]), None)
    if now is None:
        raise Refused("window_gone")  # unmapped (minimized or closed): X11 does not say which
    if now["pid"] != window["pid"] or now["exe"] != window["exe"] or abs(now["started"] - window["started"]) > 1:
        raise Refused("window_changed")
    return now


def _idle_seconds() -> float | None:
    lib = _library("Xss", "libXss.so.1")
    if lib is None:
        return None
    lib.XScreenSaverAllocInfo.restype = ctypes.POINTER(_ScreenSaverInfo)
    lib.XScreenSaverQueryInfo.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(_ScreenSaverInfo)]
    with _display() as (x11, display):
        info = lib.XScreenSaverAllocInfo()
        try:
            if not lib.XScreenSaverQueryInfo(display, x11.XDefaultRootWindow(display), info):
                return None
            return info.contents.idle / 1000.0
        finally:
            x11.XFree(info)


def _person_quiet() -> None:
    idle = _idle_seconds()
    if idle is None:
        raise Refused("person_activity_unknown")  # never act when the person's input cannot be read
    if idle < PERSON_QUIET_SECONDS and idle + 0.25 < time.monotonic() - _own_input["at"]:
        raise Refused("user_active")


def _within(lib, display, window: int, ancestor: int) -> bool:
    """Whether `window` is `ancestor` or one of its descendants."""
    for _ in range(32):
        if window == ancestor:
            return True
        parent, _kids = _children(lib, display, window)
        if not parent:
            return False
        window = parent
    return False


def _front(window: dict) -> None:
    """Give the leased window the keyboard focus, or refuse. A window manager is asked first
    (_NET_ACTIVE_WINDOW); the focus is then set directly and checked."""
    with _display() as (lib, display):
        root = lib.XDefaultRootWindow(display)
        message = _XEvent()
        message.message.type = 33  # ClientMessage
        message.message.window = window["hwnd"]
        message.message.message_type = _atom(lib, display, "_NET_ACTIVE_WINDOW")
        message.message.format = 32
        message.message.data[0] = 2  # the request comes from a pager/assistive tool
        lib.XSendEvent(display, root, False, (1 << 20) | (1 << 19), ctypes.byref(message))
        lib.XRaiseWindow(display, window["hwnd"])
        lib.XSetInputFocus(display, window["hwnd"], REVERT_TO_PARENT, 0)
        lib.XSync(display, False)
        for _ in range(20):
            focus, _revert = ctypes.c_ulong(), ctypes.c_int()
            lib.XGetInputFocus(display, ctypes.byref(focus), ctypes.byref(_revert))
            if focus.value and _within(lib, display, focus.value, window["hwnd"]):
                return
            time.sleep(0.1)
    raise Refused("focus_lost")


def _grab(bounds):
    from PIL import ImageGrab

    x, y, width, height = bounds
    return ImageGrab.grab(bbox=(x, y, x + width, y + height), xdisplay=os.environ.get("DISPLAY"))


# ---- installed apps -------------------------------------------------------------------------


# The XDG Base Directory specification's default for XDG_DATA_DIRS.
_XDG_DEFAULT_DATA_DIRS = os.pathsep.join(str(Path(os.sep, "usr", *tail)) for tail in (("local", "share"), ("share",)))


def _application_dirs() -> list[Path]:
    data = os.environ.get("XDG_DATA_DIRS") or _XDG_DEFAULT_DATA_DIRS
    home = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local/share")
    return [Path(home) / "applications"] + [Path(part) / "applications" for part in data.split(os.pathsep) if part]


def _desktop_entry(path: Path) -> dict | None:
    fields: dict[str, str] = {}
    in_entry = False
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return None
    for line in lines:
        line = line.strip()
        if line.startswith("["):
            in_entry = line == "[Desktop Entry]"
        elif in_entry and "=" in line and not line.startswith("#"):
            key, _, value = line.partition("=")
            fields.setdefault(key.strip(), value.strip())
    # Terminal programs need a terminal to run in, and hidden entries are not meant to be opened by hand.
    if fields.get("Type") != "Application" or not fields.get("Exec") or not fields.get("Name") \
            or any(fields.get(key, "").lower() == "true" for key in ("NoDisplay", "Hidden", "Terminal")):
        return None
    try:
        words = shlex.split(fields["Exec"])
    except ValueError:
        return None
    words = [word for word in words if not (len(word) == 2 and word[0] == "%")]  # %U, %f: files the person picks
    if words and words[0] == "env":  # `env VAR=value program args`
        words = words[1:]
        while words and "=" in words[0] and not words[0].startswith("/"):
            words = words[1:]
    if not words:
        return None
    program = words[0]
    resolved = program if os.path.isabs(program) else None
    if resolved is None:
        for folder in os.environ.get("PATH", "").split(os.pathsep):
            candidate = Path(folder) / program
            if folder and candidate.is_file() and os.access(candidate, os.X_OK):
                resolved = str(candidate)
                break
    if resolved is None or not os.access(resolved, os.X_OK):
        return None
    exe = Path(resolved).name.lower()
    if len(exe) > 80:
        return None
    return {"name": fields["Name"][:120], "exe": exe, "path": str(path), "program": resolved, "arguments": words[1:]}


def installed_apps(limit: int = 300) -> list[dict]:
    """[{name, exe, path, program, arguments}] for the desktop entries a person can launch."""
    found: dict[str, dict] = {}
    for folder in _application_dirs():
        for entry in sorted(folder.glob("*.desktop")) if folder.is_dir() else []:
            described = _desktop_entry(entry)
            if described is not None:
                found.setdefault(described["exe"], described)
    return sorted(found.values(), key=lambda a: a["name"].lower())[:limit]


# ---- tools ----------------------------------------------------------------------------------


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
    entry = next((a for a in installed_apps() if a["exe"] == exe.lower()), None)
    if entry is None:
        raise Refused("app_not_installed")
    before = {w["hwnd"] for w in open_windows(CLIENT_LIST_LIMIT)}
    arguments = [entry["program"], *entry["arguments"]] + ([str(resolve_openable(WORKSPACE, open))] if open else [])
    mark_effect()
    # nosemgrep: dangerous-subprocess-use-tainted-env-args -- argument list from the approved step, never a shell
    process = subprocess.Popen(arguments, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL, start_new_session=True)
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        fresh = [w for w in open_windows(CLIENT_LIST_LIMIT)
                 if w["hwnd"] not in before and (w["exe"] == entry["exe"] or w["pid"] == process.pid)]
        if fresh:
            return {"window": {k: fresh[0][k] for k in ("exe", "pid", "hwnd", "started")}, "title": fresh[0]["title"]}
        time.sleep(0.5)
    raise Refused("no_window_appeared")


@app.tool()
@_evidence
def ui_inspect(window: dict, region: list | None = None, changesOnly: bool = False) -> dict:
    """The window's title and an image of it (or of one `region`, at full detail). X11 offers no
    accessibility tree, so no elements are listed."""
    now = _leased(window)
    shot = _grab(now["bounds"])
    seen = vision.view(shot, region)  # refused before anything is remembered
    vision.remember(_seen, json.dumps(window, sort_keys=True), shot)  # a click is matched against the whole window
    return {"title": now["title"], "elements": [], "noAccessibilityTree": True,
            "preview": preview_jpeg(seen, 30_000), **({"previewRegion": list(region)} if region else {})}


@app.tool()
@_evidence
def ui_watch(window: dict, region: list | None = None, timeoutMs: int = 10000, show: bool = False) -> dict:
    """Wait, without acting, until the leased window's picture changes (capture.py: bounded polling)."""
    _leased(window)

    def grab():
        now = _leased(window)  # the window as it is now, or refused
        image = _grab(now["bounds"])
        _leased(window)
        return image

    with capture.HUB.use(json.dumps(window, sort_keys=True), capture.window_source(window, grab)) as stream:
        return capture.watch(stream, region, timeoutMs, show)


def _no_tree() -> dict:
    raise Refused("no_accessibility_tree")  # nothing was touched


@app.tool()
@_evidence
def ui_record(window: dict, seconds: int = 60) -> dict:
    """Not available: recording the person's steps needs an accessibility tree."""
    return _no_tree()


@app.tool()
@_evidence
def ui_wait(window: dict, element: dict, gone: bool = False, timeoutMs: int = 5000) -> dict:
    """Not available: waiting for a named control needs an accessibility tree."""
    return _no_tree()


@app.tool()
@_evidence
def ui_scroll(window: dict, element: dict, direction: str | None = None, pages: int = 1) -> dict:
    """Not available: scrolling a named control needs an accessibility tree."""
    return _no_tree()


@app.tool()
@_evidence
def ui_invoke(window: dict, element: dict) -> dict:
    """Not available: pressing a named control needs an accessibility tree."""
    return _no_tree()


@app.tool()
@_evidence
def ui_set_value(window: dict, element: dict, value: str) -> dict:
    """Not available: setting a named control needs an accessibility tree."""
    return _no_tree()


def _keycode_for(lib, display, keysym: int) -> tuple[int, bool]:
    """(keycode, needs Shift) for a keysym on the current keyboard layout, or a refusal."""
    code = lib.XKeysymToKeycode(display, keysym)
    if not code:
        raise Refused("key_unmappable")
    if lib.XkbKeycodeToKeysym(display, code, 0, 0) == keysym:
        return code, False
    if lib.XkbKeycodeToKeysym(display, code, 0, 1) == keysym:
        return code, True
    raise Refused("key_unmappable")


def _text_keysym(character: str) -> int:
    value = ord(character)
    return value if value < 0x100 and value >= 0x20 else 0x01000000 + value  # Latin-1 as is, else Unicode keysym


@app.tool()
@_evidence
def ui_send_keys(window: dict, keys: list, element: dict | None = None) -> dict:
    """Type text and press keys in the leased window, only while it holds the keyboard focus."""
    events = key_contract.x11_events(keys)  # refused here, before anything is focused
    if element is not None:
        raise Refused("no_accessibility_tree")  # a named control cannot be focused without the tree
    now = _leased(window)
    with _display() as (lib, display):
        plan: list[tuple[int, list[int]]] = []  # (keycode, keycodes held while it is pressed)
        shift = lib.XKeysymToKeycode(display, 0xFFE1)
        for kind, value, *modifiers in events:
            if kind == "text":
                for character in value:
                    code, needs_shift = _keycode_for(lib, display, _text_keysym(character))
                    plan.append((code, [shift] if needs_shift else []))
            else:
                held = [lib.XKeysymToKeycode(display, modifier) for modifier in modifiers[0]]
                code, needs_shift = _keycode_for(lib, display, value)
                if needs_shift and shift not in held:
                    held.append(shift)
                if not code or not all(held):
                    raise Refused("key_unmappable")
                plan.append((code, held))
    _person_quiet()
    try:
        _front(window)
        _leased(window)
        test = _xtest()
        with _display() as (lib, display):
            for code, held in plan:
                mark_effect()
                for modifier in held:
                    test.XTestFakeKeyEvent(display, modifier, True, 0)
                test.XTestFakeKeyEvent(display, code, True, 0)
                test.XTestFakeKeyEvent(display, code, False, 0)
                for modifier in reversed(held):
                    test.XTestFakeKeyEvent(display, modifier, False, 0)
                lib.XSync(display, False)
                time.sleep(0.01)
    finally:
        _own_input["at"] = time.monotonic()
    return {"title": _leased(window)["title"]}


@app.tool()
@_evidence
def ui_click_point(window: dict, x: float, y: float, expectTitle: str) -> dict:
    """Click only a freshly observed point that still belongs to this exact window."""
    now = _leased(window)
    if expectTitle not in now["title"]:
        raise Refused("unexpected_window")
    seen = vision.last_observation(_seen, json.dumps(window, sort_keys=True))
    _person_quiet()
    try:
        _front(window)
        now = _leased(window)
        left, top, width, height = now["bounds"]
        shot = _grab(now["bounds"])
        checked = vision.match(seen, shot, x, y)
        if "reason" in checked:
            raise Refused(checked["reason"])
        point = (round(left + checked["x"] * width), round(top + checked["y"] * height))
        if tuple(_leased(window)["bounds"]) != (left, top, width, height):
            raise Refused("window_changed")
        with _display() as (lib, display):
            root = lib.XDefaultRootWindow(display)
            top_most = None
            for child in reversed(_children(lib, display, root)[1]):  # topmost first
                attributes = _attributes(lib, display, child)
                origin = _origin(lib, display, root, child) if attributes is not None else None
                if attributes is None or origin is None or attributes.map_state != IS_VIEWABLE:
                    continue
                if origin[0] <= point[0] < origin[0] + attributes.width and origin[1] <= point[1] < origin[1] + attributes.height:
                    top_most = child
                    break
            if top_most is None or not _within(lib, display, window["hwnd"], top_most):
                raise Refused("point_obscured")
        _person_quiet()
        test = _xtest()
        with _display() as (lib, display):
            mark_effect()
            test.XTestFakeMotionEvent(display, 0, point[0], point[1], 0)
            lib.XSync(display, False)
            time.sleep(0.05)
            for pressed in (True, False):
                test.XTestFakeButtonEvent(display, 1, pressed, 0)
                lib.XSync(display, False)
                time.sleep(0.05)
    finally:
        _own_input["at"] = time.monotonic()
    result = {"clicked": list(point), "title": now["title"], "confidence": checked["confidence"]}
    try:
        after = _leased(window)
        result["after"] = {"title": after["title"], "imageChanged": vision.changed(shot, _grab(after["bounds"]))}
    except Exception:
        result["after"] = {"unavailable": True}
    return result


if __name__ == "__main__":
    app.run("stdio")
