"""The workspace boundary (plan.md §25.4 fs_sandbox, P08).

The person picks one workspace folder on the computer itself; the server can
never widen it. Every path an action names is relative to that folder and is
resolved here, once, before any file is opened:

- absolute paths, drive letters, UNC and device paths, `..`, alternate data
  streams, reserved Windows names and control characters are refused;
- the resolved real path (after symlinks and junctions) must stay inside the
  real workspace;
- writes go only under `OCADE output/`, never replace an existing file, and land
  atomically (temporary file, then no-replace publication in the same folder), so an original is
  never touched and a crash never leaves a half-written deliverable.
"""

from __future__ import annotations

import functools
import hashlib
import inspect
import os
import re
import tempfile
from contextvars import ContextVar
from pathlib import Path

OUTPUT_DIR = "OCADE output"
# Plain-text files JARVIS may CREATE. Nothing Windows runs on a double click.
TEXT_SUFFIXES = (".txt", ".csv", ".tsv", ".md", ".json", ".xml", ".html", ".yaml", ".yml", ".ini", ".log",
                 ".ps1", ".py", ".sql")
_RESERVED = re.compile(r"^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$", re.IGNORECASE)


_UMASK = os.umask(0o022)
os.umask(_UMASK)


class Refused(Exception):
    """An action asked for something outside the workspace's rules."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class _EffectScope:
    """One call's effects, also visible to its enclosing call, never its siblings."""

    __slots__ = ("parent", "changed")

    def __init__(self, parent: _EffectScope | None):
        self.parent = parent
        self.changed = False


_effect_scope: ContextVar[_EffectScope | None] = ContextVar("ocade_effect_scope", default=None)


def mark_effect() -> None:
    """Record a possible durable/opaque mutation before an uncertain operation.

    Filesystem writers call this after successful publication. An opaque browser,
    command or native operation calls it before dispatch, since failure cannot
    establish that the operation did nothing.
    """
    scope = _effect_scope.get()
    while scope is not None:
        scope.changed = True
        scope = scope.parent


def _tracked_result(result, scope: _EffectScope):
    if isinstance(result, dict) and result.get("maybeChanged") is True:
        mark_effect()  # preserve an explicit legacy admission in enclosing calls
    # An inner guarded call may have caught its own refusal. Earlier effects in
    # this enclosing call must still survive when that refusal is returned.
    if scope.changed and isinstance(result, dict) and "refused" in result:
        return {**result, "maybeChanged": True}
    return result


def guarded(fn):
    """Preserve a tool's signature and report whether a refusal followed an effect.

    Each invocation owns a scope. Child calls propagate effects to their parents;
    concurrent children keep independent refusal flags even when their tasks
    inherited the same context. Reset also runs on cancellation and unexpected
    exceptions, which continue through the normal MCP error boundary.
    """
    if inspect.iscoroutinefunction(fn):
        @functools.wraps(fn)
        async def asynchronous(*args, **kwargs):
            scope = _EffectScope(_effect_scope.get())
            token = _effect_scope.set(scope)
            try:
                try:
                    result = await fn(*args, **kwargs)
                except Refused as refusal:
                    result = {"refused": refusal.code, "maybeChanged": scope.changed}
                return _tracked_result(result, scope)
            finally:
                _effect_scope.reset(token)

        return asynchronous

    @functools.wraps(fn)
    def synchronous(*args, **kwargs):
        scope = _EffectScope(_effect_scope.get())
        token = _effect_scope.set(scope)
        try:
            try:
                result = fn(*args, **kwargs)
            except Refused as refusal:
                result = {"refused": refusal.code, "maybeChanged": scope.changed}
            return _tracked_result(result, scope)
        finally:
            _effect_scope.reset(token)

    return synchronous


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


def plain_text(path: Path, limit: int = 2_000_000) -> str | None:
    """A file's text when it is plain text (any name: scripts, configs, .env), else None."""
    with open(path, "rb") as stream:
        data = stream.read(limit)
    return None if b"\0" in data else data.decode("utf-8", errors="replace")


def write_atomically(target: Path, produce) -> str:
    """Call `produce(temporary_path)`, then move the finished file into place. Returns its SHA-256."""
    target.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=target.parent, prefix=".ocade-", suffix=target.suffix)
    os.close(handle)
    os.chmod(temporary, 0o666 & ~_UMASK)  # a deliverable gets ordinary file permissions, not mkstemp's 0600
    try:
        produce(Path(temporary))
        if target.exists():
            raise Refused("output_exists")
        try:
            if os.name == "nt":
                os.rename(temporary, target)  # Windows rename never replaces an existing destination.
            else:
                os.link(temporary, target)  # Atomic create-if-absent; the temporary link is removed below.
        except FileExistsError:
            raise Refused("output_exists") from None
        mark_effect()
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


PREVIEW_BYTES = 45_000  # one small JPEG fits a signed receipt and a planner turn


def preview_jpeg(image, limit: int = PREVIEW_BYTES) -> str:
    """A PIL image as base64 JPEG under `limit` bytes: shrink quality, then size, until it fits."""
    import base64
    import io

    image = image.convert("RGB")
    image.thumbnail((960, 960))
    while True:
        for quality in (80, 65, 50, 40):
            buffer = io.BytesIO()
            image.save(buffer, "JPEG", quality=quality)
            if buffer.tell() <= limit:
                return base64.b64encode(buffer.getvalue()).decode()
        image = image.resize((max(1, image.width * 3 // 4), max(1, image.height * 3 // 4)))
