"""
Signed updates for the OCADE Device Agent, with automatic rollback.

A release is installed only when all of these hold:

1. the manifest is signed by OCADE's release key (Ed25519, pinned below);
2. the downloaded archive matches the manifest's SHA-256;
3. the new build starts and answers `--health` within 30 seconds.

Versions live side by side under `versions/`; `current.json` names the one to
run, the one before it, and the one the installer placed. A build that fails
its health check is removed before anything switches. A build that was
switched to but then fails to start twice is switched back by
`launch_target()` on the next start.

The installed build is never deleted: the login entry and the uninstaller both
point at its program, so removing its folder (as "keep only the newest two"
did after a second update) left a computer whose agent never started again
and whose uninstall cleaned nothing. It is the permanent launcher.

Until the owner sets `UPDATE_PUBLIC_KEY`, updates are refused: an agent that
cannot verify a release does not install one.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import platform
import shutil
import subprocess
import time
import urllib.request
import zipfile
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

# OCADE's release verification key (raw Ed25519, base64). The private half is
# the release owner's file (packaging/release.py says where); it is never in
# the repository. Replacing this value strands every installed agent on its
# current version, so it changes only with a new installer.
UPDATE_PUBLIC_KEY: str | None = "dirhc1T54k1q9CWiOQKDSuuArV0FYJzCcf6TTHi0Qho="
HEALTH_TIMEOUT_S = 30
MAX_FAILED_STARTS = 2
CHECK_EVERY_S = 6 * 3600
RETRY_AFTER_S = 3600           # a check that failed (no network, server down) is tried again sooner
IDLE_BEFORE_RESTART_S = 120    # a staged build starts once nothing has been running this long


class UpdateRefused(Exception):
    pass


def platform_key() -> str:
    system = {"Windows": "windows", "Darwin": "macos", "Linux": "linux"}.get(platform.system(), "other")
    machine = platform.machine().lower()
    return f"{system}-{'arm64' if machine in ('arm64', 'aarch64') else 'x64'}"


def verify_manifest(manifest: bytes, signature_b64: str, public_key_b64: str | None) -> dict:
    if not public_key_b64:
        raise UpdateRefused("No release key is configured, so no update can be verified")
    try:
        Ed25519PublicKey.from_public_bytes(base64.b64decode(public_key_b64)).verify(
            base64.b64decode(signature_b64), manifest)
    except (InvalidSignature, ValueError) as e:
        raise UpdateRefused("The update manifest is not signed by OCADE") from e
    return json.loads(manifest)


def _version(text: str) -> tuple[int, ...]:
    """'1.10.0' sorts after '1.9.0'. Anything that is not dotted numbers is refused."""
    try:
        return tuple(int(part) for part in str(text).split("."))
    except ValueError as e:
        raise UpdateRefused("Invalid version") from e


def _layout(root: Path) -> dict:
    try:
        return json.loads((root / "current.json").read_text())
    except (OSError, ValueError):
        return {}


def _write_layout(root: Path, layout: dict) -> None:
    tmp = root / "current.json.tmp"
    tmp.write_text(json.dumps(layout))
    os.replace(tmp, root / "current.json")


def _executable(folder: Path) -> Path:
    name = "ocade-agent.exe" if platform.system() == "Windows" else "ocade-agent"
    return folder / name


def _health(exe: Path) -> bool:
    """The staged build answers `--health` (it loads everything it runs) in time."""
    try:
        return subprocess.run([str(exe), "--health"], timeout=HEALTH_TIMEOUT_S,
                              capture_output=True).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def adopt(root: Path, running: str) -> None:
    """
    The build the installer just placed becomes current when nothing is recorded
    yet, the record is unreadable, or it is newer than what was current (a person
    ran a newer installer over an older, already-updated install). It is also
    remembered as the installed build, which is never removed.
    """
    layout = _layout(root)
    current = layout.get("current")
    try:
        newer = current is None or _version(running) > _version(current)
    except UpdateRefused:
        newer = True  # an unreadable record: the build that is actually here wins
    if newer:
        _write_layout(root, {"current": running, "previous": current, "failedStarts": 0,
                             "installed": running})
    elif not layout.get("installed"):
        _write_layout(root, {**layout, "installed": running})


def install(root: Path, manifest: dict, archive: bytes) -> str:
    """Stage, verify, health-check, then switch. Returns the version now current."""
    release = manifest.get("platforms", {}).get(platform_key())
    if not release:
        raise UpdateRefused(f"No build for {platform_key()} in this release")
    if hashlib.sha256(archive).hexdigest() != release["sha256"]:
        raise UpdateRefused("The download does not match the signed release")
    version = str(manifest["version"])
    _version(version)
    staged = root / "versions" / version
    shutil.rmtree(staged, ignore_errors=True)
    staged.mkdir(parents=True)
    # Anything wrong with the archive (malformed, missing the program, not
    # runnable) is an unhealthy build: it is removed and nothing switches.
    try:
        with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
            for member in bundle.namelist():  # never write outside the staged folder
                if Path(member).is_absolute() or ".." in Path(member).parts:
                    raise UpdateRefused("The release archive is malformed")
            bundle.extractall(staged)
        exe = _executable(staged)
        if not exe.is_file():
            raise UpdateRefused(f"Version {version} does not contain the agent program")
        exe.chmod(0o755)
        healthy = _health(exe)
    except (UpdateRefused, zipfile.BadZipFile, OSError) as e:
        shutil.rmtree(staged, ignore_errors=True)
        raise e if isinstance(e, UpdateRefused) else UpdateRefused(
            f"Version {version} could not be prepared ({type(e).__name__})") from e
    layout = _layout(root)
    if not healthy:
        shutil.rmtree(staged, ignore_errors=True)
        raise UpdateRefused(f"Version {version} failed its health check; staying on {layout.get('current')}")
    previous = layout.get("current")
    installed = layout.get("installed")
    _write_layout(root, {"current": version, "previous": previous, "failedStarts": 0,
                         "installed": installed})
    # Keep the current build, the one to roll back to, and the installed one
    # (the login entry and the uninstaller run its program).
    for old in (root / "versions").iterdir():
        if old.name not in (version, previous, installed):
            shutil.rmtree(old, ignore_errors=True)
    return version


def launch_target(root: Path) -> Path | None:
    """The build to start now. Rolls back after repeated failed starts of a new build."""
    layout = _layout(root)
    if not layout.get("current"):
        return None
    if layout.get("failedStarts", 0) >= MAX_FAILED_STARTS and layout.get("previous"):
        layout = {"current": layout["previous"], "previous": None, "failedStarts": 0,
                  "rolledBackFrom": layout["current"], "installed": layout.get("installed")}
    layout["failedStarts"] = layout.get("failedStarts", 0) + 1
    _write_layout(root, layout)
    return _executable(root / "versions" / layout["current"])


def rollback(root: Path) -> str | None:
    """
    Give up on the current build now: its program is missing or cannot be run at
    all, which no second attempt will change. Back to the build before it, or to
    the installed one. Returns the build that is current afterwards.
    """
    layout = _layout(root)
    bad = layout.get("current")
    back = next((v for v in (layout.get("previous"), layout.get("installed"))
                 if v and v != bad and _executable(root / "versions" / v).is_file()), None)
    if back is None:
        return bad
    _write_layout(root, {"current": back, "previous": None, "failedStarts": 0,
                         "rolledBackFrom": bad, "installed": layout.get("installed")})
    return back


def mark_healthy(root: Path) -> None:
    """Called by a running agent once it has reached OCADE: this build works."""
    layout = _layout(root)
    if layout.get("current"):
        layout["failedStarts"] = 0
        _write_layout(root, layout)


def _get(url: str, timeout: int) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "OCADE-Device-Agent"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def check(server: str, root: Path, current_version: str) -> str | None:
    """Fetch, verify and install a newer release. Returns the new version, or None."""
    base = server.rstrip("/") + "/agent"
    manifest = _get(f"{base}/manifest.json", 30)
    signature = _get(f"{base}/manifest.json.sig", 30).decode().strip()
    parsed = verify_manifest(manifest, signature, UPDATE_PUBLIC_KEY)
    # Never backwards and never sideways: an older signed manifest replayed by
    # whoever controls the network is a downgrade to a build with known flaws.
    if _version(parsed.get("version", "")) <= _version(current_version):
        return None
    # A build this agent already tried and rolled back from is not tried again
    # until a newer one exists: otherwise every check reinstalls the same failure.
    # Nor one that is already the current build: a release whose label and
    # contents disagree would otherwise be reinstalled over itself on every check.
    layout = _layout(root)
    if str(parsed["version"]) in (layout.get("rolledBackFrom"), layout.get("current")):
        return None
    release = parsed.get("platforms", {}).get(platform_key())
    url = str((release or {}).get("url", ""))
    # Over TLS, or from this computer itself (a developer's own server): never plain HTTP across a network.
    if not (url.startswith("https://") or url.startswith("http://127.0.0.1:")):
        raise UpdateRefused(f"No build for {platform_key()} in this release")
    archive = _get(release["url"], 300)
    return install(root, parsed, archive)


class Schedule:
    """
    When to look for a release and when to start one, from what the agent is doing.

    Looked for at start and every six hours, and at once when OCADE says this
    build is too old, but never while a task is running. A staged build starts
    only after the agent has been idle for two minutes: an update must not take
    the computer away from work in progress, and STOP must stay with the build
    that is running that work.
    """

    def __init__(self, look, now=None):
        self._look = look          # () -> version staged, or None; may raise
        self._now = now or time.monotonic
        self._next = 0.0
        self._idle_since: float | None = None
        self.staged: str | None = None
        self.last_error: str | None = None

    def tick(self, busy: bool, asked: bool = False) -> bool:
        """One look at the clock. True when the agent should restart into the staged build."""
        now = self._now()
        if self.staged is None and not busy and (asked or now >= self._next):
            try:
                self.staged = self._look()
                self.last_error = None
                self._next = now + CHECK_EVERY_S
            except Exception as e:  # unverifiable, unreachable or unhealthy: not installed
                self.last_error = f"{type(e).__name__}: {e}"
                self._next = now + RETRY_AFTER_S
        if self.staged is None:
            return False
        self._idle_since = None if busy else (self._idle_since if self._idle_since is not None else now)
        return self._idle_since is not None and now - self._idle_since >= IDLE_BEFORE_RESTART_S
