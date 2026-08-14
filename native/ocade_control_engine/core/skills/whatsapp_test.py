"""The WhatsApp acceptance test, run against the real application.

    open whatsapp -> find the conversation named exactly "H" -> type
    "Hello H I am Ocade your new Little friend , I was created for testing ,
     will you be my new friend"

WHY "H" IS THE HARD CASE, AND WHY THE TEST IS WRITTEN AROUND IT
----------------------------------------------------------------
"H" is a group, not a person, and it is one character long. Every naive
approach fails on it in a different way, and each failure below was observed
before it was fixed:

  * substring matching returns 55 rows, because "h" is in "WhatsApp", "Chats",
    "Archived" and most message previews;
  * matching the row's LABEL fails, because WhatsApp labels a row with the
    whole row — "H 10:27 am You : https://…" — so the name has to be cut out;
  * the same conversation appears three times, because rows nest DataGrid >
    DataItem > DataItem, and an ambiguity guard then refuses a chat that was
    never ambiguous;
  * the row rejects a generic click and needs select-then-Enter.

Run it directly:  python core/skills/whatsapp_test.py
It is also importable as a pytest module.

NOTHING IS SENT BY DEFAULT. The message is typed into the composer and read
back, which proves every step of the path. Pass --send to press Enter and
verify the message landed in the conversation.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[2]
if str(ENGINE) not in sys.path:
    sys.path.insert(0, str(ENGINE))

CONTACT = "H"
MESSAGE_TEMPLATE = (
    "Hello {recipient}, this is a test message from "
    "I was created for testing , will you be my new friend"
)


def run(send: bool = False) -> int:
    from core.skills.whatsapp import SKILL, contact_name_of, name_matches

    failures: list[str] = []

    def check(label: str, ok: bool, detail: str = "") -> None:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f" — {detail}" if detail else ""))
        if not ok:
            failures.append(label)

    # ---- pure logic first, so a UI failure cannot hide a parsing failure ----
    print("\n[0] name extraction (no UI)")
    check(
        "row label reduces to the conversation name",
        contact_name_of("H 10:27 am You :  https://brandmotion.in/nexus.html") == "H",
        repr(contact_name_of("H 10:27 am You :  https://brandmotion.in/nexus.html")),
    )
    check(
        "unread prefix is stripped",
        contact_name_of("63 unread messages TABAHHI STORE 7:28 pm ~T") == "TABAHHI STORE",
    )
    check(
        "'H' matches the H group",
        name_matches("H", "H 10:27 am You :  https://x"),
    )
    check(
        "'H' does NOT match every row containing an h",
        not name_matches("H", "63 unread messages TABAHHI STORE 7:28 pm")
        and not name_matches("H", "Thanu Akka Tuesday Done")
        and not name_matches("H", "Chats"),
    )

    # ---- the real application ----
    print("\n[1] open WhatsApp")
    opened = SKILL.launch()
    check("WhatsApp is open and in front", bool(opened.get("verified")), opened.get("detail", ""))
    hwnd = opened.get("hwnd") or SKILL.window()
    if hwnd is None:
        print("\nWhatsApp is not available; stopping.")
        return 1

    print("\n[2] find the conversation named exactly 'H'")
    try:
        found = SKILL.find_contact(hwnd, CONTACT)
        check(
            f"resolved to a single conversation named {found['contact']!r}",
            found["contact"] == CONTACT,
            f"how={found['how']} pointerUsed={found['pointerUsed']}",
        )
        check("the conversation actually opened", bool(found["verified"]), found["detail"])
        recipient = found["contact"]
    except Exception as error:  # noqa: BLE001
        check("find the conversation", False, f"{type(error).__name__}: {error}")
        return 1

    body = MESSAGE_TEMPLATE.format(recipient=recipient)
    print(f"\n[3] type the message\n      {body}")
    try:
        typed = SKILL.type_message(hwnd, body)
        check("text landed in the message box", bool(typed["verified"]), typed["detail"])
        check("no pointer was used to type", typed["pointerUsed"] is False)
        print(f"      control: {typed['control']}")
        print(f"      readback: {typed['readback'][:90]!r}")
    except Exception as error:  # noqa: BLE001
        check("type the message", False, f"{type(error).__name__}: {error}")
        return 1

    if send:
        print("\n[4] send, and verify from the conversation")
        result = SKILL.send_typed(hwnd, body)
        check("the message is in the conversation", bool(result["verified"]), result["detail"])
        if result.get("match"):
            print(f"      matched: {result['match'][:90]!r}")
    else:
        print("\n[4] not sent (pass --send to commit and verify delivery)")

    print(f"\n{'ALL CHECKS PASSED' if not failures else 'FAILED: ' + ', '.join(failures)}")
    return 0 if not failures else 1


# ---- pytest entry points -------------------------------------------------

def test_name_extraction() -> None:
    """The parsing half, which needs no WhatsApp and must never regress."""
    from core.skills.whatsapp import contact_name_of, name_matches

    assert contact_name_of("H 10:27 am You :  https://x") == "H"
    assert contact_name_of("63 unread messages TABAHHI STORE 7:28 pm ~T") == "TABAHHI STORE"
    assert contact_name_of("Thanu Akka Tuesday Done , Thanu Akka") == "Thanu Akka"
    assert name_matches("H", "H 10:27 am You :  https://x")
    # The whole reason the short-name rule exists.
    assert not name_matches("H", "63 unread messages TABAHHI STORE 7:28 pm")
    assert not name_matches("H", "Chats")
    assert not name_matches("H", "Thanu Akka Tuesday Done")
    # Longer names keep substring behaviour, which is useful.
    assert name_matches("Thanu", "Thanu Akka Tuesday Done")


if __name__ == "__main__":
    started = time.monotonic()
    code = run(send="--send" in sys.argv)
    print(f"({round(time.monotonic() - started, 1)}s)")
    raise SystemExit(code)
