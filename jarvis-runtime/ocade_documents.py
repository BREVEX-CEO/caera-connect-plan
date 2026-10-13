"""
Document text, read directly, with no provider model.

Structure first, pixels never: PDF text through pypdf; Word and PowerPoint
from their own XML (a .docx/.pptx is a ZIP), so no Office library is needed;
spreadsheets through openpyxl with the values Excel last saved. Summarising is
the Online authority's job, not the device's.
"""
from __future__ import annotations

import html
import platform
import re
import zipfile
from pathlib import Path

TEXT_SUFFIXES = {".txt", ".md", ".csv", ".tsv", ".json", ".xml", ".html", ".htm", ".log",
                 ".py", ".js", ".ts", ".tsx", ".jsx", ".css", ".java", ".c", ".cpp", ".cs",
                 ".go", ".rs", ".rb", ".php", ".sql", ".yaml", ".yml", ".toml", ".ini", ".sh", ".ps1"}


class Unreadable(Exception):
    pass


def _xml_text(xml: str, paragraph: str) -> str:
    """Paragraph-separated text of an OOXML part."""
    xml = re.sub(rf"</{paragraph}>", "\n", xml)
    xml = re.sub(r"<w:tab/>|<a:tab/>", "\t", xml)
    return html.unescape(re.sub(r"<[^>]+>", "", xml))


