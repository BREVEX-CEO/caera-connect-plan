"""
The OCADE Device Agent: what a person installs once and then forgets.

    ocade-agent                 start (connects first if needed), with one tray icon
    ocade-agent --uninstall     stop, remove autostart, the key and the local cache

It starts with the computer as a dormant supervisor (see Agent.DORMANT_S) and
becomes active only while a JARVIS task is open on this computer or the person
turned on Background Mode. There is exactly one OCADE presence: a second start
finds the first one and exits. The tray icon is the whole desktop presence: its
status (Ready, Working, Waiting for you, Paused, Stopping, Offline), Open OCADE
JARVIS, STOP JARVIS, Pause/Resume while a task is open, and Exit.

Everything here is the lifecycle. The work itself is ocade_device.Agent; the
identity is ocade_identity; updates are ocade_update.
"""
from __future__ import annotations

import argparse
import hmac
import json
import os
import platform
import secrets
import shutil
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import ocade_device  # noqa: E402
import ocade_update  # noqa: E402
from ocade_identity import SOFTWARE_VERSION, Identity, UpdateRequired  # noqa: E402

SINGLE_INSTANCE_PORT = 47831
# "exit" plus a secret only this account can read: another account's process on
# the same computer can reach the loopback port, never end this agent through it.
_EXIT_WORD: bytes | None = None
APP_NAME = "OCADE Device Agent"
# Said first on every connection, so a stranger on the port is not taken for the agent (F-111).
GREETING = b"OCADE-agent\n"


def single_instance() -> socket.socket | None:
    """Hold a loopback port for the life of the process. None when another agent holds it."""
    guard = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        guard.bind(("127.0.0.1", SINGLE_INSTANCE_PORT))
        guard.listen(1)
    except OSError:
        guard.close()
        return None
    global _EXIT_WORD
    token = secrets.token_hex(16)
    path = ocade_device.HOME / "exit.token"
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as handle:
            handle.write(token)
        os.replace(tmp, path)
        _EXIT_WORD = f"exit {token}".encode()
    except OSError:
        _EXIT_WORD = None  # unwritable: nothing can ask it to exit; ending the process still works
    return guard


def serve_exit(guard: socket.socket, on_exit) -> None:
    """The single-instance port also answers the uninstaller's "exit", locally only."""
    def loop() -> None:
        while True:
            try:
                conn, _ = guard.accept()
            except OSError:
                return  # the guard closed: this agent is ending
            with conn:
                conn.settimeout(2)
                try:
                    conn.sendall(GREETING)
                    asked = conn.recv(64)
                    if _EXIT_WORD and hmac.compare_digest(asked, _EXIT_WORD):
                        conn.sendall(b"ok")
                        on_exit()
                except OSError:
                    pass
    threading.Thread(target=loop, daemon=True, name="ocade-single-instance").start()


def stop_running_agent(timeout_s: float = 8.0) -> bool:
    """Ask a running agent to stop, and wait until it has. True when none is left running."""
    try:
        token = (ocade_device.HOME / "exit.token").read_text().strip()
        with socket.create_connection(("127.0.0.1", SINGLE_INSTANCE_PORT), timeout=2) as conn:
            conn.sendall(f"exit {token}".encode())
            conn.recv(8)
    except OSError:
        pass  # nothing is listening: no agent is running
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        probe = single_instance()
        if probe is not None:
            probe.close()
            return True
        time.sleep(0.2)
    return False


def already_running() -> bool:
    """True when an agent holds the single-instance port. Asked before a start is counted: a
    second start (the login entry, the Start menu, an installer) was counted as a failed start
    of the running build, and three of them rolled a good build back."""
    try:
        with socket.create_connection(("127.0.0.1", SINGLE_INSTANCE_PORT), timeout=1) as conn:
            conn.settimeout(1)
            try:
                said = conn.recv(len(GREETING))
            except socket.timeout:
                # An agent from before the greeting says nothing; it left this account's token.
                return (ocade_device.HOME / "exit.token").exists()
            return said == GREETING
    except OSError:
        return False


