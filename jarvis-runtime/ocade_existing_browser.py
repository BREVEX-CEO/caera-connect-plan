"""
The person's own running browser, found without any OCADE add-on.

Chromium browsers write `DevToolsActivePort` into their user-data folder when
the person turns on remote debugging for them (chrome://inspect/#remote-debugging,
or a --remote-debugging-port they started themselves). Its first line is the
loopback port, its second the browser's DevTools socket path. JARVIS attaches
only to that endpoint, only on 127.0.0.1, and never reads the profile itself
(no cookies, no saved passwords).

No browser is named here. Windows lists the browsers it has registered, the
person's default first; macOS has its installed apps. A Chromium browser is
recognised by its own resources.pak, not by its name.
"""
from __future__ import annotations

import itertools
import os
import platform
import socket
import subprocess
from pathlib import Path

SYSTEM = platform.system()
SETUP_PAGE = "chrome://inspect/#remote-debugging"  # every Chromium browser answers its chrome:// pages


def _command_program(command: str) -> Path:
    return Path(command.strip().strip('"').split('"')[0].split(" --")[0].strip())


def _registered_windows() -> list[tuple[str, Path]]:
    import winreg
    found: dict[str, tuple[str, Path]] = {}
    for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        try:
            clients = winreg.OpenKey(hive, r"SOFTWARE\Clients\StartMenuInternet")
        except OSError:
            continue
        with clients:
            for index in itertools.count():
                try:
                    key = winreg.EnumKey(clients, index)
                except OSError:
                    break
                try:
                    name = winreg.QueryValue(clients, key) or key
                    program = _command_program(winreg.QueryValue(clients, rf"{key}\shell\open\command"))
                except OSError:
                    continue
                found.setdefault(str(program).lower(), (name, program))
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\Shell\Associations"
                            r"\UrlAssociations\https\UserChoice") as choice:
            prog_id = winreg.QueryValueEx(choice, "ProgId")[0]
        default = str(_command_program(winreg.QueryValue(winreg.HKEY_CLASSES_ROOT,
                                                         rf"{prog_id}\shell\open\command"))).lower()
    except OSError:
        default = ""
    return sorted(found.values(), key=lambda browser: str(browser[1]).lower() != default)


def browsers() -> list[tuple[str, Path]]:
    """(name, program) of every Chromium browser installed here, the person's default first."""
    if SYSTEM == "Windows":
        return [(name, program) for name, program in _registered_windows()
                if program.is_file() and any(program.parent.glob("*/resources.pak"))]
    if SYSTEM == "Darwin":  # ponytail: no default-first ordering on macOS, add when a Mac build ships
        apps = [app for root in (Path("/Applications"), Path.home() / "Applications")
                for app in sorted(root.glob("*.app"))]
        return [(app.stem, app) for app in apps
                if any(app.glob("Contents/Frameworks/*.framework/Versions/*/Resources/resources.pak"))]
    return []


def _user_data_dirs() -> list[Path]:
    home = Path.home()
    if SYSTEM == "Windows":
        # Chromium keeps <Vendor>\<Product>\User Data beside or mirroring <Vendor>\<Product>\Application.
        local = Path(os.environ.get("LOCALAPPDATA", home / "AppData/Local"))
        dirs = []
        for _name, program in browsers():
            install = program.parent.parent
            dirs += [install / "User Data", local / install.parent.name / install.name / "User Data",
                     local / install.name / "User Data"]
        return list(dict.fromkeys(dirs))
    root = home / "Library/Application Support" if SYSTEM == "Darwin" else \
        Path(os.environ.get("XDG_CONFIG_HOME", home / ".config"))
    return [port.parent for pattern in ("*/DevToolsActivePort", "*/*/DevToolsActivePort")
            for port in root.glob(pattern)]


def _listening(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.3):
            return True
    except OSError:
        return False


def find(dirs: list[Path] | None = None) -> dict | None:
    """{"endpoint"} of a running browser that allows attaching, else None."""
    for folder in dirs if dirs is not None else _user_data_dirs():
        try:
            lines = (folder / "DevToolsActivePort").read_text(encoding="utf-8").splitlines()
            port, path = int(lines[0].strip()), lines[1].strip()
        except (OSError, ValueError, IndexError):
            continue
        if not (0 < port < 65536 and path.startswith("/devtools/browser/")):
            continue
        # A file left behind by a browser that has since closed is not a browser.
        if _listening(port):
            return {"endpoint": f"ws://127.0.0.1:{port}{path}"}
    return None


def _start(program: Path, *args: str) -> None:
    if SYSTEM == "Darwin":
        subprocess.Popen(["open", "-g", "-a", str(program), *args])
    else:
        subprocess.Popen([str(program), *args], creationflags=getattr(subprocess, "DETACHED_PROCESS", 0))


def open_setup() -> str | None:
    """Open the person's browser at its own page for letting JARVIS work in it; the browser's name."""
    found = browsers()
    if not found:
        return None
    name, program = found[0]
    try:
        _start(program, SETUP_PAGE)
    except OSError:
        return None
    return name


def open_default() -> bool:
    """Start the person's own browser, normal profile, when it is not running. True if started."""
    found = browsers()
    if not found:
        return False
    program = found[0][1]
    if SYSTEM == "Windows":
        running = subprocess.run(["tasklist", "/FI", f"IMAGENAME eq {program.name}", "/NH"],
                                 capture_output=True, text=True,
                                 creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
        if program.name.lower() in running.lower():
            return False
    try:
        _start(program)
    except OSError:
        return False
    return True
