"""The workspace boundary (plan.md §25.4 fs_sandbox, P08).

The person picks one workspace folder on the computer itself; the server can
never widen it. Every path an action names is relative to that folder and is
resolved here, once, before any file is opened:

- absolute paths, drive letters, UNC and device paths, `..`, alternate data
  streams, reserved Windows names and control characters are refused;
- the resolved real path (after symlinks and junctions) must stay inside the
  real workspace;
- writes go only under `OCADE output/`, never replace an existing file, and land
  atomically (temporary file, then rename in the same folder), so an original is
  never touched and a crash never leaves a half-written deliverable.
"""

from __future__ import annotations

import hashlib
import os
import re
import tempfile
from pathlib import Path

OUTPUT_DIR = "OCADE output"
_RESERVED = re.compile(r"^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$", re.IGNORECASE)


class Refused(Exception):
    """An action asked for something outside the workspace's rules."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def resolve(workspace: str | os.PathLike, relative: str) -> Path:
    if not isinstance(relative, str) or not relative or len(relative) > 260:
        raise Refused("invalid_path")
    if any(ord(ch) < 32 for ch in relative) or relative.startswith(("/", "\\")) or ":" in relative:
        raise Refused("path_outside_workspace")
    parts = [p for p in re.split(r"[\\/]+", relative) if p not in ("", ".")]
    if any(p == ".." or _RESERVED.match(p) or p.endswith((" ", ".")) for p in parts):
        raise Refused("path_outside_workspace")
    root = Path(os.path.realpath(workspace))
    target = Path(os.path.realpath(root.joinpath(*parts)))
    if os.path.commonpath([root, target]) != str(root):
        raise Refused("path_outside_workspace")
    return target


def output_path(workspace: str | os.PathLike, relative: str) -> Path:
    """A new deliverable's path: under `OCADE output/`, and not already there."""
    target = resolve(workspace, relative)
    output_root = Path(os.path.realpath(Path(workspace) / OUTPUT_DIR))
    if os.path.commonpath([output_root, target]) != str(output_root) or target == output_root:
        raise Refused("write_outside_output")
    if target.exists():
        raise Refused("output_exists")
    return target


def write_atomically(target: Path, produce) -> str:
    """Call `produce(temporary_path)`, then move the finished file into place. Returns its SHA-256."""
    target.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=target.parent, prefix=".ocade-", suffix=target.suffix)
    os.close(handle)
    try:
        produce(Path(temporary))
        if target.exists():
            raise Refused("output_exists")
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)
    return sha256(target)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for block in iter(lambda: stream.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()
