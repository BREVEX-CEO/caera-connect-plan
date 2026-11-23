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
import traceback
import webbrowser
from contextlib import closing, contextmanager
from pathlib import Path

import anyio
from websockets.asyncio.client import connect as websocket

from . import catalog, discovery, held_input, jobs
from .bar import BarState, pending_instructions
from .watch import RULES_SECONDS, Watcher
from .device import Device
from .gateway import PROTOCOL, WORKERS, Gateway, effect_possible, receipt
from .journal import Journal

VERSION = "0.1.0"
WATCH_SECONDS = 2.0
DEVICE_REFUSED = ("signature_invalid", "device_unavailable", "update_required")
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
# Parallel lanes (plan 14F.3): the server hands out at most one step per lane at a time.
LANES = 4
LANE_REASK_SECONDS = 10.0
INVENTORY_SECONDS = 600.0


def handed_out(state: dict) -> list[dict]:
    """The steps a claim answer hands out, one per lane (an older server sends only `action`)."""
    actions = [a for a in state.get("actions") or [] if isinstance(a, dict) and a.get("id")]
    if not actions and isinstance(state.get("action"), dict) and state["action"].get("id"):
        actions = [state["action"]]
    return actions[:LANES]


def still_ours(state: dict) -> set:
    """Steps this device may keep running: handed out now, or held while another lane is checked."""
    return {a["id"] for a in handed_out(state)} | {i for i in state.get("running") or [] if isinstance(i, str)}


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
        # Background app control is off until a claim answer says the person allows it.
        self._note_background({})
        home = getattr(device, "home", None)
        self.bar = BarState(Path(home)) if home is not None else None
        self.inventory_at: float | None = None
        workspace = getattr(gateway, "workspace", None)
        self.watcher = Watcher(Path(workspace), Path(home)) if home is not None and workspace else None
        self.stop_flag = stop_flag or device.home / "STOP"
        self.nudge: Nudge | None = None
        # The server state the last claim saw (task, its status, its action). A nudge is useful
        # when the claim it caused sees this change: a forged nudge cannot change server state,
        # while a real one (new task, next step, STOP, finished) always does.
        self.seen: tuple | None = None
        self.news = False
        # Session mode (plan v8 5.4; the default from the command line, owner 17 Nov 2026): the
        # companion ends `after_task_seconds` after its task finished, or `session_idle_seconds`
        # after it started when no task came, never while a task runs or waits, nor while a job it
        # started is unfinished. None for both keeps it ready until it is stopped (Always-On).
        self.session_idle_seconds: float | None = None
        self.after_task_seconds: float | None = None
        self.worked = False

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
        self._note_background(body)
        if self.bar is not None:
            self.bar.task_seen(body.get("task"), body.get("mode"))
        task = body.get("task") or {}
        seen = (task.get("id"), task.get("status"), tuple(sorted(still_ours(body))))
        self.news, self.seen = seen != self.seen, seen
        return body

    def _note_background(self, body: dict) -> None:
        """Record the person's `background` permission for the UI workers (plan 14F.2.2): each
        claim answer says it afresh, so turning it off takes effect from the next answer."""
        home = getattr(self.device, "home", None)
        if home is None:
            return
        flag = Path(home) / "background-ui"
        try:
            if body.get("backgroundAllowed") is True:
                flag.touch()
            else:
                flag.unlink(missing_ok=True)
        except OSError:
            pass

    async def watch_folders(self) -> None:
        """Watched folders (REPO-61/71): look for new files locally and report each once. Rules
        are asked for every five minutes; an outage keeps a file for the next look."""
        watcher, now = self.watcher, time.monotonic()
        if watcher is None or not watcher.due(now):
            return
        watcher.looked_at = now
        if not watcher.rules_at or now - watcher.rules_at >= RULES_SECONDS:
            try:
                status, answer = await anyio.to_thread.run_sync(self.device.request, {"op": "watches"})
            except OSError:
                status, answer = 503, {}
            if status == 200 and isinstance(answer.get("watches"), list):
                watcher.set_rules(answer["watches"], now)
            elif not watcher.rules_at:
                return
        for event in await anyio.to_thread.run_sync(watcher.look, now):
            try:
                status, _ = await anyio.to_thread.run_sync(self.device.request, {"op": "watch_event", **event})
            except OSError:
                return
            if status == 200 or status in (400, 409, 422):
                watcher.reported(event)
            else:
                return

    async def deliver_instructions(self) -> None:
        """Send what the person typed in the floating bar, oldest first (plan 14F.4.4). A file is
        removed once the server has a final answer; an outage keeps it for the next try."""
        home = getattr(self.device, "home", None)
        if home is None:
            return
        for path, item in pending_instructions(Path(home)):
            try:
                status, answer = await anyio.to_thread.run_sync(self.device.request, {"op": "instruct", **item})
            except OSError:
                status, answer = 503, {}
            if status == 200:
                state = "accepted"
            elif status == 409 and item.get("taskId") and answer.get("error") in (
                "instruction_conflict", "instruction_revision_required",
            ):
                review = path.parent / "review"
                try:
                    review.mkdir(exist_ok=True)
                    path.replace(review / path.name)
                except OSError:
                    return  # keep the queued file if the draft could not be saved
                if self.bar is not None:
                    self.bar.instruction(item["text"], "conflict")
                continue
            elif status in (400, 404, 409, 422):
                state = "rejected"
            else:
                if self.bar is not None:
                    self.bar.instruction(item["text"], "failed")
                return
            path.unlink(missing_ok=True)
            if self.bar is not None:
                self.bar.instruction(item["text"], state)

    async def _run_watched(self, activity: str, intent: dict, lane: int = 0) -> dict:
        """Run one action; cancel it if the server says its task stopped meanwhile (STOP ends
        every lane) or that this step alone is no longer this device's to run."""
        epoch = self.gateway.epoch
        outcome: dict = {}
        jobs_revoked = False
        task_over = False

        async with anyio.create_task_group() as group:

            async def work() -> None:
                outcome["receipt"] = await self.gateway.run(intent, epoch, lane)
                group.cancel_scope.cancel()

            async def watch() -> None:
                nonlocal jobs_revoked, task_over
                waited = 0.0
                while True:
                    nudged = await self.pause(TICK_SECONDS)
                    waited += TICK_SECONDS
                    if self.stopped_here():  # local STOP: no network needed
                        task_over = True
                        break
                    if waited < WATCH_SECONDS and not nudged:
                        continue
                    waited = 0.0
                    try:
                        state = await self.claim()
                    except ConnectionError as error:
                        if str(error) in DEVICE_REFUSED:
                            jobs_revoked = task_over = True
                            break
                        continue  # offline: keep the already-authorized step, decide nothing new
                    jobs_revoked = state.get("jobsAllowed") is False
                    if activity not in still_ours(state):
                        status = (state.get("task") or {}).get("status")
                        task_over = jobs_revoked or status not in ("running", "waiting")
                        break
                    if nudged and self.nudge is not None:
                        self.nudge.spent(useful=self.news)
                if task_over:
                    self.gateway.stop()  # nothing under the old epoch starts in any lane
                group.cancel_scope.cancel()

            group.start_soon(work)
            group.start_soon(watch)

        if "receipt" not in outcome and lane == 0:
            # Cut off mid-action, its worker now ended: a chord or click it started stays held
            # otherwise. Desktop input only ever runs in lane 0.
            held_input.release_held()
        if jobs_revoked or self.stopped_here():
            await anyio.to_thread.run_sync(jobs.cancel_all, str(self.device.home))
        if "receipt" in outcome:
            return outcome["receipt"]
        uncertain = effect_possible(intent)
        return receipt("unknown" if uncertain else "not_applied", uncertain, error="stopped")

    async def handle(self, action: dict) -> dict:
        """Run one action and deliver its receipt; returns the server's answer, which may
        already carry the next step."""
        activity, intent = action["id"], action["intent"]
        lane = action.get("lane", 0) if action.get("lane") in range(LANES) else 0
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
            if self.bar is not None:
                self.bar.started(lane, intent)
            result = await self._run_watched(activity, intent, lane)
            if self.bar is not None:
                self.bar.finished(lane, intent, result)
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
                self._note_background(answer)
                return answer
            if status == 401 or str(answer.get("error")) in DEVICE_REFUSED:
                await anyio.to_thread.run_sync(jobs.cancel_all, str(self.device.home))
            if status in (401, 409):
                return {}  # the server has a final answer this receipt cannot change
            if 400 <= status < 500 and status not in (408, 425, 429):
                raise ConnectionError(f"receipt_rejected_{status}")  # permanent: repair before resending
            if attempt == len(RECEIPT_RETRY_DELAYS):
                raise ConnectionError(f"receipt_delivery_unavailable_{status}")
            await anyio.sleep(RECEIPT_RETRY_DELAYS[attempt])

    async def report_inventory(self) -> dict:
        """What the person can choose from: installed apps, approved external MCP servers and the
        engines (and macOS permissions) this computer has now."""
        apps = await anyio.to_thread.run_sync(discovery.installed_apps)
        _, answer = await anyio.to_thread.run_sync(
            self.device.request,
            {"op": "inventory", "apps": apps, "mcp": catalog.describe(self.gateway.external),
             "engines": await anyio.to_thread.run_sync(discovery.engines)},
        )
        self.inventory_at = time.monotonic()
        self.gateway.inventory_stale = False
        return answer or {}

    async def run(self, until_idle: bool = False) -> None:
        self.gateway.prewarm()
        if not until_idle:
            await anyio.to_thread.run_sync(discovery.ask_for_mac_permissions)
        answer = await self.report_inventory()
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

    def _session_over(self, status: str | None, quiet_since: float | None) -> tuple[bool, float | None]:
        """Whether session mode's idle period has passed, and since when the companion is quiet."""
        if self.session_idle_seconds is None and self.after_task_seconds is None:
            return False, None
        if status in ("running", "waiting") or jobs.unfinished(str(self.device.home)):
            self.worked = status in ("running", "waiting") or self.worked
            return False, None
        limit = self.after_task_seconds if self.worked else self.session_idle_seconds
        if limit is None:
            return False, None
        quiet_since = quiet_since or time.monotonic()
        return time.monotonic() - quiet_since >= limit, quiet_since

    async def _loop(self, until_idle: bool) -> None:
        """Ask for work and run every handed-out step at once, one per lane (plan 14F.3)."""
        failure: BaseException | None = None
        async with anyio.create_task_group() as group:
            try:
                await self._serve(group, until_idle)
            except BaseException as error:  # re-raised as itself, not wrapped in a group
                failure = error
            group.cancel_scope.cancel()
        if failure is not None:
            raise failure

    async def _serve(self, group, until_idle: bool) -> None:
        idle = 1.0
        state: dict | None = None
        woke = False
        quiet_since: float | None = None
        running: set[str] = set()
        answers: list[dict] = []
        lane_failure: list[BaseException] = []
        changed = anyio.Event()

        async def lane(action: dict) -> None:
            nonlocal changed
            try:
                answers.append(await self.handle(action))
            except Exception as error:  # noqa: BLE001 - surfaced by the loop, as before
                lane_failure.append(error)
            finally:
                running.discard(action["id"])
                changed.set()

        while True:
            if lane_failure or self.stopped_here():
                if running:  # every lane sees the flag within a tick and delivers its receipt
                    await changed.wait()
                    changed = anyio.Event()
                    continue
                if lane_failure:  # a receipt the server refuses for good: repair before resending
                    raise lane_failure[0]
                await anyio.to_thread.run_sync(jobs.cancel_all, str(self.device.home))
                raise LocalStop()
            await self.deliver_instructions()
            await self.watch_folders()
            if self.inventory_at is not None and (
                self.gateway.inventory_stale or time.monotonic() - self.inventory_at >= INVENTORY_SECONDS
            ):
                # A permission granted in System Settings, or an app installed, shows on the website.
                try:
                    await self.report_inventory()
                except OSError:  # the next periodic report carries the change
                    self.inventory_at = time.monotonic()
                    self.gateway.inventory_stale = False
            if state is None and answers:
                answer = answers.pop()  # the latest answer carries the server's state after it
                answers.clear()
                if handed_out(answer) or running:
                    state = answer
                elif answer.get("jobsAllowed") is False:
                    await anyio.to_thread.run_sync(jobs.cancel_all, str(self.device.home))
                # No next step in the answer: ask.
            if state is None:
                try:
                    state = await self.claim()
                except ConnectionError as error:
                    if str(error) in DEVICE_REFUSED:
                        await anyio.to_thread.run_sync(jobs.cancel_all, str(self.device.home))
                        raise
                    state = {}
                if woke and self.nudge is not None:
                    self.nudge.spent(useful=self.news)
            woke = False
            if self.stopped_here():  # STOP may have arrived while the claim was in flight.
                continue
            if state.get("jobsAllowed") is False:
                await anyio.to_thread.run_sync(jobs.cancel_all, str(self.device.home))
            for action in handed_out(state):
                if action["id"] not in running:
                    running.add(action["id"])
                    group.start_soon(lane, action)
            if running:
                idle, quiet_since, self.worked = 1.0, None, True
                state = None
                # A lane's receipt answer carries the steps that may run next; a slow re-ask is
                # only the safety net.
                with anyio.move_on_after(LANE_REASK_SECONDS + random.random()):
                    await changed.wait()
                changed = anyio.Event()
                continue
            status = (state.get("task") or {}).get("status")
            if "task" in state and status not in ("running", "waiting"):
                # The server answered that nothing is running (STOP, Take Over, finished): a job
                # outliving its task would be work nobody follows. An outage cancels nothing.
                await anyio.to_thread.run_sync(jobs.cancel_all, str(self.device.home))
            active = status == "running"
            state = None
            if until_idle and not active:
                return
            over, quiet_since = self._session_over(status, quiet_since)
            if over:
                return
            nudged = self.nudge is not None and self.nudge.connected
            if active:
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
    try:
        active = _release_state(home)["active"]
        check("release", True, f"update {_installed_release(home, active)[1]} selected and verified"
              if active else f"installed release {VERSION}")
    except (OSError, RuntimeError, ValueError):
        check("release", False, "the selected update failed its integrity check; "
                                "the next start restores the previous release")
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
        check(f"mcp:{manifest['id']}", manifest["state"] == "trusted",
              manifest["state"] + (f" ({', '.join(manifest['findings'])}; review its files, then list them"
                                   " in reviewedFindings)" if manifest.get("findings") else ""))

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
    reports = sorted((home / "crash-reports").glob("*.json"))
    check("crash", True, f"newest crash report: {reports[-1]} ({len(reports)} kept, nothing sent)"
          if reports else "no crash reports")
    check("stop", not (home / "STOP").exists(),
          "no local STOP" if not (home / "STOP").exists() else "STOP is set on this computer; run starts JARVIS again")
    return checks



