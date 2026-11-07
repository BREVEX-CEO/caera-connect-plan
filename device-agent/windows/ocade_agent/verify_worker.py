"""The independent verifier (plan.md §12, §27.2, P16) as its own MCP stdio worker.

Runs in a separate process from the actor and shares none of its reading or
writing code, on purpose: a bug in how the actor reads a sheet must not also
convince the verifier. It re-reads the SAVED files, pages and windows and reports
one boolean (or None when unobservable) per typed check.
It never writes anything and never declares a task done; the server settles.
"""

from __future__ import annotations

import functools
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import sys
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import anyio
import openpyxl
import pypdfium2
from docx import Document
from mcp.server.mcpserver import MCPServer
from pypdf import PdfReader

from .jobs import shell_argv
from .sandbox import MEDIA_INPUT_OPTIONS, OUTPUT_DIR, PASSIVE_IMAGE_FORMATS, Refused, guarded, plain_text, resolve

app = MCPServer("ocade-verifier")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
TOLERANCE = 0.005


def _digest(path: Path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def _pdf_renders(path: Path) -> bool:
    """Every page renders and none is blank."""
    try:
        document = pypdfium2.PdfDocument(str(path))
        for index in range(len(document)):
            bitmap = document[index].render(scale=0.5).to_pil().convert("L")
            dark = sum(bitmap.histogram()[:200])
            if dark < 50:  # a blank page: nothing but near-white pixels
                return False
        return len(document) > 0
    except Exception:
        return False


def _text(path: Path) -> str | None:
    """Independent text read of a saved file; None when the type cannot be read."""
    suffix = path.suffix.lower()
    try:
        if suffix == ".docx":
            document = Document(io.BytesIO(path.read_bytes()))
            cells = [c.text for t in document.tables for r in t.rows for c in r.cells]
            return "\n".join([p.text for p in document.paragraphs] + cells)
        if suffix == ".xlsx":
            book = openpyxl.load_workbook(path, data_only=True)
            return "\n".join(str(v) for ws in book.worksheets for r in ws.iter_rows(values_only=True) for v in r if v is not None)
        if suffix == ".pdf":
            return "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
        if suffix == ".pptx":
            from pptx import Presentation

            texts = []
            for slide in Presentation(io.BytesIO(path.read_bytes())).slides:
                for shape in slide.shapes:
                    if shape.has_text_frame:
                        texts.append(shape.text_frame.text)
                    if getattr(shape, "has_table", False) and shape.has_table:
                        texts += [cell.text for row in shape.table.rows for cell in row.cells]
                if slide.has_notes_slide:
                    texts.append(slide.notes_slide.notes_text_frame.text)
            return "\n".join(texts)
        return plain_text(path)
    except Exception:
        return None


def _check(kind: str, params: dict, notes: dict) -> bool | None:
    """One typed predicate, read from the real file, page or window. None means unobservable."""
    if kind == "file_parses":
        try:
            path = resolve(WORKSPACE, params["path"])
        except (Refused, KeyError):
            return False
        return _parses(path, notes) if path.is_file() else False
    if kind in ("file_exists", "file_contains", "workbook_cell_equals"):
        try:
            path = resolve(WORKSPACE, params["path"])
        except (Refused, KeyError):
            return False
        if kind == "file_exists" and path.is_dir():
            return any(path.iterdir())  # a folder counts when something is in it
        if not path.is_file():
            return False
        if kind == "file_exists":
            return path.stat().st_size > 0
        if kind == "workbook_cell_equals" and path.suffix.lower() not in WORKBOOKS:
            return _invalid(notes, "workbook_cell_equals reads .xlsx or .xlsm workbooks")
        if kind == "file_contains":
            text = _text(path)
            if text is None:
                return None
            # Words, not typography: letter case and runs of spaces/newlines do not decide a check.
            wanted, found = (" ".join(t.split()).casefold() for t in (params.get("text", "\0"), text))
            # A PDF must also render with no blank page, not merely carry the words.
            return bool(wanted) and wanted in found and (path.suffix.lower() != ".pdf" or _pdf_renders(path))
        grid = _workbook_grid(path, params["sheet"], f"{params['cell']}:{params['cell']}", notes)
        if not isinstance(grid, list):
            return grid
        return _same(params.get("value"), grid[0][0])
    if kind in ("script_runnable", "workbook_formula", "document_headings", "changes_within",
                "workbook_range_equals", "image_changed_within"):
        try:
            path = resolve(WORKSPACE, params["path"])
        except (Refused, KeyError):
            return False
        if not path.is_file():
            return False
        if kind in ("workbook_formula", "workbook_range_equals") and path.suffix.lower() not in WORKBOOKS:
            return _invalid(notes, f"{kind} reads .xlsx or .xlsm workbooks")
        if kind == "document_headings" and path.suffix.lower() not in (".docx", ".pptx"):
            return _invalid(notes, "document_headings reads Word .docx documents or PowerPoint .pptx decks")
        if kind == "workbook_range_equals":
            grid = _workbook_grid(path, params.get("sheet"), params.get("range"), notes)
            if not isinstance(grid, list):
                return grid
            expected = params.get("values")
            if (not isinstance(expected, list) or len(expected) != len(grid)
                    or any(not isinstance(row, list) or len(row) != len(found) for row, found in zip(expected, grid))):
                return _invalid(notes, "the expected values do not have the shape of the range")
            wrong = [f"row {r + 1} column {c + 1}" for r, row in enumerate(grid) for c, value in enumerate(row)
                     if not _same(expected[r][c], value)]
            notes["mismatched"] = wrong[:5]
            return not wrong
        if kind == "image_changed_within":
            return _image_changed_within(path, params, notes)
        if kind == "changes_within":
            return _changes_within(path, params, notes)
        if kind == "script_runnable":
            return _script_runnable(path, notes)
        if kind == "workbook_formula":
            return _workbook_formula(path, params, notes)
        return _document_headings(path, params)
    if kind == "media_duration":
        try:
            path = resolve(WORKSPACE, params["path"])
        except (Refused, KeyError):
            return False
        probe = shutil.which("ffprobe")
        if not probe:
            return None
        run = subprocess.run([probe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", *MEDIA_INPUT_OPTIONS, str(path)],
                             capture_output=True, text=True, timeout=60)
        if run.returncode != 0:
            return None
        try:
            return abs(float(run.stdout.strip()) - float(params["value"])) <= 0.25
        except ValueError:
            return False
    if kind in ("image_size", "scene_render", "media_quality"):
        try:
            path = resolve(WORKSPACE, params["path"])
        except (Refused, KeyError):
            return False
        if not path.is_file():
            return False
        if kind == "media_quality":
            return _media_quality(path, params, notes)
        from PIL import Image

        try:
            with Image.open(path, formats=PASSIVE_IMAGE_FORMATS) as image:
                size, text = image.size, dict(getattr(image, "text", {}) or {})
                if kind == "scene_render" and not any(low != high for low, high in image.convert("RGB").getextrema()):
                    notes["error"] = "saved scene render is a uniform image"
                    return False
        except Exception:
            return False
        if kind == "image_size":
            return size == (params.get("width"), params.get("height"))
        return _scene_bound(size, text)
    if kind == "command_succeeds":
        return _command_succeeds(params.get("command"), params.get("text"), notes)
    if kind == "local_service_answers":
        return _local_service(params.get("port"), params.get("text"), notes)
    if kind == "window_exists":
        if sys.platform != "win32":
            return None
        return _window_exists(params.get("exe", ""), params.get("text"))
    return None


def _parses(path: Path, notes: dict) -> bool | None:
    """Well-formed for its format, by the standard library's own parsers; nothing is executed."""
    import configparser
    import csv
    import tomllib
    import xml.etree.ElementTree as ElementTree

    suffix = path.suffix.lower()
    if suffix == ".gltf":
        return _gltf_mesh(path, notes)
    if suffix in (".zip", ".docx", ".xlsx", ".pptx"):
        valid = _zip_integrity(path, notes)
        if valid is not True or suffix == ".zip":
            return valid
        return _office_parses(path, notes)
    if path.stat().st_size > 2_000_000:
        notes["error"] = "file exceeds the verification byte budget"
        return None
    text = plain_text(path)
    if text is None:
        return None
    parsers = {
        ".json": json.loads,
        ".py": lambda t: compile(t, path.name, "exec", dont_inherit=True),  # compiled, never run
        ".xml": ElementTree.fromstring,
        ".toml": tomllib.loads,
        ".ini": lambda t: configparser.ConfigParser().read_string(t),
        ".cfg": lambda t: configparser.ConfigParser().read_string(t),
        ".csv": lambda t: [len(row) for row in csv.reader(t.splitlines())],
    }
    if suffix in (".sh", ".bash"):
        return _shell_parses(path, notes)
    if suffix not in parsers:
        return None
    try:
        rows = parsers[suffix](text)
    except Exception as error:  # the reason is evidence for the repair
        notes["error"] = f"{type(error).__name__}: {str(error)[:200]}"
        return False
    if suffix == ".csv" and len({n for n in rows if n}) > 1:
        notes["error"] = "rows have different numbers of fields"
        return False
    return True


def _gltf_mesh(path: Path, notes: dict) -> bool | None:
    """Validate actual standalone triangle data rather than accepting its JSON header."""
    import base64
    import binascii
    import math
    import struct

    if path.stat().st_size > 20_000_000:
        notes["error"] = "mesh exceeds the verification byte budget"
        return None
    try:
        document = json.loads(path.read_bytes())
        if document["asset"]["version"] != "2.0":
            return False
        buffers = document["buffers"]
        uri = buffers[0]["uri"]
        prefix = "data:application/octet-stream;base64,"
        if len(buffers) != 1 or not uri.startswith(prefix):
            notes["error"] = "only a standalone embedded glTF mesh can be checked"
            return None
        data = base64.b64decode(uri[len(prefix):], validate=True)
        if buffers[0]["byteLength"] != len(data):
            return False

        def lookup(sequence, index):
            if type(index) is not int or not 0 <= index < len(sequence):
                raise ValueError("invalid glTF index")
            return sequence[index]

        def vertices(index, bounds=False):
            accessor = lookup(document["accessors"], index)
            view = lookup(document["bufferViews"], accessor["bufferView"])
            count = accessor["count"]
            if (accessor["componentType"] != 5126 or accessor["type"] != "VEC3" or
                    type(count) is not int or count < 3 or count > 480_000 or view["buffer"] != 0 or
                    "sparse" in accessor or view.get("byteStride", 12) != 12):
                raise ValueError("unsupported glTF vertex data")
            base = view.get("byteOffset", 0)
            relative = accessor.get("byteOffset", 0)
            offset = base + relative
            length = count * 12
            if min(base, relative) < 0 or offset % 4 or relative + length > view["byteLength"] or offset + length > len(data):
                raise ValueError("glTF vertex buffer is truncated")
            points = list(struct.iter_unpack("<3f", memoryview(data)[offset:offset + length]))
            if any(not math.isfinite(value) for point in points for value in point):
                raise ValueError("glTF vertex is non-finite")
            if bounds and (accessor.get("min") != [min(point[i] for point in points) for i in range(3)] or
                           accessor.get("max") != [max(point[i] for point in points) for i in range(3)]):
                raise ValueError("glTF vertex bounds do not match the bytes")
            return points

        selected = lookup(document["scenes"], document.get("scene", 0))
        triangles = 0
        for node in selected["nodes"]:
            mesh = lookup(document["meshes"], lookup(document["nodes"], node)["mesh"])
            for primitive in mesh["primitives"]:
                if primitive.get("mode", 4) != 4 or "indices" in primitive:
                    notes["error"] = "only standalone non-indexed triangle meshes can be checked"
                    return None
                if "material" in primitive:
                    lookup(document["materials"], primitive["material"])
                positions = vertices(primitive["attributes"]["POSITION"], bounds=True)
                normals = vertices(primitive["attributes"]["NORMAL"])
                if len(positions) != len(normals) or len(positions) % 3:
                    return False
                if any(abs(math.hypot(*normal) - 1) > 0.001 for normal in normals):
                    return False
                for idx in range(0, len(positions), 3):
                    a, b, c = positions[idx:idx + 3]
                    u = [y - x for x, y in zip(a, b)]
                    v = [y - x for x, y in zip(a, c)]
                    area = math.hypot(u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
                    if not area:
                        return False
                triangles += len(positions) // 3
                if triangles > 160_000:
                    return None
        notes["triangles"] = triangles
        return triangles > 0
    except (OSError, ValueError, TypeError, KeyError, IndexError, binascii.Error, struct.error) as error:
        notes["error"] = f"Invalid glTF mesh: {type(error).__name__}"
        return False


def _zip_integrity(path: Path, notes: dict) -> bool | None:
    """Read bounded ZIP entries and check CRCs; never extract or execute them."""
    import zipfile

    try:
        if path.stat().st_size > 50_000_000:
            notes["error"] = "archive exceeds the verification byte budget"
            return None
        with zipfile.ZipFile(path) as archive:
            parts = archive.infolist()
            size = sum(part.file_size for part in parts)
            if len(parts) > 10_000 or size > 50_000_000:
                notes["error"] = "archive exceeds the verification part or expanded-byte budget"
                return None
            if any(part.flag_bits & 1 for part in parts):
                notes["error"] = "encrypted archive requires the person's password"
                return None
            if archive.testzip() is not None:
                notes["error"] = "archive has a damaged entry"
                return False
            notes.update(packageParts=len(parts), expandedBytes=size)
        return True
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile) as error:
        notes["error"] = f"{type(error).__name__}: {str(error)[:200]}"
        return False


def _office_parses(path: Path, notes: dict) -> bool | None:
    """Reopen saved Office packages with independent readers after bounded CRC checks."""
    try:
        if path.suffix.lower() == ".xlsx":
            book = openpyxl.load_workbook(path, read_only=True, data_only=False, keep_links=False)
            try:
                cells = 0
                for sheet in book.worksheets:
                    if (sheet.max_column or 0) > 16_384 or (sheet.max_row or 0) > 1_048_576:
                        notes["error"] = "workbook dimensions exceed the file format bounds"
                        return False
                    for row in sheet.iter_rows(values_only=True):
                        cells += len(row)
                        if cells > 1_000_000:
                            notes["error"] = "workbook exceeds the verification cell budget"
                            return None
                notes.update(sheets=len(book.worksheets), cellsRead=cells)
                return bool(book.worksheets)
            finally:
                book.close()
        if path.suffix.lower() == ".docx":
            document = Document(io.BytesIO(path.read_bytes()))
            notes.update(paragraphs=len(document.paragraphs), tables=len(document.tables))
        else:
            from pptx import Presentation

            presentation = Presentation(io.BytesIO(path.read_bytes()))
            notes.update(slides=len(presentation.slides),
                         shapes=sum(len(slide.shapes) for slide in presentation.slides))
        return True
    except Exception as error:
        notes["error"] = f"{type(error).__name__}: {str(error)[:200]}"
        return False


def _shell_parses(path: Path, notes: dict, shell: str | None = None) -> bool | None:
    """`sh -n`: the shell reads the script without running any of it."""
    shell = shell or shutil.which("sh")
    if not shell or sys.platform == "win32":
        return None
    run = subprocess.run([shell, "-n", str(path)], capture_output=True, text=True, timeout=30,
                         stdin=subprocess.DEVNULL)
    if run.returncode != 0:
        notes["error"] = run.stderr.strip()[:200]
    return run.returncode == 0


def _script_runnable(path: Path, notes: dict) -> bool | None:
    """A script can be started directly: on macOS/Linux a #! line, Unix line endings, the
    executable bit and a script its interpreter accepts. Read only: nothing is run.
    Never execute a file-supplied interpreter to establish syntax."""
    import shlex

    if sys.platform == "win32":
        return None  # Windows starts scripts by file type, not by these properties
    with path.open("rb") as stream:
        data = stream.read(2_000_001)
    if len(data) > 2_000_000:
        notes["error"] = "script exceeds the verification byte budget"
        return None
    problems = []
    if not data.startswith(b"#!"):
        problems.append("no #! line")
    if b"\r\n" in data:
        problems.append("Windows line endings")
    if not os.access(path, os.X_OK):
        problems.append("not executable")
    line = data.split(b"\n", 1)[0].decode("utf-8", "replace")
    if any(ord(character) < 32 and character != "\t" for character in line):
        problems.append("invalid control character in #! line")
    program, arguments = None, []
    if not problems:
        words = line[2:].strip().split(None, 1)
        executable = Path(words[0]) if words else None
        if executable is None or not executable.is_absolute() or not executable.is_file() or not os.access(executable, os.X_OK):
            problems.append("interpreter is not an executable absolute path")
        elif executable.name == "env":
            argument = words[1] if len(words) == 2 else ""
            try:
                # The kernel passes one optional argument. Only env -S splits it.
                arguments = shlex.split(argument[3:]) if argument.startswith("-S ") else [argument]
            except ValueError:
                arguments = []
            program = shutil.which(arguments[0]) if arguments and arguments[0] else None
            arguments = arguments[1:]
            if program is None:
                problems.append("env interpreter cannot be resolved")
        else:
            program = str(executable)
            arguments = words[1:]  # a direct shebang's optional argument is one word
    name = Path(program).name if program else ""
    if not problems and re.fullmatch(r"(?:python|pypy)(?:3(?:\.[0-9]+)*)?", name):
        if any(argument not in ("-u", "-B", "-E", "-I", "-s", "-S", "-O", "-OO") for argument in arguments):
            notes["error"] = "interpreter launch flags cannot be verified without running"
            return None
        try:
            compile(data, path.name, "exec", dont_inherit=True)  # compiled, never run
        except (SyntaxError, ValueError) as error:
            problems.append(f"does not compile ({type(error).__name__})")
    elif not problems and name in ("sh", "bash"):
        installed = shutil.which(name)
        # Never invoke an arbitrary executable named by customer-controlled bytes.
        if arguments or not installed or not os.path.samefile(program, installed):
            notes["error"] = "interpreter syntax is not independently observable"
            return None
        parsed = _shell_parses(path, notes, installed)
        if parsed is None:
            return None
        if parsed is False:
            problems.append("shell syntax error")
    elif not problems:
        notes["error"] = "interpreter syntax is not independently observable"
        return None
    if problems:
        notes["error"] = ", ".join(problems)
    return not problems


WORKBOOKS = (".xlsx", ".xlsm")
RANGE_CELLS = 400


def _invalid(notes: dict, reason: str) -> str:
    """The check itself cannot apply to this file: a wrong condition, not defective work (69)."""
    notes["invalid"] = reason
    return "invalid"


def _same(expected, value) -> bool:
    """Excel booleans are not numbers, and text/number coercion can turn an incorrect result
    into a passing acceptance predicate; null expects an empty cell."""
    if expected is None:
        return value is None or value == ""
    if type(expected) in (int, float):
        return type(value) in (int, float) and abs(value - expected) < TOLERANCE
    return isinstance(expected, str) and isinstance(value, str) and value == expected


def _grid(source: Path, sheet: str, area: str, data_only: bool) -> list[list]:
    from openpyxl.utils.cell import range_boundaries

    low_column, low_row, high_column, high_row = range_boundaries(area)
    book = openpyxl.load_workbook(source, data_only=data_only, read_only=True, keep_links=False)
    try:
        rows = book[sheet].iter_rows(min_row=low_row, max_row=high_row, min_col=low_column,
                                     max_col=high_column, values_only=True)
        width = high_column - low_column + 1
        grid = [list(row) + [None] * (width - len(row)) for row in rows]
        return grid + [[None] * width for _ in range(high_row - low_row + 1 - len(grid))]
    finally:
        book.close()


def _workbook_grid(path: Path, sheet, area, notes: dict) -> list[list] | bool | str | None:
    """The values of a range as a person sees them. Typed values are read as written; when any
    cell holds a formula, a real spreadsheet engine recalculates a private copy and its results
    are read. The saved result of a formula is never trusted: it can be stale or forged.
    Without an engine a formula's value is unobservable (None)."""
    from openpyxl.utils.cell import range_boundaries

    try:
        low_column, low_row, high_column, high_row = range_boundaries(str(area))
    except (TypeError, ValueError):
        return _invalid(notes, "not an A1 range")
    if (high_column - low_column + 1) * (high_row - low_row + 1) > RANGE_CELLS:
        return _invalid(notes, f"a range of at most {RANGE_CELLS} cells")
    try:
        written = _grid(path, sheet, area, False)
    except KeyError:
        notes["error"] = f"the workbook has no sheet named {sheet}"
        return False
    except Exception:
        notes["error"] = "the workbook could not be read"
        return False
    if not any(isinstance(value, str) and value.startswith("=") for row in written for value in row):
        return written
    from .engine import office_available, recalculate

    if not office_available():
        notes["error"] = "no spreadsheet engine on this computer to recalculate the formula"
        return None
    with tempfile.TemporaryDirectory(prefix="ocade-verify-calc-") as folder:
        copy = Path(folder) / ("recalculated" + path.suffix.lower())
        shutil.copyfile(path, copy)
        try:
            notes["engine"] = recalculate(copy)
            grid = _grid(copy, sheet, area, True)
        except Exception:
            notes["error"] = "the spreadsheet engine could not recalculate a copy"
            return None
    notes["recalculated"] = [[value if isinstance(value, (int, float, str)) else None for value in row]
                             for row in grid][:5]
    return grid


def _workbook_formula(path: Path, params: dict, notes: dict) -> bool | str | None:
    """The cell holds a formula (the workbook stays editable), and a real spreadsheet engine,
    recalculating a private copy, gets the expected value."""
    try:
        formula = _grid(path, params["sheet"], f"{params['cell']}:{params['cell']}", False)[0][0]
    except Exception:
        return False
    if not (isinstance(formula, str) and formula.startswith("=")):
        notes["error"] = "a typed-in value, not a formula"
        return False
    expected = params.get("value")
    if expected is None:
        return True
    grid = _workbook_grid(path, params["sheet"], f"{params['cell']}:{params['cell']}", notes)
    if not isinstance(grid, list):
        return grid
    notes["recalculated"] = notes.get("recalculated", [[None]])[0][0]
    return _same(expected, grid[0][0])


VIDEO_SUFFIXES = (".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi")


def _picture(path: Path, moment):
    """An image file, or the decoded frame of a video at `moment` seconds (74), as RGB."""
    from PIL import Image

    if path.suffix.lower() not in VIDEO_SUFFIXES:
        with Image.open(path, formats=PASSIVE_IMAGE_FORMATS) as image:
            return image.convert("RGB")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise LookupError("no FFmpeg on this computer to read a video frame")
    run = subprocess.run([ffmpeg, "-v", "error", *MEDIA_INPUT_OPTIONS, "-ss", str(float(moment or 0)), "-i", str(path),
                          "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
                         capture_output=True, timeout=120, stdin=subprocess.DEVNULL)
    if run.returncode != 0 or not run.stdout:
        raise ValueError("no frame at that time")
    with Image.open(io.BytesIO(run.stdout), formats=("PNG",)) as frame:
        return frame.convert("RGB")


VISIBLE = 24  # per-pixel brightness difference (of 255) a person notices
STRAY_ALLOWED = 0.002  # share of pixels outside the region that may differ (re-encoding noise)


def _image_changed_within(path: Path, params: dict, notes: dict) -> bool | str | None:
    """The edited image visibly differs from its source inside the region (the whole image when
    none is given) and is unchanged outside it, measured on decoded pixels, not file bytes. For a
    video, the frame at `time` seconds is compared (an overlay, title or colour edit, 74)."""
    from PIL import ImageChops

    try:
        source = resolve(WORKSPACE, params["source"])
    except (Refused, KeyError):
        return False
    if not source.is_file():
        notes["error"] = "the source image is missing"
        return False
    moment = params.get("time")
    try:
        after, before = _picture(path, moment), _picture(source, moment)
    except LookupError as missing:
        notes["error"] = str(missing)
        return None
    except Exception:
        notes["error"] = "an image could not be decoded"
        return False
    if after.size != before.size:
        notes["error"] = f"size changed from {before.size[0]}x{before.size[1]} to {after.size[0]}x{after.size[1]}"
        return False
    width, height = after.size
    region = params.get("region") or {"x": 0, "y": 0, "width": width, "height": height}
    box = (region["x"], region["y"], min(width, region["x"] + region["width"]),
           min(height, region["y"] + region["height"]))
    if box[0] >= width or box[1] >= height:
        return _invalid(notes, "the region lies outside the image")
    changed = ImageChops.difference(after, before).convert("L").point(lambda level: 255 if level > VISIBLE else 0)
    inside = changed.crop(box).histogram()[255]
    total = changed.histogram()[255]
    outside_pixels = width * height - (box[2] - box[0]) * (box[3] - box[1])
    notes["changedInside"] = inside
    notes["changedOutside"] = total - inside
    if inside == 0:
        notes["error"] = "no visible change where it was asked for"
        return False
    return outside_pixels == 0 or (total - inside) <= STRAY_ALLOWED * outside_pixels


CHANGE_FILE_LIMIT = 20_000_000  # bytes per side compared by changes_within


def _units(path: Path) -> tuple[str, list[str] | dict[str, str]]:
    """What a person would call the parts of a file: Word paragraphs and table cells, slide
    texts, workbook cells (formulas as written) or text lines."""
    suffix = path.suffix.lower()
    if suffix == ".docx":
        document = Document(io.BytesIO(path.read_bytes()))
        parts = [_formatted(p) for p in document.paragraphs]
        parts += [" | ".join(_formatted(p) for p in cell.paragraphs)
                  for table in document.tables for row in table.rows for cell in row.cells]
        return "paragraph", parts
    if suffix == ".pptx":
        from pptx import Presentation

        deck = Presentation(io.BytesIO(path.read_bytes()))
        return "slide text", [" | ".join(_formatted(p) for p in shape.text_frame.paragraphs)
                              for slide in deck.slides for shape in slide.shapes if shape.has_text_frame]
    if suffix in (".xlsx", ".xlsm"):
        book = openpyxl.load_workbook(io.BytesIO(path.read_bytes()), read_only=True, keep_links=False)
        try:
            return "cell", {f"{sheet.title}!{cell.coordinate}":
                            f"{cell.value!r} {cell.number_format} b={cell.font.b} i={cell.font.i}"
                            for sheet in book.worksheets for row in sheet.iter_rows() for cell in row
                            if cell.value is not None}
        finally:
            book.close()
    return "line", path.read_bytes().decode("utf-8").splitlines()


def _formatted(paragraph) -> str:
    """A paragraph's text with its style and character formatting, so a changed font, size,
    weight or style counts as a change. Adjacent runs that look the same are merged, because
    an editor may split runs without changing anything a person can see."""
    def look(run) -> tuple:
        font = run.font
        size = font.size.pt if font.size is not None else None
        return (font.bold, font.italic, font.underline, size, font.name)

    merged: list[list] = []
    for run in paragraph.runs:
        if merged and merged[-1][0] == look(run):
            merged[-1][1] += run.text
        else:
            merged.append([look(run), run.text])
    style = getattr(getattr(paragraph, "style", None), "name", None) or ""
    level = getattr(paragraph, "level", 0)
    body = "".join(f"<{','.join(map(str, look_))}>{text}" for look_, text in merged if text)
    return f"[{style}{level or ''}] {body}" if merged else f"[{style}{level or ''}] {paragraph.text}"


def _changes_within(path: Path, params: dict, notes: dict) -> bool | str | None:
    """The edited file differs from the newest original OCADE kept of it (`OCADE output/originals`)
    in at most `value` units, so an edit did not damage unrelated content. Without a kept
    original the change scope is unobservable (None)."""
    limit = params.get("value")
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 0:
        return False
    root = Path(os.path.realpath(WORKSPACE))
    relative = path.resolve().relative_to(root)
    folder = root / OUTPUT_DIR / "originals" / relative.parent
    prefix, suffix = relative.name + ".", path.suffix
    kept = sorted(candidate for candidate in (folder.iterdir() if folder.is_dir() else [])
                  if candidate.is_file() and candidate.name.startswith(prefix) and candidate.name.endswith(suffix)
                  and not candidate.is_symlink())
    if not kept:
        notes["error"] = "OCADE kept no original of this file to compare with"
        return None
    original = kept[-1]
    if path.stat().st_size > CHANGE_FILE_LIMIT or original.stat().st_size > CHANGE_FILE_LIMIT:
        notes["error"] = "file too large to compare"
        return None
    try:
        unit, before = _units(original)
        _, after = _units(path)
    except UnicodeDecodeError:
        return _invalid(notes, "changes_within compares Word, PowerPoint, Excel and text files")
    except Exception:
        notes["error"] = "the file or its original could not be read to compare"
        return False
    notes["original"] = original.relative_to(root).as_posix()
    if isinstance(before, dict):
        keys = sorted(set(before) | set(after))
        changed = [key for key in keys if before.get(key) != after.get(key)]
        count, where = len(changed), changed[:5]
    else:
        import difflib

        count, where = 0, []
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=before, b=after, autojunk=False).get_opcodes():
            if tag != "equal":
                count += max(i2 - i1, j2 - j1)
                where += [f"{unit} {j1 + n + 1}" for n in range(min(max(j2 - j1, 1), 5 - len(where)))]
    notes["changed"] = count
    notes["unit"] = unit
    notes["where"] = where[:5]
    return count <= limit


def _document_headings(path: Path, params: dict) -> bool:
    """Each named heading is a real heading: a Title/Heading paragraph of a Word document, or a
    slide title of a PowerPoint deck."""
    try:
        if path.suffix.lower() == ".pptx":
            from pptx import Presentation

            slides = Presentation(io.BytesIO(path.read_bytes())).slides
            titles = [s.shapes.title.text for s in slides if s.shapes.title is not None]
        else:
            document = Document(io.BytesIO(path.read_bytes()))
            titles = [p.text for p in document.paragraphs
                      if p.style is not None and (p.style.name or "").lower().startswith(("heading", "title"))]
    except Exception:
        return False
    found = [" ".join(t.split()).casefold() for t in titles]
    wanted = [" ".join(str(h).split()).casefold() for h in params.get("headings") or []]
    return bool(wanted) and all(any(w in f for f in found) for w in wanted)


COPY_LIMIT = 300_000_000  # bytes of workspace copied for a re-run; larger folders are unobservable


OUTPUT_LIMIT = 1_000_000  # bytes of a re-run's output that are read


@functools.lru_cache(maxsize=None)
def _runs(argv: tuple[str, ...]) -> bool:
    try:
        return subprocess.run(list(argv), stdin=subprocess.DEVNULL, capture_output=True, timeout=10).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def _mac_profile(copy: Path) -> str:
    """No network, and writes only inside this re-run's own scratch folder (the throwaway copy and
    its private temporary folder, which TMPDIR names). The system temporary folders hold other
    programs' files, so they are not writable."""
    def quoted(path: str) -> str:
        return '"' + path.replace("\\", "\\\\").replace('"', '\\"') + '"'

    return ("(version 1)(allow default)(deny network*)"
            "(deny file-write* (require-not (require-any"
            f" (subpath {quoted(os.path.realpath(copy.parent))})"
            " (literal \"/dev/null\") (literal \"/dev/tty\"))))")


def _containment(copy: Path) -> tuple[list[str], str]:
    """The strongest operating-system containment available for a verifier re-run, and its name.
    Each level is probed on this computer before it is used; the level is always reported."""
    if sys.platform.startswith("linux"):
        bwrap = shutil.which("bwrap")
        base = ("--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc", "--unshare-net", "--die-with-parent")
        if bwrap and _runs((bwrap, *base, "true")):
            return [bwrap, *base, "--tmpfs", "/tmp", "--bind", str(copy), str(copy), "--unshare-pid",
                    "--chdir", str(copy), "--"], "filesystem+network"
        unshare = shutil.which("unshare")
        if unshare and _runs((unshare, "-rn", "true")):
            return [unshare, "-rn", "--"], "network"
    sandbox = shutil.which("sandbox-exec") if sys.platform == "darwin" else None
    if sandbox:
        return [sandbox, "-p", _mac_profile(copy)], "filesystem+network"
    return [], "copy-only"


def _command_succeeds(command, text, notes: dict) -> bool | None:
    """Re-run a repaired script or program, as the person confirmed it earlier in the task, in a
    throwaway copy of the workspace: the person's folder is never changed by verifying. The run is
    contained by the strongest isolation this computer offers (named in `containment`: writes
    outside the copy and network refused, network refused, or the copy alone). Passes when it
    exits 0 within two minutes (and prints the text, when given)."""
    import signal

    if not isinstance(command, str) or not command.strip():
        return False
    root = Path(os.path.realpath(WORKSPACE))
    paths = list(root.rglob("*"))
    if any(path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction()) for path in paths):
        notes["error"] = "workspace links need independent review before a re-run"
        return None
    size = sum(p.stat().st_size for p in paths if p.is_file())
    if size > COPY_LIMIT:
        notes["error"] = "workspace too large to copy for a re-run"
        return None
    with tempfile.TemporaryDirectory(prefix="ocade-verify-") as scratch:
        copy = Path(os.path.realpath(scratch)) / "workspace"
        shutil.copytree(root, copy, symlinks=True)
        if any(path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction())
               for path in copy.rglob("*")):
            notes["error"] = "workspace links changed during staging"
            return None
        prefix, notes["containment"] = _containment(copy)
        argv = prefix + shell_argv(command, None)
        environment = None
        if sys.platform == "darwin":  # the macOS sandbox lets it write only beside the copy
            (copy.parent / "tmp").mkdir()
            environment = {**os.environ, "TMPDIR": str(copy.parent / "tmp")}
        with tempfile.TemporaryFile() as captured:
            process = subprocess.Popen(argv, cwd=copy, env=environment, stdin=subprocess.DEVNULL, stdout=captured,
                                       stderr=subprocess.STDOUT, start_new_session=sys.platform != "win32",
                                       creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
            try:
                process.wait(timeout=120)
            except subprocess.TimeoutExpired:
                if sys.platform == "win32":
                    subprocess.run(["taskkill", "/T", "/F", "/PID", str(process.pid)], capture_output=True)
                else:
                    os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                notes["error"] = "did not finish within 120 s"
                return False
            captured.seek(0)
            output = captured.read(OUTPUT_LIMIT + 1)
    if len(output) > OUTPUT_LIMIT:
        notes["outputTruncated"] = True
    printed = output[:OUTPUT_LIMIT].decode("utf-8", "replace")
    notes["exitCode"] = process.returncode
    wanted = " ".join(str(text or "").split()).casefold()
    matches = wanted in " ".join(printed.split()).casefold()
    if wanted:
        notes["expectedOutputObserved"] = matches
    return process.returncode == 0 and matches


def _local_service(port, text, notes: dict) -> bool:
    """A program on this computer answers http://127.0.0.1:port/ with 200 (and the text): one
    GET, loopback only, no proxy, no redirects followed, bounded read."""
    import urllib.error
    import urllib.request

    if not isinstance(port, int) or not 1024 <= port <= 65535:
        return False

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None

    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect)
    try:
        with opener.open(f"http://127.0.0.1:{port}/", timeout=5) as response:
            status, body = response.status, response.read(200_000).decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        status, body = error.code, ""
    except OSError as error:
        notes["error"] = f"nothing answers on port {port} ({type(error).__name__})"
        return False
    notes["status"] = status
    wanted = " ".join(str(text or "").split()).casefold()
    return status == 200 and wanted in " ".join(body.split()).casefold()


