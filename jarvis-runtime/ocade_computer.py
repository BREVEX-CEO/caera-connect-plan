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
On Linux commands run confined to that folder by bubblewrap, without network
unless confirmed. On Windows and macOS there is no such confinement, so a
command is one program started directly (no shell: no chains, pipes or
redirects), in the workspace, with path arguments inside it and secrets
removed from its environment; programs outside the development set wait for
the person's confirmation. It runs with the person's own access, and says so.

STOP. Every action receives the cancellation token of the action being run;
a command is killed with its whole process group and typing stops between
chunks the moment it is set.
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
import json
import os
import platform
import re
import shlex
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

SYSTEM = platform.system()
MAX_READ = 30_000   # what one result can carry back (OCADE keeps results under 40 kB)
MAX_OUTPUT = 12_000
RUN_TIMEOUT_S = 300
FRAME_WIDTH = 1280

# Programs a coding task runs in the workspace without asking (risky arguments
# such as `git push` or `install` still wait for the person at OCADE).
DEV_PROGRAMS = frozenset({
    "git", "python", "python3", "py", "pip", "pip3", "pytest", "node", "npm", "npx", "pnpm",
    "yarn", "bun", "deno", "tsc", "eslint", "prettier", "vitest", "jest", "ruff", "black",
    "mypy", "dotnet", "cargo", "rustc", "go", "java", "javac", "mvn", "gradle", "make",
    "cmake", "code"})
# Anything a shell (or cmd.exe for .cmd/.bat programs) would interpret.
SHELL_META = re.compile(r"[&|;<>^`$%!\r\n]")
SECRET_ENV = re.compile(r"KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|COOKIE|SESSION|AUTH",
                        re.IGNORECASE)


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
        # Every app in Start, Store/UWP ones included, with the id Windows
        # itself launches it by (an AppsFolder id), then plain shortcuts.
        for app in _start_apps():
            found.setdefault(app["name"].lower(), app)
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