def _zip_parts(path: Path, pattern: str, budget: int) -> tuple[list[str], int]:
    """(the matching parts in order, how many match), decompressed only up to `budget` bytes in
    all: a large or hostile archive costs no more than the preview it can fill."""
    parts, names = [], []
    try:
        with zipfile.ZipFile(path) as archive:
            names = sorted((n for n in archive.namelist() if re.fullmatch(pattern, n)),
                           key=lambda n: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", n)])
            for name in names:
                if budget <= 0:
                    break
                with archive.open(name) as part:
                    data = part.read(budget)
                budget -= len(data)
                parts.append(data.decode("utf-8", errors="replace"))
    except zipfile.BadZipFile as e:
        raise Unreadable("That file is damaged or not what its name says") from e
    return parts, len(names)


def extract_text(path: Path, limit: int) -> tuple[str, int | None]:
    """(text up to `limit` characters, page or slide count where there is one)."""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        parts, size = [], 0
        for page in reader.pages:
            text = page.extract_text() or ""
            parts.append(text)
            size += len(text)
            if size >= limit:
                break
        text = "\n".join(parts).strip()
        if not text:
            raise Unreadable("That PDF has no text layer (it may be scanned); look at it on screen instead")
        return text[:limit], len(reader.pages)
    # XML markup runs several times the text it carries: that many bytes fill a preview.
    budget = max(limit * 20, 1 << 20)
    if suffix in (".docx", ".docm", ".dotx"):
        parts, _ = _zip_parts(path, r"word/(document|header\d*|footer\d*)\.xml", budget)
        return "\n".join(_xml_text(p, "w:p") for p in parts).strip()[:limit], None
    if suffix in (".pptx", ".pptm"):
        slides, count = _zip_parts(path, r"ppt/slides/slide\d+\.xml", budget)
        text = "\n\n".join(f"Slide {i}:\n{_xml_text(x, 'a:p').strip()}" for i, x in enumerate(slides, 1))
        return text[:limit], count
    if suffix in (".xlsx", ".xlsm"):
        from openpyxl import load_workbook
        book = load_workbook(str(path), read_only=True, data_only=True)
        lines: list[str] = []
        for sheet in book.worksheets:
            lines.append(f"Sheet {sheet.title}:")
            for row in sheet.iter_rows(values_only=True):
                if any(v is not None for v in row):
                    lines.append("\t".join("" if v is None else str(v) for v in row))
                if sum(len(line) for line in lines) >= limit:
                    break
        book.close()
        return "\n".join(lines)[:limit], None
    if suffix in TEXT_SUFFIXES or not suffix:
        with path.open("rb") as source:
            data = source.read(limit * 4)
        if b"\0" in data[:4096]:
            raise Unreadable("That is not a text file")
        return data.decode("utf-8", errors="replace")[:limit], None
    raise Unreadable(f"JARVIS cannot read {suffix} files directly yet")


# Word's own built-in style ids: the same style in every Word language.
WORD_STYLES = {"Normal": -1, "Title": -63, "Subtitle": -75, "Heading 1": -2, "Heading 2": -3,
               "Heading 3": -4, "Heading 4": -5, "List Bullet": -49, "List Number": -50, "Quote": -181}


class DocumentError(Exception):
    pass


def validate_word(ops: list[dict]) -> list[dict]:
    """The document operations, checked and normalised before Word sees them."""
    if not isinstance(ops, list) or not 1 <= len(ops) <= 50:
        raise DocumentError("Give between 1 and 50 document operations")
    out = []
    for op in ops:
        kind = op.get("op")
        if kind == "replace":
            find, with_ = str(op.get("find", "")), str(op.get("with", ""))
            if not 1 <= len(find) <= 255 or len(with_) > 255:
                raise DocumentError("Find and replace texts are up to 255 characters")
            out.append({"op": kind, "find": find, "with": with_, "matchCase": bool(op.get("matchCase", True))})
        elif kind == "append":
            text = str(op.get("text", ""))
            if not 1 <= len(text) <= 5000:
                raise DocumentError("A paragraph is 1 to 5000 characters")
            style = op.get("style")
            if style is not None and style not in WORD_STYLES:
                raise DocumentError(f"Styles: {', '.join(WORD_STYLES)}")
            out.append({"op": kind, "text": text, **({"style": WORD_STYLES[style]} if style else {})})
        elif kind == "style":
            if op.get("style") not in WORD_STYLES or not 1 <= len(str(op.get("find", ""))) <= 255:
                raise DocumentError("style needs text to find and one of the known styles")
            out.append({"op": kind, "find": str(op["find"]), "style": WORD_STYLES[op["style"]]})
        elif kind in ("bold", "italic", "highlight"):
            if not 1 <= len(str(op.get("find", ""))) <= 255:
                raise DocumentError(f"{kind} needs the text to format")
            out.append({"op": kind, "find": str(op["find"])})
        elif kind == "table":
            rows = op.get("rows")
            if not isinstance(rows, list) or not 1 <= len(rows) <= 50 or not all(
                    isinstance(r, list) and 1 <= len(r) <= 12 and len(r) == len(rows[0]) for r in rows):
                raise DocumentError("A table is 1-50 rows of the same 1-12 cells")
            out.append({"op": kind, "rows": [[str(c)[:500] for c in r] for r in rows],
                        "header": bool(op.get("header", True))})
        else:
            raise DocumentError(f"Unknown document operation {kind!s:.30}")
    return out


def edit_document(path: Path, ops: list[dict], undo_dir: Path, cancel, close: bool = False) -> dict:
    """Edit a document in the app this computer automates its type with, after keeping a copy;
    a .docx with no such app (Linux, macOS without Office) is edited as its own file."""
    import ocade_sheets
    ops = validate_word(ops)
    if path.suffix.lower() not in (".docx", ".docm", ".doc", ".rtf"):
        raise DocumentError("JARVIS edits .docx, .docm, .doc and .rtf documents")
    server = ocade_sheets.automation_server(path.suffix)
    if server is None and path.suffix.lower() != ".docx":
        raise DocumentError("Editing this document needs an app on this computer that automates it")
    if cancel.is_set():
        return {"ok": False, "stopped": True, "error": "Stopped before it finished"}
    if server is None:
        kept = ocade_sheets.backup(path, undo_dir) if path.exists() else None
        result = edit_docx_file(path, ops)
        result.update(backup=kept.name if kept else None, app="the document itself")
        return result
    kept = ocade_sheets.backup(path, undo_dir)
    result = ocade_sheets.office_job("ocade_document.ps1", {"path": str(path), "ops": ops, "close": close,
                                                             "progId": server["progId"]}, cancel, server["app"])
    result.update(backup=kept.name, app=server["app"])
    return result


_STYLE_NAMES = {number: name for name, number in WORD_STYLES.items()}


def _set_text(paragraph, text: str, bold_part: str = "", how: str = "") -> None:
    """The paragraph's text in plain runs, with one part formatted. ponytail: other formatting
    inside that one paragraph is not kept; keep it run by run if a document needs it."""
    for run in list(paragraph.runs):
        run._r.getparent().remove(run._r)
    if not bold_part:
        paragraph.add_run(text)
        return
    at = text.find(bold_part)
    before, after = text[:at], text[at + len(bold_part):]
    if before:
        paragraph.add_run(before)
    marked = paragraph.add_run(bold_part)
    if how == "bold":
        marked.bold = True
    elif how == "italic":
        marked.italic = True
    else:
        from docx.enum.text import WD_COLOR_INDEX
        marked.font.highlight_color = WD_COLOR_INDEX.YELLOW
    if after:
        paragraph.add_run(after)


def read_docx(path: Path) -> dict:
    """What a .docx holds, read back from the saved file: as the Office route reads it."""
    from docx import Document
    doc = Document(str(path))
    lines = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        lines.extend("\t".join(cell.text for cell in row.cells) for row in table.rows)
    headings = [f"{p.style.name}|{p.text.strip()}" for p in doc.paragraphs
                if p.style.name.startswith("Heading") or p.style.name in ("Title", "Subtitle")][:50]
    return {"text": "\n".join(lines)[:20000], "paragraphs": len(doc.paragraphs),
            "tables": len(doc.tables), "headings": headings}


def edit_docx_file(path: Path, ops: list[dict]) -> dict:
    """The operations applied to the .docx itself (new when it does not exist yet), saved,
    reopened and read back."""
    from docx import Document
    doc = Document(str(path)) if path.exists() else Document()
    applied = []
    for op in ops:
        kind = op["op"]
        matching = [p for p in doc.paragraphs if op.get("find") and op["find"] in p.text]
        if kind == "append":
            paragraph = doc.add_paragraph(op["text"])
            if "style" in op:
                paragraph.style = doc.styles[_STYLE_NAMES[op["style"]]]
        elif kind == "replace":
            for paragraph in matching:
                _set_text(paragraph, paragraph.text.replace(op["find"], op["with"]))
        elif kind == "style":
            for paragraph in matching:
                paragraph.style = doc.styles[_STYLE_NAMES[op["style"]]]
        elif kind in ("bold", "italic", "highlight"):
            for paragraph in matching:
                _set_text(paragraph, paragraph.text, op["find"], kind)
        elif kind == "table":
            rows = op["rows"]
            table = doc.add_table(rows=len(rows), cols=len(rows[0]))
            table.style = doc.styles["Table Grid"]
            for r, row in enumerate(rows):
                for c, value in enumerate(row):
                    cell = table.cell(r, c)
                    cell.text = value
                    if op["header"] and r == 0:
                        for run in cell.paragraphs[0].runs:
                            run.bold = True
        if kind in ("replace", "style", "bold", "italic", "highlight") and not matching:
            return {"ok": False, "engine": "file", "applied": applied,
                    "error": f"{op['find'][:60]!r} is not in the document"}
        applied.append(kind)
    saved = read_docx_from(doc)
    doc.save(str(path))
    read = read_docx(path)
    return {"ok": True, "engine": "file", "applied": applied, "read": read,
            "savedAndReopened": read["text"] == saved, "reopenChecked": True}


def read_docx_from(doc) -> str:
    """The text a document object holds, in read_docx's order, before it is saved."""
    lines = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        lines.extend("\t".join(cell.text for cell in row.cells) for row in table.rows)
    return "\n".join(lines)[:20000]


def compare(before: Path, after: Path, limit: int = 60) -> dict:
    """What changed from `before` to `after`, read from the two files themselves: cells for
    workbooks, lines for documents and text, otherwise only whether the bytes differ."""
    workbooks = (".xlsx", ".xlsm")
    if before.suffix.lower() in workbooks and after.suffix.lower() in workbooks:
        from openpyxl import load_workbook
        from openpyxl.utils import get_column_letter

        def cells(path: Path) -> dict[str, dict[str, object]]:
            book = load_workbook(str(path), read_only=True)  # formulas as written, not cached values
            try:
                return {sheet.title: {f"{get_column_letter(c)}{r}": value
                                      for r, row in enumerate(sheet.iter_rows(values_only=True), 1)
                                      for c, value in enumerate(row, 1) if value is not None}
                        for sheet in book.worksheets}
            finally:
                book.close()

        old, new = cells(before), cells(after)
        changed = [{"sheet": title, "cell": cell, "before": old[title].get(cell), "after": new[title].get(cell)}
                   for title in old.keys() & new.keys()
                   for cell in sorted(old[title].keys() | new[title].keys())
                   if old[title].get(cell) != new[title].get(cell)]
        return {"kind": "cells", "sheetsAdded": sorted(new.keys() - old.keys()),
                "sheetsRemoved": sorted(old.keys() - new.keys()),
                "cells": changed[:limit], "more": max(0, len(changed) - limit)}
    import filecmp
    try:
        old_text, _ = extract_text(before, COMPARED)
        new_text, _ = extract_text(after, COMPARED)
    except Unreadable:
        return {"kind": "bytes", "same": filecmp.cmp(before, after, shallow=False),
                "sizes": [before.stat().st_size, after.stat().st_size]}
    import difflib
    lines = [line for line in difflib.unified_diff(old_text.splitlines(), new_text.splitlines(),
                                                   lineterm="", n=0)
             if line[:1] in "+-" and not line.startswith(("+++", "---"))]
    out = {"kind": "lines", "lines": lines[:limit], "more": max(0, len(lines) - limit)}
    # A long document is compared only so far: never reported unchanged past that point (C27).
    if len(old_text) >= COMPARED or len(new_text) >= COMPARED:
        out["partial"] = f"Only the first {COMPARED:,} characters of each were compared."
        out["differsLater"] = not lines and not filecmp.cmp(before, after, shallow=False)
    return out


COMPARED = 200_000
