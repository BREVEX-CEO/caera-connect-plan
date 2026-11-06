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
import time
from pathlib import Path

import anyio
from websockets.asyncio.client import connect as websocket

from . import catalog, discovery, jobs
from .device import Device
from .gateway import PROTOCOL, WORKERS, Gateway, effect_possible, receipt
from .journal import Journal

VERSION = "0.1.0"
WATCH_SECONDS = 2.0
TICK_SECONDS = 0.25
# While a task runs the server is planning the next step: ask again promptly, never back off.
ACTIVE_POLL_SECONDS = 0.5
# An idle device without the nudge backs off to this: ~2,900 of the free 100k daily Worker
# requests per idle device. With the nudge connected, polling is only a lost-nudge safety net.
IDLE_POLL_CAP = 30.0
NUDGED_IDLE_POLL = 60.0
NUDGED_ACTIVE_POLL = 2.0
# A nudge whose claim finds nothing costs a token and one that finds work refunds one, so a
# forged flood can cost no more claims than polling (10 at once, then one per 30 s).
NUDGE_BURST, NUDGE_REFILL_SECONDS = 10.0, 30.0
PHOENIX_HEARTBEAT_SECONDS = 25.0
# Finite network/5xx receipt redelivery; journalled action effects are NEVER re-executed.
RECEIPT_RETRY_DELAYS = (1.0, 2.0, 4.0, 8.0)


def default_home() -> Path:
    base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~/.local/share")
    return Path(os.environ.get("OCADE_AGENT_HOME") or Path(base) / "OCADE" / "agent")


class LocalStop(Exception):
    pass


class Nudge:
    """The server's content-free "look now" on a Realtime topic (W2). It carries nothing and
    authorises nothing: the only answer is the usual signed claim, so a forged, replayed or
    lost nudge changes timing only, and the token bucket caps what a flood can cost."""

    def __init__(self) -> None:
        self.event = anyio.Event()
        self.connected = False
        self.tokens, self.refilled = NUDGE_BURST, time.monotonic()

    def _refill(self) -> None:
        now = time.monotonic()
        self.tokens = min(NUDGE_BURST, self.tokens + (now - self.refilled) / NUDGE_REFILL_SECONDS)
        self.refilled = now

    def fire(self) -> None:
        self._refill()
        if self.tokens >= 1:
            self.event.set()

    def spent(self, useful: bool) -> None:
        """A nudge woke the device: a claim that found work refunds a token (late or merged
        nudges around real work then cost nothing), one that found nothing costs one."""
        self._refill()
        self.tokens = min(NUDGE_BURST, self.tokens + (1 if useful else -1))

    def absorb(self) -> None:
        """A request is about to read the server's state: earlier nudges are answered by it."""
        self.event = anyio.Event()

    async def wait(self, seconds: float) -> bool:
        """Sleep up to `seconds`; True when a nudge ended the wait early."""
        with anyio.move_on_after(seconds):
            await self.event.wait()
        nudged, self.event = self.event.is_set(), anyio.Event()
        return nudged

    async def listen(self, channel: dict) -> None:
        topic = f"realtime:{channel['topic']}"
        delay = 1.0
        while True:
            try:
                async with websocket(f"{channel['url']}?apikey={channel['key']}&vsn=1.0.0",
                                              open_timeout=15, max_size=65536) as socket:
                    await socket.send(json.dumps({"topic": topic, "event": "phx_join", "ref": "join", "payload": {
                        "config": {"broadcast": {"self": False}, "presence": {"key": ""}, "private": False}}}))
                    beat = time.monotonic()
                    while True:
                        with anyio.move_on_after(max(0.0, beat + PHOENIX_HEARTBEAT_SECONDS - time.monotonic())):
                            message = json.loads(await socket.recv())
                            if message.get("ref") == "join":
                                if (message.get("payload") or {}).get("status") != "ok":
                                    raise ConnectionError("nudge_join_refused")
                                self.connected, delay = True, 1.0
                                self.fire()  # whatever was missed while disconnected: one claim finds it
                            elif message.get("topic") == topic and message.get("event") == "broadcast":
                                self.fire()  # the content is never read
                            continue
                        await socket.send(json.dumps({"topic": "phoenix", "event": "heartbeat", "payload": {}, "ref": "hb"}))
                        beat = time.monotonic()
            except Exception:  # noqa: BLE001 - any failure means "poll until reconnected"
                pass
            finally:
                self.connected = False
            await anyio.sleep(delay)
            delay = min(delay * 2, 60.0)


