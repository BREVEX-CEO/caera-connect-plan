"""The companion's floating JARVIS bar (plan 14F.4): a small window over the app JARVIS is working
in, with the factual number of active agents, what each is doing, STOP, Pin, and an instruction
composer that stays outside the agent list.

Two halves that share only files in the companion's home folder:

- The agent loop writes `bar.json` (what is running now, from the steps it actually runs) and
  delivers what the person typed (`instructions/*.json`) to the server as signed `instruct`
  requests, one per file, removing a file only once the server has an answer for it.
- `ocade_agent bar` shows that state in a Tk window. STOP writes the same STOP file as the tray
  and `ocade_agent stop`, so it works with no network. Pin keeps the bar visible over other apps;
  it never extends any permission. The bar never reads the screen and never types or clicks.

Agent markers come only from real coordinates: the point a `ui.click_point` step reported it
clicked. Work without a point (files, documents, accessibility patterns) is listed by name and
colour, never shown as a fabricated pointer.
"""

from __future__ import annotations

import json
import os
import threading
import time
import uuid
from pathlib import Path

LANES = 4
_instruction_lock = threading.Lock()
_last_instruction_at = 0
# Stable per-agent colour plus a name and a shape, never colour alone (14F.3.5).
AGENTS = (
    ("Agent 1", "#0284c7", "●"),
    ("Agent 2", "#d97706", "▲"),
    ("Agent 3", "#059669", "■"),
    ("Agent 4", "#c026d3", "◆"),
)
WORDS = {
    "fs.list": "Looking at files", "fs.read_text": "Reading a file", "fs.write_text": "Writing a file",
    "fs.replace_text": "Replacing a file", "fs.edit_text": "Editing a file", "fs.manage": "Organising files",
    "office.inspect_workbook": "Reading a workbook", "office.write_document": "Writing a document",
    "office.write_workbook": "Writing a workbook", "office.write_presentation": "Writing slides",
    "office.edit_document": "Editing a document", "office.edit_workbook": "Editing a workbook",
    "media.inspect": "Inspecting media", "media.trim": "Trimming media", "media.preview": "Previewing media",
    "image.edit": "Editing an image", "media.analyze": "Analysing media",
    "media.render_timeline": "Rendering a video", "scene.render": "Rendering a 3D scene",
    "apps.list": "Listing apps", "apps.launch": "Opening an app", "ui.inspect": "Reading an app window",
    "ui.wait": "Waiting for an app", "ui.watch": "Watching an app window", "ui.record": "Recording what you show (STOP ends it)", "ui.scroll": "Scrolling in an app", "ui.invoke": "Pressing a control",
    "ui.set_value": "Filling a field", "ui.send_keys": "Typing in an app", "ui.click_point": "Clicking in an app",
    "shell.run": "Running a command", "job.start": "Starting a long job", "job.status": "Checking a long job",
    "job.cancel": "Ending a long job", "verify.checks": "Checking the result", "web.open": "Opening a page",
    "web.read": "Reading a page", "web.fill": "Filling a form", "web.click": "Clicking on a page",
}


