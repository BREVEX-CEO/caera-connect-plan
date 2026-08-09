from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import winreg
from functools import lru_cache
from pathlib import Path
from typing import Any

import psutil
import pywintypes
import win32api
import win32gui
import win32process

MAX_APPLICATIONS = 250
MAX_CONTROLS = 200
APP_ID_PATTERN = re.compile(r"^winapp:[0-9a-f]{64}$")

_APPLICATIONS: dict[str, dict[str, Any]] = {}


def _clean_text(value: object, limit: int = 500) -> str:
    return str(value or "").replace("\r", " ").replace("\n", " ").strip()[:limit]


def _canonical_path(value: str) -> str | None:
    raw = os.path.expandvars(value.strip().strip('"'))
    if not raw:
        return None
    try:
        path = Path(raw).resolve(strict=False)
    except OSError:
        return None
    if path.suffix.lower() not in {".exe", ".com"} or not path.is_file():
        return None
    return str(path)


def executable_from_display_icon(value: str) -> str | None:
    """Extract an executable from an uninstall DisplayIcon without executing it."""
    text = os.path.expandvars(value.strip())
    if not text:
        return None
    if text.startswith('"'):
        end = text.find('"', 1)
        candidate = text[1:end] if end > 1 else text.strip('"')
    else:
        candidate = text.rsplit(",", 1)[0]
    return _canonical_path(candidate)


def application_id(executable: str) -> str:
    normalized = os.path.normcase(os.path.abspath(executable)).encode("utf-8")
    return f"winapp:{hashlib.sha256(normalized).hexdigest()}"


def _read_value(key: Any, name: str) -> str:
    try:
        return _clean_text(winreg.QueryValueEx(key, name)[0])
    except OSError:
        return ""


def _registry_applications() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    roots = [winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE]
    uninstall_paths = [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ]
    views = [winreg.KEY_WOW64_64KEY, winreg.KEY_WOW64_32KEY]
    for root in roots:
        for base in uninstall_paths:
            for view in views:
                try:
                    parent = winreg.OpenKey(root, base, 0, winreg.KEY_READ | view)
                except OSError:
                    continue
                with parent:
                    for index in range(winreg.QueryInfoKey(parent)[0]):
                        try:
                            name = winreg.EnumKey(parent, index)
                            child = winreg.OpenKey(parent, name, 0, winreg.KEY_READ | view)
                        except OSError:
                            continue
                        with child:
                            display_name = _read_value(child, "DisplayName")
                            if not display_name:
                                continue
                            executable = executable_from_display_icon(
                                _read_value(child, "DisplayIcon")
                            )
                            if executable is None:
                                install = _read_value(child, "InstallLocation")
                                if install:
                                    expected = Path(install) / f"{display_name}.exe"
                                    executable = _canonical_path(str(expected))
                            if executable is None:
                                continue
                            records.append(
                                {
                                    "appId": application_id(executable),
                                    "displayName": display_name,
                                    "executable": executable,
                                    "publisher": _read_value(child, "Publisher"),
                                    "version": _read_value(child, "DisplayVersion"),
                                    "source": "windows.uninstall_registry",
                                }
                            )
    return records


def _app_paths() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    base = r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths"
    for root in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        for view in (winreg.KEY_WOW64_64KEY, winreg.KEY_WOW64_32KEY):
            try:
                parent = winreg.OpenKey(root, base, 0, winreg.KEY_READ | view)
            except OSError:
                continue
            with parent:
                for index in range(winreg.QueryInfoKey(parent)[0]):
                    try:
                        key_name = winreg.EnumKey(parent, index)
                        child = winreg.OpenKey(parent, key_name, 0, winreg.KEY_READ | view)
                    except OSError:
                        continue
                    with child:
                        executable = _canonical_path(_read_value(child, ""))
                        if executable is None:
                            continue
                        records.append(
                            {
                                "appId": application_id(executable),
                                "displayName": Path(executable).stem,
                                "executable": executable,
                                "publisher": "",
                                "version": "",
                                "source": "windows.app_paths",
                            }
                        )
    return records


