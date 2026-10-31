"""The trusted MCP gateway (plan.md §6, §23.4, P05/P06).

The only code that starts capability workers or calls their tools:

- Workers are pinned bundled modules, started lazily with a sanitized
  environment through the official MCP SDK's stdio transport; stdout is protocol
  only. Nothing is downloaded, installed or discovered at run time.
- After the handshake the worker's `tools/list` must match the signed-in
  protocol exactly — same names, same argument fields — or the worker is
  refused. Tool descriptions are never shown to a model or obeyed.
- Every call is checked against the protocol (operation, capability, risk,
  arguments, deadline) and the local STOP epoch immediately before dispatch.
- A transport failure does not prove an action failed: a write whose worker
  died, timed out or was stopped mid-call is reported `unknown`, `maybeChanged`.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import anyio
import jsonschema
from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, get_default_environment, stdio_client

PROTOCOL = json.loads((Path(__file__).parent / "protocol.json").read_text(encoding="utf-8"))
WORKERS = {
    "fs_sandbox": "ocade_agent.office_worker",
    "sys_core": "ocade_agent.office_worker",
    "verifier": "ocade_agent.verify_worker",
    "ui_bridge": "ocade_agent.windows_worker",
    "web_automation": "ocade_agent.web_worker",
    "media_engine": "ocade_agent.media_worker",
}
MAX_CALL_SECONDS = 300
# Network and browser settings the device owner chose; never account credentials or tokens.
PASS_THROUGH = (
    "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "DISPLAY", "XAUTHORITY", "OCADE_BROWSER_EXECUTABLE", "OCADE_ALLOW_PRIVATE_WEB",
)


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def receipt(status: str, maybe_changed: bool, evidence: dict | None = None, error: str | None = None) -> dict:
    out = {"status": status, "maybeChanged": maybe_changed, "observedAtUtc": now_utc(), "evidence": evidence or {}}
    if error:
        out["errorCode"] = error
    return out


class WorkerRejected(Exception):
    pass


class Gateway:
    """Use as `async with Gateway(workspace) as gateway:`; workers end when the block does.

    Each worker's transport and session live in their own holder task, so they are
    entered and exited in one task even though calls come from many. Bundled
    workers are keyed by module; approved external MCP servers (see `catalog.py`)
    by `mcp:<id>`, started lazily, at most `max_external` at once.
    """

    def __init__(
        self,
        workspace: str,
        worker_modules: dict[str, str] | None = None,
        extra_path: str = "",
        home: str = "",
        external: dict[str, dict] | None = None,
        max_external: int = 4,
    ):
        self.workspace = workspace
        self.home = home
        self.modules = worker_modules or WORKERS
        self.extra_path = extra_path
        self.external = external or {}
        self.max_external = max_external
        self.epoch = 0
        self._workers: dict[str, dict] = {}

    async def __aenter__(self) -> "Gateway":
        self._group = await anyio.create_task_group().__aenter__()
        return self

    async def __aexit__(self, *exc) -> bool | None:
        for key in list(self._workers):
            await self._discard(key)
        return await self._group.__aexit__(*exc)

    def stop(self) -> None:
        """Local STOP: nothing dispatched under an older epoch may start."""
        self.epoch += 1

    async def _discard(self, key: str) -> None:
        """End a worker, even one still starting; the SDK's shielded shutdown kills its process tree."""
        worker = self._workers.pop(key, None)
        if worker:
            worker["scope"].cancel()
            with anyio.CancelScope(shield=True):
                await worker["closed"].wait()

    def _parameters(self, key: str) -> StdioServerParameters:
        if key.startswith("mcp:"):
            manifest = self.external[key[4:]]
            # Re-checked at every start: a replaced executable is not the approved one.
            if hashlib.sha256(Path(manifest["command"]).read_bytes()).hexdigest() != manifest["sha256"]:
                raise WorkerRejected("pin_mismatch")
            # No workspace, no inherited secrets: only the SDK's minimal environment.
            return StdioServerParameters(
                command=manifest["command"], args=manifest.get("args", []), env=get_default_environment()
            )
        package_root = str(Path(__file__).resolve().parent.parent)
        python_path = os.pathsep.join(p for p in (package_root, self.extra_path) if p)
        environment = get_default_environment() | {
            "PYTHONPATH": python_path,
            "OCADE_WORKSPACE": self.workspace,
            "OCADE_AGENT_HOME": self.home,
        } | {name: os.environ[name] for name in PASS_THROUGH if name in os.environ}
        # A packaged companion is one executable that runs its own workers
        # (the console build: a windowed executable has no stdout for the MCP protocol).
        if getattr(sys, "frozen", False):
            # The packaged agent accepts a MODULE name, not a capability role.
            # Both fs_sandbox and sys_core legitimately share office_worker.
            command = [str(Path(sys.executable).with_name("ocade-agent.exe")), "worker", self.modules[key]]
        else:
            command = [sys.executable, "-s", "-m", key]
        return StdioServerParameters(command=command[0], args=command[1:], env=environment, cwd=package_root)

    async def _hold(self, key: str, worker: dict) -> None:
        try:
            parameters = self._parameters(key)
            with worker["scope"]:
                async with stdio_client(parameters, errlog=sys.stderr) as (read, write):
                    async with ClientSession(read, write, read_timeout_seconds=30) as session:
                        await session.initialize()
                        listed = await session.list_tools()
                        problem = self._tool_problem(key, {tool.name: tool.input_schema for tool in listed.tools})
                        if problem:
                            worker["error"] = WorkerRejected(problem)
                            return
                        worker["session"] = session
                        worker["started"].set()
                        await anyio.sleep_forever()
        except Exception as error:
            worker.setdefault("error", error)
        finally:
            worker["closed"].set()
            worker["started"].set()

    async def _session(self, key: str) -> ClientSession:
        worker = self._workers.get(key)
        if worker is None:
            if key.startswith("mcp:"):
                active = [k for k in self._workers if k.startswith("mcp:")]
                if len(active) >= self.max_external:
                    await self._discard(active[0])  # least recently started
            # Registered before it starts, so STOP or shutdown can always end it.
            worker = {"scope": anyio.CancelScope(), "started": anyio.Event(), "closed": anyio.Event()}
            self._workers[key] = worker
            self._group.start_soon(self._hold, key, worker)
        await worker["started"].wait()
        if "session" not in worker:
            await self._discard(key)
            raise worker.get("error") or RuntimeError("worker ended during start-up")
        return worker["session"]

    def _tool_problem(self, key: str, tools: dict[str, dict]) -> str | None:
        """The live tool list must be exactly what was approved: names and argument schemas."""
        if key.startswith("mcp:"):
            approved = {t["name"]: t["inputSchema"] for t in self.external[key[4:]]["tools"]}
            if set(tools) != set(approved):
                return f"{key} offers {sorted(tools)}, approved {sorted(approved)}"
            drifted = [n for n in approved if fingerprint(tools[n]) != fingerprint(approved[n])]
            return f"{key} schemas drifted: {drifted}" if drifted else None
        expected = {
            name.replace(".", "_"): spec
            for name, spec in PROTOCOL["operations"].items()
            if self.modules.get(spec["role"]) == key
        }
        if set(tools) != set(expected):
            return f"{key} offers {sorted(tools)}, expected {sorted(expected)}"
        for name, spec in expected.items():
            if set(tools[name].get("properties", {})) != set(spec["arguments"].get("properties", {})):
                return f"{key}.{name} arguments drifted from the protocol"
        return None

    def _target(self, intent: dict, spec: dict) -> tuple[str, str, dict] | str:
        """(worker key, tool name, arguments) for an intent, or a refusal code."""
        if spec["role"] != "mcp":
            return self.modules[spec["role"]], intent["operation"].replace(".", "_"), intent["arguments"]
        arguments = intent["arguments"]
        manifest = self.external.get(arguments["server"])
        if manifest is None or manifest.get("state") != "trusted":
            return "server_not_trusted"
        tool = next((t for t in manifest["tools"] if t["name"] == arguments["tool"]), None)
        if tool is None:
            return "unknown_tool"
        if tool["risk"] != spec["risk"]:
            return "risk_mismatch"  # a write can never ride on a read operation
        try:
            validator(fingerprint(tool["inputSchema"]), tool["inputSchema"]).validate(arguments["arguments"])
        except jsonschema.ValidationError:
            return "invalid_intent"
        return f"mcp:{manifest['id']}", tool["name"], arguments["arguments"]

    async def run(self, intent: dict, epoch: int) -> dict:
        """Dispatch one validated intent and return an honest, timed receipt."""
        started = time.monotonic()

        def timed(status: str, maybe_changed: bool, evidence: dict | None = None, error: str | None = None) -> dict:
            # Monotonic measurement covers preflight, worker startup and execution.
            # Per-action timing is factual evidence, not a full task timer.
            facts = dict(evidence or {})
            facts["durationMs"] = round(max(0.0, (time.monotonic() - started) * 1000), 2)
            return receipt(status, maybe_changed, facts, error)

        if epoch != self.epoch:
            return timed("not_applied", False, error="stopped")
        spec = PROTOCOL["operations"].get(intent.get("operation"))
        if (
            spec is None
            or intent.get("v") != PROTOCOL["version"]
            or intent.get("capability") != spec["capability"]
            or intent.get("risk") != spec["risk"]
        ):
            return timed("not_applied", False, error="invalid_intent")
        try:
            validator(intent["operation"], spec["arguments"]).validate(intent.get("arguments"))
            deadline = datetime.fromisoformat(intent["deadlineUtc"].replace("Z", "+00:00"))
        except (jsonschema.ValidationError, KeyError, ValueError):
            return timed("not_applied", False, error="invalid_intent")
        remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
        if remaining <= 0:
            return timed("not_applied", False, error="deadline_passed")
        target = self._target(intent, spec)
        if isinstance(target, str):
            return timed("not_applied", False, error=target)
        key, tool, arguments = target

        writes = spec["risk"] != "read"
        try:
            session = await self._session(key)
        except anyio.get_cancelled_exc_class():
            await self._discard(key)
            raise
        except WorkerRejected:
            return timed("not_applied", False, error="worker_rejected")
        except Exception:
            return timed("not_applied", False, error="worker_unavailable")
        if epoch != self.epoch:  # STOP during worker start-up
            return timed("not_applied", False, error="stopped")
        limit = (self.external[key[4:]].get("timeoutSeconds", 60) if key.startswith("mcp:")
                 else spec.get("seconds", MAX_CALL_SECONDS))
        try:
            bound = min(remaining, limit)
            with anyio.fail_after(bound):
                # The session's own 30 s request timeout is for start-up; a call gets its operation's bound.
                result = await session.call_tool(tool, arguments, read_timeout_seconds=bound + 5)
        except anyio.get_cancelled_exc_class():
            await self._discard(key)
            raise
        except TimeoutError:
            await self._discard(key)
            return timed("unknown" if writes else "not_applied", writes, error="timeout")
        except Exception:
            await self._discard(key)
            return timed("unknown" if writes else "not_applied", writes, error="worker_lost")

        if key.startswith("mcp:"):
            # An external server's words are untrusted data: bounded text, never an instruction or a status.
            text = "\n".join(getattr(part, "text", "") for part in result.content)[:8_000]
            if result.is_error:
                return timed("unknown" if writes else "not_applied", writes, {"content": text}, "tool_error")
            return timed("observed", writes, {"content": text, "server": key[4:], "tool": tool})
        if result.is_error:
            return timed("unknown" if writes else "not_applied", writes, error="tool_error")
        try:
            evidence = result.structured_content or json.loads(result.content[0].text)
            if set(evidence) == {"result"}:
                evidence = evidence["result"]
        except (ValueError, IndexError, AttributeError):
            return timed("unknown" if writes else "not_applied", writes, error="malformed_result")
        if "refused" in evidence:
            return timed("not_applied", writes, error=str(evidence["refused"])[:60])
        if len(json.dumps(evidence)) > 16_000:
            return timed("unknown" if writes else "not_applied", writes, error="evidence_too_large")
        return timed("observed", writes, evidence)


_VALIDATORS: dict[str, jsonschema.Draft202012Validator] = {}


def validator(key: str, schema: dict) -> jsonschema.Draft202012Validator:
    """A compiled validator per operation or schema; schemas themselves are checked when loaded."""
    if key not in _VALIDATORS:
        _VALIDATORS[key] = jsonschema.Draft202012Validator(schema)
    return _VALIDATORS[key]


def fingerprint(schema: dict) -> str:
    return hashlib.sha256(json.dumps(schema, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
