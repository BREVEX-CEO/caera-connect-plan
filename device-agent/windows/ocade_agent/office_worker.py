"""The actor: `fs_sandbox` and `sys_core` office operations as one MCP stdio worker.

Started only by the gateway, with the workspace in `OCADE_WORKSPACE`. stdout is
the MCP protocol and nothing else; this module never prints. Each tool returns a
small JSON evidence object (hashes, counts, names) — never file contents.

Generic document primitives only: list and read files, inspect a workbook, write
a new workbook (formulas recalculated by a real engine) or an editable Word
document and its PDF. What to read, compute and write is the planner's choice.
"""

from __future__ import annotations

import functools
import os
import shutil
import time
from pathlib import Path

import openpyxl
from docx import Document
from mcp.server.mcpserver import MCPServer

from . import engine
from .sandbox import OUTPUT_DIR, TEXT_SUFFIXES, Refused, output_path, plain_text, resolve, sha256, write_atomically

app = MCPServer("ocade-office")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")


def _evidence(fn):
    """Refusals become `{"refused": code}` so the gateway can report not_applied."""

    @functools.wraps(fn)
    def wrapped(**kwargs):
        try:
            return fn(**kwargs)
        except Refused as refusal:
            return {"refused": refusal.code}

    return wrapped


@app.tool()
@_evidence
def fs_list(path: str = ".") -> dict:
    """List one workspace folder (names, kinds, sizes)."""
    folder = resolve(WORKSPACE, path)
    if not folder.is_dir():
        raise Refused("not_a_folder")
    entries = []
    for item in sorted(folder.iterdir(), key=lambda p: p.name.lower())[:200]:
        if item.name.startswith("."):
            continue
        entry = {"name": item.name, "kind": "folder" if item.is_dir() else "file", "size": item.stat().st_size}
        if os.name == "posix" and item.is_file():
            entry["executable"] = os.access(item, os.X_OK)  # a script without it cannot be started directly
        entries.append(entry)
    return {"entries": entries}


def _open_values(path: Path):
    if path.suffix.lower() != ".xlsx" or not path.is_file():
        raise Refused("not_a_workbook")
    try:
        return openpyxl.load_workbook(path, read_only=True, data_only=True)
    except Exception:
        raise Refused("unreadable_workbook")


@app.tool()
@_evidence
def office_inspect_workbook(path: str) -> dict:
    """Read a workbook's sheets, headers and row counts, and its SHA-256."""
    source = resolve(WORKSPACE, path)
    book = _open_values(source)
    sheets = []
    for sheet in book.worksheets:
        rows = sheet.iter_rows(values_only=True)
        headers = [str(h).strip() for h in next(rows, ()) if h is not None]
        sheets.append({"name": sheet.title, "headers": headers[:50], "rows": sum(1 for _ in rows)})
    book.close()
    return {"sha256": sha256(source), "sheets": sheets}


@app.tool()
@_evidence
def fs_read_text(path: str) -> dict:
    """The text of a workspace file (any plain-text file, docx, xlsx, pdf), bounded."""
    source = resolve(WORKSPACE, path)
    if not source.is_file():
        raise Refused("not_a_file")
    suffix = source.suffix.lower()
    if suffix == ".docx":
        document = Document(str(source))
        text = "\n".join(p.text for p in document.paragraphs) + "\n" + "\n".join(
            "\t".join(cell.text for cell in row.cells) for table in document.tables for row in table.rows
        )
    elif suffix == ".xlsx":
        book = _open_values(source)
        text = "\n".join(
            f"[{sheet.title}]\n" + "\n".join("\t".join("" if v is None else str(v) for v in row)
                                             for row in sheet.iter_rows(values_only=True))
            for sheet in book.worksheets
        )
        book.close()
    elif suffix == ".pdf":
        from pypdf import PdfReader

        text = "\n".join(page.extract_text() or "" for page in PdfReader(source).pages)
    else:
        text = plain_text(source)
        if text is None:
            raise Refused("unsupported_file_type")
    return {"sha256": sha256(source), "text": text[:8_000], "truncated": len(text) > 8_000}


@app.tool()
@_evidence
def fs_write_text(path: str, text: str) -> dict:
    """A new UTF-8 text file under OCADE output, written atomically and read back."""
    target = output_path(WORKSPACE, path)
    if target.suffix.lower() not in TEXT_SUFFIXES:
        raise Refused("unsupported_file_type")
    digest = write_atomically(target, lambda temporary: temporary.write_text(text, encoding="utf-8", newline=""))
    return {"sha256": digest, "bytes": target.stat().st_size, "matches": target.read_bytes().decode("utf-8") == text}


@app.tool()
@_evidence
def fs_replace_text(path: str, text: str, expectSha256: str) -> dict:
    """Replace a text file in place, only if it is still the version that was read; keep the original."""
    return _rewrite(path, expectSha256, lambda _: text)


