"""
The optional round OCADE mini-control on the desktop.

It appears while JARVIS is working on this computer (or always, when pinned
from its menu), can be dragged anywhere and settles against the nearer screen
edge, and offers only what matters in the moment: what JARVIS is doing and how
far along, STOP, and Open OCADE. It is not a second app and never a second tray
icon.
"""
from __future__ import annotations

import json
import platform
import tkinter as tk
from pathlib import Path

SIZE = 140
EDGE = 12
TRANSPARENT = "#010203"
FONT = "Segoe UI" if platform.system() == "Windows" else "Helvetica"
# The OCADE tokens, as plain colours: surface, line, text, muted, info, destructive.
SURFACE, LINE, TEXT, MUTED = "#111111", "#2a2a2a", "#f2f2f2", "#8a8a8a"
INFO, DESTRUCTIVE, DESTRUCTIVE_HOVER = "#5b9cff", "#e5484d", "#f06a6e"


def _settings_path(home: Path) -> Path:
    return home / "mini.json"


class _CanvasButton:
    """A drawn control with the one method callers and tests need: invoke()."""

    def __init__(self, canvas: tk.Canvas, items: list[int], command, hover=None):
        self.command = command
        for item in items:
            canvas.tag_bind(item, "<ButtonRelease-1>", lambda _e: self.invoke())
            canvas.tag_bind(item, "<Enter>", lambda _e: (canvas.configure(cursor="hand2"),
                                                          hover and hover(True)))
            canvas.tag_bind(item, "<Leave>", lambda _e: (canvas.configure(cursor=""),
                                                          hover and hover(False)))

    def invoke(self) -> None:
        self.command()


def _pill(canvas: tk.Canvas, x0, y0, x1, y1, **style) -> int:
    r = (y1 - y0) / 2
    points = [x0 + r, y0, x1 - r, y0, x1, y0, x1, y0 + r, x1, y1 - r, x1, y1,
              x1 - r, y1, x0 + r, y1, x0, y1, x0, y1 - r, x0, y0 + r, x0, y0]
    return canvas.create_polygon(points, smooth=True, **style)