def end_other_agents() -> bool:
    """End every other process of this installed program. True when some were ended."""
    root = install_root()
    if root is None:
        return False  # not an installed build: nothing here is ours to end
    import psutil
    ended = []
    for process in psutil.process_iter(["pid", "exe"]):
        try:
            exe = Path(process.info["exe"] or "").resolve()
            if process.info["pid"] != os.getpid() and root in exe.parents and exe.name == Path(sys.executable).name:
                for each in (*process.children(recursive=True), process):
                    each.kill()
                ended.append(process)
        except (psutil.Error, OSError):
            continue
    psutil.wait_procs(ended, timeout=5)
    return bool(ended)


def _launch_command() -> list[str]:
    if getattr(sys, "frozen", False):  # the packaged app
        return [sys.executable]
    return [sys.executable, str(Path(__file__).resolve())]


AUTOSTART_NAME = "OCADE"  # the login entry (Windows: the HKCU Run value)


def autostart_path() -> Path:
    system = platform.system()
    if system == "Darwin":
        return Path.home() / "Library/LaunchAgents/in.ocade.agent.plist"
    if system == "Windows":
        return Path("HKCU/Software/Microsoft/Windows/CurrentVersion/Run/OCADE")  # registry, see below
    return Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "autostart/ocade-agent.desktop"


def install_autostart() -> None:
    """Start the dormant supervisor at login. The installer calls this once."""
    command = _launch_command()
    system = platform.system()
    if system == "Windows":
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                            r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, AUTOSTART_NAME, 0, winreg.REG_SZ, " ".join(f'"{c}"' for c in command))
        return
    path = autostart_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    if system == "Darwin":
        args = "".join(f"<string>{c}</string>" for c in command)
        path.write_text(
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
            '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
            '<plist version="1.0"><dict><key>Label</key><string>in.ocade.agent</string>'
            f"<key>ProgramArguments</key><array>{args}</array>"
            "<key>RunAtLoad</key><true/><key>ProcessType</key><string>Background</string>"
            "</dict></plist>\n")
    else:
        path.write_text("[Desktop Entry]\nType=Application\nName=OCADE Device Agent\n"
                        f"Exec={' '.join(command)}\nX-GNOME-Autostart-enabled=true\nNoDisplay=true\n")


def remove_autostart() -> None:
    if platform.system() == "Windows":
        import winreg
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                                r"Software\Microsoft\Windows\CurrentVersion\Run", 0,
                                winreg.KEY_SET_VALUE) as key:
                winreg.DeleteValue(key, AUTOSTART_NAME)
        except FileNotFoundError:
            pass
        return
    autostart_path().unlink(missing_ok=True)


def uninstall(home: Path) -> str:
    """Everything this agent put on the computer, except the program files the OS uninstaller owns."""
    # Whatever happens next, it no longer starts at login.
    remove_autostart()
    # The running agent stops first: its key is never deleted under it. One that
    # does not answer is ended: an uninstall must not leave a program running.
    if not stop_running_agent() and not (end_other_agents() and stop_running_agent(3)):
        raise SystemExit("OCADE Device Agent is still running and could not be stopped. "
                         "Exit it from the tray, then uninstall again.")
    identity = Identity(home)
    if identity.connected:
        try:  # this computer's key stops working in OCADE too
            identity.exchange({"results": [], "forget": True})
        except Exception:
            pass  # offline: the person can still remove it in OCADE Devices
    shutil.rmtree(home, ignore_errors=True)  # the key, pending results and the cache
    return ("OCADE Device Agent was removed from this computer. PC control, background tasks and "
            "wake features have stopped. Your OCADE conversations and task history stay in your "
            "account until you delete them there.")


