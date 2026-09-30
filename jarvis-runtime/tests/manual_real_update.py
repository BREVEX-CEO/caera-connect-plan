"""
The updater against the REAL packaged program, on this computer.

Not part of the unit run (it needs `dist/ocade-agent` and takes minutes):

    python jarvis-runtime/tests/manual_real_update.py

It installs the packaged build as the installer would, then walks the release
through everything that goes wrong in the field: a download that was altered,
a build whose program cannot start, an install killed half way, and a build
that never stays up. After each, the program current.json names must still
answer `--health`.
"""
import base64
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

RUNTIME = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RUNTIME))
import ocade_update as up  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402

DIST = RUNTIME / "dist" / "ocade-agent"
failures = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global failures
    failures += 0 if ok else 1
    print(f"{'PASS' if ok else 'FAIL'}  {name}{' — ' + detail if detail else ''}", flush=True)


def pack(folder: Path, damage=None) -> bytes:
    """The release archive. `damage(name, data)` may alter one file on the way in."""
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as bundle:
        for file in sorted(folder.rglob("*")):
            if file.is_file():
                name = file.relative_to(folder).as_posix()
                data = file.read_bytes()
                bundle.writestr(name, damage(name, data) if damage else data)
    return out.getvalue()


def healthy(root: Path) -> bool:
    exe = up._executable(root / "versions" / json.loads((root / "current.json").read_text())["current"])
    return exe.is_file() and subprocess.run([str(exe), "--health"], capture_output=True,
                                            timeout=120).returncode == 0


def main() -> int:
    if not up._executable(DIST).is_file():
        print(f"BLOCKED  no packaged build at {DIST}")
        return 2
    key = Ed25519PrivateKey.generate()
    public = base64.b64encode(key.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()

    def release(version: str, archive: bytes) -> dict:
        manifest = json.dumps({"version": version, "platforms": {up.platform_key(): {
            "url": f"https://ocade.test/agent/{version}.zip",
            "sha256": hashlib.sha256(archive).hexdigest()}}}).encode()
        return up.verify_manifest(manifest, base64.b64encode(key.sign(manifest)).decode(), public)

    root = Path(tempfile.mkdtemp(prefix="ocade-update-"))
    try:
        # What the installer leaves behind.
        shutil.copytree(DIST, root / "versions" / "0.2.0")
        up.adopt(root, "0.2.0")
        check("the installed build answers its health check", healthy(root))

        good = pack(DIST)
        started = time.monotonic()
        up.install(root, release("0.3.0", good), good)
        layout = json.loads((root / "current.json").read_text())
        check("a signed, matching, healthy release becomes current",
              layout["current"] == "0.3.0" and layout["previous"] == "0.2.0" and healthy(root),
              f"{time.monotonic() - started:.1f}s including the real health check")

        # A download altered on the way: one byte differs from what was signed.
        altered = bytearray(good)
        altered[len(altered) // 2] ^= 0xFF
        try:
            up.install(root, release("0.4.0", good), bytes(altered))
            check("an altered download is refused", False)
        except up.UpdateRefused as e:
            check("an altered download is refused", "does not match" in str(e), str(e))

        # Correctly signed, but the program inside cannot start.
        broken = pack(DIST, lambda name, data: data[: len(data) // 3] if name == up._executable(Path(".")).name else data)
        try:
            up.install(root, release("0.4.0", broken), broken)
            check("a build whose program cannot start is refused", False)
        except up.UpdateRefused as e:
            check("a build whose program cannot start is refused",
                  "health check" in str(e) or "could not be prepared" in str(e), str(e))
        layout = json.loads((root / "current.json").read_text())
        check("and nothing switched: the working build is still current",
              layout["current"] == "0.3.0" and not (root / "versions/0.4.0").exists() and healthy(root))

        # An install killed half way (the process, not an exception).
        archive_file = root / "release.zip"
        archive_file.write_bytes(good)
        manifest_file = root / "release.json"
        manifest_file.write_text(json.dumps(release("0.5.0", good)))
        child = subprocess.Popen([sys.executable, "-c", (
            "import sys, json; from pathlib import Path\n"
            f"sys.path.insert(0, {str(RUNTIME)!r}); import ocade_update as up\n"
            f"root = Path({str(root)!r})\n"
            "up.install(root, json.loads((root / 'release.json').read_text()), (root / 'release.zip').read_bytes())\n")])
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline and not (root / "versions/0.5.0").exists():
            time.sleep(0.02)
        time.sleep(0.4)  # some files written, far from all
        child.kill()
        child.wait()
        partial = sum(1 for _ in (root / "versions/0.5.0").rglob("*")) if (root / "versions/0.5.0").exists() else 0
        layout = json.loads((root / "current.json").read_text())
        check("an install killed half way leaves the working build current",
              layout["current"] == "0.3.0" and healthy(root), f"{partial} files of the dead install on disk")
        target = up.launch_target(root)
        check("and the next start runs the working build, not the half-written one",
              target is not None and target.parent.name == "0.3.0")
        up.mark_healthy(root)
        up.install(root, release("0.5.0", good), good)
        check("the same release installs cleanly afterwards",
              json.loads((root / "current.json").read_text())["current"] == "0.5.0" and healthy(root))

        # A build that was switched to and then never stays up.
        for _ in range(up.MAX_FAILED_STARTS):
            up.launch_target(root)
        target = up.launch_target(root)
        layout = json.loads((root / "current.json").read_text())
        check("after two starts that never became healthy, it rolls back",
              target.parent.name == "0.3.0" and layout["rolledBackFrom"] == "0.5.0" and healthy(root))
        check("the installed build is still there for the login entry and the uninstaller",
              up._executable(root / "versions" / "0.2.0").is_file() and layout["installed"] == "0.2.0")
    finally:
        shutil.rmtree(root, ignore_errors=True)
    print(f"\n{'Real update proof passed' if failures == 0 else f'{failures} failed'}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
