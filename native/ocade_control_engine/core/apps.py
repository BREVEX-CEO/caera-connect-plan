"""Finding the applications this machine actually has, and how to launch them.

WHAT WAS WRONG WITH THE OLD ANSWER
-----------------------------------
Two things existed and neither could open a program.

`ocade_host.system.installed_applications` reads the uninstall registry, which
carries publisher and version but NOT an executable. It can tell you Blender is
installed; it cannot tell you what to run.

`actions/open_app.py` fills the gap by pressing the Windows key, typing a name,
waiting 2.5 seconds and pressing Enter — Start-menu roulette. On a slow machine
the wait expires early and Enter lands on whatever the search box had. It also
cannot report what it opened, because it never knew.

SO THIS RESOLVES TO A PATH
--------------------------
Four sources, each contributing something the others cannot:

  1. App Paths registry — the canonical "what does `chrome` mean" table, and
     the same one the Run dialog uses. Exact executable, highest confidence.
  2. Start Menu shortcuts — how the user thinks about their software. A `.lnk`
     carries a friendly name AND its target, which is the pair needed.
  3. PATH directories — command-line tools with no installer and no shortcut.
  4. Uninstall registry — no executable, but the authority on version and
     publisher, merged in to enrich the entries above.

Nothing here knows any specific application. Adding one would be the same
mistake as a per-app control table: the next program the user installs would
not be in it.
"""

from __future__ import annotations

import os
import subprocess
import platform
import json
from pathlib import Path
from typing import Any

_MAX = 600

#: Shortcut folders that describe software rather than documents.
_START_MENU = [
    r"%ProgramData%\Microsoft\Windows\Start Menu\Programs",
    r"%APPDATA%\Microsoft\Windows\Start Menu\Programs",
]

#: Shortcuts that are never a program the user means.
_NOISE = (
    "uninstall",
    "readme",
    "release notes",
    "documentation",
    "help",
    "website",
    "homepage",
    "report a",
    "license",
    "licence",
    "changelog",
)


def _clean(name: str) -> str:
    return " ".join(str(name).replace("​", " ").split())[:160]


def _is_noise(name: str) -> bool:
    lowered = name.lower()
    return any(word in lowered for word in _NOISE)


def _app_paths() -> dict[str, dict[str, Any]]:
    """The registry table Windows itself uses to resolve a bare program name.

    Contributes nothing where there is no registry, rather than raising. This is
    one of several discovery sources merged in `_discover`, and `_shortcut_target`
    below already answers "not available here" with None. This one let
    `ModuleNotFoundError: winreg` escape instead, so on Linux and macOS a plain
    "which applications are installed" call died with a stdlib import error
    rather than the engine's own refusal.
    """
    try:
        import winreg  # noqa: PLC0415
    except ImportError:
        return {}

    found: dict[str, dict[str, Any]] = {}
    for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        try:
            with winreg.OpenKey(
                hive, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths"
            ) as key:
                for index in range(winreg.QueryInfoKey(key)[0]):
                    try:
                        entry_name = winreg.EnumKey(key, index)
                        with winreg.OpenKey(key, entry_name) as entry:
                            path, _ = winreg.QueryValueEx(entry, "")
                            if not path:
                                continue
                            executable = os.path.expandvars(str(path).strip('"'))
                            if not Path(executable).is_file():
                                continue
                            label = _clean(Path(entry_name).stem)
                            found[label.lower()] = {
                                "name": label,
                                "executable": executable,
                                "source": "app_paths",
                                "confidence": 1.0,
                            }
                    except OSError:
                        continue
        except OSError:
            continue
    return found


def _shortcut_target(link: Path) -> str | None:
    """Read a .lnk's target through the shell, which is the only reliable way.

    Parsing the binary format by hand works until it meets a shortcut with a
    relative path or an MSI-advertised target, and those are common.
    """
    try:
        import pythoncom  # noqa: PLC0415
        import win32com.client  # noqa: PLC0415
    except Exception:  # noqa: BLE001
        return None
    try:
        pythoncom.CoInitialize()
    except Exception:  # noqa: BLE001, S110
        pass
    try:
        shell = win32com.client.Dispatch("WScript.Shell")
        target = shell.CreateShortCut(str(link)).Targetpath
        return target if target and Path(target).is_file() else None
    except Exception:  # noqa: BLE001
        return None


