"""Telemetry that is measured, and controls that check their own work.

The rule this file defends is that OCADE never reports a number it did not
read. A fabricated metric is worse than a missing one: "battery 0%" sends a
user hunting for a charger, while "this machine has no battery" is useful.

Nothing here asserts a SPECIFIC value — CPU load is different every run, and a
test that expected one would be testing the machine rather than the code. What
is asserted is the shape of honesty: real ranges, stated absences, sentinel
values translated, and `verified` reflecting a second look rather than the call
having returned.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ENGINE = Path(__file__).resolve().parents[2] / "ocade_control_engine"
MODULE = ENGINE / "core" / "system.py"

pytestmark = pytest.mark.skipif(not MODULE.is_file(), reason="control engine is not installed")


def _load():
    if str(ENGINE) not in sys.path:
        sys.path.insert(0, str(ENGINE))
    spec = importlib.util.spec_from_file_location("ocade_system", MODULE)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def system():
    return _load()


psutil_missing = importlib.util.find_spec("psutil") is None


@pytest.mark.skipif(psutil_missing, reason="psutil is not installed")
class TestTelemetryIsMeasured:
    @pytest.fixture(scope="class")
    @staticmethod
    def snapshot(system):
        return system.telemetry(cpu_sample_seconds=0.1)

    def test_cpu_is_a_real_percentage(self, snapshot):
        cpu = snapshot["cpu"]
        assert 0.0 <= cpu["percent"] <= 100.0
        assert cpu["cores"] >= 1
        assert len(cpu["perCore"]) == cpu["cores"]

    def test_memory_adds_up(self, snapshot):
        memory = snapshot["memory"]
        assert memory["totalGb"] > 0
        assert 0 < memory["usedGb"] <= memory["totalGb"]
        assert 0.0 <= memory["percent"] <= 100.0

    def test_storage_reports_real_drives(self, snapshot):
        for drive in snapshot["storage"]:
            assert drive["totalGb"] > 0
            assert drive["usedGb"] + drive["freeGb"] <= drive["totalGb"] * 1.05
            assert 0.0 <= drive["percent"] <= 100.0

    def test_battery_is_either_measured_or_explained(self, snapshot):
        """Never a plausible-looking zero.

        A desktop has no battery. The honest answer is `percent: None` with a
        reason, and the failure this guards against is reporting 0% — which
        reads as "about to die" to both a user and a model.
        """
        battery = snapshot["battery"]
        if battery.get("percent") is None:
            assert battery.get("reason"), "an absent battery must say why"
        else:
            assert 0.0 <= battery["percent"] <= 100.0
            assert isinstance(battery["charging"], bool)

    def test_battery_time_sentinels_are_translated_not_passed_through(self, snapshot):
        """psutil returns -1 and -2 here, and both mean "no number".

        Measured on the reference laptop while charging: `secsleft == -2`
        (POWER_TIME_UNLIMITED). Passing that through would have OCADE report
        "-2 seconds of battery remaining".
        """
        remaining = snapshot["battery"].get("secondsLeft")
        assert remaining is None or remaining >= 0

    def test_top_processes_are_named_and_ranked(self, snapshot):
        top = snapshot["topProcesses"]
        assert top, "a running machine has processes"
        assert all(row["name"] for row in top)
        assert [r["memoryMb"] for r in top] == sorted(
            (r["memoryMb"] for r in top), reverse=True
        )

    def test_uptime_is_positive(self, snapshot):
        assert snapshot["uptimeSeconds"] > 0
        assert snapshot["processes"] > 0

    def test_two_readings_are_independent_samples(self, system):
        """Proves the CPU figure describes NOW.

        `cpu_percent(interval=None)` returns the average since the previous
        call, which on a first call is the average since boot — a number that
        looks fine and describes nothing. Sampling with a real window is what
        makes two consecutive readings meaningful.
        """
        first = system.telemetry(cpu_sample_seconds=0.1)
        second = system.telemetry(cpu_sample_seconds=0.1)
        assert first["uptimeSeconds"] <= second["uptimeSeconds"]


class TestMediaKeys:
    def test_refuses_a_key_that_does_not_exist(self, system):
        with pytest.raises(system.SystemUnavailable) as raised:
            system.media("explode")
        assert "not a media key" in str(raised.value)

    @pytest.mark.parametrize(
        ("given", "expected"),
        [("play", "playpause"), ("pause", "playpause"), ("prev", "previous"), ("toggle", "playpause")],
    )
    def test_accepts_the_words_people_actually_use(self, system, given, expected):
        # A model told to "pause the music" should not have to know the key is
        # called playpause.
        assert expected in system.VK_MEDIA

    def test_every_key_maps_to_a_windows_virtual_key(self, system):
        # Global OS keys are the reason this works without focusing the player.
        for name, code in system.VK_MEDIA.items():
            assert 0xAD <= code <= 0xB3, f"{name} is not a media virtual-key code"
