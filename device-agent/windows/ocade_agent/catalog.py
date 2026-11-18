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
import tempfile
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


# ---------------------------------------------------------------------------------------------
# STAGED UPDATES (plan REPO-25, threat O-16). A new version of an approved server is placed in
# `<home>/mcp/staged/<id>.json`. It is promoted only after it validates, its pins hold, the scan is
# clean, it starts and lists exactly the tools it declares, and any added tool or raised risk was
# accepted by the person; the active version is kept in `<home>/mcp/previous/` for rollback, and
# every promotion and rollback is appended to `<home>/mcp/updates.jsonl` with who authorized it.
# The companion reads its servers when it starts, so a promotion never changes a running task.
# ---------------------------------------------------------------------------------------------
_RISK = {"read": 0, "reversible_write": 1, "external_effect": 2}


def permission_changes(active: dict, staged: dict) -> list[str]:
    """What the new version may do that the approved one could not: new tools, higher risks, a new program."""
    before = {tool["name"]: tool for tool in active["tools"]}
    changes = []
    for tool in staged["tools"]:
        old = before.get(tool["name"])
        if old is None:
            changes.append(f"new_tool:{tool['name']}")
        elif _RISK.get(tool["risk"], 3) > _RISK.get(old["risk"], 3):
            changes.append(f"risk_raised:{tool['name']}")
    if staged["command"] != active["command"] or staged.get("args", []) != active.get("args", []):
        changes.append("program_changed")
    return changes


async def health(manifest: dict) -> str | None:
    """Start the server and require its live tool list to be exactly the declared one."""
    from .gateway import Gateway

    async with Gateway(tempfile.mkdtemp(), external={manifest["id"]: manifest}) as gateway:
        try:
            await gateway._session(f"mcp:{manifest['id']}")
        except Exception as error:  # the reason is the gateway's own words, bounded
            return str(error)[:300] or type(error).__name__
    return None


def _log(home: Path, entry: dict) -> None:
    import datetime

    entry = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")} | entry
    with (home / "mcp" / "updates.jsonl").open("a", encoding="utf-8") as log:
        log.write(json.dumps(entry, sort_keys=True) + "\n")


def _active_file(home: Path, server: str) -> Path | None:
    for path in sorted((home / "mcp").glob("*.json")):
        try:
            if json.loads(path.read_text(encoding="utf-8")).get("id") == server:
                return path
        except (OSError, ValueError):
            continue
    return None


def promote(home: Path, server: str, approved_by: str, accept_changes: bool = False) -> dict:
    """Promote the staged version of `server`, or refuse with the reason; the active one is kept."""
    import anyio

    staged_path = home / "mcp" / "staged" / f"{server}.json"
    active_path = _active_file(home, server)
    if not staged_path.is_file() or active_path is None:
        return {"promoted": False, "reason": "nothing_staged" if active_path else "not_installed"}
    with tempfile.TemporaryDirectory(prefix="ocade-mcp-staged-") as folder:
        probe = Path(folder)
        (probe / "mcp").mkdir()
        (probe / "mcp" / "staged.json").write_bytes(staged_path.read_bytes())
        found, refused = load(probe)
    staged = found.get(server)
    if staged is None:
        return {"promoted": False, "reason": (refused[0]["reason"] if refused else "id_changed")}
    if staged["state"] != "trusted":
        return {"promoted": False, "reason": staged["state"], "findings": staged.get("findings", [])}
    active = json.loads(active_path.read_text(encoding="utf-8"))
    changes = permission_changes(active, staged)
    if changes and not accept_changes:
        return {"promoted": False, "reason": "permission_changes_need_approval", "changes": changes}
    problem = anyio.run(health, staged)
    if problem:
        return {"promoted": False, "reason": "health_check_failed", "detail": problem}
    previous = home / "mcp" / "previous"
    previous.mkdir(exist_ok=True)
    (previous / f"{server}.json").write_bytes(active_path.read_bytes())
    staged_path.replace(active_path)
    _log(home, {"action": "promote", "server": server, "from": active["version"], "to": staged["version"],
                "changes": changes, "approvedBy": approved_by[:120]})
    return {"promoted": True, "from": active["version"], "to": staged["version"], "changes": changes}


def rollback(home: Path, server: str, approved_by: str) -> dict:
    """Restore the version that was active before the last promotion."""
    previous = home / "mcp" / "previous" / f"{server}.json"
    active_path = _active_file(home, server)
    if not previous.is_file() or active_path is None:
        return {"rolledBack": False, "reason": "no_previous_version"}
    current = json.loads(active_path.read_text(encoding="utf-8"))["version"]
    restored = json.loads(previous.read_text(encoding="utf-8"))["version"]
    previous.replace(active_path)
    _log(home, {"action": "rollback", "server": server, "from": current, "to": restored,
                "approvedBy": approved_by[:120]})
    return {"rolledBack": True, "from": current, "to": restored}


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
