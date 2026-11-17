"""Signed update lifecycle of the FROZEN companion on a disposable runner (plan v8 11.8).

    python packaging/test_update.py --new-key <folder>   (before the build: a disposable key pair)
    python packaging/test_update.py <frozen executable> <bundle folder> <private key PEM>

The bundle was built with the matching public key (OCADE_RELEASE_PUBLIC_KEY_FILE). The test signs
two update releases of that same bundle (labelled newer versions), then drives the real executable:
upgrade, second upgrade, rollback, damage of the selected release (its integrity check fails and the
companion falls back), and rollback to the installed base. Each state is read back through the
companion's own `diagnose`. The key is generated on the runner and never leaves it. Never run on a
customer's or developer's PC.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from cryptography.hazmat.primitives.serialization import load_pem_private_key


def new_key(folder: Path) -> None:
    """A runner-only Ed25519 pair: release-key.txt (embedded by the build) and signing.pem."""
    import base64

    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat

    folder.mkdir(parents=True, exist_ok=True)
    private = Ed25519PrivateKey.generate()
    (folder / "signing.pem").write_bytes(private.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()))
    (folder / "release-key.txt").write_bytes(base64.b64encode(private.public_key().public_bytes_raw()))


def main(executable: Path, bundle: Path, key_file: Path) -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from check_frozen import prepare_update

    key = load_pem_private_key(key_file.read_bytes(), password=None)
    with tempfile.TemporaryDirectory(prefix="ocade-update-test-") as folder:
        root = Path(folder)
        home = root / "agent-home"
        env = {**os.environ, "OCADE_AGENT_HOME": str(home), "PYINSTALLER_RESET_ENVIRONMENT": "1"}

        def agent(*args: str) -> subprocess.CompletedProcess:
            return subprocess.run([str(executable), *args], env=env, capture_output=True, text=True, timeout=300)

        def release_line() -> str:
            answer = agent("diagnose", "--workspace", str(root))
            line = next((row for row in answer.stdout.splitlines() if " release:" in row), "")
            print(line)
            return line

        def check(ok: bool, what: str) -> None:
            if not ok:
                raise SystemExit(f"FAILED: {what}")
            print(f"PASS: {what}")

        made = []

        def signed(version: str) -> list[str]:
            made.append(version)
            out = root / f"release-{len(made)}"
            out.mkdir()
            archive, manifest, signature = out / "update.tar.gz", out / "manifest.json", out / "manifest.sig"
            prepare_update(bundle, archive, manifest, 1_700_000_000, version)
            signature.write_bytes(key.sign(manifest.read_bytes()))
            return ["--manifest", str(manifest), "--signature", str(signature), "--archive", str(archive)]

        check("installed release" in release_line(), "a clean install runs its own release")
        upgrade = agent("activate-update", *signed("90.0.1"))
        print(upgrade.stdout, upgrade.stderr)
        check(upgrade.returncode == 0, "a signed upgrade starts every worker, then is selected")
        check("update 90.0.1 selected and verified" in release_line(), "the upgrade is verified at selection")
        check(agent("activate-update", *signed("90.0.1")).returncode == 3, "the same release is refused (no downgrade or replay)")

        forged = signed("90.0.2")
        Path(forged[3]).write_bytes(bytes(64))
        check(agent("activate-update", *forged).returncode == 3, "an unsigned upgrade is refused")
        check("update 90.0.1" in release_line(), "a refused upgrade leaves the selected release alone")

        check(agent("activate-update", *signed("90.0.3")).returncode == 0, "a second signed upgrade")
        check(agent("rollback-update").returncode == 0, "rollback")
        check("update 90.0.1 selected and verified" in release_line(), "rollback restores the previous verified release")

        active = json.loads((home / "releases" / "active.json").read_text())["active"]
        app = home / "releases" / active / "app"
        launcher = app / "ocade-agent.exe" if sys.platform == "win32" else app / "OCADE JARVIS.app/Contents/MacOS/ocade-agent"
        with launcher.open("ab") as stream:
            stream.write(b"\0")
        check("FIX  release" in release_line(), "a damaged selected release fails its integrity check")
        check(agent("rollback-update").returncode == 0, "rollback from a damaged release")
        check("installed release" in release_line(), "the installed base release runs again")


if __name__ == "__main__":
    if sys.argv[1] == "--new-key":
        new_key(Path(sys.argv[2]))
    else:
        main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
