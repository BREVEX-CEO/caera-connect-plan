"""Real telemetry and real hardware control for the host machine.

THE ONE RULE HERE IS THAT EVERY NUMBER IS MEASURED
---------------------------------------------------
Not estimated, not defaulted, not carried over from the last reading. Where a
value cannot be read on this machine — no battery in a desktop, no brightness
control on an external monitor over HDMI — the answer is `None` and a stated
reason, never a plausible-looking zero.

This matters more than it sounds. A model handed `"battery": 0` will tell the
user their laptop is about to die; handed `"battery": null, "batteryReason":
"this machine has no battery"` it will say something true. The difference costs
one field and is the whole distinction between telemetry and decoration.

WHY `None` AND NOT AN EXCEPTION
-------------------------------
A machine with no battery is not an error, and a telemetry call that raises
because one of eleven fields is unavailable gives the caller nothing instead of
ten useful things. Unavailability is data.

WHAT VERIFICATION MEANS FOR EACH KIND OF CONTROL
-------------------------------------------------
Brightness and volume are settable AND readable, so those are verified by
reading the hardware back — the strong form.

Media keys are not. Windows broadcasts them to whichever application owns the
media session, and that application is under no obligation to report anything
back. The honest secondary check is the audio session state, which says whether
sound is being produced — so `media()` reports what actually changed rather
than claiming the key "worked". Where nothing was playing and nothing started,
`verified` is `None`, because a pause that had nothing to pause is neither a
success nor a failure.
"""

from __future__ import annotations

import shutil
import subprocess
import time
from typing import Any

# Windows virtual-key codes for the media keys. Sent at the OS level, which is
# why they reach Spotify or a YouTube tab WITHOUT focusing it: Windows routes
# them to whichever application currently holds the media session, exactly as a
# keyboard's physical media keys do.
VK_MEDIA = {
    "next": 0xB0,
    "previous": 0xB1,
    "stop": 0xB2,
    "playpause": 0xB3,
    "mute": 0xAD,
    "volumedown": 0xAE,
    "volumeup": 0xAF,
}

_KEYEVENTF_KEYUP = 0x0002


class SystemUnavailable(RuntimeError):
    """A capability is not present on this machine, with a reason."""


# --------------------------------------------------------------- telemetry


def _battery() -> dict[str, Any]:
    """Charge and charging state, or a stated absence."""
    import psutil  # noqa: PLC0415

    try:
        battery = psutil.sensors_battery()
    except Exception:  # noqa: BLE001
        return {"percent": None, "reason": "This machine does not report battery status."}
    if battery is None:
        return {"percent": None, "reason": "This machine has no battery."}

    # psutil uses two NEGATIVE SENTINELS here, and passing them through would
    # report "-2 seconds remaining" to a user. Measured on the reference laptop
    # while charging: secsleft == -2 (POWER_TIME_UNLIMITED).
    seconds = battery.secsleft
    if seconds == psutil.POWER_TIME_UNLIMITED:
        remaining, note = None, "on mains power"
    elif seconds == psutil.POWER_TIME_UNKNOWN or seconds is None or seconds < 0:
        remaining, note = None, "time remaining is not reported"
    else:
        remaining, note = int(seconds), f"about {int(seconds // 60)} minutes left"

    return {
        "percent": round(float(battery.percent), 1),
        "charging": bool(battery.power_plugged),
        "secondsLeft": remaining,
        "note": note,
    }


def _storage() -> list[dict[str, Any]]:
    """Every fixed drive this machine can actually read."""
    import psutil  # noqa: PLC0415

    drives: list[dict[str, Any]] = []
    for part in psutil.disk_partitions(all=False):
        # A card reader with no card raises here rather than returning zeroes,
        # and skipping it is more honest than reporting an empty 0 GB drive.
        try:
            usage = psutil.disk_usage(part.mountpoint)
        except Exception:  # noqa: BLE001
            continue
        drives.append(
            {
                "drive": part.device,
                "filesystem": part.fstype or None,
                "totalGb": round(usage.total / 1024**3, 1),
                "usedGb": round(usage.used / 1024**3, 1),
                "freeGb": round(usage.free / 1024**3, 1),
                "percent": round(usage.percent, 1),
            }
        )
    return drives


def _top_processes(limit: int = 5) -> list[dict[str, Any]]:
    """The processes actually using the most memory.

    RANKED BY MEMORY, NOT CPU, and that is a measurement decision rather than a
    preference. A one-shot `cpu_percent()` per process returns the average since
    that process started — so the ranking would be dominated by whatever has been
    open longest, not by what is busy now. Getting a true CPU ranking means
    sampling every process twice with a wait in between, which costs more than
    this snapshot is worth. Memory is exact on a single read.
    """
    import psutil  # noqa: PLC0415

    rows: list[dict[str, Any]] = []
    for process in psutil.process_iter(["name", "memory_info"]):
        try:
            info = process.info
            memory = info.get("memory_info")
            if memory is None:
                continue
            rows.append({"name": info.get("name") or "?", "memoryMb": round(memory.rss / 1024**2, 1)})
        except Exception:  # noqa: BLE001, S112
            # A process that exited between listing and reading is ordinary.
            continue
    rows.sort(key=lambda r: r["memoryMb"], reverse=True)
    return rows[:limit]