def _start_menu() -> dict[str, dict[str, Any]]:
    """Shortcuts, which carry the name the user actually calls the program."""
    found: dict[str, dict[str, Any]] = {}
    for raw in _START_MENU:
        root = Path(os.path.expandvars(raw))
        if not root.is_dir():
            continue
        try:
            links = list(root.rglob("*.lnk"))
        except OSError:
            continue
        for link in links[:_MAX]:
            label = _clean(link.stem)
            if not label or _is_noise(label) or label.lower() in found:
                continue
            target = _shortcut_target(link)
            if not target:
                continue
            found[label.lower()] = {
                "name": label,
                "executable": target,
                "shortcut": str(link),
                "source": "start_menu",
                "confidence": 0.95,
            }
    return found


#: How long PowerShell gets to enumerate the Start apps. It is a one-off
#: subprocess and the catalogue is cached by `discover`, but a hung shell must
#: not hang a launch.
_STARTAPPS_TIMEOUT = 12.0


def _start_apps() -> dict[str, dict[str, Any]]:
    """Store/UWP applications, which have NO .exe to find.

    THE BUG THIS FIXES, AND IT IS WHY WHATSAPP COULD NOT BE OPENED.
    ----------------------------------------------------------------
    Every rung above this one looks for a FILE: App Paths maps a name to an
    executable, Start-menu shortcuts point at one, PATH is a list of them. A
    packaged Store app has none. WhatsApp Desktop on this machine is

        Name  : WhatsApp
        AppID : 5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App

    — an application user-model ID, not a path. So `resolve("WhatsApp")`
    returned `found: False` and OCADE reported, correctly but uselessly, that
    WhatsApp was not installed while its icon sat in the Start menu.

    `Get-StartApps` is the supported enumeration and returns exactly what the
    Start menu shows. Launching is `explorer.exe shell:AppsFolder\\<AppID>`,
    which is the shell verb Windows itself uses — no COM activation, no
    manifest parsing, and it works for packaged and unpackaged entries alike.

    Confidence sits below Start-menu shortcuts deliberately: this list also
    contains Control Panel entries and web links, so a name that matches BOTH
    a real shortcut and a Start entry should prefer the shortcut.
    """
    if platform.system() != "Windows":
        return {}
    try:
        completed = subprocess.run(  # noqa: S603
            [
                "powershell",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-StartApps | ConvertTo-Json -Compress",
            ],
            capture_output=True,
            text=True,
            timeout=_STARTAPPS_TIMEOUT,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (OSError, subprocess.SubprocessError):
        return {}
    if completed.returncode != 0 or not completed.stdout.strip():
        return {}

    try:
        rows = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return {}
    if isinstance(rows, dict):
        rows = [rows]

    found: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        label = _clean(str(row.get("Name") or ""))
        app_id = str(row.get("AppID") or "").strip()
        if not label or not app_id or _is_noise(label) or label.lower() in found:
            continue
        # An AppID that IS a path is already covered, and better, by the rungs
        # above — they can state the file exists. Only the ones with no path
        # are this rung's job.
        packaged = not app_id.lower().endswith(".exe") and "\\" not in app_id
        if not packaged:
            continue
        found[label.lower()] = {
            "name": label,
            # No executable, and saying so is the point: a caller that needs a
            # file path must not be handed an AppID that looks like one.
            "executable": None,
            "appId": app_id,
            "launch": f"shell:AppsFolder\\{app_id}",
            "source": "start_apps",
            "confidence": 0.9,
        }
    return found


def _path_executables() -> dict[str, dict[str, Any]]:
    """Command-line tools: installed, launchable, and in neither list above."""
    found: dict[str, dict[str, Any]] = {}
    extensions = [e.lower() for e in (os.environ.get("PATHEXT") or ".EXE").split(os.pathsep) if e]
    for directory in (os.environ.get("PATH") or "").split(os.pathsep):
        folder = Path(directory.strip('"')) if directory.strip() else None
        if folder is None or not folder.is_dir():
            continue
        try:
            entries = list(folder.iterdir())[:400]
        except OSError:
            continue
        for entry in entries:
            if not entry.is_file() or entry.suffix.lower() not in extensions:
                continue
            label = _clean(entry.stem)
            # `[.exe` is a real file in Git's bin directory, and `_` and `.` are
            # not names anybody would ask OCADE to open. A name has to look like
            # a name to be offered as one.
            if len(label) < 2 or not any(c.isalnum() for c in label):
                continue
            if not label or label.lower() in found:
                continue
            found[label.lower()] = {
                "name": label,
                "executable": str(entry),
                "source": "path",
                "confidence": 0.7,
            }
    return found


def _registry_metadata() -> dict[str, dict[str, Any]]:
    """Version and publisher. No executable — that is what the others are for.

    Contributes nothing where there is no registry, for the reason given on
    `_app_paths`.
    """
    try:
        import winreg  # noqa: PLC0415
    except ImportError:
        return {}

    roots = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ]
    found: dict[str, dict[str, Any]] = {}
    for hive, path in roots:
        try:
            with winreg.OpenKey(hive, path) as key:
                for index in range(winreg.QueryInfoKey(key)[0]):
                    try:
                        with winreg.OpenKey(key, winreg.EnumKey(key, index)) as entry:
                            display, _ = winreg.QueryValueEx(entry, "DisplayName")
                            if not display:
                                continue

                            def read(field: str) -> str:
                                try:
                                    value, _ = winreg.QueryValueEx(entry, field)  # noqa: B023
                                    return _clean(value) if value else ""
                                except OSError:
                                    return ""

                            found[_clean(display).lower()] = {
                                "name": _clean(display),
                                "version": read("DisplayVersion"),
                                "publisher": read("Publisher"),
                            }
                    except OSError:
                        continue
        except OSError:
            continue
    return found


