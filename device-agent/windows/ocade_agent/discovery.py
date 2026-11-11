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
        found.extend(("browser", "gltf"))
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
    apps = [{"name": app["name"], "exe": exe} for exe, app in _windows_apps().items() if len(exe) <= 80]
    return sorted(apps, key=lambda app: app["name"].lower())[:limit]


_APPS_FRESH_SECONDS = 30
_apps_seen: dict = {"at": 0.0, "apps": {}}


def _windows_apps() -> dict[str, dict]:
    """exe -> {name, path}: what a person can launch here, and from where. A Start Menu
    shortcut's own target is where its app starts; App Paths and packaged apps have no path
    here (Windows resolves those itself). Remembered briefly: every window identity asks."""
    if sys.platform != "win32":
        return {}
    import time
    import winreg

    if time.monotonic() - _apps_seen["at"] < _APPS_FRESH_SECONDS and _apps_seen["apps"]:
        return _apps_seen["apps"]
    import pythoncom  # type: ignore[import-not-found]
    import win32com.client  # type: ignore[import-not-found]

    pythoncom.CoInitialize()  # called from worker threads; COM is per thread
    try:
        found: dict[str, dict] = {}
        shell = win32com.client.Dispatch("WScript.Shell")
        menus = [Path(os.environ.get("APPDATA", "")), Path(os.environ.get("PROGRAMDATA", ""))]
        for root in (m / "Microsoft/Windows/Start Menu/Programs" for m in menus):
            for link in root.rglob("*.lnk") if root.is_dir() else []:
                try:
                    target = shell.CreateShortCut(str(link)).TargetPath
                except Exception:
                    continue
                if target.lower().endswith(".exe") and "uninstall" not in link.stem.lower():
                    found.setdefault(Path(target).name.lower(), {"name": link.stem[:120], "path": target})
        for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
            try:
                key = winreg.OpenKey(hive, r"Software\Microsoft\Windows\CurrentVersion\App Paths")
            except OSError:
                continue
            with key:
                for index in range(winreg.QueryInfoKey(key)[0]):
                    name = winreg.EnumKey(key, index)
                    if name.lower().endswith(".exe"):
                        found.setdefault(name.lower(), {"name": Path(name).stem[:120], "path": None})
        app_shell = win32com.client.Dispatch("Shell.Application")
        for key, name, _item in _packaged_apps(app_shell):
            found.setdefault(key, {"name": name, "path": None})
    finally:
        pythoncom.CoUninitialize()
    _apps_seen.update(at=time.monotonic(), apps=found)
    return found


def app_key(image: str, ancestors, installed) -> str:
    """The installed app a window's process belongs to, as `apps.list` and an `app:` permission
    name it. Many apps start through a small launcher that stays their parent while another
    program in the same folder owns the windows; the person knows, starts and allows the
    launcher. So: the process's own executable when that is an installed app, else its nearest
    still-running ancestor that is one and lives in the same folder, else its own executable.
    `ancestors` are executable paths, nearest first. By folder and ancestry only: no app names."""
    import ntpath

    name = ntpath.basename(image).lower()
    if name in installed:
        return name
    folder = ntpath.dirname(image).lower()
    for parent in ancestors:
        candidate = ntpath.basename(parent).lower()
        if candidate in installed and ntpath.dirname(parent).lower() == folder:
            return candidate
    return name


def _ancestor_images(pid: int):
    """Executable paths of a process's running ancestors, nearest first (unreadable ones skipped)."""
    import psutil

    try:
        parents = psutil.Process(pid).parents()
    except psutil.Error:
        return
    for parent in parents:
        try:
            yield parent.exe()
        except (psutil.Error, OSError):
            continue


def _packaged_key(aumid: str) -> str:
    import hashlib

    return "pkg-" + hashlib.sha256(aumid.casefold().encode("utf8")).hexdigest()[:32]


def _packaged_apps(shell):
    folder = shell.NameSpace("shell:AppsFolder")
    if folder is None:
        return
    for item in folder.Items():
        try:
            aumid = item.ExtendedProperty("System.AppUserModel.ID")
            if isinstance(aumid, str) and "!" in aumid and len(aumid) <= 256:
                yield _packaged_key(aumid), str(item.Name)[:120], item
        except Exception:
            continue


