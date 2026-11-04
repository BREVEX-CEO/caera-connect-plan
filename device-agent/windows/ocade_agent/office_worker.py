"""The actor: `fs_sandbox` and `sys_core` office operations as one MCP stdio worker.

Started only by the gateway, with the workspace in `OCADE_WORKSPACE`. stdout is
the MCP protocol and nothing else; this module never prints. Each tool returns a
small JSON evidence object (hashes, counts, names) — never file contents.

Generic document primitives only: list and read files, inspect a workbook, write
a new workbook (formulas recalculated by a real engine) or an editable Word
document and its PDF. What to read, compute and write is the planner's choice.
"""

from __future__ import annotations

import hashlib
import os
import secrets
import shutil
import tempfile
import time
from pathlib import Path

import openpyxl
from docx import Document
from mcp.server.mcpserver import MCPServer

from . import engine
from .sandbox import (
    OUTPUT_DIR, TEXT_SUFFIXES, Refused, guarded as _evidence, mark_effect,
    output_path, plain_text, resolve, sha256, write_atomically,
)

app = MCPServer("ocade-office")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")


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
    with target.open("rb") as stream:
        data = stream.read(2_000_001)
    if len(data) > 2_000_000:
        raise Refused("file_too_large")
    if target.suffix.lower() in (".docx", ".xlsx", ".pdf") or b"\0" in data:
        raise Refused("unsupported_file_type")
    root = Path(os.path.realpath(WORKSPACE))
    output_root = root / OUTPUT_DIR
    relative = target.relative_to(root)
    if os.path.commonpath([output_root, target]) == str(output_root):
        raise Refused("write_inside_output")  # JARVIS's own outputs are never edited; write a new one
    before = hashlib.sha256(data).hexdigest()
    if before != expect:
        raise Refused("file_changed")  # someone changed it since it was read: read it again
    try:
        current = data.decode("utf-8")
    except UnicodeDecodeError:
        current = None  # not UTF-8: only a whole replacement can change it
    text = change(current)
    stamp = f"{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}-{secrets.token_hex(8)}"
    original = output_path(WORKSPACE, f"{OUTPUT_DIR}/originals/{relative.as_posix()}.{stamp}{target.suffix}")
    write_atomically(original, lambda temporary: temporary.write_bytes(data))
    handle, temporary = tempfile.mkstemp(dir=target.parent, prefix=".ocade-", suffix=target.suffix)
    staged = Path(temporary)
    aside = staged.with_name(staged.name + ".was")
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(text.encode("utf-8"))
        shutil.copymode(target, staged)
        if resolve(WORKSPACE, path) != target:
            raise Refused("file_changed")  # a folder on the way was swapped since it was resolved
        # Compare-and-swap without a silent-overwrite window: move the version that is there now
        # aside (atomic), and go on only if it is still the version that was read.
        try:
            os.rename(target, aside)
        except OSError:
            raise Refused("file_in_use")  # e.g. held open by an editor on Windows: nothing changed
        if sha256(aside) != before:
            os.rename(aside, target)
            raise Refused("file_changed")
        mark_effect()
        try:
            os.link(staged, target) if os.name == "posix" else os.rename(staged, target)
        except FileExistsError:
            raise Refused("file_changed_during_write")  # a new file appeared there: both are kept
        # A save through a handle opened before the move lands in the aside copy: keep it, say so.
        if sha256(aside) != before:
            os.replace(aside, target)
            raise Refused("file_changed_during_write")
    finally:
        staged.unlink(missing_ok=True)
        if aside.exists():  # never leave the person without their file
            aside.unlink() if target.exists() else os.rename(aside, target)
    return {"sha256Before": before, "sha256": sha256(target), "original": original.relative_to(root).as_posix(),
            "matches": target.read_bytes().decode("utf-8") == text}


def _organisable(path: str) -> Path:
    """A workspace item JARVIS may move, trash or change attributes of: never the workspace
    itself, and never a kept original (they are the person's way back)."""
    target = resolve(WORKSPACE, path)
    root = Path(os.path.realpath(WORKSPACE))
    originals = root / OUTPUT_DIR / "originals"
    if target == root or target == root / OUTPUT_DIR:
        raise Refused("workspace_root")
    if os.path.commonpath([originals, target]) == str(originals):
        raise Refused("original_kept")
    return target


def _relative(target: Path) -> str:
    return target.relative_to(Path(os.path.realpath(WORKSPACE))).as_posix()


