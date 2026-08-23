"""The rest of the machine: brightness, WiFi, power, startup, clipboard, language.

WHY POWER IS THE CAREFUL ONE
-----------------------------
Everything here is reversible except shutting the computer down, and that one
is different in kind: it closes unsaved work belonging to somebody who is not
looking at the screen. So `power` refuses `shutdown` and `restart` unless the
caller passes `confirmed=True`, and the refusal names what would be lost. Sleep
and lock are not gated, because both are trivially undone by moving the mouse.

WHY AUTOSTART WRITES TO HKCU AND NOT HKLM
------------------------------------------
`HKEY_CURRENT_USER\\...\\Run` needs no administrator rights and affects only the
person who asked for it. The machine-wide key would need elevation and would
start OCADE for every account on the computer — neither of which anybody asked
for by saying "start with Windows".

EVERY FUNCTION READS THE STATE BACK
------------------------------------
Setting brightness to 60 and returning "brightness set to 60" is a claim.
Reading it back and returning what the display actually reports is a receipt,
and on hardware that ignores the request those two answers differ.
"""

from __future__ import annotations

import hashlib
import os
import platform
import subprocess
import time
from pathlib import Path
from typing import Any

_WINDOWS = platform.system() == "Windows"
_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

#: The registry value OCADE registers itself under. Named so a user scrolling
#: their startup list knows exactly what it is and can remove it.
_RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
_RUN_NAME = "OCADE"


class OsRefused(RuntimeError):
    """The action will not run, with a reason the user can act on."""


def _shell(args: list[str], timeout: float = 15.0) -> subprocess.CompletedProcess:
    return subprocess.run(  # noqa: S603
        args, capture_output=True, text=True, timeout=timeout, creationflags=_NO_WINDOW
    )


# ------------------------------------------------------------- brightness --


def brightness(level: int | None = None) -> dict[str, Any]:
    """Read or set display brightness, then read it back."""
    try:
        import screen_brightness_control as sbc  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise OsRefused("Brightness control needs screen_brightness_control.") from error

    if level is not None:
        wanted = max(0, min(int(level), 100))
        try:
            sbc.set_brightness(wanted)
        except Exception as error:  # noqa: BLE001
            raise OsRefused(f"This display refused a brightness change ({error}).") from error

    try:
        current = sbc.get_brightness()
        now = int(current[0]) if isinstance(current, list) and current else int(current)
    except Exception:  # noqa: BLE001
        now = None

    return {
        "brightness": now,
        "requested": level,
        # Verified by what the DISPLAY reports, not by the call returning.
        # External monitors routinely accept the request and ignore it.
        "verified": level is None or (now is not None and abs(now - int(level)) <= 5),
        "detail": (
            f"Brightness is {now}%." if level is None else f"Brightness set to {now}%."
        ),
    }


# ------------------------------------------------------------------ wifi --


def wifi(action: str = "status") -> dict[str, Any]:
    """Turn WiFi on or off, or report what it is connected to."""
    if not _WINDOWS:
        raise OsRefused("WiFi control is wired up for Windows only.")
    verb = " ".join((action or "status").split()).lower()
    if verb not in ("status", "on", "off"):
        raise OsRefused("WiFi takes status, on or off.")

    if verb in ("on", "off"):
        result = _shell(["netsh", "interface", "set", "interface", "Wi-Fi",
                         "admin=" + ("enabled" if verb == "on" else "disabled")])
        if result.returncode != 0:
            raise OsRefused(
                "Windows refused the WiFi change. Turning the adapter on or off "
                "needs an elevated OCADE."
            )

    shown = _shell(["netsh", "wlan", "show", "interfaces"])
    text = shown.stdout or ""
    state = ""
    ssid = ""
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("state") and ":" in stripped:
            state = stripped.split(":", 1)[1].strip()
        elif stripped.lower().startswith("ssid") and ":" in stripped and not ssid:
            ssid = stripped.split(":", 1)[1].strip()
    return {
        "action": verb,
        "state": state or "unknown",
        "network": ssid,
        "verified": bool(state),
        "detail": (
            f"WiFi is {state.lower()}" + (f" on {ssid}." if ssid else ".")
            if state
            else "WiFi state could not be read."
        ),
    }


# ----------------------------------------------------------------- power --