def write_json(path: Path, value) -> None:
    """Atomic: the bar never reads half a file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(value), encoding="utf-8")
    os.replace(temporary, path)


def describe(intent: dict) -> str:
    return WORDS.get(str(intent.get("operation")), "Working")


def window_of(intent: dict) -> dict | None:
    """The leased app window a step acts on, when it names one."""
    window = (intent.get("arguments") or {}).get("window")
    if (isinstance(window, dict) and isinstance(window.get("hwnd"), int)
            and isinstance(window.get("pid"), int) and isinstance(window.get("exe"), str)
            and isinstance(window.get("started"), (int, float))):
        return {key: window[key] for key in ("hwnd", "pid", "exe", "started")}
    return None


def visible_marks(state: dict, foreground_bounds: tuple[int, int, int, int] | None, now: float) -> list[dict]:
    """A historical click can only mark its own lease while that window is in front."""
    window = state.get("window")
    if not window or foreground_bounds is None:
        return []
    left, top, right, bottom = foreground_bounds
    return [mark for mark in state.get("marks") or []
            if mark.get("window") == window and 0 <= now - mark["at"] <= 2.5
            and left <= mark["x"] < right and top <= mark["y"] < bottom]


class BarState:
    """What the bar shows, kept by the agent loop from the steps it really runs."""

    def __init__(self, home: Path):
        self.path = home / "bar.json"
        self.task: dict = {}
        self.lanes: dict[int, dict] = {}
        self.marks: list[dict] = []
        self.sent: list[dict] = []
        self.window: dict | None = None

    def task_seen(self, task: dict | None, mode: str | None = None) -> None:
        task = task or {}
        mode = mode if mode in ("live", "background", "rehearsal") else self.task.get("mode", "live")
        next_task = {"id": task.get("id"), "status": task.get("status"), "mode": mode}
        if "instructionRevision" in task:
            next_task["instructionRevision"] = task["instructionRevision"]
        if next_task != self.task:
            if task.get("id") != self.task.get("id"):
                self.lanes.clear()
                self.marks.clear()
                self.window = None
                self.sent.clear()
            self.task = next_task
            self.flush()

    def started(self, lane: int, intent: dict) -> None:
        self.lanes[lane] = {"doing": describe(intent), "since": time.time()}
        self.window = window_of(intent) or self.window
        self.flush()

    def finished(self, lane: int, intent: dict, result: dict) -> None:
        self.lanes.pop(lane, None)
        clicked = (result.get("evidence") or {}).get("clicked")
        window = window_of(intent)
        if (window and intent.get("operation") == "ui.click_point" and isinstance(clicked, list)
                and len(clicked) == 2 and all(isinstance(coordinate, int) for coordinate in clicked)):
            now = time.time()
            self.marks = [mark for mark in self.marks if now - mark["at"] < 3 and mark["lane"] != lane]
            self.marks.append({"lane": lane, "x": clicked[0], "y": clicked[1], "at": now, "window": window})
        self.flush()

    def instruction(self, text: str, state: str) -> None:
        self.sent = (self.sent + [{"text": text[:120], "state": state, "at": time.time()}])[-3:]
        self.flush()

    def flush(self) -> None:
        open_task = self.task.get("status") in ("running", "waiting", "taken_over")
        try:
            write_json(self.path, {
                "task": self.task if open_task else None,
                "agents": [{"lane": lane, **info} for lane, info in sorted(self.lanes.items())],
                "marks": self.marks, "instructions": self.sent, "window": self.window if open_task else None,
                "at": time.time(),
            })
        except OSError:
            pass


def queue_instruction(home: Path, text: str, lane: int | None, task_id: str, previous: str | None) -> Path:
    """What the person typed in the bar, for the agent loop to deliver (the bar has no key)."""
    global _last_instruction_at

    text = text.strip()[:2000]
    if not text:
        raise ValueError("empty instruction")
    if lane is not None and lane not in range(LANES):
        raise ValueError("no such agent")
    if not isinstance(task_id, str):
        raise ValueError("no task to instruct")
    task_id = str(uuid.UUID(task_id))
    previous = str(uuid.UUID(previous)) if previous is not None else None
    client_id = str(uuid.uuid4())
    with _instruction_lock:
        # Windows can return the same wall time for successive writes.
        _last_instruction_at = max(time.time_ns(), _last_instruction_at + 1)
        path = home / "instructions" / f"{_last_instruction_at}-{client_id}.json"
        write_json(path, {"text": text, "lane": lane, "clientId": client_id, "taskId": task_id,
                          "previous": previous})
    return path


def save_pointed(home: Path, image, now: float | None = None) -> str:
    """Point & Ask (plan 14E.5.3): keep the region the person selected as a picture in the JARVIS
    folder's 'OCADE output/pointed', the only place the planner can look at it from (with
    media.preview, and only with the screen permission). Returns its path in the JARVIS folder."""
    from .sandbox import output_path, write_atomically

    config = json.loads((home / "device.json").read_text(encoding="utf-8"))
    workspace = Path(config["workspace"]).resolve()
    timestamp = time.strftime("%Y%m%d-%H%M%S", time.localtime(now))
    name = f"OCADE output/pointed/{timestamp}-{uuid.uuid4().hex}.png"
    write_atomically(output_path(workspace, name), image.save)
    return name


def point_instruction(path: str, question: str) -> str:
    asked = question.strip() or "What is this, and what should I do with it?"
    return (f"I selected this part of my screen and saved it as {path} (look at it with media.preview): "
            f"{asked}")[:2000]


def pending_instructions(home: Path) -> list[tuple[Path, dict]]:
    """Queued instructions, oldest first; an unreadable file is dropped, never sent."""
    return _instruction_files(home / "instructions", limit=10)


def instruction_to_review(home: Path, task_id: str) -> tuple[Path, dict] | None:
    """A conflict requires the person's explicit review before writing another instruction."""
    return next(iter(_instruction_files(home / "instructions" / "review", limit=1, task_id=task_id)), None)


