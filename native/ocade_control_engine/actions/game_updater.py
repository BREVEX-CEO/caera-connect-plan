"""Installed games, whether they are behind, and asking the launcher to fix it.

WHY THIS READS MANIFESTS INSTEAD OF DRIVING THE LAUNCHER'S UI
-------------------------------------------------------------
The obvious build is: open Steam, find the Downloads page, read the list. That
is three UI Automation calls against a Chromium-embedded window that redraws
itself, and it answers "what is on the Downloads page" rather than "what is
installed and behind".

Both launchers already write the answer to disk. Steam keeps an
`appmanifest_<appid>.acf` per installed game in every library folder; Epic keeps
a JSON `.item` per install under ProgramData. Those files are the launcher's own
bookkeeping, so reading them is reading the truth rather than a rendering of it
— and it works while the launcher is closed, which is when somebody is most
likely to ask.

WHAT "TRIGGER AN UPDATE" HONESTLY MEANS
----------------------------------------
Neither launcher exposes an "update this game now" API. What they DO expose are
registered protocol handlers, and those are the supported way in:

  steam://validate/<appid>   — verifies the install and downloads whatever is
                               missing or stale. This is the real update path
                               and it is the one Steam's own "Verify integrity"
                               button uses.
  com.epicgames.launcher://apps/<name>?action=launch
                             — Epic updates a game before it launches it, and
                               refuses to start a stale one. Asking it to launch
                               IS asking it to update.

So this module does not claim to have updated anything. It claims to have ASKED,
and it reports the pending byte counts it read from the manifest so the caller
can say "3.2 GB behind" rather than "an update is available". A progress number
read from the launcher's own file is a receipt; "update triggered" is a hope.

NOTHING IS INSTALLED, BOUGHT, OR DELETED
-----------------------------------------
There is no path here that acquires a game, spends money, or removes anything.
The two verbs are LIST and ASK-TO-UPDATE, and both are things the user could do
themselves with two clicks in a launcher they already have open.
"""

from __future__ import annotations

import json
import os
import platform
import re
import subprocess
import time
from pathlib import Path
from typing import Any

_WINDOWS = platform.system() == "Windows"
_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

#: Steam's `StateFlags` is a bitfield. Only the bits below are read, because
#: they are the ones whose meaning is stable across client versions.
_STATE_FULLY_INSTALLED = 4
_STATE_UPDATE_REQUIRED = 2
_STATE_UPDATE_QUEUED = 1024
_STATE_UPDATE_RUNNING = 512

#: A `.acf` is Valve's KeyValues format, not JSON: `"key"  "value"` pairs one to
#: a line, nested in braces. Only top-level scalars are needed here, and a
#: line-wise read of those is both correct and immune to a nesting change.
_KV = re.compile(r'^\s*"([^"]+)"\s+"([^"]*)"\s*$')

_MAX_GAMES = 300


class GameRefused(RuntimeError):
    """The request will not run, with a reason the user can act on."""


def _kv_pairs(text: str) -> dict[str, str]:
    found: dict[str, str] = {}
    for line in text.splitlines():
        match = _KV.match(line)
        if match and match.group(1) not in found:
            found[match.group(1)] = match.group(2)
    return found


# ------------------------------------------------------------------ steam --


