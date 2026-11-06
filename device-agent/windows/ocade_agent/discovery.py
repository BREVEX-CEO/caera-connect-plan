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

    found = ["dependencies"]
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
    if sys.platform == "win32":  # UI Automation
        import importlib.util

        if importlib.util.find_spec("pywinauto"):
            found.append("desktop")
    elif sys.platform == "darwin":  # Accessibility, only once the person has granted it
        try:
            import ApplicationServices  # type: ignore[import-not-found]

            if ApplicationServices.AXIsProcessTrusted():
                found.append("desktop")
        except ImportError:
            pass
    return found


def installed_apps(limit: int = 300) -> list[dict]:
    """[{name, exe}] for apps a person can launch, de-duplicated by executable."""
    if sys.platform == "darwin":
        from .mac_worker import installed_apps as mac_apps

        return [{"name": a["name"], "exe": a["exe"]} for a in mac_apps(limit)]
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


# Where each family of browser installs itself; whatever is actually present is reported.
_BROWSERS = {
    "win32": {"Edge": "msedge.exe", "Chrome": "chrome.exe", "Firefox": "firefox.exe", "Brave": "brave.exe"},
    "darwin": {"Safari": "/Applications/Safari.app", "Chrome": "/Applications/Google Chrome.app",
               "Edge": "/Applications/Microsoft Edge.app", "Firefox": "/Applications/Firefox.app",
               "Brave": "/Applications/Brave Browser.app", "Chromium": "/Applications/Chromium.app"},
    "linux": {"Chrome": "google-chrome", "Chromium": "chromium", "Chromium browser": "chromium-browser",
              "Edge": "microsoft-edge", "Firefox": "firefox", "Brave": "brave-browser"},
}


def browsers() -> list[dict]:
    """The browsers installed on this computer (name and where), found, never assumed. OCADE
    still works in its own dedicated profile; this tells the person and the planner what exists."""
    import shutil

    found = []
    platform = "linux" if sys.platform.startswith("linux") else sys.platform
    for name, where in _BROWSERS.get(platform, {}).items():
        if platform == "win32":
            path = app_path(where)
        elif platform == "darwin":
            path = where if Path(where).is_dir() else None
        else:
            path = shutil.which(where)
        if path and (platform == "darwin" or Path(path).is_file()):
            found.append({"name": name, "path": str(path)[:300], "profiles": _profiles(name, platform)})
    return found


def _profiles(name: str, platform: str) -> list[str]:
    """The browser's profile folder names ("Default", "Profile 1"; Firefox's profile names),
    never a profile's contents or the display name the person gave it. OCADE never opens
    these: it works in its own profile, and the person's sign-ins stay theirs."""
    import configparser
    import json

    home = Path.home()
    local, roaming = Path(os.environ.get("LOCALAPPDATA", home)), Path(os.environ.get("APPDATA", home))
    support = home / "Library" / "Application Support"
    folders = {
        "Chrome": {"win32": local / "Google/Chrome/User Data", "darwin": support / "Google/Chrome",
                   "linux": home / ".config/google-chrome"},
        "Edge": {"win32": local / "Microsoft/Edge/User Data", "darwin": support / "Microsoft Edge",
                 "linux": home / ".config/microsoft-edge"},
        "Brave": {"win32": local / "BraveSoftware/Brave-Browser/User Data",
                  "darwin": support / "BraveSoftware/Brave-Browser", "linux": home / ".config/BraveSoftware/Brave-Browser"},
        "Chromium": {"darwin": support / "Chromium", "linux": home / ".config/chromium"},
        "Chromium browser": {"linux": home / ".config/chromium"},
        "Firefox": {"win32": roaming / "Mozilla/Firefox", "darwin": support / "Firefox", "linux": home / ".mozilla/firefox"},
    }
    folder = folders.get(name, {}).get(platform)
    try:
        if name == "Firefox":
            ini = configparser.ConfigParser(interpolation=None)
            ini.read(folder / "profiles.ini", encoding="utf-8")
            return [ini[s]["Name"][:80] for s in ini.sections() if s.startswith("Profile") and "Name" in ini[s]][:20]
        state = json.loads((folder / "Local State").read_text(encoding="utf-8"))
        return [str(key)[:80] for key in state["profile"]["info_cache"]][:20]
    except Exception:  # not used yet, unreadable, or a browser with one implicit profile (Safari)
        return []


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


