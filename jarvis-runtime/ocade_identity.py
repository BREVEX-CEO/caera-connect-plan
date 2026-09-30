"""
This device's OCADE identity: its own P-256 key, signed requests, codeless
enrollment and automatic key rotation.

The private key never leaves this machine. OCADE stores only the public half,
so nothing on the server can impersonate this device. Every request is signed
over the shared contract in `ocade_protocol.json` (the website and the browser
extension read the same file), with a timestamp that only moves forward, so a
captured request cannot be sent twice.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

PROTOCOL = json.loads((Path(__file__).resolve().parent / "ocade_protocol.json").read_text())
SOFTWARE_VERSION = "0.3.0"


class UpdateRequired(Exception):
    """OCADE no longer speaks this agent's protocol version."""


class ClockSkew(urllib.error.URLError):
    """OCADE refused this computer's timestamp: its clock is wrong. Nothing is forgotten."""

    def __init__(self):
        super().__init__("clock_skew")


# Only these mean OCADE no longer knows this device; anything else is retried.
REMOVED = ("device_not_enrolled", "enrollment_expired")


class NotEnrolled(Exception):
    """The device was removed from OCADE, or never approved."""


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def new_key() -> ec.EllipticCurvePrivateKey:
    return ec.generate_private_key(ec.SECP256R1())


def public_text(key: ec.EllipticCurvePrivateKey) -> str:
    return b64url(key.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo))


def fingerprint(public: str) -> str:
    hexed = hashlib.sha256(public.encode()).hexdigest()[:16].upper()
    return "-".join(hexed[i:i + 4] for i in range(0, 16, 4))


def canonical(method: str, path: str, device: str, timestamp: int, body: bytes) -> bytes:
    return "\n".join([
        PROTOCOL["signing"]["prefix"], str(PROTOCOL["version"]), method.upper(), path,
        device, str(timestamp), hashlib.sha256(body).hexdigest(),
    ]).encode()


def sign(key: ec.EllipticCurvePrivateKey, message: bytes) -> str:
    # WebCrypto verifies the raw r||s form, not DER.
    r, s = decode_dss_signature(key.sign(message, ec.ECDSA(hashes.SHA256())))
    return b64url(r.to_bytes(32, "big") + s.to_bytes(32, "big"))