class Presence:
    """The one tray icon: OCADE's whole presence on the desktop."""

    def __init__(self, agent: ocade_device.Agent, server: str):
        self.agent = agent
        self.server = server.rstrip("/")
        self.icon = None

    def open_ocade(self) -> None:
        webbrowser.open(f"{self.server}/ocade-jarvis")

    def stop_jarvis(self) -> None:
        self.agent.stop_everything()

    def _folder_label(self) -> str:
        root = self.agent.computer.root
        return f"Work folder: {root.name}" if root else "Choose work folder..."

    def choose_folder(self) -> None:
        """Files, spreadsheets and commands stay inside the one folder chosen here."""
        try:
            from tkinter import Tk, filedialog
            root = Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            folder = filedialog.askdirectory(title="Choose the folder JARVIS may work in")
            root.destroy()
        except Exception as e:
            self._notify(f"The folder could not be chosen ({type(e).__name__}).")
            return
        if folder:
            try:
                self.agent.set_workspace(folder)
            except ValueError as e:
                self._notify(str(e))
                return
            if self.icon is not None:
                self.icon.update_menu()

    def exit(self) -> None:
        if self.agent.state["busy"] and not self._ask("JARVIS is working on a task. Stop it and exit?"):
            return
        if self.agent.state["busy"]:
            self.agent.stop_everything()
        self.agent.stop.set()
        if self.icon is not None:
            self.icon.stop()

    @staticmethod
    def _notify(message: str) -> None:
        print(message, flush=True)
        try:
            from tkinter import Tk, messagebox
            root = Tk()
            root.withdraw()
            messagebox.showerror(APP_NAME, message)
            root.destroy()
        except Exception:
            pass

    def notify(self, message: str) -> None:
        """A system notification from the tray icon (never a blocking dialog)."""
        print(message, flush=True)
        try:
            if self.icon is not None:
                self.icon.notify(message, APP_NAME)
                time.sleep(3)
        except Exception:
            pass

    def _ask(self, question: str) -> bool:
        try:
            from tkinter import messagebox
            return bool(messagebox.askyesno(APP_NAME, question))
        except Exception:
            return True  # no dialog available: the person chose Exit

    def start_tray(self) -> str | None:
        """None when the tray icon is up, else why not (kept in the local log)."""
        try:
            import pystray
        except Exception as e:
            return f"tray unavailable ({type(e).__name__}: {e})"
        image = _tray_image()
        menu = pystray.Menu(
            pystray.MenuItem(lambda _: self.agent.status(), None, enabled=False),
            pystray.MenuItem(lambda _: _wake_words(self.agent), None, enabled=False),
            pystray.MenuItem("Open OCADE JARVIS", lambda: self.open_ocade(), default=True),
            pystray.MenuItem("STOP JARVIS", lambda: self.stop_jarvis()),
            pystray.MenuItem("Pause JARVIS", lambda: self.agent.pause(),
                             visible=lambda _: self.agent.status() in ("Working", "Waiting for you")),
            pystray.MenuItem("Resume JARVIS", lambda: self.agent.resume(),
                             visible=lambda _: self.agent.status() == "Paused"),
            pystray.MenuItem(lambda _: self._folder_label(), lambda: self.choose_folder()),
            pystray.MenuItem("Exit", lambda: self.exit()),
        )
        try:
            self.icon = pystray.Icon("ocade", image, "OCADE JARVIS", menu)
            self.icon.run_detached()
        except Exception as e:
            return f"tray failed to start ({type(e).__name__}: {e})"
        threading.Thread(target=self._follow_status, daemon=True, name="ocade-tray-status").start()
        return None

    def _follow_status(self) -> None:
        """Windows builds the tray menu once; rebuild it whenever the status or the wake line
        changes (it said "Wake: on with Background Mode" while it was already listening)."""
        shown = None
        while not self.agent.stop.wait(1):
            status = self.agent.status()
            now = (status, _wake_words(self.agent))
            if now != shown and self.icon is not None:
                shown = now
                self.icon.title = f"OCADE JARVIS · {status}"
                self.icon.update_menu()


def _tray_image():
    from PIL import Image, ImageDraw
    image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    ImageDraw.Draw(image).ellipse((6, 6, 58, 58), fill=(20, 20, 20, 255), outline=(236, 236, 236, 255), width=4)
    return image


RETRY_CONNECT_S = 15


def await_connection(server: str, name: str, show, open_page, again: threading.Event,
                     can_ask_again: bool, identity_at=Identity, retry_s: float = RETRY_CONNECT_S) -> Identity:
    """
    Ask OCADE to connect this computer and wait for the person to approve it.

    Offline, it keeps trying quietly. Not approved, it opens nothing by itself
    again: the person asks from the tray. The page opens once per request.
    """
    while True:
        identity = identity_at(ocade_device.HOME)
        try:
            request = identity.enroll(server, name, platform.system()[:60])
        except UpdateRequired:
            raise
        except RuntimeError:  # OCADE answered and refused (too many requests waiting, or a damaged key)
            show("Not connected", None)
            if not can_ask_again:
                raise SystemExit("OCADE did not accept the connection request.")
            again.wait()
            again.clear()
            continue
        except OSError:  # no network yet: a laptop that starts before its Wi-Fi
            show("Offline", None)
            if again.wait(retry_s):
                again.clear()
            continue
        print(f"Confirm this computer in OCADE: {request['url']}", flush=True)
        print(f"It should show the fingerprint {request['fingerprint']}.", flush=True)
        show("Waiting to be connected", request["url"])
        open_page(request["url"])
        if identity.wait_for_approval():
            return identity
        identity.forget()
        show("Not connected", None)
        if not can_ask_again:
            raise SystemExit("The connection was not approved. Nothing was kept.")
        again.wait()
        again.clear()


