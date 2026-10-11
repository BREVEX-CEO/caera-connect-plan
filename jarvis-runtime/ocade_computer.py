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
import filecmp
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
PASTE_OVER = 40  # longer text is pasted (and the clipboard restored) instead of typed key by key
UNDO_DEPTH = 10  # donor core/undo.py: roughly "this conversation"
APPS_FRESH_S = 600  # the app list open_app trusts before looking again
IMPORT_LIMIT = 1 << 30  # a copy into the work folder
RESERVED = re.compile(r"(?i)con|prn|aux|nul|com[0-9]|lpt[0-9]|conin\$|conout\$")
_APPS: dict = {"at": float("-inf"), "list": []}
STOPPED = {"status": "failed", "summary": "Stopped before it finished", "stopped": True}
MOVED = 12  # mean grey-level change around a point that makes its observation stale

# Anything a shell (or cmd.exe for .cmd/.bat programs) would interpret.
SHELL_META = re.compile(r"[&|;<>^`$%!\r\n]")
SECRET_ENV = re.compile(r"KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|COOKIE|SESSION|AUTH",
                        re.IGNORECASE)


COMMANDS = json.loads((Path(__file__).resolve().parent / "ocade_protocol.json").read_text())["commands"]
_RISKY = re.compile(COMMANDS["risky"], re.IGNORECASE)


def _matches_form(forms: list[str] | None, args: list[str]) -> bool:
    for form in forms or []:
        if form == "*":
            return True
        if form == "<script>":
            if args and not args[0].startswith("-") and args[0].lower().endswith(tuple(COMMANDS["scripts"])):
                return True
            continue
        words = form.split(" ")
        if len(args) >= len(words) and all(a.lower() == w for a, w in zip(args, words)):
            return True
    return False


def command_class(command: str, argv: list[str] | None = None) -> str:
    """ask / inert / routine / other, by the rules OCADE decided by (ocade_protocol.json).
    `argv`: the exact arguments the device will run, which then decide (not a re-reading)."""
    tokens = argv if argv is not None else [
        t[1:-1] if len(t) > 1 and t[0] == t[-1] and t[0] in "\"'" else t
        for t in re.findall(r"\"[^\"]*\"|'[^']*'|\S+", command)]
    if re.search(r"[\x00-\x1f\x7f]", command) or not tokens:
        return "ask"
    if re.search(r"[\\/:]", tokens[0]):
        return "other"  # a program named by a path is whatever file is there, not the tool it is named after
    base = re.sub(r"\.(exe|cmd|bat|com)$", "", tokens[0].lower())
    program, args = COMMANDS["aliases"].get(base, base), tokens[1:]
    if not program or program in COMMANDS["ask"] or _RISKY.search(" ".join(tokens)) or _RISKY.search(command):
        return "ask"
    if _matches_form(COMMANDS["inert"].get(program), args):
        return "inert"
    if _matches_form(COMMANDS["routine"].get(program), args):
        return "routine"
    return "other"


def _jpeg(image) -> str:
    if image.width > FRAME_WIDTH:
        image = image.resize((FRAME_WIDTH, round(image.height * FRAME_WIDTH / image.width)))
    out = io.BytesIO()
    image.convert("RGB").save(out, "JPEG", quality=50)
    return base64.b64encode(out.getvalue()).decode()


# What Windows itself knows about a file (its property system: any format with a
# handler, video, audio, images and documents alike), for checking a result.
_PROPERTIES = (
    ("System.Media.Duration", "seconds", lambda v: round(int(v) / 1e7, 2)),
    ("System.Video.FrameWidth", "width", int),
    ("System.Video.FrameHeight", "height", int),
    ("System.Video.FrameRate", "fps", lambda v: round(int(v) / 1000, 3)),
    ("System.Image.HorizontalSize", "width", int),
    ("System.Image.VerticalSize", "height", int),
    ("System.Audio.ChannelCount", "audioChannels", int),
    ("System.Document.PageCount", "pages", int),
)