class Identity:
    """The stored identity in HOME: `device.json` (server, id) and `device.key` (0600)."""

    def __init__(self, home: Path):
        self.home = home
        self.meta_path = home / "device.json"
        self.key_path = home / "device.key"
        self.next_path = home / "device.next.key"
        self._last_ms = 0
        # A damaged identity is NOT "never connected": enrolling again would
        # leave the old device live in OCADE with nobody able to revoke it from
        # here. It stays damaged until the person removes it (forget).
        self.damaged = False
        try:
            self.meta: dict = json.loads(self.meta_path.read_text()) if self.meta_path.exists() else {}
            self.key = (serialization.load_pem_private_key(self.key_path.read_bytes(), None)
                        if self.key_path.exists() else None)
        except (OSError, ValueError, TypeError):
            self.meta, self.key, self.damaged = {}, None, True

    @property
    def connected(self) -> bool:
        return bool(self.meta.get("deviceId") and self.meta.get("approved") and self.key)

    def _write_key(self, key: ec.EllipticCurvePrivateKey, path: Path) -> None:
        self.home.mkdir(parents=True, exist_ok=True)
        pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption())
        tmp = path.with_suffix(".tmp")
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "wb") as handle:
            handle.write(pem)
        os.replace(tmp, path)  # atomic: a crash never leaves half a key

    def _save(self, key: ec.EllipticCurvePrivateKey | None = None) -> None:
        self.home.mkdir(parents=True, exist_ok=True)
        if key is not None:
            self._write_key(key, self.key_path)
            self.key = key
        tmp = self.meta_path.with_suffix(".tmp")
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as handle:
            handle.write(json.dumps(self.meta))
        os.replace(tmp, self.meta_path)  # atomic, like the key

    DAMAGED = ("This computer's OCADE connection is damaged. Remove it in OCADE Devices, then run "
               "'ocade-agent --uninstall' (or 'ocade_device.py forget') and connect again.")

    def forget(self) -> None:
        """Remove every local credential (exit after revoke, or uninstall)."""
        for path in (self.meta_path, self.key_path, self.next_path):
            path.unlink(missing_ok=True)
        self.meta, self.key, self.damaged = {}, None, False

    def _timestamp(self) -> int:
        self._last_ms = max(int(time.time() * 1000), self._last_ms + 1)
        return self._last_ms

    def post(self, path: str, body: dict, key: ec.EllipticCurvePrivateKey | None = None,
             device: str | None = None) -> tuple[int, dict]:
        raw = json.dumps(body).encode()
        key = key or self.key
        device = device or self.meta.get("deviceId") or "-"
        stamp = self._timestamp()
        h = PROTOCOL["headers"]
        request = urllib.request.Request(
            self.meta["server"].rstrip("/") + path, data=raw, method="POST",
            # A named client: OCADE's edge refuses the default Python client string.
            headers={"Content-Type": "application/json",
                     "User-Agent": f"OCADE-Device-Agent/{SOFTWARE_VERSION}",
                     h["device"]: device, h["protocol"]: str(PROTOCOL["version"]),
                     h["timestamp"]: str(stamp),
                     h["signature"]: sign(key, canonical("POST", path, device, stamp, raw))})
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.status, json.loads(response.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            try:
                payload = json.loads(e.read().decode() or "{}")
            except ValueError:
                payload = {}
            if e.code == 426:
                raise UpdateRequired() from e
            return e.code, payload

    def enroll(self, server: str, name: str, platform: str, kind: str = "agent") -> dict:
        """Register a fresh key; the person approves it in OCADE. Returns the approval details."""
        if self.damaged:
            raise RuntimeError(self.DAMAGED)
        key = new_key()
        self.meta = {"server": server, "name": name}
        public = public_text(key)
        status, reply = self.post(PROTOCOL["paths"]["enroll"],
                                  {"publicKey": public, "name": name, "platform": platform,
                                   "kind": kind, "softwareVersion": SOFTWARE_VERSION}, key=key)
        if status != 200:
            raise RuntimeError(f"OCADE refused the connection request ({reply.get('error', status)})")
        self.meta.update({"deviceId": reply["deviceId"], "approved": False,
                          "rotatedAt": int(time.time())})
        self._save(key)
        return {"url": server.rstrip("/") + reply["approve"], "fingerprint": fingerprint(public)}

    def wait_for_approval(self, timeout_s: float = 600, poll_s: float = 2) -> bool:
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            try:
                status, reply = self.post(PROTOCOL["paths"]["exchange"], {"results": []})
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
                time.sleep(poll_s)  # a network blip while the person approves is not a refusal
                continue
            if status == 200:
                self.meta["approved"] = True
                self._save()
                return True
            if status in (401, 410) and reply.get("error") in (*REMOVED, "signature_invalid"):
                return False
            time.sleep(poll_s)  # 202 (still waiting), a wrong clock or a server hiccup: keep waiting
        return False

    def exchange(self, body: dict) -> dict:
        """One signed exchange. Rotates the key first when it is due."""
        due = time.time() - self.meta.get("rotatedAt", 0) > PROTOCOL["rotateAfterDays"] * 86400
        if due:
            self.rotate()
        status, reply = self.post(PROTOCOL["paths"]["exchange"], body)
        if status == 401 and reply.get("error") == "signature_invalid" and self.next_path.exists():
            # A rotation reached OCADE but its answer did not reach us: the new key is live.
            self._save(serialization.load_pem_private_key(self.next_path.read_bytes(), None))
            self.next_path.unlink(missing_ok=True)
            self.meta["rotatedAt"] = int(time.time())
            self._save()
            status, reply = self.post(PROTOCOL["paths"]["exchange"], body)
        if reply.get("error") in REMOVED:
            raise NotEnrolled(reply["error"])
        if reply.get("error") == "clock_skew":
            raise ClockSkew()
        if status != 200:
            raise urllib.error.URLError(f"exchange failed with {status}")
        if int(reply.get("protocol") or 0) > PROTOCOL["version"]:
            raise UpdateRequired()  # OCADE speaks a newer protocol: update, never guess
        if reply.get("deviceId") != self.meta["deviceId"]:
            # Work addressed to another device is never run here.
            raise urllib.error.URLError("reply was not addressed to this device")
        return reply

    def rotate(self) -> bool:
        """Swap to a new key, signed by the current one. The old key stops working at once."""
        fresh = new_key()
        self._write_key(fresh, self.next_path)  # kept until OCADE's answer is known
        status, reply = self.post(PROTOCOL["paths"]["exchange"],
                                  {"results": [], "rotate": {"publicKey": public_text(fresh)}})
        if status == 200 and reply.get("rotated"):
            self.meta["rotatedAt"] = int(time.time())
            self._save(fresh)
            self.next_path.unlink(missing_ok=True)
            return True
        return False
