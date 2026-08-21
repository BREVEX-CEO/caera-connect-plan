"""Search modes, file reading, and the OS layer — the parts that need no network.

Every case here is either pure logic or a guard. The live halves (a real
search, a real brightness change) are proven by driving the bridge, because a
test that asserts DuckDuckGo returned three results is a test that fails on a
train.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ENGINE = Path(__file__).resolve().parents[1]
if str(ENGINE) not in sys.path:
    sys.path.insert(0, str(ENGINE))


class TestSearchModes:
    def test_every_mode_shapes_the_query_differently(self) -> None:
        """One query shape answers all five questions badly.

        A news query sorted by relevance returns a 2019 article; a price query
        without the word "price" returns Wikipedia. The shaping IS the feature.
        """
        from actions.knowledge import _MODES, modes

        assert set(modes()) == {"search", "news", "research", "price", "compare"}
        shaped = {name: template.format(q="X") for name, template in _MODES.items()}
        assert shaped["search"] == "X"
        assert len(set(shaped.values())) == len(shaped), "two modes build the same query"
        for name in ("news", "research", "price", "compare"):
            assert shaped[name] != "X", f"{name} adds nothing to the query"

    def test_an_unknown_mode_is_refused_rather_than_defaulted(self) -> None:
        from actions.knowledge import search_mode

        got = search_mode("anything", "telepathy")
        assert got["status"] == "invalid"
        assert got["verified"] is False

    def test_an_empty_query_never_reaches_the_network(self) -> None:
        from actions.knowledge import search_mode

        assert search_mode("   ", "news")["status"] == "invalid"


class TestFileAccessIsBounded:
    def test_a_path_cannot_escape_its_folder(self) -> None:
        """THE CHECK THAT MAKES THE CLOSED SET OF ROOTS MEAN ANYTHING.

        Without it, `../../.ssh/id_rsa` is a valid "name" and "files are read
        from Documents" is a sentence rather than a boundary.
        """
        from actions.knowledge import _resolve_under_root

        for escape in ("../../.ssh/id_rsa", r"..\..\secrets.txt", "../../../windows/system32"):
            with pytest.raises(ValueError, match="outside"):
                _resolve_under_root("documents", escape)

    def test_a_sibling_folder_with_the_same_prefix_is_refused(self) -> None:
        """REGRESSION. The boundary was a string prefix, not a path check.

        With Documents approved, `../Documents-backup/secret.txt` resolves to
        a completely different directory — and passed, because that path does
        start with the same characters as the approved one. Anything named
        `Documents<something>` beside it was readable.
        """
        from actions.knowledge import _resolve_under_root

        for escape in (
            "../Documents-backup/secret.txt",
            "../Documents_private/keys.txt",
            "../Documents.old/notes.txt",
        ):
            with pytest.raises(ValueError, match="outside"):
                _resolve_under_root("documents", escape)

    def test_an_absolute_path_is_not_a_name_inside_a_folder(self) -> None:
        from actions.knowledge import _resolve_under_root

        for absolute in ("/etc/passwd", "C:/Windows/win.ini", "//server/share/x"):
            with pytest.raises(ValueError, match="outside"):
                _resolve_under_root("documents", absolute)

    def test_an_ordinary_name_inside_the_folder_still_resolves(self) -> None:
        """The other half: a boundary that refuses everything is not a boundary."""
        from actions.knowledge import _resolve_under_root

        resolved = _resolve_under_root("documents", "sub/report.txt")
        assert resolved.name == "report.txt"
        assert "Documents" in str(resolved)

    def test_only_approved_folders_are_readable(self) -> None:
        from actions.knowledge import _resolve_under_root

        for folder in ("system32", "appdata", "", "C:/"):
            with pytest.raises(ValueError):
                _resolve_under_root(folder, "anything.txt")

    def test_a_missing_file_is_reported_not_invented(self) -> None:
        from actions.knowledge import read_file

        got = read_file("documents", "definitely-not-here-9f3a.txt")
        assert got["exists"] is False
        assert got["verified"] is False


class TestPowerNeedsConfirmation:
    @pytest.mark.parametrize("action", ["shutdown", "restart", "reboot"])
    def test_destructive_power_actions_refuse_without_confirmation(self, action: str) -> None:
        """These close unsaved work belonging to somebody not at the screen.

        Unlike every other action OCADE takes there is no undo and no receipt
        to read afterwards, because the machine is gone.
        """
        from core.os_control import OsRefused, power

        with pytest.raises(OsRefused, match="cannot be undone"):
            power(action)

    def test_an_unknown_power_action_is_refused(self) -> None:
        from core.os_control import OsRefused, power

        with pytest.raises(OsRefused):
            power("explode", confirmed=True)


class TestLanguageIsLearnedNotAsked:
    def test_the_first_language_heard_is_kept(self, tmp_path) -> None:
        from core import memory
        from core.os_control import language

        memory.MEMORY_DIR = tmp_path
        memory.MEMORY_FILE = tmp_path / "memory.json"

        assert language()["language"] == ""
        learned = language("tamil")
        assert learned["learned"] is True
        assert learned["language"] == "tamil"

    def test_one_differing_sentence_does_not_change_it(self, tmp_path) -> None:
        """A single other-language sample is a quote, a song title, or a
        mistranscription — not the user changing language."""
        from core import memory
        from core.os_control import language

        memory.MEMORY_DIR = tmp_path
        memory.MEMORY_FILE = tmp_path / "memory.json"

        language("tamil")
        heard = language("french")
        assert heard["learned"] is False
        assert heard["language"] == "tamil"
        assert heard["heard"] == "french"
