"""
The optional round OCADE mini-control on the desktop.

It appears while JARVIS is working on this computer (or always, when pinned
from its menu), can be dragged anywhere, and offers only what matters in the
moment: what JARVIS is doing, STOP, and Open OCADE. It is not a second app and
never a second tray icon.
"""
from __future__ import annotations

import json
import platform
import tkinter as tk
from pathlib import Path

SIZE = 132
TRANSPARENT = "#010203"


def _settings_path(home: Path) -> Path:
    return home / "mini.json"


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
        canvas = self.canvas = tk.Canvas(root, width=SIZE, height=SIZE, bg=TRANSPARENT,
                                         highlightthickness=0)
        canvas.pack()
        canvas.create_oval(2, 2, SIZE - 2, SIZE - 2, fill="#141418", outline="#e6e6ea", width=2)
        self.label = canvas.create_text(SIZE / 2, 42, text="OCADE", fill="#f2f2f5",
                                        font=("Helvetica", 10), width=SIZE - 30, justify="center")
        self.stop = tk.Button(root, text="STOP", command=presence.stop_jarvis, relief="flat",
                              bg="#f2f2f5", fg="#141418")
        self.open = tk.Button(root, text="Open OCADE", command=presence.open_ocade, relief="flat",
                              bg="#141418", fg="#f2f2f5")
        canvas.create_window(SIZE / 2, 78, window=self.stop)
        canvas.create_window(SIZE / 2, 104, window=self.open)
        menu = tk.Menu(root, tearoff=0)
        menu.add_command(label="Pin / unpin", command=self.toggle_pin)
        menu.add_command(label="Exit", command=presence.exit)
        canvas.bind("<Button-3>", lambda e: menu.tk_popup(e.x_root, e.y_root))
        canvas.bind("<ButtonPress-1>", self._grab)
        canvas.bind("<B1-Motion>", self._drag)
        self._offset = (0, 0)
        self.tick()

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

    def _drag(self, event) -> None:
        self.root.geometry(f"+{event.x_root - self._offset[0]}+{event.y_root - self._offset[1]}")

    def status_text(self) -> str:
        task = self.presence.agent.state.get("task")
        if not task:
            return "Ready"
        return f"{task['title'][:40]}\nStep {min(task['step'] + 1, max(task['steps'], 1))} of {max(task['steps'], 1)}"

    def tick(self) -> None:
        if self.presence.agent.stop.is_set():
            self.root.destroy()
            return
        self.canvas.itemconfigure(self.label, text=self.status_text())
        visible = self.pinned or self.presence.agent.state.get("busy")
        (self.root.deiconify if visible else self.root.withdraw)()
        self.root.after(500, self.tick)


def run(presence) -> None:
    import ocade_device
    Mini(presence, ocade_device.HOME).root.mainloop()
