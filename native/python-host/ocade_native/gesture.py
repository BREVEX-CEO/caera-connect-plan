from __future__ import annotations

import math
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, NamedTuple

import cv2
import mediapipe as mp
import pyautogui
from pynput import keyboard

from .windows_adapter import virtual_screen


class Point(NamedTuple):
    x: float
    y: float
    z: float


@dataclass(frozen=True)
class GestureConfig:
    confidence: float = 0.65
    smoothing: float = 0.28
    dead_zone: float = 0.06
    pinch_start: float = 0.045
    pinch_end: float = 0.075
    drag_dwell_ms: int = 260
    click_cooldown_ms: int = 350
    hand_loss_ms: int = 120
    air_click_depth: float = 0.075
    swipe_distance: float = 0.22


class GestureController:
    """Pure gesture state machine. Low confidence can only freeze or release."""

    def __init__(self, config: GestureConfig | None = None) -> None:
        self.config = config or GestureConfig()
        self.paused = False
        self.frozen = False
        self.dragging = False
        self.pinch_started: int | None = None
        self.last_click = -10_000
        self.last_seen = -10_000
        self.filtered: tuple[float, float] | None = None
        self.history: deque[tuple[int, Point, Point]] = deque(maxlen=20)
        self.two_hand_distance: float | None = None
        self.mic_muted = False

    @staticmethod
    def _distance(a: Point, b: Point) -> float:
        return math.hypot(a.x - b.x, a.y - b.y)

    @staticmethod
    def _extended(hand: list[Point], tip: int, pip: int) -> bool:
        return hand[tip].y < hand[pip].y - 0.018

    def _fingers(self, hand: list[Point]) -> tuple[bool, bool, bool, bool]:
        return (
            self._extended(hand, 8, 6),
            self._extended(hand, 12, 10),
            self._extended(hand, 16, 14),
            self._extended(hand, 20, 18),
        )

    def _cursor(self, point: Point) -> tuple[float, float]:
        margin = self.config.dead_zone
        x = min(1.0, max(0.0, (point.x - margin) / (1 - margin * 2)))
        y = min(1.0, max(0.0, (point.y - margin) / (1 - margin * 2)))
        if self.filtered is None:
            self.filtered = (x, y)
        else:
            alpha = self.config.smoothing
            distance = math.hypot(x - self.filtered[0], y - self.filtered[1])
            accelerated = min(0.78, alpha + distance * 1.8)
            self.filtered = (
                self.filtered[0] + (x - self.filtered[0]) * accelerated,
                self.filtered[1] + (y - self.filtered[1]) * accelerated,
            )
        return self.filtered

    def feed(
        self, hands: list[list[Point]], confidence: float, timestamp_ms: int
    ) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []
        if confidence < self.config.confidence or not hands:
            if self.dragging:
                self.dragging = False
                events.append({"type": "drag_end", "reason": "hand_lost"})
            self.pinch_started = None
            self.frozen = True
            events.append({"type": "freeze", "reason": "low_confidence_or_hand_lost"})
            return events

        self.last_seen = timestamp_ms
        hand = hands[0]
        if len(hand) < 21:
            return [{"type": "freeze", "reason": "incomplete_landmarks"}]
        fingers = self._fingers(hand)
        open_palm = all(fingers)
        fist = not any(fingers)

        if len(hands) >= 2 and all(not any(self._fingers(item)) for item in hands[:2]):
            self.frozen = True
            self.dragging = False
            return [{"type": "emergency_stop", "reason": "two_closed_fists"}]
        if fist:
            if self.dragging:
                events.append({"type": "drag_end", "reason": "closed_fist"})
            self.dragging = False
            self.pinch_started = None
            self.frozen = True
            return [*events, {"type": "freeze", "reason": "closed_fist"}]
        self.frozen = False

        if open_palm:
            self.paused = True
            self.pinch_started = None
            return [{"type": "pause", "reason": "open_palm"}]
        if self.paused and fingers[0] and not fingers[1] and not fingers[2] and not fingers[3]:
            self.paused = False
            events.append({"type": "resume"})
        if self.paused:
            return events

        index = hand[8]
        thumb = hand[4]
        cursor = self._cursor(index)
        events.append({"type": "cursor", "x": cursor[0], "y": cursor[1]})
        pinch = self._distance(index, thumb)

        if pinch <= self.config.pinch_start and self.pinch_started is None:
            self.pinch_started = timestamp_ms
        if self.pinch_started is not None and pinch <= self.config.pinch_end:
            if not self.dragging and timestamp_ms - self.pinch_started >= self.config.drag_dwell_ms:
                self.dragging = True
                events.append({"type": "drag_start", "x": cursor[0], "y": cursor[1]})
            elif self.dragging:
                events.append({"type": "drag_move", "x": cursor[0], "y": cursor[1]})
        elif self.pinch_started is not None and pinch > self.config.pinch_end:
            held = timestamp_ms - self.pinch_started
            if self.dragging:
                events.append({"type": "drag_end", "reason": "pinch_release"})
                self.dragging = False
            elif (
                held < self.config.drag_dwell_ms
                and timestamp_ms - self.last_click >= self.config.click_cooldown_ms
            ):
                self.last_click = timestamp_ms
                events.append({"type": "click", "x": cursor[0], "y": cursor[1]})
            self.pinch_started = None

        if fingers[0] and fingers[1] and not fingers[2] and not fingers[3] and self.history:
            previous = self.history[-1][2]
            delta = hand[12].y - previous.y
            if abs(delta) > 0.012:
                events.append({"type": "scroll", "amount": round(-delta * 1_200)})

        if self.history:
            old_timestamp, old_index, _ = self.history[0]
            recent = timestamp_ms - old_timestamp <= 420
            if (
                recent
                and index.z < old_index.z - self.config.air_click_depth
                and timestamp_ms - self.last_click >= self.config.click_cooldown_ms
            ):
                self.last_click = timestamp_ms
                events.append({"type": "air_click", "x": cursor[0], "y": cursor[1]})
            if recent and abs(index.x - old_index.x) >= self.config.swipe_distance:
                events.append(
                    {"type": "switch", "direction": "right" if index.x > old_index.x else "left"}
                )
                self.history.clear()

        pinky_pinch = self._distance(hand[4], hand[20])
        if pinky_pinch < 0.04 and timestamp_ms - self.last_click >= self.config.click_cooldown_ms:
            self.last_click = timestamp_ms
            self.mic_muted = not self.mic_muted
            events.append({"type": "mic", "muted": self.mic_muted})

        if len(hands) >= 2:
            first, second = hands[0][9], hands[1][9]
            distance = self._distance(first, second)
            if (
                self.two_hand_distance is not None
                and abs(distance - self.two_hand_distance) > 0.025
            ):
                events.append(
                    {"type": "zoom", "delta": round(distance - self.two_hand_distance, 4)}
                )
            self.two_hand_distance = distance
        else:
            self.two_hand_distance = None

        self.history.append((timestamp_ms, index, hand[12]))
        while self.history and timestamp_ms - self.history[0][0] > 420:
            self.history.popleft()
        return events


