"""The actor: `fs_sandbox` and `sys_core` office operations as one MCP stdio worker.

Started only by the gateway, with the workspace in `OCADE_WORKSPACE`. stdout is
the MCP protocol and nothing else; this module never prints. Each tool returns a
small JSON evidence object (hashes, counts, names) — never file contents.

Journey 1 (plan.md §27.1): read a workbook, reconcile two sheets by key into a
new workbook whose differences and totals are live formulas recalculated by a
real engine, then write an editable Word report and its PDF.
"""

from __future__ import annotations

import functools
import json
import os
import shutil
import subprocess
from pathlib import Path

import openpyxl
from docx import Document
from mcp.server.mcpserver import MCPServer

from . import engine
from .sandbox import Refused, output_path, resolve, sha256, write_atomically

app = MCPServer("ocade-office")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
MAX_ROWS = 50_000


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
        entries.append(
            {"name": item.name, "kind": "folder" if item.is_dir() else "file", "size": item.stat().st_size}
        )
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


def _read_side(book, side: dict) -> dict[str, float]:
    """Key → amount for one side. Blank keys are skipped; duplicate keys or text amounts refuse."""
    if side["sheet"] not in book.sheetnames:
        raise Refused("sheet_not_found")
    rows = book[side["sheet"]].iter_rows(values_only=True)
    headers = [str(h).strip() if h is not None else "" for h in next(rows, ())]
    try:
        key_at, amount_at = headers.index(side["key"]), headers.index(side["amount"])
    except ValueError:
        raise Refused("column_not_found")
    values: dict[str, float] = {}
    for number, row in enumerate(rows):
        if number >= MAX_ROWS:
            raise Refused("too_many_rows")
        key = row[key_at] if key_at < len(row) else None
        if key is None or str(key).strip() == "":
            continue
        key = str(key).strip()
        amount = row[amount_at] if amount_at < len(row) else None
        if key in values:
            raise Refused("duplicate_key")
        if amount is None:
            amount = 0
        if not isinstance(amount, (int, float)) or isinstance(amount, bool):
            raise Refused("amount_not_numeric")
        values[key] = float(amount)
    return values


@app.tool()
@_evidence
def office_reconcile_workbook(source: str, left: dict, right: dict, output: str) -> dict:
    """Reconcile two sheets by key into a new workbook with live formulas; the source is only read."""
    source_path = resolve(WORKSPACE, source)
    target = output_path(WORKSPACE, output)
    book = _open_values(source_path)
    left_values, right_values = _read_side(book, left), _read_side(book, right)
    book.close()
    keys = sorted(set(left_values) | set(right_values))
    used = {}

    def produce(temporary: Path) -> None:
        out = openpyxl.Workbook()
        sheet = out.active
        sheet.title = "Reconciliation"
        sheet.append(["Key", f"{left['sheet']} {left['amount']}", f"{right['sheet']} {right['amount']}", "Difference", "Status"])
        for row, key in enumerate(keys, start=2):
            in_left, in_right = key in left_values, key in right_values
            sheet.append([key, left_values.get(key), right_values.get(key), f"=N(C{row})-N(B{row})", None])
            sheet.cell(row, 5).value = (
                f'=IF(ABS(D{row})<0.005,"Matched","Amount differs")'
                if in_left and in_right
                else ("Missing in " + (right["sheet"] if in_left else left["sheet"]))
            )
        last = len(keys) + 1
        sheet.append(["Total", f"=SUM(B2:B{last})", f"=SUM(C2:C{last})", f"=SUM(D2:D{last})", None])
        summary = out.create_sheet("Summary")
        summary.append(["Rows", len(keys)])
        summary.append(["Exceptions", f'=COUNTIF(Reconciliation!E2:E{last},"<>Matched")'])
        summary.append([f"{left['sheet']} total", f"=Reconciliation!B{last + 1}"])
        summary.append([f"{right['sheet']} total", f"=Reconciliation!C{last + 1}"])
        summary.append(["Net difference", f"=Reconciliation!D{last + 1}"])
        out.save(temporary)
        used["engine"] = engine.recalculate(temporary)

    digest = write_atomically(target, produce)
    return {"sha256": digest, "rows": len(keys), "engine": used["engine"]}


