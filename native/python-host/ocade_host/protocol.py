"""Framing and bounds for the OCADE native-control sidecar.

WHY THIS LOOKS LIKE ``native/browser-host/index.mjs``
-----------------------------------------------------
Because it is the same contract, and a second protocol would be a second set of
mistakes. Newline-delimited JSON on stdin, exactly one bounded response per
request on stdout, no network listener, and no command that accepts an
arbitrary expression to evaluate. The browser host earned that shape; this host
inherits it rather than inventing its own.

WHAT THIS FILE REFUSES
----------------------
1. **Unbounded anything.** Every string, list and payload has a ceiling. A
   sidecar that will happily return a 40 MB accessibility tree is a sidecar
   that will one day be asked to, and the caller is a language model.
2. **Protected input.** Anything that looks like a credential, one-time code or
   payment value is refused before it can be typed OR read back. The rule lives
   here rather than in each action so a new action cannot forget it.
3. **Silence about failure.** Every refusal carries a sentence naming what was
   refused. ``ok: false`` with no reason is how an agent loop starts guessing.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from typing import Any, Callable

PROTOCOL_VERSION = 1

MAX_REQUEST_BYTES = 256 * 1024
MAX_TEXT = 20_000
MAX_ELEMENTS = 400
MAX_WINDOWS = 100
MAX_STRING = 2_000

_SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9._:-]{0,199}$", re.IGNORECASE)

# Deliberately broad. A false positive costs a pause; a false negative costs a
# credential. Mirrors PROTECTED_WORDS in native/companion/safety/src/lib.rs —
# the Rust companion remains the authority, and this is defence in depth for
# the case where the sidecar is driven directly during development.
_PROTECTED_WORDS = (
    "password", "passcode", "passphrase", "otp", "one-time code", "one time code",
    "verification code", "2fa", "mfa", "captcha", "cvv", "cvc", "card number",
    "iban", "sort code", "routing number", "ssn", "social security", "aadhaar",
    "passport number", "pin", "recovery code", "seed phrase", "private key",
    "biometric", "secret", "token",
)
_LONG_DIGITS = re.compile(r"\b\d{4,}\b")


class Refusal(Exception):
    """A bounded, explainable refusal. Never carries a stack trace outward."""

    def __init__(self, message: str, code: str = "blocked") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


def is_protected_text(value: str) -> bool:
    """True when text looks like a credential, OTP or payment value."""
    if not value:
        return False
    lowered = value.lower()
    for word in _PROTECTED_WORDS:
        if len(word) <= 3:
            if any(token == word for token in re.split(r"[^a-z0-9]+", lowered)):
                return True
        elif word in lowered:
            return True
    return bool(_LONG_DIGITS.search(value))


def bounded_text(value: Any, name: str, maximum: int = MAX_STRING) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise Refusal(f"{name} must be non-empty text of at most {maximum} characters.", "unsupported")
    return value


def safe_id(value: Any, name: str) -> str:
    if not isinstance(value, str) or not _SAFE_ID.match(value):
        raise Refusal(f"{name} is not a valid identifier.", "unsupported")
    return value


def clamp_text(value: str | None, maximum: int = MAX_TEXT) -> str:
    if not value:
        return ""
    return value if len(value) <= maximum else value[:maximum]


@dataclass(frozen=True)
class Request:
    version: int
    command: str
    run_id: str
    payload: dict[str, Any]
    #: Correlates ONE request with ONE reply, and is echoed back untouched.
    #: Not ``run_id``: a run id names an agent run and is deliberately shared by
    #: every request in it, so a caller cannot match on it. The browser host has
    #: echoed ``id`` since before this host existed, and the shared client in
    #: src/lib/native/native-host-client.node.ts matches on it — without the
    #: echo it falls back to matching by position, and one slow reply then hands
    #: every later answer to the wrong question.
    request_id: str | None = None


Handler = Callable[[Request], Any]


def parse(line: str) -> Request:
    if len(line.encode("utf-8")) > MAX_REQUEST_BYTES:
        raise Refusal("The request exceeded the maximum size.", "unsupported")
    try:
        raw = json.loads(line)
    except json.JSONDecodeError:
        raise Refusal("The request was not readable JSON.", "unsupported") from None
    if not isinstance(raw, dict):
        raise Refusal("The request must be an object.", "unsupported")
    if raw.get("version") != PROTOCOL_VERSION:
        raise Refusal("Unsupported native-host protocol.", "unsupported")
    command = bounded_text(raw.get("command"), "command", 60)
    run_id = raw.get("runId") or "-"
    payload = raw.get("payload") if isinstance(raw.get("payload"), dict) else {}
    request_id = raw.get("id")
    request_id = str(request_id)[:200] if isinstance(request_id, (str, int)) else None
    return Request(PROTOCOL_VERSION, command, str(run_id)[:200], payload, request_id)


def reply_ok(data: Any, request_id: str | None = None) -> str:
    reply: dict[str, Any] = {"ok": True, "data": data}
    if request_id is not None:
        reply["id"] = request_id
    return json.dumps(reply, default=str)


def reply_error(message: str, code: str = "retryable_failure", request_id: str | None = None) -> str:
    reply: dict[str, Any] = {"ok": False, "code": code, "error": message}
    if request_id is not None:
        reply["id"] = request_id
    return json.dumps(reply)


def serve(handlers: dict[str, Handler], stream_in=None, stream_out=None) -> None:
    """Read requests until stdin closes. One response per request, always."""
    source = stream_in or sys.stdin
    sink = stream_out or sys.stdout
    for line in source:
        line = line.strip()
        if not line:
            continue
        # Read the id before anything that can raise, so a REFUSAL is correlated
        # too. A caller that can match successes but not failures still has to
        # fall back to guessing the moment something goes wrong, which is the
        # moment it can least afford to.
        request_id = None
        try:
            raw = json.loads(line)
            candidate = raw.get("id") if isinstance(raw, dict) else None
            if isinstance(candidate, (str, int)):
                request_id = str(candidate)[:200]
        except (json.JSONDecodeError, AttributeError):
            request_id = None
        try:
            request = parse(line)
            handler = handlers.get(request.command)
            if handler is None:
                raise Refusal(f"Unsupported command: {request.command}", "unsupported")
            sink.write(reply_ok(handler(request), request.request_id) + "\n")
        except Refusal as refusal:
            sink.write(reply_error(refusal.message, refusal.code, request_id) + "\n")
        except Exception as error:  # noqa: BLE001 - the boundary must not die
            sink.write(
                reply_error(f"{type(error).__name__}: {error}"[:500], request_id=request_id) + "\n"
            )
        sink.flush()
