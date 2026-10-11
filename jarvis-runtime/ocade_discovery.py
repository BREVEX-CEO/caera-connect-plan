"""
What this computer offers for a task, found on the computer itself (owner addendum 2026-10-02).

- `app_info`: an installed app's program, version and the official ways to drive
  it that Windows has registered for it — COM automation servers, the file types
  and link schemes it opens, and scripting/SDK folders shipped beside it — plus
  the recipes learned here for this app and version. The model reasons from
  this and the app's current documentation; nothing app-specific lives here.
- `drives`: the drives connected now (an external drive appears when plugged in).
- `locate`: files by name across the person's own folders and connected drives:
  names, sizes and dates only — never contents.
- recipes: what worked, kept on this computer only, sanitized: no coordinates,
  no secrets, no file contents. A new major version of the app hides old ones.
"""
from __future__ import annotations

import hashlib
import json
import os
import platform
import re
import string
import threading
import time
from pathlib import Path

SYSTEM = platform.system()
HOME = Path(os.environ.get("OCADE_JARVIS_HOME", Path.home() / ".ocade_jarvis"))
SURFACE_WORDS = re.compile(r"(^|[^a-z])(scripts?|scripting|api|sdk|automation|developer|plugins?|python"
                           r"|cli|macros?|extensions?)([^a-z]|$)", re.I)
_COM: dict = {}  # exe name -> ProgIDs, read once per agent run (the registry walk takes ~1 s)


# -- an app ---------------------------------------------------------------------------

def _shortcut_target(link: str) -> str | None:
    try:
        import comtypes.client
        shell = comtypes.client.CreateObject("WScript.Shell", dynamic=True)
        target = shell.CreateShortcut(link).TargetPath
        return target if target and target.lower().endswith(".exe") else None
    except Exception:
        return None


def _version(exe: str) -> str | None:
    if SYSTEM != "Windows":
        return None
    import ctypes
    from ctypes import wintypes
    api = ctypes.windll.version
    size = api.GetFileVersionInfoSizeW(exe, None)
    if not size:
        return None
    data = ctypes.create_string_buffer(size)
    if not api.GetFileVersionInfoW(exe, 0, size, data):
        return None
    pointer, length = ctypes.c_void_p(), wintypes.UINT()
    if not api.VerQueryValueW(data, "\\", ctypes.byref(pointer), ctypes.byref(length)):
        return None
    fixed = ctypes.cast(pointer, ctypes.POINTER(ctypes.c_uint32 * 13)).contents
    ms, ls = fixed[4], fixed[5]
    return f"{ms >> 16}.{ms & 0xFFFF}.{ls >> 16}.{ls & 0xFFFF}"


def _com_servers(exe_name: str) -> list[str]:
    """ProgIDs whose automation server is this program (HKCR\\CLSID\\*\\LocalServer32)."""
    if SYSTEM != "Windows":
        return []
    if not _COM:
        import winreg
        found: dict[str, set] = {}
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, "CLSID") as clsids:
            for i in range(winreg.QueryInfoKey(clsids)[0]):
                try:
                    clsid = winreg.EnumKey(clsids, i)
                    with winreg.OpenKey(clsids, clsid + r"\LocalServer32") as server:
                        command = str(winreg.QueryValue(server, None) or "")
                    with winreg.OpenKey(clsids, clsid + r"\ProgID") as progid:
                        name = str(winreg.QueryValue(progid, None) or "")
                except OSError:
                    continue
                program = re.search(r"([^\\/\"]+\.exe)", command, re.I)
                if program and name:
                    found.setdefault(program.group(1).lower(), set()).add(name)
        _COM.update({k: sorted(v)[:20] for k, v in found.items()})
        _COM.setdefault("", [])
    return _COM.get(exe_name.lower(), [])


