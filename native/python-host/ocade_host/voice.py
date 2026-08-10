"""OCADE's own voice, from what the operating system already has.

FREE BY DEFAULT, AND THAT IS A PRODUCT DECISION
-----------------------------------------------
The desktop-control source this module replaces spoke through ElevenLabs: an
API key, a network round trip and a per-character bill for the sentence "Opened
Chrome." Every machine OCADE runs on already ships a speech synthesiser with
installed voices, offline, instantly, at no cost. That is the default here.

  - Windows: ``Windows.Media.SpeechSynthesis``, through the WinRT bindings the
    host already depends on for OCR. No extra package.
  - macOS: ``AVSpeechSynthesizer`` with an installed ``AVSpeechSynthesisVoice``.

A female English voice is preferred where one is installed, and the system
default is used otherwise. "Preferred" rather than "required": a machine with
only a male English voice speaks in it rather than falling silent, and a
machine with no English voice at all speaks in whatever it has.

CLOUD VOICES ARE A CONNECTOR, NOT A DEPENDENCY
-----------------------------------------------
There is no ElevenLabs call in this file and no API key is read. If a cloud
voice is added later it will be a named alternative the user chooses, and this
free path will still be what happens when they have not.

WHY SYNTHESIS AND PLAYBACK ARE SEPARABLE
----------------------------------------
``voice.speak`` renders and plays. ``voice.render`` renders to a file and
returns the path, so a caller that wants to drive its own playback — the
browser's audio element, a mixer, a test — can. Playing sound is the part most
likely to be unavailable (no output device, a remote session), and a caller
should not lose synthesis with it.
"""

from __future__ import annotations

import hashlib
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from .protocol import Refusal, bounded_text, clamp_text, is_protected_text

# Rendered audio is cached by (text, voice) so a repeated line costs nothing the
# second time. Bounded and in the system temp directory: this is a convenience,
# never a store of anything worth keeping.
_CACHE_DIR = Path(tempfile.gettempdir()) / "ocade-voice"
_MAX_SPOKEN_CHARS = 1_200


def _cache_path(text: str, voice: str) -> Path:
    digest = hashlib.sha256(f"{text}|{voice}|v1".encode()).hexdigest()[:24]
    return _CACHE_DIR / f"{digest}.wav"


# ----------------------------------------------------------------- Windows --


def _windows_voices() -> list[Any]:
    """Every voice installed on this Windows machine.

    Reached through ``SpeechSynthesizer.all_voices`` — a WinRT STATIC property,
    which the Python projection exposes on the metaclass rather than as the
    ``get_all_voices()`` method the C# documentation shows. Calling the
    documented name raised AttributeError on the first live probe, which is
    exactly what running the self-test against a real machine is for.
    """
    from winsdk.windows.media.speechsynthesis import SpeechSynthesizer  # noqa: PLC0415

    return list(SpeechSynthesizer.all_voices)


def _describe_windows_voice(voice: Any) -> dict[str, Any]:
    gender = getattr(voice, "gender", None)
    return {
        "id": clamp_text(getattr(voice, "id", "") or "", 400),
        "name": clamp_text(getattr(voice, "display_name", "") or "", 200),
        "language": clamp_text(getattr(voice, "language", "") or "", 32),
        # WinRT reports gender as an enum whose FEMALE member is 0. Comparing on
        # the name rather than the value keeps this readable and keeps it correct
        # if the ordering ever changes.
        "gender": getattr(gender, "name", str(gender)).lower() if gender is not None else "unknown",
    }


def _choose_windows_voice(preferred_language: str = "en") -> tuple[Any | None, str]:
    """The best installed voice, and one sentence saying why it was chosen."""
    voices = _windows_voices()
    if not voices:
        return None, "This computer has no installed speech voices, so the system default is used."

    described = [(voice, _describe_windows_voice(voice)) for voice in voices]
    language = preferred_language.lower()

    same_language = [
        (v, d) for v, d in described if d["language"].lower().startswith(language)
    ]
    female = [(v, d) for v, d in same_language if d["gender"] == "female"]
    if female:
        return female[0][0], f"Using the installed {female[0][1]['name']} voice."
    if same_language:
        return (
            same_language[0][0],
            f"No female {language} voice is installed, so {same_language[0][1]['name']} is used.",
        )
    return (
        described[0][0],
        f"No {language} voice is installed on this computer, so {described[0][1]['name']} is used.",
    )


