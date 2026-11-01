"""Compare full and visible-browser-only payloads installed by the same pinned SDK.

The only permitted removal is Chromium's unused headless shell. Every remaining
runtime file must be byte-identical. SDK cache registration links are excluded
because they record the installer's location and are not browser executables.
"""
import argparse
import hashlib
import json
from pathlib import Path


def inventory(root: Path) -> dict[str, tuple[int, str]]:
    if not root.is_dir():
        raise RuntimeError("browser payload directory is missing")
    result = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file() or ".links" in path.relative_to(root).parts:
            continue
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        result[path.relative_to(root).as_posix()] = (path.stat().st_size, digest)
    return result


def main(before: Path, after: Path) -> None:
    baseline, lean = inventory(before), inventory(after)
    removed = baseline.keys() - lean.keys()
    if not removed or any(not name.startswith("chromium_headless_shell-") for name in removed):
        raise RuntimeError("payload removal was not limited to the unused headless shell")
    if any(baseline.get(name) != value for name, value in lean.items()):
        raise RuntimeError("a required browser runtime file changed or was added")
    before_bytes = sum(size for size, _ in baseline.values())
    after_bytes = sum(size for size, _ in lean.values())
    if after_bytes >= before_bytes:
        raise RuntimeError("browser payload did not shrink")
    print("OCADE_BROWSER_PAYLOAD:" + json.dumps({
        "beforeFiles": len(baseline), "afterFiles": len(lean),
        "beforeBytes": before_bytes, "afterBytes": after_bytes,
        "removedBytes": before_bytes - after_bytes,
        "removedFiles": len(removed), "retainedFilesByteIdentical": True,
    }), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    args = parser.parse_args()
    main(args.before, args.after)
