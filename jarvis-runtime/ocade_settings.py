"""
Computer settings and a system snapshot, adapted from the donor's
actions/computer_settings.py and actions/system_monitor.py.

Settings: master volume, mute, screen brightness, dark appearance. Each goes
through the operating system's own interface (the audio endpoint, the monitor's
brightness method, the appearance setting), never through key presses: a
volume key moves by an unknown step and says nothing about where it ended.
A change answers with the value before and after, read back from the system,
so it can be verified and put back.

Status: processor, memory, disk, battery and uptime, read directly.

Not brought over from the donor: Wi-Fi on/off (it would cut the agent off from
OCADE mid-task and needs administrator rights), and the keyboard shortcuts for
tabs, zoom and windows, which the browser and window actions already do against
a known target.
"""
from __future__ import annotations

import platform
import re
import subprocess
import time
from pathlib import Path

SYSTEM = platform.system()
_HIDDEN = {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)}
NAMES = ("volume", "mute", "brightness", "dark_mode")
LABELS = {"volume": "Volume", "mute": "Mute", "brightness": "Brightness", "dark_mode": "Dark mode"}


def _out(command: list[str], timeout: int = 8) -> str:
    return subprocess.run(command, capture_output=True, text=True, timeout=timeout, **_HIDDEN).stdout.strip()


def _endpoint():
    """The default speakers' volume control (Windows)."""
    from pycaw.pycaw import AudioUtilities
    return AudioUtilities.GetSpeakers().EndpointVolume


def _percent(value) -> int:
    return max(0, min(100, int(round(float(value)))))


# -- reading: None where this computer will not say -----------------------------

def _read_volume() -> int | None:
    if SYSTEM == "Windows":
        return _percent(_endpoint().GetMasterVolumeLevelScalar() * 100)
    if SYSTEM == "Darwin":
        return _percent(_out(["osascript", "-e", "output volume of (get volume settings)"]))
    found = re.search(r"(\d+)%", _out(["pactl", "get-sink-volume", "@DEFAULT_SINK@"]))
    return _percent(found.group(1)) if found else None


def _read_mute() -> bool | None:
    if SYSTEM == "Windows":
        return bool(_endpoint().GetMute())
    if SYSTEM == "Darwin":
        return _out(["osascript", "-e", "output muted of (get volume settings)"]) == "true"
    return "yes" in _out(["pactl", "get-sink-mute", "@DEFAULT_SINK@"])


def _read_brightness() -> int | None:
    if SYSTEM == "Windows":
        return _percent(_out(["powershell", "-NoProfile", "-Command",
                              "(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness "
                              "-ErrorAction Stop | Select-Object -First 1).CurrentBrightness"]))
    if SYSTEM == "Linux":
        top = int(_out(["brightnessctl", "max"]))
        return _percent(int(_out(["brightnessctl", "get"])) * 100 / top) if top else None
    return None  # macOS offers no supported way to read it


_THEME = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize"


def _read_dark() -> bool | None:
    if SYSTEM == "Windows":
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _THEME) as key:
            return winreg.QueryValueEx(key, "AppsUseLightTheme")[0] == 0
    if SYSTEM == "Darwin":
        return _out(["osascript", "-e", 'tell app "System Events" to tell appearance preferences '
                                        "to get dark mode"]) == "true"
    return "dark" in _out(["gsettings", "get", "org.gnome.desktop.interface", "color-scheme"])


# -- changing -------------------------------------------------------------------

