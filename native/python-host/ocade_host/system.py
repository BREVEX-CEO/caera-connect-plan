"""Machine facts and bounded system controls.

MEASURE BEFORE ADVISING
-----------------------
"Make my PC faster" is answered here with numbers, not with a cleanup routine.
This module reports what is actually consuming the machine — which processes,
how much memory, which disk is full — so the decision about what to do is made
from evidence. Nothing in here deletes a file, ends an unknown process, touches
antivirus or firewall, or restarts anything.

The one mutating control is volume, because it is instantly reversible and
inspectable. Anything that materially changes security, networking or system
configuration is deliberately absent rather than merely permission-gated: an
action that does not exist cannot be talked into existing by a model.
"""

from __future__ import annotations

import shutil
import time
from typing import Any

import psutil

from .protocol import Refusal, clamp_text

_TOP_PROCESSES = 12


def snapshot(_request=None) -> dict[str, Any]:
    """One reading of how this computer is doing right now."""
    memory = psutil.virtual_memory()
    started = time.monotonic()
    # A zero interval returns a meaningless 0.0 on the first call, so this pays
    # a short measured window rather than reporting a number that is not real.
    cpu = psutil.cpu_percent(interval=0.25)

    disks = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = shutil.disk_usage(part.mountpoint)
            disks.append(
                {
                    "mount": part.mountpoint,
                    "totalBytes": usage.total,
                    "freeBytes": usage.free,
                    "usedPercent": round(usage.used / usage.total * 100, 1) if usage.total else None,
                }
            )
        except Exception:
            continue

    battery = None
    try:
        power = psutil.sensors_battery()
        if power is not None:
            battery = {
                "percent": round(power.percent, 1),
                "pluggedIn": bool(power.power_plugged),
                "secondsLeft": None if power.secsleft in (-1, -2) else power.secsleft,
            }
    except Exception:
        pass

    return {
        "cpuPercent": cpu,
        "cpuCount": psutil.cpu_count(logical=True),
        "memory": {
            "totalBytes": memory.total,
            "availableBytes": memory.available,
            "usedPercent": memory.percent,
        },
        "disks": disks,
        "battery": battery,
        "bootTime": psutil.boot_time(),
        "elapsedMs": int((time.monotonic() - started) * 1000),
    }


def top_processes(request=None) -> dict[str, Any]:
    """The processes actually costing this machine something."""
    payload = getattr(request, "payload", {}) or {}
    order = payload.get("by", "memory")
    rows: list[dict[str, Any]] = []
    for proc in psutil.process_iter(["pid", "name", "memory_info", "cpu_percent"]):
        try:
            info = proc.info
            rows.append(
                {
                    "pid": info["pid"],
                    "name": clamp_text(info["name"] or "", 128),
                    "memoryBytes": info["memory_info"].rss if info["memory_info"] else 0,
                    "cpuPercent": info["cpu_percent"] or 0.0,
                }
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    key = "cpuPercent" if order == "cpu" else "memoryBytes"
    rows.sort(key=lambda row: row[key], reverse=True)
    return {"orderedBy": key, "processes": rows[:_TOP_PROCESSES], "total": len(rows)}


def installed_applications(_request=None) -> dict[str, Any]:
    """Applications this machine actually has, from the registry.

    Read-only, and from the uninstall registry rather than by walking Program
    Files, because the registry carries publisher and version — the two facts
    capability discovery needs in order to fingerprint an application and know
    when a learned Skill Pack has gone stale.
    """
    import winreg  # noqa: PLC0415

    roots = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ]
    seen: dict[str, dict[str, Any]] = {}
    for hive, path in roots:
        try:
            with winreg.OpenKey(hive, path) as key:
                for index in range(winreg.QueryInfoKey(key)[0]):
                    try:
                        name = winreg.EnumKey(key, index)
                        with winreg.OpenKey(key, name) as entry:
                            display = _read(entry, "DisplayName")
                            if not display:
                                continue
                            seen[display] = {
                                "name": clamp_text(display, 200),
                                "version": clamp_text(_read(entry, "DisplayVersion") or "", 64),
                                "publisher": clamp_text(_read(entry, "Publisher") or "", 200),
                                "installLocation": clamp_text(
                                    _read(entry, "InstallLocation") or "", 400
                                ),
                            }
                    except OSError:
                        continue
        except OSError:
            continue
    applications = sorted(seen.values(), key=lambda row: row["name"].lower())
    return {"applications": applications[:400], "count": len(applications)}


def _read(key, name: str) -> str | None:
    import winreg  # noqa: PLC0415

    try:
        value, _ = winreg.QueryValueEx(key, name)
        return str(value) if value else None
    except OSError:
        return None


def set_volume(request) -> dict[str, Any]:
    """Adjust system volume. Reversible, and reported back as a real reading."""
    from ctypes import POINTER, cast  # noqa: PLC0415

    try:
        from comtypes import CLSCTX_ALL  # noqa: PLC0415
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume  # noqa: PLC0415
    except ImportError:
        raise Refusal(
            "Volume control needs the audio component, which is not installed on this device.",
            "unsupported",
        ) from None

    level = request.payload.get("level")
    if not isinstance(level, (int, float)) or not 0 <= float(level) <= 100:
        raise Refusal("Volume must be a number between 0 and 100.", "unsupported")

    devices = AudioUtilities.GetSpeakers()
    interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    volume = cast(interface, POINTER(IAudioEndpointVolume))
    volume.SetMasterVolumeLevelScalar(float(level) / 100.0, None)
    actual = round(volume.GetMasterVolumeLevelScalar() * 100)
    return {"requested": level, "actual": actual, "verified": abs(actual - float(level)) <= 2}
