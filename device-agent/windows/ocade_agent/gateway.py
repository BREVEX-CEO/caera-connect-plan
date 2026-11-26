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
- A transport failure does not prove an action failed. After dispatch, an opaque
  operation is `unknown`, `maybeChanged` even when its declared risk is read.
  Only audited local inspections can establish that a lost response changed nothing.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import anyio
import jsonschema
from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, get_default_environment, stdio_client

from .redact import redact, redact_text

PROTOCOL = json.loads((Path(__file__).parent / "protocol.json").read_text(encoding="utf-8"))
WORKERS = {
    "fs_sandbox": "ocade_agent.office_worker",
    "sys_core": "ocade_agent.office_worker",
    "verifier": "ocade_agent.verify_worker",
    # One desktop capability, one bridge per platform behind the same operations.
    "ui_bridge": {"darwin": "ocade_agent.mac_worker", "linux": "ocade_agent.linux_worker"}.get(
        sys.platform, "ocade_agent.windows_worker"),
    "web_automation": "ocade_agent.web_worker",
    "media_engine": "ocade_agent.media_worker",
    "shell": "ocade_agent.command_worker",
}
MAX_CALL_SECONDS = 300
# MCP-07: one external server (a plugin) may not drain the computer or the quota by retrying or
# delegating in a loop: at most this many calls, and this many seconds of its tools running,
# in any rolling minute. The next call is refused untouched until the window has room.
EXTERNAL_CALLS_PER_MINUTE = 60
EXTERNAL_BUSY_SECONDS_PER_MINUTE = 120.0
FUEL_WINDOW_SECONDS = 60.0
DISCARD_SECONDS = 15
# These implementations only inspect local paths/data/resources; they neither
# dispatch to an app nor invoke browser, network, COM or command operations.
# This is a recovery policy, not permission to execute: protocol grants and risk
# checks still apply. Unlisted/future operations are conservative by default.
PURE_READ_OPERATIONS = frozenset(PROTOCOL.get("pureReads", ()))
# Network and browser settings the device owner chose, and the Windows system folders app
# discovery reads (the SDK's minimal set omits them); never account credentials or tokens.
# A proxy address may carry the person's proxy login (http://user:password@host). Commands, the
# verifier and the other workers never need it, and what a command can read a model can ask for, so
# only the browser worker (Chromium signs in to the proxy itself; page scripts cannot read the
# environment) receives the address as it was written; every other worker gets it without the login.
PROXY_VARIABLES = ("HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy", "ALL_PROXY", "all_proxy")
KEEPS_PROXY_LOGIN = ("ocade_agent.web_worker",)


def without_proxy_login(address: str) -> str:
    """`address` with any user:password@ removed from its authority; unparsable text is dropped."""
    from urllib.parse import urlsplit, urlunsplit

    try:
        parts = urlsplit(address)
        if parts.username is None and parts.password is None and "@" not in parts.netloc:
            return address
        host = parts.hostname or ""
        if not host:
            return ""
        if ":" in host:
            host = f"[{host}]"  # an IPv6 address keeps its brackets
        netloc = host + (f":{parts.port}" if parts.port else "")
        return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
    except ValueError:
        return ""


PASS_THROUGH = (
    "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "DISPLAY", "XAUTHORITY",
    "OCADE_BROWSER_EXECUTABLE", "PLAYWRIGHT_BROWSERS_PATH", "OCADE_ALLOW_PRIVATE_WEB",
    "NODE_EXTRA_CA_CERTS",  # an organisation's own CA for checked navigations (Playwright's Node TLS)
    "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "WINDIR",
)


def effect_possible(intent: dict) -> bool:
    """A lost response needs reconciliation unless this is an audited local read.

    Keep journal replay, STOP and live dispatch on the same conservative policy.
    Unknown operations or malformed risk declarations never qualify as pure.
    """
    operation = intent.get("operation")
    return intent.get("risk") != "read" or not isinstance(operation, str) or operation not in PURE_READ_OPERATIONS


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def receipt(status: str, maybe_changed: bool, evidence: dict | None = None, error: str | None = None) -> dict:
    out = {"status": status, "maybeChanged": maybe_changed, "observedAtUtc": now_utc(), "evidence": evidence or {}}
    if error:
        out["errorCode"] = error
    return out


