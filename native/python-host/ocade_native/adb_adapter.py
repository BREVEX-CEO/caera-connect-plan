from __future__ import annotations

import socket
from typing import Any

from adb_shell.adb_device import AdbDeviceTcp


def probe_loopback_ports() -> dict[str, Any]:
    """Developer-only ADB probe. Never pairs, authorizes, unlocks, or mutates a device."""
    devices: list[dict[str, Any]] = []
    for port in (5037, 5555):
        connection = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        connection.settimeout(0.15)
        try:
            reachable = connection.connect_ex(("127.0.0.1", port)) == 0
        finally:
            connection.close()
        devices.append({"host": "127.0.0.1", "port": port, "reachable": reachable})
    return {
        "transportClass": AdbDeviceTcp.__name__,
        "probes": devices,
        "authorizedDeviceProven": False,
        "reason": (
            "No pairing, authentication or device mutation is performed by a discovery probe."
        ),
    }