class Mini:
    def __init__(self, presence, home: Path):
        self.presence = presence
        self.home = home
        self.pinned = self._load().get("pinned", False)
        root = self.root = tk.Tk()
        root.title("OCADE JARVIS")
        root.overrideredirect(True)
        root.attributes("-topmost", True)
        root.geometry(f"{SIZE}x{SIZE}+40+40")
        root.configure(bg=TRANSPARENT)
        system = platform.system()
        if system == "Windows":
            root.attributes("-transparentcolor", TRANSPARENT)  # round: the corners disappear
        elif system == "Darwin":
            root.attributes("-transparent", True)
        c = self.canvas = tk.Canvas(root, width=SIZE, height=SIZE, bg=TRANSPARENT,
                                    highlightthickness=0)
        c.pack()
        mid = SIZE / 2
        c.create_oval(4, 4, SIZE - 4, SIZE - 4, fill=SURFACE, outline=LINE, width=1)
        # Progress: a quiet track, the steps done in the info colour, and a
        # turning arc while JARVIS works without a known number of steps.
        c.create_oval(9, 9, SIZE - 9, SIZE - 9, outline="#1d1d1d", width=3)
        self.progress = c.create_arc(9, 9, SIZE - 9, SIZE - 9, start=90, extent=0,
                                     style="arc", outline=INFO, width=3)
        self.spinner = c.create_arc(9, 9, SIZE - 9, SIZE - 9, start=90, extent=0,
                                    style="arc", outline=INFO, width=3)
        # The orb's glass core in miniature.
        for radius, colour in ((9, "#3a3a3a"), (6, "#8c8c8c"), (3, "#f2f2f2")):
            c.create_oval(mid - radius, 30 - radius, mid + radius, 30 + radius,
                          fill=colour, outline="")
        self.label = c.create_text(mid, 56, text="Ready", fill=TEXT, font=(FONT, 9),
                                   width=SIZE - 40, justify="center")
        self.step = c.create_text(mid, 76, text="", fill=MUTED, font=(FONT, 8))
        stop_shape = _pill(c, mid - 30, 86, mid + 30, 108, fill=DESTRUCTIVE, outline="")
        stop_text = c.create_text(mid, 97, text="STOP", fill="#ffffff", font=(FONT, 9, "bold"))
        self.stop = _CanvasButton(
            c, [stop_shape, stop_text], presence.stop_jarvis,
            lambda on: c.itemconfigure(stop_shape, fill=DESTRUCTIVE_HOVER if on else DESTRUCTIVE))
        open_text = c.create_text(mid, 119, text="Open OCADE", fill=MUTED, font=(FONT, 8))
        self.open = _CanvasButton(
            c, [open_text], presence.open_ocade,
            lambda on: c.itemconfigure(open_text, fill=TEXT if on else MUTED))
        menu = tk.Menu(root, tearoff=0)
        menu.add_command(label="Pin / unpin", command=self.toggle_pin)
        menu.add_command(label="Exit", command=presence.exit)
        c.bind("<Button-3>", lambda e: menu.tk_popup(e.x_root, e.y_root))
        c.bind("<ButtonPress-1>", self._grab)
        c.bind("<B1-Motion>", self._drag)
        c.bind("<ButtonRelease-1>", self._settle, add="+")
        self._offset = (0, 0)
        self._angle = 90
        self.tick()
        self._spin()

    def _load(self) -> dict:
        try:
            return json.loads(_settings_path(self.home).read_text())
        except (OSError, ValueError):
            return {}

    def toggle_pin(self) -> None:
        self.pinned = not self.pinned
        self.home.mkdir(parents=True, exist_ok=True)
        _settings_path(self.home).write_text(json.dumps({"pinned": self.pinned}))

    def _grab(self, event) -> None:
        self._offset = (event.x, event.y)
        self._dragged = False

    def _drag(self, event) -> None:
        self._dragged = True
        self.root.geometry(f"+{event.x_root - self._offset[0]}+{event.y_root - self._offset[1]}")

    def _settle(self, _event=None) -> None:
        """After a drag, glide to the nearer screen edge, as the phone bubble does."""
        if not getattr(self, "_dragged", False):
            return
        self._dragged = False
        x, y = self.root.winfo_x(), self.root.winfo_y()
        screen = self.root.winfo_screenwidth()
        target = EDGE if x + SIZE / 2 < screen / 2 else screen - SIZE - EDGE
        y = max(EDGE, min(y, self.root.winfo_screenheight() - SIZE - 48))
        steps = 8

        def move(i: int = 1) -> None:
            t = 1 - (1 - i / steps) ** 3  # ease-out
            self.root.geometry(f"+{round(x + (target - x) * t)}+{y}")
            if i < steps:
                self.root.after(16, move, i + 1)

        if abs(target - x) > 1:
            move()

    def status_text(self) -> str:
        task = self.presence.agent.state.get("task")
        if not task:
            return "Ready"
        return f"{task['title'][:40]}\nStep {min(task['step'] + 1, max(task['steps'], 1))} of {max(task['steps'], 1)}"

    def tick(self) -> None:
        if self.presence.agent.stop.is_set():
            self.root.destroy()
            return
        task = self.presence.agent.state.get("task")
        if task:
            steps = max(task["steps"], 1)
            done = min(task["step"], steps)
            self.canvas.itemconfigure(self.label, text=task["title"][:40])
            self.canvas.itemconfigure(self.step, text=f"Step {min(done + 1, steps)} of {steps}")
            self.canvas.itemconfigure(self.progress, extent=-360 * done / steps)
        else:
            self.canvas.itemconfigure(self.label, text="Ready")
            self.canvas.itemconfigure(self.step, text="")
            self.canvas.itemconfigure(self.progress, extent=0)
        visible = self.pinned or self.presence.agent.state.get("busy")
        (self.root.deiconify if visible else self.root.withdraw)()
        self.root.after(500, self.tick)

    def _spin(self) -> None:
        """A short turning arc while busy; still when idle (no work, no motion)."""
        if self.presence.agent.stop.is_set():
            return
        busy = self.presence.agent.state.get("busy")
        self._angle = (self._angle - 12) % 360 if busy else 90
        self.canvas.itemconfigure(self.spinner, start=self._angle, extent=60 if busy else 0)
        self.root.after(40, self._spin)


def run(presence) -> None:
    import ocade_device
    Mini(presence, ocade_device.HOME).root.mainloop()