@app.tool()
@_evidence
def office_write_report(workbook: str, docx: str, pdf: str, title: str) -> dict:
    """Write an editable Word report from the recalculated workbook, and its PDF."""
    source = resolve(WORKSPACE, workbook)
    docx_path, pdf_path = output_path(WORKSPACE, docx), output_path(WORKSPACE, pdf)
    book = _open_values(source)
    if "Reconciliation" not in book.sheetnames or "Summary" not in book.sheetnames:
        raise Refused("not_a_reconciliation")
    rows = list(book["Reconciliation"].iter_rows(values_only=True))
    summary = {str(r[0]): r[1] for r in book["Summary"].iter_rows(values_only=True)}
    book.close()
    if any(v is None for v in summary.values()):
        raise Refused("workbook_not_calculated")
    headers, lines = rows[0], rows[1:-1]
    exceptions = [r for r in lines if r[4] != "Matched"]

    def write_docx(temporary: Path) -> None:
        document = Document()
        document.add_heading(title, level=0)
        document.add_heading("Summary", level=1)
        for label, value in summary.items():
            shown = f"{value:,.2f}" if isinstance(value, float) else str(value)
            document.add_paragraph(f"{label}: {shown}")
        document.add_heading("Exceptions", level=1)
        if not exceptions:
            document.add_paragraph("No exceptions: every key matched.")
        else:
            table = document.add_table(rows=1, cols=5)
            table.style = "Table Grid"
            for cell, text in zip(table.rows[0].cells, headers):
                cell.text = str(text)
            for line in exceptions:
                for column, (cell, value) in enumerate(zip(table.add_row().cells, line)):
                    amount = column in (1, 2, 3) and isinstance(value, (int, float))
                    cell.text = "" if value is None else (f"{value:,.2f}" if amount else str(value))
        document.add_heading("Source", level=1)
        document.add_paragraph(f"Workbook: {workbook}")
        document.save(temporary)

    docx_digest = write_atomically(docx_path, write_docx)
    used = {}

    def write_pdf(temporary: Path) -> None:
        used["engine"] = engine.export_pdf(docx_path, temporary)

    pdf_digest = write_atomically(pdf_path, write_pdf)
    return {"sha256": {"docx": docx_digest, "pdf": pdf_digest}, "exceptions": len(exceptions), "engine": used["engine"]}


@app.tool()
@_evidence
def fs_read_text(path: str) -> dict:
    """The text of a workspace file (txt, csv, md, docx, xlsx, pdf), bounded."""
    source = resolve(WORKSPACE, path)
    if not source.is_file():
        raise Refused("not_a_file")
    suffix = source.suffix.lower()
    if suffix in (".txt", ".csv", ".md", ".json"):
        text = source.read_text(encoding="utf-8", errors="replace")
    elif suffix == ".docx":
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
        raise Refused("unsupported_file_type")
    return {"sha256": sha256(source), "text": text[:8_000], "truncated": len(text) > 8_000}


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


@app.tool()
@_evidence
def media_inspect(path: str) -> dict:
    """Technical facts of an image (Pillow) or audio/video file (ffprobe): never its pixels."""
    source = resolve(WORKSPACE, path)
    if not source.is_file():
        raise Refused("not_a_file")
    try:
        from PIL import Image

        with Image.open(source) as image:
            orientation = image.getexif().get(274, 1)
            width, height = image.size
            if orientation in (5, 6, 7, 8):
                width, height = height, width
            return {
                "sha256": sha256(source),
                "kind": "image",
                "format": image.format,
                "width": width,
                "height": height,
                "mode": image.mode,
                "orientation": "landscape" if width > height else "portrait" if height > width else "square",
            }
    except (OSError, ValueError):
        pass  # not an image: try it as media
    probe = shutil.which("ffprobe")
    if not probe:
        raise Refused("no_media_probe")
    run = subprocess.run(
        [probe, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(source)],
        capture_output=True, timeout=60, text=True,
    )
    if run.returncode != 0:
        raise Refused("unreadable_media")
    facts = json.loads(run.stdout)
    streams = [
        {
            "type": s.get("codec_type"),
            "codec": s.get("codec_name"),
            "width": s.get("width"),
            "height": s.get("height"),
            "fps": s.get("avg_frame_rate"),
            "channels": s.get("channels"),
        }
        for s in facts.get("streams", [])[:8]
    ]
    return {
        "sha256": sha256(source),
        "kind": "media",
        "container": facts.get("format", {}).get("format_name"),
        "duration": float(facts.get("format", {}).get("duration", 0) or 0),
        "streams": streams,
    }


@app.tool()
@_evidence
def media_trim(source: str, start: float, end: float, output: str) -> dict:
    """Cut [start, end) seconds of a media file into a new file with ffmpeg; the source is only read."""
    origin = resolve(WORKSPACE, source)
    target = output_path(WORKSPACE, output)
    executable = shutil.which("ffmpeg")
    if not executable:
        raise Refused("no_media_engine")
    if end <= start or not origin.is_file():
        raise Refused("invalid_range")

    def cut(temporary: Path) -> None:
        run = subprocess.run(
            [executable, "-v", "error", "-y", "-ss", str(start), "-to", str(end), "-i", str(origin),
             "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", "-f", "mp4", str(temporary)],
            capture_output=True, timeout=600,
        )
        if run.returncode != 0:
            raise Refused("media_engine_failed")

    return {"sha256": write_atomically(target, cut), "engine": "ffmpeg"}


if __name__ == "__main__":
    app.run("stdio")