def _scene_bound(size: tuple[int, int], text: dict) -> bool:
    """The still names the scene project it was rendered from; that project must exist unchanged,
    be a complete scene (camera, light, material, geometry) and match the still's size."""
    try:
        project = resolve(WORKSPACE, text["ocade:project"])
        if not project.is_file() or _digest(project) != text.get("ocade:project-sha256"):
            return False
        scene = json.loads(project.read_text(encoding="utf-8"))
        lit = scene["lights"] or scene["environment"].get("softboxes")
        shapes = sum(len(part["shapes"]) for part in scene["parts"])
        return bool(scene["camera"] and lit and scene["materials"] and shapes) and size == (
            scene["render"]["width"], scene["render"]["height"])
    except (KeyError, TypeError, ValueError, Refused):
        return False


def _media_quality(path: Path, params: dict, notes: dict) -> bool | None:
    """A deliverable video, measured: exact length, size, H.264 + stereo AAC, loudness and
    true peak in broadcast range, no black or silent stretch inside the programme."""
    probe, ffmpeg = shutil.which("ffprobe"), shutil.which("ffmpeg")
    if not probe or not ffmpeg:
        return None
    run = subprocess.run([probe, "-v", "error", "-show_format", "-show_streams", "-of", "json", *MEDIA_INPUT_OPTIONS, str(path)],
                         capture_output=True, text=True, timeout=60)
    if run.returncode != 0:
        return None
    try:
        facts = json.loads(run.stdout)
        duration = float(facts["format"]["duration"])
    except (ValueError, KeyError):
        return False
    video = next((s for s in facts.get("streams", []) if s.get("codec_type") == "video"), None)
    sound = next((s for s in facts.get("streams", []) if s.get("codec_type") == "audio"), None)
    notes.update(duration=round(duration, 3), video=(video or {}).get("codec_name"), audio=(sound or {}).get("codec_name"),
                 channels=(sound or {}).get("channels"), size=[(video or {}).get("width"), (video or {}).get("height")])
    if not video or not sound or video.get("codec_name") != "h264" or sound.get("codec_name") != "aac":
        return False
    if sound.get("channels") != 2 or abs(duration - float(params.get("value", -1))) > 0.05:
        return False
    if video.get("width", 0) < params.get("width", 0) or video.get("height", 0) < params.get("height", 0):
        return False
    decoded = subprocess.run(
        [ffmpeg, "-hide_banner", "-nostats", "-xerror", *MEDIA_INPUT_OPTIONS, "-i", str(path), "-filter_complex",
         "[0:v]blackdetect=d=1:pix_th=0.06[v];[0:a]ebur128=peak=true,silencedetect=n=-50dB:d=1.5[a]",
         "-map", "[v]", "-map", "[a]", "-f", "null", "-"],
        capture_output=True, text=True, timeout=1800,
    )
    if decoded.returncode != 0:
        notes["error"] = "the saved video did not decode to its end"
        return False
    log = decoded.stderr
    integrated = re.findall(r"I:\s+(-?[0-9.]+) LUFS", log)
    peak = re.findall(r"Peak:\s+(-?[0-9.]+) dBFS", log)
    black = [(float(a), float(b)) for a, b in re.findall(r"black_start:([0-9.]+) black_end:([0-9.]+)", log)]
    silent = [float(a) for a in re.findall(r"silence_start: (-?[0-9.]+)", log)]
    ends = [float(a) for a in re.findall(r"silence_end: (-?[0-9.]+)", log)]
    inside = lambda t: 1.0 < t < duration - 2.0  # noqa: E731 — the opening and the closing fade are allowed
    notes.update(loudnessLufs=float(integrated[-1]) if integrated else None, peakDbfs=float(peak[-1]) if peak else None,
                 blackInside=[s for s in black if inside(s[0]) or inside(s[1])][:5],
                 silentInside=[[round(t, 2), round(ends[i], 2) if i < len(ends) else None]
                               for i, t in enumerate(silent) if inside(t)][:5])
    return (
        bool(integrated) and -20.0 <= float(integrated[-1]) <= -9.0
        and bool(peak) and float(peak[-1]) <= -0.5
        and not any(inside(start) or inside(end) for start, end in black)
        and not any(inside(start) for start in silent)
    )


