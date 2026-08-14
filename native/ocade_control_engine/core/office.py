"""Spreadsheets and documents, with a receipt for every write.

THE RULE THIS MODULE EXISTS TO ENFORCE
--------------------------------------
A save that was not read back is a claim, not a result. `DataFrame.to_excel`
returning without raising tells you the call completed; it does not tell you a
file exists, that it is not zero bytes, that the rows survived, or that the
thing on disk can be opened by the program the user is going to open it with.
Those are different questions and only the last one matters to them.

So every write here ends the same way: REOPEN, RE-PARSE, COUNT, and return a
receipt describing what is actually on disk. If the reopen fails or the counts
disagree with what was asked for, `verified` is false and the detail says which
— and the agent loop treats an unverified mutation as not done.

WHY THE COUNTS ARE COMPARED AND NOT JUST THE SIZE
-------------------------------------------------
A non-zero file size proves bytes were written, which is a low bar: a truncated
spreadsheet, a document that saved its first paragraph and then hit an encoding
error, and a perfect file all have a non-zero size. Reading the rows back and
comparing them to what was requested is the check that distinguishes them.

PATHS ARE NOT DECIDED HERE
--------------------------
Every function takes an already-resolved `Path`. The bridge resolves it through
`_file_path`, which confines writes to the user's named folders and refuses
absolute paths and traversal. Doing it here as well would be a second, weaker
copy of a rule that already has one owner.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

#: Read/written through pandas.
TABLE_SUFFIXES = {".csv", ".tsv", ".xlsx", ".xlsm"}
#: Read/written through python-docx.
DOCUMENT_SUFFIXES = {".docx"}

#: A guard against a model asking for a spreadsheet with a million rows and
#: stalling the machine. Large enough for real work, small enough to survive.
MAX_ROWS = 100_000
MAX_PREVIEW_ROWS = 50


class OfficeUnavailable(RuntimeError):
    """A required library is not installed, named so the user can install it."""


class OfficeRefused(RuntimeError):
    """The request cannot be carried out as asked, with the reason."""


def _pandas():
    try:
        import pandas as pd  # noqa: PLC0415

        return pd
    except Exception as error:  # noqa: BLE001
        raise OfficeUnavailable(
            "Spreadsheet work needs the 'pandas' package, which is not installed "
            "in this Python environment."
        ) from error


def _docx():
    try:
        import docx  # noqa: PLC0415

        return docx
    except Exception as error:  # noqa: BLE001
        raise OfficeUnavailable(
            "Word documents need the 'python-docx' package, which is not "
            "installed in this Python environment."
        ) from error


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


# --------------------------------------------------------------- the receipt


def receipt(path: Path, *, expected_rows: int | None = None, kind: str = "file") -> dict[str, Any]:
    """Reopen what was just written and describe what is genuinely there.

    THE ORDER MATTERS. Existence, then size, then a real parse, then the count.
    Each step can only be trusted if the one before it held, and reporting a row
    count from a file that failed to open would be the exact fiction the receipt
    exists to prevent.
    """
    if not path.exists():
        return {
            "exists": False,
            "verified": False,
            "path": str(path),
            "detail": f"Nothing was written: {path.name} is not on disk.",
        }

    size = path.stat().st_size
    out: dict[str, Any] = {
        "exists": True,
        "path": str(path),
        "name": path.name,
        "bytes": size,
        "sha256": _sha256(path)[:16],
        "modifiedAt": int(path.stat().st_mtime),
        "kind": kind,
    }

    if size == 0:
        out["verified"] = False
        out["detail"] = f"{path.name} was created but is empty."
        return out

    # Reopening is the point of the whole exercise: it is the only step that
    # proves the file the user will open is one that opens.
    try:
        if path.suffix.lower() in TABLE_SUFFIXES:
            frame = _read_frame(path)
            out["rows"] = int(len(frame))
            out["columns"] = [str(c) for c in frame.columns][:50]
        elif path.suffix.lower() in DOCUMENT_SUFFIXES:
            document = _docx().Document(str(path))
            out["paragraphs"] = len([p for p in document.paragraphs if p.text.strip()])
    except Exception as error:  # noqa: BLE001
        out["verified"] = False
        out["detail"] = f"{path.name} exists ({size} bytes) but could not be reopened: {error}"
        return out

    # "3 row(s)" on a Word document is a small lie that makes a receipt read as
    # boilerplate. The unit follows what was actually counted.
    unit = "paragraph" if "paragraphs" in out else "row"
    written = out.get("rows", out.get("paragraphs"))
    if expected_rows is not None and written is not None and int(written) != int(expected_rows):
        out["verified"] = False
        out["expected"] = expected_rows
        out["detail"] = (
            f"{path.name} reopened with {written} {unit}(s) but {expected_rows} were asked for."
        )
        return out

    out["verified"] = True
    counted = f", {written} {unit}(s)" if written is not None else ""
    out["detail"] = f"Saved {path.name} ({size:,} bytes{counted}) and reopened it to check."
    return out


# -------------------------------------------------------------- spreadsheets


def _read_frame(path: Path):
    pd = _pandas()
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path, nrows=MAX_ROWS)
    if suffix == ".tsv":
        return pd.read_csv(path, sep="\t", nrows=MAX_ROWS)
    if suffix in (".xlsx", ".xlsm"):
        return pd.read_excel(path, nrows=MAX_ROWS)
    raise OfficeRefused(f"OCADE reads .csv, .tsv and .xlsx here, not '{suffix or path.name}'.")


def read_table(path: Path, *, preview_rows: int = MAX_PREVIEW_ROWS) -> dict[str, Any]:
    """Open a spreadsheet and describe it, with a bounded preview.

    Returns SHAPE AND A SAMPLE, never the whole file. A 40,000-row sheet pasted
    into a 3B model's context is not analysis, it is an out-of-memory error with
    extra steps — and the model needs the columns and a few rows to decide what
    to ask for next, not the data itself.
    """
    if not path.exists():
        raise OfficeRefused(f"There is no file called {path.name} there.")
    frame = _read_frame(path)
    preview = frame.head(max(1, min(int(preview_rows), MAX_PREVIEW_ROWS)))
    return {
        "path": str(path),
        "name": path.name,
        "rows": int(len(frame)),
        "columnCount": int(len(frame.columns)),
        "columns": [str(c) for c in frame.columns][:50],
        "preview": preview.to_dict(orient="records"),
        "truncated": bool(len(frame) > len(preview)),
        "verified": True,
        "detail": f"Read {path.name}: {len(frame)} row(s), {len(frame.columns)} column(s).",
    }


def write_table(path: Path, rows: list[dict], *, sheet: str = "Sheet1") -> dict[str, Any]:
    """Write a spreadsheet, then reopen it and return the receipt."""
    pd = _pandas()
    if not isinstance(rows, list) or not rows:
        raise OfficeRefused("There are no rows to write.")
    if len(rows) > MAX_ROWS:
        raise OfficeRefused(f"That is {len(rows)} rows; OCADE writes up to {MAX_ROWS} here.")
    if not all(isinstance(row, dict) for row in rows):
        raise OfficeRefused("Each row must be an object of column name to value.")

    frame = pd.DataFrame(rows)
    suffix = path.suffix.lower()
    path.parent.mkdir(parents=True, exist_ok=True)

    if suffix == ".csv":
        frame.to_csv(path, index=False)
    elif suffix == ".tsv":
        frame.to_csv(path, sep="\t", index=False)
    elif suffix in (".xlsx", ".xlsm"):
        frame.to_excel(path, index=False, sheet_name=sheet[:31] or "Sheet1")
    else:
        raise OfficeRefused(f"OCADE writes .csv, .tsv and .xlsx here, not '{suffix or path.name}'.")

    return receipt(path, expected_rows=len(rows), kind="spreadsheet")


# ------------------------------------------------------------------ documents


def read_document(path: Path, *, max_chars: int = 20_000) -> dict[str, Any]:
    """Read a Word document's text."""
    if not path.exists():
        raise OfficeRefused(f"There is no file called {path.name} there.")
    if path.suffix.lower() not in DOCUMENT_SUFFIXES:
        raise OfficeRefused(f"OCADE reads .docx here, not '{path.suffix or path.name}'.")
    document = _docx().Document(str(path))
    paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
    text = "\n".join(paragraphs)
    return {
        "path": str(path),
        "name": path.name,
        "paragraphs": len(paragraphs),
        "text": text[:max_chars],
        "truncated": len(text) > max_chars,
        "tables": len(document.tables),
        "verified": True,
        "detail": f"Read {path.name}: {len(paragraphs)} paragraph(s).",
    }


def write_document(
    path: Path,
    paragraphs: list[str],
    *,
    title: str | None = None,
) -> dict[str, Any]:
    """Write a Word document, then reopen it and return the receipt."""
    docx = _docx()
    if not isinstance(paragraphs, list) or not any(str(p).strip() for p in paragraphs):
        raise OfficeRefused("There is nothing to write into the document.")
    if path.suffix.lower() not in DOCUMENT_SUFFIXES:
        raise OfficeRefused(f"OCADE writes .docx here, not '{path.suffix or path.name}'.")

    document = docx.Document()
    written = 0
    if title and title.strip():
        document.add_heading(title.strip()[:200], level=1)
        written += 1
    for paragraph in paragraphs:
        body = str(paragraph)
        if not body.strip():
            continue
        document.add_paragraph(body[:20_000])
        written += 1

    path.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(path))
    return receipt(path, expected_rows=written, kind="document")
