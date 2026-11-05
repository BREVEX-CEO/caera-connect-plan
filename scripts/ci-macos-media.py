"""Pinned Intel macOS media tools for disposable CI; never part of the product."""
import hashlib
import os
import platform
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path

TOOLS = {
    "ffmpeg": "4acc0be580f9b2788029eb7bd4d645ff87968911b0a62aeeb3940d42d54558d5",
    "ffprobe": "24a9c968cd4da72d99c7245e914b921815835eb6dff01d99868031aebaf1d439",
}
VERSION = "9.0.2"
MAX_ARCHIVE_BYTES = 30_000_000


def main():
    if platform.system() != "Darwin" or platform.machine() != "x86_64":
        raise SystemExit("REFUSED: this test-only bootstrap requires an Intel macOS runner")
    destination = Path(os.environ["RUNNER_TEMP"]) / "ocade-ci-media"
    destination.mkdir(mode=0o700, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="ocade-media-", dir=destination.parent) as temporary:
        for name, digest in TOOLS.items():
            archive = Path(temporary) / f"{name}.zip"
            url = f"https://evermeet.cx/ffmpeg/{name}-{VERSION}.zip"
            request = urllib.request.Request(url, headers={"User-Agent": "OCADE-CI"})
            with urllib.request.urlopen(request, timeout=60) as response, archive.open("wb") as output:
                remaining = MAX_ARCHIVE_BYTES + 1
                while remaining:
                    chunk = response.read(min(1_048_576, remaining))
                    if not chunk:
                        break
                    output.write(chunk)
                    remaining -= len(chunk)
            if archive.stat().st_size > MAX_ARCHIVE_BYTES:
                raise RuntimeError(f"{name}: archive exceeds the test-runner budget")
            if hashlib.sha256(archive.read_bytes()).hexdigest() != digest:
                raise RuntimeError(f"{name}: publisher archive hash mismatch")
            # Read only the expected member. Never extract archive-controlled paths.
            binary = Path(temporary) / name
            with zipfile.ZipFile(archive) as package:
                entry = package.getinfo(name)
                if entry.is_dir() or entry.file_size > 150_000_000:
                    raise RuntimeError(f"{name}: unexpected executable member")
                with package.open(entry) as source, binary.open("wb") as output:
                    shutil.copyfileobj(source, output)
            binary.chmod(0o700)
            architecture = subprocess.check_output(["lipo", "-archs", str(binary)], text=True).strip()
            if architecture != "x86_64":
                raise RuntimeError(f"{name}: unexpected architecture {architecture}")
            subprocess.run([str(binary), "-version"], check=True, timeout=15)
            os.replace(binary, destination / name)
            print(f"OCADE_CI_MEDIA {name} {VERSION} sha256={digest} architecture={architecture}")
    with open(os.environ["GITHUB_PATH"], "a", encoding="utf-8") as environment:
        environment.write(str(destination) + "\n")


if __name__ == "__main__":
    main()
