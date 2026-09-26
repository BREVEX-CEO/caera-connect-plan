"""
core/gemini.py — the retired device-side provider client.

The original runtime called a model provider directly from this machine with a
key read from a plaintext config file. OCADE JARVIS does not: intelligence runs
only through OCADE's server-side Online authority, and devices never hold a
provider key. Every capability that still imports this module degrades exactly
as it did when no key was configured — `call()` returns None, `text()` returns
its default — so it reports "not available" instead of pretending.

The original implementation is preserved unchanged in
imports/ocade-jarvis/source-original/.
"""
from __future__ import annotations

FAST = "fast"
SMART = "smart"
SEARCH = "search"
LIVE = "live"
DEFAULT_TIMEOUT_MS = 10_000

RETIRED = (
    "This device capability needs OCADE Online intelligence, which is not "
    "wired to device-side modules yet."
)


def api_key(refresh: bool = False) -> str:
    """Always empty: no provider key exists on an OCADE device."""
    return ""


def client(timeout_ms: int = DEFAULT_TIMEOUT_MS, key: str = ""):
    raise RuntimeError(RETIRED)


def call(contents, tier: str = FAST, config=None,
         timeout_ms: int = DEFAULT_TIMEOUT_MS, key: str = ""):
    print(f"[OCADE] {RETIRED}")
    return None


def text(contents, tier: str = FAST, config=None,
         timeout_ms: int = DEFAULT_TIMEOUT_MS, key: str = "", default: str = "") -> str:
    return default


def as_json(contents, tier: str = FAST, config=None,
            timeout_ms: int = DEFAULT_TIMEOUT_MS, key: str = "", default=None):
    return default
