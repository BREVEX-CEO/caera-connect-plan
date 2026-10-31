"""What is installed and what is open on this Windows computer (plan.md §8, P07).

Read-only and local. Installed apps come from the Start Menu shortcuts and the
App Paths registry keys Windows itself uses to launch programs; open windows from
EnumWindows with each one's process id, executable and start time, so a later
action can prove it targets the same window and not a reused handle. Nothing is
guessed from a title alone. Off Windows both lists are empty.

STATUS: UNTESTED on Windows.
"""

from __future__ import annotations

import ctypes
import os
import sys
from pathlib import Path


def engines() -> list[str]:
    """Which shared engines this computer can run now: operations that need a missing one are
    never offered to the planner, so a task cannot fail halfway for a missing program."""
    import shutil

    from . import engine

    found = []
    if shutil.which("ffmpeg") and shutil.which("ffprobe"):
        found.append("ffmpeg")
    browsers = Path(os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
                    or (Path(os.environ.get("LOCALAPPDATA", "")) if sys.platform == "win32" else Path.home() / ".cache")
                    / "ms-playwright")
    edge = Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Microsoft/Edge/Application/msedge.exe"
    if (os.environ.get("OCADE_BROWSER_EXECUTABLE") or any(browsers.glob("chromium*"))
            or (sys.platform == "win32" and edge.exists())):
        found.append("browser")
    if engine.office_available():
        found.append("office")
    return found


def installed_apps(limit: int = 300) -> list[dict]:
    """[{name, exe}] for apps a person can launch, de-duplicated by executable."""
    if sys.platform != "win32":
        return []
    import winreg

    import pythoncom  # type: ignore[import-not-found]
    import win32com.client  # type: ignore[import-not-found]

    pythoncom.CoInitialize()  # called from worker threads; COM is per thread
    found: dict[str, str] = {}
    shell = win32com.client.Dispatch("WScript.Shell")
    menus = [Path(os.environ.get("APPDATA", "")), Path(os.environ.get("PROGRAMDATA", ""))]
    for root in (m / "Microsoft/Windows/Start Menu/Programs" for m in menus):
        for link in root.rglob("*.lnk") if root.is_dir() else []:
            try:
                target = shell.CreateShortCut(str(link)).TargetPath
            except Exception:
                continue
            if target.lower().endswith(".exe") and "uninstall" not in link.stem.lower():
                found.setdefault(Path(target).name.lower(), link.stem[:120])
    for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        try:
            key = winreg.OpenKey(hive, r"Software\Microsoft\Windows\CurrentVersion\App Paths")
        except OSError:
            continue
        with key:
            for index in range(winreg.QueryInfoKey(key)[0]):
                name = winreg.EnumKey(key, index)
                if name.lower().endswith(".exe"):
                    found.setdefault(name.lower(), Path(name).stem[:120])
    apps = [{"name": name, "exe": exe} for exe, name in found.items() if len(exe) <= 84]
    return sorted(apps, key=lambda app: app["name"].lower())[:limit]


def app_path(exe: str) -> str | None:
    """Where Windows would launch `exe` from (App Paths, then PATH)."""
    if sys.platform != "win32":
        return None
    import shutil
    import winreg

    for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        try:
            with winreg.OpenKey(hive, rf"Software\Microsoft\Windows\CurrentVersion\App Paths\{exe}") as key:
                return winreg.QueryValue(key, None)
        except OSError:
            continue
    return shutil.which(exe)


def open_windows(limit: int = 60) -> list[dict]:
    """Visible top-level windows: {exe, pid, hwnd, started, title}."""
    if sys.platform != "win32":
        return []
    import win32api  # type: ignore[import-not-found]
    import win32con  # type: ignore[import-not-found]
    import win32gui  # type: ignore[import-not-found]
    import win32process  # type: ignore[import-not-found]

    windows: list[dict] = []

    def visit(hwnd, _):
        if not win32gui.IsWindowVisible(hwnd) or not win32gui.GetWindowText(hwnd):
            return True
        identity = window_identity(hwnd, win32api, win32con, win32process)
        if identity:
            windows.append(identity | {"title": win32gui.GetWindowText(hwnd)[:200]})
        return len(windows) < limit

    win32gui.EnumWindows(visit, None)
    return windows


def window_identity(hwnd: int, win32api=None, win32con=None, win32process=None) -> dict | None:
    """{exe, pid, hwnd, started} for a window, or None when its process cannot be read."""
    if win32api is None:
        import win32api  # type: ignore[import-not-found]
        import win32con  # type: ignore[import-not-found]
        import win32process  # type: ignore[import-not-found]
    try:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        handle = win32api.OpenProcess(win32con.PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        try:
            image = ctypes.create_unicode_buffer(1024)
            size = ctypes.c_ulong(len(image))
            if not ctypes.windll.kernel32.QueryFullProcessImageNameW(int(handle), 0, image, ctypes.byref(size)):
                return None
            exe = Path(image.value).name.lower()
            created = win32process.GetProcessTimes(handle)["CreationTime"]
        finally:
            win32api.CloseHandle(handle)
    except Exception:
        return None
    return {"exe": exe, "pid": pid, "hwnd": int(hwnd), "started": created.timestamp()}
