"""Local OpenCV preview. Frames are displayed, never saved or transmitted."""

from __future__ import annotations

from .gesture_processor import GestureEvent, Landmark

HAND_CONNECTIONS = (
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20), (0, 17),
)


def draw(frame, landmarks: list[Landmark], events: list[GestureEvent], *, armed: bool, fps: float):
    import cv2

    height, width = frame.shape[:2]
    points = [(int(p.x * width), int(p.y * height)) for p in landmarks]
    for start, end in HAND_CONNECTIONS:
        cv2.line(frame, points[start], points[end], (105, 180, 255), 2, cv2.LINE_AA)
    selecting = any(event.kind in {"click", "double_click", "button_down"} for event in events)
    for index, point in enumerate(points):
        color = (55, 70, 255) if selecting and index == 8 else (90, 235, 150)
        cv2.circle(frame, point, 7 if index in {4, 8} else 4, color, -1, cv2.LINE_AA)
    state = "CONTROL ARMED" if armed else "PREVIEW ONLY"
    cv2.putText(frame, f"OCADE Gesture | {state} | {fps:.1f} FPS", (14, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.62, (235, 235, 235), 2, cv2.LINE_AA)
    cv2.putText(frame, "Index pinch: click/drag | Middle pinch: open | Two fingers: scroll",
                (14, height - 36), cv2.FONT_HERSHEY_SIMPLEX, 0.42,
                (210, 210, 210), 1, cv2.LINE_AA)
    cv2.putText(frame, "Esc/Q: stop immediately", (14, height - 16),
                cv2.FONT_HERSHEY_SIMPLEX, 0.52, (210, 210, 210), 1, cv2.LINE_AA)
    return frame


def show(frame) -> bool:
    """Return False when the local user requests an immediate stop."""
    import cv2

    cv2.imshow("OCADE Gesture Control", frame)
    key = cv2.waitKey(1) & 0xFF
    return key not in {27, ord("q"), ord("Q")}


def close() -> None:
    import cv2

    cv2.destroyAllWindows()
