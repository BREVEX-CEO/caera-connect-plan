"""File Explorer: opening a shell folder, then a folder inside it.

THE INSTRUCTION THIS EXISTS FOR
--------------------------------
    "open downloads folder and open the folder named mummy"

The first half was already deterministic. The second half was not implemented
at all: the remainder went to the model, which has no way to click a row in a
list it cannot see, so nothing happened and the run ended looking successful.

WHY EXPLORER NEEDS A SKILL AND NOTEPAD DOES NOT
------------------------------------------------
Typing into a document is universal — find the text control, use the value
pattern, read it back — and `core/uia.py` does that for every application on
the machine without naming any of them. Opening a folder is not universal: it
means finding a row in a specific list view and invoking it, and "which list is
the file list" is a fact about Explorer.

That fact lives here, in one file, rather than as a special case inside the
generic code. Explorer's file view is a `List` (or `DataGrid` on some Windows
builds) of `ListItem`/`DataItem` rows — measured, not assumed — and the item
name is the folder name exactly as shown.

INVOKE FIRST, DOUBLE-CLICK ONLY IF INVOKE IS REFUSED
-----------------------------------------------------
`InvokePattern` opens the item without touching the mouse, which is the whole
promise of the accessibility route. Some Explorer builds expose file rows
without it, and for those a double-click on the row's own centre is the only
way in. It is a real pointer action, so it is reported as one: `pointerUsed`
is a fact in the receipt, never hidden behind a success.
"""

from __future__ import annotations

import time
from typing import Any

#: Canonical shell folders, matching the closed set the bridge accepts. A skill
#: never takes a path from a model, so this is a lookup and not a parse.
SHELL_FOLDERS = {
    "downloads": "Downloads",
    "download": "Downloads",
    "documents": "Personal",
    "desktop": "Desktop",
    "pictures": "My Pictures",
    "photos": "My Pictures",
    "videos": "My Video",
    "music": "My Music",
    "this pc": "MyComputerFolder",
    "computer": "MyComputerFolder",
    "recycle bin": "RecycleBinFolder",
    "home": "UsersFilesFolder",
}

#: Explorer repaints its file list asynchronously after a navigation, so the
#: rows are polled rather than read once. A folder with many items takes
#: noticeably longer than an empty one.
_SETTLE_TIMEOUT = 12.0
_SETTLE_INTERVAL = 0.4

#: The roles Explorer uses for file and folder rows. Both are present because
#: Windows builds differ: the details view reports DataItem, the icon views
#: report ListItem.
_ROW_ROLES = ("ListItem", "DataItem", "TreeItem")


