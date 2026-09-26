"""
OCADE JARVIS computer control: apps, files, commands, the screen and the system.

The order of preference is fixed (docs/JARVIS_DEVICE_ROADMAP.md): an app's own
launcher and direct file or command operations first; the screen — a fresh
observation, then a click at a point from THAT observation — only as the
fallback. A click planned against a screen that has since changed is refused
and a new observation is returned instead.

SCOPE. Files and commands stay inside the one workspace folder the person chose
on this computer (`--workspace`); a path that resolves outside it, including
through a symlink, is refused. Whole-computer file access is never the default.
Trash is the default for removal; permanent deletion, system changes and
risky commands arrive here only after the person confirmed them in OCADE, and
this module refuses them otherwise.

THE PERSON COMES FIRST. While JARVIS drives the mouse and keyboard, any input
that JARVIS did not make pauses it: the next screen action asks the person to
Continue, unless they turned on Co-work for this computer.
"""
from __future__ import annotations

import base64
import io
import os
import platform
import re
import shlex
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

SYSTEM = platform.system()
MAX_READ = 30_000   # what one result can carry back (OCADE keeps results under 40 kB)
MAX_OUTPUT = 12_000
RUN_TIMEOUT_S = 300
FRAME_WIDTH = 1280


def _jpeg(image) -> str:
    if image.width > FRAME_WIDTH:
        image = image.resize((FRAME_WIDTH, round(image.height * FRAME_WIDTH / image.width)))
    out = io.BytesIO()
    image.convert("RGB").save(out, "JPEG", quality=50)
    return base64.b64encode(out.getvalue()).decode()


def installed_apps() -> list[dict]:
    """Useful apps found locally: name plus how to launch them. Nothing leaves the device but names."""
    found: dict[str, dict] = {}
    if SYSTEM == "Windows":
        roots = [Path(os.environ.get("ProgramData", "C:/ProgramData")),
                 Path(os.environ.get("APPDATA", ""))]
        for root in roots:
            for link in (root / "Microsoft/Windows/Start Menu/Programs").rglob("*.lnk"):
                if "uninstall" not in link.stem.lower():
                    found.setdefault(link.stem.lower(), {"name": link.stem, "launch": str(link)})
    elif SYSTEM == "Darwin":
        for root in (Path("/Applications"), Path.home() / "Applications",
                     Path("/System/Applications")):
            for app in root.glob("*.app"):
                found.setdefault(app.stem.lower(), {"name": app.stem, "launch": str(app)})
    else:
        data = [Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share"))] + [
            Path(p) for p in os.environ.get("XDG_DATA_DIRS", "/usr/local/share:/usr/share").split(":")]
        for root in data:
            for entry in (root / "applications").glob("*.desktop"):
                fields = _desktop_fields(entry)
                if fields.get("Name") and fields.get("NoDisplay", "").lower() != "true" \
                        and fields.get("Type", "Application") == "Application" and fields.get("Exec"):
                    found.setdefault(fields["Name"].lower(),
                                     {"name": fields["Name"], "launch": str(entry)})
    # Only names OCADE can refer to safely (the same pattern the website accepts).
    usable = [a for a in found.values() if re.fullmatch(r"[A-Za-z0-9_ .+&()'-]{1,80}", a["name"])]
    return sorted(usable, key=lambda a: a["name"].lower())[:300]


def _desktop_fields(entry: Path) -> dict:
    fields, in_entry = {}, False
    try:
        for line in entry.read_text(errors="replace").splitlines():
            if line.startswith("["):
                in_entry = line.strip() == "[Desktop Entry]"
            elif in_entry and "=" in line and not line.startswith("#"):
                key, _, value = line.partition("=")
                fields.setdefault(key.strip(), value.strip())
    except OSError:
        pass
    return fields


def _launch(app: dict) -> None:
    target = app["launch"]
    if SYSTEM == "Windows":
        os.startfile(target)  # type: ignore[attr-defined]  # the shortcut itself, never a shell string
    elif SYSTEM == "Darwin":
        subprocess.Popen(["open", target], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        command = [part for part in shlex.split(_desktop_fields(Path(target))["Exec"])
                   if not re.fullmatch(r"%[a-zA-Z]", part)]
        subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         start_new_session=True)


