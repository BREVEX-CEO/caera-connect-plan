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

from ocade_computer import Computer, installed_apps  # noqa: E402
from ocade_identity import (PROTOCOL, SOFTWARE_VERSION, ClockSkew, Identity, NotEnrolled,  # noqa: E402
                            UpdateRequired)

BROWSER_ACTIONS = {"observe", "look", "open", "new_tab", "click", "type", "select", "press",
                   "scroll", "switch_tab", "close_tab", "back", "forward", "wait", "click_at",
                   "upload", "download"}
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
            "chrome", mode=mode, headless=self.headless,
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
                action["_folder"] = str(root / "Downloads")
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
            if not endpoint:
                return {"status": "blocked",
                        "summary": "Your browser is closed or does not allow JARVIS. Open it and "
                                   "turn on remote debugging at chrome://inspect/#remote-debugging"}
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
        self.state = {"busy": False, "background": False, "connected": True, "update": False,
                      "task": None, "offline": False}
        self.pending_path = identity.home / "pending.json"
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
        self.cancel.set()
        self.stop_all.set()

    def pause(self) -> None:
        """The person takes control: the step in progress ends, and nothing new runs until Resume."""
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

    def _load_pending(self) -> list[dict]:
        # Results finished before a crash, a reboot or a lost connection still reach OCADE.
        try:
            return json.loads(self.pending_path.read_text())
        except FileNotFoundError:
            return []
        except (OSError, ValueError):
            # Kept for diagnosis rather than silently overwritten.
            self.pending_path.replace(self.pending_path.with_suffix(".damaged"))
            return []

    def _keep_pending(self, results: list[dict]) -> None:
        if results:
            tmp = self.pending_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(results))
            tmp.chmod(0o600)
            os.replace(tmp, self.pending_path)  # never a half-written journal
        else:
            self.pending_path.unlink(missing_ok=True)

    def _halt(self, active: dict | None) -> None:
        """Cancel the running action and wait for it to end, before anything else happens."""
        self.cancel.set()
        if active:
            active["thread"].join(HALT_JOIN_S)
        self.browsers.close()

    def run(self) -> int:
        results = self._load_pending()
        reached = time.monotonic()
        frame: dict | None = None
        apps_sent = 0.0
        found: dict = {}  # the app inventory, found off this loop (it can take seconds)
        finder: threading.Thread | None = None
        active: dict | None = None  # {"id", "thread", "outcome"} of the action running now
        while not self.stop.is_set():
            if active and not active["thread"].is_alive():
                outcome, live = active["outcome"]
                results.append(outcome)
                self._keep_pending(results)
                if live:
                    frame = {"taskId": active["taskId"], "jpeg": live}
                active = None
            body = {"results": results, "frame": frame,
                    "capabilities": {**self.browsers.capabilities(), **self.computer.capabilities()},
                    "softwareVersion": SOFTWARE_VERSION,
                    "running": [active["id"]] if active else []}
            if self.stop_all.is_set():
                body["stop"] = True
            elif self.pause_asked.is_set():
                body["pause"] = True
            elif self.resume_asked.is_set():
                body["resume"] = True
            due = not apps_sent or time.monotonic() - apps_sent > APPS_EVERY_S
            if due and "apps" in found:
                body["apps"] = found.pop("apps")
            elif due and (finder is None or not finder.is_alive()):
                finder = threading.Thread(
                    target=lambda: found.update(apps=[a["name"] for a in installed_apps()]),
                    daemon=True, name="ocade-apps")
                finder.start()
            try:
                reply = self.identity.exchange(body)
            except NotEnrolled:
                # Removed in OCADE: the physical work stops first, then the key goes,
                # and nothing this device finishes afterwards is ever reported.
                self._halt(active)
                active = None
                self.identity.forget()
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
            results, frame = [], None
            self._keep_pending(results)
            if active and active["id"] in reply.get("cancel", []):
                self.cancel.set()  # stopped in OCADE (web STOP, Take Over, task ended)
            # OCADE hands out work only while nothing runs; one action at a time
            # owns this computer, and this loop keeps listening for STOP meanwhile.
            commands = [] if active else reply.get("commands", [])[:1]
            if commands and not self.stop.is_set():
                active = self._start(commands[0])
            elif reply.get("continue") and not active and not self.stop.is_set():
                self._carry_on(str(reply["continue"]))
            if active:
                active["thread"].join(POLL_IDLE_SECONDS)  # returns as soon as the action ends
            else:
                self.stop.wait(POLL_IDLE_SECONDS if self.state["busy"] else self.DORMANT_S)
        self._halt(active)
        return 0

    def _start(self, command: dict) -> dict:
        self.cancel = threading.Event()
        cancel = self.cancel
        active = {"id": command["id"], "taskId": command["taskId"],
                  "outcome": ({"id": command["id"], "status": "failed", "summary": "The action failed"}, None)}

        def work() -> None:
            active["outcome"] = self._execute(command, cancel)

        active["thread"] = threading.Thread(target=work, daemon=True, name="ocade-action")
        active["thread"].start()
        return active

    def _execute(self, command: dict, cancel: threading.Event | None = None) -> tuple[dict, str | None]:
        cancel = cancel or threading.Event()
        mode = command.get("mode", "isolated")
        action = command["action"]
        confirmed = bool(command.get("confirmed"))
        browser = action.get("action") in BROWSER_ACTIONS
        try:
            outcome = (self.browsers.run(mode, action, confirmed, command.get("sites", []), cancel,
                                         self.computer.root)
                       if browser else
                       self.computer.run(action, confirmed, bool(command.get("cowork")), cancel))
        except Exception as e:  # a crashed action is reported, never retried blindly
            outcome = {"status": "failed", "summary": f"The action failed ({type(e).__name__})"}
        live = (outcome.get("observation") or {}).pop("frame", None) or (
            self.browsers.frame(mode) if browser else None)
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
