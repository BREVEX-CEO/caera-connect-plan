"""The voice pipeline's safety rules, tested where getting them wrong is silent.

Everything here is about the STOP path. Speech quality is a matter of taste and
a user can hear it for themselves; a stop that does not stop is invisible until
it matters, and by then it matters on somebody's real computer with their real
mouse held down.

The audio hardware is deliberately not touched. These are the decisions the
pipeline makes ABOUT audio — which words end a task, what a stop reaches, and
whether a tripped stop stays tripped — all of which are pure and must hold on a
machine with no microphone at all.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ENGINE = Path(__file__).resolve().parents[2] / "ocade_control_engine"
MODULE = ENGINE / "core" / "voice_pipeline.py"

pytestmark = pytest.mark.skipif(not MODULE.is_file(), reason="control engine is not installed")


def _load():
    if str(ENGINE) not in sys.path:
        sys.path.insert(0, str(ENGINE))
    spec = importlib.util.spec_from_file_location("ocade_voice_pipeline", MODULE)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def vp():
    module = _load()
    module.STOP.clear()
    yield module
    module.STOP.clear()


class TestStopWords:
    """What counts as the user interrupting."""

    @pytest.mark.parametrize(
        "said",
        ["stop", "Stop!", "STOP", "wait", "cancel", "halt", "abort", "quiet", "shut up", "enough"],
    )
    def test_hears_an_interruption(self, vp, said):
        assert vp.is_stop_phrase(said) is True

    @pytest.mark.parametrize(
        "said",
        [
            # THE FALSE POSITIVES THAT MATTER. Each of these contains a stop word
            # as a substring, and a naive `"stop" in text` would kill the user's
            # task for every one of them.
            "stopped the car",
            "unstoppable",
            "a stopwatch",
            "waiting for the download",
            "cancellation policy",
            "the cancelled order",
            "quietly close the file",
            # Ordinary work that merely mentions stopping.
            "write a note about when to stop",
        ],
    )
    def test_does_not_hear_an_interruption(self, vp, said):
        assert vp.is_stop_phrase(said) is False

    def test_silence_is_not_a_stop(self, vp):
        assert vp.is_stop_phrase("") is False
        assert vp.is_stop_phrase("   ") is False


class TestStopSignal:
    """The one switch everything watches."""

    def test_trip_notifies_every_listener(self, vp):
        fired = []
        vp.STOP.on_stop(lambda: fired.append("speech"))
        vp.STOP.on_stop(lambda: fired.append("input"))
        vp.STOP.trip("heard stop")
        assert fired == ["speech", "input"]
        assert vp.STOP.is_set() is True
        assert vp.STOP.reason == "heard stop"

    def test_a_broken_listener_cannot_strand_the_others(self, vp):
        """The reason the callback loop swallows exceptions.

        If the first listener raises and that propagates, the listener that
        releases a held mouse button never runs — and the user is left with the
        button down on a task they just cancelled.
        """
        fired = []

        def explodes():
            raise RuntimeError("this listener is broken")

        vp.STOP.on_stop(explodes)
        vp.STOP.on_stop(lambda: fired.append("input released"))
        vp.STOP.trip("heard stop")
        assert fired == ["input released"]

    def test_tripping_twice_notifies_once(self, vp):
        fired = []
        vp.STOP.on_stop(lambda: fired.append(1))
        vp.STOP.trip("first")
        vp.STOP.trip("second")
        assert fired == [1]
        # The FIRST reason survives: it is the one that describes what actually
        # interrupted the work.
        assert vp.STOP.reason == "first"

    def test_stays_stopped_until_explicitly_cleared(self, vp):
        vp.STOP.trip("heard stop")
        assert vp.STOP.is_set() is True
        vp.STOP.clear()
        assert vp.STOP.is_set() is False
        assert vp.STOP.reason is None

    def test_long_work_can_check_and_abort(self, vp):
        vp.STOP.raise_if_stopped()  # not stopped: returns quietly
        vp.STOP.trip("heard stop")
        with pytest.raises(vp.Interrupted):
            vp.STOP.raise_if_stopped()


class TestVoiceSelection:
    """OCADE has one voice, and picks it in preference order."""

    def test_prefers_zira_over_hazel(self, vp):
        """The bug this test exists for.

        The first implementation scanned the machine's voice list once and took
        whatever matched any preferred name. SAPI on the reference machine
        returns [Hazel (en-GB), Zira (en-US)], so it selected the FALLBACK while
        reporting success — an en-GB voice on a product that specifies en-US,
        with nothing in the output to show anything had gone wrong.
        """
        assert vp.ZiraVoice.PREFERRED[0] == "Zira"
        assert "Hazel" in vp.ZiraVoice.PREFERRED

    def test_audio_constants_satisfy_both_consumers(self, vp):
        # webrtcvad accepts only 8/16/32/48 kHz; Whisper wants 16 kHz. 16 kHz is
        # the only value that needs no resampling between them.
        assert vp.SAMPLE_RATE == 16_000
        assert vp.FRAME_MS in (10, 20, 30)
        assert vp.FRAME_SAMPLES == vp.SAMPLE_RATE * vp.FRAME_MS // 1000