class Agent:
    def __init__(self, device: Device, journal: Journal, gateway: Gateway, stop_flag: Path | None = None):
        self.device, self.journal, self.gateway = device, journal, gateway
        self.stop_flag = stop_flag or device.home / "STOP"
        self.nudge: Nudge | None = None

    async def pause(self, seconds: float) -> bool:
        if self.nudge is None:
            await anyio.sleep(seconds)
            return False
        return await self.nudge.wait(seconds)

    def stopped_here(self) -> bool:
        return self.stop_flag.exists()

    async def claim(self) -> dict:
        if self.nudge is not None:
            self.nudge.absorb()
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
                    nudged = await self.pause(TICK_SECONDS)
                    waited += TICK_SECONDS
                    if self.stopped_here():  # local STOP: no network needed
                        break
                    if waited < WATCH_SECONDS and not nudged:
                        continue
                    waited = 0.0
                    try:
                        state = await self.claim()
                    except ConnectionError:
                        continue  # offline: keep the already-authorized step, decide nothing new
                    if (state.get("action") or {}).get("id") != activity:
                        break
                    if nudged and self.nudge is not None:
                        self.nudge.spent(useful=False)
                self.gateway.stop()
                group.cancel_scope.cancel()

            group.start_soon(work)
            group.start_soon(watch)

        if "receipt" in outcome:
            return outcome["receipt"]
        uncertain = effect_possible(intent)
        return receipt("unknown" if uncertain else "not_applied", uncertain, error="stopped")

    async def handle(self, action: dict) -> dict:
        """Run one action and deliver its receipt; returns the server's answer, which may
        already carry the next step."""
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
            if self.nudge is not None:
                self.nudge.absorb()  # the answer carries the server's state after this receipt
            try:
                status, answer = await anyio.to_thread.run_sync(
                    self.device.request, {"op": "receipt", "activityId": activity, "receipt": result}
                )
            except OSError:
                status, answer = 503, {}  # transport outage: retry only this exact saved receipt
            if status == 200:
                return answer
            if status in (401, 409):
                return {}  # the server has a final answer this receipt cannot change
            if 400 <= status < 500 and status not in (408, 425, 429):
                raise ConnectionError(f"receipt_rejected_{status}")  # permanent: repair before resending
            if attempt == len(RECEIPT_RETRY_DELAYS):
                raise ConnectionError(f"receipt_delivery_unavailable_{status}")
            await anyio.sleep(RECEIPT_RETRY_DELAYS[attempt])

    async def run(self, until_idle: bool = False) -> None:
        self.gateway.prewarm()
        # What the person can choose from: installed apps and approved external MCP servers.
        apps = await anyio.to_thread.run_sync(discovery.installed_apps)
        _, answer = await anyio.to_thread.run_sync(
            self.device.request,
            {"op": "inventory", "apps": apps, "mcp": catalog.describe(self.gateway.external),
             "engines": await anyio.to_thread.run_sync(discovery.engines)},
        )
        channel = (answer or {}).get("nudge")
        if not channel:
            return await self._loop(until_idle)
        self.nudge = Nudge()
        failure: BaseException | None = None
        async with anyio.create_task_group() as group:
            group.start_soon(self.nudge.listen, channel)
            try:
                await self._loop(until_idle)
            except BaseException as error:  # re-raised as itself, not wrapped in a group
                failure = error
            group.cancel_scope.cancel()
        if failure is not None:
            raise failure

    async def _loop(self, until_idle: bool) -> None:
        idle = 1.0
        state: dict | None = None
        woke = False
        while True:
            if self.stopped_here():
                await anyio.to_thread.run_sync(jobs.cancel_all, str(self.device.home))
                raise LocalStop()
            if state is None:
                try:
                    state = await self.claim()
                except ConnectionError as error:
                    if str(error) in ("signature_invalid", "update_required"):
                        raise
                    state = {}
                if woke and self.nudge is not None:
                    self.nudge.spent(useful=bool(state.get("action")))
            woke = False
            if self.stopped_here():  # STOP may have arrived while the claim was in flight.
                await anyio.to_thread.run_sync(jobs.cancel_all, str(self.device.home))
                raise LocalStop()
            if state.get("action"):
                idle = 1.0
                state = await self.handle(state["action"])
                if not state.get("action"):
                    state = None  # no next step in the answer: ask
                continue
            status = (state.get("task") or {}).get("status")
            if "task" in state and status not in ("running", "waiting"):
                # The server answered that nothing is running (STOP, Take Over, finished): a job
                # outliving its task would be work nobody follows. An outage cancels nothing.
                await anyio.to_thread.run_sync(jobs.cancel_all, str(self.device.home))
            running = status == "running"
            state = None
            if until_idle and not running:
                return
            nudged = self.nudge is not None and self.nudge.connected
            if running:
                idle = 1.0
                woke = await self.pause((NUDGED_ACTIVE_POLL if nudged else ACTIVE_POLL_SECONDS) + random.random() / 4)
                continue
            woke = await self.pause(NUDGED_IDLE_POLL if nudged else idle + random.random())
            idle = min(idle * 2, IDLE_POLL_CAP)


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
    found = discovery.browsers()
    check("browsers", True, ", ".join(b["name"] for b in found) or
          "none found: OCADE uses its own built-in browser")
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
    if sys.platform == "darwin":  # the two permissions only the person can grant, in System Settings
        import ApplicationServices
        import Quartz

        trusted = bool(ApplicationServices.AXIsProcessTrusted())
        check("mac:accessibility", trusted, "granted" if trusted else
              "not granted: System Settings > Privacy & Security > Accessibility, turn on OCADE JARVIS")
        preflight = getattr(Quartz, "CGPreflightScreenCaptureAccess", None)
        seeing = bool(preflight()) if preflight else True
        check("mac:screen_recording", seeing, "granted" if seeing else
              "not granted (app windows cannot be seen, only controlled): System Settings > Privacy & "
              "Security > Screen Recording, turn on OCADE JARVIS")
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
        if args.module not in set(WORKERS.values()) | {"ocade_agent.job_runner"}:
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
        elif refused == "update_required":
            print("Update the OCADE companion from the JARVIS device page, then reconnect.", file=sys.stderr)
            return 3
        elif refused:
            print(f"This computer is not paired with OCADE, or was removed ({refused}).", file=sys.stderr)
            return 3
    except KeyboardInterrupt:
        gateway.stop()
        print("Stopped.", file=sys.stderr)
    return 0
