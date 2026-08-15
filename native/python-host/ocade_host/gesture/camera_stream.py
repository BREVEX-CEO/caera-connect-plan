"""Small, bounded OpenCV camera wrapper used only by gesture mode."""

from __future__ import annotations

import sys
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CameraConfig:
    index: int = 0
    width: int = 640
    height: int = 480
    fps: int = 30


def _open(config: CameraConfig):
    import cv2

    backend = cv2.CAP_DSHOW if sys.platform == "win32" else cv2.CAP_ANY
    camera = cv2.VideoCapture(config.index, backend)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, config.width)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, config.height)
    camera.set(cv2.CAP_PROP_FPS, config.fps)
    camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return camera


class CameraStream:
    def __init__(self, config: CameraConfig) -> None:
        self.config = config
        self._camera: Any | None = None

    def __enter__(self) -> "CameraStream":
        self._camera = _open(self.config)
        if not self._camera.isOpened():
            self._camera.release()
            self._camera = None
            raise RuntimeError(f"Camera {self.config.index} could not be opened.")
        return self

    def read(self):
        if self._camera is None:
            raise RuntimeError("Camera stream is not open.")
        ok, frame = self._camera.read()
        if not ok or frame is None:
            raise RuntimeError("Camera opened but did not return a frame.")
        return frame

    def __exit__(self, *_args: object) -> None:
        if self._camera is not None:
            self._camera.release()
            self._camera = None


def probe_camera(config: CameraConfig) -> dict[str, int | bool]:
    """Read one frame, retain nothing, and close the device immediately."""
    with CameraStream(config) as stream:
        frame = stream.read()
        height, width = frame.shape[:2]
    return {"available": True, "index": config.index, "width": width, "height": height}
