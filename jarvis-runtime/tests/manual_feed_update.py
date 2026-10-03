"""
The update feed, end to end, against a running OCADE site on this computer.

    python jarvis-runtime/packaging/release.py --version 0.9.0 --key <test key> --new-key \\
        --base http://127.0.0.1:8788 --publish-local
    node scripts/e2e/harness.mjs --serve
    python jarvis-runtime/tests/manual_feed_update.py <test key> [http://127.0.0.1:8788]

The site serves the signed manifest, the archive and the installer from its
bucket; the updater fetches them through the real route, verifies, installs
the real program and health-checks it. A manifest signed by another key, and
an installed agent that is already newer, install nothing.
"""
import base64
import hashlib
import json
import shutil
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

RUNTIME = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RUNTIME))
import ocade_update as up  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402

failures = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global failures
    failures += 0 if ok else 1
    print(f"{'PASS' if ok else 'FAIL'}  {name}{' - ' + detail if detail else ''}", flush=True)


def status(url: str) -> int:
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return response.status
    except urllib.error.HTTPError as e:
        return e.code


def main() -> int:
    key = serialization.load_pem_private_key(Path(sys.argv[1]).read_bytes(), None)
    server = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:8788"
    public = base64.b64encode(key.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()

    manifest = json.loads(up._get(f"{server}/agent/manifest.json", 30))
    check("the site serves the release manifest", manifest.get("version") == "0.9.0", str(manifest.get("version")))
    installer = manifest["installers"][up.platform_key()]
    with urllib.request.urlopen(f"{server}/agent/{installer}", timeout=120) as response:
        head = response.read(2)
        length = int(response.headers["content-length"])
        disposition = response.headers.get("content-disposition", "")
    check("the installer downloads as a program file with its name",
          head == b"MZ" and length > 10_000_000 and installer in disposition, f"{length:,} bytes")
    for name in ("release.key", "..%2Fr%2Fx", "ocade-agent-latest-windows-x64.zip", "manifest.json.bak"):
        check(f"nothing else is served from the bucket ({name})", status(f"{server}/agent/{name}") == 404)

    root = Path(tempfile.mkdtemp(prefix="ocade-feed-"))
    try:
        shutil.copytree(RUNTIME / "dist" / "ocade-agent", root / "versions" / "0.2.0")
        up.adopt(root, "0.2.0")

        up.UPDATE_PUBLIC_KEY = base64.b64encode(Ed25519PrivateKey.generate().public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
        try:
            up.check(server, root, "0.2.0")
            check("a release signed by another key is refused", False)
        except up.UpdateRefused as e:
            check("a release signed by another key is refused", "not signed by OCADE" in str(e), str(e))

        up.UPDATE_PUBLIC_KEY = public
        check("an agent that is already newer installs nothing", up.check(server, root, "1.0.0") is None)
        check("an agent at the same version installs nothing", up.check(server, root, "0.9.0") is None)

        installed = up.check(server, root, "0.2.0")
        layout = json.loads((root / "current.json").read_text())
        exe = up._executable(root / "versions" / "0.9.0")
        archive_hash = hashlib.sha256(up._get(manifest["platforms"][up.platform_key()]["url"], 300)).hexdigest()
        check("an older agent downloads, verifies and installs it through the site",
              installed == "0.9.0" and layout["current"] == "0.9.0" and exe.is_file())
        check("what it downloaded is what was signed",
              archive_hash == manifest["platforms"][up.platform_key()]["sha256"])
        check("the installed program really starts", up._health(exe))
        check("the build it came from is kept to roll back to",
              layout["previous"] == "0.2.0" and layout["installed"] == "0.2.0")
    finally:
        shutil.rmtree(root, ignore_errors=True)
    print(f"\n{'Feed update proof passed' if failures == 0 else f'{failures} failed'}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