def _opens(exe_name: str) -> tuple[list[str], list[str]]:
    """File types and link schemes whose open command is this program."""
    if SYSTEM != "Windows":
        return [], []
    import winreg
    types, schemes = [], []
    with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, "") as root:
        for i in range(winreg.QueryInfoKey(root)[0]):
            try:
                key = winreg.EnumKey(root, i)
            except OSError:
                continue
            try:
                if key.startswith("."):
                    with winreg.OpenKey(root, key) as ext:
                        prog = str(winreg.QueryValue(ext, None) or "")
                    if not prog:
                        continue
                    with winreg.OpenKey(root, prog + r"\shell\open\command") as command:
                        if exe_name.lower() in str(winreg.QueryValue(command, None) or "").lower():
                            types.append(key)
                elif len(schemes) < 10 and re.fullmatch(r"[a-z][a-z0-9+.-]{1,30}", key):
                    with winreg.OpenKey(root, key) as scheme:
                        winreg.QueryValueEx(scheme, "URL Protocol")
                        with winreg.OpenKey(scheme, r"shell\open\command") as command:
                            if exe_name.lower() in str(winreg.QueryValue(command, None) or "").lower():
                                schemes.append(key + ":")
            except OSError:
                continue
            if len(types) >= 40:
                break
    return types, schemes


def _surfaces(program_dir: Path, program: str = "") -> list[str]:
    """Folders whose names say scripting, SDK, API or plugins: beside the program, and where
    the same vendor keeps shared data (ProgramData, AppData) under the same relative path.
    Windows' own folders hold nothing of a program's, and a folder many programs share (Office's)
    counts only folders that name this one: otherwise Magnify was "scriptable" through printer
    scripts and Skype for Business through Excel's Python folder."""
    windows = Path(os.environ.get("SystemRoot", r"C:\Windows"))
    if program_dir == windows or windows in program_dir.parents:
        return []
    shared = len(list(program_dir.glob("*.exe"))) > 10
    stem = Path(program).stem.lower()
    places = [program_dir]
    for installed in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)")):
        try:
            relative = program_dir.relative_to(installed) if installed else None
        except ValueError:
            continue
        for data in ("ProgramData", "APPDATA", "LOCALAPPDATA"):
            if relative and os.environ.get(data):
                places.append(Path(os.environ[data], relative.parts[0], *relative.parts[1:2]))
    out: list[str] = []
    for place in places:
        if not place.is_dir():
            continue
        for folder, dirs, _files in os.walk(place):
            depth = len(Path(folder).relative_to(place).parts)
            for name in dirs:
                # The name filter is for the shared program folder only: the vendor's own data
                # folder is the product's (Resolve's SDK lives there; its program folder has many helpers).
                if SURFACE_WORDS.search(name) and (not (shared and place == program_dir)
                                                   or (stem and stem in name.lower())):
                    out.append(str(Path(folder, name)))
            dirs[:] = [] if depth >= 2 else [d for d in dirs if not SURFACE_WORDS.search(d)]
            if len(out) >= 10:
                return out
    return out


def _readme(folder: str) -> dict:
    """The start of an SDK folder's own READMEs (and where each is): how to connect, read where
    JARVIS cannot browse (the folder is outside the work folder). Without them, Resolve was driven
    by hand, step by step, instead of through its scripting API."""
    found = sorted(Path(folder).glob("README*")) + sorted(Path(folder).glob("*/README*"))
    found.sort(key=lambda p: not re.search(r"script|api|automat", p.parent.name, re.I))  # stable
    readmes = []
    for n, child in enumerate(found[:3]):
        try:  # the most likely one in full enough to reach its connection example
            text = child.read_text(encoding="utf-8", errors="replace")[:6000 if n == 0 else 1500]
            readmes.append({"file": str(child), "start": text})
        except OSError:
            continue
    return {"readmes": readmes} if readmes else {}


def _names(folder: str) -> list[str]:
    try:
        return sorted(child.name for child in Path(folder).iterdir())[:12]
    except OSError:
        return []


def _known_folder(guid: str) -> str | None:
    import ctypes
    from ctypes import wintypes

    class GUID(ctypes.Structure):
        _fields_ = [("a", wintypes.DWORD), ("b", wintypes.WORD), ("c", wintypes.WORD), ("d", ctypes.c_ubyte * 8)]
    folder = GUID()
    if ctypes.windll.ole32.CLSIDFromString(f"{{{guid}}}", ctypes.byref(folder)):
        return None
    path = ctypes.c_wchar_p()
    if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(folder), 0, None, ctypes.byref(path)):
        return None
    try:
        return path.value
    finally:
        ctypes.windll.ole32.CoTaskMemFree(path)


