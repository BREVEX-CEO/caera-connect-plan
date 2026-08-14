"""Messaging with a person in the loop, by construction rather than by policy.

WHAT THIS REPLACES, AND WHY IT IS A REWRITE AND NOT A PATCH
-----------------------------------------------------------
`actions/send_message.py` sends a message like this: press the Windows key,
type an application name, press Enter, wait 2.5 seconds, paste, press Enter.

Every step is a guess. It never confirms the right application opened, never
confirms the right conversation is on screen, never confirms the text landed in
a message box rather than a search bar, and never asks anybody first. On a slow
machine the 2.5-second wait expires early and the message is typed into
whatever had focus. That is not a messaging feature; it is a way to send a
stranger a fragment of somebody's message.

It is also unreachable — it was never added to the bridge's handler table — so
replacing it costs nothing and rewriting it is safer than repairing it.

THE SHAPE OF THE REPLACEMENT
----------------------------
Sending is TWO calls, and they cannot be collapsed into one:

  1. `draft()`  — validates, and returns exactly what would be sent, to whom.
                  Touches nothing. No app is opened, no key is pressed.
  2. `send()`   — refuses unless `approved is True` AND the draft's fingerprint
                  still matches what the user approved.

The fingerprint is the part that makes this a control rather than a formality.
Without it, "approve draft d3" is a token that can be replayed against different
content: a task could show the user a harmless message, get approval, and send
something else under the same id. Binding the approval to a hash of the exact
recipient and body makes the approved thing and the sent thing the same thing —
provably, not by trusting the caller.

THE SEND ITSELF USES UI AUTOMATION, NOT KEYSTROKES
--------------------------------------------------
It locates the message box by its accessibility role and puts text in through
the value pattern, so it can state which control it wrote into and read the
text back. A blind paste cannot do either, which is why the old one could not
tell a message box from a search field.

NOTHING HERE IS APPLICATION-SPECIFIC. There is no WhatsApp element map: the
send path asks the focused window what edit controls it has, the same way every
other OCADE action does. It works on WhatsApp because WhatsApp is a Windows
application, not because it is WhatsApp.
"""

from __future__ import annotations

import hashlib
import re
import time
from typing import Any

#: Drafts awaiting approval, by id. Process-local and deliberately not
#: persisted: an approval must not outlive the session that showed it.
_DRAFTS: dict[str, dict[str, Any]] = {}

_MAX_RECIPIENT = 120
_MAX_BODY = 4_000

#: Approvals expire. A draft approved an hour ago and sent now is not the
#: action the user agreed to — the conversation has moved on.
DRAFT_TTL_SECONDS = 600

#: How long to keep looking for a composer before deciding a window has none.
#: A Chromium chat window can publish its address bar seconds before it
#: publishes the message box, so a single read is not evidence of absence.
_COMPOSER_TIMEOUT = 12.0
_COMPOSER_INTERVAL = 0.6


class MessageRefused(RuntimeError):
    """The message will not be sent, with a reason the user can act on."""


def _fingerprint(recipient: str, body: str) -> str:
    return hashlib.sha256(f"{recipient}|{body}".encode()).hexdigest()[:16]


def draft(
    recipient: str,
    body: str,
    *,
    app: str = "WhatsApp",
    protect=None,
) -> dict[str, Any]:
    """Prepare a message and return it for approval. Sends nothing.

    `protect` is the caller's credential test. A model asked to "send Mum the
    login code" would otherwise cheerfully put a one-time code into a chat, and
    a message is forwardable, screenshot-able and permanent in a way a typed
    field is not.
    """
    recipient = (recipient or "").strip()
    body = (body or "").strip()
    if not recipient:
        raise MessageRefused("There is no recipient for this message.")
    if len(recipient) > _MAX_RECIPIENT:
        raise MessageRefused("That recipient name is too long to be a real one.")
    if not body:
        raise MessageRefused("There is nothing to send.")
    if len(body) > _MAX_BODY:
        raise MessageRefused(f"That message is {len(body)} characters; the limit is {_MAX_BODY}.")
    if protect is not None and protect(body):
        raise MessageRefused(
            "That message looks like it contains a password, one-time code or "
            "card number. OCADE does not send those — send it yourself if you "
            "really mean to."
        )

    fingerprint = _fingerprint(recipient, body)
    draft_id = f"msg_{fingerprint[:8]}"
    _DRAFTS[draft_id] = {
        "id": draft_id,
        "app": app,
        "recipient": recipient,
        "body": body,
        "fingerprint": fingerprint,
        "createdAt": time.time(),
        "sent": False,
    }
    return {
        "draftId": draft_id,
        "app": app,
        "recipient": recipient,
        "message": body,
        "fingerprint": fingerprint,
        "awaitingApproval": True,
        # The exact wording the surface shows the user. Built here so every
        # caller asks the same question, and so the confirmation names the
        # recipient — the detail people actually check.
        "confirmation": f"Send to {recipient} on {app}?\n\n{body}",
        "verified": False,
        "detail": (
            f"Drafted a message to {recipient}. Nothing has been sent — "
            "approve it to send."
        ),
    }


