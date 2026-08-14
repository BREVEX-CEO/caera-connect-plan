"""The perception ladder's matching rules, and app discovery.

The matcher is the dangerous part. Everything above it is careful — UIA states
facts, OCR reports real bounds — and all of that is wasted if a loose match
hands back the wrong element, because the layer above will click it.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ENGINE = Path(__file__).resolve().parents[2] / "ocade_control_engine"
PERCEPTION = ENGINE / "core" / "perception.py"
APPS = ENGINE / "core" / "apps.py"

pytestmark = pytest.mark.skipif(not PERCEPTION.is_file(), reason="control engine is not installed")


def _load(path: Path, name: str):
    if str(ENGINE) not in sys.path:
        sys.path.insert(0, str(ENGINE))
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def perception():
    return _load(PERCEPTION, "ocade_perception")


@pytest.fixture(scope="module")
def apps():
    return _load(APPS, "ocade_apps")


class TestMatching:
    def test_an_exact_label_is_certain(self, perception):
        assert perception._match_score("Save", "Save") == 1.0

    def test_a_prefix_scores_well(self, perception):
        assert perception._match_score("Save", "Save As...") >= 0.75

    def test_case_and_spacing_do_not_matter(self, perception):
        assert perception._match_score("  SAVE   as ", "Save As") == 1.0

    def test_a_single_letter_does_not_match_a_sentence(self, perception):
        """THE BUG THIS FILE WAS WRITTEN FOR.

        A live run asked for "a control that does not exist here" and the OCR
        rung returned a line reading "x" at confidence 0.64 — because "x" is
        inside "exist". One character is a substring of nearly everything, so
        without a length floor the fallback confidently returns junk, and the
        layer above clicks it.
        """
        assert perception._match_score("a control that does not exist here", "x") == 0.0
        assert perception._match_score("Save the document", "e") == 0.0

    def test_a_short_fragment_does_not_match_a_long_label(self, perception):
        # "on" is inside "Continue", "Cancel" and half the words on a screen.
        assert perception._match_score("Open the configuration panel now", "on") == 0.0

    def test_an_unrelated_label_scores_nothing(self, perception):
        assert perception._match_score("Save", "Delete everything") == 0.0

    def test_word_overlap_still_finds_a_real_match(self, perception):
        assert perception._match_score("Save button", "Save") >= 0.5

    def test_everything_returned_clears_the_floor(self, perception):
        # The floor is what stops a 0.1-confidence "closest thing I saw" from
        # being offered as an answer.
        assert perception.MATCH_FLOOR >= 0.5


class TestVisionIsGatedOnEvidence:
    def test_the_measurement_is_recorded_next_to_the_default(self, perception):
        """Why the vision rung is off is a measurement, not an opinion.

        LATENCY IS NO LONGER THE ASSERTION, AND THAT IS THE POINT OF THE
        RE-MEASUREMENT. This required every sample to exceed 60 s, which was
        true of the original two. Four fresh samples on 2026-08-13 ranged from
        10.3 s to 212.7 s — so "always slow" is simply not the invariant, and a
        test asserting it would fail on a machine that got faster while still
        being wrong.

        Accuracy is the invariant that actually justifies the default: zero of
        four answers landed inside the image. A fast wrong answer is still an
        answer OCADE must refuse to click.
        """
        measurement = perception.VISION_MEASUREMENT
        assert measurement["samples"], "the default must cite real runs"
        assert all(s["inBounds"] is False for s in measurement["samples"])
        # Slow ENOUGH to matter, judged on the median rather than the best case.
        seconds = sorted(s["seconds"] for s in measurement["samples"])
        assert seconds[len(seconds) // 2] > 60

    def test_the_default_matches_the_evidence(self, perception):
        """The switch and the measurement cannot drift apart.

        If someone flips the default on without re-measuring, this fails and
        says so — which is the only thing standing between "implemented and
        gated" and "on by default and wrong 100% of the time".
        """
        all_out_of_bounds = all(
            s["inBounds"] is False for s in perception.VISION_MEASUREMENT["samples"]
        )
        if all_out_of_bounds:
            assert perception.VISION_ENABLED_BY_DEFAULT is False, (
                "every recorded sample was out of bounds, so the vision rung must not "
                "run unasked. Re-measure and update VISION_MEASUREMENT before enabling it."
            )

    @pytest.mark.parametrize(
        ("x", "y", "ok"),
        [(10, 10, True), (0, 0, True), (800, 450, True), (12, 637, False), (-5, 10, False)],
    )
    def test_out_of_bounds_coordinates_are_refused(self, perception, x, y, ok):
        """Both live samples returned a Y outside the image.

        (12, 637) is the real reply from a run against an 800x450 screenshot.
        Without this check that becomes a click near the bottom of the screen,
        on whatever happens to be there.
        """
        assert (perception._validate_point(x, y, 800, 450) is not None) is ok

    def test_a_non_numeric_coordinate_is_refused(self, perception):
        assert perception._validate_point("left", "top", 800, 450) is None
        assert perception._validate_point(None, None, 800, 450) is None


class TestAppDiscovery:
    def test_junk_names_are_not_offered_as_applications(self, apps):
        # `[.exe` is a real file in Git's bin directory.
        assert apps._is_noise("Uninstall Blender") is True
        assert apps._is_noise("Blender") is False

    @pytest.mark.skipif(sys.platform != "win32", reason="Windows only")
    def test_discovery_finds_launchable_executables(self, apps):
        found = apps.discover()
        assert found["count"] > 0
        for row in found["applications"][:20]:
            assert row["executable"], f"{row['name']} has no executable to launch"
            assert Path(row["executable"]).exists()

    @pytest.mark.skipif(sys.platform != "win32", reason="Windows only")
    def test_the_most_trusted_sources_survive_truncation(self, apps):
        """PATH contributed 413 of 563 entries on the reference machine.

        Sorted alphabetically and cut at the limit, that buried the real
        applications under system binaries.
        """
        rows = apps.discover()["applications"]
        assert rows[0]["confidence"] >= 0.9

    def test_an_unknown_application_is_refused_not_guessed(self, apps):
        result = apps.resolve("definitely-not-installed-anywhere-xyz")
        assert result["found"] is False
        assert "No installed application matches" in result["detail"]

    def test_an_empty_name_is_refused(self, apps):
        assert apps.resolve("")["found"] is False


class TestThePointerRungIsALastResort:
    """`pyautogui` is reachable for exactly one purpose, and only through gates.

    The product claim is that the physical mouse is a last resort. That claim is
    only worth anything if the code refuses the shortcuts — clicking a control
    the accessibility tree could operate, or clicking a coordinate nobody found.
    """

    def test_a_target_the_accessibility_tree_owns_is_refused(self, perception):
        with pytest.raises(perception.PerceptionUnavailable) as raised:
            perception.click_target(
                {
                    "source": "uia",
                    "label": "Save",
                    "bounds": {"x": 10, "y": 10, "width": 20, "height": 20},
                }
            )
        assert "ui_act" in str(raised.value)

    @pytest.mark.parametrize("source", ["guess", "", "model", None])
    def test_a_coordinate_with_no_provenance_is_refused(self, perception, source):
        """No raw-coordinate path. A click has to come from something found."""
        with pytest.raises(perception.PerceptionUnavailable):
            perception.click_target(
                {"source": source, "bounds": {"x": 5, "y": 5, "width": 4, "height": 4}}
            )

    def test_a_stale_off_screen_coordinate_is_refused(self, perception):
        """The hazard of this rung is a coordinate found before something moved."""
        with pytest.raises(perception.PerceptionUnavailable) as raised:
            perception.click_target(
                {
                    "source": "vision",
                    "bounds": {"x": 99_999, "y": 99_999, "width": 10, "height": 10},
                }
            )
        assert "outside the screen" in str(raised.value)

    def test_a_target_with_no_bounds_is_refused(self, perception):
        with pytest.raises(perception.PerceptionUnavailable):
            perception.click_target({"source": "ocr", "bounds": {}})


class TestPointerUsedIsStated:
    """`pointerUsed` is a field, not something inferred from a method name."""

    def test_the_pointer_method_set_is_the_single_source(self):
        from core import uia

        assert "pointer_fallback" in uia._POINTER_METHODS
        assert "uia_pointer_click" in uia._POINTER_METHODS
        # The accessibility patterns must never be counted as pointer use.
        for clean in ("value_pattern", "invoke_pattern", "toggle_pattern", "focus"):
            assert clean not in uia._POINTER_METHODS
