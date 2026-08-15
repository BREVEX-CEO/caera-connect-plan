"""Map gesture events to OS input only after explicit local arming."""

from __future__ import annotations

from dataclasses import dataclass

from .gesture_processor import GestureEvent


@dataclass(frozen=True)
class ScreenMapper:
    width: int
    height: int
    margin: float = 0.08
    # Camera frames are mirrored before landmark detection, so mapping those
    # landmarks directly feels like a mirror. Set this only for an unflipped
    # input source.
    mirror_x: bool = False

    def map(self, x: float, y: float) -> tuple[int, int]:
        if not 0 <= self.margin < 0.5:
            raise ValueError("Screen margin must be in [0, 0.5).")
        span = 1.0 - self.margin * 2.0
        nx = min(1.0, max(0.0, (x - self.margin) / span))
        ny = min(1.0, max(0.0, (y - self.margin) / span))
        if self.mirror_x:
            nx = 1.0 - nx
        return round(nx * (self.width - 1)), round(ny * (self.height - 1))


class GesturePcController:
    """Bounded pynput controller; construction does not arm it."""

    def __init__(self, *, enabled: bool = False, mapper: ScreenMapper | None = None) -> None:
        import pyautogui
        from pynput.mouse import Button, Controller

        pyautogui.FAILSAFE = True
        size = pyautogui.size()
        self.mapper = mapper or ScreenMapper(size.width, size.height)
        self.enabled = enabled
        self._mouse = Controller()
        self._left = Button.left
        self._down = False

    def execute(self, events: list[GestureEvent]) -> None:
        if not self.enabled:
            return
        for event in events:
            if event.kind == "move" and event.x is not None and event.y is not None:
                self._mouse.position = self.mapper.map(event.x, event.y)
            elif event.kind == "click":
                self._mouse.click(self._left, 1)
            elif event.kind == "button_down" and not self._down:
                self._mouse.press(self._left)
                self._down = True
            elif event.kind == "button_up" and self._down:
                self._mouse.release(self._left)
                self._down = False
            elif event.kind == "scroll" and event.amount is not None:
                amount = int(round(max(-8.0, min(8.0, event.amount))))
                if amount:
                    self._mouse.scroll(0, amount)

    def release(self) -> None:
        if self._down:
            self._mouse.release(self._left)
            self._down = False

    def __enter__(self) -> "GesturePcController":
        return self

    def __exit__(self, *_args: object) -> None:
        self.release()