class ExplorerSkill:
    name = "File Explorer"

    def can_handle(self, app: str) -> bool:
        return (app or "").strip().lower() in {
            "explorer",
            "explorer.exe",
            "file explorer",
            "files",
            "windows explorer",
            "folder",
        }

    # ------------------------------------------------------------------ open

    def shell_folder_for(self, phrase: str) -> str | None:
        """The canonical shell name a phrase refers to, or None."""
        key = " ".join((phrase or "").split()).lower()
        for noise in ("my ", "the "):
            if key.startswith(noise):
                key = key[len(noise) :]
        for suffix in (" folder", " directory"):
            if key.endswith(suffix):
                key = key[: -len(suffix)]
        return SHELL_FOLDERS.get(key.strip())

    # ------------------------------------------------------------- navigate

    def file_list_hwnd(self, hwnd: int) -> int:
        """The CHILD window that actually holds the file list.

        MEASURED, BECAUSE THE OBVIOUS ANSWER IS WRONG. Walking the Explorer
        top-level window returns 23 elements and not one file: it exposes the
        ribbon, the tabs, the navigation buttons — the chrome — and stops. The
        listing lives in a child HWND of class `DirectUIHWND`, which on this
        machine held 61 nodes and 7 item rows while the parent held none.

        So `_rows` reads that child, not the window. Reading the parent is why
        an earlier version of this skill reported a folder as empty and could
        never find anything to open.
        """
        import win32gui  # noqa: PLC0415

        found: list[int] = []

        def visit(child: int, _param) -> bool:
            try:
                if win32gui.GetClassName(child) == "DirectUIHWND":
                    found.append(child)
            except Exception:  # noqa: BLE001, S110
                pass
            return True

        try:
            win32gui.EnumChildWindows(hwnd, visit, None)
        except Exception:  # noqa: BLE001, S110
            pass
        # CHOSEN BY WHAT IT CONTAINS, NOT BY HOW BIG IT IS.
        #
        # An earlier version took the largest DirectUIHWND, which on this
        # machine is the search-box host: one Button called "Search", zero
        # files. Several of these windows exist — navigation pane, details
        # pane, search — and the only reliable way to tell which is the file
        # list is to ask each one whether it has any item rows in it. That is a
        # handful of cheap COM calls and it cannot pick the wrong pane.
        from pywinauto import Desktop  # noqa: PLC0415

        best = hwnd
        best_rows = 0
        for child in found:
            try:
                nodes = Desktop(backend="uia").window(handle=child).descendants()
            except Exception:  # noqa: BLE001
                continue
            rows = sum(
                1
                for node in nodes
                if (getattr(node.element_info, "control_type", "") or "") in _ROW_ROLES
            )
            if rows > best_rows:
                best, best_rows = child, rows
        return best

    def _rows(self, hwnd: int) -> list[dict[str, Any]]:
        """Every file/folder row Explorer is currently showing."""
        from core.uia import snapshot  # noqa: PLC0415

        tree = snapshot(self.file_list_hwnd(hwnd), limit=200)
        return [
            element
            for element in tree["elements"]
            if element["role"] in _ROW_ROLES and element["enabled"] and element["name"]
        ]

    def open_item(self, hwnd: int, name: str) -> dict[str, Any]:
        """Open the folder or file called `name` in this Explorer window.

        EXACT MATCH WINS, AND AMBIGUITY IS REFUSED RATHER THAN GUESSED.
        A folder list routinely contains "mummy", "mummy old" and "mummy
        backup". Opening whichever sorts first is the same class of mistake as
        messaging the wrong contact — it is not destructive, but it is
        confidently wrong, and the user cannot tell from the receipt.
        """
        from core.uia import act  # noqa: PLC0415

        wanted = " ".join((name or "").split()).lower()
        if not wanted:
            raise ValueError("There is no folder name to open.")

        # Refs are indices into a walk of ONE window, so the window that
        # produced them must be the window acted on. Resolving a ref from the
        # child list against the parent frame would silently address a
        # different element.
        list_hwnd = self.file_list_hwnd(hwnd)

        deadline = time.monotonic() + _SETTLE_TIMEOUT
        rows: list[dict[str, Any]] = []
        matches: list[dict[str, Any]] = []
        while True:
            rows = self._rows(hwnd)
            matches = [r for r in rows if wanted in (r["name"] or "").lower()]
            if matches or time.monotonic() >= deadline:
                break
            time.sleep(_SETTLE_INTERVAL)

        if not matches:
            shown = ", ".join(r["name"] for r in rows[:8]) or "nothing"
            return {
                "opened": False,
                "item": name,
                "candidates": len(rows),
                "verified": False,
                "detail": (
                    f"No item called “{name}” is in this folder. It shows: {shown}."
                ),
            }

        exact = [r for r in matches if (r["name"] or "").strip().lower() == wanted]
        chosen = exact[0] if exact else (matches[0] if len(matches) == 1 else None)
        if chosen is None:
            names = ", ".join(r["name"] for r in matches[:6])
            return {
                "opened": False,
                "item": name,
                "verified": False,
                "detail": (
                    f"“{name}” matches {len(matches)} items here ({names}). "
                    "Say the full name so OCADE opens the right one."
                ),
            }

        before = {r["name"] for r in rows}
        pointer_used = False
        how = None

        # SELECT IS NOT OPEN, AND THE GENERIC CLICK PREFERS SELECT.
        #
        # `uia.act(..., "click")` tries toggle, then selection, then invoke —
        # correct for most controls, wrong for a file row, because a ListItem
        # answers the selection pattern and merely highlights. Measured: the
        # row was found, `selection_pattern` succeeded, and the listing was
        # unchanged because nothing had been opened.
        #
        # A folder is opened by INVOKING it, so invoke is tried first and
        # directly. Explorer rows on some builds expose no invoke pattern at
        # all, and for those a double-click is the only way in — a real pointer
        # action, declared as one.
        from core.uia import _resolve  # noqa: PLC0415

        element = None
        try:
            element = _resolve(list_hwnd, chosen["ref"], chosen["fingerprint"], 200)["_element"]
        except Exception:  # noqa: BLE001
            element = None

        if element is not None:
            for attempt, label in (
                (lambda: element.invoke(), "invoke_pattern"),
                (lambda: element.double_click_input(), "uia_double_click"),
            ):
                try:
                    attempt()
                    how = label
                    pointer_used = label != "invoke_pattern"
                    break
                except Exception:  # noqa: BLE001, S112
                    continue
        del act  # the generic click path is deliberately not used here

        if how is None:
            # Explorer rows on some builds expose no invoke pattern. A double
            # click on the row's own bounds is the documented way in, and it is
            # a pointer action, so it is declared as one.
            import pyautogui  # noqa: PLC0415

            bounds = chosen["bounds"]
            pyautogui.doubleClick(
                bounds["x"] + bounds["width"] // 2,
                bounds["y"] + bounds["height"] // 2,
            )
            how = "pointer_double_click"
            pointer_used = True

        # VERIFIED BY THE LISTING CHANGING. Opening a folder replaces the rows;
        # a click that landed on nothing leaves them identical, and that must
        # not read as success.
        time.sleep(0.6)
        after = {r["name"] for r in self._rows(hwnd)}
        changed = after != before

        return {
            "opened": changed,
            "item": chosen["name"],
            "how": how,
            "pointerUsed": pointer_used,
            "itemsBefore": len(before),
            "itemsAfter": len(after),
            "verified": changed,
            "detail": (
                f"Opened “{chosen['name']}”; the folder now shows {len(after)} item(s)."
                if changed
                else f"Selected “{chosen['name']}” but the listing did not change."
            ),
        }

    # -------------------------------------------------------------- dispatch

    def execute(self, command: str, hwnd: int | None, **kwargs: Any) -> dict[str, Any]:
        """`open <name>` inside an already-open Explorer window."""
        if hwnd is None:
            raise ValueError("File Explorer is not open, so there is nothing to navigate.")
        target = kwargs.get("item") or command
        return self.open_item(hwnd, str(target))


SKILL = ExplorerSkill()
