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
import json
import os
import platform
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
from ocade_identity import SOFTWARE_VERSION, Identity  # noqa: E402

SINGLE_INSTANCE_PORT = 47831
APP_NAME = "OCADE Device Agent"


def single_instance() -> socket.socket | None:
    """Hold a loopback port for the life of the process. None when another agent holds it."""
    guard = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        guard.bind(("127.0.0.1", SINGLE_INSTANCE_PORT))
        guard.listen(1)
        return guard
    except OSError:
        guard.close()
        return None


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
                    if conn.recv(16) == b"exit":
                        conn.sendall(b"ok")
                        on_exit()
                except OSError:
                    pass
    threading.Thread(target=loop, daemon=True, name="ocade-single-instance").start()


def stop_running_agent(timeout_s: float = 8.0) -> bool:
    """Ask a running agent to stop, and wait until it has. True when none is left running."""
    try:
        with socket.create_connection(("127.0.0.1", SINGLE_INSTANCE_PORT), timeout=2) as conn:
            conn.sendall(b"exit")
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


def _launch_command() -> list[str]:
    if getattr(sys, "frozen", False):  # the packaged app
        return [sys.executable]
    return [sys.executable, str(Path(__file__).resolve())]


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
            winreg.SetValueEx(key, "OCADE", 0, winreg.REG_SZ, " ".join(f'"{c}"' for c in command))
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
                winreg.DeleteValue(key, "OCADE")
        except FileNotFoundError:
            pass
        return
    autostart_path().unlink(missing_ok=True)


def uninstall(home: Path) -> str:
    """Everything this agent put on the computer, except the program files the OS uninstaller owns."""
    # The running agent stops first: its key is never deleted under it.
    if not stop_running_agent():
        raise SystemExit("OCADE Device Agent is still running and could not be stopped. "
                         "Exit it from the tray, then uninstall again.")
    identity = Identity(home)
    if identity.connected:
        try:  # this computer's key stops working in OCADE too
            identity.exchange({"results": [], "forget": True})
        except Exception:
            pass  # offline: the person can still remove it in OCADE Devices
    remove_autostart()
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
            from PIL import Image, ImageDraw
        except Exception as e:
            return f"tray unavailable ({type(e).__name__}: {e})"
        image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        ImageDraw.Draw(image).ellipse((6, 6, 58, 58), fill=(20, 20, 20, 255), outline=(236, 236, 236, 255), width=4)
        menu = pystray.Menu(
            pystray.MenuItem(lambda _: self.agent.status(), None, enabled=False),
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
        """Windows builds the tray menu once; rebuild it whenever the status changes."""
        shown = None
        while not self.agent.stop.wait(1):
            status = self.agent.status()
            if status != shown and self.icon is not None:
                shown = status
                self.icon.title = f"OCADE JARVIS · {status}"
                self.icon.update_menu()


def health_check() -> int:
    """0 only when this build can really run: every module and file it opens, and its tray."""
    try:
        import actions.browser_control as browser  # reads ocade_page.js and the protocol gates
        import ocade_egress  # noqa: F401
        import ocade_existing_browser  # noqa: F401
        import ocade_documents  # noqa: F401
        import ocade_sheets
        import openpyxl  # noqa: F401
        import pypdf  # noqa: F401
        if sys.platform == "win32":
            import ocade_accessibility  # noqa: F401
            import uiautomation  # noqa: F401
        assert browser._OCADE_PAGE and browser._GATES
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


def _run_current_build(root: Path | None) -> None:
    """Hand over to the build current.json names (rolling back after failed starts)."""
    if root is None:
        return
    if not (root / "current.json").exists():  # the build the installer just placed
        (root / "current.json").write_text(
            json.dumps({"current": Path(sys.executable).resolve().parent.name}))
    target = ocade_update.launch_target(root)
    if target and target.resolve() != Path(sys.executable).resolve() and target.exists():
        os.execv(str(target), [str(target), *sys.argv[1:]])


def _watch_health_and_updates(agent: ocade_device.Agent, root: Path | None, server: str) -> None:
    while not agent.stop.wait(5):
        if agent.state.get("reached") and root is not None:
            ocade_update.mark_healthy(root)
            break
    # One signed-update check per start, and again whenever OCADE asks for a newer protocol.
    if root is not None and ocade_update.UPDATE_PUBLIC_KEY:
        try:
            if ocade_update.check(server, root, SOFTWARE_VERSION):
                print("A signed update was installed; it starts next time.", flush=True)
        except Exception as e:  # an update that cannot be verified is simply not installed
            print(f"Update skipped: {e}", flush=True)


def _wake_while_background(agent: ocade_device.Agent, home: Path, server: str) -> None:
    """'Hey OCADE' listens locally only while Background/Wake Mode is on."""
    import ocade_wake
    listening: threading.Event | None = None
    while not agent.stop.wait(2):
        wanted = bool(agent.state.get("background")) and ocade_wake.available(home)
        if wanted and listening is None:
            listening = threading.Event()
            threading.Thread(target=ocade_wake.listen, args=(home, server, listening), daemon=True).start()
        elif not wanted and listening is not None:
            listening.set()
            listening = None
    if listening is not None:
        listening.set()


def main() -> None:
    parser = argparse.ArgumentParser(prog="ocade-agent")
    parser.add_argument("--server", default=os.environ.get("OCADE_SERVER", "https://ocade.in"))
    parser.add_argument("--workspace", default=None)
    parser.add_argument("--uninstall", action="store_true")
    parser.add_argument("--install-autostart", action="store_true")
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
    root = install_root()
    _run_current_build(root)
    guard = single_instance()
    if guard is None:
        print("OCADE Device Agent is already running.")
        return
    identity = Identity(home)
    if identity.damaged:
        Presence._notify(Identity.DAMAGED)
        guard.close()
        return
    if not identity.connected:
        identity = ocade_device.connect(args.server, platform.node()[:120] or "My computer")
    agent = ocade_device.Agent(identity, headless=False, cdp=None, workspace=args.workspace)
    presence = Presence(agent, identity.meta["server"])
    serve_exit(guard, lambda: (agent.stop_everything(), agent.stop.set(),
                               presence.icon.stop() if presence.icon else None))
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
        code = agent.run()
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


if __name__ == "__main__":
    main()
