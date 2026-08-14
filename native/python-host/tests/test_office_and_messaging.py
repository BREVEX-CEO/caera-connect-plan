"""Receipts for saved files, and the gate that stands between a draft and a send.

Both halves here are about the same thing: not believing a call that returned.
A `to_excel` that did not raise has not proved a file exists, and a send helper
that was invoked has not proved a person agreed to it.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ENGINE = Path(__file__).resolve().parents[2] / "ocade_control_engine"
OFFICE = ENGINE / "core" / "office.py"
MESSAGING = ENGINE / "core" / "messaging.py"

pytestmark = pytest.mark.skipif(not OFFICE.is_file(), reason="control engine is not installed")


def _load(path: Path, name: str):
    if str(ENGINE) not in sys.path:
        sys.path.insert(0, str(ENGINE))
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def office():
    return _load(OFFICE, "ocade_office")


@pytest.fixture()
def messaging():
    module = _load(MESSAGING, "ocade_messaging")
    module._DRAFTS.clear()
    yield module
    module._DRAFTS.clear()


pandas_missing = importlib.util.find_spec("pandas") is None
docx_missing = importlib.util.find_spec("docx") is None


@pytest.mark.skipif(pandas_missing, reason="pandas is not installed")
class TestSpreadsheetReceipts:
    def test_a_written_sheet_is_reopened_and_counted(self, office, tmp_path):
        target = tmp_path / "sales.xlsx"
        rows = [{"region": "North", "units": 120}, {"region": "South", "units": 80}]
        got = office.write_table(target, rows)

        assert got["verified"] is True
        assert got["exists"] is True
        assert got["bytes"] > 0
        # The count comes from REOPENING, not from len(rows) being echoed back.
        assert got["rows"] == 2
        assert got["columns"] == ["region", "units"]
        assert got["sha256"]

    def test_the_receipt_reads_the_real_file_not_the_request(self, office, tmp_path):
        """Truncating the file behind the receipt's back must change its verdict."""
        target = tmp_path / "sales.csv"
        office.write_table(target, [{"a": 1}, {"a": 2}, {"a": 3}])
        target.write_text("a\n1\n", encoding="utf-8")  # now only one row

        again = office.receipt(target, expected_rows=3)
        assert again["verified"] is False
        assert again["rows"] == 1
        assert "asked for" in again["detail"]

    def test_a_missing_file_is_never_verified(self, office, tmp_path):
        got = office.receipt(tmp_path / "never-written.xlsx", expected_rows=1)
        assert got["exists"] is False
        assert got["verified"] is False

    def test_an_empty_file_is_never_verified(self, office, tmp_path):
        empty = tmp_path / "empty.csv"
        empty.write_text("", encoding="utf-8")
        got = office.receipt(empty)
        assert got["verified"] is False
        assert "empty" in got["detail"]

    def test_a_corrupt_file_reports_why_rather_than_passing(self, office, tmp_path):
        broken = tmp_path / "broken.xlsx"
        broken.write_bytes(b"this is not a spreadsheet")
        got = office.receipt(broken)
        assert got["verified"] is False
        assert "could not be reopened" in got["detail"]

    def test_refuses_a_format_it_cannot_write(self, office, tmp_path):
        with pytest.raises(office.OfficeRefused):
            office.write_table(tmp_path / "sales.pdf", [{"a": 1}])

    def test_refuses_writing_nothing(self, office, tmp_path):
        with pytest.raises(office.OfficeRefused):
            office.write_table(tmp_path / "sales.csv", [])


@pytest.mark.skipif(docx_missing, reason="python-docx is not installed")
class TestDocumentReceipts:
    def test_a_written_document_is_reopened_and_counted(self, office, tmp_path):
        target = tmp_path / "note.docx"
        got = office.write_document(target, ["First line.", "Second line."], title="Notes")
        assert got["verified"] is True
        assert got["paragraphs"] == 3  # heading + two paragraphs
        assert got["bytes"] > 0

    def test_the_receipt_counts_paragraphs_not_rows(self, office, tmp_path):
        """A Word receipt saying "3 row(s)" reads as boilerplate nobody checked."""
        target = tmp_path / "note.docx"
        got = office.write_document(target, ["One."], title=None)
        assert "paragraph(s)" in got["detail"]
        assert "row(s)" not in got["detail"]


