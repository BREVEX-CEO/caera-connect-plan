"""Applications, displays and window placement.

WHERE THIS CAME FROM, AND WHAT CHANGED
--------------------------------------
The working parts of a standalone desktop-control script — launching Cursor,
opening Chrome on a chosen monitor, snapping a new window to a display,
foregrounding an existing process — arrived as one fixed sequence triggered by
a double clap. The behaviour was real and worth keeping; the shape was not.

So it is here as TOOLS rather than as a routine. `app.launch` opens whatever the
user asked for instead of one hard-coded editor. `display.list` reports the
monitors rather than reading a constant chosen at the top of a file.
`window.arrange` places any window on any display. Nothing in this module knows
what a clap is, and nothing greets anybody by name.

WHAT IS DELIBERATELY NOT HERE
-----------------------------
An "open this path" action taking an arbitrary string. Applications are resolved
against what the machine reports as installed, or against a short table of
executables whose location is known — so the argument is a NAME to be looked up,
never a path to be executed. That distinction is the whole difference between an
application launcher and remote code execution.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from typing import Any, NamedTuple

from ._win32 import require
from .protocol import Refusal, bounded_text, clamp_text

# How long to wait for a launched application to put a window on screen before
# reporting that it started but could not be confirmed.
#
# SHORTENED FROM TWELVE SECONDS AFTER A LIVE FAILURE, and the reason is worth
# keeping. On a machine sitting at 94% memory, a cold Notepad launch plus a
# twelve-second poll that called `psutil.Process(pid).exe()` for every top-level
# window on every tick took long enough to blow the caller's thirty-second
# ceiling. Notepad opened. OCADE reported that it had failed.
#
# Waiting is the wrong instrument here. The agent loop re-observes after every
# action, so "started, and no window yet" is a true answer it can act on, while
# a long blocking wait turns a slow launch into a false failure.
_WINDOW_WAIT_S = 6.0
_POLL_S = 0.12

# Executables whose install location is predictable and which are worth finding
# without a registry walk. Everything else goes through the installed-application
# list, so this table is a fast path rather than the only path.
_KNOWN_WINDOWS_APPS: dict[str, tuple[str, ...]] = {
    "chrome": (r"%ProgramFiles%\Google\Chrome\Application\chrome.exe",
               r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
               r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    "edge": (r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe",
             r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
    "cursor": (r"%LOCALAPPDATA%\Programs\cursor\Cursor.exe",
               r"%LOCALAPPDATA%\Programs\Cursor\Cursor.exe"),
    "code": (r"%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe",
             r"%ProgramFiles%\Microsoft VS Code\Code.exe"),
    "notepad": (r"%WINDIR%\System32\notepad.exe",),
    "explorer": (r"%WINDIR%\explorer.exe",),
    "calculator": (r"%WINDIR%\System32\calc.exe",),
}

_MAC_APP_HINTS = ("/Applications", os.path.expanduser("~/Applications"))

# The window OCADE most recently opened or brought forward.
#
# WHY THIS IS NOT "THE FOREGROUND WINDOW". Windows refuses foreground changes
# from a process that does not own input focus, and OCADE's host is a background
# child process — so after "open Notepad", `GetForegroundWindow()` frequently
# still returns whatever the user was looking at. Typing then went to the wrong
# application entirely, and the only thing that caught it was the readback check
# declining to confirm.
#
# So the host remembers what it just acted on, and that becomes the default
# target for the next action. It is a one-slot memory, deliberately: anything
# larger is a session model, and a session model that drifts out of step with
# the real desktop is worse than no memory at all. Every read still checks the
# handle is a live window before returning it.
_last_touched: int | None = None


def remember_window(hwnd: int | None) -> None:
    """Record the window OCADE just opened or focused."""
    global _last_touched
    if isinstance(hwnd, int) and hwnd > 0:
        _last_touched = hwnd


def recent_window() -> int | None:
    """The remembered window, if it still exists."""
    if _last_touched is None:
        return None
    try:
        import win32gui  # noqa: PLC0415

        return _last_touched if win32gui.IsWindow(_last_touched) else None
    except Exception:
        return None


def _expand(path: str) -> str:
    return os.path.expandvars(path)


def _popen_kwargs() -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
    }
    if sys.platform == "win32":
        # No console window flashing up behind a GUI application.
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    return kwargs


# --------------------------------------------------------------- displays --


class DisplayRect(NamedTuple):
    left: int
    top: int
    right: int
    bottom: int
    primary: bool


def _monitor_rects() -> list[DisplayRect]:
    """Every display, ordered left-to-right then top-down.

    Sorted so a display index means the same thing between calls. An unsorted
    enumeration order is whatever the driver felt like, which makes "the second
    monitor" a different screen after a reboot.
    """
    if sys.platform != "win32":
        return []
    import win32api  # noqa: PLC0415
    import win32con  # noqa: PLC0415

    rects: list[DisplayRect] = []
    for handle, _hdc, rect in win32api.EnumDisplayMonitors():
        try:
            info = win32api.GetMonitorInfo(handle)
            left, top, right, bottom = info["Monitor"]
            primary = bool(info["Flags"] & win32con.MONITORINFOF_PRIMARY)
        except Exception:
            left, top, right, bottom = rect
            primary = False
        rects.append(DisplayRect(int(left), int(top), int(right), int(bottom), primary))
    rects.sort(key=lambda r: (r.left, r.top))
    return rects


def list_displays(_request=None) -> dict[str, Any]:
    """The physical screens attached to this computer."""
    rows = _monitor_rects()
    displays = [
        {
            "index": index + 1,
            "bounds": {
                "x": r.left,
                "y": r.top,
                "width": r.right - r.left,
                "height": r.bottom - r.top,
            },
            "primary": r.primary,
        }
        for index, r in enumerate(rows)
    ]
    return {"displays": displays, "count": len(displays)}


def _display_bounds(index: int) -> tuple[int, int, int, int]:
    rows = _monitor_rects()
    if not rows:
        raise Refusal("This computer reported no displays.", "unsupported")
    position = max(1, index) - 1
    if position >= len(rows):
        raise Refusal(
            f"This computer has {len(rows)} display{'' if len(rows) == 1 else 's'}, "
            f"so display {index} does not exist.",
            "unsupported",
        )
    r = rows[position]
    return r.left, r.top, r.right, r.bottom


# ----------------------------------------------------------- applications --


def _resolve_windows_executable(name: str) -> tuple[str, str] | None:
    """(executable, matched-name) for an application, or None.

    Three sources, cheapest first: the known table, PATH, then the installed
    applications the registry reports. The registry pass is last because it is
    the slow one and because it is also the broadest — anything the machine
    genuinely has installed is reachable through it.
    """
    key = name.strip().lower()

    for known, candidates in _KNOWN_WINDOWS_APPS.items():
        if known == key or known in key:
            for candidate in candidates:
                path = _expand(candidate)
                if os.path.isfile(path):
                    return path, known
    direct = shutil.which(key) or shutil.which(f"{key}.exe")
    if direct:
        return direct, key

    from .system import installed_applications  # noqa: PLC0415

    best: tuple[str, str] | None = None
    for app in installed_applications().get("applications", []):
        label = str(app.get("name", ""))
        if key not in label.lower():
            continue
        location = str(app.get("installLocation") or "")
        if not location or not os.path.isdir(location):
            continue
        for entry in sorted(os.listdir(location)):
            if not entry.lower().endswith(".exe"):
                continue
            # Prefer an executable whose own name resembles the request:
            # an install folder often holds updaters and crash handlers too.
            candidate = os.path.join(location, entry)
            if key in entry.lower():
                return candidate, label
            best = best or (candidate, label)
    return best


def _resolve_macos_application(name: str) -> tuple[str, str] | None:
    key = name.strip().lower()
    for root in _MAC_APP_HINTS:
        if not os.path.isdir(root):
            continue
        for entry in sorted(os.listdir(root)):
            if not entry.lower().endswith(".app"):
                continue
            if key in entry.lower()[: -len(".app")]:
                return os.path.join(root, entry), entry[: -len(".app")]
    return None


def _windows_for_pid(pid: int) -> list[int]:
    """Top-level windows owned by one process id, largest first.

    Deliberately cheap: `GetWindowThreadProcessId` and a rectangle, with no
    `psutil.Process(...).exe()` call per window. That path opens a process
    handle and reads an image path for every window on the desktop, which is
    fine once and ruinous inside a poll loop on a loaded machine — it was the
    measured cause of a launch that "failed" while succeeding.
    """
    if sys.platform != "win32":
        return []
    import win32gui  # noqa: PLC0415
    import win32process  # noqa: PLC0415

    found: list[tuple[int, int]] = []

    def visit(hwnd: int, _param) -> bool:
        if not win32gui.IsWindowVisible(hwnd) and not win32gui.IsIconic(hwnd):
            return True
        if win32gui.GetWindow(hwnd, 4):  # GW_OWNER — a dialog, not a main window
            return True
        try:
            _, owner = win32process.GetWindowThreadProcessId(hwnd)
            if owner != pid:
                return True
            left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        except Exception:
            return True
        area = max(0, right - left) * max(0, bottom - top)
        if area < 40_000:  # smaller than ~200x200: a splash or a tooltip
            return True
        found.append((area, hwnd))
        return True

    win32gui.EnumWindows(visit, None)
    found.sort(reverse=True)
    return [hwnd for _area, hwnd in found]


def _windows_for_process(executable: str) -> list[int]:
    """Top-level windows belonging to one executable, largest first."""
    if sys.platform != "win32":
        return []
    import psutil  # noqa: PLC0415
    import win32gui  # noqa: PLC0415
    import win32process  # noqa: PLC0415

    wanted = os.path.basename(executable).lower()
    found: list[tuple[int, int]] = []

    def visit(hwnd: int, _param) -> bool:
        if not win32gui.IsWindowVisible(hwnd) and not win32gui.IsIconic(hwnd):
            return True
        if win32gui.GetWindow(hwnd, 4):  # GW_OWNER — a dialog, not a main window
            return True
        try:
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            if pid <= 0:
                return True
            if os.path.basename(psutil.Process(pid).exe()).lower() != wanted:
                return True
            left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        except Exception:
            return True
        area = max(0, right - left) * max(0, bottom - top)
        if area < 40_000:  # smaller than ~200x200: a splash or a tooltip
            return True
        found.append((area, hwnd))
        return True

    win32gui.EnumWindows(visit, None)
    found.sort(reverse=True)
    return [hwnd for _area, hwnd in found]


def _foreground(hwnd: int) -> bool:
    """Bring a window forward, working around Windows' foreground lock.

    Windows refuses `SetForegroundWindow` from a process that does not own the
    current input focus. Attaching to the foreground thread for the duration of
    the call is the documented way round it, and it is bounded: the attachment
    is released immediately afterwards whatever happens.
    """
    if sys.platform != "win32":
        return False
    import win32con  # noqa: PLC0415
    import win32gui  # noqa: PLC0415
    import win32process  # noqa: PLC0415

    if not win32gui.IsWindow(hwnd):
        return False
    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)

    current = win32gui.GetForegroundWindow()
    attachments: list[tuple[int, int]] = []
    native_failed = False
    try:
        import win32api  # noqa: PLC0415

        caller_thread = win32api.GetCurrentThreadId()
        target_thread, _ = win32process.GetWindowThreadProcessId(hwnd)
        foreground_thread, _ = (
            win32process.GetWindowThreadProcessId(current) if current else (0, 0)
        )
        # SetForegroundWindow is called by *this* thread, so this thread must
        # join the input queues that currently own focus. The previous version
        # attached the foreground app directly to the target app and never
        # attached the caller, which made success depend on which terminal or
        # test runner happened to be active.
        for other_thread in (foreground_thread, target_thread):
            if other_thread and other_thread != caller_thread:
                pair = (caller_thread, other_thread)
                if pair not in attachments:
                    win32api.AttachThreadInput(*pair, True)
                    attachments.append(pair)
        win32gui.BringWindowToTop(hwnd)
        win32gui.SetForegroundWindow(hwnd)
        try:
            win32gui.SetFocus(hwnd)
        except Exception:
            # Top-level windows do not always accept SetFocus directly; the
            # foreground readback below remains the authority.
            pass
    except Exception:
        native_failed = True
    finally:
        if attachments:
            try:
                import win32api  # noqa: PLC0415

                for source_thread, destination_thread in reversed(attachments):
                    win32api.AttachThreadInput(source_thread, destination_thread, False)
            except Exception:
                pass
    time.sleep(0.12)
    if not native_failed and win32gui.GetForegroundWindow() == hwnd:
        return True

    # Windows can still reject the native sequence under its foreground lock
    # (notably when a browser owns the shell's last input). pywinauto's UIA
    # wrapper has a second, platform-maintained focus path. This remains a
    # semantic focus operation on the same validated hwnd, not a blind click.
    try:
        require("pywinauto", "Focusing a window").Desktop(backend="uia").window(
            handle=hwnd
        ).set_focus()
    except Exception:
        return False
    time.sleep(0.12)
    return win32gui.GetForegroundWindow() == hwnd


def launch_application(request) -> dict[str, Any]:
    """Open an application by name, then confirm a window actually appeared.

    Reuses a running instance by default. Someone asking to "open Cursor" with
    Cursor already open wants to look at it, not to acquire a second window with
    none of their files in it.
    """
    payload = getattr(request, "payload", {}) or {}
    name = bounded_text(payload.get("name"), "name", 120)
    reuse = payload.get("reuse") is not False

    if sys.platform == "win32":
        resolved = _resolve_windows_executable(name)
    elif sys.platform == "darwin":
        resolved = _resolve_macos_application(name)
    else:
        resolved = (shutil.which(name), name) if shutil.which(name) else None

    if resolved is None:
        raise Refusal(
            f"No application called {name!r} is installed on this computer.",
            "unsupported",
        )
    executable, label = resolved

    if reuse and sys.platform == "win32":
        existing = _windows_for_process(executable)
        if existing:
            focused = _foreground(existing[0])
            remember_window(existing[0])
            import win32gui  # noqa: PLC0415

            return {
                "application": clamp_text(label, 200),
                "started": False,
                "reused": True,
                "hwnd": existing[0],
                "title": clamp_text(win32gui.GetWindowText(existing[0]), 256),
                "verified": focused,
                "detail": (
                    f"{label} was already running and has been brought to the front."
                    if focused
                    else f"{label} was already running, but Windows would not move focus to it."
                ),
            }

    try:
        if sys.platform == "darwin":
            child = subprocess.Popen(["/usr/bin/open", "-a", executable], **_popen_kwargs())
        else:
            child = subprocess.Popen([executable], **_popen_kwargs())
    except OSError as error:
        raise Refusal(f"{label} could not be started: {error.strerror}.", "retryable_failure") from None

    hwnd: int | None = None
    title = ""
    if sys.platform == "win32":
        import win32gui  # noqa: PLC0415

        # The process we just started is the one to look at. Polling by pid is
        # a thread-id comparison per window; polling by executable name opens a
        # process handle and reads an image path per window, per tick.
        deadline = time.monotonic() + _WINDOW_WAIT_S
        while time.monotonic() < deadline:
            windows = _windows_for_pid(child.pid)
            if windows:
                hwnd = windows[0]
                title = clamp_text(win32gui.GetWindowText(hwnd), 256)
                break
            time.sleep(_POLL_S)

        # Some launchers hand off to an existing broker process and exit, so the
        # window belongs to a pid we never saw. One fallback sweep by executable,
        # after the loop rather than inside it.
        if hwnd is None:
            windows = _windows_for_process(executable)
            if windows:
                hwnd = windows[0]
                title = clamp_text(win32gui.GetWindowText(hwnd), 256)

        # BRING IT FORWARD. "Open Notepad" means a Notepad the user can type
        # into, and the next step in almost every task is typing. Without this
        # the new window opened behind whatever had focus, the following
        # `input.type` went to the wrong application, and the only thing that
        # stopped it being written into a stranger's window was the readback
        # check refusing to confirm.
        if hwnd is not None:
            _foreground(hwnd)
            remember_window(hwnd)

    return {
        "application": clamp_text(label, 200),
        "started": True,
        "reused": False,
        "hwnd": hwnd,
        "title": title,
        # A launch is verified by a window existing, not by Popen returning.
        "verified": hwnd is not None if sys.platform == "win32" else None,
        "detail": (
            f"Opened {label}."
            if hwnd is not None or sys.platform != "win32"
            else f"{label} was started but has not put a window on screen yet."
        ),
    }


def focus_application(request) -> dict[str, Any]:
    """Bring an already-running application forward. Starts nothing."""
    payload = getattr(request, "payload", {}) or {}
    name = bounded_text(payload.get("name"), "name", 120)
    if sys.platform != "win32":
        raise Refusal("Focusing an application by name is only supported on Windows.", "unsupported")

    resolved = _resolve_windows_executable(name)
    if resolved is None:
        raise Refusal(f"No application called {name!r} is installed on this computer.", "unsupported")
    executable, label = resolved
    windows = _windows_for_process(executable)
    if not windows:
        raise Refusal(f"{label} is not running, so there is no window to focus.", "state_changed")

    import win32gui  # noqa: PLC0415

    focused = _foreground(windows[0])
    remember_window(windows[0])
    return {
        "application": clamp_text(label, 200),
        "hwnd": windows[0],
        "title": clamp_text(win32gui.GetWindowText(windows[0]), 256),
        "verified": focused,
        "detail": (
            f"{label} is now in front."
            if focused
            else "Windows would not move focus to that window. Click it once, then ask again."
        ),
    }


# ------------------------------------------------------ window placement --


def arrange_window(request) -> dict[str, Any]:
    """Place a window on a display, and read back where it actually landed.

    `layout` is a small closed set rather than four numbers. A caller that can
    pass arbitrary coordinates can put a window somewhere no display covers,
    which is indistinguishable from losing it.
    """
    payload = getattr(request, "payload", {}) or {}
    if sys.platform != "win32":
        raise Refusal("Window placement is only supported on Windows.", "unsupported")

    import win32con  # noqa: PLC0415
    import win32gui  # noqa: PLC0415

    hwnd = payload.get("hwnd")
    if not isinstance(hwnd, int) or hwnd <= 0:
        hwnd = win32gui.GetForegroundWindow()
    if not hwnd or not win32gui.IsWindow(hwnd):
        raise Refusal("That window no longer exists.", "state_changed")

    layout = bounded_text(payload.get("layout") or "maximise", "layout", 24).lower()
    if layout not in {"maximise", "maximize", "left", "right", "centre", "center", "restore"}:
        raise Refusal(f"Unsupported window layout: {layout}", "unsupported")

    display = payload.get("display")
    left, top, right, bottom = (
        _display_bounds(int(display)) if isinstance(display, int) else _current_display(hwnd)
    )
    width, height = right - left, bottom - top

    before = win32gui.GetWindowRect(hwnd)
    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)

    if layout in {"maximise", "maximize"}:
        target = (left, top, width, height)
    elif layout == "left":
        target = (left, top, width // 2, height)
    elif layout == "right":
        target = (left + width // 2, top, width // 2, height)
    elif layout == "restore":
        target = (before[0], before[1], before[2] - before[0], before[3] - before[1])
    else:  # centre
        w, h = int(width * 0.7), int(height * 0.8)
        target = (left + (width - w) // 2, top + (height - h) // 2, w, h)

    win32gui.SetWindowPos(
        hwnd,
        win32con.HWND_TOP,
        *target,
        win32con.SWP_SHOWWINDOW | win32con.SWP_FRAMECHANGED,
    )
    time.sleep(0.15)
    after = win32gui.GetWindowRect(hwnd)
    landed = {
        "x": after[0],
        "y": after[1],
        "width": after[2] - after[0],
        "height": after[3] - after[1],
    }
    # Windows honours a placement approximately: DPI scaling, snap layouts and
    # minimum sizes all adjust it. Within a hundred pixels of the requested
    # origin is the window having moved where it was asked to go.
    verified = abs(landed["x"] - target[0]) < 100 and abs(landed["y"] - target[1]) < 100
    return {
        "hwnd": hwnd,
        "layout": layout,
        "requested": {"x": target[0], "y": target[1], "width": target[2], "height": target[3]},
        "bounds": landed,
        "verified": verified,
        "detail": (
            "The window moved where it was asked to go."
            if verified
            else "The window was placed, but Windows put it somewhere else."
        ),
    }


def _current_display(hwnd: int) -> tuple[int, int, int, int]:
    import win32gui  # noqa: PLC0415

    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    centre_x, centre_y = (left + right) // 2, (top + bottom) // 2
    for r in _monitor_rects():
        if r.left <= centre_x < r.right and r.top <= centre_y < r.bottom:
            return r.left, r.top, r.right, r.bottom
    return _display_bounds(1)
