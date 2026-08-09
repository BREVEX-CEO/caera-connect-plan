from __future__ import annotations

from ocade_native.adb_adapter import probe_loopback_ports
from ocade_native.system_adapter import read_system
from ocade_native.windows_adapter import virtual_screen


def test_psutil_reads_real_machine() -> None:
    result = read_system()
    assert result["logicalCpus"] >= 1
    assert result["memory"]["total"] > 0
    assert result["disk"]["total"] > 0


def test_virtual_desktop_is_nonempty() -> None:
    screen = virtual_screen()
    assert screen["width"] > 0
    assert screen["height"] > 0


def test_adb_probe_is_read_only_and_honest() -> None:
    result = probe_loopback_ports()
    assert result["transportClass"] == "AdbDeviceTcp"
    assert result["authorizedDeviceProven"] is False