def forget_task_data(home: Path, browser_profile: bool = False) -> list[str]:
    """Delete this companion's own JARVIS task records (plan v8 12.3): the action journal, job
    records and logs, and crash reports; with `browser_profile`, OCADE's own browser profile too.
    Unfinished jobs are cancelled first. The pairing key, installed releases and the person's
    files (the JARVIS folder and its 'OCADE output') are never touched."""
    import shutil

    jobs.cancel_all(str(home))
    removed = []
    targets = [home / name for name in ("journal.sqlite", "journal.sqlite-wal", "journal.sqlite-shm")]
    targets += [jobs.folder(home), home / "crash-reports"]
    if browser_profile:
        from .web_worker import PROFILE

        targets.append(PROFILE)
    for target in targets:
        if target.is_dir() and not target.is_symlink():
            shutil.rmtree(target)
        elif target.exists() or target.is_symlink():
            target.unlink()
        else:
            continue
        removed.append(target.name)
    return removed


@contextmanager
def companion_lock(home: Path):
    """Serialise the companion and updates, including interrupted process recovery."""
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (home / ".companion-lock").open("a+b") as stream:
        if os.name == "nt":
            import msvcrt
            import win32event

            stream.seek(0)
            try:
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                raise RuntimeError("Stop OCADE on this computer before starting another copy or updating.") from None
            # The per-user installer also refuses to replace files while this mutex exists.
            mutex = win32event.CreateMutex(None, False, "OCADE.Jarvis.Active")
            try:
                yield
            finally:
                mutex.Close()
        else:
            import fcntl

            try:
                fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise RuntimeError("Stop OCADE on this computer before starting another copy or updating.") from None
            yield