class TestSendingNeedsAPerson:
    def test_drafting_sends_nothing(self, messaging):
        got = messaging.draft("Mum", "Running late")
        assert got["awaitingApproval"] is True
        assert got["verified"] is False
        assert "Mum" in got["confirmation"] and "Running late" in got["confirmation"]

    @pytest.mark.parametrize("approved", [False, None, 0, 1, "yes", "true", {}, [], "approved"])
    def test_only_a_real_boolean_true_approves(self, messaging, approved):
        """Truthiness is not consent.

        `1`, `"yes"` and `{}` are all truthy, and a caller that sent any of them
        has not been told by anybody that this message may go out.
        """
        draft = messaging.draft("Mum", "Running late")
        with pytest.raises(messaging.MessageRefused):
            messaging.send(draft["draftId"], approved=approved, hwnd=1)

    def test_an_unknown_draft_cannot_be_sent(self, messaging):
        with pytest.raises(messaging.MessageRefused):
            messaging.send("msg_deadbeef", approved=True, hwnd=1)

    def test_a_tampered_fingerprint_is_refused(self, messaging):
        draft = messaging.draft("Mum", "Running late")
        with pytest.raises(messaging.MessageRefused):
            messaging.send(draft["draftId"], approved=True, hwnd=1, fingerprint="0000deadbeef")

    def test_what_was_shown_must_be_what_is_sent(self, messaging):
        """The confused-deputy case this design exists to prevent.

        The approval prompt has to display a recipient and a body, so those
        values travel with the send call. If they were display-only, a caller
        could show "Running late" and send "please send me 500 pounds" under
        the same approved draft id.
        """
        draft = messaging.draft("Mum", "Running late")
        with pytest.raises(messaging.MessageRefused):
            messaging.send(
                draft["draftId"],
                approved=True,
                hwnd=1,
                shown_recipient="Mum",
                shown_body="Please send me 500 pounds",
            )
        with pytest.raises(messaging.MessageRefused):
            messaging.send(
                draft["draftId"],
                approved=True,
                hwnd=1,
                shown_recipient="Somebody Else",
                shown_body="Running late",
            )

    def test_credentials_are_never_drafted(self, messaging):
        def protect(text: str) -> bool:
            return "password" in text.lower()

        with pytest.raises(messaging.MessageRefused):
            messaging.draft("Mum", "my password is hunter2", protect=protect)

    def test_an_expired_draft_must_be_written_again(self, messaging):
        draft = messaging.draft("Mum", "Running late")
        record = messaging._DRAFTS[draft["draftId"]]
        record["createdAt"] -= messaging.DRAFT_TTL_SECONDS + 1
        with pytest.raises(messaging.MessageRefused):
            messaging.send(draft["draftId"], approved=True, hwnd=1)

    def test_approval_without_a_window_does_not_type_anywhere(self, messaging):
        """The old helper's actual failure mode.

        It pressed keys into whatever had focus. Here, no window means no
        keystrokes at all — the refusal happens before anything is typed.

        The shown recipient and body are passed because a send now REQUIRES
        them; without them the mandatory swap guard refuses first and this
        would stop exercising the no-window path it exists to cover.
        """
        draft = messaging.draft("Mum", "Running late")
        with pytest.raises(messaging.MessageRefused) as raised:
            messaging.send(
                draft["draftId"],
                approved=True,
                hwnd=None,
                shown_recipient="Mum",
                shown_body="Running late",
            )
        assert "bring it to the front" in str(raised.value)

    def test_a_send_that_does_not_say_what_was_shown_is_refused(self, messaging):
        """The swap guard is mandatory, and it used to be opt-in.

        The check was `if shown_recipient is not None or shown_body is not
        None`, so a caller could skip the entire comparison by simply not
        passing the arguments — and a live run did exactly that, sending a
        message with both absent. Every incomplete spelling is refused now.
        """
        draft = messaging.draft("Mum", "Running late")
        for kwargs in (
            {},
            {"shown_recipient": "Mum"},
            {"shown_body": "Running late"},
            {"shown_recipient": "", "shown_body": ""},
        ):
            with pytest.raises(messaging.MessageRefused) as raised:
                messaging.send(draft["draftId"], approved=True, hwnd=1, **kwargs)
            assert "must state the recipient and message" in str(raised.value)

    def test_a_discarded_draft_cannot_be_sent(self, messaging):
        draft = messaging.draft("Mum", "Running late")
        messaging.discard(draft["draftId"])
        assert messaging.pending() == []
        with pytest.raises(messaging.MessageRefused):
            messaging.send(draft["draftId"], approved=True, hwnd=1)