def _set_volume(value: int) -> None:
    if SYSTEM == "Windows":
        _endpoint().SetMasterVolumeLevelScalar(value / 100, None)
    elif SYSTEM == "Darwin":
        _out(["osascript", "-e", f"set volume output volume {value}"])
    else:
        _out(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{value}%"])


def _set_mute(on: bool) -> None:
    if SYSTEM == "Windows":
        _endpoint().SetMute(int(on), None)
    elif SYSTEM == "Darwin":
        _out(["osascript", "-e", f"set volume output muted {'true' if on else 'false'}"])
    else:
        _out(["pactl", "set-sink-mute", "@DEFAULT_SINK@", "1" if on else "0"])


def _set_brightness(value: int) -> None:
    if SYSTEM == "Windows":
        _out(["powershell", "-NoProfile", "-Command",
              "Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | "
              f"Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{{Timeout=1;Brightness={value}}}"])
    elif SYSTEM == "Linux":
        _out(["brightnessctl", "set", f"{value}%"])


def _set_dark(on: bool) -> None:
    if SYSTEM == "Windows":
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _THEME, 0, winreg.KEY_SET_VALUE) as key:
            for name in ("AppsUseLightTheme", "SystemUsesLightTheme"):
                winreg.SetValueEx(key, name, 0, winreg.REG_DWORD, 0 if on else 1)
    elif SYSTEM == "Darwin":
        _out(["osascript", "-e", 'tell app "System Events" to tell appearance preferences '
                                 f"to set dark mode to {'true' if on else 'false'}"])
    else:
        _out(["gsettings", "set", "org.gnome.desktop.interface", "color-scheme",
              "'prefer-dark'" if on else "'default'"])


_READ = {"volume": _read_volume, "mute": _read_mute, "brightness": _read_brightness, "dark_mode": _read_dark}
_SET = {"volume": _set_volume, "mute": _set_mute, "brightness": _set_brightness, "dark_mode": _set_dark}


def read(name: str):
    try:
        return _READ[name]()
    except Exception:  # no audio device, a desktop monitor, a missing tool
        return None


def _words(name: str, value) -> str:
    return ("on" if value else "off") if isinstance(value, bool) else f"{value}%"


def setting(name: str, value=None) -> dict:
    """Read one setting, or change it and report what the system now says."""
    if name not in NAMES:
        return {"status": "failed", "summary": "That setting is not one JARVIS can change"}
    label = LABELS[name]
    before = read(name)
    if before is None:
        return {"status": "failed", "summary": f"{label} cannot be read or changed on this computer"}
    if value is None:
        return {"status": "done", "summary": f"{label} is {_words(name, before)}", "setting": name, "value": before}
    if isinstance(before, bool) != isinstance(value, bool) or not isinstance(value, (bool, int, float)):
        return {"status": "failed", "summary": f"{label} is {'on or off' if isinstance(before, bool) else 'a number from 0 to 100'}"}
    wanted = value if isinstance(value, bool) else _percent(value)
    try:
        _SET[name](wanted)
    except Exception:
        return {"status": "failed", "summary": f"{label} could not be changed on this computer"}
    after = read(name)
    if after != wanted:  # said, not assumed: the system is asked what it did
        return {"status": "failed", "setting": name, "value": after,
                "summary": f"{label} did not change: it is {_words(name, after)}"}
    return {"status": "done", "setting": name, "before": before, "value": after,
            "summary": f"{label} changed from {_words(name, before)} to {_words(name, after)}"}


def status() -> dict:
    """Donor get_system_status, plus disk and battery."""
    import psutil
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage(Path.home().anchor or "/")
    up = int(time.time() - psutil.boot_time())
    battery = psutil.sensors_battery()
    facts = {
        "cpuPercent": round(psutil.cpu_percent(interval=0.3), 1),
        "memoryPercent": round(memory.percent, 1),
        "memoryUsedGb": round(memory.used / 1024 ** 3, 1),
        "memoryTotalGb": round(memory.total / 1024 ** 3, 1),
        "diskPercent": round(disk.percent, 1),
        "diskFreeGb": round(disk.free / 1024 ** 3, 1),
        "uptime": f"{up // 3600}h {up % 3600 // 60}m",
        "processes": len(psutil.pids()),
        "battery": None if battery is None else {"percent": round(battery.percent),
                                                 "charging": bool(battery.power_plugged)},
    }
    return {"status": "done", "system": facts,
            "summary": f"Processor {facts['cpuPercent']}%, memory {facts['memoryPercent']}%, "
                       f"disk {facts['diskPercent']}% full"}


if __name__ == "__main__":  # pragma: no cover - manual check
    print(status())
    for each in NAMES:
        print(setting(each))
