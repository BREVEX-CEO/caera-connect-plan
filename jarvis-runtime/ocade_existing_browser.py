"""
The person's own running browser, found without any OCADE add-on.

Chromium browsers write `DevToolsActivePort` into their user-data folder when
the person turns on remote debugging for them (chrome://inspect/#remote-debugging,
or a --remote-debugging-port they started themselves). Its first line is the
loopback port, its second the browser's DevTools socket path. JARVIS attaches
only to that endpoint, only on 127.0.0.1, and never reads the profile itself
(no cookies, no saved passwords).

The person's default browser is tried first (donor `_detect_default_browser`).
"""
from __future__ import annotations

import os
import platform
import socket
from pathlib import Path

SYSTEM = platform.system()


def _user_data_dirs() -> dict[str, list[Path]]:
    home = Path.home()
    if SYSTEM == "Windows":
        local = Path(os.environ.get("LOCALAPPDATA", home / "AppData/Local"))
        return {"chrome": [local / "Google/Chrome/User Data"],
                "edge": [local / "Microsoft/Edge/User Data"],
                "brave": [local / "BraveSoftware/Brave-Browser/User Data"]}
    if SYSTEM == "Darwin":
        support = home / "Library/Application Support"
        return {"chrome": [support / "Google/Chrome"],
                "edge": [support / "Microsoft Edge"],
                "brave": [support / "BraveSoftware/Brave-Browser"]}
    config = Path(os.environ.get("XDG_CONFIG_HOME", home / ".config"))
    return {"chrome": [config / "google-chrome", config / "chromium"],
            "edge": [config / "microsoft-edge"],
            "brave": [config / "BraveSoftware/Brave-Browser"]}


def _listening(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.3):
            return True
    except OSError:
        return False


def _default_first(names: list[str]) -> list[str]:
    try:
        from actions.browser_control import _detect_default_browser
        preferred = _detect_default_browser()
    except Exception:  # detection is a preference, never a requirement
        preferred = "chrome"
    return sorted(names, key=lambda name: name != preferred)


def find(dirs: dict[str, list[Path]] | None = None) -> dict | None:
    """{"browser", "endpoint"} of a running browser that allows attaching, else None."""
    dirs = dirs if dirs is not None else _user_data_dirs()
    for name in _default_first(list(dirs)):
        for folder in dirs[name]:
            try:
                lines = (folder / "DevToolsActivePort").read_text(encoding="utf-8").splitlines()
                port, path = int(lines[0].strip()), lines[1].strip()
            except (OSError, ValueError, IndexError):
                continue
            if not (0 < port < 65536 and path.startswith("/devtools/browser/")):
                continue
            # A file left behind by a browser that has since closed is not a browser.
            if _listening(port):
                return {"browser": name, "endpoint": f"ws://127.0.0.1:{port}{path}"}
    return None