class TestFindingTheMessageBox:
    """Choosing WHERE to type, on a tree shaped like a real Electron app's.

    Every fixture below is the shape measured live on Discord, which is
    Chromium and therefore the shape of Slack, Teams and WhatsApp Desktop too.
    The numbers are not invented: the page root really is published as an
    enabled, focusable, two-million-pixel `Document`.
    """

    @staticmethod
    def _tree(elements, title="Chat - App", height=1000):
        return {
            "title": title,
            "bounds": {"x": 0, "y": 0, "width": 1920, "height": height},
            "elements": elements,
            "count": len(elements),
            "shellOnly": False,
            "textEntryCount": sum(1 for e in elements if e.get("textEntry")),
        }

    @staticmethod
    def _el(ref, role, name, y, w=800, h=40, *, text_entry, enabled=True):
        return {
            "ref": ref,
            "role": role,
            "name": name,
            "automationId": "",
            "enabled": enabled,
            "bounds": {"x": 0, "y": y, "width": w, "height": h},
            "textEntry": text_entry,
            "focusable": True,
            "fingerprint": f"fp-{ref}",
        }

    def _patch(self, monkeypatch, messaging, tree):
        import core.uia as uia

        monkeypatch.setattr(uia, "snapshot", lambda *a, **k: tree)
        return tree

    def test_the_page_root_is_never_mistaken_for_a_message_box(
        self, messaging, monkeypatch
    ):
        """The exact Discord tree, and the exact bug.

        `Document 'Friends'` is enabled, focusable and by far the largest thing
        in the window — so the old "largest Edit or Document" rule returned the
        whole page as the composer. It exposes no value pattern, so `textEntry`
        is false and it is now excluded outright.
        """
        tree = self._tree(
            [
                self._el("e0", "Document", "Friends", 0, 1920, 1040, text_entry=False),
                self._el("e59", "Edit", "Search", 177, 1077, 38, text_entry=True),
            ]
        )
        self._patch(monkeypatch, messaging, tree)
        with pytest.raises(messaging.MessageRefused) as raised:
            messaging._find_message_box(1)
        message = str(raised.value)
        assert "top of the window" in message
        assert "Friends" not in message.split("(")[-1]

    def test_a_bottom_anchored_composer_is_chosen_over_a_search_box(
        self, messaging, monkeypatch
    ):
        tree = self._tree(
            [
                self._el("e0", "Document", "Chat", 0, 1920, 1000, text_entry=False),
                self._el("e5", "Edit", "Search", 60, 1000, 30, text_entry=True),
                self._el("e41", "Edit", "Message", 940, 1200, 50, text_entry=True),
            ]
        )
        self._patch(monkeypatch, messaging, tree)
        _, box = messaging._find_message_box(1)
        assert box["ref"] == "e41"
        assert box["name"] == "Message"

    def test_a_window_with_no_text_box_at_all_is_refused(self, messaging, monkeypatch):
        tree = self._tree(
            [self._el("e0", "Document", "Friends", 0, 1920, 1000, text_entry=False)]
        )
        self._patch(monkeypatch, messaging, tree)
        with pytest.raises(messaging.MessageRefused) as raised:
            messaging._find_message_box(1)
        assert "No text box was found" in str(raised.value)


