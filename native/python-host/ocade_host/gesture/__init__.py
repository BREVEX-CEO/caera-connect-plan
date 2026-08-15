"""Opt-in, local-only hand gesture control for OCADE.

Importing this package never opens a camera or moves the pointer. Camera access
and OS input are created only by the explicit ``python -m ocade_host.gesture``
entry point.
"""

from .gesture_processor import GestureEvent, HandGestureProcessor, Landmark
from .kinematic_filter import OneEuroFilter, PointOneEuroFilter

__all__ = [
    "GestureEvent",
    "HandGestureProcessor",
    "Landmark",
    "OneEuroFilter",
    "PointOneEuroFilter",
]