def _instruction_files(folder: Path, limit: int, task_id: str | None = None) -> list[tuple[Path, dict]]:
    def order(path: Path) -> tuple[str, str]:
        timestamp, _, suffix = path.stem.partition("-")
        return timestamp.zfill(20), suffix

    found = []
    for path in sorted(folder.glob("*.json"), key=order):
        try:
            item = json.loads(path.read_text(encoding="utf-8"))
            text, lane = item["text"], item.get("lane")
            client_id = item["clientId"]
            if not isinstance(client_id, str) or ("taskId" in item and not isinstance(item["taskId"], str)):
                raise ValueError
            client = str(uuid.UUID(client_id))
            if not isinstance(text, str) or not text.strip() or (lane is not None and lane not in range(LANES)):
                raise ValueError
            # Older files carry no task identity and receive a final refusal from the server.
            task = {"taskId": str(uuid.UUID(item["taskId"]))} if "taskId" in item else {}
            if task_id is not None and task.get("taskId") != task_id:
                continue
            if "previous" in item:
                previous = item["previous"]
                if previous is not None and not isinstance(previous, str):
                    raise ValueError
                task["previous"] = str(uuid.UUID(previous)) if previous is not None else None
            found.append((path, {"text": text.strip()[:2000], "lane": lane, "clientId": client, **task}))
            if len(found) == limit:
                break
        except (OSError, ValueError, KeyError, TypeError, AttributeError):
            path.unlink(missing_ok=True)
    return found


def summary(state: dict) -> str:
    """The collapsed line: the factual number of active agents and what one of them is doing."""
    task = state.get("task") or {}
    agents = state.get("agents") or []
    if task.get("status") == "taken_over":
        return "You have control. JARVIS is paused."
    if task.get("status") == "waiting":
        return "Waiting" if not agents else f"{len(agents)} working · waiting on a check"
    if not agents:
        return "Planning the next step"
    if len(agents) == 1:
        return agents[0]["doing"]
    return f"{len(agents)} agents working · {agents[0]['doing']}"


