"""The desktop, voice and microphone tools, tested at their boundaries.

These cover the parts that must hold on every machine — the refusals, the
bounds and the voice-selection rule — rather than the Windows APIs behind them.
Whether a particular laptop owns a female English voice is a fact about that
laptop; whether OCADE PREFERS one when it exists is a fact about this code, and
that is what is asserted here.
"""

from __future__ import annotations

import sys
from types import SimpleNamespace

import pytest

from ocade_host import act, audio, desktop, voice, workspace
from ocade_host.protocol import Refusal


def request(**payload) -> SimpleNamespace:
    return SimpleNamespace(payload=payload, command="test", run_id="t", version=1)


class TestApplicationLaunch:
    def test_an_unknown_application_is_refused_by_name(self) -> None:
        with pytest.raises(Refusal) as caught:
            desktop.launch_application(request(name="no-such-application-anywhere"))
        assert caught.value.code == "unsupported"
        assert "no-such-application-anywhere" in caught.value.message

    def test_a_missing_name_is_refused_rather_than_defaulted(self) -> None:
        # A launcher that picks something when asked for nothing is a launcher
        # that opens the wrong thing.
        with pytest.raises(Refusal):
            desktop.launch_application(request())


class TestDisplays:
    def test_display_list_reports_a_count_that_matches_its_rows(self) -> None:
        report = desktop.list_displays()
        assert report["count"] == len(report["displays"])
        for index, display in enumerate(report["displays"]):
            assert display["index"] == index + 1
            assert display["bounds"]["width"] > 0

    @pytest.mark.skipif(sys.platform != "win32", reason="window placement is Windows-only")
    def test_a_display_that_does_not_exist_is_refused(self) -> None:
        with pytest.raises(Refusal) as caught:
            desktop._display_bounds(99)
        assert caught.value.code == "unsupported"

    @pytest.mark.skipif(sys.platform != "win32", reason="window placement is Windows-only")
    def test_an_unknown_layout_is_refused(self) -> None:
        with pytest.raises(Refusal) as caught:
            desktop.arrange_window(request(hwnd=None, layout="diagonally"))
        assert caught.value.code == "unsupported"


class TestVoiceIsFreeAndLocal:
    @pytest.mark.skipif(sys.platform not in ("win32", "darwin"), reason="no free system voice")
    def test_the_device_reports_its_own_voices_without_a_cloud_service(self) -> None:
        report = voice.list_voices()
        assert report["cloudRequired"] is False
        assert report["count"] == len(report["voices"]) or report["count"] >= len(report["voices"])
        assert report["engine"] in ("windows.media.speechsynthesis", "avspeechsynthesizer")

    def test_a_credential_is_never_spoken_aloud(self) -> None:
        # Saying a one-time code in an open-plan office is the same disclosure
        # as typing it into the wrong field.
        with pytest.raises(Refusal) as caught:
            voice.speak(request(text="your verification code is 448120"))
        assert caught.value.code == "blocked"

    def test_empty_text_is_refused(self) -> None:
        with pytest.raises(Refusal):
            voice.speak(request(text="   "))

    @pytest.mark.skipif(sys.platform != "win32", reason="voice choice is per-platform")
    def test_a_female_english_voice_is_preferred_when_one_is_installed(self) -> None:
        chosen, reason = voice._choose_windows_voice("en")
        if chosen is None:
            pytest.skip("this machine has no installed voices")
        described = voice._describe_windows_voice(chosen)
        installed = [voice._describe_windows_voice(v) for v in voice._windows_voices()]
        english_female = [
            v for v in installed if v["language"].lower().startswith("en") and v["gender"] == "female"
        ]
        if english_female:
            assert described["gender"] == "female"
            assert described["language"].lower().startswith("en")
        assert reason


class TestMicrophoneListensAreBounded:
    def test_a_listen_longer_than_the_ceiling_is_refused(self) -> None:
        with pytest.raises(Refusal) as caught:
            audio.listen(request(seconds=audio.MAX_LISTEN_S + 1))
        assert caught.value.code == "unsupported"

    def test_a_listen_of_zero_seconds_is_refused(self) -> None:
        with pytest.raises(Refusal):
            audio.listen(request(seconds=0))

    def test_a_negative_listen_is_refused(self) -> None:
        with pytest.raises(Refusal):
            audio.listen(request(seconds=-3))


