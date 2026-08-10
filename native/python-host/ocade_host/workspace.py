"""A temporary folder OCADE may work in, and nowhere else.

WHY A WORKSPACE INSTEAD OF A FILE API
--------------------------------------
"Let OCADE work with files" and "let OCADE reach the filesystem" are different
products. The second one is a language model with a path argument, and there is
no wording of a tool description that makes that safe: the model does not have
to be malicious, only wrong about which folder it is in.

So there is one directory, OCADE owns it, and every path a caller gives is
resolved and then checked to be inside it. A path that escapes — by `..`, by an
absolute prefix, by a symlink pointing out — is refused rather than clamped,
because a caller that asked for `C:\\Windows\\System32` and silently got a temp
file has been lied to.

WHAT THIS CAN AND CANNOT DO
---------------------------
Can: create, list, read, write, rename and copy files inside the workspace, and
open one in whatever the machine's default editor is.

Cannot: delete permanently (there is no delete at all here — `discard` moves a
file to the recycle bin through Send2Trash, and the recycle bin is the undo),
touch anything outside the workspace, execute anything, or write a file whose
name suggests it is a script the shell would run.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from .protocol import Refusal, bounded_text, clamp_text, is_protected_text

# One directory per machine, stable across runs so a task can be picked up
# again. Under the system temp dir because that is the one place every platform
# agrees is disposable.
WORKSPACE = Path(tempfile.gettempdir()) / "ocade-workspace"

MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_FILES = 200

# Extensions the operating system would treat as executable. Refused on write,
# because a file OCADE created that the user later double-clicks is a path from
# "the assistant made a note" to "the assistant ran something".
_EXECUTABLE_SUFFIXES = {
    ".exe", ".bat", ".cmd", ".com", ".scr", ".ps1", ".psm1", ".vbs", ".vbe",
    ".js", ".jse", ".wsf", ".wsh", ".msi", ".reg", ".lnk", ".sh", ".command",
    ".app", ".dll", ".pyw",
}


def _workspace() -> Path:
    WORKSPACE.mkdir(parents=True, exist_ok=True)
    return WORKSPACE


def _resolve(name: Any, field: str = "name") -> Path:
    """A path inside the workspace, or a refusal. Never a clamp."""
    raw = bounded_text(name, field, 240).strip().replace("\\", "/")
    if raw.startswith("/") or (len(raw) > 1 and raw[1] == ":"):
        raise Refusal(
            "OCADE works in its own temporary folder and cannot be given an absolute path.",
            "blocked",
        )
    root = _workspace().resolve()
    candidate = (root / raw).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        # `..` segments, or a symlink that points outside. Refused by name so
        # the caller learns the rule rather than silently getting a different file.
        raise Refusal(
            "That path is outside OCADE's temporary folder, so it was refused.",
            "blocked",
        ) from None
    return candidate


def _describe(path: Path, root: Path) -> dict[str, Any]:
    stat = path.stat()
    return {
        "name": str(path.relative_to(root)).replace("\\", "/"),
        "bytes": stat.st_size,
        "modified": int(stat.st_mtime),
    }


def workspace_info(_request=None) -> dict[str, Any]:
    """Where OCADE's temporary folder is, and what is in it."""
    root = _workspace().resolve()
    files = [
        _describe(path, root) for path in sorted(root.rglob("*")) if path.is_file()
    ]
    return {
        "path": str(root),
        "files": files[:MAX_FILES],
        "count": len(files),
        "detail": (
            f"OCADE's temporary folder holds {len(files)} file"
            f"{'' if len(files) == 1 else 's'}."
        ),
    }


def list_files(request=None) -> dict[str, Any]:
    """Files in the workspace, optionally filtered by part of the name."""
    payload = getattr(request, "payload", {}) or {}
    match = str(payload.get("match") or "").strip().lower()
    root = _workspace().resolve()
    files = [
        _describe(path, root)
        for path in sorted(root.rglob("*"))
        if path.is_file() and (not match or match in path.name.lower())
    ]
    return {
        "files": files[:MAX_FILES],
        "count": len(files),
        "path": str(root),
        "detail": (
            f"{len(files)} file{'' if len(files) == 1 else 's'} match"
            f"{'es' if len(files) == 1 else ''}."
            if match
            else f"{len(files)} file{'' if len(files) == 1 else 's'} in the folder."
        ),
    }