_RELEASE_SIZE = 1024 ** 3
_RELEASE_FILES = 30_000
_RELEASE_ENTRY = {
    "Windows": "ocade-agent.exe",
    "Darwin": "OCADE JARVIS.app/Contents/MacOS/ocade-agent",
}


def _release_info(raw: bytes, signature: bytes) -> dict:
    import base64
    import re

    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

    try:
        key_text = Path(__file__).with_name("release-key.txt").read_text(encoding="ascii").strip()
        key = Ed25519PublicKey.from_public_bytes(base64.b64decode(key_text, validate=True))
    except (OSError, ValueError):
        raise RuntimeError("This OCADE build does not have an update verification key.") from None
    if len(raw) > 4096 or len(signature) != 64:
        raise RuntimeError("The update manifest or signature is invalid.")
    try:
        key.verify(signature, raw)
        manifest = json.loads(raw)
    except (InvalidSignature, UnicodeDecodeError, ValueError):
        raise RuntimeError("The update signature did not pass verification.") from None
    keys = {"version", "platform", "architecture", "protocol", "archiveSha256", "treeSha256"}
    if not isinstance(manifest, dict) or manifest.keys() != keys:
        raise RuntimeError("The update manifest does not match the companion format.")
    version = manifest["version"]
    if not isinstance(version, str) or not re.fullmatch(r"\d{1,4}\.\d{1,4}\.\d{1,4}", version):
        raise RuntimeError("The update version is invalid.")
    for field in ("archiveSha256", "treeSha256"):
        value = manifest[field]
        if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value):
            raise RuntimeError("The update digest is invalid.")
    system, arch = discovery.dependency_platform()
    if system not in _RELEASE_ENTRY or (manifest["platform"], manifest["architecture"]) != (system, arch):
        raise RuntimeError("Choose an OCADE update for this operating system and architecture.")
    if type(manifest["protocol"]) is not int or manifest["protocol"] != PROTOCOL["version"]:
        raise RuntimeError("This update uses an incompatible companion protocol.")
    return manifest


