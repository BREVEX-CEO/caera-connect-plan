"""The companion's notification-area icon on Windows (plan v8 5.4): visible while the companion
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


class MacMenuBar:
    """The companion's menu-bar item on macOS (plan v8 11.6), with the same STOP and Open JARVIS.
    AppKit needs the main thread's run loop, which the companion's own loop holds, so the item
    lives in a small process of its own; it ends when the companion closes it or ends."""

    def __init__(self, stop_flag: Path, website: str | None = None):
        self.stop_flag, self.website = stop_flag, website
        self.process = None

    def start(self) -> bool:
        """Show the item; False when it could not be shown within ten seconds."""
        import os
        import subprocess
        import sys

        command = ([sys.executable, "worker", "ocade_agent.tray"] if getattr(sys, "frozen", False)
                   else [sys.executable, "-s", "-m", "ocade_agent.tray"])
        self.process = subprocess.Popen(
            command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            env={**os.environ, "OCADE_MENU_STOP": str(self.stop_flag), "OCADE_MENU_WEBSITE": self.website or ""})
        answer: list[bytes] = []
        reader = threading.Thread(target=lambda: answer.append(self.process.stdout.readline()), daemon=True)
        reader.start()
        reader.join(10)
        if answer == [b"ready\n"]:
            return True
        self.close()
        return False

    def close(self) -> None:
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(5)
            except Exception:
                self.process.kill()


def _menu_bar() -> None:
    import os

    from AppKit import (  # type: ignore[import-not-found]
        NSApplication, NSApplicationActivationPolicyAccessory, NSMenu, NSMenuItem, NSStatusBar,
        NSVariableStatusItemLength,
    )
    from Foundation import NSObject, NSTimer  # type: ignore[import-not-found]

    stop = Path(os.environ["OCADE_MENU_STOP"])
    website = os.environ.get("OCADE_MENU_WEBSITE") or None
    parent = os.getppid()
    app = NSApplication.sharedApplication()

    class Actions(NSObject):
        def stopNow_(self, sender):
            stop.parent.mkdir(parents=True, exist_ok=True)
            stop.touch()

        def openJarvis_(self, sender):
            webbrowser.open(website)

        def watch_(self, timer):
            if os.getppid() != parent:  # the companion ended: so does its item
                app.terminate_(None)

    app.setActivationPolicy_(NSApplicationActivationPolicyAccessory)
    item = NSStatusBar.systemStatusBar().statusItemWithLength_(NSVariableStatusItemLength)
    item.button().setTitle_("OCADE")
    item.button().setToolTip_("OCADE JARVIS is running")
    actions = Actions.alloc().init()
    menu = NSMenu.alloc().init()
    for title, action in (("STOP JARVIS now", "stopNow:"), ("Open JARVIS", "openJarvis:")):
        if action == "openJarvis:" and not website:
            continue
        entry = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(title, action, "")
        entry.setTarget_(actions)
        menu.addItem_(entry)
    item.setMenu_(menu)
    NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(1.0, actions, "watch:", None, True)
    print("ready", flush=True)
    app.run()


if __name__ == "__main__":
    _menu_bar()