def file_properties(path: Path) -> dict:
    if SYSTEM != "Windows" or not path.is_file():
        return {}
    try:
        import comtypes
        import comtypes.client
    except ImportError:
        return {}
    comtypes.CoInitialize()
    try:
        shell = comtypes.client.CreateObject("Shell.Application", dynamic=True)
        folder = shell.Namespace(str(path.resolve().parent))
        item = folder.ParseName(path.name) if folder else None
        found: dict = {}
        for key, name, read in _PROPERTIES if item else ():
            value = item.ExtendedProperty(key)
            if value not in (None, "") and name not in found:
                found[name] = read(value)
        return found
    except Exception:  # an unreadable property is no property, never a failed look
        return {}
    finally:
        comtypes.CoUninitialize()


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
        self._listeners: list = []

    def start(self) -> bool:
        if self._listeners:
            return True
        try:
            from pynput import keyboard, mouse
        except Exception:  # no input hooks here (headless, or not permitted)
            return False
        seen = lambda *_: self.note()  # noqa: E731
        self._listeners = [mouse.Listener(on_move=seen, on_click=seen, on_scroll=seen, daemon=True),
                           keyboard.Listener(on_press=seen, daemon=True)]
        for listener in self._listeners:
            listener.start()
        return True

    def stop(self) -> None:
        for listener in self._listeners:
            listener.stop()
        self._listeners = []

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
        self._undo: list[tuple[str, object]] = []  # (what was done, how to reverse it), newest last
        self._made: set[Path] = set()  # files JARVIS itself created or copied: free to edit
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
                "accessibility": SYSTEM == "Windows",
                "files": self.root is not None,
                "terminal": self.root is not None and self.sandbox is not None}

    # -- one action ----------------------------------------------------------------

    def run(self, action: dict, confirmed: bool = False, cowork: bool = False,
            cancel: threading.Event | None = None) -> dict:
        kind = str(action.get("action", ""))
        cancel = cancel or threading.Event()
        if cancel.is_set():  # stopped before it began: nothing at all happens
            return dict(STOPPED)
        try:
            if kind == "apps":
                apps = installed_apps()
                _APPS.update(at=time.monotonic(), list=apps)
                return {"status": "done", "summary": f"Found {len(apps)} apps",
                        "apps": [a["name"] for a in apps]}
            # What takes the foreground or drives the person's Office waits for
            # them, as screen input does, after mouse or keyboard use of their own.
            if kind in ("open_app", "window", "sheet_edit", "doc_edit") and \
                    (paused := self._paused(cowork, confirmed)):
                return paused
            if kind == "open_app":
                return self._open_app(str(action.get("name", "")), cancel)
            if kind in ("app_info", "recipe_save", "drives", "file_locate", "file_import", "file_export"):
                return self._discover(kind, action, confirmed, cancel)
            if kind.startswith("file_"):
                return self._file(kind, action, confirmed, cancel)
            if kind in ("sheet_inspect", "sheet_edit"):
                return self._sheet(kind, action, cancel)
            if kind == "doc_edit":
                return self._doc(action, cancel)
            if kind == "run":
                return self._run(str(action.get("command", "")), action.get("cwd"), confirmed, cancel)
            if kind == "system":
                return self._system(str(action.get("op", "")), confirmed)
            if kind == "setting":
                import ocade_settings
                return ocade_settings.setting(str(action.get("name", "")),
                                              action.get("on") if "on" in action else action.get("level"))
            if kind == "system_status":
                import ocade_settings
                return ocade_settings.status()
            if kind == "undo":
                return self._undo_last()
            if kind.startswith("screen"):
                with self._lock:
                    return self._screen(kind, action, confirmed, cowork, cancel)
            if kind in ("ui_inspect", "ui_act"):
                if SYSTEM != "Windows":
                    return {"status": "blocked", "summary": "App controls are read on Windows only so far"}
                import ocade_accessibility
                with self._lock:
                    if kind == "ui_inspect":
                        return ocade_accessibility.inspect(action.get("title"), action.get("find"), cancel)
                    return ocade_accessibility.act(action, confirmed, cancel)
            if kind in ("window_list", "window"):
                if self._gui() is None:
                    return {"status": "blocked", "summary": "This computer does not allow screen control"}
                with self._lock:
                    return self._window(kind, action, confirmed)
        except ScopeError as e:
            return {"status": "blocked", "summary": str(e)}
        except Exception as e:  # reported, never retried blindly
            # Plain words only: an exception's text carries local paths and names.
            return {"status": "failed", "summary": _plain(e)}
        return {"status": "failed", "summary": "Unknown computer action"}

    # -- apps ----------------------------------------------------------------------

    @staticmethod
    def _app_named(name: str, cancel: threading.Event) -> dict | None:
        """The recent list first; a full look (up to 30 s) only for an app installed since.
        Raises _Stopped when STOP comes while looking."""
        apps = _APPS["list"] if time.monotonic() - _APPS["at"] < APPS_FRESH_S else []
        app = next((a for a in apps if a["name"].lower() == name.lower()), None)
        if app is None:
            box: dict = {}
            looking = threading.Thread(target=lambda: box.update(apps=installed_apps()), daemon=True)
            looking.start()
            while looking.is_alive():
                if cancel.is_set():
                    raise _Stopped()
                looking.join(0.2)
            _APPS.update(at=time.monotonic(), list=box.get("apps", []))
            app = next((a for a in _APPS["list"] if a["name"].lower() == name.lower()), None)
        return app

    def _open_app(self, name: str, cancel: threading.Event) -> dict:
        try:
            app = self._app_named(name, cancel)
        except _Stopped:
            return {"status": "failed", "summary": "Stopped before it finished", "stopped": True}
        if app is None:
            return {"status": "failed", "summary": f"{name} is not installed on this computer"}
        _launch(app)
        return {"status": "done", "summary": f"Opened {app['name']}"}

    # -- discovery: any app, the drives, files by name; copies in and out ------------

    def _discover(self, kind: str, action: dict, confirmed: bool, cancel: threading.Event) -> dict:
        import ocade_discovery
        stopped = {"status": "failed", "summary": "Stopped before it finished", "stopped": True}
        if kind in ("app_info", "recipe_save"):
            name = str(action.get("name" if kind == "app_info" else "app", ""))
            try:
                app = self._app_named(name, cancel)
            except _Stopped:
                return stopped
            if app is None:
                return {"status": "failed", "summary": f"{name} is not installed on this computer"}
            if kind == "recipe_save":
                return ocade_discovery.save_recipe(action, ocade_discovery.version_of(app))
            info = ocade_discovery.app_info(app, cancel)
            return stopped if cancel.is_set() else {
                "status": "done", "summary": f"Read how {app['name']} can be driven here", "app": info}
        if kind == "drives":
            return {"status": "done", "summary": "Listed the connected drives", "drives": ocade_discovery.drives()}
        if kind == "file_locate":
            found = ocade_discovery.locate(str(action.get("name", "")), str(action.get("extension", "")), cancel)
            return stopped if cancel.is_set() else {
                "status": "done", "summary": f"Found {len(found)} file(s) by name", "entries": found}
        # Past the work folder, in or out: only what the person confirmed, never over a file.
        if not confirmed:
            return {"status": "needs_confirmation", "summary": "Confirm before JARVIS reaches past the work folder"}
        if self.root is None:
            raise ScopeError("No workspace is selected on this computer")
        if kind == "file_import":
            source = Path(str(action.get("from", ""))).resolve()
            if not source.is_file():
                return {"status": "failed", "summary": "That file does not exist"}
            if source.stat().st_size > IMPORT_LIMIT:
                return {"status": "failed", "summary": "That file is too large to copy in (over 1 GB)"}
            target = self._inside(str(action.get("to") or f"imports/{source.name}"), change=True)
            if target.is_dir():
                target = self._inside(str((target / source.name).relative_to(self.root)), change=True)
            stem, suffix, n = target.stem, target.suffix, 1
            while target.exists():
                n += 1
                target = self._inside(str((target.parent / f"{stem} ({n}){suffix}").relative_to(self.root)),
                                      change=True)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
            self._made.add(target)
            rel = str(target.relative_to(self.root))
            self._remember(f"copying {source.name} in", lambda: self._to_trash(target))
            return {"status": "done", "summary": f"Copied {source.name} into the work folder as {rel}",
                    "path": rel}
        source = self._inside(str(action.get("path", "")))
        folder = Path(str(action.get("to", ""))).resolve()
        name = str(action.get("name") or source.name)
        if not source.is_file():
            return {"status": "failed", "summary": "Only a file in the work folder can be saved out"}
        if not folder.is_dir():
            return {"status": "failed", "summary": "That folder does not exist"}
        if _starts_things(folder):
            return {"status": "blocked",
                    "summary": "JARVIS does not save into a folder the computer runs things from"}
        if not name or re.search(r"[\\/:*?\"<>|]", name) or name in (".", ".."):
            return {"status": "failed", "summary": "That is not a usable name"}
        target = folder / name
        if target.exists():
            return {"status": "failed", "summary": f"{name} already exists there; nothing was overwritten"}
        shutil.copy2(source, target)
        saved = (target.stat().st_mtime_ns, target.stat().st_size)

        def take_back():  # outside the work folder: only the very copy JARVIS made, to the Trash
            if not target.is_file() or (target.stat().st_mtime_ns, target.stat().st_size) != saved:
                raise ScopeError("it changed since JARVIS saved it")
            from send2trash import send2trash
            send2trash(str(target))
        self._remember(f"saving {name} out", take_back)
        return {"status": "done", "summary": f"Saved {name} in {folder.name or folder}"}

    # -- files: always inside the workspace -----------------------------------------

    def _inside(self, raw: str, change: bool = False) -> Path:
        if self.root is None:
            raise ScopeError("No workspace is selected on this computer")
        target = (self.root / raw).resolve()
        if not self._holds(target):
            raise ScopeError("That path is outside the workspace")
        parts = target.relative_to(self.root).parts
        # A repository's own settings and hooks are programs git runs: never written by a task.
        if change and any(part.lower() == ".git" for part in parts):
            raise ScopeError("JARVIS does not change a repository's own settings (.git)")
        # Device names (NUL, CON, COM1…) and alternate data streams (name:stream) are not files.
        if change and any(":" in part or RESERVED.fullmatch(part.split(".")[0]) for part in parts):
            raise ScopeError("That is not a usable file name")
        return target

    def _holds(self, resolved: Path) -> bool:
        return resolved == self.root or self.root in resolved.parents

    def _file(self, kind: str, action: dict, confirmed: bool, cancel: threading.Event) -> dict:
        path = self._inside(str(action.get("path", "")),
                            change=kind not in ("file_list", "file_read", "file_info", "file_find", "file_extract"))
        rel = str(path.relative_to(self.root)) or "."
        if kind == "file_list":
            if not path.is_dir():
                return {"status": "failed", "summary": f"{rel} is not a folder"}
            items = sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))[:200]
            return {"status": "done", "summary": f"Listed {rel}",
                    "entries": [{"name": p.name, "folder": p.is_dir(),
                                 "size": p.stat().st_size if p.is_file() else None} for p in items]}
        if kind == "file_read":
            with path.open("rb") as source:  # only what one result carries, however big the file
                data = source.read(MAX_READ)
            if b"\0" in data[:4096]:
                return {"status": "failed", "summary": f"{rel} is not a text file"}
            return {"status": "done", "summary": f"Read {rel}",
                    "content": data.decode("utf-8", errors="replace"),
                    "truncated": path.stat().st_size > MAX_READ}
        if kind == "file_write":
            # An overwrite keeps what was there first (donor undo: act, and remember how to reverse it).
            kept = self._keep(path) if path.is_file() else None
            if kept is None:
                self._made.add(path)
            path.parent.mkdir(parents=True, exist_ok=True)
            parent = self._inside(str(path.parent.relative_to(self.root)), change=True)
            # A fresh random name created exclusively (O_EXCL never follows an
            # existing entry), so nothing planted in the workspace can redirect it.
            fd, tmp = tempfile.mkstemp(dir=parent, prefix=".ocade-", suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8", newline="") as out:  # byte-exact: no CR added on Windows
                    out.write(str(action.get("content", "")))
                    out.flush()
                    os.fsync(out.fileno())
                if Path(tmp).resolve().parent != parent or self._inside(rel) != path:
                    raise ScopeError("The workspace changed while writing")
                os.replace(tmp, path)
            finally:
                if os.path.lexists(tmp):
                    os.unlink(tmp)
            self._remember(f"writing {rel}", (lambda: self._put_back(kept, path)) if kept
                           else (lambda: self._to_trash(path)))
            return {"status": "done", "summary": f"Wrote {rel}"}
        if kind == "file_mkdir":
            existed = path.is_dir()
            path.mkdir(parents=True, exist_ok=True)
            if not existed:
                self._remember(f"creating the folder {rel}", lambda: self._remove_empty(path))
            return {"status": "done", "summary": f"{rel} already existed" if existed else f"Created folder {rel}"}
        if kind == "file_info":
            info = path.stat()
            return {"status": "done", "summary": f"Details of {rel}",
                    "info": {"name": path.name, "folder": path.is_dir(), "size": info.st_size,
                             "modified": time.strftime("%Y-%m-%d %H:%M", time.localtime(info.st_mtime)),
                             "extension": path.suffix or None,
                             **({"properties": found} if (found := file_properties(path)) else {})}}
        if kind == "file_find":
            return self._find(path, rel, str(action.get("name", "")), str(action.get("extension", "")),
                              cancel)
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
            return self._relocate(kind, path, rel, action, cancel)
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
        path = self._inside(str(action.get("path", "")), change=kind == "sheet_edit")
        rel = str(path.relative_to(self.root))
        sheet = action.get("sheet")
        if kind == "sheet_edit" and (refused := self._original(path, rel, action)):
            return refused
        try:
            if kind == "sheet_inspect":
                return {"status": "done", "summary": f"Inspected {rel}",
                        "workbook": ocade_sheets.inspect(path, sheet)}
            out = ocade_sheets.edit(path, sheet, list(action.get("ops") or []), self._undo_dir(), cancel,
                                   close=bool(action.get("_close")))
        except ocade_sheets.SheetError as e:
            return {"status": "failed", "summary": str(e)}
        except KeyError:
            return {"status": "failed", "summary": "That sheet does not exist in the workbook"}
        if not out.get("ok"):
            return self._unfinished(out, rel, path, "workbook")
        kept = self._undo_dir() / str(out["backup"])
        self._remember(f"updating {rel}", lambda: self._put_back(kept, path))
        # What a person would see at once: a formula that counts itself, or an error value.
        found = ocade_sheets.problems(out.get("read") or {})
        check = f". Check: {'; '.join(found[:3])}" if found else ""
        return {"status": "done", "summary": f"Updated {rel} ({len(out['applied'])} changes, "
                                             f"{'in Excel' if out['engine'] == 'excel' else 'in the file'}){check}",
                **({"problems": found} if found else {}),
                **{k: v for k, v in out.items() if k != "ok"}}

    def _original(self, path: Path, rel: str, action: dict) -> dict | None:
        """A file the person had is kept as it was unless they asked to change it: the work goes
        into a copy. (Asked to keep the original, JARVIS edited it and then copied it.)"""
        if not path.is_file() or path in self._made or action.get("overwrite") is True:
            return None
        return {"status": "failed",
                "summary": f"{rel} is the person's original. Copy it first (file_copy to a new name such as "
                           f"\"{path.stem} - completed{path.suffix}\") and change the copy; set overwrite "
                           f"only when the person asked to change this file itself."}

    def _doc(self, action: dict, cancel: threading.Event) -> dict:
        import ocade_documents
        path = self._inside(str(action.get("path", "")), change=True)
        rel = str(path.relative_to(self.root))
        if not path.is_file():
            return {"status": "failed", "summary": f"{rel} does not exist"}
        if refused := self._original(path, rel, action):
            return refused
        try:
            out = ocade_documents.edit_word(path, list(action.get("ops") or []), self._undo_dir(), cancel,
                                            close=bool(action.get("_close")))
        except ocade_documents.DocumentError as e:
            return {"status": "failed", "summary": str(e)}
        if not out.get("ok"):
            return self._unfinished(out, rel, path, "document")
        kept = self._undo_dir() / str(out["backup"])
        self._remember(f"updating {rel}", lambda: self._put_back(kept, path))
        return {"status": "done", "summary": f"Updated {rel} in Word ({len(out['applied'])} changes)",
                **{k: v for k, v in out.items() if k != "ok"}}

    def _unfinished(self, out: dict, rel: str, path: Path, what: str) -> dict:
        """An Office job that did not finish: Office may have saved part of it, so the kept
        original stays one undo away instead of claiming nothing changed."""
        why = str(out.get("error", ""))[:200]
        kept = self._undo_dir() / str(out["backup"]) if out.get("backup") else None
        # The file itself says whether it changed, not the job's own account of it.
        changed = bool(kept and kept.is_file() and path.is_file()
                       and not filecmp.cmp(kept, path, shallow=False))
        if changed or (kept and out.get("maybeChanged")):
            self._remember(f"updating {rel}", lambda: self._put_back(kept, path))
            summary = (f"The {what} {'was' if changed else 'may be'} partly changed ({why}); "
                       "undo puts the original back")
        else:
            summary = f"The {what} was not changed: {why}"
        if out.get("unsavedEdits"):
            summary += (f". The {what} you have open still shows unsaved partial changes: "
                        "close it without saving to discard them")
        return {"status": "failed", "stopped": bool(out.get("stopped")), "summary": summary,
                "changed": changed}

    def _find(self, folder: Path, rel: str, name: str, extension: str, cancel: threading.Event) -> dict:
        """Donor find_files: name and/or extension, bounded, inside the workspace only."""
        if not folder.is_dir():
            return {"status": "failed", "summary": f"{rel} is not a folder"}
        found, folders = [], 0
        for item in folder.rglob("*"):
            if cancel.is_set():
                return {"status": "failed", "summary": "Stopped before it finished", "stopped": True}
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

    def _relocate(self, kind: str, source: Path, rel: str, action: dict, cancel: threading.Event) -> dict:
        """Donor move/copy/rename: never over an existing file, both ends inside the workspace."""
        if not source.exists():
            return {"status": "failed", "summary": f"{rel} does not exist"}
        if kind == "file_rename":
            new = str(action.get("name", ""))
            if not new or re.search(r"[\\/:*?\"<>|]", new) or new in (".", ".."):
                return {"status": "failed", "summary": "That is not a usable name"}
            target = self._inside(str((source.parent / new).relative_to(self.root)), change=True)
        else:
            target = self._inside(str(action.get("to", "")), change=True)
            if target.is_dir():
                target = self._inside(str((target / source.name).relative_to(self.root)), change=True)
        if target.exists():
            return {"status": "failed",
                    "summary": f"{target.relative_to(self.root)} already exists; nothing was overwritten"}
        if source in target.parents:
            return {"status": "failed", "summary": "A folder cannot go inside itself"}
        target.parent.mkdir(parents=True, exist_ok=True)
        to = str(target.relative_to(self.root))
        if kind == "file_copy":
            if source.is_dir():
                # A link inside the folder that leads out of the workspace is left
                # behind, never followed into a copy JARVIS could then read.
                def leave_out(folder, names):
                    if cancel.is_set():  # STOP ends the copy; what was copied goes to the Trash
                        raise _Stopped()
                    return [n for n in names if not self._holds((Path(folder) / n).resolve())]
                try:
                    shutil.copytree(source, target, ignore=leave_out)
                except _Stopped:
                    if target.exists():
                        self._to_trash(target)
                    return {"status": "failed", "summary": "Stopped before it finished", "stopped": True}
            else:
                shutil.copy2(source, target)
                self._made.add(target)
            self._remember(f"copying {rel} to {to}", lambda: self._to_trash(target))
            return {"status": "done", "summary": f"Copied {rel} to {to}"}
        shutil.move(str(source), str(target))
        self._remember(f"{'renaming' if kind == 'file_rename' else 'moving'} {rel} to {to}",
                       lambda: self._move_back(target, source))
        return {"status": "done", "summary": f"{'Renamed' if kind == 'file_rename' else 'Moved'} {rel} to {to}"}

    # -- undo: what JARVIS changed in the workspace, newest first (donor core/undo.py) --

    @staticmethod
    def _undo_dir() -> Path:
        return Path(os.environ.get("OCADE_JARVIS_HOME", Path.home() / ".ocade_jarvis")) / "undo"

    def _keep(self, path: Path) -> Path:
        import ocade_sheets
        return ocade_sheets.backup(path, self._undo_dir())

    def _remember(self, label: str, reverse) -> None:
        self._undo.append((label, reverse))
        del self._undo[:-UNDO_DEPTH]  # the recent past is what people ask to undo

    def _undo_last(self) -> dict:
        if not self._undo:
            return {"status": "failed", "summary": "There is nothing to undo. Only file changes JARVIS made "
                                                   "here since it started can be undone."}
        # Taken off first: a failing undo is not retried against files that have moved on.
        label, reverse = self._undo.pop()
        try:
            reverse()
        except ScopeError as e:
            return {"status": "failed", "summary": f"Could not undo {label}: {e}"}
        except Exception as e:
            return {"status": "failed", "summary": f"Could not undo {label}: {_plain(e)}"}
        return {"status": "done", "summary": f"Undone: {label}", "remaining": len(self._undo)}

    def _here(self, path: Path) -> Path:
        """The same place, checked again: the workspace may have changed since the action."""
        return self._inside(str(path.relative_to(self.root)))

    def _put_back(self, kept: Path, path: Path) -> None:
        if not kept.is_file():
            raise ScopeError("the copy kept before the change is no longer there")
        shutil.copy2(kept, self._here(path))

    def _to_trash(self, path: Path) -> None:
        if not self._here(path).exists():
            raise ScopeError("it is no longer there")
        from send2trash import send2trash
        send2trash(str(path))

    def _remove_empty(self, path: Path) -> None:
        if any(self._here(path).iterdir()):
            raise ScopeError("the folder has things in it now")
        path.rmdir()

    def _move_back(self, now: Path, before: Path) -> None:
        if not self._here(now).exists():
            raise ScopeError("it is no longer where JARVIS put it")
        if self._here(before).exists():
            raise ScopeError("something else is at the old place now; nothing was overwritten")
        before.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(now), str(before))

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
        # Output goes to files, not memory: a chatty build cannot grow the agent, and only its tail returns.
        with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
            process = subprocess.Popen(argv, cwd=folder, stdout=out, stderr=err,
                                       stdin=subprocess.DEVNULL, **extra)
            summary = None
            while process.poll() is None:
                over = time.monotonic() - started > RUN_TIMEOUT_S
                if cancel.wait(0.1) or over:
                    self._kill(process)
                    process.wait()
                    summary = (f"The command ran over {RUN_TIMEOUT_S} seconds and was stopped"
                               if over else "Stopped before it finished")
            tails = {name: _tail(f) for name, f in (("stdout", out), ("stderr", err))}
        if summary:
            return {"status": "failed", "stopped": True, "summary": summary, **tails}
        return {"status": "done" if process.returncode == 0 else "failed",
                "summary": f"Exited with {process.returncode} after {time.monotonic() - started:.1f}s",
                "exitCode": process.returncode, "isolation": self.sandbox, **tails}

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
            # An unquoted program path with spaces ("C:\Program Files\App\app.exe -x"):
            # the longest leading run of words that names a real program is the program.
            for end in range(len(argv), 1, -1):
                joined = " ".join(argv[:end])
                if Path(joined).is_file() and shutil.which(joined):
                    argv, program = [joined, *argv[end:]], shutil.which(joined)
                    break
        if program is None:
            return {"status": "failed",
                    "summary": f"{argv[0][:80]} was not found; give a program on the PATH or its full path in quotes"}
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
        # Nothing confines the program here: only the task's own builds, tests,
        # scripts and git reads run unasked; the person sees anything else whole first.
        written = self._holds(Path(program).resolve())  # e.g. a git.exe the task put there
        if not confirmed and (written or command_class(command, argv) not in ("inert", "routine")):
            return {"status": "needs_confirmation", "summary": f"Running {command[:280]}"}
        env ={k: v for k, v in os.environ.items() if not SECRET_ENV.search(k)}
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
        # No macOS "lock": pmset only sleeps the display, which is not a verified lock.
        "Darwin": {"log_out":["osascript", "-e", 'tell application "System Events" to log out'],
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
        """The whole desktop across every monitor (its origin can be negative) and the front window."""
        import mss
        with (getattr(mss, "MSS", None) or mss.mss)() as grab:
            desk = grab.monitors[0]
            monitors = len(grab.monitors) - 1
        gui = self._gui()
        try:  # the same GUI that types reports the window it would type into
            front = gui.getActiveWindow() if gui is not None else None
            window = front.title if front else None
            # Where it is too: a window moved or resized under the same title moves its controls.
            box = tuple(getattr(front, k, None) for k in ("left", "top", "width", "height")) if front else None
        except Exception:
            window, box = None, None
        return {"x": desk["left"], "y": desk["top"], "w": desk["width"], "h": desk["height"],
                "monitors": monitors, "window": window, "box": box}

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
                             "at": time.monotonic(), "grey": image.convert("L")}
        # The frame clicks are given in is the image the model sees, never the desktop's own size:
        # a model told "1920x1080" beside a 1280-wide image clicks off the bottom of it.
        return {"observationId": f"s{self._obs_seq}",
                "image": {"w": round(image.width / scale), "h": round(image.height / scale),
                          "points": "x and y are pixels of this image"},
                "monitors": geometry["monitors"], "activeWindow": geometry["window"],
                "windows": _windows()[:30],
                "imageScale": round(1 / scale, 4), "frame": _jpeg(image)}

    def _point(self, x, y) -> tuple[float, float] | None:
        """A point in the observed image, as a desktop coordinate (every monitor, any DPI)."""
        held = self._observation
        try:
            px, py = float(x) * held["scale"], float(y) * held["scale"]
        except (TypeError, ValueError):
            return None
        geo = held["geometry"]
        if not (0 <= px < geo["w"] and 0 <= py < geo["h"]):
            return None
        return geo["x"] + px, geo["y"] + py

    def _paste(self, gui, text: str, cowork: bool) -> dict | None:
        import pyperclip
        try:
            before = pyperclip.paste()
        except Exception:  # the clipboard held something that is not text
            before = None
        try:
            pyperclip.copy(text)
            if self._stale(self._observation["id"]) or (self.guard.user_input_at and not cowork):
                return {"status": "needs_confirmation",
                        "summary": "The screen changed before typing, so JARVIS paused. Continue?"}
            self.guard.ours()
            gui.hotkey("command" if SYSTEM == "Darwin" else "ctrl", "v")
            self.guard.ours()
            time.sleep(0.3)  # the app reads the clipboard after the key press
        finally:
            if before is not None:
                try:
                    pyperclip.copy(before)
                except Exception:
                    pass
        return None

    def _window(self, kind: str, action: dict, confirmed: bool) -> dict:
        """Existing app windows first (donor focus_window, without building a script from a title)."""
        import pygetwindow
        if kind == "window_list":
            return {"status": "done", "summary": "Listed the open windows", "windows": _windows()}
        wanted = str(action.get("title", "")).strip().lower()
        matches = [w for w in pygetwindow.getAllWindows() if w.title.strip() and wanted in w.title.lower()]
        exact = [w for w in matches if w.title.strip().lower() == wanted]
        if not wanted or not matches:
            return {"status": "failed", "summary": "No open window has that title",
                    "windows": _windows()}
        # Store apps show the same title twice (frame and content): one app, one window.
        distinct = {w.title.strip().lower() for w in (exact or matches)}
        if len(distinct) > 1:
            return {"status": "failed", "summary": "Several windows match; use the full title",
                    "windows": [w.title for w in matches][:10]}
        window = max(exact or matches, key=lambda w: (w.visible, w.width * w.height))
        title = window.title  # read now: a closed window has no title left to report
        state = str(action.get("state", "focus"))
        if state == "close" and not confirmed:
            return {"status": "needs_confirmation", "summary": f"Close “{window.title[:80]}”?"}
        self.guard.ours()
        if state == "minimize":
            window.minimize()
        elif state == "maximize":
            window.maximize()
        elif state == "restore":
            window.restore()
        elif state == "close":
            for same in exact or [window]:  # a Store app's frame and content close together
                same.close()
        else:
            if window.isMinimized:
                window.restore()
            try:
                window.activate()
            except Exception:  # Windows refuses focus theft sometimes; a click on the window works
                window.minimize()
                window.restore()
            time.sleep(0.4)
            if _front_window_title() != window.title:
                return {"status": "failed", "summary": f"Windows did not bring “{window.title[:80]}” to the front",
                        "observation": self.observe()}
        time.sleep(0.3)
        return {"status": "done", "summary": f"{state.capitalize()} “{title[:80]}”",
                "observation": self.observe()}

    def _stale(self, observation_id: str, points: tuple = ()) -> str | None:
        held = self._observation
        if not held or held["id"] != observation_id:
            return "That screen observation is no longer current."
        if time.monotonic() - held["at"] > 60:
            return "That screen observation is too old."
        now = self._geometry()
        for key, label in (("w", "the screen size changed"), ("h", "the screen size changed"),
                           ("x", "a monitor changed"), ("y", "a monitor changed"),
                           ("monitors", "a monitor was added or removed"),
                           ("window", "a different window is in front"),
                           ("box", "the window in front moved or changed size")):
            if now.get(key) != held["geometry"].get(key):
                return f"The screen changed: {label}."
        if any(self._changed_at(point) for point in points):
            return "The screen changed where JARVIS would act."
        return None

    def _changed_at(self, point: tuple[float, float], half: int = 24) -> bool:
        """The pixels around a desktop point, now against the observation: a popup, a scroll or
        content that moved under the same window makes the planned point mean something else."""
        held = self._observation
        grey = held.get("grey") if held else None
        if grey is None:
            return False
        geo = held["geometry"]
        left = max(0, min(grey.width - 2 * half, round(point[0] - geo["x"]) - half))
        top = max(0, min(grey.height - 2 * half, round(point[1] - geo["y"]) - half))
        import mss
        from PIL import Image, ImageChops, ImageStat
        with (getattr(mss, "MSS", None) or mss.mss)() as grab:
            raw = grab.grab({"left": geo["x"] + left, "top": geo["y"] + top,
                             "width": 2 * half, "height": 2 * half})
        now = Image.frombytes("RGB", raw.size, raw.rgb).convert("L")
        before = grey.crop((left, top, left + 2 * half, top + 2 * half))
        return ImageStat.Stat(ImageChops.difference(now, before)).mean[0] > MOVED

    @staticmethod
    def _gate(x: int | None, y: int | None, confirmed: bool, press: bool = False) -> dict | None:
        """The browser's and the app controls' hard rules, for coordinates too (Windows UI Automation)."""
        if SYSTEM != "Windows":
            return None  # ponytail: macOS AX lookup when the agent ships there
        try:
            import ocade_accessibility
            return ocade_accessibility.gate_at(x, y, confirmed, press)
        except Exception:
            # Unreadable (an elevated window, say): what is there cannot be checked, so the person
            # decides. A confirmed step is theirs; everything else waits.
            return None if confirmed else {
                "status": "needs_confirmation",
                "summary": "JARVIS could not check what is at that spot on the screen. Continue?"}

    def _paused(self, cowork: bool, confirmed: bool) -> dict | None:
        """The person's own input pauses JARVIS until they say Continue (their
        confirmation of this step), unless they chose to work alongside it."""
        self.guard.start()
        if self.guard.user_input_at and not cowork and not confirmed:
            return {"status": "needs_confirmation",
                    "summary": "You used the mouse or keyboard, so JARVIS paused. Continue?"}
        self.guard.user_input_at = 0.0
        return None

    def _screen(self, kind: str, action: dict, confirmed: bool, cowork: bool,
                cancel: threading.Event) -> dict:
        gui = self._gui()
        if gui is None:
            return {"status": "blocked", "summary": "This computer does not allow screen control"}
        if kind == "screen":
            return {"status": "done", "summary": "Looked at the screen", "observation": self.observe()}
        if paused := self._paused(cowork, confirmed):
            return paused
        # Every input lands on the screen it was planned against: a changed
        # window or size, or an old observation, gets a fresh look instead.
        why = self._stale(str(action.get("observationId", "")))
        if why:
            return {"status": "stale", "summary": why, "observation": self.observe()}
        if kind in ("screen_click", "screen_drag"):
            points = [self._point(action.get("x"), action.get("y"))]
            if kind == "screen_drag":
                points.append(self._point(action.get("toX"), action.get("toY")))
            if None in points:
                return {"status": "failed", "summary": "That point is outside the screen"}
            if any(self._changed_at(point) for point in points):
                return {"status": "stale", "summary": "The screen changed where JARVIS would act.",
                        "observation": self.observe()}
            for point in points:  # a drag lets go on its drop point, which is a press there
                if gated := self._gate(point[0], point[1], confirmed):
                    return gated
            if cancel.is_set():  # STOP while the target was being checked: no input
                return dict(STOPPED)
            self.guard.ours()
            if kind == "screen_drag":
                gui.moveTo(*points[0])
                self.guard.ours()
                gui.dragTo(*points[1], duration=0.4, button="left")
                detail = "Dragged on the screen"
            else:
                button = "right" if action.get("button") == "right" else "left"
                clicks = 2 if action.get("double") else 1
                gui.click(*points[0], button=button, clicks=clicks, interval=0.08)
                detail = f"{'Double-clicked' if clicks == 2 else 'Right-clicked' if button == 'right' else 'Clicked'} on the screen"
        elif kind == "screen_type" and (gated := self._gate(None, None, confirmed,
                                                             press="\n" in str(action.get("text", "")))):
            return gated
        elif kind == "screen_type" and len(str(action.get("text", ""))) > PASTE_OVER:
            # Long text goes in by paste (donor _smart_type), then the clipboard is put back.
            if cancel.is_set():
                return dict(STOPPED)
            outcome = self._paste(gui, str(action.get("text", ""))[:20_000], cowork)
            if outcome:
                return outcome
            detail = "Typed"
        elif kind == "screen_type":
            text = str(action.get("text", ""))[:2000]
            for at in range(0, len(text), 40):
                if cancel.is_set():
                    return dict(STOPPED)
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
            if gated := self._gate(None, None, confirmed,
                                   press=any(k.lower() in ("enter", "return", "space") for k in keys)):
                return gated
            if cancel.is_set():
                return dict(STOPPED)
            self.guard.ours()
            gui.hotkey(*keys) if len(keys) > 1 else gui.press(keys[0])
            detail = f"Pressed {'+'.join(keys)}"
        elif kind == "screen_scroll":
            if cancel.is_set():
                return dict(STOPPED)
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