def _running_applications() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    visible_process_ids: set[int] = set()

    def collect_visible(handle: int, _: object) -> bool:
        try:
            if win32gui.IsWindowVisible(handle) and win32gui.GetWindowText(handle).strip():
                _, pid = win32process.GetWindowThreadProcessId(handle)
                visible_process_ids.add(int(pid))
        except (OSError, pywintypes.error):
            pass
        return True

    win32gui.EnumWindows(collect_visible, None)
    for process in psutil.process_iter(["pid", "name", "exe"]):
        try:
            if int(process.info["pid"]) not in visible_process_ids:
                continue
            executable = _canonical_path(str(process.info.get("exe") or ""))
        except (psutil.AccessDenied, psutil.NoSuchProcess, OSError):
            continue
        if executable is None:
            continue
        records.append(
            {
                "appId": application_id(executable),
                "displayName": _clean_text(process.info.get("name") or Path(executable).stem),
                "executable": executable,
                "publisher": "",
                "version": "",
                "source": "running_process",
                "processIds": [int(process.info["pid"])],
            }
        )
    return records


def _file_version(executable: str) -> dict[str, str]:
    result = {"product": "", "publisher": "", "version": ""}
    try:
        info = win32api.GetFileVersionInfo(executable, "\\")
        ms = int(info["FileVersionMS"])
        ls = int(info["FileVersionLS"])
        result["version"] = f"{ms >> 16}.{ms & 0xFFFF}.{ls >> 16}.{ls & 0xFFFF}"
        translations = win32api.GetFileVersionInfo(executable, r"\VarFileInfo\Translation")
        if translations:
            language, codepage = translations[0]
            prefix = f"\\StringFileInfo\\{language:04X}{codepage:04X}\\"
            result["product"] = _clean_text(
                win32api.GetFileVersionInfo(executable, prefix + "ProductName")
            )
            result["publisher"] = _clean_text(
                win32api.GetFileVersionInfo(executable, prefix + "CompanyName")
            )
    except (OSError, pywintypes.error, KeyError, TypeError, IndexError):
        pass
    return result


def discover_applications(limit: int = 100) -> list[dict[str, Any]]:
    bounded_limit = max(1, min(limit, MAX_APPLICATIONS))
    merged: dict[str, dict[str, Any]] = {}
    for record in [*_registry_applications(), *_app_paths(), *_running_applications()]:
        app_id = str(record["appId"])
        current = merged.get(app_id)
        if current is None:
            current = {
                **record,
                "processIds": list(record.get("processIds", [])),
                "sources": [record["source"]],
            }
            merged[app_id] = current
            continue
        for field in ("displayName", "publisher", "version"):
            if not current.get(field) and record.get(field):
                current[field] = record[field]
        current["processIds"] = sorted(
            {int(pid) for pid in [*current.get("processIds", []), *record.get("processIds", [])]}
        )
        current["sources"] = sorted({*current["sources"], record["source"]})
    records = sorted(
        merged.values(),
        key=lambda item: (not bool(item.get("processIds")), str(item["displayName"]).lower()),
    )[:bounded_limit]
    _APPLICATIONS.clear()
    for record in records:
        version = _file_version(str(record["executable"]))
        record["displayName"] = record.get("displayName") or version["product"] or Path(
            str(record["executable"])
        ).stem
        record["publisher"] = record.get("publisher") or version["publisher"]
        record["version"] = record.get("version") or version["version"]
        record["running"] = bool(record.get("processIds"))
        record["signature"] = "not_checked"
        _APPLICATIONS[str(record["appId"])] = record
    return [dict(record) for record in records]


@lru_cache(maxsize=250)
def _signature(executable: str) -> dict[str, str]:
    script = (
        "$s=Get-AuthenticodeSignature -LiteralPath $args[0];"
        "$o=[ordered]@{status=[string]$s.Status;signer='';message=[string]$s.StatusMessage};"
        "if($s.SignerCertificate){$o.signer=[string]$s.SignerCertificate.Subject};"
        "$o|ConvertTo-Json -Compress"
    )
    try:
        completed = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script, executable],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        if completed.returncode != 0:
            return {"status": "unknown", "signer": "", "message": "Signature probe failed."}
        raw = json.loads(completed.stdout)
        status = str(raw.get("status", "Unknown"))
        normalized = {
            "Valid": "valid",
            "NotSigned": "unsigned",
            "HashMismatch": "invalid",
            "NotTrusted": "invalid",
        }.get(status, "unknown")
        return {
            "status": normalized,
            "signer": _clean_text(raw.get("signer")),
            "message": _clean_text(raw.get("message")),
        }
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError):
        return {"status": "unknown", "signer": "", "message": "Signature probe unavailable."}


