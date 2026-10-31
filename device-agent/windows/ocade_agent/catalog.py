"""The trusted MCP dictionary on this device (plan.md §6.4, P05).

It indexes capability *descriptions*, not running processes. Entries are the
four bundled workers (from `protocol.json`) plus external MCP servers the device
owner approved by placing a pinned manifest in `<agent home>/mcp/`. A directory
listing or a tool's own description never makes anything trusted.

States are kept apart on purpose:
  registered  a manifest file exists
  trusted     it validates, its id does not collide, its executable's SHA-256 matches the pin
  installed   the pinned executable exists on this machine
  available   it supports this platform
  active      its worker process is running (owned by the gateway)
  healthy     its live `tools/list` matched the manifest exactly at activation
  authorized  the person granted `mcp:<id>` for this device (decided by the server, per action)

A manifest never carries secrets; an external worker gets no workspace path and
no inherited environment beyond the SDK's minimal defaults.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import jsonschema

from .gateway import PROTOCOL, WORKERS, fingerprint

RISKS = ("read", "reversible_write", "external_effect")

MANIFEST_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["id", "publisher", "version", "license", "command", "sha256", "platforms", "tools"],
    "properties": {
        "id": {"type": "string", "pattern": "^[a-z][a-z0-9_]{1,30}$"},
        "publisher": {"type": "string", "maxLength": 120},
        "version": {"type": "string", "maxLength": 40},
        "license": {"type": "string", "maxLength": 60},
        "command": {"type": "string", "maxLength": 400},
        "args": {"type": "array", "items": {"type": "string", "maxLength": 400}, "maxItems": 20},
        "sha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
        "platforms": {"type": "array", "items": {"enum": ["win32", "linux", "darwin"]}, "minItems": 1},
        "timeoutSeconds": {"type": "number", "minimum": 1, "maximum": 300},
        "tools": {
            "type": "array",
            "minItems": 1,
            "maxItems": 64,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "risk", "description", "inputSchema"],
                "properties": {
                    "name": {"type": "string", "pattern": "^[A-Za-z][A-Za-z0-9_-]{0,63}$"},
                    "risk": {"enum": list(RISKS)},
                    "description": {"type": "string", "maxLength": 500},
                    "inputSchema": {"type": "object"},
                },
            },
        },
    },
}


_MANIFEST = jsonschema.Draft202012Validator(MANIFEST_SCHEMA)
_META = jsonschema.Draft202012Validator(jsonschema.Draft202012Validator.META_SCHEMA)


def _file_sha256(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def bundled() -> list[dict]:
    """The four bundled roles, always trusted and installed with the companion."""
    roles: dict[str, list] = {}
    for name, spec in PROTOCOL["operations"].items():
        roles.setdefault(spec["role"], []).append({"name": name, "risk": spec["risk"]})
    return [
        {"id": role, "module": WORKERS[role], "bundled": True, "tools": tools, "state": "trusted"}
        for role, tools in roles.items()
        if role in WORKERS
    ]


def load(home: Path) -> tuple[dict[str, dict], list[dict]]:
    """Approved external manifests by id, and the rejected ones with their reason."""
    reserved = {entry["id"] for entry in bundled()} | {"ocade", "mcp", "verify"}
    accepted: dict[str, dict] = {}
    rejected: list[dict] = []
    for path in sorted((home / "mcp").glob("*.json")) if (home / "mcp").is_dir() else []:
        try:
            manifest = json.loads(path.read_text(encoding="utf-8"))
            _MANIFEST.validate(manifest)
            names = [tool["name"] for tool in manifest["tools"]]
            if len(set(names)) != len(names):
                raise ValueError("duplicate_tool")
            for tool in manifest["tools"]:
                _META.validate(tool["inputSchema"])
            if manifest["id"] in reserved or manifest["id"] in accepted:
                raise ValueError("id_collision")
        except (OSError, ValueError, jsonschema.ValidationError, jsonschema.SchemaError) as error:
            reason = str(error) if isinstance(error, ValueError) and str(error).isidentifier() else "invalid_manifest"
            rejected.append({"file": path.name, "reason": reason})
            continue
        executable = Path(manifest["command"])
        manifest["state"] = (
            "unavailable_platform" if sys.platform not in manifest["platforms"]
            else "not_installed" if not executable.is_file()
            else "pin_mismatch" if _file_sha256(executable) != manifest["sha256"]
            else "trusted"
        )
        accepted[manifest["id"]] = manifest
    return accepted, rejected


def describe(external: dict[str, dict]) -> list[dict]:
    """What the device tells the server and the person: trusted external servers and their tools."""
    return [
        {
            "id": m["id"],
            "publisher": m["publisher"][:120],
            "version": m["version"],
            "tools": [
                {"name": t["name"], "risk": t["risk"], "description": t["description"][:200], "inputSchema": t["inputSchema"]}
                for t in m["tools"]
            ],
        }
        for m in external.values()
        if m["state"] == "trusted"
    ]
