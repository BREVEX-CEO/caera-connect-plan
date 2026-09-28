"""
Signed updates for the OCADE Device Agent, with automatic rollback.

A release is installed only when all of these hold:

1. the manifest is signed by OCADE's release key (Ed25519, pinned below);
2. the downloaded archive matches the manifest's SHA-256;
3. the new build starts and answers `--health` within 30 seconds.

Versions live side by side under `versions/`; `current.json` names the one to
run and the one before it. A build that fails its health check is removed
before anything switches. A build that was switched to but then fails to
start twice is switched back by `launch_target()` on the next start.

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
import urllib.request
import zipfile
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

# OCADE's release verification key (raw Ed25519, base64). Set by the release owner.
UPDATE_PUBLIC_KEY: str | None = None
HEALTH_TIMEOUT_S = 30
MAX_FAILED_STARTS = 2


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


def install(root: Path, manifest: dict, archive: bytes) -> str:
    """Stage, verify, health-check, then switch. Returns the version now current."""
    release = manifest.get("platforms", {}).get(platform_key())
    if not release:
        raise UpdateRefused(f"No build for {platform_key()} in this release")
    if hashlib.sha256(archive).hexdigest() != release["sha256"]:
        raise UpdateRefused("The download does not match the signed release")
    version = str(manifest["version"])
    if not version.replace(".", "").isalnum():
        raise UpdateRefused("Invalid version")
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
    _write_layout(root, {"current": version, "previous": previous, "failedStarts": 0})
    for old in (root / "versions").iterdir():  # keep only the current and the one to roll back to
        if old.name not in (version, previous):
            shutil.rmtree(old, ignore_errors=True)
    return version


def launch_target(root: Path) -> Path | None:
    """The build to start now. Rolls back after repeated failed starts of a new build."""
    layout = _layout(root)
    if not layout.get("current"):
        return None
    if layout.get("failedStarts", 0) >= MAX_FAILED_STARTS and layout.get("previous"):
        layout = {"current": layout["previous"], "previous": None, "failedStarts": 0,
                  "rolledBackFrom": layout["current"]}
    layout["failedStarts"] = layout.get("failedStarts", 0) + 1
    _write_layout(root, layout)
    return _executable(root / "versions" / layout["current"])


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
    if tuple(int(p) for p in str(parsed["version"]).split(".")) <= \
            tuple(int(p) for p in current_version.split(".")):
        return None
    release = parsed["platforms"][platform_key()]
    archive = _get(release["url"], 300)
    return install(root, parsed, archive)
