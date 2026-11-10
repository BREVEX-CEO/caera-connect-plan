"""This computer's identity and its signed, outbound-only exchange (plan.md §23.2, P03).

One P-256 key per device, made here; only the public half ever leaves. Every
request is signed over the protocol version, method, path, device id, a strictly
increasing millisecond timestamp and the body's SHA-256, so a captured request
cannot be replayed or altered. On Windows the private key is sealed with DPAPI
for the signed-in user (UNTESTED until a real Windows run); elsewhere it is a
file readable only by its owner. No inbound port is opened.
"""

from __future__ import annotations

import base64
import ctypes
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

from .gateway import PROTOCOL

PATH = "/api/jarvis/device"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


class _Blob(ctypes.Structure):
    _fields_ = [("size", ctypes.c_uint32), ("data", ctypes.POINTER(ctypes.c_char))]


def _dpapi(data: bytes, protect: bool) -> bytes:
    """CryptProtectData / CryptUnprotectData for the current Windows user."""
    crypt32, kernel32 = ctypes.windll.crypt32, ctypes.windll.kernel32  # type: ignore[attr-defined]
    source = _Blob(len(data), ctypes.cast(ctypes.create_string_buffer(data, len(data)), ctypes.POINTER(ctypes.c_char)))
    result = _Blob()
    call = crypt32.CryptProtectData if protect else crypt32.CryptUnprotectData
    if not call(ctypes.byref(source), None, None, None, None, 0x1, ctypes.byref(result)):  # UI_FORBIDDEN
        raise OSError("DPAPI refused")
    try:
        return ctypes.string_at(result.data, result.size)
    finally:
        kernel32.LocalFree(result.data)


class Device:
    def __init__(self, home: Path, server: str):
        self.home = home
        self.server = server.rstrip("/")
        self.config_path = home / "device.json"
        self.config = json.loads(self.config_path.read_text()) if self.config_path.exists() else {}
        self.key = self._load_or_create_key()

    def _load_or_create_key(self) -> ec.EllipticCurvePrivateKey:
        sealed = self.home / "device-key.bin"
        if sealed.exists():
            data = sealed.read_bytes()
            pem = _dpapi(data, protect=False) if sys.platform == "win32" else data
            return serialization.load_pem_private_key(pem, password=None)
        key = ec.generate_private_key(ec.SECP256R1())
        pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
        self.home.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(sealed, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(_dpapi(pem, protect=True) if sys.platform == "win32" else pem)
        return key

    @property
    def public_key(self) -> str:
        return _b64url(self.key.public_key().public_bytes(
            serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo))

    @property
    def device_id(self) -> str | None:
        return self.config.get("deviceId")

    def _save(self) -> None:
        self.config_path.write_text(json.dumps(self.config))

    def _timestamp(self) -> int:
        """Strictly increasing across restarts, even if the clock steps back a little."""
        stamp = max(int(time.time() * 1000), int(self.config.get("lastTimestamp", 0)) + 1)
        self.config["lastTimestamp"] = stamp
        self._save()
        return stamp

    def sign(self, method: str, path: str, device_id: str, timestamp: int, body: str) -> str:
        text = "\n".join([
            PROTOCOL["signing"]["prefix"], str(PROTOCOL["version"]), method, path, device_id,
            str(timestamp), hashlib.sha256(body.encode()).hexdigest(),
        ])
        r, s = decode_dss_signature(self.key.sign(text.encode(), ec.ECDSA(hashes.SHA256())))
        return _b64url(r.to_bytes(32, "big") + s.to_bytes(32, "big"))

    def request(self, payload: dict, timeout: float | None = None) -> tuple[int, dict]:
        body = json.dumps(payload, separators=(",", ":"))
        device_id = "-" if payload["op"] == "enroll" else (self.device_id or "-")
        timestamp = self._timestamp()
        request = urllib.request.Request(
            self.server + PATH,
            data=body.encode(),
            method="POST",
            headers={
                "content-type": "application/json",
                "x-ocade-protocol": str(PROTOCOL["version"]),
                "x-ocade-device": device_id,
                "x-ocade-timestamp": str(timestamp),
                "x-ocade-signature": self.sign("POST", PATH, device_id, timestamp, body),
            },
        )
        try:
            # A receipt's answer waits for the next planning turn (a model call). The server bounds
            # one call at 145 s (planner.server.ts), so waiting less resent every slow turn's
            # receipt (benchmark round 2). A resend is harmless now (the turn has one holder), but
            # it is still a wasted request. A claim resuming a busy planner owns the same turn.
            limit = timeout or (170 if payload["op"] in ("receipt", "claim") else 30)
            try:
                with urllib.request.urlopen(request, timeout=limit) as response:
                    status, data = response.status, response.read()
            except urllib.error.HTTPError as error:
                with error:
                    status, data = error.code, error.read()
        except OSError:
            raise ConnectionError("device_transport_unavailable") from None
        try:
            answer = json.loads(data or b"{}")
        except (ValueError, UnicodeError):
            raise ConnectionError("device_response_unreadable") from None
        if not isinstance(answer, dict):
            raise ConnectionError("device_response_unreadable")
        return status, answer

    def enroll(self, name: str, platform: str, version: str) -> dict:
        status, body = self.request({"op": "enroll", "publicKey": self.public_key, "name": name,
                                     "platform": platform, "softwareVersion": version})
        if status != 200:
            raise RuntimeError(f"enrollment refused: {body.get('error', status)}")
        self.config["deviceId"] = body["deviceId"]
        self._save()
        return body
