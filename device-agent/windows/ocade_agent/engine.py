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

# The private LibreOffice profile: recalculate every formula when a file is loaded (its default
# keeps an Excel file's saved results, which can be stale or forged), and run no document macros.
_LIBREOFFICE_SETTINGS = """<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="ODFRecalcMode" oor:op="fuse"><value>0</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
</oor:items>
"""
MSO_AUTOMATION_SECURITY_FORCE_DISABLE = 3  # no macros run in a file opened by automation


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


def office_available() -> bool:
    """A spreadsheet/document engine exists: Excel and Word by COM registration, or LibreOffice."""
    if _soffice():
        return True
    if sys.platform != "win32":
        return False
    import winreg  # type: ignore[import-not-found]

    try:
        for program in ("Excel.Application", "Word.Application"):
            winreg.CloseKey(winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, program))
        return True
    except OSError:
        return False


def _soffice() -> str | None:
    """LibreOffice on PATH, or where its own installer puts it (it adds nothing to PATH)."""
    found = shutil.which("soffice") or shutil.which("libreoffice")
    if found:
        return found
    default = {
        "win32": Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "LibreOffice/program/soffice.exe",
        "darwin": Path("/Applications/LibreOffice.app/Contents/MacOS/soffice"),
    }.get(sys.platform)
    return str(default) if default and default.exists() else None


def _libreoffice_convert(source: Path, target_format: str, out_dir: Path) -> Path:
    executable = _soffice()
    if not executable:
        raise Refused("no_office_engine")
    # A private profile, so a person's own open LibreOffice is never touched or locked.
    with tempfile.TemporaryDirectory(prefix="ocade-lo-") as profile:
        (Path(profile) / "user").mkdir()
        (Path(profile) / "user" / "registrymodifications.xcu").write_text(_LIBREOFFICE_SETTINGS, encoding="utf-8")
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
            excel.AutomationSecurity = MSO_AUTOMATION_SECURITY_FORCE_DISABLE
            excel.EnableEvents = False
            book = excel.Workbooks.Open(str(path), UpdateLinks=0, AddToMru=False)
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
            word.AutomationSecurity = MSO_AUTOMATION_SECURITY_FORCE_DISABLE
            document = word.Documents.Open(str(docx), ReadOnly=True, AddToRecentFiles=False)
            document.SaveAs2(str(pdf), FileFormat=17)  # wdFormatPDF
            document.Close(False)
        finally:
            word.Quit()
        return "word"
    with tempfile.TemporaryDirectory(prefix="ocade-pdf-") as out:
        produced = _libreoffice_convert(docx, "pdf", Path(out))
        shutil.move(str(produced), pdf)
    return "libreoffice"
