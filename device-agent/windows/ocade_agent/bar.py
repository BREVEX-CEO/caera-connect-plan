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
import time
import uuid
from pathlib import Path

LANES = 4
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
    "ui.wait": "Waiting for an app", "ui.scroll": "Scrolling in an app", "ui.invoke": "Pressing a control",
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
    if isinstance(window, dict) and isinstance(window.get("hwnd"), int):
        return {"hwnd": window["hwnd"], "exe": str(window.get("exe", ""))[:80]}
    return None


class BarState:
    """What the bar shows, kept by the agent loop from the steps it really runs."""

    def __init__(self, home: Path):
        self.path = home / "bar.json"
        self.task: dict = {}
        self.lanes: dict[int, dict] = {}
        self.marks: list[dict] = []
        self.sent: list[dict] = []
        self.window: dict | None = None

    def task_seen(self, task: dict | None) -> None:
        task = task or {}
        if (task.get("id"), task.get("status")) != (self.task.get("id"), self.task.get("status")):
            self.task = {"id": task.get("id"), "status": task.get("status")}
            if task.get("id") is None:
                self.lanes.clear()
            self.flush()

    def started(self, lane: int, intent: dict) -> None:
        self.lanes[lane] = {"doing": describe(intent), "since": time.time()}
        self.window = window_of(intent) or self.window
        self.flush()

    def finished(self, lane: int, intent: dict, result: dict) -> None:
        self.lanes.pop(lane, None)
        clicked = (result.get("evidence") or {}).get("clicked")
        if intent.get("operation") == "ui.click_point" and isinstance(clicked, list) and len(clicked) == 2:
            self.marks = [m for m in self.marks if time.time() - m["at"] < 3][-7:]
            self.marks.append({"lane": lane, "x": int(clicked[0]), "y": int(clicked[1]), "at": time.time()})
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


def queue_instruction(home: Path, text: str, lane: int | None) -> Path:
    """What the person typed in the bar, for the agent loop to deliver (the bar has no key)."""
    text = text.strip()[:2000]
    if not text:
        raise ValueError("empty instruction")
    if lane is not None and lane not in range(LANES):
        raise ValueError("no such agent")
    path = home / "instructions" / f"{time.time_ns()}.json"
    write_json(path, {"text": text, "lane": lane, "clientId": str(uuid.uuid4())})
    return path


