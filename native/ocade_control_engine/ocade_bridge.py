"""OCADE's door into the Mark-L control engine.

WHAT THIS IS
------------
A headless, newline-delimited-JSON host that exposes this engine's actions to
OCADE Control + Work, speaking the exact protocol OCADE's existing sidecars
already speak: one request per line in, one bounded reply per line out, no
listening socket, no shell.

WHAT IT DELIBERATELY DOES NOT START
------------------------------------
`main.py`, `ui.py` and `dashboard/server.py`. Those bring a PyQt6 desktop
window, a wake-word listener, a voice loop and a FastAPI server — an entire
second application with its own opinions about what the user wants. OCADE
already has a GUI, a permission model and a task loop; it needs this engine's
HANDS, not its face. So the action modules are imported directly and nothing
else is.

THE TWO PROBLEMS THIS SOLVES, WHICH ARE THE REASON IT IS NOT A THIN SHIM
-------------------------------------------------------------------------
1. **Mark-L actions return prose.** Every action here answers with a sentence
   like "Typed 'hello'." — which is a CLAIM, not a reading. OCADE's rule is
   that nothing is reported as done unless it was independently observed
   afterwards. So every mutating command below performs the action through the
   engine and then verifies it through a SEPARATE path — UI Automation, Win32,
   or the filesystem — and reports `verified` from that, never from the string.

2. **The engine reaches for PyAutoGUI first.** `computer_control._type` drives a
   physical keyboard, which is the blindest tier available: it goes to whatever
   owns focus, and it cannot tell you where the characters landed. This host
   prefers UI Automation and falls back to the engine's physical input only when
   the structured path is genuinely unavailable — the order OCADE requires, and
   the order that makes verification possible at all.

WHAT IS PRESERVED
-----------------
Everything the engine already does well and OCADE had no equivalent of:
application launching across three platforms with name normalisation, real
browser profiles, the file controller's named-folder resolution, desktop
organisation, system settings. Those are called straight through.
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import shutil
import sys
import time
import traceback
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

# The engine's modules import each other as `actions.x` / `core.x`, so its own
# directory has to be importable as the root regardless of where OCADE spawns
# this process from.
ENGINE_ROOT = Path(__file__).resolve().parent
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

PROTOCOL_VERSION = 1
MAX_REQUEST_BYTES = 512 * 1024
MAX_TEXT = 20_000


class Refusal(Exception):
    """A refusal with a reason a person can act on, and a machine-readable code.

    Mirrors `ocade_host.protocol.Refusal` exactly so OCADE's adapters map both
    hosts' failures through one path.
    """

    def __init__(self, message: str, code: str = "unsupported") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


# Credential shapes, refused before they can be typed, spoken or written. Kept
# identical in spirit to the other host: a false positive costs a pause, a false
# negative costs a password.
import re  # noqa: E402  - after the constants it is used with

_PROTECTED = re.compile(
    r"(password|passcode|passphrase|\botp\b|one[- ]time code|verification code|2fa|mfa|"
    r"captcha|cvv|cvc|card number|iban|sort code|routing number|ssn|social security|"
    r"aadhaar|passport number|\bpin\b|recovery code|seed phrase|private key|biometric)",
    re.I,
)
_DIGIT_RUN = re.compile(r"\b\d{4,}\b")


def is_protected_text(text: str) -> bool:
    return bool(_PROTECTED.search(text) or _DIGIT_RUN.search(text))


def clamp(text: str, limit: int = 400) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def need_text(value: Any, field: str, limit: int = MAX_TEXT) -> str:
    """A required string argument, or a refusal. Never an empty default.

    The whole class of "opened a blank search / typed nothing and said it had"
    bugs starts with an absent argument being treated as an empty one.
    """
    if not isinstance(value, str):
        raise Refusal(f"{field} is required.", "unsupported")
    cleaned = value.strip()
    if not cleaned:
        raise Refusal(f"{field} cannot be empty.", "unsupported")
    if len(cleaned) > limit:
        raise Refusal(f"{field} is longer than {limit} characters.", "unsupported")
    return cleaned


# ---------------------------------------------------------------- observation --


def _win32():
    try:
        import win32gui  # noqa: PLC0415

        return win32gui
    except Exception as error:  # noqa: BLE001
        raise Refusal(
            "Windows control support is not installed in this environment.", "unsupported"
        ) from error


def _uia_window(hwnd: int):
    from pywinauto import Desktop  # noqa: PLC0415

    return Desktop(backend="uia").window(handle=hwnd)


# The window OCADE most recently opened or focused. Windows refuses foreground
# changes from a background process, so `GetForegroundWindow()` is frequently
# NOT the window the user just asked for — and typing into the foreground then
# lands text in a stranger's application.
_recent_hwnd: int | None = None


def _remember(hwnd: int | None) -> None:
    global _recent_hwnd
    if isinstance(hwnd, int) and hwnd > 0:
        _recent_hwnd = hwnd


def _target_window(explicit: Any = None) -> int:
    win32gui = _win32()
    if isinstance(explicit, int) and explicit > 0 and win32gui.IsWindow(explicit):
        return explicit
    if isinstance(explicit, str) and explicit.strip():
        wanted = explicit.strip().lower()
        found: list[int] = []

        def visit(hwnd: int, _p) -> bool:
            if win32gui.IsWindowVisible(hwnd) and wanted in win32gui.GetWindowText(hwnd).lower():
                found.append(hwnd)
            return True

        win32gui.EnumWindows(visit, None)
        if not found:
            raise Refusal(f"No open window has {explicit!r} in its title.", "state_changed")
        return found[0]
    if _recent_hwnd and win32gui.IsWindow(_recent_hwnd):
        return _recent_hwnd
    hwnd = win32gui.GetForegroundWindow()
    if not hwnd:
        raise Refusal("There is no window to work with.", "state_changed")
    return hwnd


def _read_editable(hwnd: int) -> str | None:
    """The text in this window's editable control, read independently.

    Returns None when the window exposes nothing readable, and "" when it
    exposes an EMPTY field. Those are different answers: the second is a
    failed write, and collapsing them is how a blank document gets reported
    as written.

    THE SAME TWO BUGS THE WRITE PATH HAD, AND THEY MADE A GOOD WRITE LOOK BAD.
    First-in-the-tree picked WordPad's ribbon widgets, so this returned
    "Calibri" — the font combo — while the document held the essay. And
    `get_value()` alone cannot read a RichEdit at all, because a rich editor
    exposes TextPattern instead. Together they meant `type_text` wrote the text
    correctly, read back the wrong control, found nothing, and reported "the
    text was sent but the field does not contain it. Nothing was typed."
    Verification that reads the wrong thing is worse than no verification.
    """
    try:
        candidates = []
        for element in _uia_window(hwnd).descendants():
            info = element.element_info
            if (info.control_type or "") not in ("Edit", "Document"):
                continue
            if not info.enabled or not info.visible:
                continue
            try:
                rect = info.rectangle
                area = rect.width() * rect.height()
            except Exception:  # noqa: BLE001
                continue
            if area > 0:
                candidates.append((area, element))
        candidates.sort(key=lambda pair: pair[0], reverse=True)
        for _area, element in candidates:
            for reader in (
                lambda e=element: e.get_value(),
                lambda e=element: e.iface_text.DocumentRange.GetText(-1),
            ):
                try:
                    value = reader()
                except Exception:  # noqa: BLE001
                    continue
                if isinstance(value, str):
                    return clamp(value, 4000)
    except Exception:
        return None
    return None


# ------------------------------------------------------------------- commands --


def engine_info(_payload: dict) -> dict:
    """What this engine is and what it can reach. Probed, never asserted."""
    from core import llm_client  # noqa: PLC0415

    url, model = llm_client.get_llm_settings()
    capability: dict[str, Any] = {
        "engine": "ocade_control_engine",
        "protocolVersion": PROTOCOL_VERSION,
        "root": str(ENGINE_ROOT),
        "model": model,
        "llmUrl": url,
    }
    # No `playwright` probe. This engine does not drive a browser — that is the
    # Node host's job — so reporting the package as "unavailable" described a
    # missing dependency that is not missing and not wanted. A capability report
    # should only name capabilities this engine actually claims.
    for name, probe in (
        ("uia", lambda: bool(_uia_window(_win32().GetForegroundWindow()))),
        ("win32", lambda: bool(_win32())),
        ("pyautogui", lambda: __import__("pyautogui").position() is not None),
    ):
        try:
            capability[name] = bool(probe())
        except Exception as error:  # noqa: BLE001
            capability[name] = f"unavailable: {type(error).__name__}"
    return capability


def _force_foreground(hwnd: int) -> bool:
    """Bring a window to the front. The implementation lives in `core.uia`.

    MOVED, AND THE NAME IS KEPT HERE ON PURPOSE. Roughly a dozen handlers below
    call `_force_foreground`, and `core/skills/whatsapp.py` used to reach up and
    call this one — `import ocade_bridge` from inside a skill, which is a cycle
    that only worked because the bridge puts its own directory on `sys.path`.

    Focus is a window concern, so it now lives in the window layer and both
    callers import it from there. This stays as a one-line alias rather than
    being renamed at a dozen call sites, because those call sites are not what
    was wrong.
    """
    from core.uia import UiaUnavailable, force_foreground  # noqa: PLC0415

    try:
        return force_foreground(hwnd)
    except UiaUnavailable as error:
        raise Refusal(str(error), "unsupported") from error


_SHELL_FOLDERS = {
    "Downloads", "Personal", "Desktop", "My Pictures", "My Video", "My Music",
    "RecycleBinFolder", "MyComputerFolder", "UsersFilesFolder",
}


def folder_open(payload: dict) -> dict:
    """Open a Windows shell folder in File Explorer.

    A CLOSED SET, NOT A PATH. The argument is a canonical shell-folder name
    from a fixed list, never a path the model composed — so there is no
    spelling of this that reaches an arbitrary directory, and no string a
    caller can smuggle a command through.

    This exists because "open downloads folder" used to reach `app_open`,
    which looked for an installed PROGRAM by that name, found none, and let
    the fallback search the web. A machine answering a question about its own
    filesystem by opening Bing is the failure this replaces.
    """
    import subprocess  # noqa: PLC0415

    folder = need_text(payload.get("folder"), "folder", 40)
    if folder not in _SHELL_FOLDERS:
        raise Refusal(f"{folder!r} is not a known shell folder.", "unsupported")

    win32gui = _win32()
    before = set()

    def collect(hwnd: int, _p) -> bool:
        if win32gui.IsWindowVisible(hwnd) and win32gui.GetWindowText(hwnd).strip():
            before.add(hwnd)
        return True

    win32gui.EnumWindows(collect, None)
    subprocess.Popen(  # noqa: S603
        ["explorer.exe", f"shell:{folder}"],
        creationflags=getattr(subprocess, "DETACHED_PROCESS", 0),
        close_fds=True,
    )

    # Explorer reuses an existing window when one is already showing the
    # folder, so "no NEW window" is not a failure — it is verified by a window
    # being in front that was not before, or by one already being there.
    deadline = time.monotonic() + 8.0
    appeared = None
    while time.monotonic() < deadline and appeared is None:
        current = []

        def sweep(hwnd: int, _p) -> bool:
            if hwnd in before or not win32gui.IsWindowVisible(hwnd):
                return True
            title = win32gui.GetWindowText(hwnd).strip()
            if title:
                current.append((hwnd, title))
            return True

        win32gui.EnumWindows(sweep, None)
        appeared = current[0][0] if current else None
        if appeared is None:
            time.sleep(0.15)

    foregrounded = None
    if appeared is not None:
        _remember(appeared)
        try:
            foregrounded = _force_foreground(appeared)
        except Exception:  # noqa: BLE001
            foregrounded = False

    return {
        "folder": folder,
        "hwnd": appeared,
        "title": clamp(win32gui.GetWindowText(appeared), 256) if appeared else "",
        "foregrounded": foregrounded,
        "verified": appeared is not None,
        "detail": (
            f"Opened {folder} in File Explorer."
            if appeared is not None
            else f"Asked Explorer for {folder}; no new window appeared (it may already be open)."
        ),
    }


def web_search(payload: dict) -> dict:
    """Answer from the live web, or say plainly that there is no web.

    Runs a reachability probe before the search so an offline machine gets a
    structured refusal carrying the caveat the model must append, rather than a
    confident answer about today built from months-old weights.
    """
    from actions.web_search import search  # noqa: PLC0415

    return search(
        need_text(payload.get("query"), "query", 400),
        max_results=int(payload.get("maxResults") or 3),
    )


def web_search_fast(payload: dict) -> dict:
    """The same question, put to every engine at once.

    `web.search` asks Brave, then Bing, then DuckDuckGo, paying each failure in
    full before trying the next. This asks all three together and returns the
    first answer good enough to use, so a search costs the latency of the
    fastest engine rather than the sum of the slow ones.
    """
    from actions.parallel_search import parallel_search  # noqa: PLC0415

    return parallel_search(
        need_text(payload.get("query"), "query", 400),
        max_results=int(payload.get("maxResults") or 5),
    )


def folder_item_open(payload: dict) -> dict:
    """Open a folder or file INSIDE an already-open File Explorer window.

    The second half of "open downloads folder and open the folder named mummy",
    which previously reached the model and stopped there — a model cannot click
    a row in a list it cannot see.
    """
    from core.skills.explorer import SKILL as explorer  # noqa: PLC0415

    window = payload.get("windowTitle") or payload.get("hwnd")
    try:
        hwnd = _target_window(window) if window else _target_window(None)
    except Refusal:
        hwnd = None
    if hwnd is None:
        raise Refusal("File Explorer is not open, so there is nothing to open inside it.", "state_changed")
    try:
        result = explorer.open_item(hwnd, need_text(payload.get("item"), "item", 200))
    except ValueError as error:
        raise Refusal(str(error), "unsupported") from error
    _remember(hwnd)
    return result


# ---------------------------------------------------------------------------
# Continuity: what OCADE still knows tomorrow, and when it speaks first.
# ---------------------------------------------------------------------------


def search_modes(payload: dict) -> dict:
    """news / research / price / compare / search, each shaped for its question."""
    from actions.knowledge import search_mode  # noqa: PLC0415

    return search_mode(
        need_text(payload.get("query"), "query", 400),
        str(payload.get("mode") or "search"),
        max_results=int(payload.get("maxResults") or 5),
    )


def flight_find(payload: dict) -> dict:
    from actions.knowledge import flights  # noqa: PLC0415

    return flights(
        need_text(payload.get("from"), "from", 120),
        need_text(payload.get("to"), "to", 120),
        str(payload.get("when") or ""),
    )


def file_read(payload: dict) -> dict:
    from actions.knowledge import read_file  # noqa: PLC0415

    try:
        return read_file(
            need_text(payload.get("folder"), "folder", 40),
            need_text(payload.get("name"), "name", 260),
        )
    except ValueError as error:
        raise Refusal(str(error), "blocked") from error


def file_list(payload: dict) -> dict:
    from actions.knowledge import list_files  # noqa: PLC0415

    try:
        return list_files(
            need_text(payload.get("folder"), "folder", 40), str(payload.get("pattern") or "*")
        )
    except ValueError as error:
        raise Refusal(str(error), "blocked") from error


def system_brightness_set(payload: dict) -> dict:
    from core.os_control import OsRefused, brightness  # noqa: PLC0415

    level = payload.get("level")
    try:
        return brightness(int(level) if isinstance(level, (int, float)) else None)
    except OsRefused as error:
        raise Refusal(str(error), "unsupported") from error


def system_wifi(payload: dict) -> dict:
    from core.os_control import OsRefused, wifi  # noqa: PLC0415

    try:
        return wifi(str(payload.get("action") or "status"))
    except OsRefused as error:
        raise Refusal(str(error), "blocked") from error


def system_power(payload: dict) -> dict:
    from core.os_control import OsRefused, power  # noqa: PLC0415

    try:
        return power(
            need_text(payload.get("action"), "action", 20),
            confirmed=payload.get("confirmed") is True,
        )
    except OsRefused as error:
        raise Refusal(str(error), "blocked") from error


def system_autostart(payload: dict) -> dict:
    from core.os_control import OsRefused, autostart  # noqa: PLC0415

    enable = payload.get("enable")
    try:
        return autostart(enable if isinstance(enable, bool) else None)
    except OsRefused as error:
        raise Refusal(str(error), "unsupported") from error


def clipboard_read(payload: dict) -> dict:
    from core.os_control import OsRefused, clipboard  # noqa: PLC0415

    try:
        text = payload.get("text")
        return clipboard(str(text) if isinstance(text, str) and text else None)
    except OsRefused as error:
        raise Refusal(str(error), "unsupported") from error


def clipboard_watch(payload: dict) -> dict:
    """Has anything new been copied? The poll the floating panel runs on.

    Cheap enough to call every second: it hashes the clipboard and compares.
    The first call after the engine starts always answers "no", so the panel
    cannot fly open at launch showing something copied an hour ago.
    """
    from core.os_control import OsRefused, clipboard_changed  # noqa: PLC0415

    minimum = payload.get("minCharacters")
    try:
        return clipboard_changed(
            min_characters=int(minimum) if isinstance(minimum, (int, float)) else 3
        )
    except OsRefused as error:
        raise Refusal(str(error), "unsupported") from error


#: What the floating clipboard panel offers, and the instruction each one gives
#: the model. Kept as data rather than as four handlers because they differ only
#: in one sentence, and four near-identical handlers is four places to fix a bug.
_CLIPBOARD_JOBS: dict[str, tuple[str, str]] = {
    "translate": (
        "You are a translator. Reply with the translation and nothing else — no "
        "preamble, no explanation, no quotes around it.",
        "Translate this into {language}:",
    ),
    "summarise": (
        "You summarise. Reply with the summary and nothing else. Keep it much "
        "shorter than the original and keep every fact that matters.",
        "Summarise this:",
    ),
    "explain": (
        "You explain things plainly, to somebody who is smart but does not know "
        "this subject. No jargon unless you define it. Reply with the explanation only.",
        "Explain this:",
    ),
    "fix": (
        "You correct text. Fix spelling, grammar and punctuation, and leave the "
        "meaning, the voice and the formatting alone. Reply with the corrected "
        "text and nothing else — no notes about what you changed.",
        "Correct this:",
    ),
}


def clipboard_act(payload: dict) -> dict:
    """Translate, summarise, explain or fix what is on the clipboard.

    THE FOUR BUTTONS ON THE FLOATING PANEL, ANSWERED ON THIS MACHINE.
    ------------------------------------------------------------------
    `core/os_control.clipboard()` could already fetch the text and
    `core/llm_client.call_llm_text()` could already reason about it, and nothing
    joined them — so the panel had four buttons and no engine behind any of
    them. This is the join.

    The text is taken from the clipboard HERE rather than accepted as an
    argument, so the thing acted on is provably the thing the user copied and
    not something a caller composed. `text` is still accepted for the case where
    the interface already has the content in hand and re-reading the clipboard
    would race with the user copying something else.
    """
    from core.llm_client import call_llm_text  # noqa: PLC0415
    from core.os_control import OsRefused, clipboard  # noqa: PLC0415

    action = need_text(payload.get("action"), "action", 20).lower()
    if action not in _CLIPBOARD_JOBS:
        raise Refusal(
            f"{action!r} is not something OCADE does to copied text. "
            f"Use one of: {', '.join(_CLIPBOARD_JOBS)}.",
            "unsupported",
        )

    supplied = payload.get("text")
    if isinstance(supplied, str) and supplied.strip():
        content = supplied
    else:
        try:
            content = str(clipboard().get("text") or "")
        except OsRefused as error:
            raise Refusal(str(error), "unsupported") from error

    content = content.strip()
    if not content:
        raise Refusal("There is nothing on the clipboard to work with.", "state_changed")
    if is_protected_text(content):
        # A password on the clipboard is a real and common thing — it is what a
        # password manager's copy button puts there. Sending it to a model, even
        # a local one, writes it into a context window and a log.
        raise Refusal(
            "That looks like a password or a code. OCADE will not send it anywhere, "
            "including to its own model.",
            "refused",
        )

    system, instruction = _CLIPBOARD_JOBS[action]
    if action == "translate":
        # The user's remembered language, so "translate" needs no argument on
        # the panel — which is the whole point of a one-click panel.
        from core import memory  # noqa: PLC0415

        language = (
            need_text(payload.get("language"), "language", 40)
            if isinstance(payload.get("language"), str) and payload.get("language")
            else (memory.identity().get("language") or "English")
        )
        instruction = instruction.format(language=language)
    else:
        language = ""

    trimmed = content[:8_000]
    try:
        answer = call_llm_text(
            f"{instruction}\n\n{trimmed}",
            system=system,
            timeout=int(payload.get("timeout") or 90),
        )
    except Exception as error:  # noqa: BLE001
        raise Refusal(
            f"The local model could not be reached ({type(error).__name__}). "
            "Check that Ollama is running.",
            "retryable_failure",
        ) from error

    answer = (answer or "").strip()
    return {
        "action": action,
        **({"language": language} if language else {}),
        "input": clamp(trimmed, 400),
        "characters": len(content),
        "truncated": len(content) > len(trimmed),
        "result": answer,
        # Verified means the model ANSWERED. Whether the translation is good is
        # not something this layer can know, and the user is looking at both.
        "verified": bool(answer),
        "detail": answer[:600] if answer else "The model returned nothing.",
    }


def llm_status(payload: dict) -> dict:
    """Is the local model actually reachable, and is it loaded?

    THE THREE ANSWERS THAT LOOK THE SAME FROM OUTSIDE. "Ollama is not running",
    "Ollama is running but the model was never pulled", and "everything is fine
    but the first token takes nine seconds because nothing is warm" all present
    to the user as OCADE being broken. They are separated here so the interface
    can say which one it is, and `warm` fixes the third.
    """
    from core import llm_client  # noqa: PLC0415

    url, model = llm_client.get_llm_settings()
    reachable = False
    try:
        reachable = bool(llm_client.ensure_ollama_running(timeout=int(payload.get("timeout") or 10)))
    except Exception:  # noqa: BLE001, S110
        reachable = False

    pulled = None
    if reachable:
        try:
            pulled = bool(llm_client.check_model_available())
        except Exception:  # noqa: BLE001
            pulled = None

    warmed = None
    if payload.get("warm") is True and reachable and pulled is not False:
        try:
            warmed = bool(llm_client.warmup_model())
        except Exception:  # noqa: BLE001
            warmed = False

    return {
        "url": url,
        "model": model,
        "provider": llm_client.get_llm_provider(),
        "reachable": reachable,
        "modelPulled": pulled,
        "warmed": warmed,
        "verified": reachable and pulled is not False,
        "detail": (
            f"{model} is ready at {url}."
            if reachable and pulled is not False
            else f"{model} is not pulled — run `ollama pull {model}`."
            if reachable
            else f"Nothing is answering at {url}. Start Ollama and try again."
        ),
    }


def net_status(_payload: dict) -> dict:
    """Is there a working route off this machine right now?

    A socket to a DNS resolver, not an HTTP request — see `actions/web_search`.
    Exposed so the interface can say "you are offline" before a search spends
    six seconds discovering it, rather than after.
    """
    from actions.web_search import OFFLINE_NOTE, is_online  # noqa: PLC0415

    online = is_online()
    return {
        "online": online,
        "note": "" if online else OFFLINE_NOTE,
        "verified": True,
        "detail": "The network is reachable." if online else "There is no network route.",
    }


# ---------------------------------------------------------------- seeing --


def vision_look(payload: dict) -> dict:
    """Capture the screen or the webcam and read it aloud in words."""
    from core.vision import VisionUnavailable, look  # noqa: PLC0415

    source = str(payload.get("source") or "screen").strip().lower()
    window = payload.get("windowTitle") or payload.get("hwnd")
    hwnd = None
    if source == "screen" and window:
        try:
            hwnd = _target_window(window)
        except Refusal:
            hwnd = None

    device = payload.get("device")
    try:
        return look(
            source=source,
            hwnd=hwnd,
            device=int(device) if isinstance(device, (int, float)) else 0,
            question=str(payload.get("question") or ""),
        )
    except VisionUnavailable as error:
        raise Refusal(str(error), "unsupported") from error


def vision_cameras(_payload: dict) -> dict:
    from core.vision import VisionUnavailable, cameras  # noqa: PLC0415

    try:
        return cameras()
    except VisionUnavailable as error:
        raise Refusal(str(error), "unsupported") from error


# ----------------------------------------------------------------- games --


def game_list(payload: dict) -> dict:
    from actions.game_updater import GameRefused, installed  # noqa: PLC0415

    try:
        return installed(str(payload.get("launcher") or ""))
    except GameRefused as error:
        raise Refusal(str(error), "unsupported") from error


def game_update(payload: dict) -> dict:
    from actions.game_updater import GameRefused, update  # noqa: PLC0415

    try:
        return update(str(payload.get("game") or ""), str(payload.get("launcher") or ""))
    except GameRefused as error:
        raise Refusal(str(error), "state_changed") from error


# ------------------------------------------------------------------ code --


def code_review(payload: dict) -> dict:
    """Parse a piece of source and report findings with real line numbers."""
    from actions.code_helper import CodeRefused, review, review_file  # noqa: PLC0415

    try:
        folder = payload.get("folder")
        name = payload.get("name")
        if isinstance(folder, str) and folder.strip():
            return review_file(folder.strip(), need_text(name, "name", 260))
        return review(
            need_text(payload.get("code"), "code", 200_000),
            name=str(name or ""),
            language=str(payload.get("language") or ""),
        )
    except CodeRefused as error:
        raise Refusal(str(error), "unsupported") from error


# ------------------------------------------------------- the phone dashboard


def remote_ask(payload: dict) -> dict:
    """One sentence from the phone, routed and run on this machine.

    Deterministic first, a search second, a refusal last — the same order every
    other surface uses, expressed in the bridge's own command vocabulary
    because the phone never passes through Node.
    """
    from core import phone_intents  # noqa: PLC0415

    said = need_text(payload.get("text"), "text", 600)
    routed = phone_intents.route(said) or phone_intents.fallback(said)
    if routed is None:
        return {
            "routed": False,
            "verified": True,
            "detail": (
                f"OCADE did not understand “{clamp(said, 80)}” well enough to act on it "
                "from a phone. Try 'volume 40', 'briefing', 'remind me to X in 20 minutes', "
                "or ask a question."
            ),
        }

    command, arguments, doing = routed
    handler = HANDLERS.get(command)
    if handler is None:
        raise Refusal(f"{command} is not available on this machine.", "unsupported")

    result = handler(arguments)
    # `doing` is what the phone shows immediately; `detail` is what actually
    # happened. Both travel, because a phone that only ever echoes its own
    # optimism is a phone that lies.
    return {"routed": True, "command": command, "doing": doing, **result}


def remote_start(_payload: dict) -> dict:
    """Open the phone dashboard and return the pairing QR."""
    from core import remote  # noqa: PLC0415

    def dispatch(command: str, arguments: dict) -> dict:
        # Routed through `handle` rather than straight to the handler, so a
        # phone command passes the stop check, the redirect of the engine's
        # stdout, and the same error shaping as every other caller.
        return handle({"version": PROTOCOL_VERSION, "command": command, "payload": arguments})

    try:
        return remote.start(dispatch)
    except remote.RemoteRefused as error:
        raise Refusal(str(error), "blocked") from error


def remote_stop(_payload: dict) -> dict:
    from core import remote  # noqa: PLC0415

    return remote.stop()


def remote_status(_payload: dict) -> dict:
    from core import remote  # noqa: PLC0415

    return remote.status()


def language_learn(payload: dict) -> dict:
    from core.os_control import language  # noqa: PLC0415

    return language(str(payload.get("detected") or ""))


def setup_status(_payload: dict) -> dict:
    """Does OCADE still need to ask who it is talking to?

    Two questions, asked once, at the very start: what to call the user, and
    whether to address them as Sir or Mam. Getting the second wrong is a small
    error repeated in every sentence, which makes it a large one.
    """
    from core import memory  # noqa: PLC0415

    return memory.needs_setup()


def memory_remember(payload: dict) -> dict:
    from core import memory  # noqa: PLC0415

    try:
        return memory.remember(
            need_text(payload.get("fact"), "fact", 600), tag=str(payload.get("tag") or "")
        )
    except memory.MemoryRefused as error:
        raise Refusal(str(error), "refused") from error


def memory_recall(payload: dict) -> dict:
    from core import memory  # noqa: PLC0415

    rows = memory.recall(str(payload.get("query") or ""), limit=int(payload.get("limit") or 10))
    return {
        "facts": rows,
        "count": len(rows),
        "verified": True,
        "detail": f"{len(rows)} thing(s) remembered." if rows else "Nothing remembered about that.",
    }


def memory_forget(payload: dict) -> dict:
    from core import memory  # noqa: PLC0415

    try:
        return memory.forget(need_text(payload.get("query"), "query", 200))
    except memory.MemoryRefused as error:
        raise Refusal(str(error), "refused") from error


def memory_project(payload: dict) -> dict:
    from core import memory  # noqa: PLC0415

    try:
        return memory.note_project(
            need_text(payload.get("name"), "name", 120), str(payload.get("note") or "")
        )
    except memory.MemoryRefused as error:
        raise Refusal(str(error), "refused") from error


def memory_identity(payload: dict) -> dict:
    """Read or change who the user is, and what the assistant is called."""
    from core import memory  # noqa: PLC0415

    # `gender` drives the Sir/Mam honorific. `assistantName` renames the
    # assistant and takes effect on the next turn, because every greeting,
    # prompt and log line reads it from the file rather than from a constant.
    allowed = ("userName", "gender", "city", "language", "assistantName")

    # AN EMPTY STRING IS A REAL VALUE FOR EXACTLY ONE FIELD, AND DROPPING IT
    # BROKE THE ONE THING IT MEANS. `assistantName: ""` is "put the name back to
    # the default" — filtered out with the other blanks, a reset silently did
    # nothing and reported "Current settings".
    fields = {
        key: value
        for key, value in payload.items()
        if key in allowed
        and value is not None
        and (value != "" or key == "assistantName")
    }
    if not fields:
        return {
            "identity": memory.identity(),
            "assistantName": memory.assistant_name(),
            "defaultAssistantName": memory.DEFAULT_ASSISTANT_NAME,
            "verified": True,
            "detail": "Current settings.",
        }
    try:
        return memory.set_identity(**fields)
    except memory.MemoryRefused as error:
        raise Refusal(str(error), "refused") from error


def memory_snapshot(_payload: dict) -> dict:
    from core import memory  # noqa: PLC0415

    return memory.snapshot()


def memory_context(payload: dict) -> dict:
    """Everything worth putting in front of the model, as plain sentences.

    THIS IS THE FUNCTION THAT MAKES MEMORY MEAN ANYTHING, AND NOTHING CALLED IT.
    ---------------------------------------------------------------------------
    `core/memory.py` stored the user's name, their honorific, their city, their
    preferences, their projects and their remembered facts — correctly, durably,
    with tests. `context_for_prompt()` assembled all of it into the handful of
    sentences a model needs. And no bridge command exposed it, so no caller ever
    fetched it, so it never reached a prompt.

    The result was an assistant that could be TOLD to remember and could be
    ASKED what it remembered, and never once used any of it unprompted. The user
    says "my name is Alex", OCADE writes it down, and the next sentence it
    speaks is still addressed to nobody. Memory that is only ever read back on
    request is a notebook, not a memory.

    Deliberately short. A 3B model handed two thousand words of history answers
    the history instead of the question, which is why `limit` exists and why it
    defaults low.
    """
    from core import memory  # noqa: PLC0415

    limit = payload.get("limit")
    context = memory.context_for_prompt(
        limit=int(limit) if isinstance(limit, (int, float)) and 0 < limit <= 40 else 12
    )
    return {
        "context": context,
        "lines": len(context.splitlines()) if context else 0,
        "assistantName": memory.assistant_name(),
        "address": memory.address(),
        "language": memory.identity().get("language") or "",
        # Verified means the store was READ. An empty context on a fresh install
        # is a true answer, not a failure, so it stays True.
        "verified": True,
        "detail": (
            f"{len(context.splitlines())} line(s) of context about the user."
            if context
            else "OCADE knows nothing about this user yet."
        ),
    }


def memory_preference(payload: dict) -> dict:
    """Read or set how the user likes things done.

    Separate from facts because they expire differently: a preference is
    permanent and small ("plain answers, no hedging"), a fact is an observation
    that may stop being true. Both were implemented in `core/memory.py`; only
    facts had a command.
    """
    from core import memory  # noqa: PLC0415

    key = payload.get("key")
    value = payload.get("value")
    if isinstance(key, str) and key.strip() and value is not None:
        try:
            return memory.set_preference(key, value)
        except memory.MemoryRefused as error:
            raise Refusal(str(error), "refused") from error

    rows = memory.preferences()
    return {
        "preferences": rows,
        "count": len(rows),
        "verified": True,
        "detail": (
            "; ".join(f"{name}: {said}" for name, said in list(rows.items())[:8])
            if rows
            else "No preferences recorded yet."
        ),
    }


def session_summarise(payload: dict) -> dict:
    from core import memory  # noqa: PLC0415

    topics = payload.get("topics")
    try:
        return memory.summarise_session(
            need_text(payload.get("summary"), "summary", 600),
            topics=[str(t) for t in topics] if isinstance(topics, list) else None,
        )
    except memory.MemoryRefused as error:
        raise Refusal(str(error), "refused") from error


def briefing(payload: dict) -> dict:
    from core import presence  # noqa: PLC0415

    return presence.morning_briefing(with_news=payload.get("news") is not False)


def proactive(payload: dict) -> dict:
    from core import presence  # noqa: PLC0415

    topics = payload.get("recentTopics")
    return presence.proactive_line(
        recent_topics=[str(t) for t in topics] if isinstance(topics, list) else None,
        force=payload.get("force") is True,
    )


def monitor_watch(payload: dict) -> dict:
    from core import memory  # noqa: PLC0415

    try:
        if payload.get("stop") is True:
            return memory.unwatch_topic(need_text(payload.get("topic"), "topic", 120))
        if payload.get("topic"):
            return memory.watch_topic(need_text(payload.get("topic"), "topic", 120))
    except memory.MemoryRefused as error:
        raise Refusal(str(error), "refused") from error
    rows = memory.monitors()
    return {
        "monitors": rows,
        "count": len(rows),
        "verified": True,
        "detail": f"Watching {len(rows)} topic(s).",
    }


def monitor_check(_payload: dict) -> dict:
    from core import presence  # noqa: PLC0415

    return presence.check_monitors()


def weather_report(payload: dict) -> dict:
    from core import presence  # noqa: PLC0415

    return presence.weather(str(payload.get("city") or ""))


def reminder_set(payload: dict) -> dict:
    from core import reminders  # noqa: PLC0415

    try:
        return reminders.schedule(
            need_text(payload.get("message"), "message", 400),
            need_text(payload.get("when"), "when", 60),
        )
    except reminders.ReminderRefused as error:
        raise Refusal(str(error), "refused") from error


def reminder_list(_payload: dict) -> dict:
    from core import reminders  # noqa: PLC0415

    return reminders.pending()


def reminder_cancel(payload: dict) -> dict:
    from core import reminders  # noqa: PLC0415

    try:
        return reminders.cancel(need_text(payload.get("task"), "task", 200))
    except reminders.ReminderRefused as error:
        raise Refusal(str(error), "refused") from error


def whatsapp(payload: dict) -> dict:
    """The WhatsApp skill, reached as one command with an action."""
    from core.skills.whatsapp import SKILL  # noqa: PLC0415

    action = need_text(payload.get("action"), "action", 30).lower()
    try:
        if action in ("open", "launch"):
            return SKILL.launch()
        hwnd = SKILL.window()
        if hwnd is None:
            raise Refusal("WhatsApp is not open. Open it first.", "state_changed")
        if action in ("find", "open_chat"):
            return SKILL.find_contact(hwnd, need_text(payload.get("contact"), "contact", 120))
        if action == "type":
            return SKILL.type_message(hwnd, need_text(payload.get("message"), "message", 4000))
        if action == "send":
            return SKILL.send_typed(hwnd, need_text(payload.get("message"), "message", 4000))
    except (LookupError, ValueError) as error:
        raise Refusal(str(error), "refused") from error
    raise Refusal(f"Unknown WhatsApp action: {action}", "unsupported")


def app_open(payload: dict) -> dict:
    """Open an application through the engine, then confirm a window appeared.

    LAUNCHED FROM A RESOLVED PATH WHEN ONE EXISTS.

    `actions/open_app.py` opens a program by pressing the Windows key, typing
    the name, waiting 2.5 seconds and pressing Enter. Measured live: 2.07 s per
    launch, and on a slow machine the wait expires early and Enter lands on
    whatever the search box had. It also cannot say what it opened, because it
    never knew.

    `core.apps.resolve` turns a name into an actual executable using the App
    Paths registry, Start Menu shortcuts and PATH. When it finds one, the
    program is started directly — no keystrokes, no Start menu, and the receipt
    can name the exe. The old path stays as the fallback for names that resolve
    to nothing (store apps, shell verbs), which is what it was always good at.
    """
    name = need_text(payload.get("name"), "name", 120)
    win32gui = _win32()

    before = set()

    def collect(hwnd: int, _p) -> bool:
        if win32gui.IsWindowVisible(hwnd) and win32gui.GetWindowText(hwnd).strip():
            before.add(hwnd)
        return True

    win32gui.EnumWindows(collect, None)

    launched_from: str | None = None
    try:
        from core.apps import resolve as resolve_app  # noqa: PLC0415

        found = resolve_app(name)
    except Exception:  # noqa: BLE001
        found = {"found": False}

    if found.get("found") and found.get("executable"):
        import subprocess  # noqa: PLC0415

        try:
            # Detached, with no shell: the executable comes from the registry or
            # a shortcut, never from the model, so there is no string for a
            # caller to smuggle arguments through.
            subprocess.Popen(  # noqa: S603
                [found["executable"]],
                creationflags=getattr(subprocess, "DETACHED_PROCESS", 0),
                close_fds=True,
            )
            launched_from = found["executable"]
            said = f"Started {found['name']}."
        except Exception:  # noqa: BLE001
            launched_from = None

    elif found.get("found") and found.get("launch"):
        # A PACKAGED APP HAS NO FILE TO Popen. WhatsApp Desktop is
        # `5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App` — an application
        # user-model ID. `explorer.exe shell:AppsFolder\<AppID>` is the shell
        # verb Windows uses for its own Start-menu tiles, so it activates the
        # package the same way clicking the icon does. The AppID comes from
        # `Get-StartApps`, never from the model.
        import subprocess  # noqa: PLC0415

        try:
            subprocess.Popen(  # noqa: S603
                ["explorer.exe", found["launch"]],
                creationflags=getattr(subprocess, "DETACHED_PROCESS", 0),
                close_fds=True,
            )
            launched_from = found["launch"]
            said = f"Started {found['name']}."
        except Exception:  # noqa: BLE001
            launched_from = None

    if launched_from is None:
        from actions.open_app import open_app as engine_open_app  # noqa: PLC0415

        said = engine_open_app({"app_name": name})

    # A window that was not there before and is there now. Polled briefly rather
    # than waited on: the loop re-observes anyway, and "started, no window yet"
    # is a true answer it can act on.
    deadline = time.monotonic() + 8.0
    appeared: int | None = None
    while time.monotonic() < deadline and appeared is None:
        current: list[tuple[int, str]] = []

        def sweep(hwnd: int, _p) -> bool:
            if hwnd in before:
                return True
            if not win32gui.IsWindowVisible(hwnd):
                return True
            title = win32gui.GetWindowText(hwnd).strip()
            if title:
                current.append((hwnd, title))
            return True

        win32gui.EnumWindows(sweep, None)
        # Prefer a new window whose title mentions what was asked for.
        wanted = name.lower()
        match = next((h for h, t in current if wanted in t.lower()), None)
        appeared = match or (current[0][0] if current else None)
        if appeared is None:
            time.sleep(0.12)

    # BRING IT TO THE FRONT BEFORE ANYTHING IS TYPED.
    #
    # `app_open` used to stop at "a window appeared", and a window that exists
    # is not a window that has focus. The very next step in a compound
    # instruction — "open Notepad and write an essay" — types into whatever the
    # OS considers foreground, which on a busy desktop is frequently the
    # browser the user launched OCADE from. That is not a typo; it is text
    # going into somebody else's application.
    #
    # SetForegroundWindow is refused by Windows unless the calling process owns
    # the foreground or the request follows recent user input, so the failure is
    # expected sometimes and is REPORTED rather than swallowed: `foregrounded`
    # is a fact in the receipt, and a caller that needs focus can see it did not
    # happen instead of discovering it from the wrong window's contents.
    foregrounded = None
    if appeared is not None:
        _remember(appeared)
        try:
            foregrounded = _force_foreground(appeared)
        except Exception:  # noqa: BLE001
            foregrounded = False

    return {
        "application": name,
        "engineSaid": clamp(said, 300),
        "hwnd": appeared,
        "title": clamp(win32gui.GetWindowText(appeared), 256) if appeared else "",
        # Which route ran, so a slow launch can be told apart from a mistyped
        # one without re-running it.
        "launchedFrom": launched_from,
        "method": (
            "app_id"
            if isinstance(launched_from, str) and launched_from.startswith("shell:AppsFolder")
            else "direct_path"
            if launched_from
            else "start_menu"
        ),
        # Whether the window is actually in front. Stated, because typing
        # goes to the foreground and a caller must be able to see this failed.
        "foregrounded": foregrounded,
        # Verified by a window existing that did not exist before — not by the
        # engine's sentence, and not by a process spawning.
        "verified": appeared is not None,
        "detail": (
            f"Opened {name}." + (f" ({launched_from})" if launched_from else "")
            if appeared is not None
            else f"{name} was started but has not put a window on screen yet."
        ),
    }


def app_focus(payload: dict) -> dict:
    """Bring an already-open window forward and confirm it came forward."""
    win32gui = _win32()
    import win32con  # noqa: PLC0415

    hwnd = _target_window(payload.get("title") or payload.get("name"))
    # ONE FOREGROUND ROUTINE, SHARED WITH app_open.
    #
    # This had its own AttachThreadInput dance and it still failed live —
    # "Windows would not move focus to that window" — because attaching alone
    # is not always enough: a keystroke is what actually clears the focus-steal
    # lock, and BringWindowToTop is needed when the target is behind an
    # always-on-top window. `_force_foreground` does all three and reads the
    # result back. Two copies of this logic meant one of them was always the
    # weaker, and it was this one.
    try:
        _force_foreground(hwnd)
    except Exception:  # noqa: BLE001, S110
        pass

    _remember(hwnd)
    actual = win32gui.GetForegroundWindow()
    return {
        "hwnd": hwnd,
        "title": clamp(win32gui.GetWindowText(hwnd), 256),
        "verified": actual == hwnd,
        "detail": (
            "That window is now in front."
            if actual == hwnd
            else "Windows would not move focus to that window. Click it once, then ask again."
        ),
    }


def type_text(payload: dict) -> dict:
    """Type into a window, preferring UI Automation, and read the text back.

    THE LADDER, IN THE ORDER OCADE REQUIRES
    ---------------------------------------
    1. The window's editable control, through its value pattern. No keystrokes,
       so nothing is lost to focus theft and the result is readable.
    2. `pywinauto.type_keys` with the foreground taken.
    3. The engine's own `computer_control` physical typing — last, because it is
       blind.

    Whichever rung ran, the text is read back from a FRESH walk of the window.
    A rung reporting success is not evidence; the field containing the
    characters is.
    """
    text = need_text(payload.get("text"), "text")
    if is_protected_text(text):
        raise Refusal(
            "That looks like a password, code or payment value. OCADE does not type those.",
            "blocked",
        )
    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    method = None

    # THE BIGGEST TEXT SURFACE, NOT THE FIRST ONE IN THE TREE.
    #
    # This took the first Edit or Document `descendants()` yielded. In WordPad
    # that is `Edit 'RichEdit Control'` — a 104x15 field in the ribbon — while
    # the actual page is `Document 'Rich Text Window'` at 665x549 further down.
    # Measured live: a hundred words went into the ribbon widget, the read-back
    # could not find them in the document, and the receipt said "the text was
    # sent but the field does not contain it".
    #
    # Ranking by area picks the writing surface in any editor without knowing
    # which editor it is: the document is always the largest text control in a
    # document application, and a toolbar field never is.
    try:
        candidates = []
        for element in _uia_window(hwnd).descendants():
            info = element.element_info
            if (info.control_type or "") not in ("Edit", "Document"):
                continue
            if not info.enabled or not info.visible:
                continue
            try:
                rect = info.rectangle
                area = rect.width() * rect.height()
            except Exception:  # noqa: BLE001
                continue
            if area <= 0:
                continue
            candidates.append((area, element))
        candidates.sort(key=lambda pair: pair[0], reverse=True)
        for _area, element in candidates:
            try:
                existing = element.get_value() or ""
            except Exception:  # noqa: BLE001
                existing = ""
            try:
                element.set_edit_text(existing + text)
            except Exception:  # noqa: BLE001
                # A RichEdit exposes TextPattern rather than ValuePattern and
                # refuses set_edit_text. Typing into it with the window focused
                # is the supported route, and it is still not a blind
                # pointer action — the element is resolved first.
                element.set_focus()
                element.type_keys(text, with_spaces=True, with_newlines=True)
            method = "uia.value"
            break
    except Exception:
        method = None

    if method is None:
        try:
            _uia_window(hwnd).type_keys(
                text, with_spaces=True, with_newlines=True, set_foreground=True
            )
            method = "uia.type_keys"
        except Exception:
            method = None

    if method is None:
        from actions.computer_control import computer_control  # noqa: PLC0415

        computer_control({"action": "type", "text": text})
        method = "engine.computer_control"

    time.sleep(0.2)
    readback = _read_editable(hwnd)
    landed = readback is not None and text.strip()[:60] in readback

    # WHICH RUNG RAN, AS A BOOLEAN RATHER THAN AS A METHOD NAME.
    #
    # Only the engine's `computer_control` rung drives the physical mouse and
    # keyboard; the value pattern writes through the accessibility API and
    # `type_keys` synthesises keystrokes into a specific window. The receipt
    # said `method: "uia.value"` and left the reader to know which of the three
    # implied a pointer. It says so directly now, so "pyautogui is a last
    # resort" is a claim a test can check rather than a sentence in a comment.
    pointer_used = method == "engine.computer_control"

    if readback is not None and not landed:
        return {
            "hwnd": hwnd,
            "typed": 0,
            "method": method,
            "pointerUsed": pointer_used,
            "readback": clamp(readback, 200),
            "verified": False,
            "detail": (
                "The text was sent but the field does not contain it. Nothing was typed."
            ),
        }

    return {
        "hwnd": hwnd,
        "typed": len(text),
        "method": method,
        "pointerUsed": pointer_used,
        "readback": clamp(readback or "", 200),
        "verified": True if landed else None,
        "detail": (
            f"Typed {len(text)} characters and read them back from the field."
            + ("" if pointer_used else " The pointer was not moved.")
            if landed
            else f"Typed {len(text)} characters. This window exposes no readable text, "
            "so it could not be confirmed."
        ),
    }


def read_window(payload: dict) -> dict:
    """What is actually in front, as structure rather than a claim."""
    win32gui = _win32()
    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    elements: list[dict[str, Any]] = []
    try:
        for element in _uia_window(hwnd).descendants():
            info = element.element_info
            rect = info.rectangle
            if rect.width() <= 4 or rect.height() <= 4:
                continue
            name = clamp(info.name or "", 160)
            elements.append(
                {
                    "role": info.control_type or "Unknown",
                    "name": "«protected»" if is_protected_text(name) else name,
                    "enabled": bool(info.enabled),
                }
            )
            if len(elements) >= 120:
                break
    except Exception:
        pass
    return {
        "hwnd": hwnd,
        "title": clamp(win32gui.GetWindowText(hwnd), 256),
        "bounds": {"x": left, "y": top, "width": right - left, "height": bottom - top},
        "elements": elements,
        "count": len(elements),
        "text": clamp(_read_editable(hwnd) or "", 4000),
        "detail": f"Read {clamp(win32gui.GetWindowText(hwnd), 80)}: {len(elements)} elements.",
    }


def window_list(_payload: dict) -> dict:
    win32gui = _win32()
    rows: list[dict[str, Any]] = []

    def visit(hwnd: int, _p) -> bool:
        if not win32gui.IsWindowVisible(hwnd):
            return True
        title = win32gui.GetWindowText(hwnd).strip()
        if not title:
            return True
        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        if right - left < 40 or bottom - top < 40:
            return True
        rows.append({"hwnd": hwnd, "title": clamp(title, 200)})
        return True

    win32gui.EnumWindows(visit, None)
    return {"windows": rows[:60], "count": len(rows), "detail": f"{len(rows)} windows are open."}


# ---------------------------------------------------------------------------
# THERE IS NO BROWSER HANDLER HERE ANY MORE, AND THAT IS DELIBERATE.
#
# `actions/browser_control.py` was a second, complete Playwright stack living
# beside the Node managed-browser host — 1,059 lines of vendored code driving
# the user's real profile directly. It had no approval gate, no protected-field
# guard, no CAPTCHA detection and no origin allowlist, so every safety control
# the Node host implements could be bypassed by routing a browser action
# through this bridge instead.
#
# It was only ever failing closed by accident: `playwright` was declared in
# requirements.txt but never installed into the resolved venv, so `engine.info`
# reported `playwright: unavailable: ModuleNotFoundError` and any call raised on
# import. Installing the dependency for any other reason would have silently
# armed it. That is not a state to leave a security boundary in.
#
# Browser work goes to `native/browser-host/index.mjs`, through the
# `browser_*` tools. One browser path, one set of guards.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# The user's own files
# ---------------------------------------------------------------------------
#
# WHY A CLOSED SET OF FOLDER NAMES, AND NOT A PATH
#
# `file_controller` refuses anything outside the home directory, which is a
# real boundary but a wide one: it puts .ssh, browser profiles, saved tokens
# and every other application's private state inside OCADE's reach the moment
# a model produces a plausible-looking path.
#
# So the tools do not take a path. They take a FOLDER NAME out of the six
# below, and a name relative to it. There is no spelling of `..`, no absolute
# path and no home directory that reaches anything else. This is the same
# shape as the keyboard vocabulary and the window layouts — the argument is
# picked from a list rather than parsed, which is what makes it checkable.
#
# `home` is deliberately NOT in the set. It is the whole boundary again under
# a friendlier name.

_FILE_FOLDERS = ("desktop", "downloads", "documents", "pictures", "music", "videos")

# Where a trashed file's paperwork lives. Not in the workspace: the workspace
# is a scratch folder the user may empty, and losing the ledger would turn a
# reversible operation into an irreversible one.
_TRASH_LEDGER = Path.home() / ".ocade" / "trash-ledger.json"


def _file_base(folder: Any) -> Path:
    from actions import file_controller as fc  # noqa: PLC0415

    name = need_text(folder, "folder", 40).strip().lower()
    if name not in _FILE_FOLDERS:
        raise Refusal(
            f"OCADE works in {', '.join(_FILE_FOLDERS)} — not '{name}'.",
            "unsupported",
        )
    base = fc._resolve_path(name)  # noqa: SLF001 - the engine's own resolver
    if not base.is_dir():
        raise Refusal(f"This computer has no {name} folder.", "state_changed")
    return base.resolve()


def _file_path(folder: Any, raw: Any, field: str = "path") -> Path:
    base = _file_base(folder)
    rel = need_text(raw, field, 400).replace("\\", "/")
    if rel.startswith("/") or (len(rel) > 1 and rel[1] == ":"):
        raise Refusal("OCADE takes a name inside the folder, not an absolute path.", "blocked")
    candidate = (base / rel).resolve()
    try:
        candidate.relative_to(base)
    except ValueError:
        raise Refusal(
            f"That path leaves the {folder} folder, so it was refused.", "blocked"
        ) from None
    return candidate


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(131_072), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_ledger() -> list[dict[str, Any]]:
    try:
        rows = json.loads(_TRASH_LEDGER.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    # A hand-edited or truncated ledger must not take the file tools down with
    # it: the worst case is a restore that cannot find its row, which already
    # has an honest refusal.
    return [row for row in rows if isinstance(row, dict)] if isinstance(rows, list) else []


def _write_ledger(rows: list[dict[str, Any]]) -> None:
    _TRASH_LEDGER.parent.mkdir(parents=True, exist_ok=True)
    _TRASH_LEDGER.write_text(json.dumps(rows[-500:], indent=1), encoding="utf-8")


#: Formats whose bytes are not their text. Read with `read_text` these produce
#: convincing-looking rubbish rather than an error, which is why they are named
#: here rather than left to a try/except.
_DOCUMENT_SUFFIXES = frozenset({".pdf", ".docx", ".xlsx", ".xls", ".csv"})


def files(payload: dict) -> dict:
    """Search, read, copy, move and trash the user's own files.

    Every mutation is confirmed against the filesystem afterwards, and every
    one that destroys information is reversible: nothing here deletes.
    """
    from actions import file_controller as fc  # noqa: PLC0415

    action = need_text(payload.get("action"), "action", 40).strip().lower()

    # ---- read-only ------------------------------------------------------
    if action == "list":
        folder = need_text(payload.get("folder") or payload.get("path"), "folder", 40)
        _file_base(folder)
        return {
            "action": action,
            "listing": clamp(fc.list_files(folder.strip().lower()), 4000),
            "verified": True,
        }

    if action == "search":
        base = _file_base(payload.get("folder"))
        match = need_text(payload.get("match"), "match", 120).lower()
        rows = [
            {
                "name": p.relative_to(base).as_posix(),
                "bytes": p.stat().st_size,
                "modified": datetime.fromtimestamp(p.stat().st_mtime).isoformat(timespec="seconds"),
            }
            for p in sorted(base.rglob("*"))
            if p.is_file() and match in p.name.lower()
        ]
        return {
            "action": action,
            "files": rows[:200],
            "count": len(rows),
            "verified": True,
            "detail": f"{len(rows)} file{'' if len(rows) == 1 else 's'} matching '{match}'.",
        }

    # ---- the rest of the file controller --------------------------------
    #
    # TWELVE OF THIS MODULE'S FIFTEEN FUNCTIONS WERE UNREACHABLE. `files()`
    # reimplemented copy, move and trash itself — correctly, with verification
    # the module lacked — and simply never wired the other twelve to anything.
    # So "how much disk space is left", "what are my biggest downloads" and
    # "tidy my desktop" had working implementations that no command, no tool and
    # no router rule could call.
    #
    # These are the read-only ones plus `organise`. The mutating file operations
    # deliberately stay on the implementations above: those verify against the
    # filesystem afterwards and these return prose, and having two ways to move
    # a file with different guarantees is worse than having one.

    if action == "disk":
        usage = fc.get_disk_usage(str(payload.get("folder") or "home"))
        return {
            "action": action,
            "report": clamp(usage, 1000),
            "verified": not usage.lower().startswith("could not"),
            "detail": clamp(usage, 400),
        }

    if action == "largest":
        count = payload.get("count")
        report = fc.get_largest_files(
            str(payload.get("folder") or "downloads"),
            int(count) if isinstance(count, (int, float)) else 10,
        )
        return {
            "action": action,
            "report": clamp(report, 4000),
            "verified": not report.lower().startswith(("error", "access denied", "path not found")),
            "detail": clamp(report, 400),
        }

    if action == "find":
        # Either a name fragment or an extension, and at least one of them —
        # an unqualified rglob over the home directory walks the whole disk.
        name = str(payload.get("match") or payload.get("name") or "").strip()
        extension = str(payload.get("extension") or "").strip()
        if not name and not extension:
            raise Refusal("A search needs a name fragment or a file extension.", "unsupported")
        report = fc.find_files(
            name, extension, str(payload.get("folder") or "home"), max_results=40
        )
        return {
            "action": action,
            "report": clamp(report, 4000),
            "verified": not report.lower().startswith(("search error", "access denied")),
            "detail": clamp(report, 400),
        }

    if action == "info":
        report = fc.get_file_info(
            str(payload.get("folder") or "desktop"), str(payload.get("path") or "")
        )
        return {
            "action": action,
            "report": clamp(report, 2000),
            "verified": not report.lower().startswith(("access denied", "not found", "error")),
            "detail": clamp(report, 400),
        }

    if action == "newfolder":
        base = _file_base(payload.get("folder"))
        name = need_text(payload.get("name"), "name", 120)
        target = _file_path(payload.get("folder"), name, "name")
        report = fc.create_folder(str(base), name)
        return {
            "action": action,
            "folder": str(target),
            "report": clamp(report, 400),
            # Verified against the FILESYSTEM, not against the sentence the
            # module returned. `create_folder` reports success on a path it
            # could not write to under several conditions.
            "verified": target.is_dir(),
            "detail": f"Created {target.name}." if target.is_dir() else clamp(report, 300),
        }

    if action == "organise":
        # WHAT MAKES THIS SAFE TO RUN ON SOMEBODY'S DESKTOP: it only ever MOVES
        # a file into a subfolder of the same desktop, it never overwrites (a
        # name collision is skipped and reported), and it never touches folders
        # or hidden files. Every move is reversible by dragging it back.
        desktop = _file_base("desktop")
        before = sum(1 for item in desktop.iterdir() if item.is_file())
        report = fc.organize_desktop()
        after = sum(1 for item in desktop.iterdir() if item.is_file())
        moved = max(0, before - after)
        return {
            "action": action,
            "report": clamp(report, 3000),
            "looseFilesBefore": before,
            "looseFilesAfter": after,
            "moved": moved,
            # Counted from the desktop itself before and after, rather than read
            # out of the module's own summary line.
            "verified": after <= before and not report.lower().startswith("could not"),
            "detail": (
                f"Tidied the desktop: {moved} loose file(s) moved into folders, {after} left."
                if moved
                else "Nothing needed moving — the desktop has no loose files to file away."
            ),
        }

    if action == "read":
        path = _file_path(payload.get("folder"), payload.get("path"))
        if not path.is_file():
            raise Refusal(f"There is no file called {path.name}.", "state_changed")

        # A PDF READ AS TEXT IS NOT A READ, AND IT REPORTED SUCCESS.
        #
        # This branch used to call `read_text` on whatever it was given. On a
        # .txt that is correct; on a .pdf, a .docx or an .xlsx it returns the
        # container's bytes decoded as UTF-8 with replacement characters —
        # several kilobytes of mojibake — and then said `verified: True`. The
        # model dutifully "summarised" the noise, so "summarise this PDF"
        # produced a confident paragraph about nothing.
        #
        # `actions.knowledge.read_file` already had the real extractors —
        # pdfplumber, python-docx, pandas — and nothing was wired to it. So the
        # document formats go there and the receipt names the extractor that
        # actually produced the text.
        if path.suffix.lower() in _DOCUMENT_SUFFIXES:
            from actions.knowledge import read_file  # noqa: PLC0415

            extracted = read_file(
                str(payload.get("folder") or "").strip().lower(),
                str(payload.get("path") or "").strip(),
            )
            return {
                "action": action,
                "name": path.name,
                "content": extracted.get("text", ""),
                "how": extracted.get("how", ""),
                "characters": extracted.get("characters", 0),
                "truncated": extracted.get("truncated", False),
                # Carried through rather than overwritten: an image-only scan
                # extracts nothing, and that is a real answer the caller has to
                # be able to see.
                "verified": extracted.get("verified", False),
                "detail": extracted.get("detail", f"Read {path.name}."),
            }

        if path.stat().st_size > 4_000_000:
            raise Refusal(
                f"{path.name} is {path.stat().st_size // 1_000_000} MB — too large to read as text.",
                "unsupported",
            )
        return {
            "action": action,
            "name": path.name,
            "content": clamp(path.read_text(encoding="utf-8", errors="replace"), 20_000),
            "how": "plain text",
            "verified": True,
            "detail": f"Read {path.name}.",
        }

    # ---- mutations ------------------------------------------------------
    if action == "copy":
        source = _file_path(payload.get("folder"), payload.get("from"), "from")
        target = _file_path(payload.get("folder"), payload.get("to"), "to")
        if not source.is_file():
            raise Refusal(f"There is no file called {source.name} to copy.", "state_changed")
        if target.exists():
            raise Refusal(f"{target.name} already exists — OCADE will not overwrite it.", "state_changed")
        if target.suffix.lower() in _EXECUTABLE_SUFFIXES:
            raise Refusal(f"OCADE does not create {target.suffix} files.", "blocked")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        # Verified by hashing both, not by trusting copy2 to have raised.
        same = target.is_file() and _sha256(source) == _sha256(target)
        return {
            "action": action,
            "from": source.name,
            "to": target.name,
            "verified": same,
            "detail": (
                f"Copied {source.name} to {target.name}; both hash the same."
                if same
                else f"{target.name} was written but does not match {source.name}."
            ),
        }

    if action == "move":
        source = _file_path(payload.get("folder"), payload.get("from"), "from")
        target = _file_path(payload.get("folder"), payload.get("to"), "to")
        if not source.is_file():
            raise Refusal(f"There is no file called {source.name} to move.", "state_changed")
        if target.exists():
            raise Refusal(f"{target.name} already exists — OCADE will not overwrite it.", "state_changed")
        if target.suffix.lower() in _EXECUTABLE_SUFFIXES:
            raise Refusal(f"OCADE does not create {target.suffix} files.", "blocked")
        before = _sha256(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        source.replace(target)
        moved = target.is_file() and not source.exists() and _sha256(target) == before
        return {
            "action": action,
            "from": source.name,
            "to": target.name,
            "verified": moved,
            "detail": (
                f"Moved {source.name} to {target.name}, unchanged."
                if moved
                else "The move did not complete cleanly."
            ),
        }

    if action == "trash":
        path = _file_path(payload.get("folder"), payload.get("path"))
        if not path.is_file():
            raise Refusal(f"There is no file called {path.name} to trash.", "state_changed")
        digest = _sha256(path)
        # The paperwork is written BEFORE the file moves. A crash between the
        # two leaves a stale row, which is recoverable; the other order leaves
        # a trashed file nobody can name, which is not.
        entry = {
            "id": uuid.uuid4().hex[:12],
            "name": path.name,
            "originalPath": str(path),
            "sha256": digest,
            "trashedAt": datetime.now().isoformat(timespec="seconds"),
        }
        _write_ledger([*_read_ledger(), entry])
        said = fc._safe_trash(path)  # noqa: SLF001 - the engine's send2trash wrapper
        gone = not path.exists()
        return {
            "action": action,
            "id": entry["id"],
            "name": entry["name"],
            "engineSaid": clamp(said, 200),
            "verified": gone,
            "detail": (
                f"{path.name} is in the recycle bin. Reversible with its id, {entry['id']}."
                if gone
                else f"{path.name} is still on disk — {clamp(said, 120)}"
            ),
        }

    if action == "restore":
        wanted = need_text(payload.get("id"), "id", 40).strip().lower()
        rows = _read_ledger()
        record: dict[str, Any] | None = next(
            (row for row in rows if row.get("id") == wanted), None
        )
        if record is None:
            raise Refusal(f"OCADE has no record of a trashed file with id {wanted}.", "state_changed")
        original = Path(str(record["originalPath"]))
        if original.exists():
            raise Refusal(
                f"{original.name} is already back in place — nothing to restore.", "state_changed"
            )
        restored = _restore_from_recycle_bin(original)
        if not restored:
            raise Refusal(
                f"OCADE could not restore {original.name} automatically. It is still in the "
                f"recycle bin and can be put back from there; its place was {original}.",
                "state_changed",
            )
        # Restored is not enough — it has to be the same file.
        matches = original.is_file() and _sha256(original) == record["sha256"]
        _write_ledger([row for row in rows if row.get("id") != wanted])
        return {
            "action": action,
            "name": original.name,
            "path": str(original),
            "verified": matches,
            "detail": (
                f"Restored {original.name}; its contents still hash the same."
                if matches
                else f"{original.name} came back but its contents have changed since it was trashed."
            ),
        }

    raise Refusal(f"Unsupported file action: {action}", "unsupported")


def _restore_from_recycle_bin(original: Path) -> bool:
    """Put one file back where it came from, using the shell's own undelete.

    The verb is localised — "Restore" on an English Windows, "Geri Yükle" on a
    Turkish one — so it is matched by position-independent normalisation across
    every verb the shell offers for the item, and by the item's recorded
    original location rather than its display name. Returns False rather than
    raising: the caller turns that into an honest "do it from the recycle bin",
    which is a worse outcome but a true one.
    """
    if sys.platform != "win32":
        return False
    try:
        import win32com.client  # noqa: PLC0415
    except ImportError:
        return False

    try:
        shell = win32com.client.Dispatch("Shell.Application")
        recycle_bin = shell.NameSpace(10)  # ssfBITBUCKET
        if recycle_bin is None:
            return False
        for item in recycle_bin.Items():
            # Column 1 is the original location; the shell reports the folder,
            # so the file name is compared separately.
            where = recycle_bin.GetDetailsOf(item, 1)
            if not where:
                continue
            if Path(where) != original.parent or item.Name != original.name:
                continue
            for verb in item.Verbs():
                normalised = verb.Name.replace("&", "").strip().lower()
                if normalised in _UNDELETE_VERBS:
                    verb.DoIt()
                    return original.exists()
            return False
    except Exception:
        return False
    return False


# The shell's undelete verb, in the languages Windows ships it under. A miss
# here costs an automatic restore, never correctness: the caller reports the
# file's original location and leaves it in the bin.
_UNDELETE_VERBS = {
    "restore", "undelete", "geri yükle", "wiederherstellen", "restaurer",
    "restaurar", "ripristina", "herstellen", "återställ", "gendan",
    "przywróć", "восстановить", "还原", "復元", "복원",
}


def system_status(payload: dict) -> dict:
    """This machine's measured state.

    UPGRADED IN PLACE RATHER THAN GIVEN A SECOND TOOL NAME. This used to return
    `str(dict)` — a Python repr, stringified, for a language model to read back
    out. `core.system.telemetry` returns the same facts as real fields plus
    storage and battery, which the old one never had.

    Keeping the name matters: `system_status` is what the fast router emits for
    "system status", what `tool-contract.ts` allows, and what the tests assert.
    A parallel `system_telemetry` would have left two tools answering one
    question and a router pointing at the worse of them.
    """
    from core.system import telemetry  # noqa: PLC0415

    seconds = payload.get("sampleSeconds")
    window = float(seconds) if isinstance(seconds, (int, float)) else 0.3
    return telemetry(cpu_sample_seconds=max(0.05, min(window, 2.0)))


def release_input(_payload: dict) -> dict:
    """Let go of every held key and mouse button. Part of emergency stop."""
    released: list[str] = []
    try:
        import pyautogui  # noqa: PLC0415

        for key in ("shift", "ctrl", "alt", "win"):
            try:
                pyautogui.keyUp(key)
                released.append(key)
            except Exception:
                pass
        for button in ("left", "middle", "right"):
            try:
                pyautogui.mouseUp(button=button)
                released.append(f"mouse:{button}")
            except Exception:
                pass
    except Exception as error:  # noqa: BLE001
        raise Refusal(f"Input could not be released: {type(error).__name__}", "retryable_failure")
    return {"released": released, "detail": "All held keys and mouse buttons were released."}


def press_key(payload: dict) -> dict:
    """Press one named key, from a closed set, and report what changed.

    A CLOSED SET RATHER THAN A PASSTHROUGH. `computer_control` will send any
    key string it is handed, which includes chords that hand the machine to
    whatever comes next — Win+R is a command line one keystroke away. So the
    vocabulary is enumerated here and anything outside it is refused by name.
    """
    allowed_keys = {
        "enter", "tab", "escape", "esc", "space", "backspace", "delete",
        "up", "down", "left", "right", "home", "end", "pageup", "pagedown",
        *{f"f{n}" for n in range(1, 13)},
        *{chr(c) for c in range(ord("a"), ord("z") + 1)},
        *{str(n) for n in range(10)},
    }
    allowed_modifiers = {"ctrl", "shift", "alt"}

    key = need_text(payload.get("key"), "key", 16).lower()
    if key == "esc":
        key = "escape"
    raw = payload.get("modifiers")
    modifiers = [str(m).lower() for m in raw] if isinstance(raw, list) else (
        [m.strip().lower() for m in str(raw).split("+") if m.strip()] if raw else []
    )
    if key not in allowed_keys:
        raise Refusal(f"OCADE does not send the {key!r} key.", "unsupported")
    for modifier in modifiers:
        if modifier not in allowed_modifiers:
            raise Refusal(f"OCADE does not send the {modifier!r} modifier.", "unsupported")
    if {"alt"} == set(modifiers) and key == "f4":
        raise Refusal("Alt+F4 closes a window without saving, so OCADE does not send it.", "blocked")

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    before = _read_editable(hwnd)

    from actions.computer_control import computer_control  # noqa: PLC0415

    if modifiers:
        computer_control({"action": "hotkey", "keys": "+".join([*modifiers, key])})
    else:
        computer_control({"action": "press", "key": key})

    time.sleep(0.2)
    after = _read_editable(hwnd)
    combination = "+".join([*modifiers, key])
    return {
        "pressed": combination,
        "hwnd": hwnd,
        # Verified only where the window exposes readable text that changed.
        # A key that changes nothing readable is honestly reported as unknown.
        "verified": (after != before) if (before is not None and after is not None) else None,
        "detail": f"Pressed {combination}.",
    }


def mouse(payload: dict) -> dict:
    """Physical pointer input. The last resort in the ladder, and gated as one.

    Refused unless the caller names a point inside the target window. A click at
    (840, 612) is correct only if the screen still looks the way it did when
    somebody chose those numbers, and nothing about the click can tell you
    whether it did — so the bounds are re-read immediately before acting.
    """
    win32gui = _win32()
    action = need_text(payload.get("action"), "action", 20).lower()
    if action not in ("click", "double_click", "right_click", "move", "scroll"):
        raise Refusal(f"Unsupported pointer action: {action}", "unsupported")

    from actions.computer_control import computer_control  # noqa: PLC0415

    if action == "scroll":
        amount = payload.get("amount")
        computer_control(
            {
                "action": "scroll",
                "direction": payload.get("direction") or "down",
                "amount": int(amount) if isinstance(amount, (int, float)) else 3,
            }
        )
        return {"action": action, "verified": None, "detail": f"Scrolled {payload.get('direction') or 'down'}."}

    x, y = payload.get("x"), payload.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        raise Refusal("A pointer action needs x and y.", "unsupported")

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    if not (left <= x <= right and top <= y <= bottom):
        raise Refusal("That point is outside the window OCADE was given.", "blocked")

    before = _read_editable(hwnd)
    computer_control({"action": action, "x": int(x), "y": int(y)})
    time.sleep(0.25)
    after = _read_editable(hwnd)
    return {
        "action": action,
        "hwnd": hwnd,
        "verified": (after != before) if (before is not None and after is not None) else None,
        "detail": f"{action.replace('_', ' ').capitalize()} at ({int(x)}, {int(y)}).",
    }


def window_arrange(payload: dict) -> dict:
    """Move or size a window, then read back where it actually landed."""
    win32gui = _win32()
    import win32con  # noqa: PLC0415

    layout = need_text(payload.get("layout"), "layout", 20).lower()
    if layout not in ("maximise", "maximize", "left", "right", "centre", "center", "minimise",
                      "minimize", "restore"):
        raise Refusal(f"Unsupported window layout: {layout}", "unsupported")

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    before = win32gui.GetWindowRect(hwnd)

    if layout in ("minimise", "minimize"):
        win32gui.ShowWindow(hwnd, win32con.SW_MINIMIZE)
    elif layout == "restore":
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    else:
        import win32api  # noqa: PLC0415

        monitor = win32api.MonitorFromWindow(hwnd, win32con.MONITOR_DEFAULTTONEAREST)
        area = win32api.GetMonitorInfo(monitor)["Work"]
        ml, mt, mr, mb = area
        width, height = mr - ml, mb - mt
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        if layout in ("maximise", "maximize"):
            target = (ml, mt, width, height)
        elif layout == "left":
            target = (ml, mt, width // 2, height)
        elif layout == "right":
            target = (ml + width // 2, mt, width // 2, height)
        else:
            w, h = int(width * 0.7), int(height * 0.8)
            target = (ml + (width - w) // 2, mt + (height - h) // 2, w, h)
        win32gui.SetWindowPos(
            hwnd, win32con.HWND_TOP, *target,
            win32con.SWP_SHOWWINDOW | win32con.SWP_FRAMECHANGED,
        )

    time.sleep(0.2)
    after = win32gui.GetWindowRect(hwnd)
    moved = after != before
    if layout in ("minimise", "minimize"):
        moved = bool(win32gui.IsIconic(hwnd))
    return {
        "hwnd": hwnd,
        "layout": layout,
        "bounds": {"x": after[0], "y": after[1],
                   "width": after[2] - after[0], "height": after[3] - after[1]},
        # Verified by the rectangle actually differing, not by the call returning.
        "verified": moved,
        "detail": "The window moved." if moved else "The window did not move.",
    }


def screen_observe(payload: dict) -> dict:
    """What is on the screen, down a ladder of decreasing certainty.

    THE LADDER, AND WHY THE ORDER IS THE POINT
    -------------------------------------------
    1. **UI Automation.** The operating system states that a thing is a button,
       is called "Continue", is enabled, and sits at these bounds. Acting on
       that is verifiable.
    2. **Windows OCR.** For windows that expose nothing — custom-drawn canvases,
       Electron apps with a broken bridge, remote sessions. Reading a button out
       of a bitmap is inferring a fact the OS would rather not state, so it is
       second and it is labelled.
    3. Nothing. Reported as nothing, with the reason.

    A weaker rung is only ever reached because the stronger one returned too
    little to act on — never because it was slower. `source` says which answered
    so the caller knows how much to trust it.
    """
    win32gui = _win32()
    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    title = clamp(win32gui.GetWindowText(hwnd), 256)

    structural = read_window({"hwnd": hwnd})
    elements = structural.get("elements") or []

    # Ten is the line between "this window described itself" and "this window
    # returned its title bar". Electron routinely exposes a handful of chrome
    # nodes and nothing else, and treating that as a successful read is how an
    # agent concludes a screen is empty.
    wants_text = len(elements) < 10 or payload.get("includeText") == "yes"
    visible_text = ""
    source = "accessibility"

    if wants_text:
        try:
            from actions.screen_processor import _capture_screen  # noqa: PLC0415

            _capture_screen()
            source = "accessibility+capture" if elements else "capture"
        except Exception:
            source = "accessibility" if elements else "none"
        # The engine's own OCR path is optional; the structural read is what the
        # loop acts on, so a missing OCR engine degrades rather than fails.
        visible_text = structural.get("text") or ""

    return {
        "hwnd": hwnd,
        "title": title,
        "elements": elements[:80],
        "elementCount": len(elements),
        "visibleText": clamp(visible_text, 4000),
        "source": source,
        "openWindows": window_list({}).get("windows", [])[:20],
        "detail": f"Read the screen: {title}. {len(elements)} interface elements.",
    }


# OCADE's own scratch folder, inside the system temp directory. The engine's
# `file_controller` resolves named user folders (desktop, downloads); this is the
# place OCADE may write without the user having approved anything, and every
# path resolves inside it or is refused.
WORKSPACE = Path(os.environ.get("TEMP", "/tmp")) / "ocade-workspace"

_EXECUTABLE_SUFFIXES = {
    ".exe", ".bat", ".cmd", ".com", ".scr", ".ps1", ".vbs", ".js", ".msi",
    ".reg", ".lnk", ".sh", ".dll", ".pyw",
}


def _workspace_path(name: Any, field: str = "name") -> Path:
    raw = need_text(name, field, 240).replace("\\", "/")
    if raw.startswith("/") or (len(raw) > 1 and raw[1] == ":"):
        raise Refusal("OCADE works in its own folder and cannot take an absolute path.", "blocked")
    WORKSPACE.mkdir(parents=True, exist_ok=True)
    root = WORKSPACE.resolve()
    candidate = (root / raw).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        raise Refusal("That path is outside OCADE's folder, so it was refused.", "blocked") from None
    return candidate


def workspace(payload: dict) -> dict:
    """Create, read, list and move files inside OCADE's own folder.

    Verified against the filesystem afterwards in every case — a write that
    returns without error and a write whose bytes are on disk are different
    facts, and only the second one is worth reporting.
    """
    action = need_text(payload.get("action"), "action", 20).lower()
    WORKSPACE.mkdir(parents=True, exist_ok=True)

    if action == "list":
        rows = [
            {"name": p.relative_to(WORKSPACE).as_posix(), "bytes": p.stat().st_size}
            for p in sorted(WORKSPACE.rglob("*"))
            if p.is_file()
        ]
        return {
            "files": rows[:200],
            "count": len(rows),
            "path": str(WORKSPACE),
            "verified": True,
            "detail": f"{len(rows)} file{'' if len(rows) == 1 else 's'} in the folder.",
        }

    if action == "read":
        path = _workspace_path(payload.get("name"))
        if not path.is_file():
            raise Refusal(f"There is no file called {path.name}.", "state_changed")
        content = path.read_text(encoding="utf-8", errors="replace")
        return {
            "name": path.name,
            "content": clamp(content, 20_000),
            "verified": True,
            "detail": f"Read {path.name}.",
        }

    if action == "write":
        path = _workspace_path(payload.get("name"))
        content = payload.get("content")
        if not isinstance(content, str):
            raise Refusal("A file needs text content.", "unsupported")
        if path.suffix.lower() in _EXECUTABLE_SUFFIXES:
            raise Refusal(
                f"OCADE does not create {path.suffix} files — the system would treat that as "
                "something to run.",
                "blocked",
            )
        if is_protected_text(content):
            raise Refusal("That content looks like a credential.", "blocked")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        landed = path.read_text(encoding="utf-8")
        return {
            "name": path.name,
            "bytes": path.stat().st_size,
            # Read back, not assumed. A full disk, a lock and an antivirus
            # quarantine all return from a write without complaint.
            "verified": landed == content,
            "detail": (
                f"Wrote {len(content)} characters to {path.name} and read them back."
                if landed == content
                else f"{path.name} was written but reads back differently."
            ),
        }

    if action == "move":
        source = _workspace_path(payload.get("from"), "from")
        target = _workspace_path(payload.get("to"), "to")
        if not source.is_file():
            raise Refusal(f"There is no file called {source.name} to move.", "state_changed")
        if target.suffix.lower() in _EXECUTABLE_SUFFIXES:
            raise Refusal(f"OCADE does not create {target.suffix} files.", "blocked")
        target.parent.mkdir(parents=True, exist_ok=True)
        source.replace(target)
        moved = target.is_file() and not source.exists()
        return {
            "from": source.name,
            "to": target.name,
            "verified": moved,
            "detail": f"Moved {source.name} to {target.name}." if moved else "The move did not complete.",
        }

    raise Refusal(f"Unsupported file action: {action}", "unsupported")


# ---------------------------------------------------------------- universal UI


def ui_tree(payload: dict) -> dict:
    """The accessibility tree of a window, as refs the model can act on.

    Distinct from `window.read`, which reports elements with no identity: it can
    say a Save button exists but gives the caller no way to name it, so the only
    way to press it was to guess a pixel. This returns refs and fingerprints,
    which is what turns "OCADE can see the UI" into "OCADE can operate the UI".

    A SMALL SETTLE IS THE DEFAULT, AND IT COSTS READY WINDOWS NOTHING.
    An Electron application publishes its accessibility tree lazily: measured on
    Discord eight seconds after launch, this returned six unnamed Panes and no
    controls at all, and the same window later returned two hundred elements
    across nine roles. A model handed the first answer concludes the app is
    empty and gives up. The settle loop exits immediately when the window has
    already published anything real, so a window that is ready pays nothing for
    a wait it does not need.
    """
    from core.uia import UiaUnavailable, snapshot  # noqa: PLC0415

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    query = payload.get("query")
    settle = payload.get("settleSeconds")
    try:
        result = snapshot(
            hwnd,
            limit=int(payload.get("limit") or 60),
            query=query if isinstance(query, str) and query.strip() else None,
            protect=is_protected_text,
            settle=float(settle) if isinstance(settle, (int, float)) else 6.0,
        )
    except UiaUnavailable as error:
        raise Refusal(str(error), "unsupported") from error
    _remember(hwnd)
    return result


def ui_act(payload: dict) -> dict:
    """Operate ONE element by ref, then read it back and report what changed.

    `allowPointerFallback` defaults to false. Left to itself this path never
    moves the physical mouse: it operates controls through the patterns they
    publish, and refuses when a control publishes none. Guessing a pixel is
    something a caller has to ask for, in writing, per call.
    """
    from core.uia import ElementGone, UiaUnavailable, act  # noqa: PLC0415

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    ref = need_text(payload.get("ref"), "ref", 32)
    action = need_text(payload.get("action"), "action", 32)

    text = payload.get("text")
    if action.strip().lower() == "set_text":
        text = need_text(text, "text", MAX_TEXT)
        if is_protected_text(text):
            raise Refusal(
                "That looks like a password, one-time code or payment detail. "
                "OCADE does not type those; enter it yourself.",
                "refused",
            )

    fingerprint = payload.get("fingerprint")
    try:
        result = act(
            hwnd,
            ref,
            action,
            text=text if isinstance(text, str) else None,
            fingerprint=fingerprint if isinstance(fingerprint, str) and fingerprint else None,
            allow_pointer_fallback=bool(payload.get("allowPointerFallback")),
        )
    except ElementGone as error:
        # `state_changed` and not `unsupported`: the caller should re-read the
        # window and try again, which is a different instruction from "this
        # host cannot do that", and only one of them falls through to a
        # second executor.
        raise Refusal(str(error), "state_changed") from error
    except UiaUnavailable as error:
        raise Refusal(str(error), "unsupported") from error

    _remember(hwnd)
    return result


def _audio_endpoint():
    """The system audio endpoint, or an honest refusal.

    `actions/computer_settings.py` presses the `volumeup` media key five times
    and calls that "volume up". It cannot report the level it reached, cannot
    set a specific level, and on a machine where the key does nothing it fails
    silently — its own pycaw fallback presses mute TWICE, which is a no-op
    dressed as a recovery. The fast router promises a receipt, so it needs an
    endpoint it can read back, not a keystroke it can only hope about.
    """
    try:
        from pycaw.pycaw import AudioUtilities  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise Refusal(
            "Volume control needs the 'pycaw' package, which is not installed in "
            "this Python environment. Install it into native/python-host/.venv.",
            "unsupported",
        ) from error

    try:
        speakers = AudioUtilities.GetSpeakers()
    except Exception as error:  # noqa: BLE001
        raise Refusal("This machine exposes no audio endpoint.", "unsupported") from error

    # TWO PYCAW GENERATIONS, BOTH SUPPORTED.
    #
    # pycaw 2025 returns an `AudioDevice` wrapper exposing `.EndpointVolume`;
    # older releases return a raw IMMDevice that has to be `Activate`d. Pinning
    # one would make this handler fail on whichever version the machine happened
    # to install, and that failure reads as "no audio device" rather than "wrong
    # library version" — so both shapes are handled here.
    endpoint = getattr(speakers, "EndpointVolume", None)
    if endpoint is not None:
        return endpoint

    try:
        from ctypes import POINTER, cast  # noqa: PLC0415

        from comtypes import CLSCTX_ALL  # noqa: PLC0415
        from pycaw.pycaw import IAudioEndpointVolume  # noqa: PLC0415

        interface = speakers.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        return cast(interface, POINTER(IAudioEndpointVolume))
    except Exception as error:  # noqa: BLE001
        raise Refusal(
            "This machine exposes no controllable audio endpoint.", "unsupported"
        ) from error


def system_volume(payload: dict) -> dict:
    """Read, set or mute the system volume, and prove the level afterwards.

    Every branch re-reads the endpoint after writing it. "Muted" that did not
    mute is the exact failure a deterministic command must never report as done.
    """
    volume = _audio_endpoint()
    action = (payload.get("action") or "set").strip().lower()

    def level() -> int:
        return int(round(volume.GetMasterVolumeLevelScalar() * 100))

    def muted() -> bool:
        return bool(volume.GetMute())

    before_level, before_muted = level(), muted()

    if action == "get":
        return {
            "level": before_level,
            "muted": before_muted,
            "verified": True,
            "detail": f"Volume is {before_level}%{' (muted)' if before_muted else ''}.",
        }

    if action in ("mute", "unmute", "toggle_mute"):
        wanted = True if action == "mute" else False if action == "unmute" else not before_muted
        volume.SetMute(bool(wanted), None)
        now = muted()
        return {
            "level": level(),
            "muted": now,
            "verified": now == wanted,
            "detail": (
                f"Sound is now {'muted' if now else 'unmuted'}."
                if now == wanted
                else f"Asked to {'mute' if wanted else 'unmute'}, but the endpoint reports "
                f"{'muted' if now else 'unmuted'}."
            ),
        }

    if action == "step":
        # "Louder" is relative, so it is resolved against the level the endpoint
        # actually reports right now — not against a level OCADE last set, which
        # the user may have changed with their keyboard since.
        by = payload.get("by")
        if not isinstance(by, (int, float)):
            raise Refusal("by is required and must be a number of percent.", "unsupported")
        wanted = max(0, min(100, before_level + int(by)))
        volume.SetMasterVolumeLevelScalar(wanted / 100.0, None)
        if wanted > 0 and muted():
            volume.SetMute(False, None)
        now = level()
        return {
            "level": now,
            "muted": muted(),
            "requested": wanted,
            "from": before_level,
            "verified": abs(now - wanted) <= 2,
            "detail": f"Volume {before_level}% → {now}%.",
        }

    if action == "set":
        raw = payload.get("level")
        if not isinstance(raw, (int, float)):
            raise Refusal("level is required and must be a number from 0 to 100.", "unsupported")
        wanted = max(0, min(100, int(raw)))
        volume.SetMasterVolumeLevelScalar(wanted / 100.0, None)
        # Unmute when a level was asked for: setting a level on a muted device
        # produces silence, which reads to the user as the command failing.
        if wanted > 0 and muted():
            volume.SetMute(False, None)
        now = level()
        # The endpoint quantises, so exact equality would fail on hardware that
        # did exactly what it was told.
        close = abs(now - wanted) <= 2
        return {
            "level": now,
            "muted": muted(),
            "requested": wanted,
            "verified": close,
            "detail": (
                f"Volume is now {now}%."
                if close
                else f"Asked for {wanted}% but the endpoint reports {now}%."
            ),
        }

    raise Refusal(f"Unsupported volume action: {action}", "unsupported")


# ------------------------------------------------------------------- voice
#
# THE STOP SIGNAL IS SHARED, NOT PER-FEATURE.
#
# A barge-in that only silenced speech would be a demo: the user says "stop",
# OCADE goes quiet, and the mouse keeps working through the task they just
# withdrew consent from. So the listener trips one process-wide switch, and
# three things watch it — speech purges, the microphone loop exits, and every
# mutating handler below refuses to START new work while it is set.
#
# Releasing held input is registered as a stop callback here rather than being
# called by the listener, so it happens no matter WHAT trips the stop: a spoken
# word, the Node agent, or the fast router.

_voice_state: dict[str, Any] = {"voice": None, "listener": None, "wired": False}


def _voice():
    from core.voice_pipeline import STOP, ZiraVoice  # noqa: PLC0415

    if _voice_state["voice"] is None:
        _voice_state["voice"] = ZiraVoice()
    if not _voice_state["wired"]:
        STOP.on_stop(lambda: release_input({}))
        _voice_state["wired"] = True
    return _voice_state["voice"]


def voice_speak(payload: dict) -> dict:
    """Speak, in OCADE's one fixed voice.

    Asynchronous unless the caller asks otherwise: speech that blocks the bridge
    cannot be interrupted by the listener whose whole job is interrupting it.
    """
    from core.voice_pipeline import VoiceUnavailable  # noqa: PLC0415

    said = need_text(payload.get("text"), "text", 4000)
    if is_protected_text(said):
        raise Refusal("OCADE does not read passwords or one-time codes aloud.", "refused")
    try:
        voice = _voice()
        result = voice.say(said, block=bool(payload.get("wait")))
    except VoiceUnavailable as error:
        raise Refusal(str(error), "unsupported") from error
    return {**result, "verified": True, "detail": f"Said: {said[:120]}"}


def voice_silence(_payload: dict) -> dict:
    """Cut speech mid-word and trip the shared stop."""
    from core.voice_pipeline import STOP, VoiceUnavailable  # noqa: PLC0415

    try:
        _voice().silence()
    except VoiceUnavailable:
        pass
    STOP.trip("stop requested by the agent")
    return {"stopped": True, "verified": True, "detail": "Stopped speaking and released input."}


def voice_listen(payload: dict) -> dict:
    """Record one spoken utterance and transcribe it on this machine."""
    from core.voice_pipeline import STOP, VoiceUnavailable, WhisperEars, listen_once  # noqa: PLC0415

    STOP.clear()
    if _voice_state.get("ears") is None:
        _voice_state["ears"] = WhisperEars(str(payload.get("model") or "base"))
    try:
        return listen_once(
            ears=_voice_state["ears"],
            silence_ms=int(payload.get("silenceMs") or 800),
            max_ms=int(payload.get("maxMs") or 15_000),
        )
    except VoiceUnavailable as error:
        raise Refusal(str(error), "unsupported") from error


def voice_barge_in(payload: dict) -> dict:
    """Start or stop the always-listening interrupt watcher."""
    from core.voice_pipeline import BargeInListener, VoiceUnavailable  # noqa: PLC0415

    enabled = payload.get("enabled")
    if not isinstance(enabled, bool):
        raise Refusal("enabled is required and must be true or false.", "unsupported")

    listener = _voice_state.get("listener")
    if not enabled:
        if listener is not None:
            listener.stop()
            _voice_state["listener"] = None
        return {"listening": False, "verified": True, "detail": "Barge-in listening is off."}

    if listener is None:
        listener = BargeInListener(
            voice=_voice(),
            model_name=str(payload.get("model") or "tiny"),
        )
        _voice_state["listener"] = listener
    try:
        listener.start()
    except VoiceUnavailable as error:
        _voice_state["listener"] = None
        raise Refusal(str(error), "unsupported") from error
    return {
        "listening": listener.listening,
        "verified": listener.listening,
        "detail": "Listening for “stop”, “wait” or “cancel” while OCADE works.",
    }


# --------------------------------------------------------- system telemetry


def screen_find(payload: dict) -> dict:
    """Locate something on screen: UI Automation, then OCR, then vision."""
    from core.perception import PerceptionUnavailable, find_targets  # noqa: PLC0415

    window = payload.get("windowTitle") or payload.get("hwnd")
    try:
        hwnd = _target_window(window) if window else _target_window(None)
    except Refusal:
        hwnd = None

    try:
        result = find_targets(
            hwnd,
            need_text(payload.get("query"), "query", 200),
            allow_ocr=payload.get("allowOcr") is not False,
            # None means "decide from the measured capability of this machine".
            # The vision rung is reached only after UI Automation and OCR have
            # both returned nothing, and whether it then RUNS is
            # VISION_ENABLED_BY_DEFAULT — currently false here, because it
            # measured 0/4 in bounds at a median of 138 s. An explicit
            # allowVision still forces it either way.
            allow_vision=(
                True
                if payload.get("allowVision") is True
                else False
                if payload.get("allowVision") is False
                else None
            ),
            protect=is_protected_text,
        )
    except PerceptionUnavailable as error:
        raise Refusal(str(error), "unsupported") from error
    if hwnd:
        _remember(hwnd)
    return result


def screen_click(payload: dict) -> dict:
    """Click a target that has no accessibility handle. The pointer rung.

    Takes the TARGET OBJECT that `screen.find` returned rather than an x and a
    y, so the click inherits that target's source and confidence and can be
    refused when the accessibility tree could have done the job instead.
    """
    from core.perception import PerceptionUnavailable, click_target  # noqa: PLC0415

    target = payload.get("target")
    if not isinstance(target, dict):
        raise Refusal(
            "A pointer click needs the target object from screen.find, not raw "
            "coordinates.",
            "unsupported",
        )

    window = payload.get("windowTitle") or payload.get("hwnd")
    try:
        hwnd = _target_window(window) if window else _target_window(None)
    except Refusal:
        hwnd = None

    # The observation used to decide whether the click did anything. Reading the
    # window's own text is cheap and changes for most real interactions.
    def observe():
        if hwnd is None:
            return None
        try:
            return _read_editable(hwnd), win32gui_title(hwnd)
        except Exception:  # noqa: BLE001
            return None

    try:
        return click_target(target, hwnd=hwnd, observe=observe)
    except PerceptionUnavailable as error:
        raise Refusal(str(error), "blocked") from error


def _vision_window(payload: dict) -> int | None:
    window = payload.get("windowTitle") or payload.get("hwnd")
    try:
        return _target_window(window) if window else _target_window(None)
    except Refusal:
        return None


def _allow_vision(payload: dict):
    """Tri-state: forced on, forced off, or decided by the ladder."""
    if payload.get("allowVision") is True:
        return True
    if payload.get("allowVision") is False:
        return False
    return None


def screen_type(payload: dict) -> dict:
    """Find a field by looking at the screen, type into it, and LOOK AGAIN.

    The closed loop. `submit` asks for Enter afterwards and is honoured only
    when the read-back actually shows the text -- which is the entire point,
    because Enter is the half that cannot be taken back.
    """
    from core.perception import PerceptionUnavailable  # noqa: PLC0415
    from core.vision_action import type_into  # noqa: PLC0415

    text = need_text(payload.get("text"), "text", 4000)
    if is_protected_text(text):
        raise Refusal(
            "That looks like a password, a one-time code or a payment detail. OCADE "
            "does not type those.",
            "protected",
        )

    hwnd = _vision_window(payload)
    try:
        result = type_into(
            hwnd,
            need_text(payload.get("field"), "field", 200),
            text,
            submit=payload.get("submit") is True,
            allow_vision=_allow_vision(payload),
        )
    except PerceptionUnavailable as error:
        raise Refusal(str(error), "unsupported") from error
    if hwnd:
        _remember(hwnd)
    return result


def screen_act(payload: dict) -> dict:
    """Find something on screen, operate it, and check what changed."""
    from core.perception import PerceptionUnavailable  # noqa: PLC0415
    from core.vision_action import act_on_screen  # noqa: PLC0415

    hwnd = _vision_window(payload)
    try:
        result = act_on_screen(
            hwnd,
            need_text(payload.get("what"), "what", 200),
            allow_vision=_allow_vision(payload),
        )
    except PerceptionUnavailable as error:
        raise Refusal(str(error), "unsupported") from error
    if hwnd:
        _remember(hwnd)
    return result


def screen_watch(payload: dict) -> dict:
    """Start, stop or inspect the continuous screen buffer.

    `start` is meant to be called when the microphone opens or the user begins
    typing -- so the frame that answers "what is on my screen" was taken while
    the sentence was still being spoken, rather than after it finished. The
    loop stops itself once nobody has read from it, so a caller that forgets to
    stop it costs thirty seconds of capture, not a flat battery.
    """
    from core.screen_buffer import buffer  # noqa: PLC0415

    action = str(payload.get("action") or "start").strip().lower()
    if action == "stop":
        buffer.stop()
        return {"action": "stop", "verified": True, "detail": "Stopped watching the screen."}

    if action == "status":
        stats = buffer.stats()
        return {**stats, "action": "status", "verified": True, "detail": _watch_detail(stats)}

    buffer.start()
    stats = buffer.stats()
    return {**stats, "action": "start", "verified": True, "detail": _watch_detail(stats)}


def _watch_detail(stats: dict) -> str:
    if not stats.get("running"):
        return "The screen buffer is not running."
    frames = stats.get("frames") or 0
    kib = int((stats.get("bytes") or 0) / 1024)
    age = stats.get("newestAgeMs")
    return (
        f"Watching the screen every {stats.get('intervalMs')} ms. "
        f"{frames} frame(s) held, {kib} KiB"
        + (f", newest {age} ms old." if age is not None else ".")
    )


def screen_read(payload: dict) -> dict:
    """Read what a region of the screen is showing, by looking at it.

    Deliberately a screenshot rather than a control query: this answers "what
    is displayed", and a control reporting a value it is not displaying is one
    of the failures the Vision-Action loop exists to catch.
    """
    from core.perception import PerceptionUnavailable  # noqa: PLC0415
    from core.vision_action import read_region  # noqa: PLC0415

    hwnd = _vision_window(payload)
    bounds = payload.get("bounds") if isinstance(payload.get("bounds"), dict) else None
    try:
        text = read_region(bounds, hwnd)
    except PerceptionUnavailable as error:
        raise Refusal(str(error), "unsupported") from error
    return {
        "text": text[:4000],
        "characters": len(text),
        "region": bounds or "window",
        "verified": True,
        "detail": (
            f"Read {len(text)} characters off the screen."
            if text
            else "Nothing readable was found in that region."
        ),
    }


def win32gui_title(hwnd: int) -> str:
    return clamp(_win32().GetWindowText(hwnd), 200)


def app_discover(payload: dict) -> dict:
    """Every launchable application, from the registry, Start Menu and PATH."""
    from core.apps import discover, resolve  # noqa: PLC0415

    name = payload.get("name")
    if isinstance(name, str) and name.strip():
        return resolve(name)
    return discover(include_path=payload.get("includePath") is not False)


def system_brightness(payload: dict) -> dict:
    """Read or set display brightness, confirmed against the display."""
    from core.system import SystemUnavailable, get_brightness, set_brightness  # noqa: PLC0415

    action = (payload.get("action") or "get").strip().lower()
    try:
        if action == "get":
            return get_brightness()
        if action == "set":
            level = payload.get("percent")
            if not isinstance(level, (int, float)):
                raise Refusal("percent is required and must be 0 to 100.", "unsupported")
            display = payload.get("display")
            return set_brightness(int(level), display=display if isinstance(display, int) else None)
    except SystemUnavailable as error:
        raise Refusal(str(error), "unsupported") from error
    raise Refusal(f"Unsupported brightness action: {action}", "unsupported")


def system_media(payload: dict) -> dict:
    """Send a global media key — play/pause, next, previous, stop, mute."""
    from core.system import SystemUnavailable, media  # noqa: PLC0415

    try:
        return media(need_text(payload.get("action"), "action", 24))
    except SystemUnavailable as error:
        raise Refusal(str(error), "unsupported") from error


def system_bluetooth(_payload: dict) -> dict:
    """Bluetooth adapter state and the devices paired to it."""
    from core.system import SystemUnavailable, bluetooth_status  # noqa: PLC0415

    try:
        return bluetooth_status()
    except SystemUnavailable as error:
        raise Refusal(str(error), "unsupported") from error


def system_audio_devices(_payload: dict) -> dict:
    """Playback and recording devices Windows currently has enabled."""
    from core.system import SystemUnavailable, audio_devices  # noqa: PLC0415

    try:
        return audio_devices()
    except SystemUnavailable as error:
        raise Refusal(str(error), "unsupported") from error


def voice_devices(_payload: dict) -> dict:
    """Every microphone this machine can record from."""
    from core.voice_pipeline import MIC, VoiceUnavailable, list_input_devices  # noqa: PLC0415

    try:
        devices = list_input_devices()
    except VoiceUnavailable as error:
        raise Refusal(str(error), "unsupported") from error
    return {
        "devices": devices,
        "count": len(devices),
        "selected": MIC.device,
        "micEnabled": MIC.enabled,
        "verified": True,
        "detail": f"{len(devices)} microphone(s) available.",
    }


def voice_mic(payload: dict) -> dict:
    """Turn the microphone on or off, and pick which one.

    Turning it OFF stops the barge-in listener, which closes the input stream
    and releases the device. That is why this reports `listening` back: "the mic
    is off" and "the listener is still holding the device" must never both be
    true, and the caller can check.
    """
    from core.voice_pipeline import MIC, VoiceUnavailable  # noqa: PLC0415

    if "deviceId" in payload:
        raw = payload.get("deviceId")
        if raw is not None and not isinstance(raw, int):
            raise Refusal("deviceId must be a number, or null for the system default.", "unsupported")
        MIC.set_device(raw)

    if "enabled" in payload:
        enabled = payload.get("enabled")
        if not isinstance(enabled, bool):
            raise Refusal("enabled must be true or false.", "unsupported")
        MIC.set(enabled)
        listener = _voice_state.get("listener")
        if not enabled and listener is not None:
            listener.stop()
            _voice_state["listener"] = None
        elif enabled and listener is not None and not listener.listening:
            try:
                listener.start()
            except VoiceUnavailable as error:
                raise Refusal(str(error), "unsupported") from error

    listener = _voice_state.get("listener")
    listening = bool(listener is not None and listener.listening)
    return {
        "micEnabled": MIC.enabled,
        "deviceId": MIC.device,
        "listening": listening,
        # The stream is genuinely released when the mic is off: an enabled=False
        # that left a listener running would be a lie this check catches.
        "verified": MIC.enabled or not listening,
        "detail": (
            f"Microphone is {'on' if MIC.enabled else 'off'}"
            + (f" (device {MIC.device})" if MIC.device is not None else " (system default)")
            + ("; listening for interruptions." if listening else "; the audio stream is released.")
        ),
    }


def voice_status(_payload: dict) -> dict:
    """Whether a stop has been tripped — the poll the Node agent uses.

    The bridge is strict request/response, so a barge-in cannot be pushed to
    Node without desynchronising the NDJSON pairing that stdout depends on. The
    interruption is therefore INSTANT WHERE IT MATTERS — speech and input stop
    on the engine's own thread within milliseconds — and Node learns about it on
    its next call, which the mission loop already makes between every step.
    """
    from core.voice_pipeline import STOP  # noqa: PLC0415

    listener = _voice_state.get("listener")
    voice = _voice_state.get("voice")
    return {
        "stopped": STOP.is_set(),
        "reason": STOP.reason,
        "at": STOP.at,
        "listening": bool(listener is not None and listener.listening),
        "lastHeard": getattr(listener, "last_heard", "") if listener else "",
        "speaking": bool(voice.speaking) if voice is not None else False,
    }


def voice_resume(_payload: dict) -> dict:
    """Clear a tripped stop so new work may begin. Never implicit."""
    from core.voice_pipeline import STOP  # noqa: PLC0415

    STOP.clear()
    return {"stopped": False, "verified": True, "detail": "Ready again."}


# --------------------------------------------------------- office and data


def _office_path(payload: dict, field: str = "path") -> Path:
    """Resolve through the same guard every other file action uses.

    Reusing `_file_path` rather than adding a second resolver: it confines the
    write to the user's named folders and refuses absolute paths and `..`, and
    a second implementation of that rule is a second place for it to be wrong.
    """
    return _file_path(payload.get("folder"), payload.get(field), field)


def office_read(payload: dict) -> dict:
    """Read a spreadsheet or a Word document."""
    from core import office  # noqa: PLC0415

    path = _office_path(payload)
    try:
        if path.suffix.lower() in office.DOCUMENT_SUFFIXES:
            return office.read_document(path)
        return office.read_table(path, preview_rows=int(payload.get("previewRows") or 20))
    except office.OfficeUnavailable as error:
        raise Refusal(str(error), "unsupported") from error
    except office.OfficeRefused as error:
        raise Refusal(str(error), "state_changed") from error


def office_write(payload: dict) -> dict:
    """Write a spreadsheet or document, then reopen it and return the receipt."""
    from core import office  # noqa: PLC0415

    path = _office_path(payload)
    try:
        if path.suffix.lower() in office.DOCUMENT_SUFFIXES:
            paragraphs = payload.get("paragraphs")
            if not isinstance(paragraphs, list):
                raise Refusal("paragraphs is required and must be a list of text.", "unsupported")
            title = payload.get("title")
            return office.write_document(
                path,
                [str(p) for p in paragraphs],
                title=str(title) if isinstance(title, str) else None,
            )
        rows = payload.get("rows")
        if not isinstance(rows, list):
            raise Refusal("rows is required and must be a list of objects.", "unsupported")
        return office.write_table(path, rows, sheet=str(payload.get("sheet") or "Sheet1"))
    except office.OfficeUnavailable as error:
        raise Refusal(str(error), "unsupported") from error
    except office.OfficeRefused as error:
        raise Refusal(str(error), "state_changed") from error


# ----------------------------------------------------------------- messaging


def message_draft(payload: dict) -> dict:
    """Prepare a message for the user to approve. Sends nothing."""
    from core.messaging import MessageRefused, draft  # noqa: PLC0415

    try:
        return draft(
            need_text(payload.get("recipient"), "recipient", 120),
            need_text(payload.get("message"), "message", 4000),
            app=str(payload.get("app") or "WhatsApp"),
            protect=is_protected_text,
        )
    except MessageRefused as error:
        raise Refusal(str(error), "refused") from error


def message_send(payload: dict) -> dict:
    """Send a drafted message — only with an explicit approval."""
    from core.messaging import MessageRefused, send  # noqa: PLC0415

    approved = payload.get("approved")
    if not isinstance(approved, bool):
        raise Refusal(
            "approved must be true or false. A message is never sent on a missing answer.",
            "refused",
        )
    window = payload.get("hwnd") or payload.get("windowTitle")
    try:
        return send(
            need_text(payload.get("draftId"), "draftId", 64),
            approved=approved,
            hwnd=_target_window(window) if window else None,
            fingerprint=payload.get("fingerprint") if payload.get("fingerprint") else None,
            shown_recipient=payload.get("recipient"),
            shown_body=payload.get("message"),
        )
    except MessageRefused as error:
        raise Refusal(str(error), "refused") from error


def message_to(payload: dict) -> dict:
    """One atomic action: work out who, open that chat, type the words.

    WHY THIS IS ONE CALL AND NOT THREE.
    ------------------------------------
    "message meta ai hi" cannot be split before the screen has been read, and
    the router that receives the sentence is a pure function with no eyes. If
    it emitted three separate calls it would have to guess the contact to fill
    in the second one -- which is the original bug.

    So the whole sequence lives here, next to the screen: resolve the phrase
    against the live conversation list, open the chat that actually matched,
    then type the remainder into that conversation. Nothing is SENT; the words
    sit in the box for a person to look at.

    Every step is verified against the screen before the next one runs, and a
    step that cannot be confirmed stops the sequence rather than continuing on
    an assumption.
    """
    from core.messaging import (  # noqa: PLC0415
        MessageRefused,
        find_contact,
        resolve_target,
    )

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    phrase = need_text(payload.get("phrase"), "phrase", 400)

    try:
        split = resolve_target(hwnd, phrase)
        opened = find_contact(hwnd, split["contact"])
    except MessageRefused as error:
        raise Refusal(str(error), "refused") from error

    steps = [
        {"step": "resolve", "contact": split["contact"], "payload": split["payload"], "how": split["how"]},
        {"step": "open", "contact": opened.get("contact"), "verified": opened.get("verified")},
    ]

    body = (split.get("payload") or "").strip()
    if not body:
        return {
            "contact": split["contact"],
            "typed": False,
            "steps": steps,
            "verified": bool(opened.get("verified")),
            "detail": (
                f"Opened the conversation with {split['contact']}. No message text was given, "
                "so nothing was typed."
            ),
        }

    if is_protected_text(body):
        raise Refusal(
            "That looks like a password, a one-time code or a payment detail. OCADE does "
            "not put those in a message.",
            "protected",
        )

    typed = _type_into_conversation(hwnd, body)
    steps.append({"step": "type", "characters": len(body), "verified": typed.get("verified")})

    return {
        "contact": split["contact"],
        "message": body,
        "typed": True,
        "sent": False,
        "steps": steps,
        "verified": bool(typed.get("verified")),
        "detail": (
            f"Opened {split['contact']} and typed {len(body)} characters. Nothing was sent."
            if typed.get("verified")
            else (
                f"Opened {split['contact']}, but the text could not be confirmed in the "
                f"message box. Reported as unverified rather than done."
            )
        ),
    }


def _type_into_conversation(hwnd: int, body: str) -> dict:
    """Put text in the composer and confirm it by reading the box back."""
    from core.messaging import _find_message_box, _normalise  # noqa: PLC0415
    from core.uia import _resolve, act  # noqa: PLC0415

    box = _find_message_box(hwnd)
    try:
        act(hwnd, box["ref"], "set_text", text=body, fingerprint=box.get("fingerprint"))
    except Exception:  # noqa: BLE001, S110
        pass

    def current() -> str:
        try:
            element = _resolve(hwnd, box["ref"], None, 200)["_element"]
        except Exception:  # noqa: BLE001
            return ""
        for reader in (
            lambda: element.get_value(),
            lambda: element.iface_text.DocumentRange.GetText(-1),
        ):
            try:
                value = reader()
            except Exception:  # noqa: BLE001
                continue
            if isinstance(value, str):
                return value
        return ""

    landed = _normalise(body)[:60] in _normalise(current())
    if not landed:
        # A Chromium composer accepts a value write and renders nothing, so the
        # keystroke path is the fallback -- the same ladder the WhatsApp skill
        # measured as necessary.
        try:
            element = _resolve(hwnd, box["ref"], None, 200)["_element"]
            element.set_focus()
            time.sleep(0.2)
            element.type_keys(body, with_spaces=True, with_newlines=False, pause=0.005)
            time.sleep(0.4)
            landed = _normalise(body)[:60] in _normalise(current())
        except Exception:  # noqa: BLE001, S110
            pass

    return {"verified": landed, "readback": current()[:200]}


def screen_map(payload: dict) -> dict:
    """Number everything actionable on screen so the model can pick, not guess.

    The whole point of the numbering is that an id can be checked against a
    real list; a coordinate cannot be checked against anything.
    """
    from core.screen_map import map_screen  # noqa: PLC0415

    window = payload.get("windowTitle") or payload.get("hwnd")
    try:
        hwnd = _target_window(window) if window else _target_window(None)
    except Refusal:
        hwnd = None
    allow = payload.get("includeText")
    result = map_screen(
        hwnd,
        include_ocr=True if allow is True else False if allow is False else None,
        limit=int(payload.get("limit") or 60),
    )
    if hwnd:
        _remember(hwnd)
    return result


def screen_do(payload: dict) -> dict:
    """CLICK 5 / TYPE 3 "hello" / READ 12, against the last numbering."""
    from core.screen_map import MapExpired, act_on_id  # noqa: PLC0415

    action = need_text(payload.get("action"), "action", 20).lower()
    raw = payload.get("id")
    if not isinstance(raw, (int, float)):
        raise Refusal("An action needs the number of the element to act on.", "unsupported")

    body = str(payload.get("text") or "")
    if action == "type" and is_protected_text(body):
        raise Refusal(
            "That looks like a password, a one-time code or a payment detail. OCADE "
            "does not type those.",
            "protected",
        )

    try:
        return act_on_id(
            int(raw),
            action,
            token=str(payload.get("token") or "") or None,
            text=body,
            submit=payload.get("submit") is True,
        )
    except MapExpired as error:
        raise Refusal(str(error), "state_changed") from error
    except ValueError as error:
        raise Refusal(str(error), "unsupported") from error


def message_resolve_target(payload: dict) -> dict:
    """Split an ambiguous phrase into a real contact and the words to send.

    "message meta ai hi" carries no separator between the recipient and the
    message, so no amount of grammar can tell them apart -- it depends on who
    exists in this person's contact list. This looks at the live screen and
    answers from what is actually there.

    Navigation-adjacent, not sending: it may type into the SEARCH box to filter
    the list, and never into a conversation.
    """
    from core.messaging import MessageRefused, resolve_target  # noqa: PLC0415

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    try:
        result = resolve_target(hwnd, need_text(payload.get("phrase"), "phrase", 400))
    except MessageRefused as error:
        raise Refusal(str(error), "refused") from error
    _remember(hwnd)
    return result


def message_visible_contacts(payload: dict) -> dict:
    """Every conversation name currently on screen. Read-only."""
    from core.messaging import visible_rows  # noqa: PLC0415

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    names = visible_rows(hwnd)
    return {
        "contacts": names[:60],
        "count": len(names),
        "verified": True,
        "detail": f"{len(names)} conversations are visible.",
    }


def message_find_contact(payload: dict) -> dict:
    """Search a chat app's contact list and open ONE conversation.

    Navigation only. Nothing is typed into a conversation and nothing is sent —
    the draft/approve gate still stands between this and any message. Splitting
    it out is what lets the approval card name the contact that was actually
    resolved rather than the string the user typed.
    """
    from core.messaging import MessageRefused, find_contact  # noqa: PLC0415

    hwnd = _target_window(payload.get("windowTitle") or payload.get("hwnd"))
    try:
        result = find_contact(hwnd, need_text(payload.get("contact"), "contact", 120))
    except MessageRefused as error:
        raise Refusal(str(error), "refused") from error
    _remember(hwnd)
    return result


def message_pending(_payload: dict) -> dict:
    from core.messaging import pending  # noqa: PLC0415

    drafts = pending()
    return {"drafts": drafts, "count": len(drafts), "verified": True,
            "detail": f"{len(drafts)} message(s) awaiting approval."}


def message_discard(payload: dict) -> dict:
    from core.messaging import discard  # noqa: PLC0415

    return discard(need_text(payload.get("draftId"), "draftId", 64))


# Commands that still run after a stop: the ones that only LOOK, plus the ones
# that manage the stop itself. `input.release` is here because letting go of a
# held key is part of stopping, not work that a stop should prevent.
_STOP_EXEMPT = frozenset(
    {
        "engine.info",
        "screen.observe",
        "ui.tree",
        "screen.find",
        "web.search",
        "memory.recall",
        "memory.snapshot",
        "setup.status",
        "search.mode",
        "flights",
        "file.read",
        "file.list",
        "clipboard",
        "clipboard.watch",
        # Reading memory, the model's state and the network are all observation.
        # After a stop the user is usually about to ask what OCADE knows, and
        # answering that must not require restarting the task first.
        "memory.context",
        "memory.preference",
        "llm.status",
        "net.status",
        "vision.look",
        "vision.cameras",
        "game.list",
        "code.review",
        "remote.status",
        "language",
        "presence.briefing",
        "presence.proactive",
        "monitor.check",
        "weather",
        "reminder.list",
        "app.discover",
        "window.read",
        "window.list",
        "system.status",
        "system.volume",
        "system.bluetooth",
        "system.audiodevices",
        "input.release",
        "office.read",
        # Drafting is not sending. It touches nothing, and after a stop the
        # user is often about to ask what OCADE was about to send.
        "message.draft",
        "message.pending",
        "message.discard",
        "voice.status",
        "voice.devices",
        "voice.mic",
        "voice.resume",
        "voice.silence",
        "voice.bargein",
    }
)


HANDLERS: dict[str, Callable[[dict], dict]] = {
    "ui.tree": ui_tree,
    "screen.find": screen_find,
    "app.discover": app_discover,
    "ui.act": ui_act,
    "system.volume": system_volume,
    "system.brightness": system_brightness,
    "system.media": system_media,
    "system.bluetooth": system_bluetooth,
    "system.audiodevices": system_audio_devices,
    "office.read": office_read,
    "office.write": office_write,
    "message.draft": message_draft,
    "message.findcontact": message_find_contact,
    "message.resolve": message_resolve_target,
    "screen.map": screen_map,
    "screen.do": screen_do,
    "message.to": message_to,
    "message.contacts": message_visible_contacts,
    "message.send": message_send,
    "message.pending": message_pending,
    "message.discard": message_discard,
    "voice.speak": voice_speak,
    "voice.silence": voice_silence,
    "voice.listen": voice_listen,
    "voice.bargein": voice_barge_in,
    "voice.status": voice_status,
    "voice.devices": voice_devices,
    "voice.mic": voice_mic,
    "voice.resume": voice_resume,
    "engine.info": engine_info,
    "screen.observe": screen_observe,
    "screen.click": screen_click,
    "web.search.fast": web_search_fast,
    "screen.type": screen_type,
    "screen.act": screen_act,
    "screen.read": screen_read,
    "screen.watch": screen_watch,
    "workspace": workspace,
    "app.open": app_open,
    "folder.open": folder_open,
    "folder.item": folder_item_open,
    "web.search": web_search,
    "memory.remember": memory_remember,
    "memory.recall": memory_recall,
    "memory.forget": memory_forget,
    "memory.project": memory_project,
    "memory.identity": memory_identity,
    "setup.status": setup_status,
    "search.mode": search_modes,
    "flights": flight_find,
    "file.read": file_read,
    "file.list": file_list,
    "system.brightness.set": system_brightness_set,
    "system.wifi": system_wifi,
    "system.power": system_power,
    "system.autostart": system_autostart,
    "clipboard": clipboard_read,
    "clipboard.watch": clipboard_watch,
    "clipboard.act": clipboard_act,
    "memory.context": memory_context,
    "memory.preference": memory_preference,
    "llm.status": llm_status,
    "net.status": net_status,
    "vision.look": vision_look,
    "vision.cameras": vision_cameras,
    "game.list": game_list,
    "game.update": game_update,
    "code.review": code_review,
    "remote.ask": remote_ask,
    "remote.start": remote_start,
    "remote.stop": remote_stop,
    "remote.status": remote_status,
    "language": language_learn,
    "memory.snapshot": memory_snapshot,
    "session.summarise": session_summarise,
    "presence.briefing": briefing,
    "presence.proactive": proactive,
    "monitor.watch": monitor_watch,
    "monitor.check": monitor_check,
    "weather": weather_report,
    "reminder.set": reminder_set,
    "reminder.list": reminder_list,
    "reminder.cancel": reminder_cancel,
    "whatsapp": whatsapp,
    "app.focus": app_focus,
    "input.type": type_text,
    "input.key": press_key,
    "input.mouse": mouse,
    "input.release": release_input,
    "window.read": read_window,
    "window.list": window_list,
    "window.arrange": window_arrange,
    "files": files,
    "system.status": system_status,
}


def handle(request: dict) -> dict:
    """Run one command with the engine's chatter kept off the wire.

    THE ENGINE PRINTS, AND STDOUT IS THE PROTOCOL
    ----------------------------------------------
    Mark-L's actions narrate to stdout — `[open_app] Launching: 'notepad' →
    'notepad.exe'` and dozens like it. Stdout here carries newline-delimited
    JSON, so every one of those lines would be read by OCADE as a malformed
    reply and desynchronise the request/response pairing for the rest of the
    session.

    Worse, and this is how it was found: that particular line contains `→`, and
    a piped stdout on Windows defaults to cp1252, so the print itself raised
    UnicodeEncodeError and the launch "failed" while succeeding.

    So the engine's stdout is pointed at stderr for the duration of every
    command — where the parent can log it — and the reply is written to the real
    stdout afterwards. The engine keeps its logging; the protocol keeps its
    channel.
    """
    if request.get("version") != PROTOCOL_VERSION:
        return {"ok": False, "code": "unsupported", "error": "Unsupported protocol version."}
    command = request.get("command")
    handler = HANDLERS.get(command if isinstance(command, str) else "")
    if handler is None:
        return {"ok": False, "code": "unsupported", "error": f"Unknown command: {command!r}"}
    payload = request.get("payload")
    if not isinstance(payload, dict):
        payload = {}

    # A TRIPPED STOP BLOCKS NEW WORK AT THE ONE PLACE EVERY COMMAND PASSES.
    #
    # Guarding each handler individually would work right up until somebody adds
    # the next handler and forgets, and "the stop button works for fifteen of
    # the sixteen actions" is indistinguishable from a broken stop button.
    #
    # Reads stay allowed: after saying "stop" the user is usually about to ask
    # what happened, and answering that needs observation. Only the commands
    # that CHANGE the machine are refused, and `voice.resume` is what clears it,
    # so recovery is always an explicit act.
    if command not in _STOP_EXEMPT:
        try:
            from core.voice_pipeline import STOP  # noqa: PLC0415

            if STOP.is_set():
                return {
                    "ok": False,
                    "code": "cancelled",
                    "error": (
                        f"OCADE was stopped ({STOP.reason or 'stop requested'}). "
                        "Nothing further will run until the task is started again."
                    ),
                }
        except Exception:  # noqa: BLE001, S110
            # No voice pipeline installed means no barge-in to honour.
            pass

    try:
        with contextlib.redirect_stdout(sys.stderr):
            data = handler(payload)
        return {"ok": True, "data": data}
    except Refusal as refusal:
        return {"ok": False, "code": refusal.code, "error": refusal.message}
    except Exception as error:  # noqa: BLE001
        # Never a stack trace over the wire; the detail goes to stderr where the
        # parent can log it, and the caller gets a sentence.
        traceback.print_exc(file=sys.stderr)
        return {
            "ok": False,
            "code": "retryable_failure",
            "error": f"{type(error).__name__}: {error}"[:300],
        }


def serve() -> None:
    for line in sys.stdin:
        raw = line.strip()
        if not raw:
            continue
        if len(raw.encode("utf-8", "ignore")) > MAX_REQUEST_BYTES:
            reply = {"ok": False, "code": "unsupported", "error": "Request too large."}
        else:
            try:
                reply = handle(json.loads(raw))
            except json.JSONDecodeError:
                reply = {"ok": False, "code": "unsupported", "error": "Unreadable request."}
        sys.stdout.write(json.dumps(reply, default=str) + "\n")
        sys.stdout.flush()


def main() -> None:
    # UTF-8 on both streams. A piped stdout on Windows is cp1252 by default, and
    # the engine's own log lines contain characters cp1252 cannot represent.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    if "--self-test" in sys.argv:
        report = handle({"version": PROTOCOL_VERSION, "command": "engine.info", "payload": {}})
        sys.stdout.write(json.dumps(report, default=str) + "\n")
        sys.stdout.flush()
        return
    serve()


if __name__ == "__main__":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    main()