def _window_exists(exe: str, title_part: str | None) -> bool:
    """Independent EnumWindows read, not the actor's discovery code."""
    import ctypes
    from ctypes import wintypes

    user32, kernel32 = ctypes.windll.user32, ctypes.windll.kernel32
    found = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def visit(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        title = ctypes.create_unicode_buffer(512)
        user32.GetWindowTextW(hwnd, title, 512)
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        handle = kernel32.OpenProcess(0x1000, False, pid.value)
        image, size = ctypes.create_unicode_buffer(1024), wintypes.DWORD(1024)
        ok = handle and kernel32.QueryFullProcessImageNameW(handle, 0, image, ctypes.byref(size))
        if handle:
            kernel32.CloseHandle(handle)
        if ok and Path(image.value).name.lower() == exe and (not title_part or title_part in title.value):
            found.append(hwnd)
        return True

    user32.EnumWindows(visit, 0)
    return bool(found)


# --- Anonymous rendered web pages -------------------------------------------------------
# One fresh, script-free observation per URL: only GET requests to the page's own origin for
# the document, styles, images and fonts; every redirect hop is checked before it is requested.
WEB_LIMITS = {"response_bytes": 2_000_000, "decoded_bytes": 4_000_000, "request_count": 40}
WEB_RESOURCES = ("document", "stylesheet", "image", "font")
MAX_WEB_HOPS = 5
# Text counts only where it is painted: unsupported painting makes the answer unknown, not true.
_VISIBLE_TEXT = """(wanted) => {
  const flat = s => (s || '').replace(/\\s+/g, ' ').trim();
  wanted = flat(wanted);
  if (!wanted) return false;
  const holds = e => flat(e.textContent).includes(wanted);
  const candidates = [...document.body.querySelectorAll('*')].filter(
    e => holds(e) && ![...e.children].some(holds));
  if (!candidates.length && flat(document.body.textContent).includes(wanted)) candidates.push(document.body);
  const rgba = c => { const m = c.match(/[\\d.]+/g) || []; return m.length < 3 ? null : m.map(Number).concat(m.length < 4 ? [1] : []); };
  const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const judge = e => {
    if (!e.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) return false;
    let background = null, opacity = 1;
    for (let x = e; x; x = x.parentElement) {
      const style = getComputedStyle(x);
      if (style.clipPath !== 'none' || style.maskImage !== 'none' || style.filter !== 'none'
          || style.mixBlendMode !== 'normal' || style.colorScheme.includes('dark')) return null;
      for (const pseudo of ['::before', '::after'])
        if (!['none', 'normal'].includes(getComputedStyle(x, pseudo).content)) return null;
      opacity *= Number(style.opacity);
      if (!background) {
        if (style.backgroundImage !== 'none') return null;
        const fill = rgba(style.backgroundColor);
        if (fill && fill[3] >= 1) background = fill;
        else if (fill && fill[3] > 0) return null;
      }
    }
    if (opacity < 0.5) return null;
    const style = getComputedStyle(e);
    for (const pseudo of ['::first-letter', '::first-line'])
      if (getComputedStyle(e, pseudo).color !== style.color) return null;
    const color = rgba(style.color), fill = rgba(style.webkitTextFillColor);
    if (!color || !fill || color[3] < 1 || fill[3] < 1 || parseFloat(style.fontSize) < 6) return false;
    background = background || [255, 255, 255];
    const [a, b] = [lum(fill), lum(background)].sort((p, q) => q - p);
    if ((a + 0.05) / (b + 0.05) < 3) return false;
    e.scrollIntoView({block: 'center', inline: 'center'});
    const box = e.getBoundingClientRect();
    if (box.width < 1 || box.height < 1 || box.right <= 0 || box.bottom <= 0) return false;
    const width = document.documentElement.scrollWidth, height = document.documentElement.scrollHeight;
    if (box.left + window.scrollX >= width || box.top + window.scrollY >= height) return false;
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit && e.contains(hit) ? true : null;
  };
  let unknown = false;
  for (const e of candidates) {
    const seen = judge(e);
    if (seen === true) return true;
    if (seen === null) unknown = true;
  }
  return unknown ? null : false;
}"""


def _web_origin(url: str) -> tuple:
    parts = urlsplit(url)
    default = {"http": 80, "https": 443}.get(parts.scheme)
    host = (parts.hostname or "").encode("idna").decode("ascii").lower()
    return parts.scheme, host, default if parts.port is None else parts.port


def _web_target(url: str) -> tuple:
    """Resolve every address once. The caller connects to one of those exact addresses."""
    import ipaddress
    import socket

    parts = urlsplit(url)
    scheme, host, port = _web_origin(url)
    private = os.environ.get("OCADE_ALLOW_PRIVATE_WEB") == "1"
    if (not host or parts.username is not None or parts.password is not None
            or scheme not in ("http", "https") or not port
            or (not private and (scheme != "https" or port != 443
                                 or host.rstrip(".") == "localhost"
                                 or host.rstrip(".").endswith(".localhost")))):
        raise Refused("web_url_refused")
    endpoints = list(dict.fromkeys(socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)))
    if not endpoints:
        raise Refused("web_url_refused")
    if not private:
        for endpoint in endpoints:
            address = ipaddress.ip_address(endpoint[4][0].split("%")[0])
            address = getattr(address, "ipv4_mapped", None) or address
            if not address.is_global or address.is_multicast or address.is_reserved:
                raise Refused("web_url_refused")
    return scheme, host, port, endpoints


