"""The real office engines (plan.md §25.1 rung 1: documented app-native APIs).

Recalculation and PDF export are done by an installed office application, never
simulated: Excel and Word through their COM object models on Windows, else
LibreOffice headless. The engine that did the work is named in the evidence.
If neither is installed the action is refused, not faked.

STATUS: the LibreOffice path is exercised by the Linux test suite. The Excel and
Word COM path is UNTESTED until it runs on a real Windows machine with Office.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from .sandbox import Refused

TIMEOUT_SECONDS = 120


def _office_com(program: str):
    if sys.platform != "win32":
        return None
    try:
        import pythoncom  # type: ignore[import-not-found]
        import win32com.client  # type: ignore[import-not-found]

        pythoncom.CoInitialize()  # tools run on worker threads; COM is per thread
        return win32com.client.DispatchEx(program)
    except Exception:
        return None


def _soffice() -> str | None:
    found = shutil.which("soffice") or shutil.which("libreoffice")
    if found or sys.platform != "win32":
        return found
    default = Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "LibreOffice/program/soffice.exe"
    return str(default) if default.exists() else None


def _libreoffice_convert(source: Path, target_format: str, out_dir: Path) -> Path:
    executable = _soffice()
    if not executable:
        raise Refused("no_office_engine")
    # A private profile, so a person's own open LibreOffice is never touched or locked.
    with tempfile.TemporaryDirectory(prefix="ocade-lo-") as profile:
        subprocess.run(
            [
                executable,
                f"-env:UserInstallation={Path(profile).as_uri()}",
                "--headless",
                "--norestore",
                "--convert-to",
                target_format,
                "--outdir",
                str(out_dir),
                str(source),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=TIMEOUT_SECONDS,
        )
    produced = out_dir / (source.stem + "." + target_format.split(":")[0])
    if not produced.exists():
        raise Refused("office_engine_failed")
    return produced


def recalculate(path: Path) -> str:
    """Recalculate every formula in `path` in place with a real engine; returns its name."""
    excel = _office_com("Excel.Application")
    if excel is not None:
        try:
            excel.Visible = False
            excel.DisplayAlerts = False
            book = excel.Workbooks.Open(str(path))
            excel.CalculateFull()
            book.Save()
            book.Close(False)
        finally:
            excel.Quit()
        return "excel"
    with tempfile.TemporaryDirectory(prefix="ocade-calc-") as out:
        produced = _libreoffice_convert(path, "xlsx", Path(out))
        os.replace(produced, path)
    return "libreoffice"


def export_pdf(docx: Path, pdf: Path) -> str:
    """Export `docx` to `pdf` with a real word processor; returns its name."""
    word = _office_com("Word.Application")
    if word is not None:
        try:
            word.Visible = False
            document = word.Documents.Open(str(docx), ReadOnly=True)
            document.SaveAs2(str(pdf), FileFormat=17)  # wdFormatPDF
            document.Close(False)
        finally:
            word.Quit()
        return "word"
    with tempfile.TemporaryDirectory(prefix="ocade-pdf-") as out:
        produced = _libreoffice_convert(docx, "pdf", Path(out))
        shutil.move(str(produced), pdf)
    return "libreoffice"
