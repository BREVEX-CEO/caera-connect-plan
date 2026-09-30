"""
Document text, read directly (donor file_processor, without its provider model).

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


def _zip_parts(path: Path, pattern: str) -> list[str]:
    try:
        with zipfile.ZipFile(path) as archive:
            names = sorted((n for n in archive.namelist() if re.fullmatch(pattern, n)),
                           key=lambda n: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", n)])
            return [archive.read(n).decode("utf-8", errors="replace") for n in names]
    except zipfile.BadZipFile as e:
        raise Unreadable("That file is damaged or not what its name says") from e


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
    if suffix in (".docx", ".docm", ".dotx"):
        parts = _zip_parts(path, r"word/(document|header\d*|footer\d*)\.xml")
        return "\n".join(_xml_text(p, "w:p") for p in parts).strip()[:limit], None
    if suffix in (".pptx", ".pptm"):
        slides = _zip_parts(path, r"ppt/slides/slide\d+\.xml")
        text = "\n\n".join(f"Slide {i}:\n{_xml_text(x, 'a:p').strip()}" for i, x in enumerate(slides, 1))
        return text[:limit], len(slides)
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
        data = path.read_bytes()[: limit * 4]
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


def word_available() -> bool:
    if platform.system() != "Windows":
        return False
    try:
        import winreg
        winreg.CloseKey(winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, r"Word.Application\CLSID"))
        return True
    except OSError:
        return False


def edit_word(path: Path, ops: list[dict], undo_dir: Path, cancel, close: bool = False) -> dict:
    """Edit a Word document in the person's Word, after keeping a copy in the undo folder."""
    import json
    import os
    import shutil
    import subprocess
    import tempfile
    import time
    ops = validate_word(ops)
    if path.suffix.lower() not in (".docx", ".docm", ".doc", ".rtf"):
        raise DocumentError("JARVIS edits Word documents (.docx, .doc, .rtf)")
    if not word_available():
        raise DocumentError("Editing a document needs Microsoft Word on this computer")
    undo_dir.mkdir(parents=True, exist_ok=True)
    kept = undo_dir / f"{time.strftime('%Y%m%d-%H%M%S')}-{path.name}"
    shutil.copy2(path, kept)
    fd, job = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as out:
        json.dump({"path": str(path), "ops": ops, "close": close}, out)
    try:
        script = Path(__file__).resolve().parent / "actions" / "ocade_word.ps1"
        process = subprocess.Popen(
            ["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
             str(script), "-JobFile", job], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        deadline = time.monotonic() + 180
        while process.poll() is None:
            if cancel.wait(0.2) or time.monotonic() > deadline:
                process.kill()
                return {"ok": False, "stopped": cancel.is_set(),
                        "error": "Stopped before it finished" if cancel.is_set() else "Word did not answer in time"}
        lines = process.stdout.read().decode("utf-8", errors="replace").strip().splitlines()
        result = json.loads(lines[-1]) if lines else {"ok": False, "error": "Word gave no answer"}
    finally:
        os.unlink(job)
    result["backup"] = kept.name
    return result
