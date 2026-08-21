"""Answers OCADE has to go and find: modes of search, flights, and local files.

WHY MODES AND NOT ONE SEARCH BOX
---------------------------------
"What is the news on X", "compare X and Y", "how much is X" and "explain X"
want different things from the same engine. One query shape answers all of them
badly: a news query sorted by relevance returns a 2019 article, and a price
query without the word "price" returns a Wikipedia page. Each mode below is the
same search with a query built for the question being asked, and a `mode` in
the receipt so the caller can see which shaping was applied.

EVERY MODE IS OFFLINE-AWARE, BECAUSE THE ALTERNATIVE IS CONFIDENT NONSENSE
--------------------------------------------------------------------------
All of it goes through `actions.web_search.search`, which probes reachability
first and returns a structured refusal carrying the exact caveat the model must
append. A local-first assistant is used on trains; an assistant that answers
"what is the news" from months-old weights without saying so is worse than one
that says it cannot.

FILES ARE READ, NEVER GUESSED AT
---------------------------------
`read_file` extracts real text from PDF, DOCX, XLSX, CSV and plain text and
returns it with a character count and the extractor that produced it. A summary
is the model's job; getting the text out accurately is this module's, and the
two are kept apart so a bad summary can never be mistaken for a bad read.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

#: Query shaping per mode. The user's words go in `{q}`; everything else is
#: what turns a bare phrase into the question they actually asked.
_MODES: dict[str, str] = {
    "search": "{q}",
    "news": "{q} news latest",
    "research": "{q} research paper study evidence",
    "price": "{q} price cost how much",
    "compare": "{q} comparison vs pros and cons",
}

#: Where a file may be read from. The same closed set the file tools use — a
#: model never supplies a bare path that reaches outside these.
_ROOTS = ("desktop", "downloads", "documents", "pictures", "music", "videos")

_MAX_CHARS = 20_000


def modes() -> list[str]:
    return list(_MODES)


def search_mode(query: str, mode: str = "search", *, max_results: int = 5) -> dict[str, Any]:
    """One search, shaped for the kind of question being asked."""
    from actions.web_search import search  # noqa: PLC0415

    key = " ".join((mode or "search").split()).lower()
    if key not in _MODES:
        return {
            "status": "invalid",
            "mode": key,
            "verified": False,
            "detail": f"Unknown search mode {key!r}. Use one of: {', '.join(_MODES)}.",
        }
    text = " ".join((query or "").split())
    if not text:
        return {"status": "invalid", "mode": key, "verified": False, "detail": "Nothing to search for."}

    # News is time-sensitive in a way the other modes are not; a month-old
    # headline is not news, so the window is narrowed at the engine.
    result = search(
        _MODES[key].format(q=text),
        max_results=max_results,
        timelimit="w" if key == "news" else None,
    )
    result["mode"] = key
    result["query"] = text
    return result


def flights(origin: str, destination: str, when: str = "") -> dict[str, Any]:
    """Live flight prices, read from the web rather than an airline API.

    NO BOOKING, EVER — this looks and reports. Buying a seat is a financial
    transaction with somebody's money and a date they have to live with, and it
    belongs to a person and their own browser.
    """
    start = " ".join((origin or "").split())
    end = " ".join((destination or "").split())
    if not start or not end:
        return {"verified": False, "detail": "A flight lookup needs where from and where to."}
    date = " ".join((when or "").split())
    found = search_mode(
        f"flights {start} to {end}" + (f" {date}" if date else "") + " price",
        "price",
        max_results=4,
    )
    if found["status"] != "online":
        return {
            "route": f"{start} to {end}",
            "verified": False,
            "detail": found.get("note") or found.get("detail") or "No flight data.",
        }
    return {
        "route": f"{start} to {end}",
        "when": date,
        "results": found["results"],
        "data": found.get("data", ""),
        "verified": True,
        "detail": (
            f"Found {len(found['results'])} source(s) for {start} to {end}"
            + (f" on {date}" if date else "")
            + ". Prices change constantly — book in your own browser."
        ),
    }


# ------------------------------------------------------------------ files --


def _resolve_under_root(folder: str, name: str) -> Path:
    """A path inside one approved folder, with no way out of it."""
    key = " ".join((folder or "").split()).lower()
    if key not in _ROOTS:
        raise ValueError(f"Files are read from {', '.join(_ROOTS)} — not {folder!r}.")
    base = Path(os.path.expanduser("~")) / {
        "desktop": "Desktop",
        "downloads": "Downloads",
        "documents": "Documents",
        "pictures": "Pictures",
        "music": "Music",
        "videos": "Videos",
    }[key]
    # Backslashes are separators to the client that sent this, whatever this
    # machine thinks. Left alone, `..\..\secrets.txt` is a traversal on
    # Windows and an ordinary FILENAME on Linux and macOS, so the same request
    # was refused on one platform and quietly accepted on another.
    requested = str(name).replace("\\", "/")

    # An absolute path is not a name inside a folder, and neither is a drive.
    if requested.startswith("/") or (len(requested) > 1 and requested[1] == ":"):
        raise ValueError("That path is outside the folder it was asked for.")

    root = base.resolve()
    target = (root / requested).resolve()

    # THE CHECK THAT MAKES THE FOLDER A BOUNDARY. Without it `../../.ssh/id_rsa`
    # is a valid "name" and the closed set of roots means nothing.
    #
    # Compared by PATH SEGMENTS rather than by string prefix. A prefix test
    # passes anything that merely starts with the same characters, so with
    # Documents approved, `../Documents-backup/secret.txt` resolved to
    # /root/Documents-backup/secret.txt — a different directory entirely — and
    # was allowed, because that string does start with /root/Documents.
    try:
        target.relative_to(root)
    except ValueError:
        raise ValueError("That path is outside the folder it was asked for.") from None
    return target


def read_file(folder: str, name: str, *, max_chars: int = _MAX_CHARS) -> dict[str, Any]:
    """Extract the text of a local document, and say how it was extracted."""
    path = _resolve_under_root(folder, name)
    if not path.is_file():
        return {"path": str(path), "exists": False, "verified": False,
                "detail": f"There is no file called {name} in {folder}."}

    suffix = path.suffix.lower()
    text = ""
    how = ""
    try:
        if suffix == ".pdf":
            import pdfplumber  # noqa: PLC0415

            with pdfplumber.open(path) as pdf:
                text = "\n".join((page.extract_text() or "") for page in pdf.pages[:50])
            how = "pdfplumber"
        elif suffix == ".docx":
            import docx  # noqa: PLC0415

            text = "\n".join(p.text for p in docx.Document(str(path)).paragraphs)
            how = "python-docx"
        elif suffix in (".xlsx", ".xls", ".csv"):
            import pandas  # noqa: PLC0415

            frame = pandas.read_csv(path) if suffix == ".csv" else pandas.read_excel(path)
            text = frame.to_string(max_rows=200)
            how = "pandas"
        else:
            text = path.read_text(encoding="utf-8", errors="replace")
            how = "plain text"
    except Exception as error:  # noqa: BLE001
        return {
            "path": str(path),
            "exists": True,
            "verified": False,
            "detail": f"{name} could not be read ({type(error).__name__}).",
        }

    clipped = text[:max_chars]
    return {
        "path": str(path),
        "exists": True,
        "how": how,
        "characters": len(text),
        "truncated": len(text) > max_chars,
        "text": clipped,
        # Verified means TEXT CAME OUT, not that it is any good. An empty PDF
        # is a real answer and must not read as a successful extraction.
        "verified": bool(clipped.strip()),
        "detail": (
            f"Read {len(text)} characters from {name} via {how}."
            if clipped.strip()
            else f"{name} opened but contains no extractable text (it may be scanned images)."
        ),
    }


def list_files(folder: str, pattern: str = "*") -> dict[str, Any]:
    """What is in one approved folder."""
    key = " ".join((folder or "").split()).lower()
    if key not in _ROOTS:
        raise ValueError(f"Files are listed from {', '.join(_ROOTS)} — not {folder!r}.")
    base = _resolve_under_root(key, "")
    rows = []
    try:
        for item in sorted(base.glob(pattern))[:200]:
            rows.append(
                {
                    "name": item.name,
                    "isFolder": item.is_dir(),
                    "bytes": item.stat().st_size if item.is_file() else 0,
                }
            )
    except OSError as error:
        return {"folder": key, "files": [], "verified": False, "detail": str(error)}
    return {
        "folder": key,
        "files": rows,
        "count": len(rows),
        "verified": True,
        "detail": f"{len(rows)} item(s) in {key}.",
    }