class TestReadBackVerification:
    """`verified` means the message is in the conversation, not that a box emptied."""

    @staticmethod
    def _tree(elements):
        return {
            "title": "Chat - App",
            "bounds": {"x": 0, "y": 0, "width": 1920, "height": 1000},
            "elements": elements,
            "count": len(elements),
            "shellOnly": False,
            "textEntryCount": 0,
        }

    def _el(self, ref, role, name, text_entry=False):
        return {
            "ref": ref,
            "role": role,
            "name": name,
            "automationId": "",
            "enabled": True,
            "bounds": {"x": 0, "y": 500, "width": 100, "height": 20},
            "textEntry": text_entry,
            "focusable": True,
            "fingerprint": f"fp-{ref}",
        }

    def test_the_message_is_found_in_the_transcript(self, messaging, monkeypatch):
        import core.uia as uia

        tree = self._tree([self._el("e9", "Text", "phase 7.7 readback proof kilo-4482")])
        monkeypatch.setattr(uia, "snapshot", lambda *a, **k: tree)
        found = messaging._find_in_conversation(1, "phase 7.7 readback proof kilo-4482")
        assert found["found"] is True
        assert found["matchedRole"] == "Text"

    def test_the_composer_cannot_verify_itself(self, messaging, monkeypatch):
        """The composer still holds the text a moment after Enter.

        Counting it would make verification always pass — the message would be
        'found' in the very control it was typed into, which proves nothing
        about whether it was sent.
        """
        import core.uia as uia

        tree = self._tree([self._el("e41", "Edit", "unsent words", text_entry=True)])
        monkeypatch.setattr(uia, "snapshot", lambda *a, **k: tree)
        monkeypatch.setattr(messaging, "_READBACK_ATTEMPTS", 1)
        monkeypatch.setattr(messaging, "_READBACK_INTERVAL", 0)
        assert messaging._find_in_conversation(1, "unsent words")["found"] is False

    def test_absent_text_is_not_reported_as_delivered(self, messaging, monkeypatch):
        import core.uia as uia

        tree = self._tree([self._el("e9", "Text", "something else entirely")])
        monkeypatch.setattr(uia, "snapshot", lambda *a, **k: tree)
        monkeypatch.setattr(messaging, "_READBACK_ATTEMPTS", 1)
        monkeypatch.setattr(messaging, "_READBACK_INTERVAL", 0)
        assert messaging._find_in_conversation(1, "never typed")["found"] is False

    def test_a_wrapped_line_still_matches(self, messaging, monkeypatch):
        """A client may reflow what it renders; that is not a failed send."""
        import core.uia as uia

        tree = self._tree([self._el("e9", "Text", "hello   there\n  everyone")])
        monkeypatch.setattr(uia, "snapshot", lambda *a, **k: tree)
        assert messaging._find_in_conversation(1, "hello there everyone")["found"] is True


