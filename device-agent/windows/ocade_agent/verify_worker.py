"""The independent verifier (plan.md §12, §27.2, P16) as its own MCP stdio worker.

Runs in a separate process from the actor and shares none of its reading or
writing code, on purpose: a bug in how the actor reads a sheet must not also
convince the verifier. It re-reads the SAVED files, pages and windows and reports
one boolean (or None when unobservable) per typed check.
It never writes anything and never declares a task done; the server settles.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import shutil
import subprocess
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
from .sandbox import MEDIA_INPUT_OPTIONS, PASSIVE_IMAGE_FORMATS, Refused, guarded, plain_text, resolve

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
        if kind == "file_contains":
            text = _text(path)
            if text is None:
                return None
            # Words, not typography: letter case and runs of spaces/newlines do not decide a check.
            wanted, found = (" ".join(t.split()).casefold() for t in (params.get("text", "\0"), text))
            # A PDF must also render with no blank page, not merely carry the words.
            return bool(wanted) and wanted in found and (path.suffix.lower() != ".pdf" or _pdf_renders(path))
        try:
            value = openpyxl.load_workbook(path, data_only=True)[params["sheet"]][params["cell"]].value
        except Exception:
            return False
        expected = params.get("value")
        # Excel booleans are not numbers, and text/number coercion can turn
        # an incorrect result into a passing acceptance predicate.
        if type(expected) in (int, float):
            return type(value) in (int, float) and abs(value - expected) < TOLERANCE
        return isinstance(expected, str) and isinstance(value, str) and value == expected
    if kind in ("script_runnable", "workbook_formula", "document_headings"):
        try:
            path = resolve(WORKSPACE, params["path"])
        except (Refused, KeyError):
            return False
        if not path.is_file():
            return False
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


def _workbook_formula(path: Path, params: dict, notes: dict) -> bool:
    """The cell holds a formula (the workbook stays editable), and its saved result is the value."""
    try:
        def saved_value(data_only):
            book = openpyxl.load_workbook(path, data_only=data_only, read_only=True, keep_links=False)
            try:
                return book[params["sheet"]][params["cell"]].value
            finally:
                book.close()

        formula = saved_value(False)
        result = saved_value(True)
    except Exception:
        return False
    if not (isinstance(formula, str) and formula.startswith("=")):
        notes["error"] = "a typed-in value, not a formula"
        return False
    expected = params.get("value")
    if expected is None:
        return True
    if type(expected) in (int, float):
        return type(result) in (int, float) and abs(result - expected) < TOLERANCE
    return isinstance(result, str) and result == expected


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


def _command_succeeds(command, text, notes: dict) -> bool | None:
    """Re-run a repaired script or program, as the person confirmed it earlier in the task, in a
    throwaway copy of the workspace: the person's folder is never changed by verifying. Passes
    when it exits 0 within two minutes (and prints the text, when given)."""
    import signal
    import tempfile

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
        copy = Path(scratch) / "workspace"
        shutil.copytree(root, copy, symlinks=True)
        if any(path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction())
               for path in copy.rglob("*")):
            notes["error"] = "workspace links changed during staging"
            return None
        argv = shell_argv(command, None)
        process = subprocess.Popen(argv, cwd=copy, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, start_new_session=sys.platform != "win32",
                                   creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
        try:
            output, _ = process.communicate(timeout=120)
        except subprocess.TimeoutExpired:
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(process.pid)], capture_output=True)
            else:
                os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
            notes["error"] = "did not finish within 120 s"
            return False
    printed = output.decode("utf-8", "replace")
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
    return parts.scheme, (parts.hostname or "").lower(), parts.port or {"http": 80, "https": 443}.get(parts.scheme)


def _web_allowed(url: str) -> bool:
    """https to a public host (http and private hosts only on an owner-flagged test machine)."""
    import ipaddress
    import socket

    scheme, host, port = _web_origin(url)
    if os.environ.get("OCADE_ALLOW_PRIVATE_WEB") == "1":
        return scheme in ("http", "https") and bool(host)
    if scheme != "https" or port != 443 or not host or host == "localhost" or host.endswith(".localhost"):
        return False
    try:
        addresses = {info[4][0].split("%")[0] for info in socket.getaddrinfo(host, 443)}
        return bool(addresses) and all(ipaddress.ip_address(a).is_global for a in addresses)
    except (OSError, ValueError):
        return False


async def _web_texts(url: str, wanted: list[str]) -> tuple[dict, dict]:
    """Each wanted text: visibly on the page (True), absent or hidden (False), or unknown (None)."""
    unknown = {text: None for text in wanted}
    if not isinstance(url, str) or not _web_allowed(url):
        return unknown, {"error": "web_url_refused"}
    executable = os.environ.get("OCADE_BROWSER_EXECUTABLE")
    if executable and not Path(executable).is_file():
        return unknown, {"error": "browser_unavailable"}
    from playwright.async_api import async_playwright

    origin, state = _web_origin(url), {"requests": 0, "hop": None, "stop": None}

    async def guard(route) -> None:
        request = route.request
        state["requests"] += 1
        if state["requests"] > WEB_LIMITS["request_count"]:
            state["stop"] = state["stop"] or {"error": "web_resource_limit", "resourceLimit": "request_count"}
            return await route.abort("blockedbyclient")
        if (request.method != "GET" or request.resource_type not in WEB_RESOURCES
                or _web_origin(request.url) != origin
                or (request.resource_type == "document" and request.frame.parent_frame is not None)
                # Resolved again for every request: a name that now points somewhere private is refused.
                or not await anyio.to_thread.run_sync(_web_allowed, request.url)):
            state["stop"] = state["stop"] or {"error": "web_request_blocked"}
            return await route.abort("blockedbyclient")
        try:
            response = await route.fetch(max_redirects=0, timeout=20_000)
            declared = int(response.headers.get("content-length") or 0)
            body = b"" if declared > WEB_LIMITS["response_bytes"] else await response.body()
        except Exception:
            state["stop"] = state["stop"] or {"error": "web_unreachable"}
            return await route.abort("failed")
        location = response.headers.get("location")
        if 300 <= response.status < 400 and location and request.resource_type == "document":
            state["hop"] = urljoin(request.url, location)  # followed by the caller once checked
            return await route.abort("blockedbyclient")
        limit = ("response_bytes" if declared > WEB_LIMITS["response_bytes"]
                 else "decoded_bytes" if len(body) > WEB_LIMITS["decoded_bytes"] else None)
        if limit:
            state["stop"] = state["stop"] or {"error": "web_resource_limit", "resourceLimit": limit}
            return await route.abort("blockedbyclient")
        headers = {k: v for k, v in response.headers.items()
                   if k.lower() not in ("content-encoding", "content-length", "transfer-encoding")}
        await route.fulfill(status=response.status, headers=headers, body=body)

    async with async_playwright() as playwright:
        try:
            proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
            browser = await playwright.chromium.launch(
                executable_path=executable or None,
                # A fulfilled document has no remote address; owner-flagged loopback is already allowed.
                # A verifier reads one page: none of the browser's own update or sync traffic.
                args=["--disable-background-networking", "--disable-component-update"]
                + (["--disable-features=LocalNetworkAccessChecks"]
                   if os.environ.get("OCADE_ALLOW_PRIVATE_WEB") == "1" else []),
                # The computer's own proxy, exactly as the actor's browser uses it: without it a
                # check behind a proxy can never reach the site and stays unobservable.
                **({"proxy": {"server": proxy, "bypass": os.environ.get("NO_PROXY", "")}} if proxy else {}),
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