def _release_tree(root: Path) -> str:
    """Hash paths and actual bytes, including confined macOS bundle symlinks."""
    import hashlib

    from .sandbox import sha256

    digest = hashlib.sha256()
    size = 0
    base = root.resolve()  # a folder reached through a link (macOS /var is /private/var) still holds its files
    paths = sorted(root.rglob("*"))
    if len(paths) > _RELEASE_FILES:
        raise RuntimeError("The update contains too many files.")
    for path in paths:
        name = path.relative_to(root).as_posix()
        if path.is_symlink():
            if not path.resolve(strict=True).is_relative_to(base):
                raise RuntimeError("An update link leaves the release directory.")
            entry = [name, "link", os.readlink(path)]
        elif path.is_dir():
            continue
        elif path.is_file():
            size += path.stat().st_size
            if size > _RELEASE_SIZE:
                raise RuntimeError("The unpacked update is too large.")
            entry = [name, "file", sha256(path)]
        else:
            raise RuntimeError("The update contains an unsupported file type.")
        digest.update((json.dumps(entry, ensure_ascii=True, separators=(",", ":")) + "\n").encode("ascii"))
    return digest.hexdigest()


def _installed_release(home: Path, release_id: str) -> tuple[Path, str]:
    import hashlib
    import re

    if not isinstance(release_id, str) or not re.fullmatch(r"[0-9a-f]{64}", release_id):
        raise RuntimeError("The saved update identifier is invalid.")
    releases = home.resolve() / "releases"
    slot = releases / release_id
    if slot.resolve() != slot or slot.is_symlink():
        raise RuntimeError("The release directory was changed.")
    with (slot / "manifest.json").open("rb") as stream:
        raw = stream.read(4097)
    if hashlib.sha256(raw).hexdigest() != release_id:
        raise RuntimeError("The saved update manifest was changed.")
    with (slot / "manifest.sig").open("rb") as stream:
        manifest = _release_info(raw, stream.read(65))
    root = slot / "app"
    executable = root / _RELEASE_ENTRY[manifest["platform"]]
    if root.is_symlink() or not executable.is_file() or not executable.resolve().is_relative_to(root):
        raise RuntimeError("The update executable is missing or was changed.")
    if _release_tree(root) != manifest["treeSha256"]:
        raise RuntimeError("The installed update no longer matches its manifest.")
    return executable.resolve(), manifest["version"]