def _package_program(aumid: str) -> str | None:
    """A Store app's program, from its package manifest."""
    import subprocess
    family = aumid.split("!")[0]
    if not re.fullmatch(r"[\w.-]+_[a-z0-9]{13}", family):
        return None  # only a package family name ever reaches PowerShell
    try:
        location = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command",
             f"(Get-AppxPackage | Where-Object PackageFamilyName -eq '{family}' | Select-Object -First 1).InstallLocation"],
            capture_output=True, text=True, timeout=20, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        ).stdout.strip()
        manifest = (Path(location) / "AppxManifest.xml").read_text(encoding="utf-8", errors="replace")
    except (OSError, subprocess.SubprocessError):
        return None
    # A package can hold several apps (People, Files, Calendar): the one launched is the
    # Application whose Id follows the "!", never simply the first program listed.
    app_id = aumid.split("!", 1)[1] if "!" in aumid else ""
    for tag in re.findall(r"<Application\b[^>]*>", manifest, re.I):
        if re.search(rf'\bId="{re.escape(app_id)}"', tag):
            found = re.search(r'\bExecutable="([^"]+\.exe)"', tag, re.I)
            return str(Path(location, found.group(1))) if found else None
    return None


def _program(app: dict) -> str | None:
    """Where an app's program is: from its Start entry, its shortcut, or its package."""
    launch = str(app.get("launch", ""))
    if launch.lower().endswith(".lnk"):
        return _shortcut_target(launch)
    if launch.lower().endswith(".exe") and Path(launch).is_file():
        return launch
    folder = re.match(r"\{([0-9A-Fa-f-]{36})\}\\(.+\.exe)$", launch, re.I)
    if folder and (base := _known_folder(folder.group(1))) and Path(base, folder.group(2)).is_file():
        return str(Path(base, folder.group(2)))
    for root in (Path(os.environ.get("ProgramData", "C:/ProgramData")), Path(os.environ.get("APPDATA", ""))):
        for link in (root / "Microsoft/Windows/Start Menu/Programs").rglob(f"{glob_escape(app['name'])}.lnk"):
            if target := _shortcut_target(str(link)):
                return target
    if re.fullmatch(r"[\w.-]+_[a-z0-9]{13}![\w.-]+", launch):
        return _package_program(launch)
    return None


def glob_escape(name: str) -> str:
    return re.sub(r"([*?\[])", r"[\1]", name)


