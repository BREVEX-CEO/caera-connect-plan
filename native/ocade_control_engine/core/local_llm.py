"""The local brain, shaped like the remote one the engine used to call.

WHY A SHIM AND NOT A REWRITE
----------------------------
Nine modules in this engine called Gemini through the same two lines:

    client   = genai.Client(api_key=_get_api_key())
    response = client.models.generate_content(model=..., contents=prompt)
    text     = response.text

Rewriting each call site by hand would have touched a hundred places and
changed behaviour in every one of them. This presents the same
`.generate_content(...) -> .text` shape over `core.llm_client`, so the
replacement is a one-line substitution per module and the prompts, the
fallbacks and the error handling around them stay exactly as they were.

WHAT THIS DELIBERATELY CANNOT DO
--------------------------------
See. `qwen3:4b` is a text model. Gemini was multimodal, and several call
sites passed an image alongside the prompt — `generate_content([prompt, img])`
— for "describe this picture" and "find this button on screen".

Those cannot be quietly downgraded to a text-only answer: a caller that asks
what is in a photograph and receives a confident paragraph written without
looking at it has been given something worse than an error. So an image
argument raises, by name, and the callers turn that into an honest refusal.

OCADE's real eyes are UI Automation structure and the operating system's own
OCR — local, free, and faster than a vision model. That is the path screen
work goes down; this shim is for language.

There is no API key anywhere in this file, and no network call that leaves
the machine: `llm_client` talks to Ollama on localhost.
"""

from __future__ import annotations

from typing import Any

from core.llm_client import OCADE_MODEL, call_llm_text


class VisionUnavailable(RuntimeError):
    """Raised when a caller passes an image to a text-only local model."""


class _Reply:
    """A response object with the one attribute every call site reads."""

    __slots__ = ("text",)

    def __init__(self, text: str) -> None:
        self.text = text


class LocalModel:
    """`generate_content` over the local model, with no key and no network."""

    def __init__(
        self,
        system: str | None = None,
        think: bool = False,
        timeout: int = 120,
        model: str | None = None,
    ) -> None:
        self._system = system
        self._think = think
        self._timeout = timeout
        self._model = model or OCADE_MODEL

    def generate_content(self, contents: Any) -> _Reply:
        return _Reply(call_llm_text(
            prompt=_as_prompt(contents),
            system=self._system,
            model=self._model,
            timeout=self._timeout,
            think=self._think,
        ))


def _as_prompt(contents: Any) -> str:
    """Flatten Gemini's `contents` argument into one prompt, or refuse.

    Gemini accepted a string, or a list mixing strings with PIL images. The
    string case is the whole of what a text model can honour; anything that is
    not a string in that list is an image, and pretending otherwise is how a
    caller ends up with an invented description of a photograph it never saw.
    """
    if isinstance(contents, str):
        return contents

    if isinstance(contents, (list, tuple)):
        parts = [part for part in contents if isinstance(part, str)]
        if len(parts) != len(contents):
            raise VisionUnavailable(
                "This needs to look at an image, and the local model is text-only. "
                "OCADE reads the screen with UI Automation and the system's own OCR "
                "instead — it does not guess at pictures."
            )
        return "\n\n".join(parts)

    raise VisionUnavailable(
        f"The local model takes text, not {type(contents).__name__}."
    )


def local_model(
    system: str | None = None,
    think: bool = False,
    timeout: int = 120,
    model: str | None = None,
) -> LocalModel:
    """Drop-in for the engine's old `_gemini_client()` helpers."""
    return LocalModel(system=system, think=think, timeout=timeout, model=model)
