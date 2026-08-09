from __future__ import annotations

import hashlib
import os
import tempfile
import urllib.request
from pathlib import Path

HAND_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)
EXPECTED_SHA256 = "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1"


def main() -> int:
    model_root = Path(os.environ["LOCALAPPDATA"]) / "OCADE" / "models"
    model_root.mkdir(parents=True, exist_ok=True)
    target = model_root / "hand_landmarker.task"
    if target.is_file() and EXPECTED_SHA256:
        current = hashlib.sha256(target.read_bytes()).hexdigest()
        if current == EXPECTED_SHA256:
            print(f"HandLandmarker model already verified: {target} ({current})")
            return 0
    with tempfile.NamedTemporaryFile(
        dir=model_root, suffix=".download", delete=False
    ) as temporary:
        download = Path(temporary.name)
    try:
        urllib.request.urlretrieve(HAND_URL, download)
        digest = hashlib.sha256(download.read_bytes()).hexdigest()
        if not EXPECTED_SHA256:
            print(
                f"Refusing first install until this observed SHA-256 is reviewed: {digest}"
            )
            return 2
        if digest != EXPECTED_SHA256:
            raise RuntimeError(f"HandLandmarker model digest mismatch: {digest}")
        download.replace(target)
        print(f"Installed verified HandLandmarker model: {target} ({digest})")
        return 0
    finally:
        download.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