class TestTheTemporaryFolder:
    """OCADE's workspace is one directory, and every path resolves inside it."""

    def test_a_relative_escape_is_refused_rather_than_clamped(self) -> None:
        # Clamping would hand back a different file than the caller asked for,
        # which is a lie told quietly. Refusing teaches the rule.
        with pytest.raises(Refusal) as caught:
            workspace.write_file(request(name="../escaped.txt", content="no"))
        assert caught.value.code == "blocked"

    def test_an_absolute_path_is_refused(self) -> None:
        with pytest.raises(Refusal) as caught:
            workspace.write_file(request(name="C:/Windows/System32/x.txt", content="no"))
        assert caught.value.code == "blocked"

    @pytest.mark.parametrize("name", ["run.bat", "go.ps1", "thing.exe", "x.vbs", "y.cmd"])
    def test_files_the_operating_system_would_run_are_refused(self, name: str) -> None:
        with pytest.raises(Refusal) as caught:
            workspace.write_file(request(name=name, content="echo hi"))
        assert caught.value.code == "blocked"

    def test_credential_shaped_content_is_never_written_to_disk(self) -> None:
        with pytest.raises(Refusal) as caught:
            workspace.write_file(request(name="note.txt", content="my password is hunter2"))
        assert caught.value.code == "blocked"

    def test_a_write_is_verified_by_reading_it_back(self) -> None:
        written = workspace.write_file(
            request(name="ocade-test-note.txt", content="OCADE wrote this.")
        )
        assert written["verified"] is True
        read = workspace.read_file(request(name="ocade-test-note.txt"))
        assert read["content"] == "OCADE wrote this."

    def test_reading_a_file_that_is_not_there_says_so(self) -> None:
        with pytest.raises(Refusal) as caught:
            workspace.read_file(request(name="definitely-not-here.txt"))
        assert caught.value.code == "state_changed"


class TestKeyboard:
    """The keys OCADE will send, and the ones it will not."""

    def test_a_credential_is_never_typed(self) -> None:
        with pytest.raises(Refusal) as caught:
            act.type_text(request(text="my password is hunter2"))
        assert caught.value.code == "blocked"

    def test_empty_text_is_refused(self) -> None:
        with pytest.raises(Refusal):
            act.type_text(request(text="   "))

    def test_a_key_outside_the_closed_set_is_refused(self) -> None:
        with pytest.raises(Refusal) as caught:
            act.press_keys(request(key="printscreen"))
        assert caught.value.code == "unsupported"

    def test_the_windows_modifier_is_not_available(self) -> None:
        # Win+R is a command line one keystroke away, so the modifier itself is
        # simply not in the vocabulary.
        with pytest.raises(Refusal) as caught:
            act.press_keys(request(key="r", modifiers=["win"]))
        assert caught.value.code == "unsupported"

    def test_a_chord_that_hands_over_the_machine_is_refused_by_name(self) -> None:
        with pytest.raises(Refusal) as caught:
            act.press_keys(request(key="f4", modifiers=["alt"]))
        assert caught.value.code in ("blocked", "unsupported")


class TestHandlerTable:
    def test_every_new_capability_is_reachable_by_name(self) -> None:
        # The command table is the whole public surface. A tool that exists in a
        # module but not in this table is a tool nobody can call.
        from ocade_host.__main__ import HANDLERS

        for command in (
            "app.launch",
            "app.focus",
            "display.list",
            "window.arrange",
            "audio.microphones",
            "audio.listen",
            "voice.list",
            "voice.speak",
            "voice.render",
            "input.type",
            "input.key",
            "input.release",
            "workspace.info",
            "workspace.list",
            "workspace.read",
            "workspace.write",
            "workspace.open",
            "workspace.discard",
        ):
            assert command in HANDLERS, command