def launch_packaged(exe: str, before_launch) -> bool:
    """Resolve a fresh Windows shell item from its approved opaque app identity."""
    if sys.platform != "win32":
        return False
    import pythoncom  # type: ignore[import-not-found]
    import win32com.client  # type: ignore[import-not-found]

    pythoncom.CoInitialize()
    try:
        shell = win32com.client.Dispatch("Shell.Application")
        for key, _name, item in _packaged_apps(shell):
            if key == exe:
                before_launch()
                item.InvokeVerb()
                return True
        return False
    finally:
        pythoncom.CoUninitialize()


def _process_aumid(handle) -> str | None:
    from ctypes.wintypes import HANDLE

    query = ctypes.windll.kernel32.GetApplicationUserModelId
    length = ctypes.c_uint32(0)
    process = HANDLE(int(handle))
    if query(process, ctypes.byref(length), None) != 122 or not 1 <= length.value <= 257:
        return None
    value = ctypes.create_unicode_buffer(length.value)
    return value.value if query(process, ctypes.byref(length), value) == 0 else None


def _window_aumid(hwnd: int, pid: int, handle, win32api, win32con, win32process, hosted: bool) -> str | None:
    """Packaged apps can be hosted in another process's top-level frame."""
    import win32gui  # type: ignore[import-not-found]

    direct = _process_aumid(handle)
    if direct or not hosted:
        return direct
    seen = set()

    def child(child_hwnd, _):
        if not win32gui.IsWindowVisible(child_hwnd):
            return True
        _, child_pid = win32process.GetWindowThreadProcessId(child_hwnd)
        if child_pid == pid or child_pid in seen:
            return True
        seen.add(child_pid)
        return len(seen) < 32

    try:
        win32gui.EnumChildWindows(hwnd, child, None)
    except win32gui.error:
        return None
    identities = set()
    for child_pid in seen:
        try:
            owned = win32api.OpenProcess(win32con.PROCESS_QUERY_LIMITED_INFORMATION, False, child_pid)
        except Exception:
            continue
        try:
            identity = _process_aumid(owned)
            if identity:
                identities.add(identity)
        finally:
            win32api.CloseHandle(owned)
    if len(identities) > 1:
        raise ValueError("ambiguous packaged window")
    return next(iter(identities), None)


def app_path(exe: str) -> str | None:
    """The program an installed app starts, by the name `apps.list` gives it: on Windows its
    Start Menu shortcut's target, App Paths, then PATH; on macOS its bundle's executable."""
    if sys.platform == "darwin":
        from .mac_worker import installed_apps as mac_apps

        return next((a["program"] for a in mac_apps() if a["exe"] == exe.lower()), None)
    if sys.platform != "win32":
        return None
    import shutil
    import winreg

    # An app found only through its Start Menu shortcut starts from that shortcut's target:
    # most installers register no App Paths key and add nothing to PATH.
    shortcut = (_windows_apps().get(exe) or {}).get("path")
    if shortcut and Path(shortcut).is_file():
        return shortcut
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
    """The browser's profile folder names or Firefox configuration section IDs,
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
        if folder is None:
            return []
        if name == "Firefox":
            ini = configparser.ConfigParser(interpolation=None)
            with (folder / "profiles.ini").open(encoding="utf-8") as config:
                content = config.read(1_000_001)
            if len(content) > 1_000_000:
                return []
            ini.read_string(content)
            return [section[:80] for section in ini.sections()
                    if section.startswith("Profile") and "Path" in ini[section]][:20]
        with (folder / "Local State").open(encoding="utf-8") as config:
            content = config.read(4_000_001)
        if len(content) > 4_000_000:
            return []
        state = json.loads(content)
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
        if not win32gui.IsWindowVisible(hwnd):
            return True
        # An untitled window is listed only when another window owns it and it is not a tool
        # window: that is a dialog (a save-format question often has no title) and it must be
        # listed to be leased and answered. Other untitled windows are not app windows.
        if not win32gui.GetWindowText(hwnd) and (
            not win32gui.GetWindow(hwnd, win32con.GW_OWNER)
            or win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE) & win32con.WS_EX_TOOLWINDOW
        ):
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
            image = _process_image(handle)
            if not image:
                return None
            try:
                installed = _windows_apps()
            except Exception:
                installed = {}  # the app list is unreadable right now: the program's own name
            exe = app_key(image, _ancestor_images(pid), installed)
            system_root = os.environ.get("WINDIR")
            hosted = bool(system_root and Path(image) == Path(system_root) / "System32" / "ApplicationFrameHost.exe")
            aumid = _window_aumid(hwnd, pid, handle, win32api, win32con, win32process, hosted)
            if aumid:
                exe = _packaged_key(aumid)
            elif hosted:
                return None  # a frame alone does not identify an allowed application
            created = win32process.GetProcessTimes(handle)["CreationTime"]
        finally:
            win32api.CloseHandle(handle)
    except Exception:
        return None
    return {"exe": exe, "pid": pid, "hwnd": int(hwnd), "started": created.timestamp()}


def _process_image(handle) -> str | None:
    """The full path of a process's program, readable with limited query rights."""
    image = ctypes.create_unicode_buffer(1024)
    size = ctypes.c_ulong(len(image))
    if not ctypes.windll.kernel32.QueryFullProcessImageNameW(int(handle), 0, image, ctypes.byref(size)):
        return None
    return image.value