def _web_fetch(url: str) -> tuple[int, dict, bytes]:
    """Anonymous GET over a checked address, with original Host and TLS server name."""
    import base64
    import http.client
    import socket
    import ssl
    import urllib.request
    import zlib
    from urllib.parse import unquote

    scheme, host, port, endpoints = _web_target(url)
    parts = urlsplit(url)
    path = (parts.path or "/") + (("?" + parts.query) if parts.query else "")
    proxy = urllib.request.getproxies().get(scheme)
    if urllib.request.proxy_bypass(host):
        proxy = None
    proxy_url = urlsplit(proxy if "://" in proxy else "http://" + proxy) if proxy else None
    if proxy_url and (proxy_url.scheme != "http" or not proxy_url.hostname):
        raise Refused("web_proxy_unsupported")

    tls = ssl.create_default_context() if scheme == "https" else None
    extra_ca = os.environ.get("NODE_EXTRA_CA_CERTS")
    if tls and extra_ca:
        tls.load_verify_locations(cafile=extra_ca)
    for family, kind, protocol, _, address in endpoints[:4]:
        connection = http.client.HTTPConnection(host, port, timeout=5)
        try:
            if proxy_url:
                # A trusted proxy still connects to the checked numeric destination.
                tunnel_headers = {}
                if proxy_url.username is not None:
                    credential = unquote(proxy_url.username) + ":" + unquote(proxy_url.password or "")
                    tunnel_headers["Proxy-Authorization"] = "Basic " + base64.b64encode(credential.encode()).decode()
                tunnel = http.client.HTTPConnection(proxy_url.hostname, proxy_url.port or 80, timeout=5)
                try:
                    tunnel.set_tunnel(address[0], port, headers=tunnel_headers)
                    tunnel.connect()
                    connection.sock, tunnel.sock = tunnel.sock, None
                finally:
                    tunnel.close()
            else:
                connection.sock = socket.socket(family, kind, protocol)
                connection.sock.settimeout(5)
                connection.sock.connect(address)
            if tls:
                connection.sock = tls.wrap_socket(connection.sock, server_hostname=host)
        except OSError:
            connection.close()
            continue
        break
    else:
        raise Refused("web_unreachable")

    try:
        connection.request("GET", path, headers={
            "Accept-Encoding": "identity", "User-Agent": "OCade-IndependentVerifier/1",
        })
        with connection.getresponse() as response:
            headers = {name.lower(): value for name, value in response.getheaders()}
            if 300 <= response.status < 400 and headers.get("location"):
                return response.status, headers, b""
            limit = WEB_LIMITS["response_bytes"]
            length = headers.get("content-length")
            if length is not None and int(length) > limit:
                raise Refused("response_bytes")
            body = response.read(limit + 1)
            if len(body) > limit:
                raise Refused("response_bytes")
            if length is not None and len(body) != int(length):
                raise Refused("web_unreachable")
            encoding = headers.get("content-encoding", "identity").lower()
            if encoding in ("gzip", "deflate"):
                inflater = zlib.decompressobj(31 if encoding == "gzip" else zlib.MAX_WBITS)
                body = inflater.decompress(body, WEB_LIMITS["decoded_bytes"] + 1)
                if len(body) > WEB_LIMITS["decoded_bytes"]:
                    raise Refused("decoded_bytes")
                if not inflater.eof or inflater.unused_data:
                    raise Refused("web_unreachable")
            elif encoding != "identity":
                raise Refused("web_encoding_unsupported")
            return response.status, headers, body
    finally:
        connection.close()


