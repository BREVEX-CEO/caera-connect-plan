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

from .sandbox import MEDIA_INPUT_OPTIONS, PASSIVE_IMAGE_FORMATS, Refused, plain_text, resolve

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
        except Exception:
            return False
        if kind == "image_size":
            return size == (params.get("width"), params.get("height"))
        return _scene_bound(size, text)
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


def _shell_parses(path: Path, notes: dict) -> bool | None:
    """`sh -n`: the shell reads the script without running any of it."""
    shell = shutil.which("sh")
    if not shell or sys.platform == "win32":
        return None
    run = subprocess.run([shell, "-n", str(path)], capture_output=True, text=True, timeout=30,
                         stdin=subprocess.DEVNULL)
    if run.returncode != 0:
        notes["error"] = run.stderr.strip()[:200]
    return run.returncode == 0


def _script_runnable(path: Path, notes: dict) -> bool | None:
    """A script can be started directly: on macOS/Linux a #! line, Unix line endings, the
    executable bit and a script its interpreter accepts. Read only: nothing is run."""
    data = path.read_bytes()[:2_000_000]
    if sys.platform == "win32":
        return None  # Windows starts scripts by file type, not by these properties
    problems = []
    if not data.startswith(b"#!"):
        problems.append("no #! line")
    if b"\r\n" in data:
        problems.append("Windows line endings")
    if not os.stat(path).st_mode & 0o100:
        problems.append("not executable")
    interpreter = data.split(b"\n", 1)[0].decode("utf-8", "replace")
    if not problems and "python" in interpreter:
        try:
            compile(data.decode("utf-8", "replace"), path.name, "exec", dont_inherit=True)  # compiled, never run
        except (SyntaxError, ValueError) as error:
            problems.append(f"does not compile ({type(error).__name__})")
    if not problems and interpreter.rstrip().endswith(("sh", "bash")) and _shell_parses(path, notes) is False:
        problems.append("shell syntax error")
    if problems:
        notes["error"] = ", ".join(problems)
    return not problems


def _workbook_formula(path: Path, params: dict, notes: dict) -> bool:
    """The cell holds a formula (the workbook stays editable), and its saved result is the value."""
    try:
        formula = openpyxl.load_workbook(path)[params["sheet"]][params["cell"]].value
        result = openpyxl.load_workbook(path, data_only=True)[params["sheet"]][params["cell"]].value
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
    log = subprocess.run(
        [ffmpeg, "-hide_banner", "-nostats", *MEDIA_INPUT_OPTIONS, "-i", str(path), "-filter_complex",
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
            browser = await playwright.chromium.launch(
                executable_path=executable or None,
                # A fulfilled document has no remote address; owner-flagged loopback is already allowed.
                args=["--disable-features=LocalNetworkAccessChecks"]
                if os.environ.get("OCADE_ALLOW_PRIVATE_WEB") == "1" else [],
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


if __name__ == "__main__":
    app.run("stdio")