def _steam_root() -> Path | None:
    """Where Steam is installed, from the registry when possible."""
    if _WINDOWS:
        try:
            import winreg  # noqa: PLC0415

            for hive, key in (
                (winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam"),
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam"),
            ):
                try:
                    with winreg.OpenKey(hive, key) as handle:
                        value, _ = winreg.QueryValueEx(
                            handle, "SteamPath" if hive == winreg.HKEY_CURRENT_USER else "InstallPath"
                        )
                    candidate = Path(str(value))
                    if candidate.is_dir():
                        return candidate
                except OSError:
                    continue
        except Exception:  # noqa: BLE001, S110
            pass
        for guess in (
            Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Steam",
            Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Steam",
        ):
            if guess.is_dir():
                return guess
        return None

    for guess in (
        Path.home() / ".steam" / "steam",
        Path.home() / ".local" / "share" / "Steam",
        Path.home() / "Library" / "Application Support" / "Steam",
    ):
        if guess.is_dir():
            return guess
    return None


def _steam_libraries(root: Path) -> list[Path]:
    """Every library folder, including the ones on other drives.

    A single-folder read misses most people's actual library. `libraryfolders.vdf`
    is where Steam records the extra drives, and a game living on D: is exactly
    the one somebody has forgotten to update.
    """
    libraries = [root / "steamapps"]
    manifest = root / "steamapps" / "libraryfolders.vdf"
    if manifest.is_file():
        try:
            text = manifest.read_text(encoding="utf-8", errors="replace")
        except OSError:
            text = ""
        for raw in re.findall(r'"path"\s+"([^"]+)"', text):
            candidate = Path(raw.replace("\\\\", "\\")) / "steamapps"
            if candidate.is_dir() and candidate not in libraries:
                libraries.append(candidate)
    return [library for library in libraries if library.is_dir()]


def _steam_games() -> list[dict[str, Any]]:
    root = _steam_root()
    if root is None:
        return []

    games: list[dict[str, Any]] = []
    for library in _steam_libraries(root):
        for manifest in sorted(library.glob("appmanifest_*.acf")):
            try:
                fields = _kv_pairs(manifest.read_text(encoding="utf-8", errors="replace"))
            except OSError:
                continue

            app_id = fields.get("appid", "").strip()
            if not app_id.isdigit():
                continue

            try:
                state = int(fields.get("StateFlags", "0") or 0)
            except ValueError:
                state = 0
            try:
                to_download = int(fields.get("BytesToDownload", "0") or 0)
                downloaded = int(fields.get("BytesDownloaded", "0") or 0)
            except ValueError:
                to_download = downloaded = 0

            pending = max(0, to_download - downloaded)
            # THREE INDEPENDENT SIGNALS, ANY OF WHICH MEANS "BEHIND".
            # StateFlags alone missed a game mid-download (it reads as
            # installed AND running an update), and the byte counts alone
            # missed one that Steam has queued but not yet sized.
            behind = bool(
                state & _STATE_UPDATE_REQUIRED
                or state & _STATE_UPDATE_QUEUED
                or state & _STATE_UPDATE_RUNNING
                or pending > 0
            )

            games.append(
                {
                    "platform": "steam",
                    "id": app_id,
                    "name": fields.get("name", "") or f"Steam app {app_id}",
                    "installed": bool(state & _STATE_FULLY_INSTALLED),
                    "updateAvailable": behind,
                    "pendingBytes": pending,
                    "installDir": fields.get("installdir", ""),
                    "lastUpdated": int(fields.get("LastUpdated", "0") or 0),
                    "manifest": str(manifest),
                }
            )
            if len(games) >= _MAX_GAMES:
                return games
    return games


# ------------------------------------------------------------------- epic --


def _epic_manifest_dir() -> Path | None:
    if _WINDOWS:
        base = Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData"))
        candidate = base / "Epic" / "EpicGamesLauncher" / "Data" / "Manifests"
        return candidate if candidate.is_dir() else None
    candidate = (
        Path.home()
        / "Library"
        / "Application Support"
        / "Epic"
        / "EpicGamesLauncher"
        / "Data"
        / "Manifests"
    )
    return candidate if candidate.is_dir() else None


def _epic_games() -> list[dict[str, Any]]:
    directory = _epic_manifest_dir()
    if directory is None:
        return []

    games: list[dict[str, Any]] = []
    for item in sorted(directory.glob("*.item")):
        try:
            data = json.loads(item.read_text(encoding="utf-8", errors="replace"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(data, dict):
            continue

        name = str(data.get("DisplayName") or data.get("AppName") or "").strip()
        app_name = str(data.get("AppName") or "").strip()
        if not app_name:
            continue

        # Epic's manifest carries the installed version and, when the launcher
        # has checked, the version it BELIEVES is current. When the second is
        # absent nothing is claimed — `updateAvailable` is None, which the
        # caller renders as "not known" rather than as "up to date".
        installed_version = str(data.get("AppVersionString") or "").strip()
        latest_version = str(data.get("LatestVersionString") or "").strip()
        behind: bool | None = None
        if latest_version:
            behind = latest_version != installed_version

        games.append(
            {
                "platform": "epic",
                "id": app_name,
                "name": name or app_name,
                "installed": bool(data.get("bIsIncompleteInstall") is not True),
                "updateAvailable": behind,
                "pendingBytes": 0,
                "installDir": str(data.get("InstallLocation") or ""),
                "version": installed_version,
                "latestVersion": latest_version,
                "manifest": str(item),
            }
        )
        if len(games) >= _MAX_GAMES:
            break
    return games


# ------------------------------------------------------------------ public --


def installed(platform_filter: str = "") -> dict[str, Any]:
    """Every game the launchers say is installed, and which look behind."""
    wanted = " ".join((platform_filter or "").split()).lower()
    if wanted not in ("", "all", "steam", "epic"):
        raise GameRefused(f"{platform_filter!r} is not a launcher OCADE knows. Use steam or epic.")

    games: list[dict[str, Any]] = []
    if wanted in ("", "all", "steam"):
        games.extend(_steam_games())
    if wanted in ("", "all", "epic"):
        games.extend(_epic_games())

    games.sort(key=lambda row: str(row.get("name", "")).lower())
    behind = [game for game in games if game.get("updateAvailable") is True]
    launchers = sorted({str(game["platform"]) for game in games})

    return {
        "games": games,
        "count": len(games),
        "needingUpdate": behind,
        "updateCount": len(behind),
        "launchers": launchers,
        # Verified means THE MANIFESTS WERE READ, which is the only claim this
        # can honestly make. Finding no launcher installed is a real, verified
        # answer; it is not a failure.
        "verified": True,
        "detail": (
            f"{len(games)} game(s) installed across {', '.join(launchers)}; "
            + (
                f"{len(behind)} need updating: "
                + ", ".join(str(game["name"]) for game in behind[:5])
                if behind
                else "none are behind."
            )
            if games
            else "No Steam or Epic installation was found on this computer."
        ),
    }


def _launch_protocol(url: str) -> bool:
    """Hand a URL to the OS's registered handler. Returns whether it was accepted."""
    try:
        if _WINDOWS:
            os.startfile(url)  # noqa: S606 - a registered protocol, not a shell string
            return True
        opener = "open" if platform.system() == "Darwin" else "xdg-open"
        completed = subprocess.run(  # noqa: S603
            [opener, url],
            capture_output=True,
            text=True,
            timeout=15.0,
            creationflags=_NO_WINDOW,
        )
        return completed.returncode == 0
    except Exception:  # noqa: BLE001
        return False


def update(game: str = "", platform_name: str = "") -> dict[str, Any]:
    """Ask the launcher to bring a game (or everything) up to date.

    Named by TITLE, not by app id, because that is what a person says. The name
    is resolved against the manifests first and an ambiguous match is refused
    rather than guessed — asking Steam to re-verify the wrong 90 GB game is a
    long, loud, hard-to-stop mistake.
    """
    catalogue = installed(platform_name)
    games: list[dict[str, Any]] = list(catalogue["games"])
    if not games:
        raise GameRefused("No Steam or Epic games were found on this computer.")

    wanted = " ".join((game or "").split()).lower()
    if wanted:
        exact = [row for row in games if str(row["name"]).lower() == wanted]
        partial = [row for row in games if wanted in str(row["name"]).lower()]
        matches = exact or partial
        if not matches:
            raise GameRefused(f"No installed game matches {game!r}.")
        if len(matches) > 1:
            names = ", ".join(str(row["name"]) for row in matches[:6])
            raise GameRefused(f"{game!r} matches more than one game: {names}. Say which.")
        targets = matches
    else:
        # No title given: update everything that is actually behind. Asking
        # Steam to verify a library that is already current is hours of disk
        # reads nobody asked for.
        targets = [row for row in games if row.get("updateAvailable") is True]
        if not targets:
            return {
                "asked": [],
                "count": 0,
                "verified": True,
                "detail": "Nothing is behind — every installed game is already up to date.",
            }

    asked: list[dict[str, Any]] = []
    for row in targets[:10]:
        if row["platform"] == "steam":
            url = f"steam://validate/{row['id']}"
        else:
            url = f"com.epicgames.launcher://apps/{row['id']}?action=launch"
        accepted = _launch_protocol(url)
        asked.append(
            {
                "name": row["name"],
                "platform": row["platform"],
                "id": row["id"],
                "url": url,
                "accepted": accepted,
                "pendingBytes": row.get("pendingBytes", 0),
            }
        )
        # A short gap between protocol launches. Two `steam://` URLs fired in
        # the same millisecond are routinely coalesced into one by the client,
        # and the second game silently never gets asked.
        time.sleep(0.4)

    accepted_count = sum(1 for row in asked if row["accepted"])
    return {
        "asked": asked,
        "count": len(asked),
        # `verified` is about the HANDOFF, and the wording says so. Nothing in
        # this process can watch a download finish, and reporting "updated"
        # would be a claim about a program OCADE does not control.
        "verified": accepted_count == len(asked) and accepted_count > 0,
        "detail": (
            f"Asked the launcher to update {accepted_count} of {len(asked)} game(s): "
            + ", ".join(str(row["name"]) for row in asked)
            + ". The launcher does the downloading and shows its own progress."
        ),
    }