async def _web_texts(url: str, wanted: list[str]) -> tuple[dict, dict]:
    """Each wanted text: visibly on the page (True), absent or hidden (False), or unknown (None)."""
    unknown = {text: None for text in wanted}
    if not isinstance(url, str):
        return unknown, {"error": "web_url_refused"}
    try:
        origin = _web_origin(url)
    except ValueError:
        return unknown, {"error": "web_url_refused"}
    executable = os.environ.get("OCADE_BROWSER_EXECUTABLE")
    if executable and not Path(executable).is_file():
        return unknown, {"error": "browser_unavailable"}
    from playwright.async_api import async_playwright

    state = {"requests": 0, "hop": None, "stop": None}

    async def guard(route) -> None:
        request = route.request
        state["requests"] += 1
        if state["requests"] > WEB_LIMITS["request_count"]:
            state["stop"] = state["stop"] or {"error": "web_resource_limit", "resourceLimit": "request_count"}
            return await route.abort("blockedbyclient")
        if (request.method != "GET" or request.resource_type not in WEB_RESOURCES
                or _web_origin(request.url) != origin
                or (request.resource_type == "document" and request.frame.parent_frame is not None)):
            state["stop"] = state["stop"] or {"error": "web_request_blocked"}
            return await route.abort("blockedbyclient")
        try:
            with anyio.fail_after(20):
                status, headers, body = await anyio.to_thread.run_sync(_web_fetch, request.url, abandon_on_cancel=True)
        except Refused as error:
            reason = ({"error": "web_resource_limit", "resourceLimit": error.code}
                      if error.code in ("response_bytes", "decoded_bytes") else {"error": error.code})
            state["stop"] = state["stop"] or reason
            return await route.abort("blockedbyclient")
        except Exception:
            state["stop"] = state["stop"] or {"error": "web_unreachable"}
            return await route.abort("failed")
        location = headers.get("location")
        if 300 <= status < 400 and location:
            if request.resource_type == "document":
                state["hop"] = urljoin(request.url, location)
            else:
                state["stop"] = state["stop"] or {"error": "web_redirect_refused"}
            return await route.abort("blockedbyclient")
        headers = {name: value for name, value in headers.items()
                   if name not in ("content-encoding", "content-length", "transfer-encoding", "set-cookie")}
        await route.fulfill(status=status, headers=headers, body=body)

    async with async_playwright() as playwright:
        try:
            browser = await playwright.chromium.launch(
                executable_path=executable or None,
                # Chromium only renders fulfilled bytes; it never resolves the page host.
                args=["--disable-background-networking", "--disable-component-update",
                      "--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND"]
                + (["--disable-features=LocalNetworkAccessChecks"]
                   if os.environ.get("OCADE_ALLOW_PRIVATE_WEB") == "1" else []),
            )
        except Exception:
            return unknown, {"error": "browser_unavailable"}
        try:
            context = await browser.new_context(java_script_enabled=False, service_workers="block",
                                                accept_downloads=False)
            await context.route("**/*", guard)
            target, response = url, None
            for _hop in range(MAX_WEB_HOPS + 1):
                state["hop"] = None
                page = await context.new_page()  # a stopped hop's error page cannot interrupt the next
                try:
                    response = await page.goto(target, wait_until="load", timeout=30_000)
                except Exception:
                    response = None
                if state["stop"] or not state["hop"]:
                    break
                target = state["hop"]
                if _web_origin(target) != origin:
                    return unknown, {"error": "web_redirect_refused"}
            if state["stop"]:
                return unknown, state["stop"]
            if response is None or state["hop"] or not 200 <= response.status < 300:
                return unknown, {"error": "web_unreachable"}
            if await page.evaluate("() => !!document.querySelector('script,iframe,frame,object,embed')"):
                return unknown, {"error": "web_script_dependent"}
            seen = {text: await page.evaluate(_VISIBLE_TEXT, text) for text in wanted}
            return seen, ({"error": state["stop"]["error"]} if state["stop"] else {})
        except Exception:
            return unknown, {"error": "web_unreachable"}
        finally:
            await browser.close()


