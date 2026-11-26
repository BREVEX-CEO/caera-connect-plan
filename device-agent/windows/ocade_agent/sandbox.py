"""The workspace boundary (plan.md §25.4 fs_sandbox, P08).

The person picks one workspace folder on the computer itself; the server can
never widen it. Every path an action names is relative to that folder and is
resolved here, once, before any file is opened:

- absolute paths, drive letters, UNC and device paths, `..`, alternate data
  streams, reserved Windows names and control characters are refused;
- the resolved real path (after symlinks and junctions) must stay inside the
  real workspace and rehearsals must stay inside their own output folder;
- writes go only under `OCADE output/`, never replace an existing file, and land
  atomically (temporary file, then no-replace publication in the same folder), so an original is
  never touched and a crash never leaves a half-written deliverable.
"""

from __future__ import annotations

import functools
import ipaddress
import hashlib
import inspect
import os
import re
import sys
import tempfile
import time
import zipfile
from contextvars import ContextVar
from pathlib import Path

# Decoder policy only; actors and verifiers still perform their own observations.
# Exclude playlists, nested manifests and image sequences from media autodetection.
# MOV external track loading remains disabled (FFmpeg's enable_drefs default).
MEDIA_INPUT_OPTIONS = (
    "-protocol_whitelist", "file",
    "-format_whitelist", "mov,matroska,webm,avi,wav,mp3,flac,ogg,mpegts,mpeg,aac",
)
PASSIVE_IMAGE_FORMATS = ("PNG", "JPEG", "TIFF", "WEBP", "BMP", "GIF", "ICO", "PPM")

OUTPUT_DIR = "OCADE output"
# Plain-text files JARVIS may CREATE. Nothing Windows runs on a double click.
TEXT_SUFFIXES = (".txt", ".csv", ".tsv", ".md", ".json", ".xml", ".html", ".yaml", ".yml", ".ini", ".log",
                 ".ps1", ".py", ".sql")
_RESERVED = re.compile(r"^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$", re.IGNORECASE)


_UMASK = os.umask(0o022)
os.umask(_UMASK)


class Refused(Exception):
    """An action asked for something outside the workspace's rules."""

    def __init__(self, code: str, **detail):
        super().__init__(code)
        self.code = code
        # Facts that explain the refusal to the planner, e.g. the `dialogs` that hold a window.
        self.detail = detail


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
                    result = {"refused": refusal.code, "maybeChanged": scope.changed, **refusal.detail}
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
                result = {"refused": refusal.code, "maybeChanged": scope.changed, **refusal.detail}
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
    if ([part.casefold() for part in parts[:2]] == [OUTPUT_DIR.casefold(), "rehearsal"]
            and not target.is_relative_to(root / OUTPUT_DIR / "rehearsal")):
        # Use the fixed subtree, not its realpath: the rehearsal directory itself
        # may have been replaced by a link to production files inside the workspace.
        raise Refused("rehearsal_path_escape")
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


# MALWARE-01: JARVIS writes documents, pictures, media and saved web pages, never programs or
# macro-enabled Office files. A deliverable that is one (by name or by its first bytes, or an
# Office package that carries a macro project) is refused before it appears in the output folder.
ACTIVE_OUTPUT_SUFFIXES = frozenset(
    {".exe", ".dll", ".msi", ".scr", ".com", ".sys", ".docm", ".dotm", ".xlsm", ".xltm", ".xlam",
     ".pptm", ".potm", ".ppam", ".sldm"}
)
_NATIVE_MAGIC = (b"\x7fELF", b"\xcf\xfa\xed\xfe", b"\xce\xfa\xed\xfe", b"\xca\xfe\xba\xbe")


def is_active_content(path: Path, name: str | None = None) -> bool:
    """Whether a finished output is a program or carries a macro project, judged on its name and bytes."""
    if Path(name or path.name).suffix.lower() in ACTIVE_OUTPUT_SUFFIXES:
        return True
    with open(path, "rb") as stream:
        head = stream.read(4096)
    if head.startswith(_NATIVE_MAGIC):
        return True
    if head[:2] == b"MZ" and len(head) >= 0x40:  # a Windows program: MZ header pointing at a PE signature
        offset = int.from_bytes(head[0x3C:0x40], "little")
        if 0 < offset <= len(head) - 4 and head[offset : offset + 4] == b"PE\0\0":
            return True
    if head[:2] == b"PK":
        try:
            with zipfile.ZipFile(path) as package:
                return any(entry.lower().endswith("vbaproject.bin") for entry in package.namelist())
        except zipfile.BadZipFile:
            return False
    return False


def write_atomically(target: Path, produce, *, downloaded: bool = False) -> str:
    """Call `produce(temporary_path)`, then move the finished file into place. Returns its SHA-256.

    A file JARVIS generated is never a program or macro file. A `downloaded` file is the person's
    own saved download: it is kept as it came, with the internet-origin mark, and never run."""
    target.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=target.parent, prefix=".ocade-", suffix=target.suffix)
    os.close(handle)
    os.chmod(temporary, 0o666 & ~_UMASK)  # a deliverable gets ordinary file permissions, not mkstemp's 0600
    try:
        produce(Path(temporary))
        if not downloaded and is_active_content(Path(temporary), target.name):
            raise Refused("active_content_output")
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


NAT64 = ipaddress.ip_network("64:ff9b::/96")