@app.tool()
@_evidence
def fs_edit_text(path: str, edits: list[dict], expectSha256: str) -> dict:
    """Change exact passages of a text file in place (each `find` must occur exactly once), only if it is
    still the version that was read; everything else stays byte-for-byte; the original is kept."""

    def edited(current: str | None) -> str:
        if current is None:
            raise Refused("not_utf8")
        for edit in edits:
            if current.count(edit["find"]) != 1:
                raise Refused("find_not_unique" if edit["find"] in current else "find_not_found")
            current = current.replace(edit["find"], edit["replace"])
        return current

    return _rewrite(path, expectSha256, edited)


def _rewrite(path: str, expect: str, change) -> dict:
    """The one in-place writer: same version as read, original kept, mode kept, atomic swap."""
    target = resolve(WORKSPACE, path)
    if not target.is_file():
        raise Refused("not_a_file")
    if target.suffix.lower() in (".docx", ".xlsx", ".pdf") or plain_text(target) is None:
        raise Refused("unsupported_file_type")
    root = Path(os.path.realpath(WORKSPACE))
    output_root = root / OUTPUT_DIR
    relative = target.relative_to(root)
    if os.path.commonpath([output_root, target]) == str(output_root):
        raise Refused("write_inside_output")  # JARVIS's own outputs are never edited; write a new one
    before = sha256(target)
    if before != expect:
        raise Refused("file_changed")  # someone changed it since it was read: read it again
    try:
        current = target.read_bytes().decode("utf-8")
    except UnicodeDecodeError:
        current = None  # not UTF-8: only a whole replacement can change it
    text = change(current)
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    original = output_path(WORKSPACE, f"{OUTPUT_DIR}/originals/{relative.as_posix()}.{stamp}{target.suffix}")
    write_atomically(original, lambda temporary: shutil.copyfile(target, temporary))
    staged = target.with_name(f".ocade-{target.name}")
    try:
        staged.write_bytes(text.encode("utf-8"))
        shutil.copymode(target, staged)
        if sha256(target) != before:
            raise Refused("file_changed")
        os.replace(staged, target)
    finally:
        staged.unlink(missing_ok=True)
    return {"sha256Before": before, "sha256": sha256(target), "original": original.relative_to(root).as_posix(),
            "matches": target.read_bytes().decode("utf-8") == text}


@app.tool()
@_evidence
def system_inspect(programs: list[str] | None = None) -> dict:
    """OS, architecture, free workspace disk and where named programs resolve; nothing is run."""
    import platform

    from . import discovery

    found = {}
    for name in (programs or [])[:20]:
        path = shutil.which(name) or discovery.app_path(name if name.lower().endswith(".exe") else f"{name}.exe")
        if path and os.path.isfile(path):
            found[name] = {"path": path[:300], "bytes": os.path.getsize(path), **_file_version(path)}
        else:
            found[name] = {"path": None}
    return {
        "os": platform.system(), "release": platform.release(), "version": platform.version()[:120],
        "machine": platform.machine(), "freeBytes": shutil.disk_usage(WORKSPACE).free, "programs": found,
    }


def _file_version(path: str) -> dict:
    """The version Windows records in a program file's resources, when it has one."""
    if os.name != "nt":
        return {}
    try:
        import win32api  # type: ignore[import-not-found]

        info = win32api.GetFileVersionInfo(path, "\\")
        ms, ls = info["FileVersionMS"], info["FileVersionLS"]
        return {"fileVersion": f"{ms >> 16}.{ms & 0xFFFF}.{ls >> 16}.{ls & 0xFFFF}"}
    except Exception:
        return {}


@app.tool()
@_evidence
def office_write_document(docx: str, title: str, sections: list[dict], pdf: str | None = None) -> dict:
    """A new editable Word document from headings, paragraphs and tables; optionally its PDF."""
    docx_path = output_path(WORKSPACE, docx)
    pdf_path = output_path(WORKSPACE, pdf) if pdf else None

    def write(temporary: Path) -> None:
        document = Document()
        document.add_heading(title, level=0)
        for section in sections:
            document.add_heading(section["heading"], level=1)
            for paragraph in section.get("paragraphs", []):
                document.add_paragraph(paragraph)
            rows = section.get("table") or []
            if rows:
                table = document.add_table(rows=0, cols=max(len(r) for r in rows))
                table.style = "Table Grid"
                for row in rows:
                    for cell, text in zip(table.add_row().cells, row):
                        cell.text = text
        document.save(temporary)

    result = {"sha256": {"docx": write_atomically(docx_path, write)}}
    if pdf_path:
        used = {}
        result["sha256"]["pdf"] = write_atomically(
            pdf_path, lambda temporary: used.update(engine=engine.export_pdf(docx_path, temporary))
        )
        result["engine"] = used["engine"]
    return result


@app.tool()
@_evidence
def office_write_workbook(path: str, sheets: list[dict]) -> dict:
    """A new workbook; cells starting with '=' are formulas, recalculated by a real engine."""
    target = output_path(WORKSPACE, path)
    used = {}

    def write(temporary: Path) -> None:
        book = openpyxl.Workbook()
        book.remove(book.active)
        for spec in sheets:
            sheet = book.create_sheet(spec["name"])
            for row in spec["rows"]:
                sheet.append(row)
        book.save(temporary)
        used["engine"] = engine.recalculate(temporary)

    return {"sha256": write_atomically(target, write), "engine": used["engine"]}


if __name__ == "__main__":
    app.run("stdio")