def power(action: str, *, confirmed: bool = False) -> dict[str, Any]:
    """Sleep, lock, shut down or restart.

    SHUTDOWN AND RESTART NEED `confirmed`. They close unsaved work belonging to
    somebody who may not be at the screen, and unlike everything else OCADE
    does there is no undo and no receipt to read afterwards — the machine is
    gone. Sleep and lock are ungated because a mouse movement reverses both.
    """
    verb = " ".join((action or "").split()).lower()

    commands = {
        "sleep": ["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"],
        "lock": ["rundll32.exe", "user32.dll,LockWorkStation"],
        "shutdown": ["shutdown", "/s", "/t", "5"],
        "restart": ["shutdown", "/r", "/t", "5"],
        "reboot": ["shutdown", "/r", "/t", "5"],
    }

    # THE REQUEST IS JUDGED BEFORE THE MACHINE IS.
    #
    # The platform check used to come first, so on anything but Windows an
    # unconfirmed "shut down the computer" was answered "power control is wired
    # up for Windows only". True, and the wrong answer: it reports a capability
    # gap where the real objection is that nobody confirmed. It also meant the
    # confirmation gate — the one rule here that protects unsaved work — could
    # only ever be exercised on Windows, so no other platform, and no CI run,
    # could prove it was still in place.
    #
    # Validating the request first makes the refusal the same everywhere, and
    # makes the safety rule testable everywhere.
    if verb not in commands:
        raise OsRefused(f"Unknown power action {verb!r}. Use sleep, lock, shutdown or restart.")

    if verb in ("shutdown", "restart", "reboot") and not confirmed:
        raise OsRefused(
            f"A {verb} closes everything that is open, including unsaved work, "
            "and cannot be undone. Ask again with confirmation if you mean it."
        )

    if not _WINDOWS:
        raise OsRefused("Power control is wired up for Windows only.")

    _shell(commands[verb], timeout=10.0)
    return {
        "action": verb,
        # Deliberately None: nothing can verify a shutdown from inside the
        # process being shut down, and claiming otherwise would be a lie.
        "verified": None if verb in ("shutdown", "restart", "reboot") else True,
        "detail": {
            "sleep": "Going to sleep.",
            "lock": "Locked.",
            "shutdown": "Shutting down in five seconds. `shutdown /a` cancels it.",
            "restart": "Restarting in five seconds. `shutdown /a` cancels it.",
            "reboot": "Restarting in five seconds. `shutdown /a` cancels it.",
        }[verb],
    }


# ------------------------------------------------------------- autostart --


def _default_command() -> str:
    """The launcher to register. The installed app when there is one.

    Resolved from `OCADE_LAUNCH_COMMAND` first, because the packaged desktop
    app knows its own executable path and this module does not — registering
    `python.exe` with no script would start an interactive interpreter at every
    login, which is a worse outcome than not registering at all.
    """
    import sys  # noqa: PLC0415

    configured = (os.environ.get("OCADE_LAUNCH_COMMAND") or "").strip()
    if configured:
        return configured
    return f'"{sys.executable}"' if _WINDOWS else sys.executable


# -- windows: HKCU\...\Run ---------------------------------------------------


def _autostart_windows(enable: bool | None, command: str) -> dict[str, Any]:
    """HKCU, not HKLM: no administrator rights, and it starts for the person who
    asked rather than for everybody with an account on the machine."""
    import winreg  # noqa: PLC0415

    def read() -> tuple[bool, str]:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _RUN_KEY) as key:
                value, _ = winreg.QueryValueEx(key, _RUN_NAME)
            return True, str(value)
        except OSError:
            return False, ""

    if enable is not None:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            if enable:
                winreg.SetValueEx(
                    key, _RUN_NAME, 0, winreg.REG_SZ, command.strip() or _default_command()
                )
            else:
                try:
                    winreg.DeleteValue(key, _RUN_NAME)
                except OSError:  # noqa: S110
                    pass

    # Read the registry back rather than trusting the write.
    enabled, value = read()
    return {"enabled": enabled, "command": value, "mechanism": "registry Run key"}


# -- macos: a LaunchAgent ----------------------------------------------------

_AGENT_LABEL = "com.ocade.autostart"


def _agent_plist() -> Path:
    return Path.home() / "Library" / "LaunchAgents" / f"{_AGENT_LABEL}.plist"