def _find_message_box(hwnd: int):
    """The composer, found by what a composer IS rather than by how big it is.

    THE HEURISTIC THIS REPLACES PICKED THE WHOLE PAGE.
    ---------------------------------------------------
    It took "the largest enabled Edit or Document", on the reasoning that a chat
    composer is the widest editable control and a search box is small and near
    the top. That reasoning holds for Win32 applications and fails completely
    for Electron ones — which is to say, for Discord, Slack, Teams, WhatsApp
    Desktop and every other chat app anyone actually uses.

    Measured on Discord. The window offers exactly three focusable things:

        Document 'Friends'   value pattern NO    1920x1040   y=0
        Group    ''          value pattern NO     269x852    y=81
        Edit     'Search'    value pattern YES   1077x38     y=177

    Chromium publishes the entire page as one root `Document`. It is enabled,
    focusable, and two million square pixels — so "largest" selected the page
    body and returned it as the message box. Had a send proceeded, `set_text`
    on the page root would have gone somewhere nobody chose. And on the screen
    above there is no composer at all, because no conversation is open; the old
    code would still have returned something confidently.

    THREE RULES, IN ORDER, NONE OF THEM APPLICATION-SPECIFIC:

      1. It must hold text. `textEntry` is true only when `get_value()`
         succeeds, which the page root fails and a real input passes. This one
         rule eliminates the Document and is the whole fix.
      2. It must sit in the lower half of the window. Composers are at the
         bottom of a conversation; search boxes are at the top. Position is a
         layout convention, not app knowledge — it is as true of Slack as of
         WhatsApp, and it is what separates 'Search' at y=177 from a composer.
      3. If nothing satisfies both, REFUSE. The old code's fallback — return the
         biggest thing and hope — is the behaviour that makes a wrong window
         look like a successful send.

    AND IT KEEPS LOOKING FOR A FEW SECONDS, BECAUSE THE FIRST READ CAN BE EARLY.
    Measured on a Chromium chat window three seconds after it opened: 43
    elements published, the address bar among them, and no composer yet. Ten
    seconds later the composer was there. A single read would have refused a
    window that was merely still loading — so the search retries, and only the
    LAST attempt's finding is reported. A window with genuinely no composer
    still refuses; it just takes `_COMPOSER_TIMEOUT` seconds to say so.
    """
    from core.uia import snapshot  # noqa: PLC0415

    deadline = time.monotonic() + _COMPOSER_TIMEOUT
    tree: dict[str, Any] | None = None
    typable: list[dict[str, Any]] = []
    lower: list[dict[str, Any]] = []

    while True:
        tree = snapshot(hwnd, limit=200)

        bounds = tree.get("bounds") or {}
        window_top = bounds.get("y")
        window_height = bounds.get("height")
        if window_height is None:
            # Derive the window's extent from the elements themselves when the
            # snapshot did not carry it, rather than assuming a screen size.
            tops = [e["bounds"]["y"] for e in tree["elements"]] or [0]
            bottoms = [e["bounds"]["y"] + e["bounds"]["height"] for e in tree["elements"]] or [1]
            window_top, window_height = min(tops), max(bottoms) - min(tops)
        midpoint = window_top + window_height / 2

        # Writable first; a readable-only surface is the fallback, because
        # WordPad's RichEdit document has no ValuePattern and is still the
        # right place to type. Chat composers are always writable, so this
        # never selects a page root when a real box exists.
        writable = [
            e
            for e in tree["elements"]
            if e.get("writable") and e.get("textEntry") and e["enabled"]
        ]
        readable = [e for e in tree["elements"] if e.get("textEntry") and e["enabled"]]
        typable = writable or readable
        lower = [e for e in typable if e["bounds"]["y"] >= midpoint]
        if lower:
            break
        if time.monotonic() >= deadline:
            break
        time.sleep(_COMPOSER_INTERVAL)

    if not lower:
        if tree.get("shellOnly"):
            raise MessageRefused(
                f"{tree['title'] or 'That window'} has not published its contents to "
                "the accessibility tree, so OCADE cannot see a message box. Wait for "
                "the conversation to appear on screen, then try again."
            )
        if not typable:
            raise MessageRefused(
                f"No text box was found in {tree['title'] or 'that window'}. Open the "
                "conversation you want to send to, then try again."
            )
        # Everything typable is in the top half — a search bar, an address bar,
        # a filter. None of those is a place to put somebody's message.
        where = ", ".join(f"{e['role']} {e['name']!r}" for e in typable[:3])
        raise MessageRefused(
            f"The only text boxes in {tree['title'] or 'that window'} are at the top "
            f"of the window ({where}), which is where search and filter fields live, "
            "not where a conversation is composed. Open the chat you want to send to "
            "so its message box is on screen."
        )

    # Among genuine candidates at the bottom, the widest is the composer: a chat
    # composer spans the conversation pane, an emoji or attachment field does not.
    lower.sort(key=lambda e: (e["bounds"]["y"], e["bounds"]["width"]), reverse=True)
    return tree, lower[0]