class TestFindingAContactRefusesToGuess:
    """"Click the first matching result" is how a message reaches the wrong person.

    Searching "H" in a real contact list matches Hannah, Harry, Home, HR and a
    group called "Holiday 2019". Taking whichever the client sorts first means
    the approval card names the string the user typed while somebody else
    receives the message — and a sent message cannot be recalled.
    """

    @staticmethod
    def _el(ref, role, name, y, *, text_entry=False):
        return {
            "ref": ref, "role": role, "name": name, "automationId": "", "enabled": True,
            "bounds": {"x": 0, "y": y, "width": 400, "height": 30},
            "textEntry": text_entry,
            #  was added when Chromium"s page-root Document turned
            # out to expose a TextPattern: readable is not typable. A search
            # box IS writable, so the fixture must say so.
            "writable": text_entry,
            "focusable": True, "fingerprint": f"fp-{ref}",
        }

    def _wire(self, monkeypatch, messaging, elements, *, typed_ok=True):
        import core.uia as uia

        tree = {
            "title": "WhatsApp",
            "bounds": {"x": 0, "y": 0, "width": 1200, "height": 900},
            "elements": elements,
            "count": len(elements),
            "shellOnly": False,
            "textEntryCount": sum(1 for e in elements if e.get("textEntry")),
        }
        monkeypatch.setattr(uia, "snapshot", lambda *a, **k: tree)
        clicked = {}

        def fake_act(hwnd, ref, action, **kw):
            clicked.setdefault("calls", []).append((ref, action))
            if action == "set_text":
                return {"verified": typed_ok, "how": "value_pattern", "pointerUsed": False}
            return {"verified": True, "how": "invoke_pattern", "pointerUsed": False}

        monkeypatch.setattr(uia, "act", fake_act)
        monkeypatch.setattr(messaging, "_FILTER_TIMEOUT", 0.1)
        monkeypatch.setattr(messaging, "_FILTER_INTERVAL", 0.01)
        return clicked

    def test_an_ambiguous_name_is_refused_with_the_candidates(self, messaging, monkeypatch):
        """Ambiguity is refused with the RESOLVED names, not the row labels.

        The candidates here share a real prefix, so "Hann" genuinely cannot be
        resolved. The listed names must be "Hannah" and "Hannah Smith" rather
        than "Hannah 10:01 am hi" — a refusal a person cannot read is a refusal
        they cannot answer.
        """
        self._wire(monkeypatch, messaging, [
            self._el("e1", "Edit", "Search", 60, text_entry=True),
            self._el("e5", "ListItem", "Hannah 10:01 am hi", 300),
            self._el("e6", "ListItem", "Hannah Smith 09:12 am ok", 340),
        ])
        with pytest.raises(messaging.MessageRefused) as raised:
            messaging.find_contact(1, "Hann")
        message = str(raised.value)
        assert "will not guess" in message
        assert "Hannah" in message and "Hannah Smith" in message
        assert "10:01" not in message, "the raw row label leaked into the refusal"

    def test_a_one_letter_name_is_not_ambiguous(self, messaging, monkeypatch):
        """THE "H" CASE, WHICH IS THE WHOLE REASON FOR EXACT SHORT MATCHING.

        "H" is a real group. Substring matching made it match Hannah, Harry,
        Holiday 2019 and about fifty other rows, so the ambiguity guard refused
        a conversation that was never ambiguous. A one-character query is a
        complete name.
        """
        self._wire(monkeypatch, messaging, [
            self._el("e1", "Edit", "Search", 60, text_entry=True),
            self._el("e5", "ListItem", "Hannah 10:01 am hi", 300),
            self._el("e6", "ListItem", "Harry 09:12 am ok", 340),
            self._el("e7", "ListItem", "H 10:27 am You : x", 380),
        ])
        assert messaging.find_contact(1, "H")["contact"] == "H"

    def test_an_exact_name_wins_over_partial_matches(self, messaging, monkeypatch):
        """A contact literally called "H" is what "find contact H" means."""
        self._wire(monkeypatch, messaging, [
            self._el("e1", "Edit", "Search", 60, text_entry=True),
            self._el("e5", "ListItem", "Hannah 10:01 am hi", 300),
            self._el("e6", "ListItem", "H 10:27 am You : x", 340),
        ])
        got = messaging.find_contact(1, "H")
        assert got["contact"] == "H"
        assert got["matchedExactly"] is True
        assert got["pointerUsed"] is False

    def test_a_single_partial_match_is_accepted(self, messaging, monkeypatch):
        self._wire(monkeypatch, messaging, [
            self._el("e1", "Edit", "Search", 60, text_entry=True),
            self._el("e5", "ListItem", "Hannah 10:01 am hi", 300),
        ])
        assert messaging.find_contact(1, "Hann")["contact"] == "Hannah"

    def test_no_match_is_refused_rather_than_approximated(self, messaging, monkeypatch):
        self._wire(monkeypatch, messaging, [
            self._el("e1", "Edit", "Search", 60, text_entry=True),
            self._el("e5", "ListItem", "Zoe", 300),
        ])
        with pytest.raises(messaging.MessageRefused):
            messaging.find_contact(1, "H")

    def test_the_search_box_is_taken_from_the_top_half_not_the_composer(
        self, messaging, monkeypatch
    ):
        """The composer also has textEntry true. Picking it would type the
        contact's name into the message box of whatever chat was already open."""
        clicked = self._wire(monkeypatch, messaging, [
            self._el("e1", "Edit", "Search", 60, text_entry=True),
            self._el("e9", "Edit", "Type a message", 850, text_entry=True),
            self._el("e5", "ListItem", "Hannah 10:01 am hi", 300),
        ])
        messaging.find_contact(1, "Hannah")
        assert clicked["calls"][0] == ("e1", "set_text")

    def test_a_name_that_does_not_land_in_search_stops_the_sequence(
        self, messaging, monkeypatch
    ):
        self._wire(monkeypatch, messaging, [
            self._el("e1", "Edit", "Search", 60, text_entry=True),
            self._el("e5", "ListItem", "Hannah 10:01 am hi", 300),
        ], typed_ok=False)
        with pytest.raises(messaging.MessageRefused) as raised:
            messaging.find_contact(1, "Hannah")
        assert "did not land" in str(raised.value)
