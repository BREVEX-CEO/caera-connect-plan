"""The companion's Windows notification-area icon and macOS menu-bar control, visible while the companion
runs, with STOP and a way back to the JARVIS website. STOP here is the same local STOP as
`ocade_agent stop`: the STOP file, which the agent checks between and during steps without any
network, so it works when the server or the model cannot be reached. Uses pywin32, already a
dependency of the Windows desktop bridge. Nothing here grants or decides anything.
"""

from __future__ import annotations

import threading
import webbrowser
from pathlib import Path

STOP_ID, OPEN_ID = 1023, 1024


class WindowsTray:
    def __init__(self, stop_flag: Path, website: str | None = None, tip: str = "OCADE JARVIS is running"):
        self.stop_flag, self.website, self.tip = stop_flag, website, tip
        self.hwnd: int | None = None
        self._ready = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> bool:
        """Show the icon; False when it could not be shown within five seconds."""
        self._thread = threading.Thread(target=self._run, name="ocade-tray", daemon=True)
        self._thread.start()
        return self._ready.wait(5) and self.hwnd is not None

    def stop_now(self) -> None:
        self.stop_flag.parent.mkdir(parents=True, exist_ok=True)
        self.stop_flag.touch()

    def close(self) -> None:
        import win32con  # type: ignore[import-not-found]
        import win32gui  # type: ignore[import-not-found]

        if self.hwnd:
            win32gui.PostMessage(self.hwnd, win32con.WM_CLOSE, 0, 0)
        if self._thread:
            self._thread.join(5)

    def _run(self) -> None:
        import win32api  # type: ignore[import-not-found]
        import win32con  # type: ignore[import-not-found]
        import win32gui  # type: ignore[import-not-found]

        callback = win32con.WM_USER + 20
        try:
            window_class = win32gui.WNDCLASS()
            window_class.hInstance = win32api.GetModuleHandle(None)
            window_class.lpszClassName = f"OcadeJarvisTray{id(self)}"
            window_class.lpfnWndProc = {
                callback: self._clicked,
                win32con.WM_COMMAND: self._command,
                win32con.WM_CLOSE: self._closing,
                win32con.WM_DESTROY: self._destroyed,
            }
            atom = win32gui.RegisterClass(window_class)
            self.hwnd = win32gui.CreateWindow(atom, "OCADE JARVIS", 0, 0, 0, 0, 0, 0, 0,
                                              window_class.hInstance, None)
            icon = win32gui.LoadIcon(0, win32con.IDI_APPLICATION)
            win32gui.Shell_NotifyIcon(win32gui.NIM_ADD, (
                self.hwnd, 0, win32gui.NIF_ICON | win32gui.NIF_MESSAGE | win32gui.NIF_TIP, callback, icon, self.tip))
        except Exception:
            self.hwnd = None
            self._ready.set()
            return
        self._ready.set()
        win32gui.PumpMessages()

    def _clicked(self, hwnd, message, wparam, lparam) -> int:
        import win32con  # type: ignore[import-not-found]
        import win32gui  # type: ignore[import-not-found]

        if lparam in (win32con.WM_LBUTTONUP, win32con.WM_RBUTTONUP):
            menu = win32gui.CreatePopupMenu()
            win32gui.AppendMenu(menu, win32con.MF_STRING, STOP_ID, "STOP JARVIS now")
            if self.website:
                win32gui.AppendMenu(menu, win32con.MF_STRING, OPEN_ID, "Open JARVIS")
            x, y = win32gui.GetCursorPos()
            win32gui.SetForegroundWindow(hwnd)  # so the menu closes when the person clicks away
            win32gui.TrackPopupMenu(menu, win32con.TPM_LEFTALIGN, x, y, 0, hwnd, None)
            win32gui.PostMessage(hwnd, win32con.WM_NULL, 0, 0)
        return 0

    def _command(self, hwnd, message, wparam, lparam) -> int:
        chosen = wparam & 0xFFFF
        if chosen == STOP_ID:
            self.stop_now()
        elif chosen == OPEN_ID and self.website:
            webbrowser.open(self.website)
        return 0

    def _destroyed(self, hwnd, message, wparam, lparam) -> int:
        import win32gui  # type: ignore[import-not-found]

        win32gui.PostQuitMessage(0)
        return 0

    def _closing(self, hwnd, message, wparam, lparam) -> int:
        import win32gui  # type: ignore[import-not-found]

        try:
            win32gui.Shell_NotifyIcon(win32gui.NIM_DELETE, (hwnd, 0))
        finally:
            win32gui.DestroyWindow(hwnd)
        return 0