#: How much of a long message has to be found in the transcript. A chat client
#: is entitled to reflow, wrap or truncate what it renders, so requiring the
#: whole body would report a successful send as a failure. A distinctive
#: leading run is enough to tell "this message" from "some other message".
#: How long to wait for a contact list to filter after typing into search.
#: A desktop client filters locally and is nearly instant; a web client may
#: round-trip. Polled rather than slept, so a fast client is not made slow.
_FILTER_TIMEOUT = 6.0
_FILTER_INTERVAL = 0.3


#: Where a chat row stops being the NAME and starts being the preview.
#: WhatsApp labels a row with everything in it — "H 10:27 am You : https://…"
#: — so the name has to be cut out of that. These are the markers that always
#: follow the name: a clock time, a weekday, a date, or a relative day.
_ROW_TAIL = re.compile(
    r"\s(?:\d{1,2}:\d{2}|\d{1,2}/\d{1,2}/\d{2,4}"
    r"|monday|tuesday|wednesday|thursday|friday|saturday|sunday"
    r"|yesterday|today)",
    re.IGNORECASE,
)

#: Prefixes WhatsApp puts BEFORE the name, which are status rather than
#: identity. Stripped so "63 unread messages TABAHHI STORE" resolves to the
#: shop rather than to a sentence about unread messages.
_ROW_HEAD = re.compile(r"^\s*(?:\d+\s+unread\s+messages?|view\s+status)\s+", re.I)


def contact_name_of(row_label: str) -> str:
    """The conversation NAME inside a chat-list row's full label.

    MEASURED ON WHATSAPP, WHERE THE ROW LABEL IS THE WHOLE ROW:

        'H 10:27 am You : https://brandmotion.in/nexus.html?utm_source=…'
        '63 unread messages TABAHHI STORE 7:28 pm ~TABAHHI STORE : DM F…'
        'Thanu Akka Tuesday Done , Thanu Akka'

    Matching the user's word against that whole string is what made a search
    for the group called "H" return 55 candidates — every row containing the
    letter h, which is most of them. The name is the segment before the
    timestamp, and cutting there turns those three into "H", "TABAHHI STORE"
    and "Thanu Akka".
    """
    label = " ".join((row_label or "").split())
    label = _ROW_HEAD.sub("", label)
    cut = _ROW_TAIL.search(label)
    return (label[: cut.start()] if cut else label).strip()