def _apply(events: list[dict[str, Any]]) -> None:
    screen = virtual_screen()
    for event in events:
        x = screen["left"] + round(float(event.get("x", 0)) * max(0, screen["width"] - 1))
        y = screen["top"] + round(float(event.get("y", 0)) * max(0, screen["height"] - 1))
        match event["type"]:
            case "cursor" | "drag_move":
                pyautogui.moveTo(x, y, duration=0)
            case "click" | "air_click":
                pyautogui.click(x, y)
            case "drag_start":
                pyautogui.moveTo(x, y, duration=0)
                pyautogui.mouseDown()
            case "drag_end":
                pyautogui.mouseUp()
            case "scroll":
                pyautogui.scroll(int(event["amount"]))
            case "switch":
                if event["direction"] == "right":
                    pyautogui.hotkey("ctrl", "tab")
                else:
                    pyautogui.hotkey("ctrl", "shift", "tab")
            case "zoom":
                pyautogui.hotkey("ctrl", "+" if event["delta"] > 0 else "-")


def _landmarks(result: Any) -> tuple[list[list[Point]], float]:
    hands = [
        [Point(float(item.x), float(item.y), float(item.z)) for item in hand]
        for hand in result.hand_landmarks
    ]
    scores = [float(category[0].score) for category in result.handedness if category]
    return hands, min(scores, default=0.0)


def run_camera(
    model_path: Path,
    duration_s: float,
    apply_actions: bool,
    stop: threading.Event,
    emit: Callable[[dict[str, Any]], None],
) -> dict[str, Any]:
    if not model_path.is_file():
        raise FileNotFoundError(f"HandLandmarker model is missing: {model_path}")
    duration_s = max(0.5, min(duration_s, 3_600))
    base_options = mp.tasks.BaseOptions(model_asset_path=str(model_path))
    options = mp.tasks.vision.HandLandmarkerOptions(
        base_options=base_options,
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_hands=2,
        min_hand_detection_confidence=0.55,
        min_hand_presence_confidence=0.55,
        min_tracking_confidence=0.55,
    )
    controller = GestureController()
    latencies: list[float] = []
    frames = hands_seen = events_seen = 0

    def hotkey(key: keyboard.Key | keyboard.KeyCode | None) -> bool | None:
        if key == keyboard.Key.f12:
            stop.set()
            emit({"type": "emergency_stop", "reason": "f12"})
            return False
        return None

    listener = keyboard.Listener(on_press=hotkey)
    listener.start()
    camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    camera.set(cv2.CAP_PROP_FPS, 30)
    if not camera.isOpened():
        listener.stop()
        raise RuntimeError("approved webcam could not be opened")
    started = time.perf_counter()
    try:
        with mp.tasks.vision.HandLandmarker.create_from_options(options) as landmarker:
            while not stop.is_set() and time.perf_counter() - started < duration_s:
                frame_started = time.perf_counter()
                ok, frame = camera.read()
                if not ok:
                    emit({"type": "freeze", "reason": "camera_disconnected"})
                    break
                frames += 1
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                timestamp = int((time.perf_counter() - started) * 1_000)
                result = landmarker.detect_for_video(
                    mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), timestamp
                )
                hands, confidence = _landmarks(result)
                if hands:
                    hands_seen += 1
                events = controller.feed(hands, confidence, timestamp)
                if apply_actions:
                    _apply(events)
                for event in events:
                    if event["type"] not in {"cursor", "freeze"}:
                        events_seen += 1
                        emit(event)
                latencies.append((time.perf_counter() - frame_started) * 1_000)
    finally:
        if controller.dragging:
            pyautogui.mouseUp()
        camera.release()
        listener.stop()
    return {
        "frames": frames,
        "handsSeen": hands_seen,
        "gestureEvents": events_seen,
        "applyActions": apply_actions,
        "emergencyHotkey": "F12",
        "meanFrameToDecisionMs": round(sum(latencies) / len(latencies), 2) if latencies else None,
        "p95FrameToDecisionMs": round(sorted(latencies)[int(len(latencies) * 0.95) - 1], 2)
        if latencies
        else None,
    }
