"""Windows bindings, bound when they are USED rather than when a module loads.

WHY THIS EXISTS
---------------
``act``, ``capture`` and ``observe`` are Windows PC control: UI Automation,
window handles, physical input. Importing ``win32con`` and friends at module
scope made that a load-time requirement rather than a call-time one, and on any
machine without pywin32 the modules could not be IMPORTED AT ALL.

That is not a Windows-only inconvenience. It meant:

  - the Python host's own test suite could not be collected on Linux or macOS —
    one module died during collection and took the run with it, and eight tests
    that never touch a window failed for the same reason;
  - a developer on any other platform could not read a traceback, run the
    protocol tests, or check the command surface;
  - anything that merely imported the package to ask what commands exist
    inherited a hard dependency on a Windows-only wheel.

The rest of the file already had the right instinct: ``pywinauto``,
``pyautogui`` and the capture helpers are all imported inside the functions that
use them. These bindings simply had not been given the same treatment, and there
are enough call sites that moving each one into its function would have been a
large, noisy change to working code.

So the modules are bound lazily instead. ``win32con.SW_RESTORE`` still reads the
same at every call site; the import happens on first attribute access. On a
system without pywin32 that raises the host's own ``Refusal`` with the
``unsupported`` code — the same answer every other platform-specific action
gives — rather than a ``ModuleNotFoundError`` from the middle of a command.
"""

from __future__ import annotations

import importlib
from typing import Any

from .protocol import Refusal


class _LazyWindowsModule:
    """A stand-in that becomes the real module on first use."""

    __slots__ = ("_name", "_module")

    def __init__(self, name: str) -> None:
        self._name = name
        self._module: Any = None

    def _load(self) -> Any:
        if self._module is None:
            try:
                self._module = importlib.import_module(self._name)
            except ImportError as error:  # pragma: no cover - platform dependent
                raise Refusal(
                    f"That action needs Windows: {self._name} is not available on this system.",
                    "unsupported",
                ) from error
        return self._module

    def __getattr__(self, attribute: str) -> Any:
        return getattr(self._load(), attribute)

    def __repr__(self) -> str:  # pragma: no cover - diagnostics only
        loaded = "loaded" if self._module is not None else "not loaded"
        return f"<lazy {self._name} ({loaded})>"


def is_available() -> bool:
    """True when the Windows bindings can actually be imported here."""
    try:
        importlib.import_module("win32gui")
    except ImportError:
        return False
    return True


win32api = _LazyWindowsModule("win32api")
win32con = _LazyWindowsModule("win32con")
win32gui = _LazyWindowsModule("win32gui")
win32process = _LazyWindowsModule("win32process")