def discover(*, include_path: bool = True) -> dict[str, Any]:
    """Every launchable application, merged from all four sources.

    Merged HIGHEST CONFIDENCE FIRST, so a program present in both App Paths and
    the Start Menu keeps its canonical executable while gaining the friendly
    name — rather than whichever source happened to be walked last winning.
    """
    merged: dict[str, dict[str, Any]] = {}
    # `_start_apps` first so a real shortcut or App Paths entry with the same
    # name still wins on confidence — a Store entry is the fallback for names
    # that have no file at all, not a replacement for ones that do.
    for source in (
        _path_executables() if include_path else {},
        _start_apps(),
        _start_menu(),
        _app_paths(),
    ):
        for key, row in source.items():
            existing = merged.get(key)
            if existing is None or row["confidence"] > existing["confidence"]:
                merged[key] = {**(existing or {}), **row}

    metadata = _registry_metadata()
    for key, row in merged.items():
        meta = metadata.get(key)
        if meta:
            row["version"] = meta.get("version") or ""
            row["publisher"] = meta.get("publisher") or ""

    # SORTED BY CONFIDENCE FIRST, AND THE TRUNCATION IS WHY.
    #
    # PATH contributed 413 of 563 entries on the reference machine — `[.exe`,
    # `AggregatorHost`, every Git and system binary. Sorted alphabetically and
    # cut at the limit, that junk crowded out the applications a person would
    # actually name. Ranking by source confidence keeps App Paths and Start
    # Menu entries at the top, where the cut cannot reach them.
    applications = sorted(merged.values(), key=lambda r: (-r["confidence"], r["name"].lower()))
    by_source: dict[str, int] = {}
    for row in applications:
        by_source[row["source"]] = by_source.get(row["source"], 0) + 1

    return {
        "applications": applications[:_MAX],
        "count": len(applications),
        "bySource": by_source,
        "verified": True,
        "detail": (
            f"{len(applications)} launchable application(s): "
            + ", ".join(f"{n} from {s}" for s, n in sorted(by_source.items()))
        ),
    }


def resolve(name: str) -> dict[str, Any]:
    """Turn what the user called a program into an executable to run.

    Returns the CANDIDATES rather than picking silently when the match is
    ambiguous, because launching the wrong program is not obviously wrong to
    anybody until it has already happened.
    """
    wanted = _clean(name).lower()
    if not wanted:
        return {"found": False, "detail": "No application was named."}

    catalogue = discover()["applications"]
    exact = [a for a in catalogue if a["name"].lower() == wanted]
    starts = [a for a in catalogue if a["name"].lower().startswith(wanted)]
    contains = [a for a in catalogue if wanted in a["name"].lower()]
    ranked = exact or starts or contains

    if not ranked:
        return {
            "found": False,
            "query": name,
            "detail": (
                f"No installed application matches “{name}”. "
                "Use app_list_installed to see what is on this computer."
            ),
        }
    best = max(ranked, key=lambda a: a["confidence"])
    return {
        "found": True,
        "query": name,
        "name": best["name"],
        "executable": best["executable"],
        # HOW TO START IT WHEN THERE IS NO FILE. A packaged Store app resolves
        # to an application user-model ID and nothing else; dropping these two
        # fields here is what made `resolve("WhatsApp")` succeed and the launch
        # still fail, because the caller had a name and no way to act on it.
        "appId": best.get("appId"),
        "launch": best.get("launch"),
        "source": best["source"],
        "confidence": best["confidence"],
        "alternatives": [a["name"] for a in ranked[:5] if a["name"] != best["name"]],
        "verified": True,
        "detail": (
            f"“{name}” resolves to {best['name']} "
            f"({best['executable'] or best.get('appId') or 'a packaged app'})."
        ),
    }