def _copy(source: str, to: str) -> dict:
    """Copy a workspace file to a new file under OCADE output; the source is not touched."""
    origin = resolve(WORKSPACE, source)
    if not origin.is_file():
        raise Refused("not_a_file")
    target = output_path(WORKSPACE, to)
    digest = write_atomically(target, lambda temporary: shutil.copyfile(origin, temporary))
    return {"sha256": digest, "matches": digest == sha256(origin)}


def _move(source: str, to: str) -> dict:
    """Move or rename a workspace file or folder inside the workspace. Nothing is ever
    replaced, so the move can be undone by moving it back."""
    origin = _organisable(source)
    if not origin.exists():
        raise Refused("not_found")
    target = _organisable(to)
    if target.exists():
        raise Refused("destination_exists")
    if os.path.commonpath([origin, target]) == str(origin):
        raise Refused("into_itself")
    if not target.parent.is_dir():
        raise Refused("destination_folder_missing")
    digest = sha256(origin) if origin.is_file() else None
    try:
        if os.name == "posix" and origin.is_file() and not origin.is_symlink():
            os.link(origin, target)  # create-if-absent: a file that appeared meanwhile is never replaced
            mark_effect()
            os.unlink(origin)
        else:
            os.rename(origin, target)  # Windows never replaces; a POSIX folder only replaces an empty one
            mark_effect()
    except FileExistsError:
        raise Refused("destination_exists") from None
    except OSError as error:
        raise Refused("cross_device" if error.errno == 18 else "file_in_use") from None
    moved = {"from": _relative(origin), "to": _relative(target)}
    if digest is not None:
        moved["sha256"] = digest
        moved["matches"] = sha256(target) == digest
    return moved


def _mkdir(path: str) -> dict:
    """Create a folder (and any missing parents) in the workspace."""
    target = resolve(WORKSPACE, path)
    if target.exists() and not target.is_dir():
        raise Refused("not_a_folder")
    existed = target.is_dir()
    target.mkdir(parents=True, exist_ok=True)
    if not existed:
        mark_effect()
    return {"path": _relative(target), "created": not existed}


def _trash(path: str) -> dict:
    """Move a workspace file or folder to the computer's Recycle Bin or Trash, where the
    person can restore it. Nothing is deleted outright."""
    from send2trash import send2trash

    target = _organisable(path)
    if not target.exists():
        raise Refused("not_found")
    digest = sha256(target) if target.is_file() else None
    mark_effect()
    try:
        send2trash(str(target))
    except OSError:
        raise Refused("trash_unavailable") from None  # nothing is deleted when the Trash refuses
    if target.exists():
        raise Refused("trash_unavailable")
    return {"trashed": _relative(target), **({"sha256": digest} if digest else {})}