def _windows(process_ids: set[int]) -> list[dict[str, Any]]:
    windows: list[dict[str, Any]] = []

    def collect_window(handle: int, _: object) -> bool:
        try:
            _, pid = win32process.GetWindowThreadProcessId(handle)
            if (
                int(pid) not in process_ids
                or not win32gui.IsWindowVisible(handle)
                or not win32gui.GetWindowText(handle).strip()
            ):
                return True
            controls: list[dict[str, Any]] = []

            def add_control(control_handle: int, _: object) -> bool:
                if len(controls) >= MAX_CONTROLS:
                    return False
                try:
                    rectangle = win32gui.GetWindowRect(control_handle)
                    controls.append(
                        {
                            "type": _clean_text(win32gui.GetClassName(control_handle), 80),
                            "name": _clean_text(win32gui.GetWindowText(control_handle)),
                            "automationId": "",
                            "patterns": [],
                            "rectangle": list(rectangle),
                        }
                    )
                except (OSError, pywintypes.error):
                    pass
                return True

            add_control(handle, None)
            win32gui.EnumChildWindows(handle, add_control, None)
            windows.append(
                {
                    "handle": int(handle),
                    "processId": int(pid),
                    "title": _clean_text(win32gui.GetWindowText(handle), 300),
                    "controls": controls,
                }
            )
        except (OSError, pywintypes.error):
            pass
        return True

    win32gui.EnumWindows(collect_window, None)
    return windows


def _supported_types(executable: str) -> list[str]:
    key_path = rf"Applications\{Path(executable).name}\SupportedTypes"
    try:
        key = winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, key_path, 0, winreg.KEY_READ)
    except OSError:
        return []
    values: list[str] = []
    with key:
        for index in range(winreg.QueryInfoKey(key)[1]):
            try:
                name, _, _ = winreg.EnumValue(key, index)
            except OSError:
                continue
            if name.startswith(".") and len(name) <= 32:
                values.append(name.lower())
    return sorted(set(values))[:100]


def _plugin_markers(executable: str) -> list[str]:
    directory = Path(executable).parent
    markers: list[str] = []
    try:
        for child in directory.iterdir():
            lower = child.name.lower()
            is_plugin_directory = child.is_dir() and lower in {
                "plugins",
                "plug-ins",
                "extensions",
                "scripts",
                "addons",
            }
            is_type_library = child.is_file() and child.suffix.lower() in {".tlb", ".olb"}
            if is_plugin_directory or is_type_library:
                markers.append(child.name)
    except OSError:
        pass
    return sorted(markers)[:50]


def inspect_application(app_id: str) -> dict[str, Any]:
    if not APP_ID_PATTERN.fullmatch(app_id):
        raise ValueError("application id is malformed")
    record = _APPLICATIONS.get(app_id)
    if record is None:
        raise ValueError("application id was not returned by the current discovery session")
    executable = str(record["executable"])
    process_ids = {int(pid) for pid in record.get("processIds", [])}
    windows = _windows(process_ids)
    patterns = sorted(
        {
            pattern
            for window in windows
            for control in window["controls"]
            for pattern in control["patterns"]
        }
    )
    file_types = _supported_types(executable)
    plugin_markers = _plugin_markers(executable)
    signature = _signature(executable)
    routes: list[dict[str, Any]] = []
    if windows:
        routes.append(
            {
                "route": "native",
                "interfaceId": "windows.win32.window",
                "confidence": 0.82,
                "evidence": (
                    f"Observed {len(windows)} visible window(s) for the exact process identity."
                ),
            }
        )
    if patterns:
        routes.append(
            {
                "route": "accessibility",
                "interfaceId": "windows.uia",
                "confidence": 0.9,
                "evidence": f"Observed UIA patterns: {', '.join(patterns)}.",
            }
        )
    if file_types:
        routes.append(
            {
                "route": "file",
                "interfaceId": "windows.registered_file_types",
                "confidence": 0.75,
                "evidence": f"Windows registered {len(file_types)} supported file type(s).",
            }
        )
    if plugin_markers:
        routes.append(
            {
                "route": "plugin",
                "interfaceId": "install.plugin_markers",
                "confidence": 0.5,
                "evidence": (
                    "Plug-in or scripting markers exist but require capability-specific probing."
                ),
            }
        )
    return {
        **record,
        "signature": signature,
        "windows": windows,
        "uiaPatterns": patterns,
        "supportedFileTypes": file_types,
        "pluginMarkers": plugin_markers,
        "interfaces": routes,
        "limitations": [
            (
                "CLI, COM, WinRT, plug-in and scripting candidates are not executable until a "
                "capability-specific safe probe verifies them."
            ),
            (
                "Discovery grants no mutation authority; every action still requires an exact "
                "signed scope."
            ),
        ],
    }


def resolve_discovered_executable(app_id: str) -> str | None:
    record = _APPLICATIONS.get(app_id)
    if record is None:
        return None
    return _canonical_path(str(record["executable"]))