def non_public_address(text: str) -> bool:
    """Whether an address must never be fetched without the owner's private-network flag: not
    globally routable, multicast or reserved, judged on the IPv4 address a mapped or NAT64
    address carries (64:ff9b::7f00:1 reaches 127.0.0.1 through a NAT64 gateway, yet Python
    counts it as global). 6to4 and Teredo forms are already not global."""
    try:
        address = ipaddress.ip_address(text)
    except ValueError:
        return False
    if address.version == 6 and address in NAT64:
        address = ipaddress.IPv4Address(int(address) & 0xFFFFFFFF)
    address = getattr(address, "ipv4_mapped", None) or address
    return not address.is_global or address.is_multicast or address.is_reserved


_SE_PRIVILEGE_REMOVED = 0x4


PARSER_MEMORY_LIMIT = 4 * 1024**3


def cap_memory(limit: int = PARSER_MEMORY_LIMIT) -> str:
    """MALWARE-03: a document or media file crafted to explode in memory ends its own parser
    worker with an out-of-memory error instead of exhausting the computer. Called once by each
    parser worker before it serves; the worker's children inherit the cap.

    Windows: the worker joins a job object with a per-process memory limit. Linux: RLIMIT_DATA.
    macOS does not enforce these limits, so there it returns "unsupported".
    """
    if sys.platform == "win32":
        import win32api  # type: ignore[import-not-found]
        import win32job  # type: ignore[import-not-found]

        job = win32job.CreateJobObject(None, "")
        limits = win32job.QueryInformationJobObject(job, win32job.JobObjectExtendedLimitInformation)
        limits["BasicLimitInformation"]["LimitFlags"] = win32job.JOB_OBJECT_LIMIT_PROCESS_MEMORY
        limits["ProcessMemoryLimit"] = limit
        win32job.SetInformationJobObject(job, win32job.JobObjectExtendedLimitInformation, limits)
        win32job.AssignProcessToJobObject(job, win32api.GetCurrentProcess())
        _memory_jobs.append(job)  # the job lives as long as this worker
        return "job"
    if sys.platform.startswith("linux"):
        import resource

        # RLIMIT_DATA counts memory actually written to (heap and private mappings), not address
        # space a browser engine only reserves: RLIMIT_AS made Chromium's renderer fail to start.
        _, hard = resource.getrlimit(resource.RLIMIT_DATA)
        resource.setrlimit(resource.RLIMIT_DATA, (limit if hard == resource.RLIM_INFINITY else min(limit, hard), hard))
        return "rlimit"
    return "unsupported"


_memory_jobs: list = []

PARSER_CPU_BUDGET = 300.0  # CPU-seconds a parser may burn ...
PARSER_CPU_WINDOW = 600.0  # ... within this many wall-clock seconds
PARSER_CPU_EXIT = 75


def cap_cpu(budget: float = PARSER_CPU_BUDGET, window: float = PARSER_CPU_WINDOW, poll: float = 1.0):
    """MALWARE-03: a document crafted to spin a parser (decompression or regex blow-up, an
    endless loop) ends its own worker instead of holding a core until the owner notices.

    A watchdog thread samples the worker's CPU time; once the worker has used more than `budget`
    CPU-seconds inside any `window` wall-clock seconds it exits with PARSER_CPU_EXIT. An idle
    worker uses almost none, and a legitimate render or large workbook stays well under the
    budget. Portable: unlike a per-process rlimit it also works on macOS and needs no reset
    between calls. Returns the watchdog thread.
    """
    import collections
    import threading

    def watch() -> None:
        samples = collections.deque([(time.monotonic(), time.process_time())])
        while True:
            time.sleep(poll)
            now, cpu = time.monotonic(), time.process_time()
            while len(samples) > 1 and now - samples[1][0] >= window:
                samples.popleft()
            if cpu - samples[0][1] > budget:
                sys.stderr.write(f"parser worker stopped: more than {budget:g} CPU-seconds in {window:g} s\n")
                sys.stderr.flush()
                os._exit(PARSER_CPU_EXIT)
            samples.append((now, cpu))

    thread = threading.Thread(target=watch, name="ocade-cpu-watchdog", daemon=True)
    thread.start()
    return thread


def run_restricted(module: str) -> None:
    """Windows (plan v8 11.9): this worker, and so every command, tracked job and verifier re-run
    it starts (children inherit the token), gives up every privilege except change-notify for
    good: no backup/restore bypass of file permissions, no debugging other processes, no taking
    ownership, no driver loading, no shutdown, even when the companion was started elevated.

    Removed in place with AdjustTokenPrivileges, not by starting a copy under a restricted token:
    on the hosted Windows runner such a copy cannot open its desktop (STATUS_DLL_INIT_FAILED,
    runs 44054092410 and 44054536677). Group membership is unchanged, so an elevated companion's
    commands still have its Administrators group; a person's ordinary (not elevated) session
    already holds that group deny-only. `module` names the caller, for the reason only.
    """
    if sys.platform != "win32":
        return
    import win32api  # type: ignore[import-not-found]
    import win32security  # type: ignore[import-not-found]

    # TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY
    token = win32security.OpenProcessToken(win32api.GetCurrentProcess(), 0x0020 | 0x0008)
    keep = win32security.LookupPrivilegeValue(None, "SeChangeNotifyPrivilege")
    held = win32security.GetTokenInformation(token, win32security.TokenPrivileges)
    removed = [(luid, _SE_PRIVILEGE_REMOVED) for luid, _ in held if luid != keep]
    if removed:
        win32security.AdjustTokenPrivileges(token, False, removed)
    os.environ["OCADE_RESTRICTED"] = "privileges"