def _set_attributes(path: str, executable: bool | None = None, readOnly: bool | None = None) -> dict:
    """Mark a workspace file executable (macOS, Linux) or read-only, or clear either; the
    previous mode is returned so the change can be undone."""
    import stat

    target = _organisable(path)
    if not target.is_file():
        raise Refused("not_a_file")
    before = stat.S_IMODE(target.stat().st_mode)
    mode = before
    if executable is not None and os.name == "posix":
        bits = (stat.S_IXUSR | (stat.S_IXGRP if before & stat.S_IRGRP else 0)
                | (stat.S_IXOTH if before & stat.S_IROTH else 0))
        mode = mode | bits if executable else mode & ~(stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    if readOnly is not None:
        writable = stat.S_IWUSR
        mode = mode & ~(stat.S_IWUSR | stat.S_IWGRP | stat.S_IWOTH) if readOnly else mode | writable
    if mode != before:
        os.chmod(target, mode)
        mark_effect()
    after = stat.S_IMODE(target.stat().st_mode)
    return {"modeBefore": oct(before), "mode": oct(after), "readOnly": not after & stat.S_IWUSR,
            "executable": bool(after & stat.S_IXUSR) if os.name == "posix" else None}


@app.tool()
@_evidence
def fs_manage(action: str, path: str, to: str | None = None, executable: bool | None = None,
              readOnly: bool | None = None) -> dict:
    """Organise workspace files: copy, move/rename, mkdir, trash or set_attributes."""
    if action in ("copy", "move") and not to:
        raise Refused("destination_required")
    if action == "copy":
        return _copy(path, to)
    if action == "move":
        return _move(path, to)
    if action == "mkdir":
        return _mkdir(path)
    if action == "trash":
        return _trash(path)
    if action == "set_attributes":
        return _set_attributes(path, executable, readOnly)
    raise Refused("unknown_action")


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


def _run(argv: list[str], limit: int = 12_000) -> str:
    """A read-only system tool's output, bounded; never a shell, never input."""
    import subprocess

    try:
        done = subprocess.run(argv, capture_output=True, timeout=20, stdin=subprocess.DEVNULL,
                              creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    except (OSError, subprocess.TimeoutExpired):
        raise Refused("diagnostic_unavailable") from None
    return done.stdout.decode("utf-8", errors="replace")[:limit]


@app.tool()
@_evidence
def system_diagnose(topic: str, filter: str | None = None) -> dict:
    """Read-only facts for diagnosing a problem: running processes, services, recent crash and
    error events, environment variable NAMES and PATH entries (never values), or which program
    opens a file type. Nothing is changed and no secret value is returned."""
    import sys

    wanted = (filter or "").lower()
    keep = lambda line: not wanted or wanted in line.lower()  # noqa: E731
    if topic == "processes":
        argv = ["tasklist", "/fo", "csv", "/nh"] if os.name == "nt" else ["ps", "-A", "-o", "pid=,rss=,comm="]
        lines = [line for line in _run(argv, 200_000).splitlines() if line.strip() and keep(line)]
        return {"topic": topic, "count": len(lines), "lines": lines[:150]}
    if topic == "services":
        if os.name == "nt":
            argv = ["sc", "query", "type=", "service", "state=", "all"]
        elif sys.platform == "darwin":
            argv = ["launchctl", "list"]
        elif shutil.which("systemctl"):
            argv = ["systemctl", "list-units", "--type=service", "--all", "--no-pager", "--plain", "--no-legend"]
        else:
            raise Refused("diagnostic_unavailable")
        text = _run(argv, 400_000)
        if os.name == "nt":  # one line per service: name, state
            names = [line.split(":", 1)[1].strip() for line in text.splitlines() if line.strip().startswith("SERVICE_NAME")]
            states = [line.split(":", 1)[1].split()[-1] for line in text.splitlines() if line.strip().startswith("STATE")]
            text = "\n".join(f"{name} {state}" for name, state in zip(names, states))
        lines = [line for line in text.splitlines() if line.strip() and keep(line)]
        return {"topic": topic, "count": len(lines), "lines": lines[:200]}
    if topic == "crashes":
        if os.name == "nt":
            text = _run(["wevtutil", "qe", "Application", "/q:*[System[(Level=1 or Level=2)]]", "/c:25", "/rd:true",
                         "/f:text"])
        elif sys.platform == "darwin":
            reports = [Path.home() / "Library/Logs/DiagnosticReports", Path("/Library/Logs/DiagnosticReports")]
            found = sorted((p for folder in reports if folder.is_dir() for p in folder.iterdir()),
                           key=lambda p: p.stat().st_mtime, reverse=True)[:40]
            text = "\n".join(f"{time.strftime('%Y-%m-%d %H:%M', time.localtime(p.stat().st_mtime))} {p.name}"
                             for p in found)
        elif shutil.which("journalctl"):
            text = _run(["journalctl", "-p", "err", "-n", "40", "--no-pager", "-q"])
        else:
            raise Refused("diagnostic_unavailable")
        lines = [line for line in text.splitlines() if line.strip() and keep(line)]
        return {"topic": topic, "lines": lines[:120]}
    if topic == "environment":
        path = [entry for entry in os.environ.get("PATH", "").split(os.pathsep) if entry]
        return {"topic": topic, "names": sorted(name for name in os.environ if keep(name))[:200], "path": path[:80]}
    if topic == "associations":
        if os.name != "nt" or not wanted.startswith("."):
            raise Refused("diagnostic_unavailable")  # Windows, for one extension like ".pdf"
        kind = _run(["cmd", "/d", "/c", "assoc", wanted]).strip()
        program = _run(["cmd", "/d", "/c", "ftype", kind.split("=", 1)[1]]).strip() if "=" in kind else ""
        return {"topic": topic, "extension": wanted, "type": kind, "opensWith": program}
    raise Refused("unknown_topic")


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
    if docx_path == pdf_path:
        raise Refused("output_path_conflict")

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