def expectation_unmet(expect, evidence: dict) -> str | None:
    """The first expectation a step's own evidence does not meet (plan v8 10.9), by its field.

    A field is a dotted path; a number selects a list position. `equals` compares the value;
    `contains` finds text in a string, an equal or text-containing item in a list, or the text
    anywhere in an object. Malformed expectations count as unmet: a guard nobody can check
    never lets the next step run."""
    if not expect:
        return None
    if not isinstance(expect, list):
        return "expect"
    for item in expect[:3]:
        field = item.get("field") if isinstance(item, dict) else None
        if not isinstance(field, str):
            return "expect"
        value, found = evidence, True
        for part in field.split("."):
            if isinstance(value, dict) and part in value:
                value = value[part]
            elif isinstance(value, list) and part.isdigit() and int(part) < len(value):
                value = value[int(part)]
            else:
                found = False
                break
        if not found:
            return field
        if "equals" in item:
            if value != item["equals"] or isinstance(value, bool) != isinstance(item["equals"], bool):
                return field
            continue
        text = item.get("contains")
        if not isinstance(text, str) or not text:
            return field
        if isinstance(value, str):
            met = text in value
        elif isinstance(value, list):
            met = any(entry == text or (isinstance(entry, str) and text in entry)
                      or (isinstance(entry, dict) and text in json.dumps(entry, ensure_ascii=False))
                      for entry in value)
        else:
            met = text in json.dumps(value, ensure_ascii=False)
        if not met:
            return field
    return None


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
        # True when an external server's state changed since the last inventory was reported.
        self.inventory_stale = False
        self._workers: dict[str, dict] = {}
        self._fuel: dict[str, list[tuple[float, float]]] = {}  # server -> (start, seconds) of recent calls

    def _fuel_left(self, server: str) -> bool:
        """Whether `server` is inside its per-minute call and busy-time budget."""
        now = time.monotonic()
        recent = [(at, seconds) for at, seconds in self._fuel.get(server, []) if now - at < FUEL_WINDOW_SECONDS]
        self._fuel[server] = recent
        return len(recent) < EXTERNAL_CALLS_PER_MINUTE and sum(s for _, s in recent) < EXTERNAL_BUSY_SECONDS_PER_MINUTE

    def _spend(self, key: str, started: float, finished: float) -> None:
        if key.startswith("mcp:"):
            self._fuel.setdefault(key[4:], []).append((started, finished - started))

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
            # Bounded: a worker whose process outlived the SDK's kill escalation must not hold
            # STOP, shutdown or the next step forever (hosted windows-2022 hang, 20 Nov 2026).
            with anyio.move_on_after(DISCARD_SECONDS, shield=True):
                await worker["closed"].wait()

    def _parameters(self, key: str) -> StdioServerParameters:
        key = key.split("#")[0]  # a lane's own process runs the same pinned module
        if key.startswith("mcp:"):
            manifest = self.external[key[4:]]
            # Re-checked at every start: a replaced executable is not the approved one.
            from .catalog import pins_hold  # catalog imports this module

            if not pins_hold(manifest):
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
        if key not in KEEPS_PROXY_LOGIN:
            for name in PROXY_VARIABLES:
                if name in environment:
                    environment[name] = without_proxy_login(environment[name])
        # A packaged companion is one executable that runs its own workers
        # (the console build: a windowed executable has no stdout for the MCP protocol).
        if getattr(sys, "frozen", False):
            # Workers are keyed by MODULE (fs_sandbox and sys_core share office_worker), and the
            # packaged agent takes that module name.
            executable = sys.executable
            if sys.platform == "win32":
                executable = str(Path(executable).with_name("ocade-agent.exe"))
            command = [executable, "worker", key]
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

    def _start(self, key: str) -> dict:
        # Registered before it starts, so STOP or shutdown can always end it.
        worker = {"scope": anyio.CancelScope(), "started": anyio.Event(), "closed": anyio.Event()}
        self._workers[key] = worker
        self._group.start_soon(self._hold, key, worker)
        return worker

    def prewarm(self) -> None:
        """Start the workers nearly every task uses (files, documents, commands, verification)
        in the background, so the first step does not wait ~0.8 s for each to start."""
        for role in ("fs_sandbox", "shell", "verifier"):
            key = self.modules.get(role)
            if key and key not in self._workers:
                self._start(key)

    async def _session(self, key: str) -> ClientSession:
        worker = self._workers.get(key)
        if worker is None:
            if key.startswith("mcp:"):
                active = [k for k in self._workers if k.startswith("mcp:")]
                if len(active) >= self.max_external:
                    await self._discard(active[0])  # least recently started
            worker = self._start(key)
        await worker["started"].wait()
        if "session" not in worker:
            await self._discard(key)
            error = worker.get("error") or RuntimeError("worker ended during start-up")
            if key.startswith("mcp:") and key[4:] in self.external:
                # Failed its health check (did not start, or listed other tools): no longer offered
                # until the companion starts again and re-checks it (plan concept 45).
                self.external[key[4:]]["state"] = "unhealthy"
                self.inventory_stale = True
            raise error
        return worker["session"]

    def _tool_problem(self, key: str, tools: dict[str, dict]) -> str | None:
        """The live tool list must be exactly what was approved: names and argument schemas."""
        if key.startswith("mcp:"):
            approved = {t["name"]: t["inputSchema"] for t in self.external[key[4:]]["tools"]}
            if set(tools) != set(approved):
                return f"{key} offers {sorted(tools)}, approved {sorted(approved)}"
            drifted = [n for n in approved if fingerprint(tools[n]) != fingerprint(approved[n])]
            return f"{key} schemas drifted: {drifted}" if drifted else None
        module = key.split("#")[0]
        expected = {
            name.replace(".", "_"): spec
            for name, spec in PROTOCOL["operations"].items()
            if self.modules.get(spec["role"]) == module
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

    async def run(self, intent: dict, epoch: int, lane: int = 0) -> dict:
        """Dispatch one validated intent and return an honest, timed receipt.

        Each parallel lane (plan 14F.3) has its own worker processes, so one lane's timeout,
        cancellation or crash ends only that lane's worker; approved external MCP servers are
        shared (their own concurrency is theirs)."""
        started = time.monotonic()
        worker_started = worker_ready = tool_started = tool_finished = None

        def elapsed(start: float, finish: float) -> float:
            return round((finish - start) * 1000, 2)

        def timed(status: str, maybe_changed: bool, evidence: dict | None = None,
                  error: str | None = None, refused: bool = False) -> dict:
            ended = time.monotonic()
            facts = dict(evidence or {})
            facts.pop("executionDisposition", None)
            facts["durationMs"] = elapsed(started, ended)
            if worker_started is not None:
                facts["workerReadyMs"] = elapsed(worker_started, worker_ready or ended)
            if tool_started is not None:
                facts["toolMs"] = elapsed(tool_started, tool_finished or ended)
            if refused:
                facts["executionDisposition"] = "refused"
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
            return timed("not_applied", False, error="invalid_intent", refused=True)
        try:
            validator(intent["operation"], spec["arguments"]).validate(intent.get("arguments"))
            deadline = datetime.fromisoformat(intent["deadlineUtc"].replace("Z", "+00:00"))
        except (jsonschema.ValidationError, KeyError, ValueError):
            return timed("not_applied", False, error="invalid_intent", refused=True)
        remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
        if remaining <= 0:
            return timed("not_applied", False, error="deadline_passed")
        target = self._target(intent, spec)
        if isinstance(target, str):
            return timed("not_applied", False, error=target, refused=True)
        key, tool, arguments = target
        if lane and not key.startswith("mcp:"):
            key = f"{key}#{lane}"

        uncertain = effect_possible(intent)
        if key.startswith("mcp:") and not self._fuel_left(key[4:]):
            return timed("not_applied", False, error="plugin_fuel_exhausted")
        worker_started = time.monotonic()
        try:
            session = await self._session(key)
            worker_ready = time.monotonic()
        except anyio.get_cancelled_exc_class():
            await self._discard(key)
            raise
        except WorkerRejected:
            return timed("not_applied", False, error="worker_rejected")
        except Exception:
            return timed("not_applied", False, error="worker_unavailable")
        if epoch != self.epoch:  # STOP during worker start-up
            return timed("not_applied", False, error="stopped")
        remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
        if remaining <= 0:
            return timed("not_applied", False, error="deadline_passed")
        limit = (self.external[key[4:]].get("timeoutSeconds", 60) if key.startswith("mcp:")
                 else spec.get("seconds", MAX_CALL_SECONDS))
        tool_started = time.monotonic()
        try:
            bound = min(remaining, limit)
            with anyio.fail_after(bound):
                # The session's own 30 s request timeout is for start-up; a call gets its operation's bound.
                result = await session.call_tool(tool, arguments, read_timeout_seconds=bound + 5)
            tool_finished = time.monotonic()
            self._spend(key, tool_started, tool_finished)
        except anyio.get_cancelled_exc_class():
            await self._discard(key)
            raise
        except TimeoutError:
            tool_finished = time.monotonic()
            self._spend(key, tool_started, tool_finished)
            await self._discard(key)
            return timed("unknown" if uncertain else "not_applied", uncertain, error="timeout")
        except Exception:
            tool_finished = time.monotonic()
            self._spend(key, tool_started, tool_finished)
            await self._discard(key)
            return timed("unknown" if uncertain else "not_applied", uncertain, error="worker_lost")

        if key.startswith("mcp:"):
            # An external server's words are untrusted data: bounded text, never an instruction or a status.
            text = "\n".join(getattr(part, "text", "") for part in result.content)[:8_000]
            # Its output is redacted like any evidence: a third-party tool may echo a credential (170, 176).
            text, redacted = redact_text(text)
            if result.is_error:
                return timed("unknown" if uncertain else "not_applied", uncertain, {"content": text}, "tool_error")
            found = {"content": text, "server": key[4:], "tool": tool}
            if redacted:
                found["redactedValues"] = redacted
            return timed("observed", uncertain, found)
        try:
            evidence = result.structured_content or json.loads(result.content[0].text)
            if not isinstance(evidence, dict):
                raise ValueError("evidence must be an object")
            if set(evidence) == {"result"}:
                evidence = evidence["result"]
            if not isinstance(evidence, dict):
                raise ValueError("evidence must be an object")
        except (TypeError, ValueError, IndexError, AttributeError):
            return timed("unknown" if uncertain else "not_applied", uncertain,
                         error="tool_error" if result.is_error else "malformed_result")
        # An explicit admission outranks an operation's usual read-only behavior,
        # including when the remainder of its evidence is unusable.
        if "maybeChanged" in evidence and evidence["maybeChanged"] is not False:
            uncertain = True
        if result.is_error:
            return timed("unknown" if uncertain else "not_applied", uncertain, error="tool_error")
        if "refused" in evidence:
            changed = evidence.get("maybeChanged")
            # Only an explicit false proves that a bundled writer stopped before
            # its first effect. Legacy/malformed write refusals remain uncertain.
            if changed is True or changed is False:
                maybe_changed = changed
            else:
                maybe_changed = uncertain or "maybeChanged" in evidence
            # Only the windows that hold the target (a dialog to answer first) travel with it.
            dialogs = evidence.get("dialogs")
            detail = {"dialogs": redact(dialogs[:5])[0]} if isinstance(dialogs, list) else None
            return timed("unknown" if maybe_changed else "not_applied", maybe_changed, detail,
                         error=str(evidence["refused"])[:60], refused=True)
        if "maybeChanged" in evidence and evidence["maybeChanged"] is not True and evidence["maybeChanged"] is not False:
            return timed("unknown", True, error="malformed_result")
        # An image for the planner to look at travels beside the evidence, never inside it.
        preview = evidence.pop("preview", None)
        if preview is not None and (
            not isinstance(preview, str) or len(preview) > MAX_PREVIEW or not _BASE64.fullmatch(preview)
        ):
            return timed("unknown" if uncertain else "not_applied", uncertain, error="malformed_result")
        # Credentials found in the evidence never leave this computer (requirement 176).
        evidence, redacted = redact(evidence)
        if redacted:
            evidence["redactedValues"] = redacted
        if len(json.dumps(evidence)) > 16_000:
            return timed("unknown" if uncertain else "not_applied", uncertain, error="evidence_too_large")
        unmet = expectation_unmet(intent.get("expect"), evidence)
        done = timed("observed", uncertain, evidence, "expectation_unmet" if unmet else None)
        if unmet:
            done["evidence"]["unmet"] = unmet
        # The server stores a receipt in at most 64 KiB: a preview that would not fit is left
        # out (the planner can still ask for one) rather than leave a receipt nobody can record.
        if preview is not None and len(json.dumps(done)) + len(preview) <= MAX_RECEIPT:
            done["preview"] = preview
        return done


MAX_PREVIEW = 64_000
MAX_RECEIPT = 60_000  # under the server's 65 536-byte stored-receipt limit
_BASE64 = re.compile(r"[A-Za-z0-9+/]+={0,2}")

_VALIDATORS: dict[str, jsonschema.Draft202012Validator] = {}


def validator(key: str, schema: dict) -> jsonschema.Draft202012Validator:
    """A compiled validator per operation or schema; schemas themselves are checked when loaded."""
    if key not in _VALIDATORS:
        _VALIDATORS[key] = jsonschema.Draft202012Validator(schema)
    return _VALIDATORS[key]


def fingerprint(schema: dict) -> str:
    return hashlib.sha256(json.dumps(schema, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
