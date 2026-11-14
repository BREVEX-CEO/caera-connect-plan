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
                win32con.WM_DESTROY: lambda *_: win32gui.PostQuitMessage(0),
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

    def _closing(self, hwnd, message, wparam, lparam) -> int:
        import win32gui  # type: ignore[import-not-found]

        try:
            win32gui.Shell_NotifyIcon(win32gui.NIM_DELETE, (hwnd, 0))
        finally:
            win32gui.DestroyWindow(hwnd)
        return 0