class MacTray:
    """A separate status-bar process so Cocoa runs on its required main thread.

    It has no device keys, model connection or task authority. Its STOP menu writes
    only the same local STOP flag as the Windows tray, independently of the network.
    """

    def __init__(self, stop_flag: Path, website: str | None = None):
        self.stop_flag, self.website = stop_flag, website
        self.process = None

    def start(self) -> bool:
        import os
        import subprocess
        import sys

        from mcp.client.stdio import get_default_environment

        executable = [sys.executable] if getattr(sys, "frozen", False) else [
            sys.executable, "-m", "ocade_agent",
        ]
        command = executable + ["tray", "--tray-parent", str(os.getpid())]
        if self.website:
            command += ["--tray-website", self.website]
        environment = {**get_default_environment(), "OCADE_AGENT_HOME": str(self.stop_flag.parent),
                       "PYINSTALLER_RESET_ENVIRONMENT": "1"}
        try:
            self.process = subprocess.Popen(
                command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, env=environment,
            )
        except OSError:
            return False
        return self.process.poll() is None

    def close(self) -> None:
        import subprocess

        if self.process is not None and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)


def run_macos_status(stop_flag: Path, website: str | None, parent_pid: int) -> int:
    """Render the STOP menu in an isolated Cocoa main loop, without new permissions."""
    import os
    import sys
    from urllib.parse import urlsplit

    if sys.platform != "darwin" or parent_pid <= 1 or os.getppid() != parent_pid:
        return 3
    from AppKit import (NSApplication, NSApplicationActivationPolicyAccessory, NSMenu,
                        NSMenuItem, NSStatusBar, NSVariableStatusItemLength)
    from Foundation import NSObject, NSTimer

    # Only open the JARVIS site over TLS, never an arbitrary scheme from saved config.
    url = urlsplit(website or "")
    safe_website = website if url.scheme == "https" and url.netloc and not url.username else None
    application = NSApplication.sharedApplication()
    application.setActivationPolicy_(NSApplicationActivationPolicyAccessory)
    status_bar = NSStatusBar.systemStatusBar()
    item = status_bar.statusItemWithLength_(NSVariableStatusItemLength)
    button = item.button()
    if button is None:
        status_bar.removeStatusItem_(item)
        return 3
    button.setTitle_("JARVIS")

    class Actions(NSObject):
        def stop_(self, sender):
            stop_flag.parent.mkdir(parents=True, exist_ok=True)
            stop_flag.touch()

        def open_(self, sender):
            if safe_website:
                webbrowser.open(safe_website)

        def checkParent_(self, sender):
            if os.getppid() != parent_pid:
                application.terminate_(None)

    actions = Actions.alloc().init()
    menu = NSMenu.alloc().init()
    stop = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_("STOP JARVIS now", "stop:", "")
    stop.setTarget_(actions)
    menu.addItem_(stop)
    if safe_website:
        open_site = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Open JARVIS", "open:", "")
        open_site.setTarget_(actions)
        menu.addItem_(open_site)
    item.setMenu_(menu)
    timer = NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(
        1.0, actions, "checkParent:", None, True)
    try:
        application.run()
    finally:
        timer.invalidate()
        status_bar.removeStatusItem_(item)
    return 0
