from __future__ import annotations

from ocade_host.gesture.gesture_pc_control import ScreenMapper
from ocade_host.gesture.gesture_processor import HandGestureProcessor, Landmark
from ocade_host.gesture.kinematic_filter import OneEuroFilter, PointOneEuroFilter


def hand(*, pinch: bool = False, scroll_y: float | None = None) -> list[Landmark]:
    points = [Landmark(0.5, 0.7) for _ in range(21)]
    points[0] = Landmark(0.5, 0.82)
    points[5] = Landmark(0.42, 0.60)
    points[9] = Landmark(0.5, 0.56)
    points[17] = Landmark(0.60, 0.62)
    points[6] = Landmark(0.44, 0.45)
    points[8] = Landmark(0.44, scroll_y if scroll_y is not None else 0.30)
    points[10] = Landmark(0.50, 0.47)
    points[12] = Landmark(0.50, scroll_y if scroll_y is not None else 0.31)
    points[14] = Landmark(0.55, 0.50)
    points[16] = Landmark(0.55, 0.66)
    points[18] = Landmark(0.60, 0.52)
    points[20] = Landmark(0.60, 0.68)
    points[4] = Landmark(0.445 if pinch else 0.25, points[8].y)
    return points


def kinds(events):
    return [event.kind for event in events]


def test_one_euro_filter_reduces_stationary_jitter() -> None:
    filter_ = OneEuroFilter(min_cutoff=0.7, beta=0.01)
    raw = [0.5, 0.515, 0.488, 0.512, 0.493, 0.507]
    filtered = [filter_(value, index / 30) for index, value in enumerate(raw)]
    assert max(filtered[1:]) - min(filtered[1:]) < max(raw) - min(raw)


def test_one_euro_filter_rejects_non_monotonic_time() -> None:
    filter_ = OneEuroFilter()
    filter_(0.2, 1.0)
    try:
        filter_(0.3, 1.0)
    except ValueError as error:
        assert "increase" in str(error)
    else:
        raise AssertionError("A repeated timestamp must be rejected.")


def test_short_pinch_clicks_once_on_release() -> None:
    processor = HandGestureProcessor(filter_=PointOneEuroFilter())
    assert "click" not in kinds(processor.process(hand(pinch=True), 1.0))
    assert "click" not in kinds(processor.process(hand(pinch=True), 1.10))
    released = processor.process(hand(pinch=False), 1.16)
    assert kinds(released).count("click") == 1
    assert "button_down" not in kinds(released)


def test_long_pinch_drags_and_hand_loss_releases() -> None:
    processor = HandGestureProcessor(drag_hold_seconds=0.3)
    processor.process(hand(pinch=True), 2.0)
    events = processor.process(hand(pinch=True), 2.31)
    assert "button_down" in kinds(events)
    assert processor.dragging is True
    assert kinds(processor.lost_hand()) == ["button_up"]
    assert processor.dragging is False


def test_two_finger_motion_scrolls_only_after_baseline() -> None:
    processor = HandGestureProcessor(scroll_deadzone=0.01)
    first = processor.process(hand(scroll_y=0.42), 3.0)
    second = processor.process(hand(scroll_y=0.34), 3.04)
    assert "scroll" not in kinds(first)
    scroll = [event for event in second if event.kind == "scroll"]
    assert len(scroll) == 1
    assert scroll[0].amount is not None and scroll[0].amount > 0
    assert "move" not in kinds(second)


def test_screen_mapping_clamps_and_mirrors() -> None:
    mapper = ScreenMapper(1920, 1080, margin=0.1, mirror_x=True)
    assert mapper.map(0.1, 0.1) == (1919, 0)
    assert mapper.map(0.9, 0.9) == (0, 1079)
    assert mapper.map(-10, 99) == (1919, 1079)
