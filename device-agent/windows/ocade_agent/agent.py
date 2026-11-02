"""The companion's loop: ask for work, run it through the gateway, report what happened.

    ocade_agent enroll --server https://ocade.in --workspace "%USERPROFILE%\\Documents\\JARVIS"
    ocade_agent run          (server and workspace remembered from enroll)
    ocade_agent stop         (local STOP: no network, no model)
    ocade_agent diagnose     (what is wrong on this computer, in plain words)

Outbound only. While an action runs, the loop keeps asking the server about its
task; the moment the task is no longer running (STOP, Take Over, revoke, owner
pause) or the local STOP flag appears, the in-flight call is cancelled and its
worker process ended.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import random
import runpy
import sys
from pathlib import Path

import anyio

from . import catalog, discovery
from .device import Device
from .gateway import PROTOCOL, WORKERS, Gateway, effect_possible, receipt
from .journal import Journal

VERSION = "0.1.0"
WATCH_SECONDS = 2.0
TICK_SECONDS = 0.25
# Finite network/5xx receipt redelivery; journalled action effects are NEVER re-executed.
RECEIPT_RETRY_DELAYS = (1.0, 2.0, 4.0, 8.0)


def default_home() -> Path:
    base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~/.local/share")
    return Path(os.environ.get("OCADE_AGENT_HOME") or Path(base) / "OCADE" / "agent")


class LocalStop(Exception):
    pass


class Agent:
    def __init__(self, device: Device, journal: Journal, gateway: Gateway, stop_flag: Path | None = None):
        self.device, self.journal, self.gateway = device, journal, gateway
        self.stop_flag = stop_flag or device.home / "STOP"

    def stopped_here(self) -> bool:
        return self.stop_flag.exists()

    async def claim(self) -> dict:
        status, body = await anyio.to_thread.run_sync(self.device.request, {"op": "claim"})
        if status != 200:
            raise ConnectionError(body.get("error", str(status)))
        return body

    async def _run_watched(self, activity: str, intent: dict) -> dict:
        """Run one action; cancel it if the server says its task stopped meanwhile."""
        epoch = self.gateway.epoch
        outcome: dict = {}

        async with anyio.create_task_group() as group:

            async def work() -> None:
                outcome["receipt"] = await self.gateway.run(intent, epoch)
                group.cancel_scope.cancel()

            async def watch() -> None:
                waited = 0.0
                while True:
                    await anyio.sleep(TICK_SECONDS)
                    waited += TICK_SECONDS
                    if self.stopped_here():  # local STOP: no network needed
                        break
                    if waited < WATCH_SECONDS:
                        continue
                    waited = 0.0
                    try:
                        state = await self.claim()
                    except ConnectionError:
                        continue  # offline: keep the already-authorized step, decide nothing new
                    if (state.get("action") or {}).get("id") != activity:
                        break
                self.gateway.stop()
                group.cancel_scope.cancel()

            group.start_soon(work)
            group.start_soon(watch)

        if "receipt" in outcome:
            return outcome["receipt"]
        uncertain = effect_possible(intent)
        return receipt("unknown" if uncertain else "not_applied", uncertain, error="stopped")

    async def handle(self, action: dict) -> None:
        activity, intent = action["id"], action["intent"]
        claimed = self.journal.start(activity, intent)
        held = self.journal.get(activity)
        matches = self.journal.matches(activity, intent)
        if not matches:
            # A repeated id cannot borrow the original action's receipt or
            # reinterpret its pending effect under a different intent.
            result = receipt("unknown", True, error="intent_mismatch")
        elif held and held[0] == "finished":
            result = held[1]  # lost acknowledgement: resend, never re-run
        elif not claimed and effect_possible(intent):
            result = receipt("unknown", True, error="interrupted")
        else:
            result = await self._run_watched(activity, intent)
        if matches:
            result = self.journal.finish(activity, result)
        # A refused receipt used to retry forever (e.g. 413/422). Preserve the
        # durable result; never execute the effect again simply because ACK failed.
        for attempt in range(len(RECEIPT_RETRY_DELAYS) + 1):
            try:
                status, _ = await anyio.to_thread.run_sync(
                    self.device.request, {"op": "receipt", "activityId": activity, "receipt": result}
                )
            except OSError:
                status = 503  # transport outage: retry only this exact saved receipt
            if status == 200 or status in (401, 409):
                return  # recorded, or the server has a final answer this receipt cannot change
            if 400 <= status < 500 and status not in (408, 425, 429):
                raise ConnectionError(f"receipt_rejected_{status}")  # permanent: repair before resending
            if attempt == len(RECEIPT_RETRY_DELAYS):
                raise ConnectionError(f"receipt_delivery_unavailable_{status}")
            await anyio.sleep(RECEIPT_RETRY_DELAYS[attempt])

    async def run(self, until_idle: bool = False) -> None:
        # What the person can choose from: installed apps and approved external MCP servers.
        apps = await anyio.to_thread.run_sync(discovery.installed_apps)
        await anyio.to_thread.run_sync(
            self.device.request,
            {"op": "inventory", "apps": apps, "mcp": catalog.describe(self.gateway.external),
             "engines": await anyio.to_thread.run_sync(discovery.engines)},
        )
        idle = 1.0
        while True:
            if self.stopped_here():
                raise LocalStop()
            try:
                state = await self.claim()
            except ConnectionError as error:
                if str(error) in ("signature_invalid", "update_required"):
                    raise
                state = {}
            if state.get("action"):
                idle = 1.0
                await self.handle(state["action"])
                continue
            if until_idle and not (state.get("task") or {}).get("status") == "running":
                return
            await anyio.sleep(idle + random.random())
            idle = min(idle * 2, 30.0)


def diagnose(home: Path, server: str | None, workspace: str | None) -> list[dict]:
    """What a person (or support) needs to see when JARVIS cannot work on this computer.
    Read-only: no task is claimed, nothing is written outside a probe file that is removed,
    and no key, token or file content is shown."""
    import tempfile
    import urllib.request

    checks: list[dict] = []

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append({"check": name, "ok": ok, "detail": detail})

    check("software", True, f"OCADE JARVIS {VERSION}, protocol v{PROTOCOL['version']}, {platform.system()} "
                            f"{platform.release()} {platform.machine()}, Python {platform.python_version()}")
    saved = json.loads((home / "device.json").read_text()) if (home / "device.json").exists() else {}
    check("paired", bool(saved.get("deviceId")),
          "paired with an OCADE account" if saved.get("deviceId") else "not paired: run enroll and type the code in OCADE")
    if workspace and Path(workspace).is_dir():
        try:
            with tempfile.TemporaryFile(dir=workspace):
                pass
            check("workspace", True, f"{workspace} exists and JARVIS can save into it")
        except OSError as error:
            check("workspace", False, f"{workspace} cannot be written ({error.strerror}); check its permissions")
    else:
        check("workspace", False, "no JARVIS folder chosen, or it was moved or deleted")
    if server:
        try:
            with urllib.request.urlopen(urllib.request.Request(server, method="HEAD"), timeout=10):
                pass
            check("server", True, f"{server} reachable")
        except urllib.error.HTTPError:
            check("server", True, f"{server} reachable")
        except Exception as error:
            check("server", False, f"{server} unreachable ({type(error).__name__}); check the internet connection or proxy")
    else:
        check("server", False, "no OCADE server address saved; run enroll first")
    engines = discovery.engines()
    for engine in ("browser", "ffmpeg", "office"):
        check(f"engine:{engine}", engine in engines,
              "available" if engine in engines else "not found: operations that need it are not offered")
    external, rejected = catalog.load(home)
    for entry in rejected:
        check(f"mcp:{entry['file']}", False, f"manifest not used: {entry['reason']}")
    for manifest in external.values():
        check(f"mcp:{manifest['id']}", manifest["state"] == "trusted", manifest["state"])

    async def workers() -> None:
        async with Gateway(workspace or tempfile.mkdtemp(), home=str(home)) as gateway:
            for module in sorted(set(WORKERS.values())):
                try:
                    await gateway._session(module)
                    check(f"worker:{module.rsplit('.', 1)[1]}", True, "starts and offers exactly its approved tools")
                except Exception as error:
                    check(f"worker:{module.rsplit('.', 1)[1]}", False, f"did not start ({type(error).__name__})")

    anyio.run(workers)
    check("stop", not (home / "STOP").exists(),
          "no local STOP" if not (home / "STOP").exists() else "STOP is set on this computer; run starts JARVIS again")
    return checks


def main(argv: list[str] | None = None) -> int:
    # A frozen customer installer has its own verified Chromium; neither the
    # customer's Edge/Chrome nor a developer-level Playwright install is needed.
    if getattr(sys, "frozen", False):
        bundled_browsers = Path(getattr(sys, "_MEIPASS", "")) / "playwright-browsers"
        if bundled_browsers.is_dir():
            os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(bundled_browsers)
    parser = argparse.ArgumentParser(prog="ocade_agent")
    parser.add_argument("command", choices=["enroll", "run", "stop", "worker", "diagnose"])
    parser.add_argument("module", nargs="?", help=argparse.SUPPRESS)
    parser.add_argument("--server")
    parser.add_argument("--name", default=platform.node() or "My computer")
    parser.add_argument("--workspace")
    parser.add_argument("--until-idle", action="store_true")
    args = parser.parse_args(argv)
    home = default_home()
    if args.command == "worker":  # the packaged executable hosting one capability worker
        if args.module not in set(WORKERS.values()):
            return 2
        runpy.run_module(args.module, run_name="__main__")
        return 0
    if args.command == "stop":
        home.mkdir(parents=True, exist_ok=True)
        (home / "STOP").touch()
        print("STOP: OCADE JARVIS stops its current step now and starts nothing new.")
        return 0

    saved = json.loads((home / "device.json").read_text()) if (home / "device.json").exists() else {}
    server = args.server or saved.get("server")
    workspace = args.workspace or saved.get("workspace")
    if args.command == "diagnose":
        checks = diagnose(home, server, workspace)
        for item in checks:
            print(f"{'OK  ' if item['ok'] else 'FIX '} {item['check']}: {item['detail']}")
        return 0 if all(item["ok"] for item in checks if not item["check"].startswith("engine:")) else 1
    if not server:
        print("--server is required the first time", file=sys.stderr)
        return 2
    if not workspace or not Path(workspace).is_dir():
        print("--workspace must be an existing folder you choose for JARVIS", file=sys.stderr)
        return 2
    device = Device(home, server)
    device.config.update(server=server, workspace=str(Path(workspace).resolve()))
    if args.command == "enroll":
        enrolled = device.enroll(args.name, f"{platform.system()} {platform.release()}"[:60], VERSION)
        print(f"Pairing code: {enrolled['code']}  (type it in OCADE JARVIS within 10 minutes)")
        return 0
    (home / "STOP").unlink(missing_ok=True)  # starting again is the person's decision
    external, rejected = catalog.load(home)
    for entry in rejected:
        print(f"MCP manifest {entry['file']} not used: {entry['reason']}", file=sys.stderr)
    gateway = Gateway(device.config["workspace"], home=str(home), external=external)

    async def go() -> str | None:
        async with gateway:
            try:
                await Agent(device, Journal(home / "journal.sqlite"), gateway).run(args.until_idle)
            except ConnectionError as error:
                return str(error)
            except LocalStop:
                return "stop"
        return None

    try:
        refused = anyio.run(go)
        if refused == "stop":
            print("Stopped on this computer.", file=sys.stderr)
        elif refused:
            print(f"This computer is not paired with OCADE, or was removed ({refused}).", file=sys.stderr)
            return 3
    except KeyboardInterrupt:
        gateway.stop()
        print("Stopped.", file=sys.stderr)
    return 0
