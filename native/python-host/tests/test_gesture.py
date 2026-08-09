from __future__ import annotations

from ocade_native.gesture import GestureConfig, GestureController, Point

DEFAULT_INDEX = Point(0.5, 0.3, 0.0)
DEFAULT_THUMB = Point(0.35, 0.5, 0.0)
DEFAULT_MIDDLE = Point(0.55, 0.55, 0.0)
DEFAULT_RING = Point(0.6, 0.55, 0.0)
DEFAULT_PINKY = Point(0.65, 0.55, 0.0)


def hand(
    *,
    index: Point = DEFAULT_INDEX,
    thumb: Point = DEFAULT_THUMB,
    middle: Point = DEFAULT_MIDDLE,
    ring: Point = DEFAULT_RING,
    pinky: Point = DEFAULT_PINKY,
) -> list[Point]:
    points = [Point(0.5, 0.7, 0.0) for _ in range(21)]
    points[4] = thumb
    points[6] = Point(index.x, 0.5, index.z)
    points[8] = index
    points[10] = Point(middle.x, 0.5, middle.z)
    points[12] = middle
    points[14] = Point(ring.x, 0.5, ring.z)
    points[16] = ring
    points[18] = Point(pinky.x, 0.5, pinky.z)
    points[20] = pinky
    return points


def event_types(events: list[dict[str, object]]) -> list[object]:
    return [event["type"] for event in events]


def test_low_confidence_freezes_and_releases_drag() -> None:
    controller = GestureController()
    controller.dragging = True
    assert event_types(controller.feed([], 0.1, 100)) == ["drag_end", "freeze"]
    assert not controller.dragging


def test_short_pinch_click_and_held_pinch_drag() -> None:
    controller = GestureController(GestureConfig(click_cooldown_ms=0, drag_dwell_ms=200))
    pinched = hand(thumb=Point(0.49, 0.3, 0.0))
    controller.feed([pinched], 0.9, 0)
    released = controller.feed([hand()], 0.9, 100)
    assert "click" in event_types(released)
    controller.feed([pinched], 0.9, 500)
    held = controller.feed([pinched], 0.9, 750)
    assert "drag_start" in event_types(held)
    assert "drag_end" in event_types(controller.feed([hand()], 0.9, 800))


def test_open_palm_pauses_and_two_fists_emergency_stop() -> None:
    controller = GestureController()
    open_hand = hand(
        middle=Point(0.55, 0.3, 0.0),
        ring=Point(0.6, 0.3, 0.0),
        pinky=Point(0.65, 0.3, 0.0),
    )
    assert event_types(controller.feed([open_hand], 0.9, 0)) == ["pause"]
    fist = hand(index=Point(0.5, 0.7, 0.0))
    assert event_types(controller.feed([fist, fist], 0.9, 100)) == ["emergency_stop"]


def test_two_hand_distance_emits_zoom() -> None:
    controller = GestureController()
    first = hand()
    second = hand()
    first[9] = Point(0.4, 0.5, 0.0)
    second[9] = Point(0.6, 0.5, 0.0)
    controller.feed([first, second], 0.9, 0)
    second[9] = Point(0.72, 0.5, 0.0)
    assert "zoom" in event_types(controller.feed([first, second], 0.9, 50))