def _row_matches(wanted: str, name: str) -> bool:
    """Does this chat row answer to that name?

    A SHORT NAME MUST MATCH EXACTLY, AND THAT IS THE WHOLE OF THIS FUNCTION.
    Substring matching is right for "Hann" -> "Hannah" and catastrophic for
    "H", which appears in a majority of English words: asked for the group
    literally called "H", OCADE found 55 candidates and refused. Correct, and
    useless.

    So a query of one or two characters is treated as a complete name — because
    that is what it is — and only an exact match counts. Longer queries keep
    substring behaviour, where it is genuinely useful.
    """
    normalised = _normalise(contact_name_of(name))
    if len(wanted) <= 2:
        return normalised == wanted
    return wanted in normalised


def _find_search_box(hwnd: int) -> tuple[dict[str, Any], dict[str, Any]]:
    """The search field: the mirror image of `_find_message_box`.

    Same two rules, opposite half of the window. A composer sits at the bottom
    of a conversation and a search field sits at the top, and that is a layout
    convention every chat client follows — WhatsApp, Discord, Slack, Telegram —
    because it is where people look for it. Neither rule knows which
    application this is.

    Measured on Discord's Friends screen, which is Chromium and therefore what
    WhatsApp Desktop also is:

        Document 'Friends'   textEntry NO    1920x1040   y=0     <- the page
        Edit     'Search'    textEntry YES   1077x38     y=177   <- this one
    """
    from core.uia import snapshot  # noqa: PLC0415

    tree = snapshot(hwnd, limit=200, settle=6.0)
    bounds = tree.get("bounds") or {}
    top = bounds.get("y", 0)
    height = bounds.get("height") or 1
    midpoint = top + height / 2

    # WRITABLE, NOT MERELY READABLE. Chromium publishes the whole page as a
    # `Document` with a TextPattern, so it reads as text — and WhatsApp's page
    # root was selected as the search box, where `set_text` was refused. Only a
    # control with a ValuePattern can be typed into.
    typable = [
        e for e in tree["elements"] if e.get("writable") and e.get("textEntry") and e["enabled"]
    ]
    upper = [e for e in typable if e["bounds"]["y"] < midpoint]
    if not upper:
        raise MessageRefused(
            f"No search box was found in {tree['title'] or 'that window'}. Make sure the "
            "app has finished loading and its contact list is on screen."
        )
    # Highest on screen wins: a search field sits above a filter or a tab bar.
    upper.sort(key=lambda e: (e["bounds"]["y"], -e["bounds"]["width"]))
    return tree, upper[0]