def connect_with_tray(server: str, name: str, ending: dict) -> Identity:
    """
    First start. OCADE is already its one tray icon while it waits, so the
    person can see it, open the page again and exit it, and an uninstall can end
    it. It used to wait with no icon and no way to stop it: uninstalling then
    left the program running and still starting at every login.
    """
    state = {"status": "Connecting", "url": None}
    again = threading.Event()
    icon = None

    def reconnect() -> None:
        webbrowser.open(state["url"]) if state["url"] else again.set()

    try:
        import pystray
        icon = pystray.Icon("ocade", _tray_image(), "OCADE JARVIS", pystray.Menu(
            pystray.MenuItem(lambda _: state["status"], None, enabled=False),
            pystray.MenuItem("Connect this computer", lambda: reconnect(), default=True),
            pystray.MenuItem("Exit", lambda: ending["stop"]())))
        icon.run_detached()
    except Exception:
        icon = None  # the agent's own tray start reports why, once connected

    def stop() -> None:
        if icon is not None:
            icon.stop()
        os._exit(0)  # nothing is running yet: no task, no browser, no key in use

    def show(status: str, url: str | None) -> None:
        state.update(status=status, url=url)
        if icon is not None:
            icon.title = f"OCADE JARVIS · {status}"
            icon.update_menu()

    ending["stop"] = stop
    try:
        return await_connection(server, name, show, webbrowser.open, again, can_ask_again=icon is not None)
    finally:
        if icon is not None:
            icon.stop()