# Reviewed vendor artifacts. The runtime trusts these pinned bytes, never a URL or shell
# command supplied by a model. Node's release checksums are published at
# https://nodejs.org/en/blog/release/v22.23.2.
_NODE_VERSION = "22.23.2"
_NODE_RELEASE = "https://nodejs.org/dist/v22.23.2/"
_NODE_ARTIFACTS = {
    ("Windows", "x64"): ("win-x64/node.exe", "0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4"),
    ("Windows", "arm64"): ("win-arm64/node.exe", "97cce5301a815d2dce07ac5bfd1e6039eae88185ec1d10ae4f8cb712f1732878"),
    ("Darwin", "x64"): ("node-v22.23.2-darwin-x64.tar.gz", "58e99022c2ff89395576cc7fd4d98cea24bb68081475d5f88b801ee8729fb026"),
    ("Darwin", "arm64"): ("node-v22.23.2-darwin-arm64.tar.gz", "61130f394c1630d211dd50aecc4353d379480f36d3ac913cd85dbba1aed585c6"),
}
DEPENDENCY_PROGRAMS = {
    "python": ("python3", "python"),
    "node": ("node",),
    "java": ("java",),
    "dotnet": ("dotnet",),
    "ffmpeg": ("ffmpeg", "ffprobe"),
    "libreoffice": ("soffice", "libreoffice"),
    "browser": (),
}
DEPENDENCY_BYTES = 100 * 1024 * 1024


def dependency_platform() -> tuple[str, str]:
    import platform

    system = platform.system()
    # The native OS architecture may differ from a translated companion process.
    machine = os.environ.get("PROCESSOR_ARCHITEW6432", platform.machine()).lower()
    arch = {"amd64": "x64", "x86_64": "x64", "aarch64": "arm64"}.get(machine, machine)
    if system == "Darwin" and arch == "x64":
        import subprocess

        try:
            probe = subprocess.run(["/usr/sbin/sysctl", "-in", "hw.optional.arm64"],
                                   capture_output=True, timeout=3)
        except (OSError, subprocess.TimeoutExpired):
            return system, "unknown"
        if probe.stdout.strip() == b"1":
            arch = "arm64"
    return system, arch


def dependency_proposal(name: str) -> dict | None:
    system, arch = dependency_platform()
    artifact = _NODE_ARTIFACTS.get((system, arch)) if name == "node" else None
    if artifact is None:
        return None
    filename, digest = artifact
    exe = "node.exe" if system == "Windows" else "node"
    return {
        "name": name, "version": _NODE_VERSION, "platform": system, "architecture": arch,
        "source": _NODE_RELEASE + filename, "sha256": digest,
        "licence": "MIT and third-party notices (Node.js v22.23.2 LICENSE)",
        "scope": "current_user", "privileges": "none",
        "destination": f"dependencies/{name}/{_NODE_VERSION}/{arch}/{exe}",
    }


def dependency_paths(home: str, proposal: dict) -> tuple[Path, Path]:
    from .sandbox import Refused, resolve

    if not home:
        raise Refused("dependency_directory_unavailable")
    executable = resolve(home, proposal["destination"])
    expected = Path(home).resolve() / proposal["destination"]
    if executable != expected:
        raise Refused("dependency_directory_unavailable")
    return executable, executable.with_name("vendor.tar.gz") if proposal["platform"] == "Darwin" else executable


def _node_archive_member(archive, architecture: str):
    member = archive.getmember(f"node-v{_NODE_VERSION}-darwin-{architecture}/bin/node")
    if not member.isfile() or not 1 <= member.size <= DEPENDENCY_BYTES:
        raise ValueError("invalid executable member")
    return member


def dependency_integrity(executable: Path, artifact: Path, proposal: dict) -> bool:
    """Independently bind installed bytes to the trusted artifact before any execution."""
    import hashlib
    import tarfile

    from .sandbox import sha256

    try:
        if executable.is_symlink() or artifact.is_symlink():
            return False
        if not executable.is_file() or not artifact.is_file():
            return False
        if not (1 <= executable.stat().st_size <= DEPENDENCY_BYTES
                and 1 <= artifact.stat().st_size <= DEPENDENCY_BYTES):
            return False
        if sha256(artifact) != proposal["sha256"]:
            return False
        if artifact == executable:
            return True
        with tarfile.open(artifact, "r:gz") as archive:
            member = _node_archive_member(archive, proposal["architecture"])
            with archive.extractfile(member) as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
        return digest == sha256(executable)
    except (OSError, ValueError, KeyError, tarfile.TarError):
        return False