def pending_instructions(home: Path) -> list[tuple[Path, dict]]:
    """Queued instructions, oldest first; an unreadable file is dropped, never sent."""
    found = []
    for path in sorted((home / "instructions").glob("*.json"))[:10]:
        try:
            item = json.loads(path.read_text(encoding="utf-8"))
            text, lane, client = item["text"], item.get("lane"), str(uuid.UUID(item["clientId"]))
            if not isinstance(text, str) or not text.strip() or (lane is not None and lane not in range(LANES)):
                raise ValueError
            found.append((path, {"text": text.strip()[:2000], "lane": lane, "clientId": client}))
        except (OSError, ValueError, KeyError, TypeError):
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
    entry = tk.Entry(composer, width=36)
    entry.pack(side="left", fill="x", expand=True)
    who = tk.OptionMenu(composer, target, "Everyone", *[name for name, _, _ in AGENTS])
    who.configure(bg="#1f2937", fg="white", relief="flat", highlightthickness=0)
    who.pack(side="left", padx=4)
    status = tk.Label(root, text="", bg="#111827", fg="#9ca3af", font=("Segoe UI", 8), anchor="w")
    status.pack(fill="x", padx=8, side="bottom")

    def send(_event=None):
        name = target.get()
        lane = next((i for i, (n, _, _) in enumerate(AGENTS) if n == name), None)
        try:
            queue_instruction(home, entry.get(), lane)
        except (ValueError, OSError):
            return "break"
        entry.delete(0, "end")  # the draft goes only once it is queued for delivery
        status.configure(text="Sending to JARVIS…")
        return "break"

    entry.bind("<Return>", send)
    tk.Button(composer, text="Send", relief="flat", bg="#374151", fg="white", command=send).pack(side="left")

    markers: list = []
    missing_since = [None]

    def attached_place(state: dict) -> bool:
        """Over the target window when Windows can tell where it is; otherwise top-right."""
        root.update_idletasks()
        width = root.winfo_reqwidth()
        window = state.get("window") or {}
        if sys.platform == "win32" and window.get("hwnd"):
            try:
                import win32gui  # type: ignore[import-not-found]

                hwnd = window["hwnd"]
                if not win32gui.IsWindow(hwnd):
                    raise OSError
                foreground = win32gui.GetAncestor(win32gui.GetForegroundWindow(), 2)
                own = root.winfo_id()
                if not pinned.get() and foreground not in (hwnd, win32gui.GetAncestor(own, 2)):
                    return False  # another app is in front: the unpinned bar hides
                left, top_edge, right, _ = win32gui.GetWindowRect(hwnd)
                root.geometry(f"+{max(left, left + (right - left - width) // 2)}+{top_edge + 8}")
                return True
            except Exception:
                pass
        root.geometry(f"+{root.winfo_screenwidth() - width - 24}+24")
        return True

    def draw_marks(state: dict) -> None:
        for marker in markers:
            marker.destroy()
        markers.clear()
        for mark in state.get("marks") or []:
            if time.time() - mark["at"] > 2.5:
                continue
            name, colour, shape = AGENTS[mark["lane"] % LANES]
            marker = tk.Toplevel(root)
            marker.overrideredirect(True)
            marker.attributes("-topmost", True)
            tk.Label(marker, text=f"{shape} {name}", bg=colour, fg="white", font=("Segoe UI", 8)).pack()
            marker.geometry(f"+{mark['x'] + 6}+{mark['y'] + 6}")
            if sys.platform == "win32":
                try:  # click-through: the marker never takes the person's clicks
                    import win32con  # type: ignore[import-not-found]
                    import win32gui  # type: ignore[import-not-found]

                    handle = win32gui.GetParent(marker.winfo_id()) or marker.winfo_id()
                    style = win32gui.GetWindowLong(handle, win32con.GWL_EXSTYLE)
                    win32gui.SetWindowLong(handle, win32con.GWL_EXSTYLE,
                                           style | win32con.WS_EX_TRANSPARENT | win32con.WS_EX_LAYERED)
                except Exception:
                    pass
            markers.append(marker)

    def tick():
        try:
            state = json.loads((home / "bar.json").read_text(encoding="utf-8"))
            missing_since[0] = None
        except (OSError, ValueError):
            state = {}
            missing_since[0] = missing_since[0] or time.monotonic()
            if time.monotonic() - missing_since[0] > 60:
                root.destroy()
                return
        if not state.get("task"):
            root.withdraw()
        else:
            agents = state.get("agents") or []
            dots.configure(text=" ".join(AGENTS[a["lane"] % LANES][2] for a in agents) or "○")
            line.configure(text=summary(state)[:60])
            rows.configure(text="\n".join(
                f"{AGENTS[a['lane'] % LANES][2]} {AGENTS[a['lane'] % LANES][0]}: {a['doing']} "
                f"({int(time.time() - a['since'])} s)" for a in agents) or "No agent is running a step right now.")
            if expanded.get():
                details.pack(fill="x", before=composer)
            else:
                details.pack_forget()
            sent = (state.get("instructions") or [])[-1:]
            if sent:
                word = {"accepted": "Received by JARVIS", "rejected": "Not delivered: the task finished",
                        "failed": "Not delivered yet; retrying"}.get(sent[0]["state"], "Sending…")
                status.configure(text=f"{word}: {sent[0]['text'][:50]}")
            if attached_place(state):
                root.deiconify()
            else:
                root.withdraw()
            draw_marks(state)
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

        executable = [sys.executable] if getattr(sys, "frozen", False) else [sys.executable, "-m", "ocade_agent"]
        environment = {**get_default_environment(), "OCADE_AGENT_HOME": str(self.home),
                       "PYINSTALLER_RESET_ENVIRONMENT": "1"}
        try:
            self.process = subprocess.Popen(executable + ["bar"], stdin=subprocess.DEVNULL,
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