def find_contact(hwnd: int, query: str) -> dict[str, Any]:
    """Type a name into search and resolve it to ONE conversation, or refuse.

    "CLICK THE FIRST MATCHING RESULT" IS HOW A MESSAGE REACHES THE WRONG PERSON.
    ---------------------------------------------------------------------------
    That is the obvious implementation and it is not safe here. Searching "H" in
    anybody's contact list matches Hannah, Harry, Home, HR, and a group called
    "Holiday 2019". Whichever of those the client happens to sort first would
    receive the message, the approval card would have shown the name the USER
    typed rather than the one that got picked, and a sent message cannot be
    recalled.

    So this function RESOLVES or REFUSES. An exact name match wins outright —
    a contact literally called "H" is what "find contact H" means. Otherwise a
    single partial match is accepted, and two or more are handed back as a list
    for the user to choose between. Ambiguity is reported, never broken by
    position.

    Nothing is typed into a conversation here. This only navigates.
    """
    from core.uia import act  # noqa: PLC0415

    query = (query or "").strip()
    if not query:
        raise MessageRefused("There is no contact to look for.")

    tree, box = _find_search_box(hwnd)
    typed = act(hwnd, box["ref"], "set_text", text=query, fingerprint=box["fingerprint"])
    # VERIFIED BY THE VALUE, NOT BY THE VALUE CHANGING.
    #
    # `act` reports `verified` as "the control's state is different now", which
    # is the right test for a click and the wrong one for a write: searching
    # for "H" twice in a row leaves the box already reading "H", so a perfectly
    # correct write reported failure and the sequence stopped. What matters is
    # that the box CONTAINS what was typed.
    landed = _normalise((typed.get("after") or {}).get("value") or "") == _normalise(query)
    if not landed and not typed.get("verified"):
        raise MessageRefused(
            "The contact name did not land in the search box, so OCADE stopped rather "
            "than typing it somewhere else."
        )

    # POLLED, NOT SLEPT. A fixed one-second wait is either too long on a desktop
    # client that filters instantly or too short on a slow web one, and the
    # second case is the dangerous one: reading the list before it filters means
    # matching against the UNFILTERED contacts.
    from core.uia import snapshot  # noqa: PLC0415

    wanted = _normalise(query)
    deadline = time.monotonic() + _FILTER_TIMEOUT
    results: list[dict[str, Any]] = []
    while True:
        after = snapshot(hwnd, limit=200)
        # A contact row is a selectable list entry, not a text node and not the
        # search box the name was just typed into.
        results = [
            element
            for element in after["elements"]
            # `DataItem` IS IN THIS LIST BECAUSE WHATSAPP PUTS IT THERE.
            # Measured on WhatsApp Desktop: the chat list is a `DataGrid` of
            # `DataItem` rows, not the `ListItem` every other client uses. The
            # filter was written from Discord and Slack and would have found
            # zero contacts in WhatsApp while reporting, plausibly, that the
            # name did not match anything.
            # ROWS ONLY. `Button` and `Text` were in this list and they are
            # what made a one-letter query match 55 things: "WhatsApp",
            # "Chats", "Archived", "Resize the chat list panel" all contain an
            # "h". A conversation is a list row; a toolbar button never is.
            if element["role"] in ("ListItem", "TreeItem", "DataItem")
            and element["enabled"]
            and not element.get("textEntry")
            and _row_matches(wanted, element.get("name") or "")
        ]
        if results or time.monotonic() >= deadline:
            break
        time.sleep(_FILTER_INTERVAL)

    if not results:
        raise MessageRefused(
            f"No conversation matching “{query}” appeared after typing it into search. "
            "Check the name, or open the chat yourself and ask again."
        )

    # NESTED ROWS ARE ONE CONVERSATION, NOT THREE.
    #
    # WhatsApp publishes each chat as a DataGrid containing a DataItem
    # containing another DataItem, so a single conversation appears three
    # times with the same label. Measured: searching "H" produced three
    # identical candidates and the ambiguity guard refused a chat that was
    # never ambiguous. Collapsing on the RESOLVED NAME keeps the guard honest
    # for genuinely different conversations and silences the duplicates.
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for row in results:
        key = _normalise(contact_name_of(row.get("name") or ""))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    results = deduped

    exact = [r for r in results if _normalise(contact_name_of(r.get("name") or "")) == wanted]
    chosen = exact[0] if len(exact) == 1 else (results[0] if len(results) == 1 else None)

    if chosen is None:
        # The RESOLVED names, not the raw row labels. A chat client labels a
        # row with the whole row — name, timestamp and message preview — and
        # listing those makes the refusal unreadable and unanswerable.
        names = [contact_name_of(r.get("name") or "") or "?" for r in results[:8]]
        raise MessageRefused(
            f"“{query}” matches {len(results)} conversations: {', '.join(names)}. "
            "OCADE will not guess which one you meant — say the full name."
        )

    opened = act(hwnd, chosen["ref"], "click", fingerprint=chosen["fingerprint"])
    time.sleep(0.4)
    return {
        "query": query,
        # The conversation NAME, cut out of the row label. Callers use this as
        # the recipient on the approval card, and "Hannah 10:01 am hi" is not a
        # recipient anybody would recognise as themselves.
        "contact": contact_name_of(chosen.get("name") or ""),
        "rowLabel": (chosen.get("name") or "")[:160],
        "matchedExactly": bool(exact),
        "candidatesSeen": len(results),
        "how": opened.get("how"),
        "pointerUsed": opened.get("pointerUsed", False),
        "verified": bool(opened.get("verified")),
        "detail": (
            f"Opened the conversation with {chosen.get('name')}."
            if opened.get("verified")
            else f"Selected {chosen.get('name')} but the window did not visibly change."
        ),
    }


_MATCH_PREFIX = 60

#: Read-back is retried, because a transcript is rendered ASYNCHRONOUSLY. The
#: message goes to the server, comes back, and only then appears — and on a slow
#: connection that is comfortably longer than one 400 ms sleep. Checking once
#: would report "not sent" for messages that send perfectly well a moment later.
_READBACK_ATTEMPTS = 6
_READBACK_INTERVAL = 0.5


def _normalise(text: str) -> str:
    """Collapse whitespace so a wrapped line still matches what was sent."""
    return " ".join((text or "").split()).lower()