def mac_place(window: dict, width: int):  # pragma: no cover - needs a Mac desktop
    """Place the bar only over a live leased window of the foreground app."""
    try:
        import AppKit  # type: ignore[import-not-found]
        import Quartz  # type: ignore[import-not-found]

        from .jobs import process_start

        front = AppKit.NSWorkspace.sharedWorkspace().frontmostApplication()
        if front is None or front.processIdentifier() not in (window["pid"], os.getpid()):
            return None
        listed = Quartz.CGWindowListCopyWindowInfo(
            Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements,
            Quartz.kCGNullWindowID,
        )
        # The first normal window of the app is in front of its other documents.
        top = next((info for info in listed or [] if info.get("kCGWindowOwnerPID") == window["pid"]
                    and info.get("kCGWindowLayer") == 0), None)
        if not top or top.get("kCGWindowNumber") != window["hwnd"]:
            return None
        started = process_start(window["pid"])
        if started is None or abs(started - window["started"]) > 1:
            return None
        bounds = top.get("kCGWindowBounds") or {}
        x, y, w = int(bounds.get("X", 0)), int(bounds.get("Y", 0)), int(bounds.get("Width", 0))
        return max(x, x + (w - width) // 2), y + 30
    except Exception:  # noqa: BLE001 - an unverified window cannot anchor the bar
        return None


def run_bar(home: Path) -> int:  # pragma: no cover - drawn on a real desktop, checked by hand and CI smoke
    """The floating bar window. Ends when the companion's state file is gone for a minute."""
    import sys
    import tkinter as tk

    stop_flag = home / "STOP"
    root = tk.Tk()
    root.title("OCADE JARVIS")
    root.overrideredirect(True)
    root.attributes("-topmost", True)
    root.configure(bg="#111827")
    pinned = tk.BooleanVar(value=False)
    expanded = tk.BooleanVar(value=False)
    target = tk.StringVar(value="Everyone")

    top = tk.Frame(root, bg="#111827")
    top.pack(fill="x", padx=8, pady=(6, 2))
    dots = tk.Label(top, bg="#111827", fg="white", font=("Segoe UI", 10))
    dots.pack(side="left")
    line = tk.Label(top, text="", bg="#111827", fg="white", font=("Segoe UI", 10), anchor="w", width=34)
    line.pack(side="left", padx=6)
    chevron = tk.Button(top, text="▾", width=2, relief="flat", bg="#1f2937", fg="white",
                        command=lambda: expanded.set(not expanded.get()))
    chevron.pack(side="left")
    pin = tk.Checkbutton(top, text="Pin", variable=pinned, bg="#111827", fg="white", selectcolor="#374151",
                         activebackground="#111827")
    pin.pack(side="left", padx=4)
    tk.Button(top, text="STOP", bg="#dc2626", fg="white", relief="flat", padx=8,
              command=lambda: (stop_flag.parent.mkdir(parents=True, exist_ok=True), stop_flag.touch())).pack(side="left")
    details = tk.Frame(root, bg="#111827")
    rows = tk.Label(details, justify="left", anchor="w", bg="#111827", fg="#d1d5db", font=("Segoe UI", 9))
    rows.pack(fill="x", padx=8)
    # The composer is always present, outside the agent list (14F.4.4).
    composer = tk.Frame(root, bg="#111827")
    composer.pack(fill="x", padx=8, pady=(2, 6), side="bottom")
    text = tk.StringVar()
    entry = tk.Entry(composer, textvariable=text, width=36)
    entry.pack(side="left", fill="x", expand=True)
    who = tk.OptionMenu(composer, target, "Everyone", *[name for name, _, _ in AGENTS])
    who.configure(bg="#1f2937", fg="white", relief="flat", highlightthickness=0)
    who.pack(side="left", padx=4)
    status = tk.Label(root, text="", bg="#111827", fg="#9ca3af", font=("Segoe UI", 8), anchor="w")
    status.pack(fill="x", padx=8, side="bottom")
    visible_task = None
    draft_task = None
    reviewed_path = None

    def bind_draft(*_):
        nonlocal draft_task
        if not text.get():
            draft_task = None
        elif draft_task is None:
            draft_task = visible_task

    text.trace_add("write", bind_draft)

    def send(_event=None):
        nonlocal reviewed_path
        if visible_task is None:
            status.configure(text="Waiting for the task's instructions to sync.")
            return "break"
        if draft_task is None or draft_task[0] != visible_task[0]:
            status.configure(text="This draft belongs to another task. Copy it before clearing.")
            return "break"
        name = target.get()
        lane = next((i for i, (n, _, _) in enumerate(AGENTS) if n == name), None)
        try:
            queue_instruction(home, text.get(), lane, *draft_task)
        except (ValueError, OSError):
            return "break"
        text.set("")  # the draft goes only once it is queued for delivery
        if reviewed_path is not None and reviewed_path[0] == visible_task[0]:
            try:
                reviewed_path[1].unlink(missing_ok=True)
            except OSError:
                pass
            reviewed_path = None
        status.configure(text="Sending to JARVIS…")
        return "break"

    entry.bind("<Return>", send)
    tk.Button(composer, text="Send", relief="flat", bg="#374151", fg="white", command=send).pack(side="left")

    def review():
        nonlocal reviewed_path
        if visible_task is None:
            status.configure(text="Waiting for the task's instructions to sync.")
            return
        if text.get():
            status.configure(text="Save the current draft before loading the earlier one.")
            return
        item = instruction_to_review(home, visible_task[0])
        if item is None:
            status.configure(text="No earlier draft for this task.")
            return
        path, draft = item
        reviewed_path = (visible_task[0], path)
        text.set(draft["text"])
        target.set("Everyone" if draft["lane"] is None else AGENTS[draft["lane"]][0])
        status.configure(text="Review the draft. Send it again when ready.")
        entry.focus_set()

    tk.Button(composer, text="Review draft", relief="flat", bg="#374151", fg="white",
              command=review).pack(side="left", padx=4)

    def point():
        """Point & Ask: the person drags a rectangle; only that region is captured, once."""
        from PIL import ImageGrab

        source = draft_task or visible_task
        if source is None or visible_task is None or source[0] != visible_task[0]:
            status.configure(text="Open a task before pointing at something.")
            return
        shade = tk.Toplevel(root)
        shade.attributes("-fullscreen", True)
        shade.attributes("-topmost", True)
        shade.attributes("-alpha", 0.25)
        canvas = tk.Canvas(shade, cursor="cross", bg="black", highlightthickness=0)
        canvas.pack(fill="both", expand=True)
        start = {}

        def press(event):
            start.update(x=event.x_root, y=event.y_root)
            start["box"] = canvas.create_rectangle(event.x, event.y, event.x, event.y, outline="white", width=2)

        def drag(event):
            if "box" in start:
                canvas.coords(start["box"], start["x"] - shade.winfo_rootx(), start["y"] - shade.winfo_rooty(),
                              event.x, event.y)

        def release(event):
            box = (min(start.get("x", 0), event.x_root), min(start.get("y", 0), event.y_root),
                   max(start.get("x", 0), event.x_root), max(start.get("y", 0), event.y_root))
            shade.destroy()
            if box[2] - box[0] < 8 or box[3] - box[1] < 8:
                status.configure(text="Nothing selected.")
                return
            root.after(150, lambda: finish(box))  # the shade is gone from the screen first

        def finish(box):
            if visible_task is None or source[0] != visible_task[0]:
                status.configure(text="The task changed. Select the region again for the new task.")
                return
            try:
                path = save_pointed(home, ImageGrab.grab(bbox=box, all_screens=True))
                queue_instruction(home, point_instruction(path, text.get()), None, *source)
                text.set("")
                status.configure(text="Sending the selected region to JARVIS…")
            except Exception:  # noqa: BLE001 - shown, never silently retried
                status.configure(text="That part of the screen could not be captured.")

        canvas.bind("<ButtonPress-1>", press)
        canvas.bind("<B1-Motion>", drag)
        canvas.bind("<ButtonRelease-1>", release)
        shade.bind("<Escape>", lambda _e: shade.destroy())

    tk.Button(composer, text="Point", relief="flat", bg="#374151", fg="white", command=point).pack(side="left", padx=4)

    markers: list = []
    drawn_marks: list[dict] = []
    missing_since = [None]

    def attached_place(state: dict) -> tuple[bool, tuple[int, int, int, int] | None]:
        """Returns whether the bar is visible, and the verified foreground bounds for markers."""
        root.update_idletasks()
        width = root.winfo_reqwidth()
        window = state.get("window") or {}
        if sys.platform == "win32" and window:
            try:
                import win32gui  # type: ignore[import-not-found]

                from .windows_worker import _window_handle

                hwnd = _window_handle(window)
                foreground = win32gui.GetAncestor(win32gui.GetForegroundWindow(), 2)
                own = win32gui.GetAncestor(root.winfo_id(), 2)
                if foreground in (hwnd, own):
                    bounds = win32gui.GetWindowRect(hwnd)
                    left, top_edge, right, _ = bounds
                    root.geometry(f"+{max(left, left + (right - left - width) // 2)}+{top_edge + 8}")
                    return True, bounds if foreground == hwnd else None
            except Exception:
                pass
        if sys.platform == "darwin" and window:
            place = mac_place(window, width)
            if place is not None:
                root.geometry(f"+{place[0]}+{place[1]}")
                return True, None
        if window and not pinned.get():
            return False, None
        root.geometry(f"+{root.winfo_screenwidth() - width - 24}+24")
        return True, None

    def draw_marks(marks: list[dict]) -> None:
        nonlocal drawn_marks
        if marks == drawn_marks:
            return
        drawn_marks = marks
        for marker in markers:
            marker.destroy()
        markers.clear()
        for mark in marks:
            name, colour, shape = AGENTS[mark["lane"] % LANES]
            marker = tk.Toplevel(root)
            marker.withdraw()
            marker.overrideredirect(True)
            marker.attributes("-topmost", True)
            tk.Label(marker, text=f"{shape} {name}", bg=colour, fg="white", font=("Segoe UI", 8)).pack()
            marker.geometry(f"+{mark['x'] + 6}+{mark['y'] + 6}")
            marker.update_idletasks()
            try:  # click-through: the marker never takes the person's clicks or focus
                import win32con  # type: ignore[import-not-found]
                import win32gui  # type: ignore[import-not-found]

                handle = win32gui.GetAncestor(marker.winfo_id(), 2)
                style = win32gui.GetWindowLong(handle, win32con.GWL_EXSTYLE)
                win32gui.SetWindowLong(handle, win32con.GWL_EXSTYLE,
                                       style | win32con.WS_EX_TRANSPARENT | win32con.WS_EX_LAYERED
                                       | win32con.WS_EX_NOACTIVATE)
            except Exception:
                marker.destroy()
                continue
            marker.deiconify()
            markers.append(marker)

    def tick():
        nonlocal visible_task
        try:
            state = json.loads((home / "bar.json").read_text(encoding="utf-8"))
            missing_since[0] = None
        except (OSError, ValueError):
            state = {}
            missing_since[0] = missing_since[0] or time.monotonic()
            if time.monotonic() - missing_since[0] > 60:
                root.destroy()
                return
        task = state.get("task") or {}
        visible_task = None
        bounds = None
        if not task:
            root.withdraw()
        else:
            agents = state.get("agents") or []
            dots.configure(text=" ".join(AGENTS[a["lane"] % LANES][2] for a in agents) or "○")
            mode = {"background": "Background", "rehearsal": "Rehearsal"}.get(
                task.get("mode"), "Live")
            line.configure(text=f"{mode} · {summary(state)}"[:64])
            rows.configure(text="\n".join(
                f"{AGENTS[a['lane'] % LANES][2]} {AGENTS[a['lane'] % LANES][0]}: {a['doing']} "
                f"({int(time.time() - a['since'])} s)" for a in agents) or "No agent is running a step right now.")
            if expanded.get():
                details.pack(fill="x", before=composer)
            else:
                details.pack_forget()
            sent = (state.get("instructions") or [])[-1:]
            if sent:
                word = {"accepted": "Received by JARVIS", "rejected": "Not delivered to the original task",
                        "conflict": "Task changed; use Review draft",
                        "failed": "Not delivered yet; retrying"}.get(sent[0]["state"], "Sending…")
                status.configure(text=f"{word}: {sent[0]['text'][:50]}")
            show, bounds = attached_place(state)
            if show:
                if task.get("id") and "instructionRevision" in task:
                    visible_task = (task["id"], task["instructionRevision"])
                root.deiconify()
            else:
                root.withdraw()
        draw_marks(visible_marks(state, bounds, time.time()))
        root.after(250, tick)

    root.after(0, tick)
    root.mainloop()
    return 0


class BarWindow:
    """The bar as its own process (Tk wants its own main thread), with no keys or authority."""

    def __init__(self, home: Path):
        self.home, self.process = home, None

    def start(self) -> bool:
        import subprocess
        import sys

        from mcp.client.stdio import get_default_environment

        command = [sys.executable] if getattr(sys, "frozen", False) else [sys.executable, "-m", "ocade_agent"]
        command.append("bar")
        environment = {**get_default_environment(), "OCADE_AGENT_HOME": str(self.home),
                       "PYINSTALLER_RESET_ENVIRONMENT": "1"}
        try:
            self.process = subprocess.Popen(command, stdin=subprocess.DEVNULL,
                                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=environment)
        except OSError:
            return False
        return self.process.poll() is None

    def close(self) -> None:
        import subprocess

        (self.home / "bar.json").unlink(missing_ok=True)
        if self.process is not None and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