@app.tool()
async def verify_checks(checks: list[dict]) -> dict:
    """Evaluate a task's fixed typed checks against the real state, independently of the actor."""
    ids = [check.get("id") for check in checks]
    if not ids or any(not isinstance(key, str) or not key for key in ids) or len(set(ids)) != len(ids):
        return {"refused": "invalid_checks", "maybeChanged": False}
    # Same-URL web checks in one call share one fresh observation.
    pages: dict = {}
    for check in checks:
        params = check.get("params") or {}
        if check.get("kind") == "web_text_contains" and isinstance(params.get("text"), str):
            pages.setdefault(params.get("url"), []).append(params["text"])
    observed = {url: await _web_texts(url, wanted) for url, wanted in pages.items()}
    predicates, measured = {}, {}
    for check in checks:
        notes: dict = {}
        params = check.get("params") or {}
        if check.get("kind") == "web_text_contains":
            seen, facts = observed.get(params.get("url"), ({}, {}))
            predicates[check["id"]] = seen.get(params.get("text"))
            notes.update(facts)
        else:
            predicates[check["id"]] = _check(check.get("kind", ""), params, notes)
        if notes:
            measured[check["id"]] = notes  # what was measured, so a failure says which criterion missed
    return {"predicates": predicates, **({"measured": measured} if measured else {}), "verifierVersion": "checks-verifier/1"}



@app.tool()
@guarded
def verify_dependency(name: str, version: str, platform: str, architecture: str,
                      source: str, sha256: str, licence: str, scope: str,
                      privileges: str, destination: str) -> dict:
    """Reopen the published artifact and observe the actual runtime independently."""
    from . import discovery

    return discovery.verify_dependency(
        os.environ.get("OCADE_AGENT_HOME", ""),
        dict(name=name, version=version, platform=platform, architecture=architecture,
             source=source, sha256=sha256, licence=licence, scope=scope,
             privileges=privileges, destination=destination),
    )


if __name__ == "__main__":
    app.run("stdio")