def _find_in_conversation(hwnd: int, body: str) -> dict[str, Any]:
    """Is the message actually in the conversation now?

    TASK 3, AND THE REASON IT IS A SEPARATE READ.
    ----------------------------------------------
    Verifying a send by watching the composer empty is verifying the wrong
    thing. The composer empties on success and on half a dozen kinds of
    failure, and it tells you nothing about whether a server accepted anything.
    The transcript is where a human would look, so it is where OCADE looks.

    This walks the window's accessibility tree — no conversation-container
    selector, no per-app knowledge — and asks whether any element's text
    contains what was sent. In a Chromium chat app each rendered message is a
    `Text` node whose name is the message; in a Win32 one it is a ListItem or a
    Document line. Both are found the same way, because both are just elements
    with text in them.

    THE COMPOSER IS EXCLUDED FROM THE SEARCH. It contained the message a moment
    ago by construction, so counting it would make this check always pass — the
    exact self-fulfilling verification this replaces.
    """
    from core.uia import snapshot  # noqa: PLC0415

    needle = _normalise(body)[:_MATCH_PREFIX]
    if not needle:
        return {"found": False, "searched": 0}

    searched = 0
    for attempt in range(_READBACK_ATTEMPTS):
        try:
            tree = snapshot(hwnd, limit=200)
        except Exception:  # noqa: BLE001
            time.sleep(_READBACK_INTERVAL)
            continue
        searched = tree["count"]
        for element in tree["elements"]:
            # Skip anything still holding editable text: that is the composer,
            # or another input, not the conversation.
            if element.get("textEntry"):
                continue
            if needle in _normalise(element.get("name") or ""):
                return {
                    "found": True,
                    "matchedText": (element.get("name") or "")[:200],
                    "matchedRole": element.get("role"),
                    "searched": searched,
                    "attempts": attempt + 1,
                }
        if attempt + 1 < _READBACK_ATTEMPTS:
            time.sleep(_READBACK_INTERVAL)

    return {"found": False, "searched": searched, "attempts": _READBACK_ATTEMPTS}


