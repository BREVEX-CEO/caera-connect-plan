"""Download and verify Google's official Hand Landmarker task bundle."""

from __future__ import annotations

import argparse
import hashlib
import os
import urllib.request
from pathlib import Path

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/latest/hand_landmarker.task"
)
MODEL_SHA256 = "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1"


def default_model_path() -> Path:
    return Path(__file__).resolve().parents[2] / "models" / "hand_landmarker.task"


def download(target: Path) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    digest = hashlib.sha256()
    try:
        with urllib.request.urlopen(MODEL_URL, timeout=60) as response, partial.open("wb") as sink:
            while chunk := response.read(1024 * 1024):
                sink.write(chunk)
                digest.update(chunk)
        if digest.hexdigest() != MODEL_SHA256:
            raise RuntimeError("Downloaded Hand Landmarker model failed SHA-256 verification.")
        os.replace(partial, target)
        return target
    finally:
        if partial.exists():
            partial.unlink()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=default_model_path())
    args = parser.parse_args()
    print(download(args.output))


if __name__ == "__main__":
    main()
