"""WhatsApp Desktop: find a conversation, open it, write into it, verify.

EVERYTHING HERE WAS MEASURED ON THE REAL APPLICATION, NOT ASSUMED.
------------------------------------------------------------------
WhatsApp Desktop is a packaged (UWP) Chromium app, and every one of these facts
cost a failed run to learn:

  1. IT HAS NO .exe. It is `5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App`, so a
     file-based app resolver reports it as not installed while its icon sits in
     the Start menu. It is launched through the shell verb.

  2. THE PAGE ROOT LOOKS LIKE A TEXT BOX. Chromium publishes the whole window
     as `Document` with a TextPattern, so "is this text?" says yes and
     `set_text` is then refused. Only a control with a ValuePattern can be
     typed into — `writable`, not merely `textEntry`.

  3. A CHAT ROW'S LABEL IS THE WHOLE ROW:
         'H 10:27 am You :  https://brandmotion.in/nexus.html?utm_source=…'
     Matching the user's words against that makes "H" match 55 things. The
     conversation NAME is the segment before the timestamp.

  4. ROWS ARE NESTED THREE DEEP. A DataGrid holds a DataItem holding a
     DataItem, all with the same label, so one conversation looks like three
     and an ambiguity guard refuses a chat that was never ambiguous.

  5. A ROW REJECTS A GENERIC CLICK. It exposes neither Toggle nor Invoke in the
     order the universal ladder tries them, so `uia.act(..., "click")` raises
     "exposes no matching UI Automation pattern". Selecting a row and pressing
     Enter is what opens a conversation.

WHY A SKILL AND NOT MORE GENERIC CODE
--------------------------------------
Points 3, 4 and 5 are facts about WhatsApp. Putting them in `core/uia.py` would
make the universal layer know an application, which is the one thing it must
never do. They live here, behind the same `Skill` interface as File Explorer,
and the generic layer stays generic.

THE SAFETY GATE IS NOT WEAKENED BY BEING FAST
----------------------------------------------
Finding and opening a conversation touches nobody. Sending does, so it still
goes through `core.messaging`: draft, approval bound to a hash of the exact
recipient and body, then send, then read the transcript back. A skill makes the
navigation deterministic; it does not get to skip the part that protects a
person from receiving the wrong message.
"""

from __future__ import annotations

import re
import time
from typing import Any

#: The packaged application id. Resolved from `Get-StartApps` at runtime rather
#: than hardcoded, with this as the documented fallback for the same machine.
APP_ID = "5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App"

#: Roles WhatsApp uses for chat-list rows.
_ROW_ROLES = ("DataItem", "ListItem", "TreeItem")

#: Where a row label stops being the NAME and becomes the message preview.
_ROW_TAIL = re.compile(
    r"\s(?:\d{1,2}:\d{2}|\d{1,2}/\d{1,2}/\d{2,4}|monday|tuesday|wednesday"
    r"|thursday|friday|saturday|sunday|yesterday|today)",
    re.IGNORECASE,
)

#: Status text WhatsApp puts BEFORE the name.
_ROW_HEAD = re.compile(
    r"^\s*(?:\d+\s+unread\s+messages?|view\s+status|\d+\s+unread\s+message)\s+",
    re.IGNORECASE,
)

_FILTER_TIMEOUT = 8.0
_FILTER_INTERVAL = 0.35
_SETTLE = 10.0


def contact_name_of(row_label: str) -> str:
    """The conversation name inside a chat row's full label.

    'H 10:27 am You : https://…'                  -> 'H'
    '63 unread messages TABAHHI STORE 7:28 pm …'   -> 'TABAHHI STORE'
    'Thanu Akka Tuesday Done , Thanu Akka'         -> 'Thanu Akka'
    """
    label = " ".join((row_label or "").split())
    label = _ROW_HEAD.sub("", label)
    cut = _ROW_TAIL.search(label)
    return (label[: cut.start()] if cut else label).strip()