def executable_version(path: str) -> str | None:
    """Read native version metadata where it exists without executing a PATH candidate."""
    import plistlib

    if sys.platform == "win32":
        import win32api  # type: ignore[import-not-found]

        try:
            info = win32api.GetFileVersionInfo(path, "\\")
            ms, ls = info["FileVersionMS"], info["FileVersionLS"]
            return f"{ms >> 16}.{ms & 0xFFFF}.{ls >> 16}.{ls & 0xFFFF}"
        except Exception:
            return None
    for parent in Path(path).parents:
        if parent.suffix == ".app":
            try:
                info = plistlib.loads((parent / "Contents/Info.plist").read_bytes())
                version = info.get("CFBundleShortVersionString")
                return version[:80] if isinstance(version, str) else None
            except (OSError, ValueError, plistlib.InvalidFileException):
                return None
    return None


def dependency_candidates(name: str) -> list[dict]:
    import shutil

    if name == "browser":
        return [{"path": item["path"], "version": executable_version(item["path"])}
                for item in browsers()]
    if name == "libreoffice":
        from .engine import _soffice

        path = _soffice()
        return [{"path": path, "version": executable_version(path)}] if path else []
    found = {}
    for program in DEPENDENCY_PROGRAMS[name]:
        path = app_path(program + ".exe") or shutil.which(program)
        if path and Path(path).is_file():
            path = str(Path(path).resolve())
            found[path] = {"path": path, "version": executable_version(path)}
    return list(found.values())


def verify_dependency(home: str, proposal: dict) -> dict:
    """Observe the actual installed executable, startup, reported version and native arch."""
    import subprocess

    from .sandbox import Refused

    if dependency_proposal(proposal.get("name")) != proposal:
        raise Refused("dependency_proposal_changed")
    executable, artifact = dependency_paths(home, proposal)
    if not dependency_integrity(executable, artifact, proposal):
        raise Refused("dependency_integrity_failed")
    try:
        observed = subprocess.run(
            [str(executable), "-p", "JSON.stringify([process.versions.node,process.arch])"],
            cwd=executable.parent, stdin=subprocess.DEVNULL, capture_output=True, timeout=12,
            env={key: val for key, val in os.environ.items() if key.upper() not in {"NODE_OPTIONS", "NODE_PATH"}},
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
    except subprocess.TimeoutExpired:
        raise Refused("dependency_startup_timeout") from None
    except OSError as error:
        code = {
            5: "dependency_permission_denied", 126: "dependency_missing_library",
            193: "dependency_architecture_mismatch", 740: "dependency_admin_required",
            1260: "dependency_security_policy",
        }.get(getattr(error, "winerror", None), "dependency_startup_failed")
        raise Refused(code) from None
    import json

    try:
        version, arch = json.loads(observed.stdout)
    except (ValueError, TypeError):
        raise Refused("dependency_startup_failed") from None
    if observed.returncode != 0 or version != proposal["version"] or arch != proposal["architecture"]:
        raise Refused("dependency_version_or_architecture_mismatch")
    return {"verified": True, "name": proposal["name"], "version": version, "architecture": arch,
            "destination": proposal["destination"]}


def managed_dependency_path(home: str) -> str | None:
    """Give subsequent confirmed commands the verified portable runtime without editing PATH globally."""
    proposal = dependency_proposal("node")
    if not proposal or not home:
        return None
    from .sandbox import Refused

    try:
        executable, artifact = dependency_paths(home, proposal)
    except Refused:
        return None
    return str(executable.parent) if dependency_integrity(executable, artifact, proposal) else None


def command_environment(home: str) -> dict[str, str]:
    environment = dict(os.environ)
    managed = managed_dependency_path(home)
    if managed:
        environment["PATH"] = managed + os.pathsep + environment.get("PATH", "")
    return environment
