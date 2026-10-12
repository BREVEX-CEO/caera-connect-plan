"""
OCADE JARVIS device runtime — the active entry point of the working engine.

It connects this machine to an OCADE account, then runs the actions a JARVIS
task queues for it. It holds no provider key and makes no model call:
intelligence stays in OCADE's Online authority, and this process only executes
and observes.

    python ocade_device.py connect --server https://ocade.in     # one click in OCADE, no codes
    python ocade_device.py run [--headless] [--real-browser-cdp http://127.0.0.1:9222]
    python ocade_device.py forget                                  # remove this device's key

`run` connects first when this machine is not connected yet. The device's own
key (see ocade_identity.py) is the only credential; removing the device in OCADE
ends its access at once and this process then deletes the local key.

The person's own browser is used when they allowed it twice: on this device
(remote debugging turned on in that browser, found through its own
DevToolsActivePort file, or `--real-browser-cdp` given here) and in OCADE (the
"Your own browser" permission for this computer). Otherwise only the isolated
automation browser exists.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import threading
import time
import urllib.error
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ocade_computer import _APPS, Computer, installed_apps  # noqa: E402
from ocade_identity import (PROTOCOL, SOFTWARE_VERSION, ClockSkew, Identity, NotEnrolled,  # noqa: E402
                            UpdateRequired)

BROWSER_ACTIONS = {"observe", "look", "open", "new_tab", "click", "type", "select", "press",
                   "scroll", "switch_tab", "close_tab", "back", "forward", "wait", "click_at",
                   "drag_at", "find_text", "upload", "download"}
APPS_EVERY_S = 3600
# With OCADE out of reach this long, a running action is stopped: nobody could STOP it remotely.
CONTROL_LOSS_S = 15.0
# Planning one step can take OCADE as long as its slowest answer; a step that
# failed or had nothing to do is not asked for again sooner than this.
CARRY_ON_TIMEOUT_S = 150.0
CARRY_ON_RETRY_S = 15.0
# How long a stopped action gets to end before the device lets go of it.
HALT_JOIN_S = 10.0

HOME = Path(os.environ.get("OCADE_JARVIS_HOME", Path.home() / ".ocade_jarvis"))
POLL_IDLE_SECONDS = 1.0
MAX_SEGMENT = 12
INTERRUPTED = "The agent stopped while this step ran, so what it did is unknown. Check before repeating it."  # steps one exchange may hand this agent (segment_v1)


def connect(server: str, name: str, open_browser: bool = True) -> Identity:
    identity = Identity(HOME)
    request = identity.enroll(server, name, platform.system()[:60])
    print(f"Confirm this computer in OCADE: {request['url']}", flush=True)
    print(f"It should show the fingerprint {request['fingerprint']}.", flush=True)
    if open_browser:
        webbrowser.open(request["url"])
    if not identity.wait_for_approval():
        identity.forget()
        raise SystemExit("The connection was not approved. Nothing was kept.")
    print(f"Connected as {name}.", flush=True)
    return identity


class Browsers:
    """
    One isolated session, plus the person's own running browser when it allows attaching.

    The own browser is found on this device (ocade_existing_browser: the
    DevToolsActivePort the browser itself writes when the person turns remote
    debugging on) or named explicitly with --real-browser-cdp. No add-on.
    """

    FIND_EVERY_S = 5.0

    def __init__(self, headless: bool, cdp: str | None):
        from actions.browser_control import _BrowserSession
        from ocade_egress import EgressProxy
        self.egress = EgressProxy()
        self._session = _BrowserSession
        self.headless = headless
        self.explicit = cdp
        self._found: tuple[float, dict | None] = (-1e9, None)
        self.sessions: dict = {}

    def endpoint(self) -> str | None:
        if self.explicit:
            return self.explicit
        at, found = self._found
        if time.monotonic() - at > self.FIND_EVERY_S:
            import ocade_existing_browser
            found = ocade_existing_browser.find()
            self._found = (time.monotonic(), found)
        return found["endpoint"] if found else None

    def capabilities(self) -> dict:
        return {"browser_isolated": True, "browser_real": bool(self.endpoint())}

    def _make(self, mode: str):
        return self._session(
            "browser", mode=mode, headless=self.headless,
            executable=os.environ.get("OCADE_BROWSER_EXECUTABLE") or None,
            cdp_endpoint=self.endpoint() if mode == "real" else None, egress=self.egress)

    def run(self, mode: str, action: dict, confirmed: bool, sites: list[str],
            cancel: threading.Event, root: Path | None = None) -> dict:
        if action.get("action") in ("upload", "download"):
            if root is None:
                return {"status": "blocked", "summary": "Choose a work folder in the OCADE tray first"}
            action = dict(action)
            if action["action"] == "upload":
                target = (root / str(action.get("path", ""))).resolve()
                if target != root and root not in target.parents or not target.is_file():
                    return {"status": "blocked", "summary": "Only a file inside the work folder can be attached"}
                action["_file"] = str(target)
            else:
                folder = (root / "Downloads").resolve()
                # A Downloads link planted in the work folder does not lead downloads out of it.
                if folder != root and root not in folder.parents:
                    return {"status": "blocked", "summary": "Downloads must stay inside the work folder"}
                action["_folder"] = str(folder)
        if mode == "real":
            endpoint = self.endpoint()
            if not endpoint and not self.explicit:
                import ocade_existing_browser
                # Closed: open the person's own browser (normal profile) and look again.
                if ocade_existing_browser.open_default():
                    deadline = time.monotonic() + 15
                    while not endpoint and time.monotonic() < deadline and not cancel.wait(0.5):
                        self._found = (-1e9, None)
                        endpoint = self.endpoint()
            if not endpoint and not self.explicit:
                import ocade_existing_browser
                # The browser's own one-time permission, which only the person can give:
                # open its page and hand over; Continue tries again once it is given.
                shown = ocade_existing_browser.open_setup()
                return {"status": "human_required",
                        "summary": (f"{shown} needs your permission once for JARVIS to work in it. "
                                    f"On the page {shown} just opened, turn on “Allow remote debugging "
                                    f"for this browser instance”, choose Allow if {shown} asks, then "
                                    "press Continue.") if shown else
                        "Open your browser so JARVIS can work in it, then press Continue."}
            if not endpoint:
                return {"status": "blocked", "summary": "Your browser could not be reached. Open it and try again."}
            held = self.sessions.get("real")
            if held is not None and held.cdp_endpoint != endpoint:
                # The browser restarted: the old connection is gone.
                self._drop("real")
        self.egress.policy.allowed = frozenset(s.lower() for s in sites)
        session = self.sessions.get(mode)
        if session is None:
            session = self.sessions[mode] = self._make(mode)
            session.start()
        try:
            return session.run(session.act(action, confirmed), timeout=90, cancel=cancel)
        except Exception:
            if mode == "real":
                self._drop("real")  # reconnect on the next action, never replay this one
            raise

    def _drop(self, mode: str) -> None:
        session = self.sessions.pop(mode, None)
        if session is not None:
            try:
                session.close()
            except Exception:  # a dead connection has nothing left to close
                pass

    def close(self) -> None:
        for mode in list(self.sessions):
            self._drop(mode)

    def frame(self, mode: str) -> str | None:
        session = self.sessions.get(mode)
        try:
            return session.run(session.frame(), timeout=20) if session else None
        except Exception:  # a missed frame is only a missed picture
            return None


class Agent:
    """
    The exchange loop, with the lifecycle the roadmap sets: busy while a task is
    open, dormant otherwise (one quiet check every few seconds), results kept on
    disk until OCADE has them, and an explicit global Stop.
    """

    DORMANT_S = 5.0

    def __init__(self, identity: Identity, headless: bool, cdp: str | None, workspace: str | None):
        self.identity = identity
        self.browsers = Browsers(headless, cdp)
        self.settings_path = identity.home / "settings.json"
        # The work folder the person chose (tray: Choose work folder...), unless one was given here.
        self.computer = Computer(workspace or self._settings().get("workspace"))
        self.stop = threading.Event()
        self.stop_all = threading.Event()
        # Pause/Resume from the tray: OCADE hands the task to the person, then back.
        self.pause_asked = threading.Event()
        self.resume_asked = threading.Event()
        # The cancellation token of the action running now; every STOP sets it
        # synchronously, before any network round trip.
        self.cancel = threading.Event()
        self._admit = threading.Lock()
        self.state = {"busy": False, "background": False, "connected": True, "update": False,
                      "task": None, "offline": False}
        self.pending_path = identity.home / "pending.json"
        self.intent_path = identity.home / "running.json"  # steps handed to the computer, not yet reported
        self._planning: threading.Thread | None = None
        self._plan_after = 0.0

    def _carry_on(self, task_id: str) -> None:
        """
        Background Mode, and the person closed OCADE: ask OCADE for the task's
        next step. OCADE plans it and queues it like any other action, so it
        arrives through the exchange with every check made again; nothing is
        decided here. Asked off the exchange loop, which keeps listening for STOP.
        """
        if (self._planning and self._planning.is_alive()) or time.monotonic() < self._plan_after:
            return

        def ask() -> None:
            try:
                status, reply = self.identity.post(PROTOCOL["paths"]["continue"], {"taskId": task_id},
                                                   timeout=CARRY_ON_TIMEOUT_S)
                quiet = status != 200 or reply.get("state") == "idle"
            except Exception:
                quiet = True
            if quiet:  # never a tight loop against a step that cannot be planned
                self._plan_after = time.monotonic() + CARRY_ON_RETRY_S

        self._planning = threading.Thread(target=ask, daemon=True, name="ocade-carry-on")
        self._planning.start()

    def _settings(self) -> dict:
        try:
            return json.loads(self.settings_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def set_workspace(self, folder: str | None) -> None:
        """The one folder files, spreadsheets and commands may use. Never a whole drive or the home folder."""
        if folder:
            chosen = Path(folder).resolve()
            if chosen == chosen.parent or chosen == Path.home().resolve() or not chosen.is_dir():
                raise ValueError("Choose a specific folder, not a whole drive or your home folder")
        settings = {**self._settings(), "workspace": str(Path(folder).resolve()) if folder else None}
        tmp = self.settings_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(settings), encoding="utf-8")
        os.replace(tmp, self.settings_path)
        self.computer.root = Path(folder).resolve() if folder else None

    def stop_everything(self) -> None:
        """STOP JARVIS on this computer: the running action now, the rest at OCADE."""
        with self._admit:  # never between an action's admission and its token: see _start
            self.cancel.set()
            self.stop_all.set()

    def pause(self) -> None:
        """The person takes control: the step in progress ends, and nothing new runs until Resume."""
        with self._admit:
            self.cancel.set()
            self.resume_asked.clear()
            self.pause_asked.set()

    def resume(self) -> None:
        self.pause_asked.clear()
        self.resume_asked.set()

    def status(self) -> str:
        """One truthful word for the tray."""
        task = self.state.get("task") or {}
        if self.stop_all.is_set():
            return "Stopping"
        if self.state.get("clock"):
            return "Check this computer's clock"
        if self.state.get("offline"):
            return "Offline"
        if self.pause_asked.is_set() or task.get("status") == "taken_over":
            return "Paused"
        if task.get("status") == "waiting":
            return "Waiting for you"
        return "Working" if self.state.get("busy") else "Ready"

    @staticmethod
    def _read(path: Path) -> list:
        try:
            return json.loads(path.read_text())
        except FileNotFoundError:
            return []
        except (OSError, ValueError):
            # Kept for diagnosis rather than silently overwritten.
            path.replace(path.with_suffix(".damaged"))
            return []

    @staticmethod
    def _keep(path: Path, items: list) -> None:
        if items:
            tmp = path.with_suffix(".tmp")
            with open(tmp, "w", encoding="utf-8") as out:
                out.write(json.dumps(items))
                out.flush()
                os.fsync(out.fileno())  # on disk before it replaces the journal, not just cached
            tmp.chmod(0o600)
            os.replace(tmp, path)  # never a half-written journal
        else:
            path.unlink(missing_ok=True)
        if os.name == "posix":  # the rename itself survives a power cut once its folder is synced
            folder = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(folder)
            finally:
                os.close(folder)

    def _load_pending(self) -> list[dict]:
        # Results finished before a crash, a reboot or a lost connection still reach OCADE.
        results = self._read(self.pending_path)
        # A step that was running when the agent stopped: its effect is unknown, never "not done".
        reported = {result.get("id") for result in results}
        results += [{"id": step, "status": "failed", "summary": INTERRUPTED}
                    for step in self._read(self.intent_path) if step not in reported]
        self._keep(self.pending_path, results)
        self._keep(self.intent_path, [])
        return results

    def _keep_pending(self, results: list[dict]) -> None:
        self._keep(self.pending_path, results)

    def _halt(self, active: dict | None) -> None:
        """Cancel the running action and wait for it to end, before anything else happens."""
        self.cancel.set()
        if active:
            active["thread"].join(HALT_JOIN_S)
        self.browsers.close()

    def run(self) -> int:
        try:
            return self._exchange_loop()
        finally:  # what this agent owns ends with it: the network boundary and the input hooks
            self.browsers.egress.close()
            self.computer.guard.stop()

    def _exchange_loop(self) -> int:
        results = self._load_pending()
        reached = time.monotonic()
        frame: dict | None = None
        apps_sent = 0.0
        found: dict = {}  # the app inventory, found off this loop (it can take seconds)
        finder: threading.Thread | None = None
        active: dict | None = None  # the segment running now: {"id", "left", "done", "skip", "thread"}
        while not self.stop.is_set():
            if active:
                if not active["left"]:
                    # Every step has run; only the last result is being appended. Waiting for it
                    # keeps "nothing running" and "segment over" one fact, so the next segment
                    # OCADE hands out is never ignored while this one winds down.
                    active["thread"].join(5)
                finished = not active["thread"].is_alive()  # read first: nothing is appended after it
                while active["done"]:
                    outcome, live = active["done"].pop(0)
                    results.append(outcome)
                    if live:
                        frame = {"taskId": active["taskId"], "jpeg": live[0], "capturedAt": live[1]}
                self._keep_pending(results)
                if finished:
                    self._keep(self.intent_path, [])
                    active = None
            body = {"results": results, "frame": frame,
                    "capabilities": {**self.browsers.capabilities(), **self.computer.capabilities(),
                                     "segment_v1": True},
                    "softwareVersion": SOFTWARE_VERSION,
                    "running": list(active["left"]) if active else []}
            if self.stop_all.is_set():
                body["stop"] = True
            elif self.pause_asked.is_set():
                body["pause"] = True
            elif self.resume_asked.is_set():
                body["resume"] = True
            due = not apps_sent or time.monotonic() - apps_sent > APPS_EVERY_S
            if _APPS["at"] > apps_sent:
                # Just looked (the apps action, or an app opened after an install): OCADE learns
                # of a new app now, not at the next hourly look (audit C08).
                body["apps"] = [a["name"] for a in _APPS["list"]]
            elif due and "apps" in found:
                body["apps"] = found.pop("apps")
            elif due and (finder is None or not finder.is_alive()):
                finder = threading.Thread(
                    target=lambda: found.update(apps=[a["name"] for a in installed_apps()]),
                    daemon=True, name="ocade-apps")
                finder.start()
            # The control-loss bound holds while the exchange itself is blocked, not only after it
            # fails: past it, the running action is cancelled whatever the network is doing.
            watch = threading.Timer(max(0.0, CONTROL_LOSS_S - (time.monotonic() - reached)),
                                    lambda: self.cancel.set()) if active else None
            if watch:
                watch.daemon = True
                watch.start()
            try:
                reply = self.identity.exchange(body)
            except NotEnrolled:
                # Removed in OCADE: the physical work stops first, then the key goes, and nothing
                # this device finishes afterwards is ever reported. What it did but could not
                # report is kept on this computer, not lost with the key.
                self._halt(active)
                results += [outcome for outcome, _live in (active or {}).get("done", [])]
                active = None
                self.identity.forget()
                self._keep(self.pending_path, results)
                kept = self.pending_path.with_name("unreported-results.json")
                self._keep(kept, self._read(kept) + self._load_pending())
                self.pending_path.unlink(missing_ok=True)
                self.state["connected"] = False
                print("This device is no longer connected. Its key was removed.", flush=True)
                return 2
            except UpdateRequired:
                self._halt(active)
                self.state["update"] = True
                print("OCADE needs a newer Device Agent. Nothing more runs until it updates.", flush=True)
                return 3
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
                self.state["clock"] = isinstance(e, ClockSkew)
                # Fail closed: work OCADE can no longer see or stop does not continue.
                if active and time.monotonic() - reached > CONTROL_LOSS_S:
                    self.cancel.set()
                self.state["offline"] = time.monotonic() - reached > CONTROL_LOSS_S
                self._keep_pending(results)
                self.stop.wait(3 if not active else POLL_IDLE_SECONDS)
                continue
            finally:
                if watch:
                    watch.cancel()
            self.state["reached"] = True
            self.state["offline"] = False
            self.state["clock"] = False
            reached = time.monotonic()
            if "apps" in body:
                apps_sent = time.monotonic()
            if body.get("stop"):
                self.stop_all.clear()
            if body.get("pause"):
                self.pause_asked.clear()
            if body.get("resume"):
                self.resume_asked.clear()
            self.state.update(busy=bool(reply.get("busy")), background=bool(reply.get("background")),
                              task=reply.get("task"))
            results, frame = self._unanswered(results, reply), None
            self._keep_pending(results)
            if active:
                stopped = set(reply.get("cancel", []))
                active["skip"].update(stopped)  # steps still to come never start
                if active["id"] in stopped and active["id"] in active["left"]:
                    self.cancel.set()  # stopped in OCADE (web STOP, Take Over, task ended)
            # OCADE hands out work only while nothing runs; one segment at a time
            # owns this computer, and this loop keeps listening for STOP meanwhile.
            commands = [] if active else reply.get("commands", [])[:MAX_SEGMENT]
            # STOP or Pause pressed while this exchange was on its way: the work it
            # handed out never starts; OCADE hears the STOP on the next exchange.
            if commands and (self.stop_all.is_set() or self.pause_asked.is_set()):
                results.extend({"id": c["id"], "status": "failed", "summary": "Stopped before it started"}
                               for c in commands)
                self._keep_pending(results)
                commands = []
            if commands and not self.stop.is_set():
                active = self._start(commands)
            elif reply.get("continue") and not active and not self.stop.is_set():
                self._carry_on(str(reply["continue"]))
            if active:
                active["thread"].join(POLL_IDLE_SECONDS)  # returns as soon as the action ends
            else:
                self.stop.wait(POLL_IDLE_SECONDS if self.state["busy"] else self.DORMANT_S)
        self._halt(active)
        if self.stop_all.is_set():
            # Exit with a task open: OCADE hears the STOP before the agent ends, best effort;
            # whatever it did not receive stays in the journal for the next start.
            results += [outcome for outcome, _live in (active or {}).get("done", [])]
            try:
                reply = self.identity.exchange({"results": results, "stop": True, "running": []})
                results = self._unanswered(results, reply)
            except Exception:
                pass
            self._keep_pending(results)
        return 0

    @staticmethod
    def _unanswered(results: list[dict], reply: dict) -> list[dict]:
        """Only what OCADE answered for leaves the journal: a result it could not save, or did
        not answer for at all, goes again. An old server that sends no answers kept them all."""
        if "acks" not in reply:
            return []
        answers = {a.get("id"): a.get("outcome") for a in reply.get("acks") or []}
        return [r for r in results if answers.get(r.get("id"), "retry") == "retry"]

    def _start(self, commands: list[dict]) -> dict:
        """Run a segment in order, one action at a time. After a step that did not finish, or a
        STOP, the rest never start: each is reported skipped, never as done."""
        # The new token is published and checked against STOP/Pause in one step: a STOP pressed
        # just before cannot be lost on the old token while this segment starts on a fresh one.
        with self._admit:
            cancel = self.cancel = threading.Event()
            if self.stop_all.is_set() or self.pause_asked.is_set():
                cancel.set()
        active = {"id": commands[0]["id"], "taskId": commands[0]["taskId"],
                  "left": [c["id"] for c in commands], "done": [], "skip": set()}
        self._keep(self.intent_path, list(active["left"]))  # written before anything runs

        def work() -> None:
            ended = False
            for command in commands:
                if ended or cancel.is_set() or command["id"] in active["skip"]:
                    # "skipped" exists only for servers that sent a segment; a first step stays "failed".
                    outcome = ({"id": command["id"], "status": "failed", "summary": "Stopped before it started"}
                               if command is commands[0] else
                               {"id": command["id"], "status": "skipped",
                                "summary": "Not run: a step before it did not finish"}, None)
                else:
                    active["id"] = command["id"]
                    outcome = self._execute(command, cancel)
                    ended = outcome[0].get("status") != "done"
                active["left"].remove(command["id"])  # before its result is visible: never both
                active["done"].append(outcome)

        active["thread"] = threading.Thread(target=work, daemon=True, name="ocade-action")
        active["thread"].start()
        return active

    def _execute(self, command: dict, cancel: threading.Event | None = None) -> tuple[dict, str | None]:
        cancel = cancel or threading.Event()
        mode = command.get("mode", "isolated")
        action = command["action"]
        confirmed = bool(command.get("confirmed"))
        browser = action.get("action") in BROWSER_ACTIONS
        started = time.monotonic()
        try:
            if browser:
                outcome = self.browsers.run(mode, action, confirmed, command.get("sites", []), cancel,
                                            self.computer.root)
            else:
                self.computer.refuse_apps(command.get("never") or [])
                outcome = self.computer.run(action, confirmed, cancel)
        except Exception as e:  # a crashed action is reported, never retried blindly
            outcome = {"status": "failed", "summary": f"The action failed ({type(e).__name__})"}
        # How long the computer itself took, for measuring where a task's time goes (audit G).
        outcome["ms"] = round((time.monotonic() - started) * 1000)
        live = (outcome.get("observation") or {}).pop("frame", None) or (
            self.browsers.frame(mode) if browser else None)
        if live:  # with the moment it was taken, so a late picture is never shown as new
            live = (live, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        core = {k: outcome.pop(k) for k in ("status", "summary", "changed", "observation") if k in outcome}
        return {"id": command["id"], **core, **({"detail": outcome} if outcome else {})}, live


def run(headless: bool, cdp: str | None, server: str | None, workspace: str | None = None) -> int:
    identity = Identity(HOME)
    if not identity.connected:
        if not server:
            raise SystemExit("This computer is not connected. Run: ocade_device.py connect --server URL")
        identity = connect(server, platform.node()[:120] or "My computer")
    print(f"OCADE JARVIS device running for {identity.meta['server']}. Ctrl+C to stop.", flush=True)
    return Agent(identity, headless, cdp, workspace).run()


def main() -> None:
    parser = argparse.ArgumentParser(prog="ocade_device")
    sub = parser.add_subparsers(dest="command", required=True)
    c = sub.add_parser("connect")
    c.add_argument("--server", required=True)
    c.add_argument("--name", default=platform.node()[:120] or "My computer")
    c.add_argument("--no-browser", action="store_true", help="print the link instead of opening it")
    r = sub.add_parser("run")
    r.add_argument("--server", default=None, help="connect to this OCADE first if needed")
    r.add_argument("--headless", action="store_true")
    r.add_argument("--real-browser-cdp", default=None)
    r.add_argument("--workspace", default=None,
                   help="the one folder JARVIS may read, change and run commands in")
    sub.add_parser("forget")
    args = parser.parse_args()
    if args.command == "connect":
        connect(args.server, args.name, open_browser=not args.no_browser)
    elif args.command == "forget":
        Identity(HOME).forget()
        print("This computer's OCADE key was removed.")
    else:
        sys.exit(run(args.headless, args.real_browser_cdp, args.server, args.workspace))


if __name__ == "__main__":
    main()