def window_folder(hwnd: int) -> str | None:
    """The folder of the program that owns a window (lowercase), or None when it cannot be read."""
    import ntpath

    import win32api  # type: ignore[import-not-found]
    import win32con  # type: ignore[import-not-found]
    import win32process  # type: ignore[import-not-found]

    try:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        handle = win32api.OpenProcess(win32con.PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        try:
            image = _process_image(handle)
        finally:
            win32api.CloseHandle(handle)
    except Exception:
        return None
    return ntpath.dirname(image).lower() if image else None


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
        import errno

        native = ctypes.CDLL(None, use_errno=True)
        value = ctypes.c_int()
        size = ctypes.c_size_t(ctypes.sizeof(value))
        if native.sysctlbyname(b"hw.optional.arm64", ctypes.byref(value), ctypes.byref(size), None, 0):
            if ctypes.get_errno() != errno.ENOENT:
                return system, "unknown"
        elif value.value == 1:
            arch = "arm64"
    return system, arch


def dependency_proposal(name: str) -> dict | None:
    import platform

    system, arch = dependency_platform()
    artifact = _NODE_ARTIFACTS.get((system, arch)) if name == "node" else None
    if artifact is None:
        return None
    # The pinned Node release supports Windows 10 and macOS 11 or newer.
    if system == "Windows" and sys.getwindowsversion().major < 10:
        return None
    if system == "Darwin":
        version = platform.mac_ver()[0].split(".", 1)[0]
        if not version.isdecimal() or int(version) < 11:
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


def _bundle_info(bundle: Path) -> dict:
    import plistlib

    try:
        with (bundle / "Contents/Info.plist").open("rb") as plist:
            data = plist.read(512_001)
        if len(data) <= 512_000:
            metadata = plistlib.loads(data)
            if isinstance(metadata, dict):
                return metadata
    except (OSError, ValueError, plistlib.InvalidFileException):
        pass
    return {}


def executable_version(path: str) -> str | None:
    """Read native version metadata where it exists without executing a PATH candidate."""
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
            version = _bundle_info(parent).get("CFBundleShortVersionString")
            return version[:80] if isinstance(version, str) else None
    return None


def executable_architectures(path: Path) -> list[str]:
    """Read bounded PE, ELF or Mach-O headers without launching a candidate."""
    import stat

    pe = {0x014C: "x86", 0x8664: "x64", 0xAA64: "arm64", 0xA641: "arm64ec", 0xA64E: "arm64x"}
    elf = {3: "x86", 40: "arm", 62: "x64", 183: "arm64"}
    mach = {7: "x86", 12: "arm", 0x01000007: "x64", 0x0100000C: "arm64"}
    thin = {b"\xfe\xed\xfa\xce": "big", b"\xce\xfa\xed\xfe": "little",
            b"\xfe\xed\xfa\xcf": "big", b"\xcf\xfa\xed\xfe": "little"}
    fat = {b"\xca\xfe\xba\xbe": ("big", 20), b"\xbe\xba\xfe\xca": ("little", 20),
           b"\xca\xfe\xba\xbf": ("big", 32), b"\xbf\xba\xfe\xca": ("little", 32)}
    try:
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NONBLOCK", 0)
        with os.fdopen(os.open(path, flags), "rb") as stream:
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                return []
            header = stream.read(64)
            signature = header[:4]
            if header.startswith(b"MZ") and len(header) == 64:
                offset = int.from_bytes(header[60:64], "little")
                if not 64 <= offset <= 16 * 1024 * 1024:
                    return []
                stream.seek(offset)
                record = stream.read(6)
                kind = pe.get(int.from_bytes(record[4:6], "little")) if record[:4] == b"PE\0\0" else None
                return [kind] if kind else []
            if signature == b"\x7fELF" and len(header) >= 20 and header[5] in (1, 2):
                kind = elf.get(int.from_bytes(header[18:20], "little" if header[5] == 1 else "big"))
                return [kind] if kind else []
            if signature in thin and len(header) >= 8:
                kind = mach.get(int.from_bytes(header[4:8], thin[signature]))
                return [kind] if kind else []
            if signature in fat and len(header) >= 8:
                order, width = fat[signature]
                count = int.from_bytes(header[4:8], order)
                if not 1 <= count <= 32:
                    return []
                stream.seek(8)
                table = stream.read(count * width)
                if len(table) != count * width:
                    return []
                kinds = (mach.get(int.from_bytes(table[offset:offset + 4], order))
                         for offset in range(0, len(table), width))
                return list(dict.fromkeys(kind for kind in kinds if kind))
    except OSError:
        pass
    return []


def _candidate(path: str) -> dict:
    import shutil
    import subprocess

    binary = Path(path)
    if binary.suffix == ".app" and binary.is_dir():
        name = _bundle_info(binary).get("CFBundleExecutable")
        if isinstance(name, str) and name and name not in (".", "..") and Path(name).name == name:
            binary = binary / "Contents/MacOS" / name
    architectures = executable_architectures(binary)
    _, native = dependency_platform()
    evidence = {"path": path, "version": executable_version(str(binary)), "architectures": architectures}
    if architectures:
        evidence["nativeArchitecture"] = native in architectures
    try:
        xattr = shutil.which("xattr", path=os.defpath) if sys.platform == "darwin" else None
        if xattr:
            marker = subprocess.run(
                [xattr, "-p", "com.apple.quarantine", path],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2,
            )
            if marker.returncode == 0:
                evidence["quarantineRecorded"] = True
        elif os.name == "nt":
            with Path(str(binary) + ":Zone.Identifier").open("rb") as zone:
                if b"ZoneId=" in zone.read(1024):
                    evidence["downloadZoneRecorded"] = True
    except (OSError, subprocess.TimeoutExpired):
        pass
    return evidence


def dependency_os_error(error: OSError, default: str) -> str:
    import errno

    code = {
        5: "dependency_permission_denied",
        126: "dependency_missing_library",
        127: "dependency_library_entry_point",
        193: "dependency_architecture_mismatch",
        216: "dependency_architecture_mismatch",
        225: "dependency_security_policy",
        226: "dependency_security_policy",
        740: "dependency_admin_required",
        1260: "dependency_security_policy",
        14001: "dependency_missing_library",
    }.get(getattr(error, "winerror", None))
    if code:
        return code
    return {
        errno.EACCES: "dependency_permission_denied",
        errno.EPERM: "dependency_permission_denied",
        errno.ENOEXEC: "dependency_invalid_native_image",
        errno.ENOSPC: "insufficient_storage",
    }.get(error.errno, default)


def _dependency_startup_failure(returncode: int, stderr: bytes) -> str:
    # Windows reports loader failures as either signed or unsigned NTSTATUS.
    native = {
        0xC0000022: "dependency_permission_denied",
        0xC000007B: "dependency_invalid_native_image",
        0xC0000135: "dependency_missing_library",
        0xC0000139: "dependency_library_entry_point",
        0xC0000142: "dependency_library_initialization_failed",
        0xC0000428: "dependency_security_policy",
    }.get(returncode & 0xFFFFFFFF)
    if native:
        return native
    detail = stderr[:4096].lower()
    if b"library not loaded" in detail or b"error while loading shared libraries" in detail:
        return "dependency_missing_library"
    if b"wrong architecture" in detail or b"bad cpu type" in detail:
        return "dependency_architecture_mismatch"
    if b"code signature" in detail and b"invalid" in detail:
        return "dependency_security_policy"
    return "dependency_startup_failed"


def dependency_candidates(name: str) -> list[dict]:
    import shutil

    if name == "browser":
        return [_candidate(item["path"]) for item in browsers()]
    if name == "libreoffice":
        from .engine import _soffice

        path = _soffice()
        return [_candidate(path)] if path else []
    found = {}
    for program in DEPENDENCY_PROGRAMS[name]:
        path = app_path(program + ".exe") or shutil.which(program)
        if path and Path(path).is_file():
            path = str(Path(path).resolve())
            found[path] = _candidate(path)
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
        raise Refused(dependency_os_error(error, "dependency_startup_failed")) from None
    if observed.returncode != 0:
        raise Refused(_dependency_startup_failure(observed.returncode, observed.stderr))
    import json

    try:
        version, arch = json.loads(observed.stdout)
    except (ValueError, TypeError):
        raise Refused("dependency_startup_failed") from None
    if version != proposal["version"] or arch != proposal["architecture"]:
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