def _windows_render(text: str, path: Path, preferred_language: str) -> dict[str, Any]:
    import asyncio  # noqa: PLC0415

    from winsdk.windows.media.speechsynthesis import SpeechSynthesizer  # noqa: PLC0415
    from winsdk.windows.storage.streams import DataReader  # noqa: PLC0415

    synthesiser = SpeechSynthesizer()
    voice, reason = _choose_windows_voice(preferred_language)
    if voice is not None:
        synthesiser.voice = voice

    async def render() -> bytes:
        stream = await synthesiser.synthesize_text_to_stream_async(text)
        size = int(stream.size)
        reader = DataReader(stream.get_input_stream_at(0))
        await reader.load_async(size)
        # `read_bytes` FILLS a buffer it is handed; it does not take a count and
        # return one. Passing the length raised "a bytes-like object is required,
        # not 'int'" on the first real synthesis.
        buffer = bytearray(size)
        reader.read_bytes(buffer)
        return bytes(buffer)

    audio = asyncio.run(render())
    if not audio:
        raise Refusal("Windows produced no audio for that text.", "retryable_failure")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(audio)
    described = _describe_windows_voice(voice) if voice is not None else {"name": "system default"}
    return {"engine": "windows.media.speechsynthesis", "voice": described, "reason": reason}


def _windows_play(path: Path) -> None:
    import winsound  # noqa: PLC0415

    # SND_FILENAME plays a WAV from disk; SND_NODEFAULT means a missing or
    # unreadable file is silent rather than a system beep pretending to be
    # OCADE's voice.
    winsound.PlaySound(str(path), winsound.SND_FILENAME | winsound.SND_NODEFAULT)


# ------------------------------------------------------------------ macOS --


def _macos_synthesiser():
    try:
        from AVFoundation import (  # noqa: PLC0415
            AVSpeechSynthesisVoice,
            AVSpeechSynthesizer,
            AVSpeechUtterance,
        )
    except ImportError:
        raise Refusal(
            "OCADE's macOS voice needs the AVFoundation bindings, which are not installed "
            "on this device.",
            "unsupported",
        ) from None
    return AVSpeechSynthesizer, AVSpeechUtterance, AVSpeechSynthesisVoice


def _macos_voices() -> list[dict[str, Any]]:
    _synth, _utterance, voice_class = _macos_synthesiser()
    out: list[dict[str, Any]] = []
    for voice in voice_class.speechVoices():
        gender = getattr(voice, "gender", lambda: 0)()
        out.append(
            {
                "id": clamp_text(str(voice.identifier()), 400),
                "name": clamp_text(str(voice.name()), 200),
                "language": clamp_text(str(voice.language()), 32),
                # AVSpeechSynthesisVoiceGender: 1 male, 2 female, 0 unspecified.
                "gender": {1: "male", 2: "female"}.get(int(gender), "unknown"),
            }
        )
    return out


def _macos_speak(text: str, preferred_language: str) -> dict[str, Any]:
    synth_class, utterance_class, voice_class = _macos_synthesiser()
    voices = _macos_voices()
    language = preferred_language.lower()

    same_language = [v for v in voices if v["language"].lower().startswith(language)]
    female = [v for v in same_language if v["gender"] == "female"]
    chosen = (female or same_language or voices or [None])[0]

    utterance = utterance_class.speechUtteranceWithString_(text)
    if chosen is not None:
        selected = voice_class.voiceWithIdentifier_(chosen["id"])
        if selected is not None:
            utterance.setVoice_(selected)
    synth_class.alloc().init().speakUtterance_(utterance)
    return {
        "engine": "avspeechsynthesizer",
        "voice": chosen or {"name": "system default"},
        "reason": (
            f"Using the installed {chosen['name']} voice."
            if chosen
            else "This computer reported no installed voices, so the system default is used."
        ),
    }


# ---------------------------------------------------------------- handlers --