def _release_state(home: Path) -> dict:
    state = home / "releases" / "active.json"
    if not state.exists():
        return {"active": None, "previous": None}
    with state.open("rb") as stream:
        saved = json.loads(stream.read(1024))
    if not isinstance(saved, dict) or saved.keys() != {"active", "previous"}:
        raise RuntimeError("The update state is unreadable.")
    return saved


def _no_active_jobs(home: Path) -> None:
    root = jobs.folder(home)
    if not root.is_dir():
        return
    for job in root.iterdir():
        if (job / "spec.json").is_file() and not (job / "exit.json").is_file():
            raise RuntimeError("Resolve or stop the outstanding tracked command before updating.")


def _activate_release(home: Path, manifest_path: Path, signature_path: Path, archive_path: Path) -> None:
    """Verify, stage and health-check a release before the single durable activation."""
    import hashlib
    import subprocess
    import tarfile
    import tempfile

    from .sandbox import sha256

    _no_active_jobs(home)
    with manifest_path.open("rb") as stream:
        raw = stream.read(4097)
    with signature_path.open("rb") as stream:
        signature = stream.read(65)
    manifest = _release_info(raw, signature)
    state = _release_state(home)
    version = _installed_release(home, state["active"])[1] if state["active"] else VERSION
    if tuple(map(int, manifest["version"].split("."))) <= tuple(map(int, version.split("."))):
        raise RuntimeError("Choose a newer signed release or use rollback-update.")
    if not 1 <= archive_path.stat().st_size <= _RELEASE_SIZE:
        raise RuntimeError("The update archive size is invalid.")
    root = home.resolve() / "releases"
    root.mkdir(mode=0o700, exist_ok=True)
    if root.is_symlink():
        raise RuntimeError("The release directory was changed.")
    release_id = hashlib.sha256(raw).hexdigest()
    slot = root / release_id
    if not slot.exists():
        with tempfile.TemporaryDirectory(dir=root, prefix=".staging-") as temp:
            stage = Path(temp) / "release"
            app = stage / "app"
            app.mkdir(parents=True, mode=0o700)
            # Copy the archive into private staging so the source path cannot change after validation.
            import shutil

            bundle = Path(temp) / "update.tar.gz"
            with archive_path.open("rb") as source, bundle.open("xb") as target:
                remaining = _RELEASE_SIZE
                while block := source.read(min(1024 * 1024, remaining + 1)):
                    remaining -= len(block)
                    if remaining < 0:
                        raise RuntimeError("The update archive exceeded its size bound.")
                    target.write(block)
            if sha256(bundle) != manifest["archiveSha256"]:
                raise RuntimeError("The update archive hash did not match.")
            with tarfile.open(bundle, "r:gz") as archive:
                paths = set()
                size = 0
                for member in archive:
                    name = member.name.rstrip("/")
                    parts = name.split("/")
                    normalized = name.casefold()
                    if (len(paths) >= _RELEASE_FILES or normalized in paths or
                            any(not part or part in (".", "..") or ":" in part or "\\" in part for part in parts)):
                        raise RuntimeError("The update archive contains an invalid or repeated path.")
                    # Containment only: a release (a macOS bundle with Chromium) has paths longer
                    # than the workspace rule's 260 characters, and names it would refuse.
                    inside = os.path.realpath(app.joinpath(*parts))
                    if os.path.commonpath([os.path.realpath(app), inside]) != os.path.realpath(app):
                        raise RuntimeError("An update entry does not stay in the release directory.")
                    paths.add(normalized)
                    size += member.size
                    if size > _RELEASE_SIZE or not (member.isfile() or member.isdir() or member.issym()):
                        raise RuntimeError("The update archive contains an unsupported entry.")
                    try:
                        archive.extract(member, app, filter="data")
                    except (tarfile.TarError, OSError):
                        raise RuntimeError("The update archive could not be safely extracted.") from None
            if _release_tree(app) != manifest["treeSha256"]:
                raise RuntimeError("The extracted update does not match the signed file tree.")
            (stage / "manifest.json").write_bytes(raw)
            (stage / "manifest.sig").write_bytes(signature)
            stage.rename(slot)

    executable, _ = _installed_release(home, release_id)
    from mcp.client.stdio import get_default_environment

    try:
        probe = subprocess.run(
            [str(executable), "check-update-runtime"], cwd=executable.parent,
            env={**get_default_environment(), "PYINSTALLER_RESET_ENVIRONMENT": "1"},
            stdin=subprocess.DEVNULL, capture_output=True, timeout=90,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise RuntimeError("The update did not start in time. The previous release is still active.") from None
    if probe.returncode != 0:
        raise RuntimeError("The update failed to start every required worker. The previous release is still active.")
    jobs._write(root / "active.json", {"active": release_id, "previous": state["active"]})


def _rollback_release(home: Path) -> None:
    _no_active_jobs(home)
    state = _release_state(home)
    if not state["active"]:
        raise RuntimeError("The installed base release is already active.")
    previous = state["previous"]
    if previous:
        _installed_release(home, previous)
    jobs._write(home / "releases" / "active.json", {"active": previous, "previous": None})


async def _check_update_runtime() -> None:
    import tempfile

    with tempfile.TemporaryDirectory(prefix="ocade-update-probe-") as fixture:
        async with Gateway(fixture, home=fixture) as gateway:
            for module in sorted(set(gateway.modules.values())):
                await gateway._session(module)


def main(argv: list[str] | None = None) -> int:
    # A frozen customer installer has its own verified Chromium; neither the
    # customer's Edge/Chrome nor a developer-level Playwright install is needed.
    if getattr(sys, "frozen", False):
        bundled_browsers = Path(getattr(sys, "_MEIPASS", "")) / "playwright-browsers"
        if bundled_browsers.is_dir():
            os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(bundled_browsers)
            marker = bundled_browsers / ".ocade-browser-path"
            if marker.is_file():
                browser = (bundled_browsers / marker.read_text(encoding="utf8").strip()).resolve()
                if browser.is_file() and browser.is_relative_to(bundled_browsers.resolve()):
                    os.environ["OCADE_BROWSER_EXECUTABLE"] = str(browser)
    parser = argparse.ArgumentParser(prog="ocade_agent")
    parser.add_argument(
        "command", nargs="?", default="run" if getattr(sys, "frozen", False) else None,
        choices=["enroll", "run", "stop", "worker", "diagnose", "forget", "tray", "bar",
                 "activate-update", "rollback-update", "check-update-runtime", "run-activated",
                 "mcp-update", "mcp-rollback"],
    )
    parser.add_argument("module", nargs="?", help=argparse.SUPPRESS)
    parser.add_argument("--server")
    parser.add_argument("--name", default=platform.node() or "My computer")
    parser.add_argument("--workspace")
    parser.add_argument("--until-idle", action="store_true")
    parser.add_argument("--no-browser", action="store_true", help="enroll without opening the pairing page")
    parser.add_argument("--browser-profile", action="store_true",
                        help="forget: also remove OCADE's own browser profile (its site sign-ins)")
    parser.add_argument("--session-minutes", type=float,
                        help="end after this many minutes when no task comes (default 30)")
    parser.add_argument("--always-on", action="store_true",
                        help="stay ready for tasks until stopped, instead of ending after a task")
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--signature", type=Path)
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--mcp", help="mcp-update / mcp-rollback: the approved server's id")
    parser.add_argument("--approved-by", help="mcp-update / mcp-rollback: who authorized the change")
    parser.add_argument("--accept-permission-changes", action="store_true",
                        help="mcp-update: accept new tools, higher risks or a new program")
    parser.add_argument("--tray-parent", type=int, help=argparse.SUPPRESS)
    parser.add_argument("--tray-website", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if args.command is None:
        parser.error("a command is required")
    home = default_home()
    if args.command == "tray":
        if sys.platform != "darwin" or args.tray_parent is None:
            return 3
        from .tray import run_macos_status

        return run_macos_status(home / "STOP", args.tray_website, args.tray_parent)
    if args.command == "bar":
        from .bar import run_bar

        return run_bar(home)
    if args.command == "check-update-runtime":
        try:
            anyio.run(_check_update_runtime)
        except Exception as error:
            print(f"Companion worker startup failed: {type(error).__name__}", file=sys.stderr)
            return 3
        return 0
    if args.command in {"activate-update", "rollback-update"}:
        try:
            with companion_lock(home):
                if args.command == "rollback-update":
                    _rollback_release(home)
                else:
                    if not (args.manifest and args.signature and args.archive):
                        parser.error("activate-update needs --manifest, --signature and --archive")
                    _activate_release(home, args.manifest, args.signature, args.archive)
        except (OSError, RuntimeError, ValueError) as error:
            print(f"Update refused: {error}", file=sys.stderr)
            return 3
        print("The selected release will start the next time you open OCADE.")
        return 0
    if args.command in {"mcp-update", "mcp-rollback"}:
        # Between tasks only: the lock is held by a running companion (REPO-25).
        if not (args.mcp and args.approved_by):
            parser.error(f"{args.command} needs --mcp and --approved-by")
        from . import catalog

        try:
            with companion_lock(home):
                outcome = (
                    catalog.promote(home, args.mcp, args.approved_by, args.accept_permission_changes)
                    if args.command == "mcp-update"
                    else catalog.rollback(home, args.mcp, args.approved_by)
                )
        except (OSError, RuntimeError) as error:
            print(f"Update refused: {error}", file=sys.stderr)
            return 3
        print(json.dumps(outcome, sort_keys=True))
        return 0 if outcome.get("promoted") or outcome.get("rolledBack") else 3
    if args.command == "worker":  # the packaged executable hosting one capability worker
        if args.module not in set(WORKERS.values()) | {"ocade_agent.job_runner"}:
            return 2
        runpy.run_module(args.module, run_name="__main__")
        return 0
    if args.command == "forget":
        try:
            with companion_lock(home):
                removed = forget_task_data(home, args.browser_profile)
        except RuntimeError as error:
            print(str(error), file=sys.stderr)
            return 3
        print("Removed: " + (", ".join(removed) if removed else "nothing (no JARVIS task data here)"))
        print("Kept: this computer's pairing, installed releases and every file in your JARVIS folder.")
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
        # The code rides in the fragment, which the browser never sends to a server; the signed-in
        # person still confirms it on the website (no email step, plan v8 5.5).
        link = f"{server.rstrip('/')}/ocade-jarvis?settings=devices#pair={enrolled['code']}"
        print(f"Or open: {link}")
        if not args.no_browser and sys.stdout.isatty():
            webbrowser.open(link)
        return 0
    try:
        with companion_lock(home):
            release = _select_release(home)
            if args.command == "run-activated":
                if release is None or Path(sys.executable).resolve() != release:
                    raise RuntimeError("The active release changed. Open OCADE again from its installed shortcut.")
                return _run_companion(device, home, args.until_idle, args.session_minutes, args.always_on)
            if release is None:
                return _run_companion(device, home, args.until_idle, args.session_minutes, args.always_on)
        # A different frozen bundle needs a fresh bootloader environment.
        import subprocess

        launch = [str(release), "run-activated", "--server", server, "--workspace", workspace]
        if args.until_idle:
            launch.append("--until-idle")
        if args.session_minutes is not None:
            launch += ["--session-minutes", str(args.session_minutes)]
        if args.always_on:
            launch.append("--always-on")
        return subprocess.call(launch, env={**os.environ, "PYINSTALLER_RESET_ENVIRONMENT": "1"})
    except (OSError, RuntimeError, ValueError) as error:
        print(f"Cannot start the companion: {error}", file=sys.stderr)
        return 3


def _select_release(home: Path) -> Path | None:
    state = _release_state(home)
    if not state["active"]:
        return None
    try:
        return _installed_release(home, state["active"])[0]
    except (OSError, RuntimeError, ValueError):
        print("The active update failed integrity checks. Restoring the previous release.", file=sys.stderr)
    previous = state["previous"]
    if previous:
        try:
            recovered = _installed_release(home, previous)[0]
            jobs._write(home / "releases" / "active.json", {"active": previous, "previous": None})
            return recovered
        except (OSError, RuntimeError, ValueError):
            pass
    jobs._write(home / "releases" / "active.json", {"active": None, "previous": None})
    return None


SESSION_MINUTES = 30.0
AFTER_TASK_SECONDS = 120.0  # a follow-up task within two minutes reuses the running companion


def _run_companion(device: Device, home: Path, until_idle: bool, session_minutes: float | None = None,
                   always_on: bool = False) -> int:
    (home / "STOP").unlink(missing_ok=True)  # starting again is the person's decision
    external, rejected = catalog.load(home)
    for entry in rejected:
        print(f"MCP manifest {entry['file']} not used: {entry['reason']}", file=sys.stderr)
    gateway = Gateway(device.config["workspace"], home=str(home), external=external)

    # A local STOP control is visible on Windows and macOS, independent of the server.
    tray = None
    if not until_idle and sys.platform in ("win32", "darwin"):
        from .tray import MacTray, WindowsTray

        tray_type = WindowsTray if sys.platform == "win32" else MacTray
        tray = tray_type(home / "STOP", f"{device.config['server'].rstrip('/')}/ocade-jarvis")
        if not tray.start():
            print("The companion menu icon could not be shown; STOP still works with `ocade_agent stop`.",
                  file=sys.stderr)
            tray = None

    # The floating bar over the app JARVIS works in (plan 14F.4); without a display it is skipped.
    bar = None
    if not until_idle and sys.platform in ("win32", "darwin"):
        from .bar import BarWindow

        bar = BarWindow(home)
        if not bar.start():
            bar = None

    async def go() -> str | None:
        async with gateway:
            try:
                with closing(Journal(home / "journal.sqlite")) as journal:
                    agent = Agent(device, journal, gateway)
                    if not always_on:
                        agent.session_idle_seconds = (session_minutes or SESSION_MINUTES) * 60
                        agent.after_task_seconds = AFTER_TASK_SECONDS
                    await agent.run(until_idle)
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
        held_input.release_held()
        print("Stopped.", file=sys.stderr)
    except Exception as error:
        report = record_crash(home, error)
        print(f"OCADE JARVIS stopped unexpectedly ({type(error).__name__}). A crash report with no file "
              f"contents or messages was saved for support: {report}", file=sys.stderr)
        return 4
    finally:
        if tray is not None:
            tray.close()  # the icon never outlives the companion
        if bar is not None:
            bar.close()
    return 0


CRASH_REPORTS_KEPT = 20


def record_crash(home: Path, error: BaseException) -> Path:
    """Save a structured crash report on this computer only (177).

    It names the release, platform, error type and the code locations involved, nothing
    else: no exception message, arguments or local values, which could hold file names,
    page text or credentials. It is never sent anywhere; `diagnose` points to the newest,
    and the person decides whether to share it. Only the newest few are kept.
    """
    frames = [{"file": Path(frame.filename).name, "line": frame.lineno, "function": frame.name}
              for frame in traceback.extract_tb(error.__traceback__)][-40:]
    report = {
        "schemaVersion": 1, "atUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "release": VERSION, "protocol": PROTOCOL["version"],
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(), "error": type(error).__name__, "frames": frames,
    }
    folder = home / "crash-reports"
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = folder / f"{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}-{os.getpid()}.json"
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    for old in sorted(folder.glob("*.json"))[:-CRASH_REPORTS_KEPT]:
        old.unlink(missing_ok=True)
    return path
