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

import json
import os
import sys
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
}
MAX_CALL_SECONDS = 300


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
    entered and exited in one task even though calls come from many.
    """

    def __init__(self, workspace: str, worker_modules: dict[str, str] | None = None, extra_path: str = ""):
        self.workspace = workspace
        self.modules = worker_modules or WORKERS
        self.extra_path = extra_path
        self.epoch = 0
        self._workers: dict[str, dict] = {}

    async def __aenter__(self) -> "Gateway":
        self._group = await anyio.create_task_group().__aenter__()
        return self

    async def __aexit__(self, *exc) -> bool | None:
        for module in list(self._workers):
            await self._discard(module)
        return await self._group.__aexit__(*exc)

    def stop(self) -> None:
        """Local STOP: nothing dispatched under an older epoch may start."""
        self.epoch += 1

    async def _discard(self, module: str) -> None:
        """End a worker, even one still starting; the SDK's shielded shutdown kills its process tree."""
        worker = self._workers.pop(module, None)
        if worker:
            worker["scope"].cancel()
            with anyio.CancelScope(shield=True):
                await worker["closed"].wait()

    async def _hold(self, module: str, worker: dict) -> None:
        package_root = str(Path(__file__).resolve().parent.parent)
        python_path = os.pathsep.join(p for p in (package_root, self.extra_path) if p)
        environment = get_default_environment() | {"PYTHONPATH": python_path, "OCADE_WORKSPACE": self.workspace}
        parameters = StdioServerParameters(command=sys.executable, args=["-s", "-m", module], env=environment, cwd=package_root)
        try:
            with worker["scope"]:
                async with stdio_client(parameters, errlog=sys.stderr) as (read, write):
                    async with ClientSession(read, write, read_timeout_seconds=30) as session:
                        await session.initialize()
                        listed = await session.list_tools()
                        problem = self._tool_problem(module, {tool.name: tool.input_schema for tool in listed.tools})
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

    async def _session(self, module: str) -> ClientSession:
        worker = self._workers.get(module)
        if worker is None:
            # Registered before it starts, so STOP or shutdown can always end it.
            worker = {"scope": anyio.CancelScope(), "started": anyio.Event(), "closed": anyio.Event()}
            self._workers[module] = worker
            self._group.start_soon(self._hold, module, worker)
        await worker["started"].wait()
        if "session" not in worker:
            await self._discard(module)
            raise worker.get("error") or RuntimeError("worker ended during start-up")
        return worker["session"]

    def _tool_problem(self, module: str, tools: dict[str, dict]) -> str | None:
        expected = {
            name.replace(".", "_"): spec
            for name, spec in PROTOCOL["operations"].items()
            if self.modules.get(spec["role"]) == module
        }
        if set(tools) != set(expected):
            return f"{module} offers {sorted(tools)}, expected {sorted(expected)}"
        for name, spec in expected.items():
            if set(tools[name].get("properties", {})) != set(spec["arguments"].get("properties", {})):
                return f"{module}.{name} arguments drifted from the protocol"
        return None

    async def run(self, intent: dict, epoch: int) -> dict:
        """Dispatch one validated intent and return an honest receipt."""
        if epoch != self.epoch:
            return receipt("not_applied", False, error="stopped")
        spec = PROTOCOL["operations"].get(intent.get("operation"))
        if (
            spec is None
            or intent.get("v") != PROTOCOL["version"]
            or intent.get("capability") != spec["capability"]
            or intent.get("risk") != spec["risk"]
        ):
            return receipt("not_applied", False, error="invalid_intent")
        try:
            jsonschema.validate(intent.get("arguments"), spec["arguments"])
            deadline = datetime.fromisoformat(intent["deadlineUtc"].replace("Z", "+00:00"))
        except (jsonschema.ValidationError, KeyError, ValueError):
            return receipt("not_applied", False, error="invalid_intent")
        remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
        if remaining <= 0:
            return receipt("not_applied", False, error="deadline_passed")

        writes = spec["risk"] != "read"
        module = self.modules[spec["role"]]
        try:
            session = await self._session(module)
        except anyio.get_cancelled_exc_class():
            await self._discard(module)
            raise
        except WorkerRejected:
            return receipt("not_applied", False, error="worker_rejected")
        except Exception:
            return receipt("not_applied", False, error="worker_unavailable")
        if epoch != self.epoch:  # STOP during worker start-up
            return receipt("not_applied", False, error="stopped")
        try:
            with anyio.fail_after(min(remaining, MAX_CALL_SECONDS)):
                result = await session.call_tool(intent["operation"].replace(".", "_"), intent["arguments"])
        except anyio.get_cancelled_exc_class():
            await self._discard(module)
            raise
        except TimeoutError:
            await self._discard(module)
            return receipt("unknown" if writes else "not_applied", writes, error="timeout")
        except Exception:
            await self._discard(module)
            return receipt("unknown" if writes else "not_applied", writes, error="worker_lost")

        if result.is_error:
            return receipt("unknown" if writes else "not_applied", writes, error="tool_error")
        try:
            evidence = result.structured_content or json.loads(result.content[0].text)
            if set(evidence) == {"result"}:
                evidence = evidence["result"]
        except (ValueError, IndexError, AttributeError):
            return receipt("unknown" if writes else "not_applied", writes, error="malformed_result")
        if "refused" in evidence:
            return receipt("not_applied", writes, error=str(evidence["refused"])[:60])
        if len(json.dumps(evidence)) > 16_000:
            return receipt("unknown" if writes else "not_applied", writes, error="evidence_too_large")
        return receipt("observed", writes, evidence)