def _cached_capabilities() -> dict:
    try:
        return json.loads((HOME / "capabilities.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def app_info(app: dict, cancel: threading.Event | None = None) -> dict:
    """`app` is one entry of ocade_computer.installed_apps().

    What an app offers is found once per program build and kept on this computer
    (PLAN.md section F): the registry and folder scans take one to two seconds,
    and they change only when the program does. Keyed by program, version and
    file time, so an update or reinstall is rediscovered rather than replayed."""
    exe = _program(app) if SYSTEM == "Windows" else None
    info: dict = {"name": app["name"], "storeApp": "!" in str(app.get("launch", ""))}
    if exe and Path(exe).is_file():
        name = Path(exe).name
        version = _version(exe)
        info.update(program=exe, version=version)
        key = f"{exe.lower()}|{version}|{int(Path(exe).stat().st_mtime)}"
        cache = _cached_capabilities()
        if key in cache:
            info.update(cache[key])
        else:
            found: dict = {}
            if not (cancel and cancel.is_set()):
                found["automation"] = _com_servers(name)
            if not (cancel and cancel.is_set()):
                found["opens"], found["links"] = _opens(name)
            found["scripting"] = [{"folder": folder, "contains": _names(folder), **_readme(folder)}
                                  for folder in _surfaces(Path(exe).parent, exe)]
            info.update(found)
            if not (cancel and cancel.is_set()):  # only a complete look is kept
                cache[key] = found
                try:
                    HOME.mkdir(parents=True, exist_ok=True)
                    tmp = HOME / "capabilities.json.tmp"
                    tmp.write_text(json.dumps(dict(list(cache.items())[-200:])), encoding="utf-8")
                    os.replace(tmp, HOME / "capabilities.json")
                except OSError:
                    pass  # a cache that cannot be written is only slower next time
    if info.get("automation") or info.get("scripting"):
        # Found from registry entries and folder names, not tried: a surface is a lead, not a
        # promise that it works for this task (audit-2 C09).
        info["evidence"] = ("found on this computer, not yet tried: make one harmless read "
                            "through it before relying on it")
    info["recipes"], stale = recipes_for(app["name"], info.get("version"))
    if stale:
        info["olderRecipes"] = stale  # written for another major version: rediscover, never replay
    return info


def version_of(app: dict) -> str | None:
    exe = _program(app) if SYSTEM == "Windows" else None
    return _version(exe) if exe else None


# -- drives and files ---------------------------------------------------------------

def drives() -> list[dict]:
    out = []
    if SYSTEM == "Windows":
        import ctypes
        kinds = {2: "removable", 3: "fixed", 4: "network", 5: "disc", 6: "memory"}
        mask = ctypes.windll.kernel32.GetLogicalDrives()
        for i, letter in enumerate(string.ascii_uppercase):
            if not mask & (1 << i):
                continue
            root = f"{letter}:\\"
            kind = kinds.get(ctypes.windll.kernel32.GetDriveTypeW(root), "other")
            label = ctypes.create_unicode_buffer(261)
            ctypes.windll.kernel32.GetVolumeInformationW(root, label, 261, None, None, None, None, 0)
            out.append({"drive": root, "kind": kind, "label": label.value or None, **_space(root)})
    else:
        import psutil
        for part in psutil.disk_partitions(all=False):
            out.append({"drive": part.mountpoint, "kind": "removable" if "removable" in part.opts else "fixed",
                        "label": None, **_space(part.mountpoint)})
    return out


def _space(root: str) -> dict:
    import shutil
    try:
        usage = shutil.disk_usage(root)
        return {"freeGB": round(usage.free / 2**30, 1), "sizeGB": round(usage.total / 2**30, 1)}
    except OSError:
        return {}


def _roots() -> list[Path]:
    home = Path.home()
    mine = [home / n for n in ("Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music")]
    mine += [p for p in home.glob("OneDrive*") if p.is_dir()]
    mine += [Path(d["drive"]) for d in drives() if d["kind"] in ("removable", "network")]
    return [p for p in mine if p.is_dir()]


def locate(name: str, extension: str, cancel: threading.Event, limit: int = 50) -> list[dict]:
    """Names, sizes and dates of matching files; never contents. Bounded and ended by STOP."""
    name, extension = name.lower(), extension.lower().lstrip(".")
    found, seen, started = [], 0, time.monotonic()
    for root in _roots():
        for folder, dirs, files in os.walk(root):
            dirs[:] = [d for d in dirs if not d.startswith((".", "$")) and d not in ("node_modules", "AppData")]
            seen += 1
            if cancel.is_set() or seen > 20_000 or time.monotonic() - started > 20:
                return found
            for file in files:
                low = file.lower()
                if (name and name not in low) or (extension and not low.endswith("." + extension)):
                    continue
                path = Path(folder, file)
                try:
                    stat = path.stat()
                except OSError:
                    continue
                found.append({"path": str(path), "size": stat.st_size,
                              "modified": time.strftime("%Y-%m-%d %H:%M", time.localtime(stat.st_mtime))})
                if len(found) >= limit:
                    return found
    return found


# -- recipes: what worked here, sanitized --------------------------------------------

_SECRETISH = re.compile(
    r"\bpass(word|wd|phrase|code)\b|\btokens?\b|\bsecrets?\b|api[_ -]?key|\bcookies?\b|\botp\b|\bbearer\b|\b\d{6,}\b|[A-Za-z0-9+/=_-]{32,}|@[\w-]+\.\w"
    r"|\(\s*\d{2,5}\s*,\s*\d{2,5}\s*\)|\b[xy]\s*[=:]\s*\d{2,5}\b|[A-Za-z]:[\\/]+Users[\\/]|/(Users|home)/",
    re.I)


def _major(version: str | None) -> str:
    return (version or "").split(".")[0] or "any"


def _store() -> dict:
    try:
        return json.loads((HOME / "recipes.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


QUARANTINE_AFTER = 2  # failures in a row before a recipe is set aside


def recipes_for(app: str, version: str | None) -> tuple[list[dict], int]:
    mine = [r for r in _store().values() if r.get("app", "").lower() == app.lower()]
    # Only a recipe kept for this very version line: one kept when the version was unknown
    # is not trusted for a known one (audit E08). Most recently kept first.
    current = [r for r in mine if r.get("major") == _major(version)
               and r.get("failures", 0) < QUARANTINE_AFTER]
    current.sort(key=lambda r: r.get("updated", ""), reverse=True)
    return current[:3], len(mine) - len(current)


def save_recipe(recipe: dict, version: str | None) -> dict:
    fields = {"app": str(recipe.get("app", ""))[:80], "route": str(recipe.get("route", ""))[:200],
              "steps": [str(s)[:200] for s in (recipe.get("steps") or [])][:8],
              "verify": str(recipe.get("verify", ""))[:200], "recovery": str(recipe.get("recovery", ""))[:200]}
    if not fields["app"] or not fields["route"]:
        return {"status": "failed", "summary": "A recipe needs the app and the route that worked"}
    inputs = [{"name": str(i.get("name", "")), "kind": str(i.get("kind", ""))}
              for i in (recipe.get("inputs") or [])[:8] if isinstance(i, dict)]
    if any(not re.fullmatch(r"[a-z][a-z0-9_]{0,30}", i["name"])
           or i["kind"] not in ("file", "folder", "text", "number", "date") for i in inputs):
        return {"status": "failed", "summary": "Recipe inputs are a lowercase name and a kind"}
    named = {i["name"] for i in inputs}
    used = set(re.findall(r"\{([a-z][a-z0-9_]{0,30})\}", " ".join([fields["route"], *fields["steps"]])))
    if used - named:
        return {"status": "failed", "summary": f"The steps use inputs never declared: {', '.join(sorted(used - named))}"}
    if any(_SECRETISH.search(value) for value in [*fields.values(), *fields["steps"]]
           if isinstance(value, str)):
        return {"status": "blocked", "summary": "Recipes keep only how the app is driven: no coordinates, "
                                                "personal paths, addresses, codes or secrets"}
    store = _store()
    # One recipe per way of doing a thing: another task's recipe for the same app is kept beside
    # it, never replaced by it (audit E08).
    route = hashlib.sha256(fields["route"].lower().encode()).hexdigest()[:12]
    key = f"{fields['app'].lower()}@{_major(version)}#{route}"
    if recipe.get("worked") is False:
        if key not in store:
            return {"status": "done", "summary": f"No recipe for {fields['app']} was remembered here"}
        store[key]["failures"] = store[key].get("failures", 0) + 1
        set_aside = store[key]["failures"] >= QUARANTINE_AFTER
    else:
        store[key] = {**fields, "inputs": inputs, "major": _major(version), "version": version, "failures": 0,
                      "updated": time.strftime("%Y-%m-%d"), "uses": store.get(key, {}).get("uses", 0) + 1}
    HOME.mkdir(parents=True, exist_ok=True)
    tmp = HOME / "recipes.json.tmp"
    tmp.write_text(json.dumps(dict(list(store.items())[-200:]), indent=1), encoding="utf-8")
    os.replace(tmp, HOME / "recipes.json")
    if recipe.get("worked") is False:
        return {"status": "done", "summary": f"Noted that the {fields['app']} recipe failed"
                + ("; it is set aside until a new way works" if set_aside else "")}
    return {"status": "done", "summary": f"Remembered how {fields['app']} was driven, on this computer only"}