def send(
    draft_id: str,
    *,
    approved: bool,
    hwnd: int | None = None,
    fingerprint: str | None = None,
    shown_recipient: str | None = None,
    shown_body: str | None = None,
) -> dict[str, Any]:
    """Send a previously drafted message, but only on an explicit approval.

    `approved` is checked with `is not True` rather than a truthiness test on
    purpose. A caller that sends `"no"`, `1`, or `{}` has not approved anything,
    and every one of those is truthy.

    `shown_recipient` / `shown_body` ARE THE TEXT THE USER WAS ACTUALLY SHOWN,
    and passing them closes a hole that is otherwise wide open. The approval
    prompt has to display a recipient and a message, so those values travel
    with the call — and a caller that displays "hello Mum" while sending
    something else would then be trusted by exactly the control meant to stop
    it. So they are not display-only: they are re-hashed here and compared to
    the stored draft. What was shown and what is sent are the same thing, or
    nothing is sent.
    """
    record = _DRAFTS.get(draft_id)
    if record is None:
        raise MessageRefused(
            f"There is no draft called {draft_id}. Draft the message first, so "
            "you can see what would be sent."
        )
    if record["sent"]:
        raise MessageRefused("That message has already been sent.")
    if approved is not True:
        raise MessageRefused(
            f"Not approved, so nothing was sent to {record['recipient']}."
        )
    if time.time() - record["createdAt"] > DRAFT_TTL_SECONDS:
        _DRAFTS.pop(draft_id, None)
        raise MessageRefused(
            "That draft is more than ten minutes old. Draft it again so you can "
            "check it still says what you want."
        )
    if fingerprint is not None and fingerprint != record["fingerprint"]:
        raise MessageRefused(
            "What was approved is not what is about to be sent. Nothing was sent."
        )

    # THE SWAP GUARD IS MANDATORY, AND IT USED TO BE OPTIONAL.
    #
    # This block was `if shown_recipient is not None or shown_body is not None`,
    # which means the entire protection could be skipped by simply not passing
    # the arguments. A caller that omitted them got an unchecked send — and the
    # caller most likely to omit them is a buggy or hostile one, which is
    # exactly the caller the check exists for. Found by a live run that sent a
    # message successfully with both fields absent.
    #
    # So they are required now. A send has to state what the user was shown,
    # and that statement has to hash to the draft. There is no path to a send
    # that skips the comparison.
    if not shown_recipient or not shown_body:
        raise MessageRefused(
            "A send must state the recipient and message that were shown for "
            "approval, so OCADE can check they match the draft. Nothing was sent."
        )
    shown = _fingerprint(shown_recipient.strip(), shown_body.strip())
    if shown != record["fingerprint"]:
        raise MessageRefused(
            "The message shown for approval does not match the draft being "
            "sent. Nothing was sent."
        )

    if hwnd is None:
        raise MessageRefused(
            f"Open the {record['app']} conversation with {record['recipient']} "
            "and bring it to the front first."
        )

    from core.uia import act  # noqa: PLC0415

    tree, box = _find_message_box(hwnd)
    written = act(
        hwnd,
        box["ref"],
        "set_text",
        text=record["body"],
        fingerprint=box["fingerprint"],
    )
    if not written.get("verified"):
        raise MessageRefused(
            "The message text did not land in the message box, so nothing was "
            "sent. Nothing was typed into another window."
        )

    # Enter commits the composer in every chat application, and by this point
    # the text is confirmed to be sitting in the right control — so this is the
    # one keystroke in the flow, and it is sent after verification rather than
    # instead of it.
    import pyautogui  # noqa: PLC0415

    pyautogui.press("enter")
    time.sleep(0.4)

    landed = _find_in_conversation(hwnd, record["body"])

    # Composer state, kept as SUPPORTING evidence rather than as the verdict.
    cleared = None
    try:
        after = act(hwnd, box["ref"], "focus", fingerprint=box["fingerprint"])
        value = (after.get("after") or {}).get("value")
        cleared = (value or "").strip() == ""
    except Exception:  # noqa: BLE001
        cleared = None

    record["sent"] = True
    record["sentAt"] = time.time()
    verified = landed["found"]
    return {
        "draftId": draft_id,
        "app": record["app"],
        "recipient": record["recipient"],
        "message": record["body"],
        "window": tree["title"],
        "control": f"{box['role']} {box['name']!r}",
        "composerCleared": cleared,
        # The transcript evidence, quoted back so the receipt can be checked
        # rather than believed.
        "conversationMatch": landed.get("matchedText"),
        "conversationRole": landed.get("matchedRole"),
        "searchedElements": landed.get("searched"),
        # VERIFIED NOW MEANS "THE MESSAGE IS IN THE CONVERSATION".
        #
        # It used to mean "the composer went empty", and that is a much weaker
        # claim than it appears. A composer empties when the message sends — and
        # also when the app clears it on a failed send, when the conversation is
        # switched, when a draft is discarded, and when Escape is pressed. Every
        # one of those would have produced `verified: true` and a receipt saying
        # the message was sent.
        #
        # Measured on a live Chromium composer: after Enter the control stopped
        # exposing a readable value at all, so the clearing check could not even
        # be evaluated — while the sent text was plainly there in the transcript.
        # The transcript is the thing the user would look at to decide whether
        # the message went, so it is the thing OCADE checks.
        "verified": verified,
        "detail": (
            f"Sent to {record['recipient']} on {record['app']} — the message is "
            f"in the conversation."
            if verified
            else (
                f"Typed the message to {record['recipient']} and pressed Enter, but "
                f"OCADE could not find it in the conversation afterwards "
                f"(read {landed.get('searched', 0)} elements). It may not have sent — "
                "check the chat before sending again."
            )
        ),
    }


def pending() -> list[dict[str, Any]]:
    """Drafts still awaiting approval, newest first."""
    live = [
        {k: v for k, v in record.items() if k != "sent"}
        for record in _DRAFTS.values()
        if not record["sent"] and time.time() - record["createdAt"] <= DRAFT_TTL_SECONDS
    ]
    return sorted(live, key=lambda r: r["createdAt"], reverse=True)


def discard(draft_id: str) -> dict[str, Any]:
    """Throw a draft away without sending it."""
    record = _DRAFTS.pop(draft_id, None)
    return {
        "draftId": draft_id,
        "discarded": record is not None,
        "verified": True,
        "detail": (
            f"Discarded the message to {record['recipient']}."
            if record
            else f"There was no draft called {draft_id}."
        ),
    }