def _autostart_macos(enable: bool | None, command: str) -> dict[str, Any]:
    """A LaunchAgent in the user's own folder, loaded at login by launchd."""
    import plistlib  # noqa: PLC0415

    path = _agent_plist()

    def read() -> tuple[bool, str]:
        if not path.is_file():
            return False, ""
        try:
            data = plistlib.loads(path.read_bytes())
            arguments = data.get("ProgramArguments") or []
            return True, " ".join(str(part) for part in arguments)
        except Exception:  # noqa: BLE001
            return True, ""

    if enable is True:
        target = command.strip() or _default_command()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(
            plistlib.dumps(
                {
                    "Label": _AGENT_LABEL,
                    # Split rather than handed to a shell: launchd execs this
                    # directly, so a path with a space is an argument boundary
                    # unless the caller quoted it, and there is no shell to
                    # interpret anything else in the string.
                    "ProgramArguments": __import__("shlex").split(target),
                    "RunAtLoad": True,
                    "KeepAlive": False,
                    "ProcessType": "Interactive",
                }
            )
        )
        uid = os.getuid()  # type: ignore[attr-defined]
        if _shell(["launchctl", "bootstrap", f"gui/{uid}", str(path)]).returncode != 0:
            _shell(["launchctl", "load", "-w", str(path)])
    elif enable is False and path.is_file():
        try:
            uid = os.getuid()  # type: ignore[attr-defined]
            _shell(["launchctl", "bootout", f"gui/{uid}/{_AGENT_LABEL}"])
        except Exception:  # noqa: BLE001, S110
            pass
        _shell(["launchctl", "unload", "-w", str(path)])
        path.unlink(missing_ok=True)

    enabled, value = read()
    return {"enabled": enabled, "command": value, "mechanism": "LaunchAgent", "path": str(path)}


# -- linux: an XDG autostart .desktop entry ----------------------------------


def _desktop_entry() -> Path:
    base = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    return Path(base) / "autostart" / "ocade.desktop"


def _autostart_linux(enable: bool | None, command: str) -> dict[str, Any]:
    """A `.desktop` file under XDG autostart — the one mechanism every desktop
    environment on Linux agrees about. systemd user units are more powerful and
    are not read by GNOME, KDE and XFCE alike; this is."""
    path = _desktop_entry()

    def read() -> tuple[bool, str]:
        if not path.is_file():
            return False, ""
        try:
            for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
                if line.startswith("Exec="):
                    return True, line.split("=", 1)[1].strip()
        except OSError:
            return True, ""
        return True, ""

    if enable is True:
        target = command.strip() or _default_command()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            "\n".join(
                [
                    "[Desktop Entry]",
                    "Type=Application",
                    "Name=OCADE",
                    "Comment=OCADE assistant",
                    f"Exec={target}",
                    "Terminal=false",
                    "X-GNOME-Autostart-enabled=true",
                    "NoDisplay=true",
                    "",
                ]
            ),
            encoding="utf-8",
        )
    elif enable is False:
        path.unlink(missing_ok=True)

    enabled, value = read()
    return {"enabled": enabled, "command": value, "mechanism": ".desktop entry", "path": str(path)}


def autostart(enable: bool | None = None, *, command: str = "") -> dict[str, Any]:
    """Register OCADE to start at login, or report whether it is.

    ALWAYS THE CURRENT USER, NEVER THE MACHINE. The Windows Run key is HKCU, the
    macOS agent is in `~/Library/LaunchAgents`, and the Linux entry is under
    `~/.config/autostart`. All three need no administrator rights and affect
    only the person who asked — the machine-wide equivalents would need
    elevation and would start OCADE for every account on the computer, neither
    of which anybody asked for by saying "start with my computer".

    THE STATE IS ALWAYS READ BACK. Every branch below returns what the registry,
    the plist or the file says AFTER the change, so a write that silently failed
    reports `enabled: false` rather than the value it hoped for.
    """
    if _WINDOWS:
        state = _autostart_windows(enable, command)
    elif platform.system() == "Darwin":
        state = _autostart_macos(enable, command)
    elif platform.system() == "Linux":
        state = _autostart_linux(enable, command)
    else:
        raise OsRefused(f"Auto-start is not wired up on {platform.system()}.")

    enabled = bool(state["enabled"])
    # `verified` is whether the state MATCHES what was asked for. A request to
    # enable that left the key absent is a failure, and returning True because
    # the read succeeded would hide it.
    state["verified"] = enabled if enable is None else (enabled is bool(enable))
    state["detail"] = (
        f"OCADE starts automatically at login (via the {state['mechanism']})."
        if enabled
        else "OCADE does not start automatically."
    )
    return state


# ------------------------------------------------------------- clipboard --