def health_check() -> int:
    """0 only when this build can really run: every module and file it opens, and its tray."""
    try:
        import actions.browser_control as browser  # reads ocade_page.js and the protocol gates
        import ocade_egress  # noqa: F401
        import ocade_existing_browser  # noqa: F401
        import ocade_documents  # noqa: F401
        import ocade_settings  # noqa: F401
        import ocade_sheets
        import openpyxl  # noqa: F401
        import psutil  # noqa: F401
        import pypdf  # noqa: F401
        if sys.platform == "win32":
            import ocade_accessibility  # noqa: F401
            import pycaw.pycaw  # noqa: F401
            import uiautomation  # noqa: F401
        assert browser._OCADE_PAGE and browser._GATES
        import ocade_wake
        # Shipped with the build (a build without it is broken); a damaged copy on disk is
        # reported by the tray and repaired, never a reason for the agent itself not to start.
        assert (ocade_wake.bundled() / "manifest.json").is_file() and (ocade_wake.bundled() / "manifest.sig").is_file()
        if ocade_wake.health()["wake"] == "ready":  # the model really runs in this build, not only its files
            import numpy as np
            model = ocade_wake.Model(ocade_wake.bundled() / ocade_wake.verify()["file"])
            assert 0.0 <= model.score(ocade_wake.log_mel(np.zeros(ocade_wake.WINDOW_SAMPLES, np.float32))) <= 1.0
        actions = Path(ocade_sheets.__file__).resolve().parent / "actions"
        assert (actions / "ocade_excel.ps1").is_file() and (actions / "ocade_word.ps1").is_file()
        import pystray
        from PIL import Image
        pystray.Icon("ocade-health", Image.new("RGBA", (16, 16)), "OCADE")
    except Exception as e:  # the updater rolls back on anything but 0
        print(f"unhealthy: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    return 0


def install_root() -> Path | None:
    """The folder holding versions/ and current.json, when this is a packaged install."""
    if not getattr(sys, "frozen", False):
        return None
    here = Path(sys.executable).resolve().parent
    return here.parent.parent if here.parent.name == "versions" else None


HANDED_OVER = "OCADE_AGENT_HANDED_OVER"
STARTED_OK_S = 20  # a build still running after this long has started


def _become(argv: list[str]) -> None:
    """
    Replace this process with another program. Windows has no exec: os.execv
    there starts a new process from an unquoted command line, so the space in
    "Device Agent" cut the program's own path in two, and the newer build ended
    at once with a usage error nobody saw. No installed agent could start an update.
    """
    if sys.platform == "win32":
        import subprocess
        subprocess.Popen(argv, close_fds=True,
                         creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP)
        sys.exit(0)
    os.execv(argv[0], argv)


def _run_current_build(root: Path | None) -> None:
    """Hand over to the build current.json names (rolling back after failed starts)."""
    if root is None:
        return
    me = Path(sys.executable).resolve()
    # The launcher already counted this start and chose this build: counting it
    # again here gave a new build one failed start before rollback, not two.
    if os.environ.pop(HANDED_OVER, None) == str(me):
        return
    ocade_update.adopt(root, me.parent.name)  # the build an installer just placed
    for _ in range(2):  # the build that is current, then the one it rolls back to
        target = ocade_update.launch_target(root)
        if target is None or target.resolve() == me:
            return
        if target.is_file():
            os.environ[HANDED_OVER] = str(target.resolve())
            try:
                _become([str(target), *sys.argv[1:]])
            except OSError:
                os.environ.pop(HANDED_OVER, None)
        # Its program is gone or cannot be run at all. That is not a start worth
        # counting twice, and never an error box at login: roll back now, and
        # this build (always a complete agent) carries on if it is the one left.
        ocade_update.rollback(root)


def _watch_health_and_updates(agent: ocade_device.Agent, root: Path | None, server: str,
                              started_ok_s: float = STARTED_OK_S, every_s: float = 15) -> None:
    """
    A build that stays up has started: that, not reaching OCADE, is what makes it
    healthy. It used to wait for the first successful exchange, so a laptop that
    logged in without a network twice rolled a perfectly good build back.
    Then signed updates: looked for while idle, started once the agent is idle.
    """
    if root is None or agent.stop.wait(started_ok_s):
        return
    ocade_update.mark_healthy(root)
    if not ocade_update.UPDATE_PUBLIC_KEY:
        return  # no release key in this build: nothing could be verified, so nothing is fetched
    schedule = ocade_update.Schedule(lambda: ocade_update.check(server, root, SOFTWARE_VERSION))
    reported = None
    while not agent.stop.wait(every_s):
        busy = bool(agent.state.get("busy") or agent.state.get("task"))
        if schedule.tick(busy, asked=bool(agent.state.get("update"))):
            print(f"Starting the signed update {schedule.staged}.", flush=True)
            agent.state["restart"] = True
            agent.stop.set()
            return
        if schedule.last_error and schedule.last_error != reported:
            reported = schedule.last_error
            print(f"Update skipped: {reported}", flush=True)


WAKE = {"wake": "off"}  # what the tray says about "OCADE" / "Hey OCADE"


def _wake_words(agent) -> str:
    if WAKE["wake"] == "unavailable":
        return f"Wake: {WAKE.get('why', 'not available')}"
    if WAKE["wake"] == "ready" and agent.state.get("background"):
        # Listening only while audio is really arriving, not because it could (F-160).
        return "Listening for “OCADE”" if WAKE.get("live") else "Wake: waiting for a microphone"
    return "Wake: starts with Background Mode"


def _wake_while_background(agent: ocade_device.Agent, home: Path, server: str) -> None:
    """"OCADE" / "Hey OCADE" listens locally only while Background/Wake Mode is on. The
    bundled model is checked once (and again every ten minutes while it cannot run)."""
    import ocade_wake
    listening: threading.Event | None = None
    checked, ready = -1e9, False
    while not agent.stop.wait(2):
        if not ready and time.monotonic() - checked > 600:
            checked = time.monotonic()
            WAKE.update(ocade_wake.health())
            ready = WAKE["wake"] == "ready"
        wanted = bool(agent.state.get("background")) and ready
        if wanted and listening is None:
            listening = threading.Event()
            threading.Thread(target=ocade_wake.listen, args=(home, server, listening),
                             kwargs={"on_live": lambda on: WAKE.__setitem__("live", on)},
                             daemon=True).start()
        elif not wanted and listening is not None:
            listening.set()
            listening = None
            WAKE["live"] = False
    if listening is not None:
        listening.set()


def main() -> None:
    parser = argparse.ArgumentParser(prog="ocade-agent")
    parser.add_argument("--server", default=os.environ.get("OCADE_SERVER", "https://ocade.in"))
    parser.add_argument("--workspace", default=None)
    parser.add_argument("--uninstall", action="store_true")
    parser.add_argument("--install-autostart", action="store_true")
    parser.add_argument("--stop", action="store_true", help="end the running agent (the installer, before an upgrade)")
    parser.add_argument("--health", action="store_true", help="exit 0 if this build can start (updater check)")
    args = parser.parse_args()
    home = ocade_device.HOME
    if args.health:
        sys.exit(health_check())
    if args.uninstall:
        print(uninstall(home))
        return
    if args.install_autostart:
        install_autostart()
        return
    if args.stop:
        sys.exit(0 if stop_running_agent(20) or (end_other_agents() and stop_running_agent(3)) else 1)
    if already_running():
        print("OCADE Device Agent is already running.")
        return
    root = install_root()
    _run_current_build(root)
    guard = single_instance()
    if guard is None:
        if already_running():
            print("OCADE Device Agent is already running.")
            return
        print(f"Another program is using port {SINGLE_INSTANCE_PORT}, so OCADE Device Agent cannot start.")
        sys.exit(1)
    identity = Identity(home)
    if identity.damaged:
        Presence._notify(Identity.DAMAGED)
        guard.close()
        return
    # "exit" is answered from the first moment: an uninstall must be able to end
    # an agent that is still waiting to be connected.
    ending = {"stop": lambda: os._exit(0)}
    serve_exit(guard, lambda: ending["stop"]())
    if not identity.connected:
        try:
            identity = connect_with_tray(args.server, platform.node()[:120] or "My computer", ending)
        except UpdateRequired:
            Presence._notify("OCADE needs a newer Device Agent. Install the latest version from ocade.in.")
            guard.close()
            return
    agent = ocade_device.Agent(identity, headless=False, cdp=None, workspace=args.workspace)
    presence = Presence(agent, identity.meta["server"])
    ending["stop"] = lambda: (agent.stop_everything(), agent.stop.set(),
                              presence.icon.stop() if presence.icon else None)
    tray = presence.start_tray()
    if tray:
        # Without a tray there is no local control: say so and keep the reason on this computer.
        (home / "agent.log").parent.mkdir(parents=True, exist_ok=True)
        with open(home / "agent.log", "a", encoding="utf-8") as log:
            log.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {tray}\n")
        Presence._notify("OCADE could not show its tray icon, so it cannot be stopped from this "
                         "computer. JARVIS will not run here until it can. " + tray)
        guard.close()
        return
    def work() -> None:
        try:
            code = agent.run()
        except Exception as e:  # a build whose work loop dies has not started: end, so it counts
            with open(home / "agent.log", "a", encoding="utf-8") as log:
                log.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} stopped: {type(e).__name__}: {e}\n")
            agent.stop.set()
            return
        if code == 2:
            # Removed in OCADE: the work already stopped and the key is gone. Nothing
            # starts at login any more; opening the app again connects afresh.
            remove_autostart()
            presence.notify("This computer was removed from OCADE. "
                            "Open OCADE Device Agent to connect it again.")
        elif code == 3:
            presence.notify("OCADE needs a newer Device Agent. Install the latest version from ocade.in.")
        agent.stop.set()

    worker = threading.Thread(target=work, daemon=True)
    worker.start()
    threading.Thread(target=_watch_health_and_updates,
                     args=(agent, root, identity.meta["server"]), daemon=True).start()
    threading.Thread(target=_wake_while_background,
                     args=(agent, home, identity.meta["server"]), daemon=True).start()
    while not agent.stop.wait(1):
        pass  # the tray and the worker threads do the work; this thread keeps the process alive
    worker.join(15)
    if presence.icon is not None:
        presence.icon.stop()
    guard.close()
    if agent.state.get("restart"):
        # The staged build starts through the same launcher as any login: it is
        # counted as a start, and a build that cannot start is rolled back.
        import subprocess
        subprocess.Popen(_launch_command() + sys.argv[1:], close_fds=True,
                         creationflags=getattr(subprocess, "DETACHED_PROCESS", 0)
                         | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0))


if __name__ == "__main__":
    main()
