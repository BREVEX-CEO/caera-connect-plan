"""What the Linux desktop is, and what the companion can and cannot do in it (REQ-135).

Reads the session (X11 or Wayland), the desktop environment, the distribution, whether the
xdg-desktop-portal services and the user's D-Bus session are present, the three X libraries the
bridge loads and whether this process runs from a stable executable path. Everything is a
fact the person can act on: a Wayland session names the portal route and the missing package
names, never a guess. Nothing here changes the system.
"""

from __future__ import annotations

import ctypes.util
import os
import shutil
import subprocess
import sys
from pathlib import Path

# library -> package name per distribution family
LIBRARIES = {
    "X11": {"debian": "libx11-6", "fedora": "libX11", "arch": "libx11", "suse": "libX11-6"},
    "Xtst": {"debian": "libxtst6", "fedora": "libXtst", "arch": "libxtst", "suse": "libXtst6"},
    "Xss": {"debian": "libxss1", "fedora": "libXScrnSaver", "arch": "libxss", "suse": "libXss1"},
}
FAMILY = {"debian": "debian", "ubuntu": "debian", "linuxmint": "debian", "pop": "debian",
          "fedora": "fedora", "rhel": "fedora", "centos": "fedora", "rocky": "fedora", "almalinux": "fedora",
          "arch": "arch", "manjaro": "arch", "opensuse": "suse", "sles": "suse"}
PORTAL_NAME = "org.freedesktop.portal.Desktop"


def distribution(text: str) -> tuple[str, str]:
    """(family, pretty name) from the text of /etc/os-release; family is 'unknown' when not recognised."""
    values = {}
    for line in text.splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip('"').strip("'")
    ids = [values.get("ID", "").lower(), *values.get("ID_LIKE", "").lower().split()]
    family = next((FAMILY[i] for i in ids if i in FAMILY), "unknown")
    return family, values.get("PRETTY_NAME") or values.get("NAME") or "Linux"


def _bus_names(run=subprocess.run) -> set[str] | None:
    """Names on the user's D-Bus session, or None when the session bus cannot be asked."""
    if not os.environ.get("DBUS_SESSION_BUS_ADDRESS") and not os.environ.get("XDG_RUNTIME_DIR"):
        return None
    for command in (["busctl", "--user", "--no-pager", "--list", "list"],
                    ["gdbus", "call", "--session", "--dest", "org.freedesktop.DBus", "--object-path",
                     "/org/freedesktop/DBus", "--method", "org.freedesktop.DBus.ListNames"]):
        if shutil.which(command[0]) is None:
            continue
        try:
            done = run(command, capture_output=True, text=True, timeout=5, check=False)
        except (OSError, subprocess.TimeoutExpired):
            continue
        if done.returncode == 0:
            return {token.strip("'(),[] ") for token in done.stdout.replace("\n", " ").split()}
    return None


def describe(environ=None, os_release: str | None = None, bus=None, find_library=None, executable=None) -> dict:
    env = os.environ if environ is None else environ
    session = (env.get("XDG_SESSION_TYPE") or "").lower()
    if not session:
        session = "wayland" if env.get("WAYLAND_DISPLAY") and not env.get("DISPLAY") else "x11" if env.get("DISPLAY") else "none"
    desktop = (env.get("XDG_CURRENT_DESKTOP") or "unknown").split(":")[0] or "unknown"
    if os_release is None:
        try:
            os_release = Path("/etc/os-release").read_text(encoding="utf-8")
        except OSError:
            os_release = ""
    family, pretty = distribution(os_release)
    names = _bus_names() if bus is None else bus
    find = find_library or ctypes.util.find_library
    missing = [{"library": lib, "package": packages.get(family, packages["debian"])}
               for lib, packages in LIBRARIES.items() if find(lib) is None]
    path = Path(executable or sys.executable).resolve()
    result = {
        "session": session, "desktop": desktop, "distribution": pretty, "family": family,
        "user_session_bus": names is not None,
        "portal": None if names is None else PORTAL_NAME in names,
        "missing_libraries": missing,
        "executable": str(path),
        "executable_stable": not str(path).startswith(("/tmp/", "/var/tmp/")) and os.access(path, os.X_OK),
    }
    result["supported"] = session == "x11" and not missing
    result["next_step"] = _next_step(result)
    return result


def _next_step(facts: dict) -> str:
    if facts["session"] == "wayland":
        route = ("The screencast and remote-desktop portal is running; the companion does not use it yet, "
                 if facts["portal"] else "No desktop portal is running (install xdg-desktop-portal and your desktop's backend), ")
        return route + "so sign in to an X11 session (\"Xorg\" at the login screen) to let OCADE control apps."
    if facts["session"] == "none":
        return "Start the companion from a graphical user session, not a bare terminal or service."
    if facts["missing_libraries"]:
        return "Install: " + " ".join(m["package"] for m in facts["missing_libraries"]) + "."
    if not facts["user_session_bus"]:
        return "No user D-Bus session was found; start the companion from your desktop login."
    return "Ready."