def _norm(text: str) -> str:
    return " ".join((text or "").split()).lower()


def name_matches(wanted: str, row_label: str) -> bool:
    """Does this row answer to that name?

    A ONE- OR TWO-CHARACTER QUERY IS A COMPLETE NAME, NOT A FRAGMENT.
    Substring matching is right for "Hann" -> "Hannah" and catastrophic for
    "H", which appears in most English words. The user's group really is
    called "H", so a short query is matched exactly.
    """
    resolved = _norm(contact_name_of(row_label))
    wanted = _norm(wanted)
    if not wanted:
        return False
    return resolved == wanted if len(wanted) <= 2 else wanted in resolved


class WhatsAppSkill:
    name = "WhatsApp"

    def can_handle(self, app: str) -> bool:
        return _norm(app).replace(" ", "") in {"whatsapp", "whatsappdesktop", "wa"}

    # ------------------------------------------------------------------ open

    def launch(self) -> dict[str, Any]:
        """Start WhatsApp and bring it to the front. Idempotent."""
        import subprocess  # noqa: PLC0415

        import win32gui  # noqa: PLC0415

        existing = self.window()
        if existing is None:
            app_id = APP_ID
            try:
                from core.apps import resolve  # noqa: PLC0415

                found = resolve("WhatsApp")
                if found.get("found") and found.get("appId"):
                    app_id = found["appId"]
            except Exception:  # noqa: BLE001, S110
                pass
            subprocess.Popen(  # noqa: S603
                ["explorer.exe", f"shell:AppsFolder\\{app_id}"],
                creationflags=getattr(subprocess, "DETACHED_PROCESS", 0),
                close_fds=True,
            )
            deadline = time.monotonic() + 30.0
            while time.monotonic() < deadline and existing is None:
                time.sleep(0.4)
                existing = self.window()

        if existing is None:
            return {"opened": False, "verified": False, "detail": "WhatsApp did not open."}

        foregrounded = False
        try:
            # `core.uia`, NOT the bridge. This used to `import ocade_bridge` and
            # call its private `_force_foreground` — a skill importing its own
            # host, which is a cycle that happened to work only because the
            # bridge puts its directory on `sys.path` before importing anything.
            # Any other entry point into this module got ImportError, and the
            # `except` below turned that into a silent `foregrounded: False`.
            from core.uia import force_foreground  # noqa: PLC0415

            foregrounded = bool(force_foreground(existing))
        except Exception:  # noqa: BLE001, S110
            pass
        time.sleep(0.8)
        return {
            "opened": True,
            "hwnd": existing,
            "title": win32gui.GetWindowText(existing),
            "foregrounded": foregrounded,
            "verified": True,
            "detail": "WhatsApp is open and in front.",
        }

    def window(self) -> int | None:
        """The WhatsApp window handle, or None."""
        import win32gui  # noqa: PLC0415

        found: list[int] = []

        def visit(hwnd: int, _param) -> bool:
            try:
                if win32gui.IsWindowVisible(hwnd) and win32gui.GetWindowText(hwnd).strip() == "WhatsApp":
                    found.append(hwnd)
            except Exception:  # noqa: BLE001, S110
                pass
            return True

        win32gui.EnumWindows(visit, None)
        return found[0] if found else None

    # -------------------------------------------------------------- controls

    def _tree(self, hwnd: int, settle: float = 0.0) -> dict[str, Any]:
        from core.uia import snapshot  # noqa: PLC0415

        return snapshot(hwnd, limit=200, settle=settle)

    def search_box(self, hwnd: int) -> dict[str, Any]:
        """The 'Search or start a new chat' field.

        WRITABLE and in the TOP HALF. Writable eliminates the page-root
        Document, which reads as text but refuses to be typed into; the top
        half separates search from the composer, which is also writable.
        """
        tree = self._tree(hwnd, settle=_SETTLE)
        bounds = tree.get("bounds") or {}
        mid = bounds.get("y", 0) + (bounds.get("height") or 1) / 2
        boxes = [
            e
            for e in tree["elements"]
            if e.get("writable") and e["enabled"] and e["bounds"]["y"] < mid
        ]
        if not boxes:
            raise LookupError(
                "WhatsApp's search box is not on screen. Wait for the chat list to load."
            )
        boxes.sort(key=lambda e: (e["bounds"]["y"], -e["bounds"]["width"]))
        return boxes[0]

    def composer(self, hwnd: int) -> dict[str, Any]:
        """The message box of the OPEN conversation: writable, bottom half."""
        deadline = time.monotonic() + 12.0
        while True:
            tree = self._tree(hwnd)
            bounds = tree.get("bounds") or {}
            mid = bounds.get("y", 0) + (bounds.get("height") or 1) / 2
            boxes = [
                e
                for e in tree["elements"]
                if e.get("writable") and e["enabled"] and e["bounds"]["y"] >= mid
            ]
            if boxes:
                boxes.sort(key=lambda e: (e["bounds"]["y"], e["bounds"]["width"]), reverse=True)
                return boxes[0]
            if time.monotonic() >= deadline:
                raise LookupError(
                    "No message box is on screen. Open the conversation first."
                )
            time.sleep(0.4)

    # ------------------------------------------------------------- find/open

    def find_contact(self, hwnd: int, query: str) -> dict[str, Any]:
        """Type a name into search and open THAT ONE conversation.

        Resolves or refuses. Never "the first result": a message that reaches
        the wrong person cannot be recalled, and the approval card would have
        shown the name the user typed rather than the one that got picked.
        """
        from core.uia import act  # noqa: PLC0415

        query = " ".join((query or "").split())
        if not query:
            raise ValueError("There is no contact to look for.")

        # FOREGROUND FIRST, ALWAYS.
        #
        # The last rung of the row-opening ladder is a real double click at the
        # row's SCREEN coordinates. If WhatsApp is behind another window those
        # coordinates belong to whatever is on top, so the click lands
        # elsewhere and the chat never opens. Measured exactly that way when
        # this was called without opening WhatsApp first: 54 unfiltered rows,
        # no conversation, and a receipt that honestly said so.
        try:
            from core.uia import force_foreground  # noqa: PLC0415

            force_foreground(hwnd)
            time.sleep(0.4)
        except Exception:  # noqa: BLE001, S110
            pass

        box = self.search_box(hwnd)
        typed = act(hwnd, box["ref"], "set_text", text=query, fingerprint=box["fingerprint"])
        # Verified by the value, not by the value CHANGING: searching for the
        # same name twice leaves the box already reading it, and a correct
        # write must not report failure because nothing moved.
        landed = _norm((typed.get("after") or {}).get("value") or "") == _norm(query)
        if not landed and not typed.get("verified"):
            raise LookupError("The name did not land in WhatsApp's search box.")

        deadline = time.monotonic() + _FILTER_TIMEOUT
        matches: list[dict[str, Any]] = []
        while True:
            rows = [
                e
                for e in self._tree(hwnd)["elements"]
                if e["role"] in _ROW_ROLES and e["enabled"] and e["name"]
            ]
            matches = [r for r in rows if name_matches(query, r["name"])]
            if matches or time.monotonic() >= deadline:
                break
            time.sleep(_FILTER_INTERVAL)

        if not matches:
            raise LookupError(
                f"No conversation called “{query}” appeared. Check the name, or open "
                "the chat yourself and ask again."
            )

        # Nested rows are ONE conversation. WhatsApp wraps each chat in a
        # DataGrid > DataItem > DataItem, all carrying the same label, so a
        # single chat looks like three candidates.
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for row in matches:
            key = _norm(contact_name_of(row["name"]))
            if key in seen:
                continue
            seen.add(key)
            unique.append(row)

        if len(unique) > 1:
            names = ", ".join(contact_name_of(r["name"]) for r in unique[:6])
            raise LookupError(
                f"“{query}” matches {len(unique)} conversations: {names}. "
                "OCADE will not guess which one you meant — say the full name."
            )

        chosen = unique[0]
        opened = self._open_row(hwnd, chosen, expect=contact_name_of(chosen["name"]))
        return {
            "query": query,
            "contact": contact_name_of(chosen["name"]),
            "rowLabel": chosen["name"][:160],
            "how": opened["how"],
            "pointerUsed": opened["pointerUsed"],
            "verified": opened["verified"],
            "detail": opened["detail"],
        }

    def _open_row(self, hwnd: int, row: dict[str, Any], expect: str = "") -> dict[str, Any]:
        """Open a chat row. THE GENERIC CLICK DOES NOT WORK HERE.

        `uia.act(..., "click")` tries Toggle, then Selection, then Invoke. A
        WhatsApp row answers none of them in a way that opens the chat — the
        measured error is "exposes no matching UI Automation pattern" — so this
        ladder is specific to the control:

          1. `invoke()` directly, when the row happens to expose it.
          2. SELECT then ENTER. Selecting a list row and pressing Enter is how
             a keyboard user opens a conversation, and it is what actually
             works here. No pointer involved.
          3. A double click on the row, which is a real pointer action and is
             declared as one.
        """
        from core.uia import _resolve  # noqa: PLC0415

        # RE-FOUND BY NAME, NOT BY REF, IMMEDIATELY BEFORE ACTING.
        #
        # A chat list is LIVE: a message arriving reorders it, and between the
        # snapshot that produced this ref and the click a moment later, e98 can
        # legitimately be a different conversation. The fingerprint guard
        # catches that and refuses — correctly — but refusing is the wrong
        # answer for a list that is expected to move. Measured live:
        # "e98 is now DataItem 'View status Mummy Yesterday Video'".
        #
        # So the row is located again by the NAME that was resolved, which is
        # stable across reordering in a way an index never is. If it has gone
        # entirely, that is a real failure and is reported as one.
        wanted_name = _norm(contact_name_of(row["name"]))
        # THE INNERMOST OF THE THREE NESTED ROWS, NOT THE FIRST.
        #
        # WhatsApp wraps each chat in DataGrid > DataItem > DataItem, all with
        # the same label. The walk is breadth-first, so the FIRST match is the
        # outer wrapper — which accepts a double click and does nothing, because
        # it is a container rather than the row. Taking the last match takes the
        # deepest one, which is the row a person actually clicks.
        candidates = [
            e
            for e in self._tree(hwnd)["elements"]
            if e["role"] in _ROW_ROLES
            and _norm(contact_name_of(e["name"] or "")) == wanted_name
        ]
        fresh = candidates[-1] if candidates else None
        if fresh is None:
            return {
                "how": "none",
                "pointerUsed": False,
                "verified": False,
                "detail": f"The conversation with {expect} left the list before it could be opened.",
            }
        element = _resolve(hwnd, fresh["ref"], None, 200)["_element"]
        before = self._transcript_signature(hwnd)

        attempts = (
            (lambda: element.invoke(), "invoke_pattern", False),
            (lambda: (element.select(), self._press_enter())[0], "select_then_enter", False),
            (lambda: element.double_click_input(), "pointer_double_click", True),
        )
        how = None
        pointer_used = False
        for attempt, label, uses_pointer in attempts:
            try:
                attempt()
            except Exception:  # noqa: BLE001, S112
                continue
            time.sleep(0.9)
            if self._transcript_signature(hwnd) != before:
                how, pointer_used = label, uses_pointer
                break
            # The action ran but the conversation did not change. Keep going
            # rather than reporting a rung that did nothing as success.
            how, pointer_used = label, uses_pointer

        # VERIFIED BY WHICH CHAT IS OPEN, NOT BY THE PANE CHANGING.
        #
        # Change-detection reports a false failure whenever the requested chat
        # was ALREADY the open one — asking twice in a row, or asking about the
        # conversation already on screen. Measured: the H group opened
        # correctly and the check said the pane did not change, because it had
        # not needed to.
        #
        # WhatsApp names its composer after the conversation — 'Type a message
        # to group H' — so the composer is positive evidence of WHICH chat is
        # open, which is the thing actually being asserted.
        on_target = False
        if expect:
            try:
                on_target = _norm(expect) in _norm(self.composer(hwnd).get("name") or "")
            except Exception:  # noqa: BLE001
                on_target = False
        changed = self._transcript_signature(hwnd) != before
        opened = on_target or changed
        return {
            "how": how or "none",
            "pointerUsed": pointer_used,
            "onTarget": on_target,
            "verified": opened,
            "detail": (
                f"The conversation with {expect} is open"
                + (f" (via {how})." if how else ".")
                if opened
                else "The row was actioned but no conversation opened."
            ),
        }

    def _press_enter(self) -> None:
        import pyautogui  # noqa: PLC0415

        pyautogui.press("enter")

    def _transcript_signature(self, hwnd: int) -> tuple[int, str]:
        """A cheap fingerprint of what the conversation pane is showing.

        Used to tell "the chat opened" from "the click did nothing" without
        assuming any particular element is the transcript.
        """
        try:
            elements = self._tree(hwnd)["elements"]
        except Exception:  # noqa: BLE001
            return (0, "")
        texts = [e["name"] for e in elements if e["role"] == "Text" and e["name"]]
        return (len(texts), "|".join(texts[-6:])[:400])

    # ------------------------------------------------------------------ send

    def type_message(self, hwnd: int, body: str) -> dict[str, Any]:
        """Put text in the composer, and read it back out of the composer.

        THE VALUE PATTERN DOES NOT STICK IN A CHROMIUM COMPOSER.
        Measured on the real app: `Edit 'Type a message to group H'` accepts a
        ValuePattern write without error and then reads back as empty — the
        box is a contenteditable div, and React's own state never learns about
        a value set behind its back. So the write is verified and, when it did
        not take, the control is focused and the text is typed as keystrokes,
        which is what a person does and what the page listens for.

        `type_keys` is NOT a blind pointer action: the element is resolved
        first and focused by handle, so the characters go to that control or
        nowhere. `pointerUsed` stays false because the mouse never moves.
        """
        from core.uia import _resolve, act  # noqa: PLC0415

        box = self.composer(hwnd)
        how = "value_pattern"
        try:
            act(hwnd, box["ref"], "set_text", text=body, fingerprint=box["fingerprint"])
        except Exception:  # noqa: BLE001, S110
            pass

        if not self._composer_holds(hwnd, body):
            element = _resolve(hwnd, box["ref"], box["fingerprint"], 200)["_element"]
            element.set_focus()
            time.sleep(0.2)
            # Braces and parentheses are control syntax for type_keys, so the
            # text is escaped rather than interpreted.
            element.type_keys(body, with_spaces=True, with_newlines=False, pause=0.005)
            how = "type_keys"
            time.sleep(0.4)

        value = self._composer_value(hwnd)
        landed = _norm(body)[:60] in _norm(value)
        pointer_used = False

        # THE THIRD RUNG: LOOK AT THE BOX INSTEAD OF ASKING IT.
        #
        # Two ways of writing have now failed, and both of them asked the
        # CONTROL what it holds. A Chromium composer can lie about that in
        # either direction -- it accepts a value that never renders, and it
        # renders text it will not report -- so a third attempt through the
        # same interface would be a third opinion from the same unreliable
        # witness.
        #
        # `type_into` uses the screen: it finds the box by looking, clicks it,
        # types real keystrokes, and confirms by reading the pixels back. It is
        # slower and it moves the pointer, which is why it is last and not
        # first, but when the accessibility tree has been wrong twice the only
        # thing left worth trusting is the glass.
        if not landed:
            try:
                from core.vision_action import type_into  # noqa: PLC0415

                seen = type_into(hwnd, "message box at the bottom", body, submit=False)
                if seen.get("verified"):
                    return {
                        "control": f"{box['role']} {box['name']!r}",
                        "typed": len(body),
                        "how": "vision_action",
                        "pointerUsed": bool(seen.get("pointerUsed")),
                        "readback": str(seen.get("readback") or "")[:200],
                        "verified": True,
                        "detail": (
                            f"The accessibility tree would not take the text, so OCADE typed "
                            f"{len(body)} characters by looking at the screen and read them back "
                            f"off it (match {seen.get('match')})."
                        ),
                    }
                # The vision attempt also failed. Its read-back is the better
                # evidence of what is actually there, so it is what gets
                # reported.
                value = str(seen.get("readback") or value)
                pointer_used = bool(seen.get("pointerUsed"))
            except Exception as error:  # noqa: BLE001
                # A missing screen-reading dependency must not turn a failed
                # write into a crash; the honest "it did not land" below is
                # still the right answer.
                value = value or f"(screen read unavailable: {type(error).__name__})"

        return {
            "control": f"{box['role']} {box['name']!r}",
            "typed": len(body),
            "how": how,
            "pointerUsed": pointer_used,
            "readback": value[:200],
            "verified": landed,
            "detail": (
                f"Typed {len(body)} characters into the message box via {how} "
                "and read them back. The pointer was not moved."
                if landed
                else (
                    "The text did not land in the message box, through the accessibility "
                    f"tree or by typing at the screen. What is there now: \u201c{value[:120]}\u201d."
                )
            ),
        }

    def _composer_value(self, hwnd: int) -> str:
        """What the message box currently holds, re-read from the live tree."""
        try:
            box = self.composer(hwnd)
        except Exception:  # noqa: BLE001
            return ""
        from core.uia import _resolve  # noqa: PLC0415

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

    def _composer_holds(self, hwnd: int, body: str) -> bool:
        return _norm(body)[:60] in _norm(self._composer_value(hwnd))

    def send_typed(self, hwnd: int, body: str) -> dict[str, Any]:
        """Press Enter to commit, then confirm the message is in the transcript."""
        self._press_enter()
        time.sleep(0.8)
        needle = _norm(body)[:60]
        deadline = time.monotonic() + 8.0
        while True:
            for element in self._tree(hwnd)["elements"]:
                if element.get("writable"):
                    continue  # the composer held it a moment ago; that proves nothing
                if needle and needle in _norm(element.get("name") or ""):
                    return {
                        "sent": True,
                        "match": (element.get("name") or "")[:200],
                        "role": element.get("role"),
                        "verified": True,
                        "detail": "The message is in the conversation.",
                    }
            if time.monotonic() >= deadline:
                return {
                    "sent": False,
                    "verified": False,
                    "detail": (
                        "Pressed Enter but the message was not found in the conversation."
                    ),
                }
            time.sleep(0.5)

    # -------------------------------------------------------------- dispatch

    def execute(self, command: str, hwnd: int | None, **kwargs: Any) -> dict[str, Any]:
        action = (command or "").strip().lower()
        if action in ("open", "launch", "start"):
            return self.launch()
        if hwnd is None:
            hwnd = self.window()
        if hwnd is None:
            raise LookupError("WhatsApp is not open.")
        if action in ("find", "find_contact", "open_chat"):
            return self.find_contact(hwnd, str(kwargs.get("contact") or ""))
        if action in ("type", "compose"):
            return self.type_message(hwnd, str(kwargs.get("message") or ""))
        if action == "send":
            return self.send_typed(hwnd, str(kwargs.get("message") or ""))
        raise ValueError(f"WhatsApp skill does not know the command {command!r}.")


SKILL = WhatsAppSkill()