def telemetry(*, cpu_sample_seconds: float = 0.3) -> dict[str, Any]:
    """A measured snapshot of this machine.

    `cpu_sample_seconds` is a real sampling window, not a delay for show:
    `cpu_percent(interval=None)` returns the average since the previous call,
    which on a first call is the average since boot — a number that looks
    plausible and describes nothing about now.
    """
    import psutil  # noqa: PLC0415

    memory = psutil.virtual_memory()
    try:
        frequency = psutil.cpu_freq()
    except Exception:  # noqa: BLE001
        frequency = None

    uptime = int(time.time() - psutil.boot_time())
    return {
        "cpu": {
            "percent": round(psutil.cpu_percent(interval=cpu_sample_seconds), 1),
            "cores": psutil.cpu_count(logical=True),
            "physicalCores": psutil.cpu_count(logical=False),
            "mhz": round(frequency.current, 0) if frequency else None,
            "perCore": [round(v, 1) for v in psutil.cpu_percent(interval=None, percpu=True)],
        },
        "memory": {
            "totalGb": round(memory.total / 1024**3, 2),
            "usedGb": round(memory.used / 1024**3, 2),
            "availableGb": round(memory.available / 1024**3, 2),
            "percent": round(memory.percent, 1),
        },
        "storage": _storage(),
        "battery": _battery(),
        "topProcesses": _top_processes(),
        "uptimeSeconds": uptime,
        "uptime": f"{uptime // 3600}h {(uptime % 3600) // 60}m",
        "processes": len(psutil.pids()),
        "verified": True,
        "detail": (
            f"CPU {round(psutil.cpu_percent(interval=None), 1)}%, "
            f"memory {round(memory.percent, 1)}%, "
            f"up {uptime // 3600}h {(uptime % 3600) // 60}m."
        ),
    }


# -------------------------------------------------------------- brightness


def _sbc():
    try:
        import screen_brightness_control as sbc  # noqa: PLC0415

        return sbc
    except Exception as error:  # noqa: BLE001
        raise SystemUnavailable(
            "Brightness control needs the 'screen_brightness_control' package, "
            "which is not installed in this Python environment."
        ) from error


def get_brightness() -> dict[str, Any]:
    """Brightness per display, as the display itself reports it."""
    sbc = _sbc()
    try:
        levels = sbc.get_brightness()
    except Exception as error:  # noqa: BLE001
        raise SystemUnavailable(
            f"No display on this machine reports a brightness level ({type(error).__name__}). "
            "Desktop monitors connected over HDMI often cannot be controlled this way."
        ) from error

    try:
        names = [m.get("name") or m.get("model") or "display" for m in sbc.list_monitors_info()]
    except Exception:  # noqa: BLE001
        names = []

    displays = [
        {"display": names[i] if i < len(names) else f"display {i}", "percent": int(level)}
        for i, level in enumerate(levels)
    ]
    return {
        "displays": displays,
        "percent": int(levels[0]) if levels else None,
        "verified": True,
        "detail": ", ".join(f"{d['display']}: {d['percent']}%" for d in displays) or "No display.",
    }


def set_brightness(percent: int, *, display: int | None = None) -> dict[str, Any]:
    """Set brightness, then read the display back to confirm it took."""
    sbc = _sbc()
    wanted = max(0, min(100, int(percent)))
    try:
        if display is None:
            sbc.set_brightness(wanted)
        else:
            sbc.set_brightness(wanted, display=display)
    except Exception as error:  # noqa: BLE001
        raise SystemUnavailable(
            f"That display would not accept a brightness change ({type(error).__name__})."
        ) from error

    # Panels quantise, and some take a moment to settle, so the check allows a
    # small delta rather than demanding an exact match from hardware that did
    # what it was told.
    time.sleep(0.25)
    after = get_brightness()
    now = after.get("percent")
    close = now is not None and abs(int(now) - wanted) <= 5
    return {
        **after,
        "requested": wanted,
        "verified": close,
        "detail": (
            f"Brightness is now {now}%."
            if close
            else f"Asked for {wanted}% but the display reports {now}%."
        ),
    }


# ------------------------------------------------------------- media keys


def _active_audio_sessions() -> int | None:
    """How many applications are actively producing sound right now.

    This is the only honest receipt available for a media key. Windows sends the
    key to whichever application owns the media session and that application
    reports nothing back, so "did the music stop?" can only be answered by
    looking at whether sound is still being produced.
    """
    try:
        from pycaw.pycaw import AudioUtilities  # noqa: PLC0415

        # State 1 == AudioSessionStateActive.
        return sum(1 for s in AudioUtilities.GetAllSessions() if getattr(s, "State", 0) == 1)
    except Exception:  # noqa: BLE001
        return None