def write_file(request) -> dict[str, Any]:
    """Create or replace a file, then read it back to prove what landed."""
    payload = getattr(request, "payload", {}) or {}
    path = _resolve(payload.get("name"))
    content = payload.get("content")
    if not isinstance(content, str):
        raise Refusal("A file needs text content.", "unsupported")
    if len(content.encode("utf-8")) > MAX_FILE_BYTES:
        raise Refusal(
            f"That file is larger than the {MAX_FILE_BYTES // 1024} KB OCADE will write.",
            "unsupported",
        )
    if path.suffix.lower() in _EXECUTABLE_SUFFIXES:
        raise Refusal(
            f"OCADE does not create {path.suffix} files — the operating system would treat "
            "that as something to run.",
            "blocked",
        )
    if is_protected_text(content):
        raise Refusal(
            "That content looks like a password, code or payment value. OCADE does not "
            "write those to a file.",
            "blocked",
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

    # Read back rather than trusting the write. A full disk, a lock, an
    # antivirus quarantine — all of them return from `write_text` without error.
    landed = path.read_text(encoding="utf-8")
    root = _workspace().resolve()
    return {
        **_describe(path, root),
        "path": str(path),
        "verified": landed == content,
        "detail": (
            f"Wrote {len(content)} characters to {path.name} and read them back."
            if landed == content
            else f"{path.name} was written but reads back differently."
        ),
    }


def read_file(request) -> dict[str, Any]:
    """Read a file from the workspace."""
    payload = getattr(request, "payload", {}) or {}
    path = _resolve(payload.get("name"))
    if not path.is_file():
        raise Refusal(f"There is no file called {path.name} in OCADE's folder.", "state_changed")
    if path.stat().st_size > MAX_FILE_BYTES:
        raise Refusal("That file is too large for OCADE to read in one go.", "unsupported")
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise Refusal(f"{path.name} is not a text file.", "unsupported") from None
    root = _workspace().resolve()
    return {
        **_describe(path, root),
        "content": clamp_text(content, 20_000),
        "truncated": len(content) > 20_000,
        "detail": f"Read {path.name}.",
    }


def copy_file(request) -> dict[str, Any]:
    """Copy inside the workspace, verified by comparing the content."""
    payload = getattr(request, "payload", {}) or {}
    source = _resolve(payload.get("from"), "from")
    target = _resolve(payload.get("to"), "to")
    if not source.is_file():
        raise Refusal(f"There is no file called {source.name} to copy.", "state_changed")
    if target.suffix.lower() in _EXECUTABLE_SUFFIXES:
        raise Refusal(f"OCADE does not create {target.suffix} files.", "blocked")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    root = _workspace().resolve()
    same = source.read_bytes() == target.read_bytes()
    return {
        **_describe(target, root),
        "verified": same,
        "detail": (
            f"Copied {source.name} to {target.name} and confirmed they match."
            if same
            else f"{target.name} was created but does not match {source.name}."
        ),
    }


def move_file(request) -> dict[str, Any]:
    """Move or rename inside the workspace."""
    payload = getattr(request, "payload", {}) or {}
    source = _resolve(payload.get("from"), "from")
    target = _resolve(payload.get("to"), "to")
    if not source.is_file():
        raise Refusal(f"There is no file called {source.name} to move.", "state_changed")
    if target.suffix.lower() in _EXECUTABLE_SUFFIXES:
        raise Refusal(f"OCADE does not create {target.suffix} files.", "blocked")
    target.parent.mkdir(parents=True, exist_ok=True)
    source.replace(target)
    root = _workspace().resolve()
    moved = target.is_file() and not source.exists()
    return {
        **_describe(target, root),
        "verified": moved,
        "detail": (
            f"Moved {source.name} to {target.name}."
            if moved
            else "The move did not complete."
        ),
    }


def discard_file(request) -> dict[str, Any]:
    """Send a workspace file to the recycle bin. There is no permanent delete."""
    payload = getattr(request, "payload", {}) or {}
    path = _resolve(payload.get("name"))
    if not path.is_file():
        raise Refusal(f"There is no file called {path.name} to discard.", "state_changed")
    try:
        from send2trash import send2trash  # noqa: PLC0415
    except ImportError:
        raise Refusal(
            "The reversible-delete component is not installed, so OCADE will not remove files.",
            "unsupported",
        ) from None
    send2trash(str(path))
    gone = not path.exists()
    return {
        "name": path.name,
        "verified": gone,
        # Said explicitly: the user's undo is the recycle bin, and they should
        # know that is where to look.
        "detail": (
            f"Moved {path.name} to the recycle bin, where it can be restored."
            if gone
            else f"{path.name} is still there."
        ),
    }


def open_file(request) -> dict[str, Any]:
    """Open a workspace file in this machine's default editor.

    The one action here that leaves the workspace, and only outward: it hands a
    path to the operating system's default handler. It cannot choose the
    application, cannot pass arguments, and cannot open anything the OS would
    execute — those extensions are refused on write, so they cannot be here.
    """
    payload = getattr(request, "payload", {}) or {}
    path = _resolve(payload.get("name"))
    if not path.is_file():
        raise Refusal(f"There is no file called {path.name} to open.", "state_changed")
    if path.suffix.lower() in _EXECUTABLE_SUFFIXES:
        raise Refusal("OCADE does not open files the operating system would run.", "blocked")

    if sys.platform == "win32":
        os.startfile(str(path))  # noqa: S606 - a document, opened by its default handler
    elif sys.platform == "darwin":
        subprocess.Popen(["/usr/bin/open", str(path)], stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL)
    else:
        subprocess.Popen(["xdg-open", str(path)], stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL)

    # Wait for a window carrying the file's name, so "opened" is an observation
    # rather than the fact that a call returned.
    hwnd = None
    title = ""
    if sys.platform == "win32":
        import win32gui  # noqa: PLC0415

        deadline = time.monotonic() + 12.0
        stem = path.stem.lower()
        while time.monotonic() < deadline and hwnd is None:
            def visit(handle: int, _param) -> bool:
                nonlocal hwnd, title
                if hwnd is not None or not win32gui.IsWindowVisible(handle):
                    return True
                text = win32gui.GetWindowText(handle)
                if stem and stem in text.lower():
                    hwnd, title = handle, clamp_text(text, 256)
                return True

            win32gui.EnumWindows(visit, None)
            if hwnd is None:
                time.sleep(0.2)

    return {
        "name": path.name,
        "path": str(path),
        "hwnd": hwnd,
        "title": title,
        "verified": hwnd is not None if sys.platform == "win32" else None,
        "detail": (
            f"Opened {path.name} in {title or 'the default editor'}."
            if hwnd is not None or sys.platform != "win32"
            else f"{path.name} was handed to the default editor, which has not shown a window yet."
        ),
    }