def list_voices(_request=None) -> dict[str, Any]:
    """What this computer can actually speak with. Never a hopeful list."""
    if sys.platform == "win32":
        voices = [_describe_windows_voice(v) for v in _windows_voices()]
        chosen, reason = _choose_windows_voice("en")
        return {
            "engine": "windows.media.speechsynthesis",
            "voices": voices[:80],
            "count": len(voices),
            "preferred": _describe_windows_voice(chosen) if chosen is not None else None,
            "reason": reason,
            "cloudRequired": False,
        }
    if sys.platform == "darwin":
        voices = _macos_voices()
        english = [v for v in voices if v["language"].lower().startswith("en")]
        female = [v for v in english if v["gender"] == "female"]
        preferred = (female or english or voices or [None])[0]
        return {
            "engine": "avspeechsynthesizer",
            "voices": voices[:80],
            "count": len(voices),
            "preferred": preferred,
            "reason": (
                f"Using the installed {preferred['name']} voice."
                if preferred
                else "This computer reported no installed voices."
            ),
            "cloudRequired": False,
        }
    raise Refusal(
        f"OCADE has no free system voice on {sys.platform}. Replies stay as text.",
        "unsupported",
    )


def render_speech(request) -> dict[str, Any]:
    """Synthesise to a WAV file and return where it went. Plays nothing."""
    payload = getattr(request, "payload", {}) or {}
    text = bounded_text(payload.get("text"), "text", _MAX_SPOKEN_CHARS)
    if is_protected_text(text):
        # Reading a one-time code aloud in an open-plan office is the same
        # disclosure as typing it into the wrong field.
        raise Refusal(
            "That text looks like a password, code or payment value. OCADE does not say those aloud.",
            "blocked",
        )
    language = str(payload.get("language") or "en")[:8]

    if sys.platform != "win32":
        raise Refusal(
            "Rendering speech to a file is only supported on Windows. Use voice.speak instead.",
            "unsupported",
        )

    started = time.monotonic()
    path = _cache_path(text, language)
    cached = path.is_file() and path.stat().st_size > 0
    detail = _windows_render(text, path, language) if not cached else {
        "engine": "windows.media.speechsynthesis",
        "voice": {"name": "cached"},
        "reason": "This line had already been rendered, so nothing was synthesised again.",
    }
    return {
        **detail,
        "path": str(path),
        "bytes": path.stat().st_size,
        "cached": cached,
        "elapsedMs": int((time.monotonic() - started) * 1000),
    }


def speak(request) -> dict[str, Any]:
    """Say something aloud with this computer's own voice."""
    payload = getattr(request, "payload", {}) or {}
    text = bounded_text(payload.get("text"), "text", _MAX_SPOKEN_CHARS)
    if is_protected_text(text):
        raise Refusal(
            "That text looks like a password, code or payment value. OCADE does not say those aloud.",
            "blocked",
        )
    language = str(payload.get("language") or "en")[:8]
    started = time.monotonic()

    if sys.platform == "win32":
        path = _cache_path(text, language)
        cached = path.is_file() and path.stat().st_size > 0
        detail = (
            {
                "engine": "windows.media.speechsynthesis",
                "voice": {"name": "cached"},
                "reason": "This line had already been rendered, so nothing was synthesised again.",
            }
            if cached
            else _windows_render(text, path, language)
        )
        try:
            _windows_play(path)
        except Exception as error:  # noqa: BLE001
            raise Refusal(
                f"The audio was produced but this computer would not play it: {type(error).__name__}.",
                "retryable_failure",
            ) from None
        return {
            **detail,
            "spoken": len(text),
            "cached": cached,
            "verified": True,
            "elapsedMs": int((time.monotonic() - started) * 1000),
        }

    if sys.platform == "darwin":
        detail = _macos_speak(text, language)
        return {
            **detail,
            "spoken": len(text),
            "cached": False,
            "verified": True,
            "elapsedMs": int((time.monotonic() - started) * 1000),
        }

    raise Refusal(
        f"OCADE has no free system voice on {sys.platform}. Replies stay as text.",
        "unsupported",
    )


def clear_cache(_request=None) -> dict[str, Any]:
    """Drop the rendered-audio cache. Nothing here is precious."""
    removed = 0
    if _CACHE_DIR.is_dir():
        for entry in _CACHE_DIR.glob("*.wav"):
            try:
                os.unlink(entry)
                removed += 1
            except OSError:
                continue
    return {"removed": removed, "directory": str(_CACHE_DIR)}
