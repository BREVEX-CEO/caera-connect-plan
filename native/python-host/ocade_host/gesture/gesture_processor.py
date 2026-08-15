"""Turn 21 MediaPipe hand landmarks into a bounded gesture event stream."""

from __future__ import annotations

import math
from dataclasses import dataclass

from .kinematic_filter import PointOneEuroFilter

WRIST = 0
THUMB_TIP = 4
INDEX_MCP = 5
INDEX_PIP = 6
INDEX_TIP = 8
MIDDLE_MCP = 9
MIDDLE_PIP = 10
MIDDLE_TIP = 12
RING_PIP = 14
RING_TIP = 16
PINKY_MCP = 17
PINKY_PIP = 18
PINKY_TIP = 20


@dataclass(frozen=True)
class Landmark:
    x: float
    y: float
    z: float = 0.0


@dataclass(frozen=True)
class GestureEvent:
    kind: str
    x: float | None = None
    y: float | None = None
    amount: float | None = None


def _distance(a: Landmark, b: Landmark) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def _hand_scale(points: list[Landmark]) -> float:
    # Combining palm height and width keeps pinch thresholds stable when the
    # user moves toward the camera or rotates the hand slightly.
    height = _distance(points[WRIST], points[MIDDLE_MCP])
    width = _distance(points[INDEX_MCP], points[PINKY_MCP])
    return max((height + width) / 2.0, 1e-4)


def _extended(points: list[Landmark], tip: int, pip: int) -> bool:
    # MediaPipe image coordinates grow downwards. This deliberately remains a
    # simple pose hint; pinch hysteresis is the authority for button state.
    return points[tip].y < points[pip].y


class HandGestureProcessor:
    """Stateful gesture recognizer with hysteresis and fail-safe releases.

    Short thumb/index pinches produce a click on release. Holding the pinch
    starts a drag, and losing the hand always releases that drag. Two-finger
    vertical motion becomes scroll only when ring and little fingers are folded.
    """

    def __init__(
        self,
        *,
        pinch_on: float = 0.24,
        pinch_off: float = 0.36,
        pinch_min_seconds: float = 0.055,
        drag_hold_seconds: float = 0.45,
        click_cooldown_seconds: float = 0.16,
        scroll_gain: float = 25.0,
        scroll_deadzone: float = 0.025,
        filter_: PointOneEuroFilter | None = None,
    ) -> None:
        if not 0 < pinch_on < pinch_off:
            raise ValueError("Pinch hysteresis must satisfy 0 < on < off.")
        self.pinch_on = pinch_on
        self.pinch_off = pinch_off
        self.pinch_min_seconds = pinch_min_seconds
        self.drag_hold_seconds = drag_hold_seconds
        self.click_cooldown_seconds = click_cooldown_seconds
        self.scroll_gain = scroll_gain
        self.scroll_deadzone = scroll_deadzone
        self.filter = filter_ or PointOneEuroFilter()
        self._pinching = False
        self._pinch_started: float | None = None
        self._middle_pinching = False
        self._middle_pinch_started: float | None = None
        self._dragging = False
        self._last_click = -math.inf
        self._scroll_y: float | None = None
        self._last_timestamp: float | None = None

    @property
    def dragging(self) -> bool:
        return self._dragging

    def process(self, landmarks: list[Landmark], timestamp: float) -> list[GestureEvent]:
        if len(landmarks) != 21:
            return self.lost_hand()
        if self._last_timestamp is not None and timestamp <= self._last_timestamp:
            raise ValueError("Gesture frame timestamps must increase.")
        self._last_timestamp = timestamp

        cursor_x, cursor_y = self.filter.apply(
            landmarks[INDEX_TIP].x,
            landmarks[INDEX_TIP].y,
            timestamp,
        )
        events: list[GestureEvent] = []

        scale = _hand_scale(landmarks)
        pinch_ratio = _distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]) / scale
        pinch = pinch_ratio < (self.pinch_off if self._pinching else self.pinch_on)
        middle_ratio = _distance(landmarks[THUMB_TIP], landmarks[MIDDLE_TIP]) / scale
        middle_pinch = (
            not pinch
            and middle_ratio
            < (self.pinch_off if self._middle_pinching else self.pinch_on)
        )

        if pinch and not self._pinching:
            self._pinching = True
            self._pinch_started = timestamp
        elif pinch and self._pinching and not self._dragging:
            started = self._pinch_started if self._pinch_started is not None else timestamp
            held = timestamp - started
            if held >= self.drag_hold_seconds:
                self._dragging = True
                events.append(GestureEvent("button_down"))
        elif not pinch and self._pinching:
            started = self._pinch_started if self._pinch_started is not None else timestamp
            held = timestamp - started
            if self._dragging:
                events.append(GestureEvent("button_up"))
            elif (
                held >= self.pinch_min_seconds
                and timestamp - self._last_click >= self.click_cooldown_seconds
            ):
                events.append(GestureEvent("click"))
                self._last_click = timestamp
            self._pinching = False
            self._pinch_started = None
            self._dragging = False

        # Thumb-to-middle is deliberately separate from the ordinary index
        # pinch. It gives File Explorer and other desktop applications a real
        # double-click without trying to infer timing from two single clicks.
        if middle_pinch and not self._middle_pinching:
            self._middle_pinching = True
            self._middle_pinch_started = timestamp
        elif not middle_pinch and self._middle_pinching:
            started = (
                self._middle_pinch_started
                if self._middle_pinch_started is not None
                else timestamp
            )
            held = timestamp - started
            if (
                held >= self.pinch_min_seconds
                and timestamp - self._last_click >= self.click_cooldown_seconds
            ):
                events.append(GestureEvent("double_click"))
                self._last_click = timestamp
            self._middle_pinching = False
            self._middle_pinch_started = None

        scroll_pose = (
            not pinch
            and not middle_pinch
            and _extended(landmarks, INDEX_TIP, INDEX_PIP)
            and _extended(landmarks, MIDDLE_TIP, MIDDLE_PIP)
            and not _extended(landmarks, RING_TIP, RING_PIP)
            and not _extended(landmarks, PINKY_TIP, PINKY_PIP)
        )
        scroll_y = (landmarks[INDEX_TIP].y + landmarks[MIDDLE_TIP].y) / 2.0
        if scroll_pose:
            if self._scroll_y is not None:
                delta = self._scroll_y - scroll_y
                if abs(delta) >= self.scroll_deadzone:
                    events.append(GestureEvent("scroll", amount=delta * self.scroll_gain))
            self._scroll_y = scroll_y
        else:
            self._scroll_y = None
            # Suppress pointer movement while the dedicated scroll pose is
            # active. Pinch/drag is not a scroll pose, so dragging still tracks.
            events.insert(0, GestureEvent("move", cursor_x, cursor_y))

        return events

    def lost_hand(self) -> list[GestureEvent]:
        events = [GestureEvent("button_up")] if self._dragging else []
        self._pinching = False
        self._pinch_started = None
        self._middle_pinching = False
        self._middle_pinch_started = None
        self._dragging = False
        self._scroll_y = None
        self._last_timestamp = None
        self.filter.reset()
        return events
