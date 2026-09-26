"""
The OCADE Device Agent: what a person installs once and then forgets.

    ocade-agent                 start (connects first if needed), with one tray icon
    ocade-agent --uninstall     stop, remove autostart, the key and the local cache

It starts with the computer as a dormant supervisor (see Agent.DORMANT_S) and
becomes active only while a JARVIS task is open on this computer or the person
turned on Background Mode. There is exactly one OCADE presence: a second start
finds the first one and exits. The tray offers Open OCADE JARVIS, STOP JARVIS
and Exit; the round mini-control appears while JARVIS is working.

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
    remove_autostart()
    shutil.rmtree(home, ignore_errors=True)  # the key, pending results and the cache
    return ("OCADE Device Agent was removed from this computer. PC control, background tasks and "
            "wake features have stopped. Your OCADE conversations and task history stay in your "
            "account until you delete them there.")


class Presence:
    """The one tray icon (where the platform offers one) and the mini-control."""

    def __init__(self, agent: ocade_device.Agent, server: str):
        self.agent = agent
        self.server = server.rstrip("/")
        self.icon = None

    def open_ocade(self) -> None:
        webbrowser.open(f"{self.server}/ocade-jarvis")

    def stop_jarvis(self) -> None:
        self.agent.stop_all.set()

    def exit(self) -> None:
        if self.agent.state["busy"] and not self._ask("JARVIS is working on a task. Stop it and exit?"):
            return
        if self.agent.state["busy"]:
            self.agent.stop_all.set()
        self.agent.stop.set()
        if self.icon is not None:
            self.icon.stop()

    def _ask(self, question: str) -> bool:
        try:
            from tkinter import messagebox
            return bool(messagebox.askyesno(APP_NAME, question))
        except Exception:
            return True  # no dialog available: the person chose Exit

    def start_tray(self) -> bool:
        try:
            import pystray
            from PIL import Image, ImageDraw
        except Exception:
            return False
        image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        ImageDraw.Draw(image).ellipse((6, 6, 58, 58), fill=(20, 20, 24, 255), outline=(235, 235, 240, 255), width=4)
        menu = pystray.Menu(
            pystray.MenuItem(lambda _: "Working" if self.agent.state["busy"] else "Ready", None, enabled=False),
            pystray.MenuItem("Open OCADE JARVIS", lambda: self.open_ocade(), default=True),
            pystray.MenuItem("STOP JARVIS", lambda: self.stop_jarvis()),
            pystray.MenuItem("Exit", lambda: self.exit()),
        )
        self.icon = pystray.Icon("ocade", image, "OCADE JARVIS", menu)
        self.icon.run_detached()
        return True


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
        sys.exit(0)
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
    if not identity.connected:
        identity = ocade_device.connect(args.server, platform.node()[:120] or "My computer")
    agent = ocade_device.Agent(identity, headless=False, cdp=None, workspace=args.workspace)
    presence = Presence(agent, identity.meta["server"])
    presence.start_tray()
    worker = threading.Thread(target=agent.run, daemon=True)
    worker.start()
    threading.Thread(target=_watch_health_and_updates,
                     args=(agent, root, identity.meta["server"]), daemon=True).start()
    try:
        import ocade_mini
        ocade_mini.run(presence)  # owns the main thread while it lives
    except ImportError:
        worker.join()
    guard.close()


if __name__ == "__main__":
    main()
