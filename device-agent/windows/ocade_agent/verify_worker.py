"""The independent verifier (plan.md §12, §27.2, P16) as its own MCP stdio worker.

Runs in a separate process from the actor and shares none of its reading or
writing code, on purpose: a bug in how the actor reads a sheet must not also
convince the verifier. It re-reads the ORIGINAL workbook and the SAVED outputs
from disk and reports one boolean (or None when unobservable) per predicate.
It never writes anything and never declares a task done; the server settles.
"""

from __future__ import annotations

import hashlib
import io
import os
import zipfile
from pathlib import Path

import openpyxl
import pypdfium2
from docx import Document
from mcp.server.mcpserver import MCPServer
from pypdf import PdfReader

from .sandbox import Refused, resolve

app = MCPServer("ocade-verifier")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
VERSION = "journey1-verifier/1"
TOLERANCE = 0.005


def _digest(path: Path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def _side(path: Path, side: dict) -> dict[str, float] | None:
    """Independent read of one side of the original: key → numeric amount, or None if unreadable."""
    try:
        book = openpyxl.load_workbook(path, data_only=True)
        sheet = book[side["sheet"]]
    except Exception:
        return None
    header = [None if c.value is None else str(c.value).strip() for c in sheet[1]]
    if side["key"] not in header or side["amount"] not in header:
        return None
    k, a = header.index(side["key"]), header.index(side["amount"])
    out: dict[str, float] = {}
    for row in sheet.iter_rows(min_row=2):
        key = row[k].value if k < len(row) else None
        if key is None or not str(key).strip():
            continue
        amount = row[a].value if a < len(row) else None
        out[str(key).strip()] = float(amount or 0)
    return out


def _formulas_present(path: Path) -> bool:
    """Difference and total cells are formulas in the saved file, not pasted numbers."""
    with zipfile.ZipFile(path) as archive:
        names = [n for n in archive.namelist() if n.startswith("xl/worksheets/sheet")]
        xml = b"".join(archive.read(n) for n in names)
    return xml.count(b"<f>") + xml.count(b"<f ") >= 2


def _pdf_ok(path: Path, must_contain: list[str]) -> bool:
    try:
        text = " ".join(page.extract_text() or "" for page in PdfReader(path).pages)
        document = pypdfium2.PdfDocument(str(path))
        for index in range(len(document)):
            bitmap = document[index].render(scale=0.5).to_pil().convert("L")
            dark = sum(bitmap.histogram()[:200])
            if dark < 50:  # a blank page: nothing but near-white pixels
                return False
        return len(document) > 0 and all(word in text for word in must_contain)
    except Exception:
        return False


@app.tool()
def verify_reconciliation_report(
    source: str, sourceSha256: str, left: dict, right: dict, workbook: str, docx: str, pdf: str
) -> dict:
    """Independently check a Journey 1 reconciliation against its original and saved outputs."""
    try:
        paths = {name: resolve(WORKSPACE, rel) for name, rel in
                 {"source": source, "workbook": workbook, "docx": docx, "pdf": pdf}.items()}
    except Refused as refusal:
        return {"refused": refusal.code}
    hashes = {name: _digest(path) for name, path in paths.items()}
    predicates: dict[str, bool | None] = {name: None for name in (
        "original_unchanged", "rows_accounted", "totals_reconcile", "formulas_recalculated",
        "report_docx_sections", "report_pdf_renders")}
    predicates["original_unchanged"] = hashes["source"] == sourceSha256

    left_values, right_values = _side(paths["source"], left), _side(paths["source"], right)
    rows = exceptions = None
    if hashes["workbook"] and left_values is not None and right_values is not None:
        expected_keys = set(left_values) | set(right_values)
        expected_exceptions = {
            k for k in expected_keys
            if k not in left_values or k not in right_values
            or abs(right_values[k] - left_values[k]) >= TOLERANCE
        }
        values = openpyxl.load_workbook(paths["workbook"], data_only=True)
        lines = [r for r in values["Reconciliation"].iter_rows(min_row=2, values_only=True)]
        body, total = lines[:-1], lines[-1]
        keys = [str(r[0]) for r in body]
        rows, exceptions = len(keys), sum(1 for r in body if r[4] != "Matched")
        predicates["rows_accounted"] = sorted(keys) == sorted(expected_keys) and len(keys) == len(set(keys))
        calculated = all(r[3] is not None and r[4] is not None for r in body) and None not in total[1:4]
        predicates["formulas_recalculated"] = calculated and _formulas_present(paths["workbook"])
        left_total, right_total = sum(left_values.values()), sum(right_values.values())
        predicates["totals_reconcile"] = bool(
            calculated
            and abs(total[1] - left_total) < TOLERANCE
            and abs(total[2] - right_total) < TOLERANCE
            and abs(total[3] - (right_total - left_total)) < TOLERANCE
            and {str(r[0]) for r in body if r[4] != "Matched"} == expected_exceptions
            and all(abs(r[3] - (right_values.get(str(r[0]), 0) - left_values.get(str(r[0]), 0))) < TOLERANCE for r in body)
        )

    if hashes["docx"]:
        try:
            document = Document(io.BytesIO(paths["docx"].read_bytes()))
            headings = {p.text for p in document.paragraphs if p.style.name.startswith("Heading")}
            table_rows = sum(len(t.rows) - 1 for t in document.tables)
            predicates["report_docx_sections"] = {"Summary", "Exceptions"} <= headings and (
                exceptions is None or table_rows == exceptions
            )
        except Exception:
            predicates["report_docx_sections"] = False
    if hashes["pdf"]:
        predicates["report_pdf_renders"] = _pdf_ok(paths["pdf"], ["Summary", "Exceptions"])

    return {"predicates": predicates, "sha256": hashes, "rows": rows, "exceptions": exceptions,
            "verifierVersion": VERSION}


if __name__ == "__main__":
    app.run("stdio")
