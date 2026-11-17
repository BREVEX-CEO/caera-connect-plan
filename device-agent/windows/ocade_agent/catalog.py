"""The trusted MCP dictionary on this device (plan.md §6.4, P05).

It indexes capability *descriptions*, not running processes. Entries are the
four bundled workers (from `protocol.json`) plus external MCP servers the device
owner approved by placing a pinned manifest in `<agent home>/mcp/`. A directory
listing or a tool's own description never makes anything trusted.

States are kept apart on purpose:
  registered  a manifest file exists
  trusted     it validates, its id does not collide, its executable's (and file arguments') SHA-256 match the pins
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

from .gateway import PROTOCOL, WORKERS

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
        # A script an interpreter runs (`python server.py`) is pinned like the executable.
        "argSha256": {"type": "object", "maxProperties": 20,
                      "additionalProperties": {"type": "string", "pattern": "^[0-9a-f]{64}$"}},
        "platforms": {"type": "array", "items": {"enum": ["win32", "linux", "darwin"]}, "minItems": 1},
        "timeoutSeconds": {"type": "number", "minimum": 1, "maximum": 300},
        # Scanner findings the device owner reviewed and accepts for exactly these pinned files.
        "reviewedFindings": {"type": "array", "maxItems": 20, "items": {"type": "string", "maxLength": 40}},
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


# Resource bounds (plan v8 13.7, REPO-22): a manifest, and each tool's input schema, small and
# shallow enough that reading it, sending it to the planner and validating calls against it can
# never exhaust memory, the model's context or the validator's recursion.
MANIFEST_BYTES = 256 * 1024
SCHEMA_BYTES = 16 * 1024
SCHEMA_DEPTH = 8


def _depth(value, level: int = 0) -> int:
    if level > SCHEMA_DEPTH:
        return level
    children = value.values() if isinstance(value, dict) else value if isinstance(value, list) else ()
    return max((_depth(child, level + 1) for child in children), default=level)


# A static scan before an external server is trusted (plan 14A REPO-14): deterministic patterns
# over its tool descriptions, arguments and pinned script files. A finding quarantines the
# server until the owner reviews it (`reviewedFindings`); nothing here asks a model.
SCRIPT_BYTES = 1024 * 1024
_FINDINGS = {
    "embedded_secret": r"(?i)(?:api[_-]?key|secret|token|password)\s*[:=]\s*['\"][^'\"\s]{12,}"
                       r"|\bsk-[A-Za-z0-9_-]{20,}|\bAKIA[0-9A-Z]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "download_and_run": r"(?i)(?:curl|wget)[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b"
                        r"|(?:iwr|invoke-webrequest|downloadstring)[^\n]*\|\s*(?:iex|invoke-expression)"
                        r"|powershell[^\n]*\s-e(?:nc(?:odedcommand)?)?\s",
    "dynamic_code": r"(?:exec|eval)\s*\([^)\n]*(?:b64decode|base64|urlopen|requests\.get|atob|fromCharCode)",
    "hidden_destination": r"(?i)\b(?:https?|wss?)://(?:\d{1,3}\.){3}\d{1,3}\b",
    "prompt_injection": r"(?i)ignore (?:all |any )?(?:previous|prior|above) instructions|disregard (?:the|your) "
                        r"(?:rules|instructions)|you are now\b|reveal (?:the|your) system prompt"
                        r"|do not (?:tell|inform) the (?:user|person)",
}
_UNDERSTATED = r"(?i)\b(?:delet|remov|send|sends|sent|e-?mail|upload|post|publish|pay|purchas|transfer|overwrit)"


def scan(manifest: dict) -> list[str]:
    """What the static scan found in a manifest and its pinned scripts, as finding codes."""
    import re

    texts = [json.dumps(manifest.get("args", [])), manifest["command"]]
    texts += [tool["description"] for tool in manifest["tools"]]
    for arg in manifest.get("args", []):
        path = Path(arg)
        if path.is_file() and path.stat().st_size <= SCRIPT_BYTES:
            texts.append(path.read_bytes().decode("utf-8", errors="replace"))
    found = {code for code, pattern in _FINDINGS.items() if any(re.search(pattern, text) for text in texts)}
    # A tool that calls itself a read but describes changing or sending things.
    if any(tool["risk"] == "read" and re.search(_UNDERSTATED, tool["description"]) for tool in manifest["tools"]):
        found.add("risk_understated")
    return sorted(found)


_MANIFEST = jsonschema.Draft202012Validator(MANIFEST_SCHEMA)
_META = jsonschema.Draft202012Validator(jsonschema.Draft202012Validator.META_SCHEMA)


def _file_sha256(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def pins_hold(manifest: dict) -> bool:
    """The executable and every argument that names a file are byte-for-byte the approved ones."""
    pins = manifest.get("argSha256", {})
    files = [arg for arg in manifest.get("args", []) if Path(arg).is_file()]
    return (
        _file_sha256(Path(manifest["command"])) == manifest["sha256"]
        and set(pins) == set(files)
        and all(_file_sha256(Path(arg)) == pins[arg] for arg in files)
    )


def bundled() -> list[dict]:
    """The bundled roles, always trusted and installed with the companion."""
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
            if path.stat().st_size > MANIFEST_BYTES:
                raise ValueError("manifest_too_large")
            manifest = json.loads(path.read_text(encoding="utf-8"))
            _MANIFEST.validate(manifest)
            names = [tool["name"] for tool in manifest["tools"]]
            if len(set(names)) != len(names):
                raise ValueError("duplicate_tool")
            for tool in manifest["tools"]:
                if len(json.dumps(tool["inputSchema"])) > SCHEMA_BYTES:
                    raise ValueError("schema_too_large")
                if _depth(tool["inputSchema"]) > SCHEMA_DEPTH:
                    raise ValueError("schema_too_deep")
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
            else "pin_mismatch" if not pins_hold(manifest)
            else "trusted"
        )
        if manifest["state"] == "trusted":
            manifest["findings"] = [code for code in scan(manifest) if code not in manifest.get("reviewedFindings", [])]
            if manifest["findings"]:
                manifest["state"] = "quarantined"
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
