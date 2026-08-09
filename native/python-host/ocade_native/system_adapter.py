from __future__ import annotations

import os
import platform
import time
from typing import Any

import psutil


def read_system() -> dict[str, Any]:
    started = time.perf_counter()
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage(os.environ.get("SYSTEMDRIVE", "C:") + "\\")
    battery = psutil.sensors_battery()
    return {
        "platform": platform.platform(),
        "python": platform.python_version(),
        "logicalCpus": psutil.cpu_count(logical=True),
        "physicalCpus": psutil.cpu_count(logical=False),
        "cpuPercent": psutil.cpu_percent(interval=0.15),
        "memory": {
            "total": memory.total,
            "available": memory.available,
            "percent": memory.percent,
        },
        "disk": {"total": disk.total, "free": disk.free, "percent": disk.percent},
        "battery": None
        if battery is None
        else {
            "percent": battery.percent,
            "plugged": battery.power_plugged,
            "secondsLeft": battery.secsleft,
        },
        "processCount": len(psutil.pids()),
        "elapsedMs": round((time.perf_counter() - started) * 1_000, 2),
    }
