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

import openpyxl
import pypdfium2
from docx import Document
from mcp.server.mcpserver import MCPServer
from pypdf import PdfReader

from .sandbox import Refused, plain_text, resolve

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
        if isinstance(expected, (int, float)) and isinstance(value, (int, float)):
            return abs(value - expected) < TOLERANCE
        return value is not None and str(value) == str(expected)
    if kind == "media_duration":
        try:
            path = resolve(WORKSPACE, params["path"])
        except (Refused, KeyError):
            return False
        probe = shutil.which("ffprobe")
        if not probe:
            return None
        run = subprocess.run([probe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                             capture_output=True, text=True, timeout=60)
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
            with Image.open(path) as image:
                size, text = image.size, dict(getattr(image, "text", {}) or {})
        except Exception:
            return False
        if kind == "image_size":
            return size == (params.get("width"), params.get("height"))
        return _scene_bound(size, text)
    if kind == "web_text_contains":
        # Read anonymously: a page that needs a sign-in cannot be observed this way.
        import html
        import urllib.request

        try:
            with urllib.request.urlopen(params["url"], timeout=20) as response:
                body = response.read(2_000_000).decode("utf-8", errors="replace")
        except Exception:
            return None
        visible = html.unescape(re.sub(r"<[^>]+>", " ", body))
        return params.get("text", "\0") in visible
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

    text = plain_text(path)
    if text is None:
        return None
    suffix = path.suffix.lower()
    parsers = {
        ".json": json.loads,
        ".py": lambda t: compile(t, path.name, "exec", dont_inherit=True),  # compiled, never run
        ".xml": ElementTree.fromstring,
        ".toml": tomllib.loads,
        ".ini": lambda t: configparser.ConfigParser().read_string(t),
        ".cfg": lambda t: configparser.ConfigParser().read_string(t),
        ".csv": lambda t: [len(row) for row in csv.reader(t.splitlines())],
    }
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
    run = subprocess.run([probe, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
                         capture_output=True, text=True, timeout=60)
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
    log = subprocess.run(
        [ffmpeg, "-hide_banner", "-nostats", "-i", str(path), "-filter_complex",
         "[0:v]blackdetect=d=1:pix_th=0.06[v];[0:a]ebur128=peak=true,silencedetect=n=-50dB:d=1.5[a]",
         "-map", "[v]", "-map", "[a]", "-f", "null", "-"],
        capture_output=True, text=True, timeout=1800,
    ).stderr
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


@app.tool()
def verify_checks(checks: list[dict]) -> dict:
    """Evaluate a task's fixed typed checks against the real state, independently of the actor."""
    ids = [check.get("id") for check in checks]
    if not ids or any(not isinstance(key, str) or not key for key in ids) or len(set(ids)) != len(ids):
        return {"refused": "invalid_checks"}
    predicates, measured = {}, {}
    for check in checks:
        notes: dict = {}
        predicates[check["id"]] = _check(check.get("kind", ""), check.get("params") or {}, notes)
        if notes:
            measured[check["id"]] = notes  # what was measured, so a failure says which criterion missed
    return {"predicates": predicates, **({"measured": measured} if measured else {}), "verifierVersion": "checks-verifier/1"}


if __name__ == "__main__":
    app.run("stdio")