def _starts_things(folder: Path) -> bool:
    """Startup folders, the system's own folders and installed programs: a file there can run itself."""
    text = str(folder).lower().replace("/", "\\")
    env = {k: os.environ.get(k, "").lower() for k in ("APPDATA", "PROGRAMDATA", "SYSTEMROOT", "PROGRAMFILES",
                                                      "PROGRAMFILES(X86)", "PROGRAMW6432")}
    roots = [env["SYSTEMROOT"], env["PROGRAMFILES"], env["PROGRAMFILES(X86)"], env["PROGRAMW6432"],
             env["APPDATA"] + "\\microsoft\\windows\\start menu",
             env["PROGRAMDATA"] + "\\microsoft\\windows\\start menu"]
    return "\\startup" in text or any(r and (text == r or text.startswith(r + "\\")) for r in roots)


class _Stopped(Exception):
    pass


def _front_window_title() -> str | None:
    try:
        import pygetwindow
        window = pygetwindow.getActiveWindow()
        return window.title if window else None
    except Exception:
        return None


def _windows() -> list[dict]:
    """Visible top-level windows, front first: what JARVIS can switch to instead of opening again."""
    try:
        import pygetwindow
        front = _front_window_title()
        out = []
        for w in pygetwindow.getAllWindows():
            if w.title.strip() and w.visible and w.width > 50 and w.height > 50:
                out.append({"title": w.title[:120], "front": w.title == front, "minimized": w.isMinimized})
        return sorted(out, key=lambda w: not w["front"])[:60]
    except Exception:
        return []


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


def _tail(file) -> str:
    file.seek(0, os.SEEK_END)
    file.seek(max(0, file.tell() - MAX_OUTPUT * 4))
    return file.read().decode(errors="replace")[-MAX_OUTPUT:]


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