class InputGuard:
    """Notices mouse or keyboard input that JARVIS did not make."""

    GRACE_S = 0.35

    def __init__(self):
        self._ours_until = 0.0
        self.user_input_at = 0.0
        self._started = False

    def start(self) -> bool:
        if self._started:
            return True
        try:
            from pynput import keyboard, mouse
        except Exception:  # no input hooks here (headless, or not permitted)
            return False
        seen = lambda *_: self.note()  # noqa: E731
        mouse.Listener(on_move=seen, on_click=seen, on_scroll=seen, daemon=True).start()
        keyboard.Listener(on_press=seen, daemon=True).start()
        self._started = True
        return True

    def note(self) -> None:
        if time.monotonic() > self._ours_until:
            self.user_input_at = time.monotonic()

    def ours(self) -> None:
        """Mark input JARVIS is about to make, so it is not mistaken for the person's."""
        self._ours_until = time.monotonic() + self.GRACE_S


class Computer:
    def __init__(self, workspace: str | None = None):
        self.root = Path(workspace).resolve() if workspace else None
        self.guard = InputGuard()
        self._obs_seq = 0
        self._observation: dict | None = None
        self._lock = threading.Lock()  # one controller of mouse and keyboard at a time
        self.sandbox = "bubblewrap" if SYSTEM == "Linux" and shutil.which("bwrap") else (
            "limits" if SYSTEM != "Windows" else "timeout")

    # -- what this computer offers ------------------------------------------------

    def _gui(self):
        try:
            import pyautogui
            pyautogui.FAILSAFE = True
            return pyautogui
        except (Exception, SystemExit):  # no display, or no GUI toolkit on this host
            return None

    def capabilities(self) -> dict:
        gui = self._gui() is not None
        return {"screen": gui, "computer_control": gui, "apps": True,
                "files": self.root is not None, "terminal": self.root is not None}

    # -- one action ----------------------------------------------------------------

    def run(self, action: dict, confirmed: bool = False, cowork: bool = False) -> dict:
        kind = str(action.get("action", ""))
        try:
            if kind == "apps":
                apps = installed_apps()
                return {"status": "done", "summary": f"Found {len(apps)} apps",
                        "apps": [a["name"] for a in apps]}
            if kind == "open_app":
                return self._open_app(str(action.get("name", "")), confirmed)
            if kind.startswith("file_"):
                return self._file(kind, action, confirmed)
            if kind == "run":
                return self._run(str(action.get("command", "")), action.get("cwd"))
            if kind == "system":
                return self._system(str(action.get("op", "")), confirmed)
            if kind.startswith("screen"):
                with self._lock:
                    return self._screen(kind, action, confirmed, cowork)
        except ScopeError as e:
            return {"status": "blocked", "summary": str(e)}
        except Exception as e:  # reported, never retried blindly
            return {"status": "failed", "summary": f"That did not work ({str(e)[:160]})"}
        return {"status": "failed", "summary": "Unknown computer action"}

    # -- apps ----------------------------------------------------------------------

    def _open_app(self, name: str, confirmed: bool) -> dict:
        app = next((a for a in installed_apps() if a["name"].lower() == name.lower()), None)
        if app is None:
            return {"status": "failed", "summary": f"{name} is not installed on this computer"}
        _launch(app)
        return {"status": "done", "summary": f"Opened {app['name']}"}

    # -- files: always inside the workspace -----------------------------------------

    def _inside(self, raw: str) -> Path:
        if self.root is None:
            raise ScopeError("No workspace is selected on this computer")
        target = (self.root / raw).resolve()
        if target != self.root and self.root not in target.parents:
            raise ScopeError("That path is outside the workspace")
        return target

    def _file(self, kind: str, action: dict, confirmed: bool) -> dict:
        path = self._inside(str(action.get("path", "")))
        rel = str(path.relative_to(self.root)) or "."
        if kind == "file_list":
            if not path.is_dir():
                return {"status": "failed", "summary": f"{rel} is not a folder"}
            items = sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))[:200]
            return {"status": "done", "summary": f"Listed {rel}",
                    "entries": [{"name": p.name, "folder": p.is_dir(),
                                 "size": p.stat().st_size if p.is_file() else None} for p in items]}
        if kind == "file_read":
            data = path.read_bytes()[:MAX_READ]
            if b"\0" in data[:4096]:
                return {"status": "failed", "summary": f"{rel} is not a text file"}
            return {"status": "done", "summary": f"Read {rel}",
                    "content": data.decode("utf-8", errors="replace"),
                    "truncated": path.stat().st_size > MAX_READ}
        if kind == "file_write":
            path.parent.mkdir(parents=True, exist_ok=True)
            self._inside(str(path.parent.relative_to(self.root)))
            tmp = path.with_name(f".{path.name}.ocade-tmp")
            tmp.write_text(str(action.get("content", "")), encoding="utf-8")
            os.replace(tmp, path)
            return {"status": "done", "summary": f"Wrote {rel}"}
        if path == self.root:
            raise ScopeError("The workspace itself cannot be removed")
        if kind == "file_trash":
            from send2trash import send2trash
            send2trash(str(path))
            return {"status": "done", "summary": f"Moved {rel} to the Trash"}
        if kind == "file_delete":
            if not confirmed:
                return {"status": "needs_confirmation", "summary": f"Permanently delete {rel}?"}
            shutil.rmtree(path) if path.is_dir() else path.unlink()
            return {"status": "done", "summary": f"Deleted {rel} permanently"}
        return {"status": "failed", "summary": "Unknown file action"}

    # -- commands: inside the workspace, bounded, isolated where the host allows -----

    def _run(self, command: str, cwd: str | None) -> dict:
        folder = self._inside(cwd or ".")
        if not folder.is_dir():
            return {"status": "failed", "summary": "That folder does not exist"}
        argv, extra = self._sandboxed(command, folder)
        started = time.monotonic()
        process = subprocess.Popen(argv, cwd=folder, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   stdin=subprocess.DEVNULL, **extra)
        try:
            out, err = process.communicate(timeout=RUN_TIMEOUT_S)
        except subprocess.TimeoutExpired:
            self._kill(process)
            out, err = process.communicate()
            return {"status": "failed", "summary": f"The command ran over {RUN_TIMEOUT_S} seconds and was stopped",
                    "stdout": out.decode(errors="replace")[-MAX_OUTPUT:],
                    "stderr": err.decode(errors="replace")[-MAX_OUTPUT:]}
        return {"status": "done" if process.returncode == 0 else "failed",
                "summary": f"Exited with {process.returncode} after {time.monotonic() - started:.1f}s",
                "exitCode": process.returncode, "isolation": self.sandbox,
                "stdout": out.decode(errors="replace")[-MAX_OUTPUT:],
                "stderr": err.decode(errors="replace")[-MAX_OUTPUT:]}

    def _sandboxed(self, command: str, folder: Path) -> tuple[list[str], dict]:
        if SYSTEM == "Windows":
            # ponytail: timeout + own process group only; Job Object CPU/RAM caps when Windows is proven.
            return (["cmd", "/c", command],
                    {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP})  # type: ignore[attr-defined]
        extra = {"start_new_session": True, "preexec_fn": _limits}
        if self.sandbox == "bubblewrap":
            # The whole system read-only, the workspace and a private /tmp writable:
            # a command can build and test the project, and cannot change anything else.
            return (["bwrap", "--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc",
                     "--tmpfs", "/tmp", "--bind", str(self.root), str(self.root),
                     "--unshare-pid", "--unshare-ipc", "--unshare-uts", "--die-with-parent",
                     "--chdir", str(folder), "/bin/sh", "-c", command], extra)
        return (["/bin/sh", "-c", command], extra)

    @staticmethod
    def _kill(process: subprocess.Popen) -> None:
        try:
            if SYSTEM == "Windows":
                process.kill()
            else:
                os.killpg(process.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass

    # -- the system: only after the person confirmed ---------------------------------

    SYSTEM_COMMANDS = {
        "Windows": {"lock": ["rundll32.exe", "user32.dll,LockWorkStation"], "log_out": ["shutdown", "/l"],
                    "restart": ["shutdown", "/r", "/t", "0"], "shut_down": ["shutdown", "/s", "/t", "0"]},
        "Darwin": {"lock": ["pmset", "displaysleepnow"],
                   "log_out": ["osascript", "-e", 'tell application "System Events" to log out'],
                   "restart": ["osascript", "-e", 'tell application "System Events" to restart'],
                   "shut_down": ["osascript", "-e", 'tell application "System Events" to shut down']},
        "Linux": {"lock": ["loginctl", "lock-session"], "log_out": ["loginctl", "terminate-user", os.environ.get("USER", "")],
                  "restart": ["systemctl", "reboot"], "shut_down": ["systemctl", "poweroff"]},
    }

    def _system(self, op: str, confirmed: bool) -> dict:
        command = self.SYSTEM_COMMANDS.get(SYSTEM, {}).get(op)
        if not command:
            return {"status": "failed", "summary": "That system action is not available here"}
        if not confirmed:
            return {"status": "needs_confirmation", "summary": f"Confirm: {op.replace('_', ' ')} this computer"}
        if os.environ.get("OCADE_JARVIS_DRY_SYSTEM") == "1":
            return {"status": "done", "summary": f"Would run {' '.join(command)}"}
        subprocess.Popen(command)
        return {"status": "done", "summary": f"Asked the computer to {op.replace('_', ' ')}"}

    # -- the screen: the fallback, always against a fresh observation ---------------

    def _geometry(self) -> dict:
        gui = self._gui()
        size = gui.size() if gui else (0, 0)
        title = None
        try:
            window = gui.getActiveWindow() if gui and hasattr(gui, "getActiveWindow") else None
            title = window.title if window else None
        except Exception:
            title = None
        return {"w": size[0], "h": size[1], "window": title}

    def observe(self) -> dict:
        import mss
        from PIL import Image
        with (getattr(mss, "MSS", None) or mss.mss)() as grab:
            monitor = grab.monitors[0]
            raw = grab.grab(monitor)
            image = Image.frombytes("RGB", raw.size, raw.rgb)
        self._obs_seq += 1
        geometry = self._geometry()
        scale = image.width / FRAME_WIDTH if image.width > FRAME_WIDTH else 1.0
        self._observation = {"id": f"s{self._obs_seq}", "geometry": geometry, "scale": scale,
                             "at": time.monotonic()}
        return {"observationId": f"s{self._obs_seq}", "screen": {"w": geometry["w"], "h": geometry["h"]},
                "activeWindow": geometry["window"],
                "imageScale": round(1 / scale, 4), "frame": _jpeg(image)}

    def _stale(self, observation_id: str) -> str | None:
        held = self._observation
        if not held or held["id"] != observation_id:
            return "That screen observation is no longer current."
        if time.monotonic() - held["at"] > 60:
            return "That screen observation is too old."
        now = self._geometry()
        for key, label in (("w", "the screen size changed"), ("h", "the screen size changed"),
                           ("window", "a different window is in front")):
            if now.get(key) != held["geometry"].get(key):
                return f"The screen changed: {label}."
        return None

    def _screen(self, kind: str, action: dict, confirmed: bool, cowork: bool) -> dict:
        gui = self._gui()
        if gui is None:
            return {"status": "blocked", "summary": "This computer does not allow screen control"}
        if kind == "screen":
            return {"status": "done", "summary": "Looked at the screen", "observation": self.observe()}
        self.guard.start()
        # The person's own input pauses JARVIS until they say Continue (their
        # confirmation of this step), unless they chose to work alongside it.
        if self.guard.user_input_at and not cowork and not confirmed:
            return {"status": "needs_confirmation",
                    "summary": "You used the mouse or keyboard, so JARVIS paused. Continue?"}
        self.guard.user_input_at = 0.0
        if kind == "screen_click":
            why = self._stale(str(action.get("observationId", "")))
            if why:
                return {"status": "stale", "summary": why, "observation": self.observe()}
            scale = self._observation["scale"]
            x, y = float(action.get("x", -1)) * scale, float(action.get("y", -1)) * scale
            width, height = self._observation["geometry"]["w"], self._observation["geometry"]["h"]
            if not (0 <= x < width and 0 <= y < height):
                return {"status": "failed", "summary": "That point is outside the screen"}
            self.guard.ours()
            gui.click(x, y)
            detail = "Clicked on the screen"
        elif kind == "screen_type":
            self.guard.ours()
            gui.write(str(action.get("text", ""))[:2000], interval=0.01)
            detail = "Typed"
        elif kind == "screen_keys":
            keys = [str(k) for k in action.get("keys", [])][:4]
            self.guard.ours()
            gui.hotkey(*keys) if len(keys) > 1 else gui.press(keys[0])
            detail = f"Pressed {'+'.join(keys)}"
        elif kind == "screen_scroll":
            self.guard.ours()
            gui.scroll(-5 if action.get("direction") == "down" else 5)
            detail = f"Scrolled {action.get('direction', 'down')}"
        else:
            return {"status": "failed", "summary": "Unknown screen action"}
        self.guard.ours()
        time.sleep(0.3)
        return {"status": "done", "summary": detail, "observation": self.observe()}


class ScopeError(Exception):
    pass


def _limits() -> None:  # runs in the child, before the command
    import resource
    for limit, value in ((resource.RLIMIT_CPU, RUN_TIMEOUT_S), (resource.RLIMIT_AS, 4 << 30),
                         (resource.RLIMIT_FSIZE, 2 << 30), (resource.RLIMIT_NOFILE, 1024)):
        try:
            resource.setrlimit(limit, (value, value))
        except (ValueError, OSError):
            pass


if __name__ == "__main__":  # pragma: no cover - manual check
    print(Computer(sys.argv[1] if len(sys.argv) > 1 else None).capabilities())