def media(action: str) -> dict[str, Any]:
    """Send a global media key and report what actually changed.

    GLOBAL IS THE POINT. These go to the OS, not to a window, so OCADE can pause
    a YouTube tab or Spotify without focusing it, stealing the user's cursor, or
    knowing which application is playing in the first place — which is the same
    reason there is no per-application media code anywhere in OCADE.
    """
    key = (action or "").strip().lower()
    if key in ("play", "pause", "play_pause", "toggle"):
        key = "playpause"
    if key in ("prev", "back"):
        key = "previous"
    if key not in VK_MEDIA:
        raise SystemUnavailable(
            f"'{action}' is not a media key. Use one of: {', '.join(sorted(VK_MEDIA))}."
        )

    try:
        import win32api  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise SystemUnavailable(
            "Media keys need pywin32, which is not installed in this Python environment."
        ) from error

    before = _active_audio_sessions()
    code = VK_MEDIA[key]
    win32api.keybd_event(code, 0, 0, 0)
    win32api.keybd_event(code, 0, _KEYEVENTF_KEYUP, 0)

    # Long enough for a player to act on the key and for the session state to
    # settle. Shorter, and a correct pause reads as a failure.
    time.sleep(0.6)
    after = _active_audio_sessions()

    if before is None or after is None:
        verified, detail = None, f"Sent {key}. This machine does not report audio session state."
    elif key == "playpause":
        if after != before:
            verified = True
            detail = "Playback started." if after > before else "Playback paused."
        elif before == 0:
            verified = None
            detail = "Sent play/pause, but nothing was playing and nothing started."
        else:
            verified = False
            detail = "Sent play/pause, but the same audio is still playing."
    elif key in ("next", "previous"):
        # A track change keeps the session active, so the count is expected NOT
        # to move. Silence is the only observable failure.
        verified = after > 0 if before > 0 else None
        detail = (
            f"Sent {key}; audio is still playing."
            if after > 0
            else f"Sent {key}, but nothing is playing now."
        )
    else:
        verified = None
        detail = f"Sent {key}."

    return {
        "action": key,
        "activeBefore": before,
        "activeAfter": after,
        "verified": verified,
        "detail": detail,
    }


# --------------------------------------------------------- bluetooth / devices


def _powershell(script: str, timeout: float = 12.0) -> str:
    """Run one PowerShell query and return its stdout.

    Read-only by construction: every caller below passes a `Get-` cmdlet. This
    helper takes a fixed script from THIS module and never interpolates a model's
    text into it, so there is no path from a tool argument into a shell.
    """
    executable = shutil.which("powershell") or shutil.which("pwsh")
    if not executable:
        raise SystemUnavailable("PowerShell is not available on this machine.")
    try:
        result = subprocess.run(  # noqa: S603
            [executable, "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as error:
        raise SystemUnavailable("The Windows device query timed out.") from error
    return result.stdout or ""


def bluetooth_status() -> dict[str, Any]:
    """Whether Bluetooth is on, and what is paired.

    `Get-PnpDevice -Class Bluetooth` lists the RADIO and every paired device as
    separate entries, so the radio is identified by name rather than assumed to
    be the first row — on the reference machine the first six rows were all
    headphones.
    """
    raw = _powershell(
        "Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | "
        "ForEach-Object { $_.Status + '|' + $_.FriendlyName }"
    )
    rows = [line.strip() for line in raw.splitlines() if "|" in line]
    if not rows:
        return {
            "present": False,
            "enabled": False,
            "devices": [],
            "verified": True,
            "detail": "This machine reports no Bluetooth hardware.",
        }

    devices: list[dict[str, Any]] = []
    radios: list[dict[str, Any]] = []
    for row in rows:
        status, _, name = row.partition("|")
        entry = {"name": name.strip()[:120], "status": status.strip(), "connected": status.strip() == "OK"}
        # The adapter itself, distinguished from the things paired to it.
        if any(word in name.lower() for word in ("radio", "adapter", "enumerator", "bluetooth device")):
            radios.append(entry)
        else:
            devices.append(entry)

    enabled = any(r["connected"] for r in radios) if radios else any(d["connected"] for d in devices)
    connected = [d for d in devices if d["connected"]]
    return {
        "present": True,
        "enabled": enabled,
        "adapters": radios,
        "devices": devices,
        "connectedCount": len(connected),
        "verified": True,
        "detail": (
            f"Bluetooth is {'on' if enabled else 'off'}; "
            f"{len(connected)} of {len(devices)} paired device(s) connected."
        ),
    }


def audio_devices() -> dict[str, Any]:
    """Playback and recording devices Windows currently has enabled."""
    raw = _powershell(
        "Get-PnpDevice -Class AudioEndpoint,Media -ErrorAction SilentlyContinue | "
        "Where-Object { $_.Status -eq 'OK' } | "
        "ForEach-Object { $_.Class + '|' + $_.FriendlyName }"
    )
    devices = []
    for line in raw.splitlines():
        if "|" not in line:
            continue
        kind, _, name = line.strip().partition("|")
        devices.append({"kind": kind.strip(), "name": name.strip()[:120]})
    return {
        "devices": devices,
        "count": len(devices),
        "verified": True,
        "detail": f"{len(devices)} audio device(s) enabled.",
    }
