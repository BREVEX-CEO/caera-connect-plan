"""
Sign jarvis-runtime/wake/manifest.json with the Device Agent's release key, so the agent
uses the wake model only as OCADE released it (the same key and check as its updates).

    python scripts/wake/sign_manifest.py [--key ~/.ocade-release/ocade-release.key]

The key is read, used and never printed, copied or moved.
"""
import argparse
import base64
import sys
from pathlib import Path

RUNTIME = Path(__file__).resolve().parents[2] / "jarvis-runtime"
sys.path.insert(0, str(RUNTIME))
sys.path.insert(0, str(RUNTIME / "packaging"))
import ocade_update  # noqa: E402
from release import DEFAULT_KEY, public_of, release_key  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--key", type=Path, default=DEFAULT_KEY)
args = parser.parse_args()
key = release_key(args.key, create=False)
if public_of(key) != ocade_update.UPDATE_PUBLIC_KEY:
    sys.exit("That key is not the one the Device Agent trusts.")
# Git stores the manifest with LF line ends (.gitattributes), so those are the bytes every
# checkout, package and APK carries: sign exactly them.
path = RUNTIME / "wake" / "manifest.json"
manifest = path.read_bytes().replace(b"\r\n", b"\n")
path.write_bytes(manifest)
signature = base64.b64encode(key.sign(manifest)).decode()
(RUNTIME / "wake" / "manifest.sig").write_text(signature + "\n", newline="\n")
ocade_update.verify_manifest(manifest, signature, ocade_update.UPDATE_PUBLIC_KEY)
print("signed and verified")