def _start_apps() -> list[dict]:
    """Windows' own list of Start apps (Get-StartApps): name and AppsFolder id."""
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command",
             "Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress"],
            capture_output=True, timeout=30, check=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
        rows = json.loads(out.decode("utf-8", errors="replace") or "[]")
    except (OSError, subprocess.SubprocessError, ValueError):
        return []
    rows = rows if isinstance(rows, list) else [rows]
    return [{"name": r["Name"], "launch": r["AppID"], "aumid": True} for r in rows
            if isinstance(r, dict) and r.get("Name") and r.get("AppID")
            and "uninstall" not in r["Name"].lower()]


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
    if SYSTEM == "Windows" and app.get("aumid"):
        # A fixed argument vector: explorer activates exactly this registered app.
        subprocess.Popen(["explorer.exe", f"shell:AppsFolder\\{target}"])
    elif SYSTEM == "Windows":
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
        # Linux: a real filesystem boundary. Elsewhere: one direct program in the workspace.
        self.sandbox = "bubblewrap" if SYSTEM == "Linux" and shutil.which("bwrap") else (
            None if SYSTEM == "Linux" else "workspace")

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
        screen, control = gui, gui
        if SYSTEM == "Darwin":
            # macOS decides these in System Settings > Privacy & Security; a
            # capability macOS has not granted is reported unavailable, not tried.
            screen, control = gui and _macos_screen_allowed(), gui and _macos_accessibility_allowed()
        return {"screen": screen, "computer_control": control, "apps": True,
                "files": self.root is not None,
                "terminal": self.root is not None and self.sandbox is not None}

    # -- one action ----------------------------------------------------------------

    def run(self, action: dict, confirmed: bool = False, cowork: bool = False,
            cancel: threading.Event | None = None) -> dict:
        kind = str(action.get("action", ""))
        cancel = cancel or threading.Event()
        try:
            if kind == "apps":
                apps = installed_apps()
                return {"status": "done", "summary": f"Found {len(apps)} apps",
                        "apps": [a["name"] for a in apps]}
            if kind == "open_app":
                return self._open_app(str(action.get("name", "")), confirmed)
            if kind.startswith("file_"):
                return self._file(kind, action, confirmed)
            if kind in ("sheet_inspect", "sheet_edit"):
                return self._sheet(kind, action, cancel)
            if kind == "run":
                return self._run(str(action.get("command", "")), action.get("cwd"), confirmed, cancel)
            if kind == "system":
                return self._system(str(action.get("op", "")), confirmed)
            if kind.startswith("screen"):
                with self._lock:
                    return self._screen(kind, action, confirmed, cowork, cancel)
        except ScopeError as e:
            return {"status": "blocked", "summary": str(e)}
        except Exception as e:  # reported, never retried blindly
            # Plain words only: an exception's text carries local paths and names.
            return {"status": "failed", "summary": _plain(e)}
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
            parent = self._inside(str(path.parent.relative_to(self.root)))
            # A fresh random name created exclusively (O_EXCL never follows an
            # existing entry), so nothing planted in the workspace can redirect it.
            fd, tmp = tempfile.mkstemp(dir=parent, prefix=".ocade-", suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as out:
                    out.write(str(action.get("content", "")))
                    out.flush()
                    os.fsync(out.fileno())
                if Path(tmp).resolve().parent != parent or self._inside(rel) != path:
                    raise ScopeError("The workspace changed while writing")
                os.replace(tmp, path)
            finally:
                if os.path.lexists(tmp):
                    os.unlink(tmp)
            return {"status": "done", "summary": f"Wrote {rel}"}
        if kind == "file_mkdir":
            existed = path.is_dir()
            path.mkdir(parents=True, exist_ok=True)
            return {"status": "done", "summary": f"{rel} already existed" if existed else f"Created folder {rel}"}
        if kind == "file_info":
            info = path.stat()
            return {"status": "done", "summary": f"Details of {rel}",
                    "info": {"name": path.name, "folder": path.is_dir(), "size": info.st_size,
                             "modified": time.strftime("%Y-%m-%d %H:%M", time.localtime(info.st_mtime)),
                             "extension": path.suffix or None}}
        if kind == "file_find":
            return self._find(path, rel, str(action.get("name", "")), str(action.get("extension", "")))
        if kind == "file_extract":
            from ocade_documents import Unreadable, extract_text
            try:
                text, pages = extract_text(path, MAX_READ)
            except Unreadable as e:
                return {"status": "failed", "summary": str(e)}
            return {"status": "done", "summary": f"Read the text of {rel}", "content": text,
                    "truncated": len(text) >= MAX_READ, **({"pages": pages} if pages else {})}
        if path == self.root:
            raise ScopeError("The workspace itself cannot be removed")
        if kind in ("file_move", "file_copy", "file_rename"):
            return self._relocate(kind, path, rel, action)
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

    def _sheet(self, kind: str, action: dict, cancel: threading.Event) -> dict:
        import ocade_sheets
        path = self._inside(str(action.get("path", "")))
        rel = str(path.relative_to(self.root))
        sheet = action.get("sheet")
        try:
            if kind == "sheet_inspect":
                return {"status": "done", "summary": f"Inspected {rel}",
                        "workbook": ocade_sheets.inspect(path, sheet)}
            home = Path(os.environ.get("OCADE_JARVIS_HOME", Path.home() / ".ocade_jarvis"))
            out = ocade_sheets.edit(path, sheet, list(action.get("ops") or []), home / "undo", cancel)
        except ocade_sheets.SheetError as e:
            return {"status": "failed", "summary": str(e)}
        except KeyError:
            return {"status": "failed", "summary": "That sheet does not exist in the workbook"}
        if not out.get("ok"):
            return {"status": "failed", "stopped": bool(out.get("stopped")),
                    "summary": f"The workbook was not changed: {str(out.get('error', ''))[:200]}"}
        return {"status": "done", "summary": f"Updated {rel} ({len(out['applied'])} changes, "
                                             f"{'in Excel' if out['engine'] == 'excel' else 'in the file'})",
                **{k: v for k, v in out.items() if k != "ok"}}

    def _find(self, folder: Path, rel: str, name: str, extension: str) -> dict:
        """Donor find_files: name and/or extension, bounded, inside the workspace only."""
        if not folder.is_dir():
            return {"status": "failed", "summary": f"{rel} is not a folder"}
        found, folders = [], 0
        for item in folder.rglob("*"):
            if item.is_dir():
                folders += 1
                if folders > 2000:
                    break
                continue
            if extension and item.suffix.lower() != ("." + extension.lower().lstrip(".")):
                continue
            if name and name.lower() not in item.name.lower():
                continue
            found.append({"path": str(item.relative_to(self.root)), "size": item.stat().st_size})
            if len(found) >= 100:
                break
        return {"status": "done", "summary": f"Found {len(found)} file(s)", "entries": found}

    def _relocate(self, kind: str, source: Path, rel: str, action: dict) -> dict:
        """Donor move/copy/rename: never over an existing file, both ends inside the workspace."""
        if not source.exists():
            return {"status": "failed", "summary": f"{rel} does not exist"}
        if kind == "file_rename":
            new = str(action.get("name", ""))
            if not new or re.search(r"[\\/:*?\"<>|]", new) or new in (".", ".."):
                return {"status": "failed", "summary": "That is not a usable name"}
            target = self._inside(str((source.parent / new).relative_to(self.root)))
        else:
            target = self._inside(str(action.get("to", "")))
            if target.is_dir():
                target = self._inside(str((target / source.name).relative_to(self.root)))
        if target.exists():
            return {"status": "failed",
                    "summary": f"{target.relative_to(self.root)} already exists; nothing was overwritten"}
        if source in target.parents:
            return {"status": "failed", "summary": "A folder cannot go inside itself"}
        target.parent.mkdir(parents=True, exist_ok=True)
        to = str(target.relative_to(self.root))
        if kind == "file_copy":
            shutil.copytree(source, target) if source.is_dir() else shutil.copy2(source, target)
            return {"status": "done", "summary": f"Copied {rel} to {to}"}
        shutil.move(str(source), str(target))
        return {"status": "done", "summary": f"{'Renamed' if kind == 'file_rename' else 'Moved'} {rel} to {to}"}

    # -- commands: inside the workspace, bounded, isolated where the host allows -----

    def _run(self, command: str, cwd: str | None, confirmed: bool, cancel: threading.Event) -> dict:
        if self.sandbox is None:
            return {"status": "blocked",
                    "summary": "Running commands is not available on this computer yet"}
        folder = self._inside(cwd or ".")
        if not folder.is_dir():
            return {"status": "failed", "summary": "That folder does not exist"}
        if self.sandbox == "bubblewrap":
            argv, extra = self._sandboxed(command, folder, network=confirmed)
        else:
            direct = self._direct(command, folder, confirmed)
            if isinstance(direct, dict):
                return direct
            argv, extra = direct
        started = time.monotonic()
        process = subprocess.Popen(argv, cwd=folder, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   stdin=subprocess.DEVNULL, **extra)
        while True:
            try:
                out, err = process.communicate(timeout=0.2)  # a retry after timeout loses no output
                break
            except subprocess.TimeoutExpired:
                over = time.monotonic() - started > RUN_TIMEOUT_S
                if cancel.is_set() or over:
                    self._kill(process)
                    out, err = process.communicate()
                    return {"status": "failed", "stopped": True,
                            "summary": f"The command ran over {RUN_TIMEOUT_S} seconds and was stopped"
                            if over else "Stopped before it finished",
                            "stdout": out.decode(errors="replace")[-MAX_OUTPUT:],
                            "stderr": err.decode(errors="replace")[-MAX_OUTPUT:]}
        return {"status": "done" if process.returncode == 0 else "failed",
                "summary": f"Exited with {process.returncode} after {time.monotonic() - started:.1f}s",
                "exitCode": process.returncode, "isolation": self.sandbox,
                "stdout": out.decode(errors="replace")[-MAX_OUTPUT:],
                "stderr": err.decode(errors="replace")[-MAX_OUTPUT:]}

    def _sandboxed(self, command: str, folder: Path, network: bool) -> tuple[list[str], dict]:
        # The system read-only, the workspace and a private /tmp writable, the
        # home folder hidden, no inherited secrets, and no network unless the
        # person confirmed this exact command.
        # ponytail: Linux bubblewrap only; Windows AppContainer / macOS sandbox when proven there.
        return (["bwrap", "--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc",
                 "--tmpfs", "/tmp", "--tmpfs", str(Path.home()),
                 "--bind", str(self.root), str(self.root),
                 "--unshare-pid", "--unshare-ipc", "--unshare-uts", "--new-session",
                 "--die-with-parent", *([] if network else ["--unshare-net"]),
                 "--clearenv", "--setenv", "PATH", os.environ.get("PATH", "/usr/bin:/bin"),
                 "--setenv", "HOME", str(self.root), "--setenv", "LANG", "C.UTF-8",
                 "--chdir", str(folder), "/bin/sh", "-c", command],
                {"start_new_session": True, "preexec_fn": _limits})

    def _direct(self, command: str, folder: Path, confirmed: bool) -> tuple[list[str], dict] | dict:
        """One program, no shell, arguments that name paths kept inside the workspace."""
        if SHELL_META.search(command):
            return {"status": "blocked",
                    "summary": "Run one program at a time here: chains, pipes and redirects are not allowed"}
        try:
            argv = [a[1:-1] if len(a) > 1 and a[0] == a[-1] and a[0] in "\"'" else a
                    for a in shlex.split(command, posix=False)]
        except ValueError:
            return {"status": "failed", "summary": "That command could not be read"}
        if not argv:
            return {"status": "failed", "summary": "No command was given"}
        program = shutil.which(argv[0])
        if program is None:
            return {"status": "failed", "summary": f"{Path(argv[0]).name[:60]} is not installed here"}
        if Path(argv[0]).stem.lower() not in DEV_PROGRAMS and not confirmed:
            return {"status": "needs_confirmation",
                    "summary": f"Run {Path(argv[0]).name[:60]} on this computer?"}
        for arg in argv[1:]:
            if arg.startswith("-") and "=" not in arg:
                continue
            value = arg.split("=", 1)[1] if arg.startswith("-") else arg
            looks_like_path = bool(re.match(r"^([A-Za-z]:|[\\/~]|\.\.?([\\/]|$))", value)) \
                or ".." in re.split(r"[\\/]", value)
            if looks_like_path:
                target = (folder / value).resolve()
                if target != self.root and self.root not in target.parents:
                    raise ScopeError("That path is outside the workspace")
        env = {k: v for k, v in os.environ.items() if not SECRET_ENV.search(k)}
        extra: dict = {"env": env}
        if SYSTEM == "Windows":
            extra["creationflags"] = (getattr(subprocess, "CREATE_NO_WINDOW", 0)
                                      | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0))
        else:
            extra["start_new_session"] = True
        return [program, *argv[1:]], extra

    @staticmethod
    def _kill(process: subprocess.Popen) -> None:
        if SYSTEM == "Windows":
            # The whole tree the command started, not just the program itself.
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                           capture_output=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            return
        try:  # the whole group; bwrap --die-with-parent takes the rest
            os.killpg(process.pid, signal.SIGKILL) if hasattr(os, "killpg") else process.kill()
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

    def _screen(self, kind: str, action: dict, confirmed: bool, cowork: bool,
                cancel: threading.Event) -> dict:
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
        # Every input lands on the screen it was planned against: a changed
        # window or size, or an old observation, gets a fresh look instead.
        why = self._stale(str(action.get("observationId", "")))
        if why:
            return {"status": "stale", "summary": why, "observation": self.observe()}
        if kind == "screen_click":
            scale = self._observation["scale"]
            x, y = float(action.get("x", -1)) * scale, float(action.get("y", -1)) * scale
            width, height = self._observation["geometry"]["w"], self._observation["geometry"]["h"]
            if not (0 <= x < width and 0 <= y < height):
                return {"status": "failed", "summary": "That point is outside the screen"}
            self.guard.ours()
            gui.click(x, y)
            detail = "Clicked on the screen"
        elif kind == "screen_type":
            text = str(action.get("text", ""))[:2000]
            for at in range(0, len(text), 40):
                if cancel.is_set():
                    return {"status": "failed", "summary": "Stopped before it finished", "stopped": True}
                if at and (self._stale(self._observation["id"]) or
                           (self.guard.user_input_at and not cowork)):
                    return {"status": "needs_confirmation",
                            "summary": "The screen changed while typing, so JARVIS paused. Continue?"}
                self.guard.ours()
                gui.write(text[at:at + 40], interval=0.01)
                self.guard.ours()
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


def _macos_accessibility_allowed() -> bool:
    try:
        import ctypes
        services = ctypes.cdll.LoadLibrary(
            "/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices")
        return bool(services.AXIsProcessTrusted())
    except (OSError, AttributeError):
        return False


def _macos_screen_allowed() -> bool:
    try:
        import ctypes
        graphics = ctypes.cdll.LoadLibrary(
            "/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics")
        return bool(graphics.CGPreflightScreenCaptureAccess())
    except (OSError, AttributeError):
        return False


def _plain(error: Exception) -> str:
    """What went wrong, without paths, user names or anything else local."""
    for kind, words in ((FileNotFoundError, "That file or folder does not exist"),
                        (IsADirectoryError, "That is a folder, not a file"),
                        (NotADirectoryError, "That is a file, not a folder"),
                        (PermissionError, "This computer did not allow that"),
                        (FileExistsError, "That already exists"),
                        (TimeoutError, "That took too long")):
        if isinstance(error, kind):
            return words
    return f"That did not work ({type(error).__name__})"


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
