"""Credentials never leave this computer inside evidence (requirement 176).

Every receipt passes through the gateway, and its evidence is read by the server and the
planning model. Text that looks like a credential is replaced with REDACTED before that:
private keys, well-known token formats, JSON Web Tokens, authorization headers, credentials
in URLs and `password=`-style assignments. Files on disk are never changed; only the copy
of the text that would leave the device. Hashes, identifiers and ordinary prose stay intact.
"""

from __future__ import annotations

import re

REDACTED = "[REDACTED]"

_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----.*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|\Z)", re.S),
    re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b"),
    re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b"),
    re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    re.compile(r"\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b"),
    re.compile(r"\bsk-(?:proj-|ant-[a-z0-9]+-)?[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\bsb_secret_[A-Za-z0-9_-]{16,}\b"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}"),
]
# The label stays readable; only the value after it is replaced.
_HEADER = re.compile(r"(?i)\b((?:proxy-)?authorization\s*[:=]\s*)(?:(?:bearer|basic|token|digest)\s+)?[^\s\"',;]+")
_ASSIGNMENT = re.compile(
    r"(?i)\b((?:password|passwd|pwd|passphrase|secret|client[_-]?secret|api[_-]?key|access[_-]?key|"
    r"secret[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|private[_-]?key)\b\"?\s*[:=]\s*[\"']?)"
    r"[^\s\"',;]{4,}")
_URL_CREDENTIALS = re.compile(r"(?i)\b([a-z][a-z0-9+.-]*://)[^/\s:@]+:[^/\s@]+@")


def redact_text(text: str) -> tuple[str, int]:
    count = 0
    for pattern in _PATTERNS:
        text, found = pattern.subn(REDACTED, text)
        count += found
    for pattern, replacement in ((_HEADER, r"\1" + REDACTED), (_ASSIGNMENT, r"\1" + REDACTED),
                                 (_URL_CREDENTIALS, r"\1" + REDACTED + "@")):
        text, found = pattern.subn(replacement, text)
        count += found
    return text, count


def redact(value):
    """A copy of `value` (JSON-like) with every string redacted, and how many values were replaced."""
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, list):
        total, items = 0, []
        for item in value:
            item, found = redact(item)
            items.append(item)
            total += found
        return items, total
    if isinstance(value, dict):
        total, fields = 0, {}
        for key, item in value.items():
            item, found = redact(item)
            fields[key] = item
            total += found
        return fields, total
    return value, 0
