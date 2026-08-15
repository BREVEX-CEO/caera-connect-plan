"""Run OCADE's local hand tracker in preview or explicitly armed mode."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

from .camera_stream import CameraConfig, CameraStream, probe_camera
from .download_model import default_model_path
from .gesture_pc_control import GesturePcController
from .gesture_processor import HandGestureProcessor, Landmark
from . import visualizer


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=default_model_path())
    parser.add_argument("--camera-index", type=int, default=0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--probe-camera", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument(
        "--enable-control",
        action="store_true",
        help="Explicitly arm OS cursor/click output. Without this flag the tool is preview-only.",
    )
    parser.add_argument("--no-preview", action="store_true")
    return parser


def _landmarks(result) -> list[Landmark]:
    if not result.hand_landmarks:
        return []
    return [Landmark(float(point.x), float(point.y), float(point.z))
            for point in result.hand_landmarks[0]]


def run(args: argparse.Namespace) -> None:
    import cv2
    import mediapipe as mp

    if not args.model.is_file():
        raise SystemExit(
            "Hand Landmarker model is missing. Run: "
            "python -m ocade_host.gesture.download_model"
        )

    options = mp.tasks.vision.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(args.model.resolve())),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.65,
        min_hand_presence_confidence=0.65,
        min_tracking_confidence=0.65,
    )
    config = CameraConfig(args.camera_index, args.width, args.height, args.fps)
    processor = HandGestureProcessor()
    last_frame_at = time.perf_counter()
    fps = 0.0
    started = time.perf_counter()

    with (
        mp.tasks.vision.HandLandmarker.create_from_options(options) as landmarker,
        CameraStream(config) as camera,
        GesturePcController(enabled=args.enable_control) as controller,
    ):
        try:
            while True:
                frame = cv2.flip(camera.read(), 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                timestamp = time.perf_counter()
                timestamp_ms = int((timestamp - started) * 1000)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                points = _landmarks(landmarker.detect_for_video(image, timestamp_ms))
                events = processor.process(points, timestamp) if points else processor.lost_hand()
                controller.execute(events)

                delta = max(timestamp - last_frame_at, 1e-6)
                fps = fps * 0.9 + (1.0 / delta) * 0.1
                last_frame_at = timestamp
                if not args.no_preview:
                    visualizer.draw(frame, points, events, armed=args.enable_control, fps=fps)
                    if not visualizer.show(frame):
                        break
        finally:
            controller.release()
            processor.lost_hand()
            visualizer.close()


def main() -> None:
    args = _parser().parse_args()
    config = CameraConfig(args.camera_index, args.width, args.height, args.fps)
    if args.self_test:
        import cv2
        import mediapipe

        model = args.model.resolve()
        digest = hashlib.sha256(model.read_bytes()).hexdigest() if model.is_file() else None
        print(json.dumps({
            "protocolVersion": 1,
            "python": sys.version.split()[0],
            "mediapipe": mediapipe.__version__,
            "opencv": cv2.__version__,
            "modelBundled": model.is_file(),
            "modelSha256": digest,
        }))
        return
    if args.probe_camera:
        print(json.dumps(probe_camera(config)))
        return
    if args.no_preview and args.enable_control:
        raise SystemExit(
            "Refusing armed gesture control without the visible preview and its Escape/Q stop path."
        )
    run(args)


if __name__ == "__main__":
    main()
