"""
Sign an OCADE Device Agent release manifest (owner-only step).

    python packaging/sign_manifest.py manifest.json /secure/ocade-release.key

Writes manifest.json.sig. The private key never enters the repository; its
public half is UPDATE_PUBLIC_KEY in ocade_update.py. Generate the pair once:

    python packaging/sign_manifest.py --new-key /secure/ocade-release.key
"""
import base64
import sys
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

if sys.argv[1] == "--new-key":
    key = Ed25519PrivateKey.generate()
    Path(sys.argv[2]).write_bytes(key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    raw = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    print("UPDATE_PUBLIC_KEY =", repr(base64.b64encode(raw).decode()))
else:
    manifest = Path(sys.argv[1]).read_bytes()
    key = serialization.load_pem_private_key(Path(sys.argv[2]).read_bytes(), None)
    Path(sys.argv[1] + ".sig").write_text(base64.b64encode(key.sign(manifest)).decode())
    print("Signed", sys.argv[1])
