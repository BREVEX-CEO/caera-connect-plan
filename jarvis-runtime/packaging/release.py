"""
Build and publish an OCADE Device Agent release.

    python jarvis-runtime/packaging/release.py                 # build the release files
    python jarvis-runtime/packaging/release.py --publish       # ...and upload them to OCADE
    python jarvis-runtime/packaging/release.py --publish-local # ...into the local dev bucket

What it makes, in `jarvis-runtime/dist/release/`:

    ocade-agent-<version>-windows-x64.zip     the update archive installed agents download
    OCADE-Device-Agent-<version>-Setup.exe    the installer people download
    manifest.json, manifest.json.sig          what an agent verifies before installing anything

The manifest is signed with the release key, which lives outside the
repository (`OCADE_RELEASE_KEY`, default `~/.ocade-release/ocade-release.key`).
Whoever holds that file can ship code to every computer running the agent:
keep a copy somewhere safe, and nowhere else. Its public half is
`UPDATE_PUBLIC_KEY` in `ocade_update.py`; this refuses to publish a manifest
that the agent being released would not accept.

Public builds must also carry a publisher signature Windows recognises
(`--sign`, which needs the owner's code-signing certificate configured in Inno
Setup as "ocadesign"). Without it the manifest says so, and the site tells
people Windows will warn them.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import subprocess
import sys
import zipfile
from pathlib import Path

RUNTIME = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RUNTIME))
import ocade_update  # noqa: E402
from ocade_identity import SOFTWARE_VERSION  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402

DIST = RUNTIME / "dist" / "ocade-agent"
OUT = RUNTIME / "dist" / "release"
BUCKET = "ocade-private-models"
DEFAULT_KEY = Path.home() / ".ocade-release" / "ocade-release.key"


def release_key(path: Path, create: bool) -> Ed25519PrivateKey:
    if not path.exists():
        if not create:
            sys.exit(f"No release key at {path}. Run once with --new-key, then keep that file safe.")
        path.parent.mkdir(parents=True, exist_ok=True)
        key = Ed25519PrivateKey.generate()
        path.write_bytes(key.private_bytes(serialization.Encoding.PEM,
                                           serialization.PrivateFormat.PKCS8,
                                           serialization.NoEncryption()))
        if os.name == "nt":  # this account only
            subprocess.run(["icacls", str(path), "/inheritance:r", "/grant:r",
                            f"{os.environ.get('USERNAME', '')}:F"], capture_output=True)
        else:
            path.chmod(0o600)
        print(f"A new release key was written to {path}. Back it up; it cannot be recovered.")
    return serialization.load_pem_private_key(path.read_bytes(), None)


def public_of(key: Ed25519PrivateKey) -> str:
    return base64.b64encode(key.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()


def archive(version: str) -> Path:
    if not ocade_update._executable(DIST).is_file():
        sys.exit(f"No packaged build at {DIST}. Build it first:\n"
                 "  python -m PyInstaller --noconfirm packaging/ocade-agent.spec")
    target = OUT / f"ocade-agent-{version}-{ocade_update.platform_key()}.zip"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        for file in sorted(DIST.rglob("*")):
            if file.is_file():
                bundle.write(file, file.relative_to(DIST).as_posix())
    return target


def installer(version: str, sign: bool) -> Path | None:
    """The Windows installer, when Inno Setup is on this computer."""
    candidates = [Path(os.environ.get("LOCALAPPDATA", "")) / "Programs/Inno Setup 7/ISCC.exe",
                  Path(os.environ.get("ProgramFiles(x86)", "")) / "Inno Setup 6/ISCC.exe"]
    iscc = next((c for c in candidates if c.is_file()), None)
    if os.name != "nt" or iscc is None:
        return None
    script = RUNTIME / "packaging" / "windows" / "ocade-agent.iss"
    command = [str(iscc), f"/DVersion={version}", f"/DSource={DIST}", f"/O{OUT}", "/Q", str(script)]
    if sign:
        command.insert(1, "/DSign=1")
    subprocess.run(command, check=True)
    built = OUT / f"OCADE-Device-Agent-{version}-Setup.exe"
    return built if built.is_file() else None


def upload(files: list[Path], local: bool) -> None:
    """Versioned files first, the manifest last: an agent never sees a manifest whose archive is missing."""
    order = sorted(files, key=lambda f: (f.name.startswith("manifest"), f.name.endswith(".sig")))
    for file in order:
        subprocess.run(["npx", "wrangler", "r2", "object", "put", f"{BUCKET}/agent/{file.name}",
                        "--file", str(file), "--local" if local else "--remote"],
                       check=True, shell=os.name == "nt", cwd=RUNTIME.parent)
        print("uploaded", file.name)


def main() -> None:
    parser = argparse.ArgumentParser(prog="release")
    parser.add_argument("--version", default=SOFTWARE_VERSION)
    parser.add_argument("--base", default="https://ocade.in", help="where agents fetch the archive from")
    parser.add_argument("--key", default=os.environ.get("OCADE_RELEASE_KEY", str(DEFAULT_KEY)))
    parser.add_argument("--new-key", action="store_true", help="create the release key if there is none")
    parser.add_argument("--sign", action="store_true", help="sign the installer with the publisher certificate")
    parser.add_argument("--no-installer", action="store_true")
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--publish-local", action="store_true")
    args = parser.parse_args()

    key = release_key(Path(args.key), args.new_key)
    public = public_of(key)
    if args.new_key and not (args.publish or args.publish_local):
        print("UPDATE_PUBLIC_KEY =", repr(public))
    OUT.mkdir(parents=True, exist_ok=True)
    bundle = archive(args.version)
    setup = None if args.no_installer else installer(args.version, args.sign)
    manifest = {
        "version": args.version,
        "platforms": {ocade_update.platform_key(): {
            "url": f"{args.base.rstrip('/')}/agent/{bundle.name}",
            "sha256": hashlib.sha256(bundle.read_bytes()).hexdigest(),
        }},
        "installers": {ocade_update.platform_key(): setup.name} if setup else {},
        "publisherVerified": bool(args.sign and setup),
    }
    raw = json.dumps(manifest, indent=2).encode()
    signature = base64.b64encode(key.sign(raw)).decode()
    (OUT / "manifest.json").write_bytes(raw)
    (OUT / "manifest.json.sig").write_text(signature)
    # What the agent itself will do with it, before anybody else is given it.
    ocade_update.verify_manifest(raw, signature, public)
    files = [bundle, OUT / "manifest.json", OUT / "manifest.json.sig"] + ([setup] if setup else [])
    for file in files:
        print(f"{file.name}  {file.stat().st_size:,} bytes")
    if args.publish or args.publish_local:
        if args.publish and ocade_update.UPDATE_PUBLIC_KEY != public:
            sys.exit("Refusing to publish: the agent being released does not trust this key "
                     "(UPDATE_PUBLIC_KEY in ocade_update.py differs), so no installed agent would accept it.")
        upload(files, local=args.publish_local)


if __name__ == "__main__":
    main()