def clipboard(text: str | None = None) -> dict[str, Any]:
    """Read what was copied, or replace it.

    The read half is what Clipboard Intelligence runs on: copy anything, and
    the panel offers to translate, summarise, explain or fix THIS text. The
    model does those; this only fetches the material.
    """
    try:
        import pyperclip  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise OsRefused("Clipboard access needs pyperclip.") from error

    if text is not None:
        pyperclip.copy(str(text)[:100_000])
        return {"copied": True, "characters": len(str(text)), "verified": True,
                "detail": "Copied to the clipboard."}

    content = pyperclip.paste() or ""
    return {
        "text": content[:20_000],
        "characters": len(content),
        "empty": not content.strip(),
        # The four things the floating panel offers, named here so the UI and
        # the engine cannot disagree about what is on the menu.
        "actions": CLIPBOARD_ACTIONS,
        "verified": True,
        "detail": (
            f"{len(content)} character(s) on the clipboard."
            if content.strip()
            else "The clipboard is empty."
        ),
    }


#: What the floating panel offers. One list, read by the engine and the
#: interface, so a new action cannot appear in one and not the other.
CLIPBOARD_ACTIONS = ("translate", "summarise", "explain", "fix")

#: The last thing this process saw on the clipboard, as a hash. The TEXT is
#: deliberately not kept: whatever somebody copies passes through here, and a
#: module-level variable holding the last password they pasted is a liability
#: for no benefit — a hash answers "did it change" perfectly well.
_CLIPBOARD_SEEN: dict[str, Any] = {"digest": "", "at": 0.0}


def clipboard_changed(*, min_characters: int = 3) -> dict[str, Any]:
    """Has something new been copied since the last time this was asked?

    THE POLL THAT MAKES A FLOATING PANEL POSSIBLE WITHOUT A HOOK.
    Watching the clipboard properly means a Win32 message loop on its own
    thread, which is a whole thread and a whole class of shutdown bug for a
    feature that only has to feel instant. A cheap poll answered by a hash
    comparison costs microseconds and is indistinguishable to a user.

    `changed` is FALSE on the very first call. The panel must not fly open the
    moment OCADE starts, showing whatever happened to be on the clipboard from
    an hour ago — that is a jump-scare, not a feature. The first call only
    establishes the baseline.
    """
    try:
        import pyperclip  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise OsRefused("Clipboard access needs pyperclip.") from error

    try:
        content = pyperclip.paste() or ""
    except Exception:  # noqa: BLE001
        # A clipboard held open by another application is a normal, transient
        # condition on Windows, not an error worth surfacing to the user.
        return {"changed": False, "empty": True, "verified": True, "detail": "The clipboard is busy."}

    stripped = content.strip()
    digest = hashlib.sha256(stripped.encode("utf-8", "replace")).hexdigest() if stripped else ""

    first_look = not _CLIPBOARD_SEEN["digest"] and _CLIPBOARD_SEEN["at"] == 0.0
    changed = bool(
        digest
        and digest != _CLIPBOARD_SEEN["digest"]
        and len(stripped) >= max(1, int(min_characters))
        and not first_look
    )
    _CLIPBOARD_SEEN["digest"] = digest
    _CLIPBOARD_SEEN["at"] = time.time()

    return {
        "changed": changed,
        "empty": not stripped,
        "characters": len(content),
        # The text rides along only when something actually changed, so an idle
        # poll — which is nearly all of them — carries no clipboard content at
        # all through the protocol or into any transcript.
        "text": content[:20_000] if changed else "",
        "actions": list(CLIPBOARD_ACTIONS) if changed else [],
        "verified": True,
        "detail": (
            f"Something new was copied ({len(content)} characters)."
            if changed
            else "Nothing new has been copied."
        ),
    }


# -------------------------------------------------------------- language --


def language(detected: str = "") -> dict[str, Any]:
    """Remember the language the user speaks, silently, on first use.

    ASKED ONCE BY OBSERVING, NEVER BY PROMPTING. The first transcription names
    a language; that is stored and every later session adapts to it. A settings
    screen asking somebody to pick their own language from a list is a worse
    experience than simply noticing.
    """
    from core import memory  # noqa: PLC0415

    known = (memory.identity().get("language") or "").strip()
    said = " ".join((detected or "").split()).lower()

    if said and not known:
        memory.set_identity(language=said)
        return {"language": said, "learned": True, "verified": True,
                "detail": f"OCADE will speak {said} from now on."}
    if said and known and said != known:
        # NOT overwritten on a single differing sample. One sentence in another
        # language is a quote, a song title or a mistranscription — not a
        # change of the user's language.
        return {"language": known, "heard": said, "learned": False, "verified": True,
                "detail": f"Heard {said}, but keeping {known}."}
    return {
        "language": known,
        "learned": False,
        "verified": True,
        "detail": f"Speaking {known}." if known else "No language learned yet.",
    }
