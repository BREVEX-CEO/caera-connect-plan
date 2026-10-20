"""
Five-way JARVIS control-architecture benchmark (TOFIX H5, H5E, H7) — isolated experiment.

Every architecture drives the SAME real device executor the product ships
(jarvis-runtime Computer + Playwright browser session) on the SAME tasks, judged by the
SAME independent oracles. They differ only in what they are designed to differ in:
where remote planner calls happen, how actions are batched per device exchange, how a
changing page is waited for, and how an interrupted run recovers.

MEASURED here: local execution time per action and per task, actions, device exchanges,
remote planner calls and the characters each call would send/receive, oracle verdicts,
duplicates, preserved user edits, STOP latency.
MODELED, never measured here: remote planner latency (no authorised model key in this
sandbox) and device exchange latency (no staging device). They are reported as separate
columns: modeled_s = calls * PLANNER_S + exchanges * EXCHANGE_S + measured local seconds.
Planner outputs are frozen fixtures, identical in content for every architecture, so the
comparison is architecture-controlled; model quality per representation is NOT measured.

Run: xvfb-run -a python3 experiments/architectures/bench.py [--runs 5] [--out results.json]
"""
from __future__ import annotations

import argparse
import json
import platform
import random
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import threading
import time
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "jarvis-runtime"))
sys.path.insert(0, str(HERE / "fixtures"))
from actions.browser_control import _BrowserSession  # noqa: E402
from ocade_computer import Computer  # noqa: E402
from order_site import Site  # noqa: E402

# Median of the recorded 200-status provider response-header times in TOFIX H1 (EV-EXCEL-1):
# 7631, 2893, 2988, 3096, 3366, 3099 ms. A header time, not a full completion: a floor.
PLANNER_S = 3.1
# One device exchange: the Agent's ~1 s cadence while active (ocade_device.py). Modeled.
EXCHANGE_S = 1.0
# The product's fixed per-call context: JARVIS_SYSTEM_PROMPT_V2 (21,173 chars) + tool
# declarations (13,600 chars), measured from src/jarvis/protocol.ts at this commit.
FIXED_CONTEXT = 21_173 + 13_600
BROWSER = {"open", "new_tab", "click", "type", "select", "press", "switch_tab", "observe",
           "find_text", "upload", "download", "wait", "scroll", "click_at", "drag_at"}
READS = {"file_read", "file_extract", "sheet_inspect"}
CHANGES = {"doc_edit", "sheet_edit", "pdf_export", "file_write", "click", "type", "select",
           "upload", "download", "press", "click_at", "drag_at"}


class PlannerDown(Exception):
    pass


class Stopped(Exception):
    """STOP ends the task, in every design: nothing more is planned, read or done."""


class Crash(Exception):
    """The run died after an effect committed and before its result reached anyone."""

    def __init__(self, index: int):
        super().__init__(f"crashed after step {index}")
        self.index = index


# -- shared measurement and device -------------------------------------------------------

class Meter:
    def __init__(self):
        self.calls: list[dict] = []
        self.exchanges = 0
        self.actions: list[dict] = []
        self.history = 0  # characters of results fed back to the planner so far
        self.approvals = 0  # confirmations the person gave (their wait is not modeled)
        self.check_ms = 0.0  # time spent reading whether an effect is already there
        self.down_at: int | None = None  # planner call index that answers 503 once

    def plan(self, purpose: str, output, feeds_history=True) -> object:
        if self.down_at is not None and len(self.calls) == self.down_at:
            self.down_at = None
            self.calls.append({"purpose": purpose + " (503)", "in": FIXED_CONTEXT, "out": 0})
            raise PlannerDown()
        self.calls.append({"purpose": purpose, "in": FIXED_CONTEXT + (self.history if feeds_history else 0),
                           "out": len(json.dumps(output))})
        return output

    def summary(self) -> dict:
        local = (sum(a["ms"] for a in self.actions) + self.check_ms) / 1000
        return {"planner_calls": len(self.calls), "exchanges": self.exchanges, "actions": len(self.actions),
                "approvals": self.approvals, "check_s": round(self.check_ms / 1000, 3),
                "local_s": round(local, 3),
                "prompt_chars": sum(c["in"] for c in self.calls),
                "output_chars": sum(c["out"] for c in self.calls),
                "modeled_s": round(len(self.calls) * PLANNER_S + self.exchanges * EXCHANGE_S + local, 2)}


class Device:
    """The product's executor, reached one exchange at a time. Faults are injected here."""

    def __init__(self, root: Path, meter: Meter):
        self.root, self.meter = root, meter
        self.pc = Computer(str(root))
        self.cancel = threading.Event()
        self.browser: _BrowserSession | None = None
        self.crash_after: int | None = None  # crash right after this many committed changes
        self.user_edit_after: int | None = None
        self.changes = 0
        self.last_observation: dict | None = None
        self.stopped_at: float | None = None

    def close(self):
        if self.browser:
            self.browser.close()

    def exchange(self, steps: list[dict], resolve=False, ready=False) -> list[dict]:
        """One round trip carrying `steps`; ends at the first that does not finish.
        `resolve`: semantic targets are resolved on the device. `ready`: a missing target is
        waited for on the device (bounded), instead of returning to the planner."""
        if self.cancel.is_set():
            raise Stopped()
        self.meter.exchanges += 1
        out = []
        for index, step in enumerate(steps):
            if self.cancel.is_set():
                raise Stopped()
            started = time.perf_counter()
            result = self._one(dict(step), resolve, ready)
            if result.get("status") == "needs_confirmation":
                # The person approves, as they would in the product: counted, never skipped.
                self.meter.approvals += 1
                result = self._one(dict(step), resolve, ready, confirmed=True)
            ms = (time.perf_counter() - started) * 1000
            self.meter.actions.append({"action": step["action"], "ms": round(ms, 2), "t": started,
                                       "status": result.get("status")})
            out.append(result)
            if result.get("status") == "done" and step["action"] in CHANGES:
                self.changes += 1
                if self.user_edit_after == self.changes:
                    self.user_edit_after = None
                    user_edit(self.root)
                if self.crash_after == self.changes:
                    self.crash_after = None
                    raise Crash(index)
            if result.get("stopped") or self.cancel.is_set():
                raise Stopped()
            if result.get("status") != "done":
                break
        return out

    def _one(self, step: dict, resolve: bool, ready: bool, confirmed=False) -> dict:
        kind = step["action"]
        if kind not in BROWSER:
            return self.pc.run(step, confirmed=confirmed, cancel=self.cancel)
        if not self.browser:
            self.browser = _BrowserSession("chromium", mode="isolated", headless=True)
            self.browser.start()
        target = step.pop("target", None)
        if target:
            if not resolve:
                raise AssertionError("a semantic target reached the device unresolved")
            found = self._resolve(target, ready)
            if isinstance(found, str):
                return {"status": "failed", "summary": found}
            step["ref"], step["observationId"] = found
        step.pop("expect", None)
        if kind == "upload":
            step["_file"] = str(self.root / step["path"])
        if kind == "download":
            step["_folder"] = str(self.root / "Downloads")
        result = self.browser.run(self.browser.act(step, confirmed), timeout=90, cancel=self.cancel)
        if isinstance(result, dict) and result.get("observation"):
            self.last_observation = result["observation"]
        return result

    def _resolve(self, target: dict, ready: bool):
        deadline = time.monotonic() + (5 if ready else 0)
        while True:
            obs = self.browser.run(self.browser.act({"action": "observe"}), timeout=60)["observation"]
            self.last_observation = obs
            name = target["name"].lower()
            hits = [e for e in obs["elements"] if not e.get("disabled") and not e.get("covered")
                    and (e["name"].lower() == name or (target.get("contains") and name in e["name"].lower()))
                    and (not target.get("role") or e["role"] == target["role"])]
            if len(hits) == 1:
                return hits[0]["ref"], obs["observationId"]
            if time.monotonic() > deadline:
                return f"{len(hits)} elements match {target}"
            time.sleep(0.1)


def user_edit(root: Path):
    """The person adds a note to the essay while the task runs (fault F2)."""
    path = root / "JARVIS_Essay.docx"
    if path.exists():
        from docx import Document
        doc = Document(str(path))
        doc.add_paragraph("USER NOTE: keep this line.")
        doc.save(str(path))


# -- tasks -----------------------------------------------------------------------------

ESSAY = json.loads((HERE / "fixtures/essay.json").read_text())
RESEARCH = json.loads((HERE / "fixtures/research.json").read_text())


def doc_steps() -> list[dict]:
    ops = [{"op": "append", "text": ESSAY["title"], "style": "Title"}]
    for section in ESSAY["sections"]:
        ops.append({"op": "append", "text": section["heading"], "style": "Heading 1"})
        ops += [{"op": "append", "text": p} for p in section["paragraphs"]]
    ops.append({"op": "bold", "find": ESSAY["bold"]})
    return [{"action": "doc_edit", "path": "JARVIS_Essay.docx", "ops": ops},
            {"action": "file_extract", "path": "JARVIS_Essay.docx"},
            {"action": "pdf_export", "from": "JARVIS_Essay.docx", "path": "JARVIS_Essay.pdf"},
            {"action": "file_extract", "path": "JARVIS_Essay.pdf"}]


def doc_desired() -> dict:
    """E's desired state: what must be true, not how to get there."""
    blocks = [("Title", ESSAY["title"])]
    for section in ESSAY["sections"]:
        blocks.append(("Heading 1", section["heading"]))
        blocks += [("Normal", p) for p in section["paragraphs"]]
    return {"document": {"path": "JARVIS_Essay.docx", "blocks": blocks, "bold": ESSAY["bold"],
                         "minWords": 300},
            "pdf": {"path": "JARVIS_Essay.pdf", "from": "JARVIS_Essay.docx"}}


def research_reads() -> list[dict]:
    steps = []
    for page in RESEARCH["pages"]:
        steps.append({"action": "open", "url": page["url"]})
        steps += [{"action": "find_text", "text": q} for q in page["find"]]
    return steps


def sheet_steps() -> list[dict]:
    rows = RESEARCH["rows"]
    ops = [{"op": "set", "cell": "A1", "value": RESEARCH["title"]},
           {"op": "set", "cell": "A3", "value": "Specification"},
           {"op": "set", "cell": "B3", "value": RESEARCH["products"][0]},
           {"op": "set", "cell": "C3", "value": RESEARCH["products"][1]},
           {"op": "set", "cell": "D3", "value": "Difference (B - C)"}]
    for i, (label, a, b) in enumerate(rows, start=4):
        ops += [{"op": "set", "cell": f"A{i}", "value": label}, {"op": "set", "cell": f"B{i}", "value": a},
                {"op": "set", "cell": f"C{i}", "value": b}, {"op": "set", "cell": f"D{i}", "value": f"=B{i}-C{i}"}]
    last = 3 + len(rows)
    ops += [{"op": "set", "cell": f"A{last + 2}", "value": "Price premium of C over B"},
            {"op": "set", "cell": f"B{last + 2}", "value": "=(C4-B4)/B4"},
            {"op": "format", "range": f"B{last + 2}", "numberFormat": "0.0%"},
            {"op": "format", "range": "A3:D3", "bold": True, "fillColor": "#DDEBF7"},
            {"op": "format", "range": "A1", "bold": True},
            {"op": "format", "range": "A3:D3", "columnWidth": 24},
            {"op": "sheet_add", "name": "Sources"}, {"op": "sheet_add", "name": "Recommendation"}]
    sources = [{"op": "set", "cell": "A1", "value": "URL"}, {"op": "set", "cell": "B1", "value": "What it supports"}]
    for i, page in enumerate(RESEARCH["pages"], start=2):
        sources += [{"op": "set", "cell": f"A{i}", "value": page["url"]},
                    {"op": "set", "cell": f"B{i}", "value": page["supports"]}]
    recommendation = [{"op": "set", "cell": "A1", "value": "Recommendation"},
                      {"op": "set", "cell": "A2", "value": RESEARCH["recommendation"]}]
    # Without a spreadsheet app to work in, a charted workbook is never re-edited as a file
    # (the chart would be lost): the chart is the last edit.
    chart = [{"op": "chart", "kind": "column", "source": "A3:C4", "anchor": "F3", "title": "Price (USD)"}]
    return [{"action": "sheet_edit", "path": "Phones.xlsx", "ops": ops},
            {"action": "sheet_edit", "path": "Phones.xlsx", "sheet": "Sources", "ops": sources},
            {"action": "sheet_edit", "path": "Phones.xlsx", "sheet": "Recommendation", "ops": recommendation},
            {"action": "sheet_edit", "path": "Phones.xlsx", "sheet": "Sheet1", "ops": chart},
            {"action": "sheet_inspect", "path": "Phones.xlsx"},
            {"action": "pdf_export", "from": "Phones.xlsx", "path": "Phones.pdf"},
            {"action": "file_extract", "path": "Phones.pdf"}]


PAINT = "https://viliusle.github.io/miniPaint/"
CANVAS = {"name": "canvas 800x600", "role": "canvas"}
ROCKET = [("Rectangle", (0.44, 0.30, 0.56, 0.72), "#e5e7eb"), ("Triangle", (0.44, 0.14, 0.56, 0.30), "#dc2626"),
          ("Triangle", (0.36, 0.58, 0.44, 0.72), "#dc2626"), ("Triangle", (0.56, 0.58, 0.64, 0.72), "#dc2626"),
          ("Ellipse", (0.46, 0.73, 0.54, 0.92), "#f97316"), ("Ellipse", (0.475, 0.38, 0.525, 0.45), "#60a5fa")]


def photo_steps() -> list[dict]:
    """After the planner saw the editor: original rocket artwork, exported as PNG. Each shape
    declares the colour it should leave at its centre (what a check can look for)."""
    steps = [{"action": "type", "target": {"name": "Hex"}, "text": "#0b1d51"}, {"action": "press", "key": "Enter"},
             {"action": "click", "target": {"name": "Fill", "role": "generic"}},
             {"action": "click_at", "target": CANVAS, "x": 0.1, "y": 0.1, "expect": "#0b1d51"}]
    for shape, (x, y, to_x, to_y), colour in ROCKET:
        steps += [{"action": "click", "target": {"name": "Shapes (H)"}},
                  {"action": "click", "target": {"name": shape, "role": "canvas"}},
                  {"action": "click", "target": {"name": "Fill color:"}},
                  {"action": "type", "target": {"name": "Hex"}, "text": colour}, {"action": "press", "key": "Enter"},
                  {"action": "click", "target": {"name": "Ok", "role": "button"}},
                  {"action": "drag_at", "target": CANVAS, "x": x, "y": y, "toX": to_x, "toY": to_y, "expect": colour}]
    steps += [{"action": "click", "target": {"name": "File"}},
              {"action": "click", "target": {"name": "Export", "contains": True}},
              {"action": "type", "target": {"name": "File name:"}, "text": "rocket"},
              {"action": "click", "target": {"name": "PNG - Portable Network Graphics"}},
              {"action": "download", "target": {"name": "Ok", "role": "button"}}]
    return steps


def form_reads(site: Site) -> list[dict]:
    return [{"action": "open", "url": site.url + "/index.html"}]


def form_steps() -> list[dict]:
    """After the planner read the order page: everything else, by semantic target."""
    return [{"action": "file_write", "path": "notes.txt", "content": "Deliver to launch pad 39A."},
            {"action": "click", "target": {"name": "Open order form", "role": "link"}},
            {"action": "type", "target": {"name": "Customer"}, "text": "Ada Lovelace"},
            {"action": "select", "target": {"name": "Plan", "contains": True}, "option": "Express"},
            # Revealed 600 ms after the choice: the dynamic part of the form.
            {"action": "type", "target": {"name": "Order total"}, "text": Site.expected_total()},
            {"action": "upload", "target": {"name": "Attachment"}, "path": "notes.txt"},
            {"action": "click", "target": {"name": "Send order", "role": "button"}},
            {"action": "download", "target": {"name": "Download receipt", "role": "link"}},
            {"action": "file_read", "path": "Downloads/receipt-0.txt"}]


# -- independent oracles (none of them reuse the generator or the device's own reader) ------

def soffice(args: list[str], cwd: Path):
    profile = Path(tempfile.mkdtemp())
    subprocess.run(["soffice", f"-env:UserInstallation={profile.as_uri()}", "--headless", *args],
                   cwd=cwd, capture_output=True, timeout=180)
    shutil.rmtree(profile, True)


def oracle_doc(root: Path, _ctx) -> dict:
    from docx import Document
    from pypdf import PdfReader
    path = root / "JARVIS_Essay.docx"
    if not path.exists():
        return {"pass": False, "why": "no document"}
    doc = Document(str(path))
    body = [p for p in doc.paragraphs if p.style.name in ("Normal",) and p.text.strip()
            and not p.text.startswith("USER NOTE")]
    words = sum(len(p.text.split()) for p in body)
    styles = {p.style.name for p in doc.paragraphs}
    bold = any(r.bold and ESSAY["bold"] in r.text for p in doc.paragraphs for r in p.runs)
    expected = [p for s in ESSAY["sections"] for p in s["paragraphs"]]
    duplicated = len(body) > len(expected)
    pdf = root / "JARVIS_Essay.pdf"
    pages = len(PdfReader(str(pdf)).pages) if pdf.exists() else 0
    user_kept = any(p.text.startswith("USER NOTE") for p in doc.paragraphs)
    ok = words >= 300 and {"Title", "Heading 1"} <= styles and bold and not duplicated and pages >= 1
    return {"pass": ok, "bodyWords": words, "styles": sorted(styles), "bold": bold,
            "duplicated": duplicated, "pdfPages": pages, "userEditKept": user_kept}


def oracle_sheet(root: Path, ctx) -> dict:
    from openpyxl import load_workbook
    path = root / "Phones.xlsx"
    if not path.exists():
        return {"pass": False, "why": "no workbook"}
    # LibreOffice recalculates a copy: the values are Calc's, not the generator's.
    calc = root / "recalc"
    calc.mkdir(exist_ok=True)
    soffice(["--convert-to", "xlsx:Calc MS Excel 2007 XML", "--outdir", str(calc), str(path)], root)
    book = load_workbook(str(calc / "Phones.xlsx"), data_only=True)
    sheet = book["Sheet1"] if "Sheet1" in book.sheetnames else book.worksheets[0]
    problems = []
    for i, (label, a, b) in enumerate(RESEARCH["rows"], start=4):
        got = sheet[f"D{i}"].value
        if not isinstance(got, (int, float)) or abs(got - (a - b)) > 1e-6:
            problems.append(f"D{i}={got!r}, expected {a - b}")
    premium = sheet[f"B{5 + len(RESEARCH['rows'])}"].value
    a, b = RESEARCH["rows"][0][1:]
    if not isinstance(premium, (int, float)) or abs(premium - (b - a) / a) > 1e-9:
        problems.append(f"premium={premium!r}")
    with zipfile.ZipFile(path) as z:
        charts = [n for n in z.namelist() if n.startswith("xl/charts/chart")]
        chart_xml = z.read(charts[0]).decode() if charts else ""
    if "$B$4" not in chart_xml or "$C$4" not in chart_xml:
        problems.append("chart does not plot the price row")
    if not {"Sources", "Recommendation"} <= set(book.sheetnames):
        problems.append(f"sheets {book.sheetnames}")
    # Provenance: every figure in the workbook was on a page this run read.
    seen = " ".join(ctx.get("read_text", [])).replace(",", "")
    unread = [v for _, *vals in RESEARCH["rows"] for v in vals
              if not re.search(rf"(?<![\d.]){re.escape(_fmt(v))}(?![\d])", seen)]
    if unread:
        problems.append(f"figures not read this run: {unread}")
    pdf = root / "Phones.pdf"
    if not pdf.exists():
        problems.append("no PDF")
    return {"pass": not problems, "problems": problems}


def _fmt(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else f"{v:g}"


def pixel_is(dev: Device, step: dict) -> bool:
    """The declared colour at the centre of what was drawn, read from a screenshot on the device."""
    import io
    from PIL import Image

    found = dev._resolve(step["target"], False)
    if isinstance(found, str):
        return False

    async def shot():
        page = await dev.browser._get_page()
        box = await page.locator(f'[data-ocade-ref="{found[0]}"]').bounding_box()
        return box, await page.screenshot(type="png")
    box, png = dev.browser.run(shot(), timeout=30)
    fx = (step["x"] + step.get("toX", step["x"])) / 2
    fy = (step["y"] + step.get("toY", step["y"])) / 2
    pixel = Image.open(io.BytesIO(png)).convert("RGB").getpixel((int(box["x"] + fx * box["width"]),
                                                                  int(box["y"] + fy * box["height"])))
    want = tuple(int(step["expect"][i:i + 2], 16) for i in (1, 3, 5))
    return all(abs(a - b) <= 24 for a, b in zip(pixel, want))


def oracle_photo(root: Path, _ctx) -> dict:
    """The exported file itself: a real PNG, 800x600, with each declared colour where it was drawn."""
    from PIL import Image
    files = sorted((root / "Downloads").glob("*.png")) if (root / "Downloads").exists() else []
    if not files or files[0].read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
        return {"pass": False, "why": "no PNG"}
    image = Image.open(files[0]).convert("RGB")
    checks = [((0.1, 0.1), "#0b1d51")] + [(((x + tx) / 2, (y + ty) / 2), c) for _, (x, y, tx, ty), c in ROCKET]
    wrong = []
    for (fx, fy), colour in checks:
        got = image.getpixel((int(fx * image.width), int(fy * image.height)))
        want = tuple(int(colour[i:i + 2], 16) for i in (1, 3, 5))
        if any(abs(a - b) > 24 for a, b in zip(got, want)):
            wrong.append((fx, fy, colour, got))
    return {"pass": image.size == (800, 600) and not wrong, "size": image.size, "wrong": wrong,
            "files": len(files)}


def oracle_form(_root: Path, ctx) -> dict:
    site: Site = ctx["site"]
    receipt = _root / "Downloads/receipt-0.txt"
    subs = site.submissions
    ok = (len(subs) == 1 and subs[0]["total"] == Site.expected_total() and subs[0]["plan"] == "Express"
          and subs[0]["file"].startswith("notes.txt:Deliver") and receipt.exists()
          and f"total={Site.expected_total()}" in receipt.read_text())
    return {"pass": ok, "submissions": len(subs), "duplicated": len(subs) > 1}


# -- the five architectures + the current baseline ---------------------------------------

def phases(task: str, ctx) -> tuple[list[dict], list[dict]]:
    """(reads the planner must see before it can write the rest, the rest)."""
    if task == "doc":
        return [], doc_steps()
    if task == "sheet":
        return research_reads(), sheet_steps()
    if task == "photo":
        return [{"action": "open", "url": PAINT}], photo_steps()
    return form_reads(ctx["site"]), form_steps()


def remember_reads(ctx, results: list[dict], _left=None):
    for r in results:
        ctx.setdefault("read_text", []).append(json.dumps(r.get("found") or r.get("observation", {}).get("text", "")))


def baseline(dev: Device, meter: Meter, task: str, ctx, sequences: bool) -> None:
    """Today's loop: the planner sees each result and writes the next step. A browser step
    names a ref from an observation the planner saw, so each one costs a call. With
    `sequences`, steps that need no fresh observation ride together (MAX_SEQUENCE 12)."""
    reads, rest = phases(task, ctx)
    meter.plan("start_task", {"title": task})
    pending: list[dict] = []

    def flush():
        while pending:
            batch = pending[:12] if sequences else pending[:1]
            del pending[:len(batch)]
            for attempt in range(4):
                meter.plan("next step(s)" if not attempt else "look again", batch)
                results, _ = run_recovering(dev, meter, batch, baseline_recover, resolve=True)
                remember_reads(ctx, results)
                meter.history += sum(min(len(json.dumps(r)), 4000) for r in results)
                # A field the page has not shown yet: the model sees that and asks again.
                if not (results and "elements match" in str(results[-1].get("summary"))):
                    break
                dev.exchange([{"action": "wait", "seconds": 1}])

    for step in reads + rest:
        if "target" in step:
            # The model reads the latest observation and picks the ref: its own call.
            flush()
            pending.append(step)
            flush()
        else:
            pending.append(step)
    flush()
    meter.plan("finish_task", {"outcome": "completed"})


def baseline_recover(dev, meter, step, steps_left):
    """Unknown outcome: the product requires a read before anything is redone (VER rules):
    the planner asks for a read, sees it, and redoes the step only if its effect is missing."""
    meter.plan("unknown outcome: read back", {"read": step["action"]})
    dev.meter.exchanges += 1  # the read is its own exchange
    landed = postcondition(dev, step) is True
    meter.plan("continue after read", {"landed": landed})
    return steps_left if landed else [step] + steps_left


def run_recovering(dev, meter, steps, recover, resolve, ready=False) -> tuple[list[dict], list[dict]]:
    """Run steps; on a crash after a committed effect, the architecture's own recovery decides
    what to run next. Returns (results, the steps not done: the failed one first)."""
    results, todo = [], list(steps)
    while todo:
        try:
            out = dev.exchange(todo, resolve=resolve, ready=ready)
            results += out
            if out and out[-1].get("status") != "done":
                return results, todo[len(out) - 1:]
            todo = todo[len(out):]
        except Crash as crash:
            # The crashed exchange's results never arrived: that step's outcome is unknown.
            step, todo = todo[crash.index], todo[crash.index + 1:]
            todo = recover(dev, meter, step, todo)
    return results, []


def compiled_program(dev: Device, meter: Meter, task: str, ctx) -> None:
    """A: the planner compiles the task once into a typed program (reads, then a synthesis
    call only where data from the reads is needed); the device runs it in one exchange with
    local semantic resolution and per-effect assertions; exceptions go back to the planner."""
    reads, rest = phases(task, ctx)
    if reads:
        meter.plan("compile reads", reads)
        remember_reads(ctx, *run_recovering(dev, meter, reads, program_recover, resolve=True))
        meter.history += sum(len(t) for t in ctx.get("read_text", []))
    meter.plan("compile program" if not reads else "synthesis + program", rest)
    run_program(dev, meter, rest)


def run_program(dev: Device, meter: Meter, steps: list[dict]) -> None:
    """Run a compiled program; a failed step is an exception the planner answers (here: wait
    and resume at that step), at most three times."""
    todo = list(steps)
    for _ in range(4):
        results, todo = run_recovering(dev, meter, todo, program_recover, resolve=True)
        if not todo:
            return
        meter.plan("exception", {"step": todo[0]["action"], "error": results[-1].get("summary")})
        dev.exchange([{"action": "wait", "seconds": 1}])


def program_recover(dev, meter, step, steps_left):
    """A/C/D journal: the step with an unknown outcome is checked against its own assertion
    (postcondition) on the device; satisfied, it is not run again. No planner call."""
    if postcondition(dev, step) is True:
        return steps_left
    return [step] + steps_left


def postcondition(dev: Device, step: dict) -> bool | None:
    """Whether one step's effect is already there (None: nothing observable says), read from the
    device the same way for every design; the reading time counts as local work."""
    started = time.perf_counter()
    try:
        return _postcondition(dev, step)
    finally:
        dev.meter.check_ms += (time.perf_counter() - started) * 1000


def _postcondition(dev: Device, step: dict) -> bool | None:
    kind = step["action"]
    if dev.cancel.is_set():
        raise Stopped()
    if kind in BROWSER and dev.browser:
        # A page can confirm a submission a moment after the click returned: that one is read
        # until the page settles (bounded). Field values and pixels are read once.
        deadline = time.monotonic() + (2 if kind == "click" else 0)
        while not dev.cancel.is_set():
            shown = page_shows(dev, step)
            if shown is not False or time.monotonic() > deadline:
                return shown
            time.sleep(0.2)
        raise Stopped()
    if kind == "doc_edit":
        text = dev.pc.run({"action": "file_extract", "path": step["path"]}).get("content", "")
        return all(op["text"] in text for op in step["ops"] if op["op"] == "append")
    if kind in ("pdf_export", "file_write"):
        return (dev.root / step["path"]).exists()
    if kind == "sheet_edit":
        return sheet_holds(dev.root / step["path"], step)
    return None


def page_shows(dev: Device, step: dict) -> bool | None:
    kind = step["action"]
    if kind == "download":
        return any((dev.root / "Downloads").glob("*.*"))
    if kind in ("click_at", "drag_at") and step.get("expect"):
        return pixel_is(dev, step)
    if kind == "click" and step["target"]["name"] == "Send order":
        found = dev.browser.run(dev.browser.act({"action": "find_text", "text": "Received"}), timeout=30)
        return bool(found.get("found"))
    if kind in ("type", "select", "upload"):
        obs = dev.browser.run(dev.browser.act({"action": "observe"}), timeout=30)["observation"]
        want = step.get("text") or step.get("option") or step.get("path")
        name = step["target"]["name"].lower()
        return any(name in e["name"].lower() and str(want) in str(e.get("value", "")) for e in obs["elements"])
    return None


def reactive_controller(dev: Device, meter: Meter, task: str, ctx) -> None:
    """B: the planner states goals; audited local controllers act and wait on the page's own
    state (event-driven readiness) rather than asking the planner after each change. Every
    goal is re-evaluated after each effect; a goal that stays unmet escalates."""
    reads, rest = phases(task, ctx)
    if reads:
        meter.plan("goals: facts to read", reads)
        remember_reads(ctx, *run_recovering(dev, meter, reads, goal_recover, resolve=True, ready=True))
        meter.history += sum(len(t) for t in ctx.get("read_text", []))
    meter.plan("goals + content", rest)
    # One goal per exchange: each controller acts, then the goal predicate is read back.
    for step in rest:
        _, left = run_recovering(dev, meter, [step], goal_recover, resolve=True, ready=True)
        if left:
            meter.plan("goal unmet: escalate", {"goal": step["action"]})
            run_recovering(dev, meter, left, goal_recover, resolve=True, ready=True)


def goal_recover(dev, meter, step, steps_left):
    return steps_left if postcondition(dev, step) is True else [step] + steps_left


SKILLS: dict[str, list[dict]] = {}


def skill_replay(dev: Device, meter: Meter, task: str, ctx) -> None:
    """C: a qualified, versioned procedure. Cold: authored like A, then qualified (oracle) and
    stored. Warm: the planner only fills its parameters; the device replays it."""
    reads, rest = phases(task, ctx)
    if task not in SKILLS:
        compiled_program(dev, meter, task, ctx)
        ctx["cold"] = True
        return
    if reads:
        meter.plan("select skill + params (reads)", {"skill": task})
        remember_reads(ctx, *run_recovering(dev, meter, reads, program_recover, resolve=True))
    if task != "form":  # the form skill computes its total locally from the order table
        meter.plan("fill skill parameters", rest)
    run_program(dev, meter, rest)


def device_actors(dev: Device, meter: Meter, task: str, ctx) -> None:
    """D: a global planner hands bounded sub-goals to device actors; each actor's hot loop is
    a LOCAL action policy. No licensed local multimodal policy model is available here, so
    the policy is a deterministic stand-in: local inference latency/accuracy is NOT measured."""
    reads, rest = phases(task, ctx)
    meter.plan("global decomposition", {"subgoals": ["browser", "files"]})
    if reads:
        remember_reads(ctx, *run_recovering(dev, meter, reads, program_recover, resolve=True, ready=True))
        meter.history += sum(len(t) for t in ctx.get("read_text", []))
        meter.plan("actor escalation: content from reads", rest)
    browser = [s for s in rest if s["action"] in BROWSER]
    files = [s for s in rest if s["action"] not in BROWSER]
    if task == "form":  # the form needs its file first, then the browser actor
        run_recovering(dev, meter, files[:1], program_recover, resolve=True)
        run_recovering(dev, meter, browser, program_recover, resolve=True, ready=True)
        run_recovering(dev, meter, files[1:], program_recover, resolve=True)
    else:
        if task == "doc":
            meter.plan("actor escalation: document content", rest)
        run_recovering(dev, meter, browser, program_recover, resolve=True, ready=True)
        run_recovering(dev, meter, files, program_recover, resolve=True)
    ctx["local_policy_calls"] = len(rest)


def reconcile(dev: Device, meter: Meter, task: str, ctx) -> None:
    """E (Claude's): desired-state reconciliation. The planner declares the outcome once (the
    artifact's content and acceptance, or the end state of a page); the device observes,
    diffs, applies only what is missing, re-observes, and converges. There is no instruction
    pointer: resuming after a crash, a STOP or a user's edit is the same diff again, so an
    effect that already landed is never repeated and content it does not own is never
    removed. Remote calls happen for content and for a diff it cannot close."""
    reads, rest = phases(task, ctx)
    if reads:
        meter.plan("declare facts needed", reads)
        remember_reads(ctx, *run_recovering(dev, meter, reads, lambda d, m, s, left: left, resolve=True,
                                           ready=True))
        meter.history += sum(len(t) for t in ctx.get("read_text", []))
    if task == "doc":
        desired = meter.plan("declare outcome", doc_desired())
        for _ in range(3):  # bounded convergence
            try:
                diff = doc_diff(dev, desired)
                if not diff:
                    return
                dev.exchange(diff, resolve=True, ready=True)
            except Crash:
                continue  # resume = observe and diff again
        return
    meter.plan("declare outcome", rest)
    # Reads are how the outcome is checked, not part of it: taken once, after convergence.
    effects = [s for s in rest if s["action"] not in READS]
    for _ in range(3):
        try:
            todo = outstanding(dev, effects)
            if not todo:
                break
            dev.exchange(todo, resolve=True, ready=True)
        except Crash:
            continue
    dev.exchange([s for s in rest if s["action"] in READS], resolve=True)


def outstanding(dev: Device, effects: list[dict]) -> list[dict]:
    """E's diff over an ordered outcome: a later fact that already holds means everything it
    depends on happened, so only what comes after the latest holding fact is checked and run."""
    for index in range(len(effects) - 1, -1, -1):
        if postcondition(dev, effects[index]) is True:
            return [s for s in effects[index + 1:] if postcondition(dev, s) is not True]
    return list(effects)


def doc_diff(dev: Device, desired: dict) -> list[dict]:
    """The effects that close the gap between the saved document and the desired one."""
    want = desired["document"]
    path = dev.root / want["path"]
    have = dev.pc.run({"action": "file_extract", "path": want["path"]}).get("content", "") if path.exists() else ""
    missing = [{"op": "append", "text": text, "style": style} for style, text in want["blocks"]
               if text not in have]
    steps = []
    if missing:
        steps.append({"action": "doc_edit", "path": want["path"], "ops": missing + [{"op": "bold", "find": want["bold"]}]})
    elif not bold_in(path, want["bold"]):
        steps.append({"action": "doc_edit", "path": want["path"], "ops": [{"op": "bold", "find": want["bold"]}]})
    pdf = desired["pdf"]
    if steps or not (dev.root / pdf["path"]).exists():
        if (dev.root / pdf["path"]).exists():  # stale against the document: a fresh name, never over it
            pdf = {**pdf, "path": pdf["path"].replace(".pdf", f"-{int(time.time() * 1000)}.pdf")}
        steps += [{"action": "file_extract", "path": want["path"]},
                  {"action": "pdf_export", "from": pdf["from"], "path": pdf["path"]},
                  {"action": "file_extract", "path": pdf["path"]}]
    return steps


def sheet_holds(path: Path, step: dict) -> bool:
    """Every cell and sheet this edit sets is already so in the saved workbook."""
    from openpyxl import load_workbook
    if not path.exists():
        return False
    book = load_workbook(str(path))
    sheet = book[step["sheet"]] if step.get("sheet") in book.sheetnames else (
        None if step.get("sheet") else book.worksheets[0])
    for op in step["ops"]:
        if op["op"] == "sheet_add" and op["name"] not in book.sheetnames:
            return False
        if op["op"] == "set" and (sheet is None or sheet[op["cell"]].value != op["value"]):
            return False
        if op["op"] == "chart":
            with zipfile.ZipFile(path) as archive:
                if not any(n.startswith("xl/charts/") for n in archive.namelist()):
                    return False
    return True


def bold_in(path: Path, text: str) -> bool:
    from docx import Document
    return any(r.bold and text in r.text for p in Document(str(path)).paragraphs for r in p.runs)


ARCHITECTURES = {
    "baseline_per_step": lambda d, m, t, c: baseline(d, m, t, c, sequences=False),
    "baseline_sequences": lambda d, m, t, c: baseline(d, m, t, c, sequences=True),
    "A_compiled_program": compiled_program,
    "B_reactive_controller": reactive_controller,
    "C_skill_replay": skill_replay,
    "D_device_actors": device_actors,
    "E_desired_state": reconcile,
}
ORACLES = {"doc": oracle_doc, "sheet": oracle_sheet, "form": oracle_form, "photo": oracle_photo}


# -- runner ------------------------------------------------------------------------------

def run_one(arch: str, task: str, fault: str | None, seed: int) -> dict:
    rng = random.Random(seed)
    root = Path(tempfile.mkdtemp(prefix=f"bench-{arch}-{task}-"))
    meter = Meter()
    dev = Device(root, meter)
    ctx: dict = {}
    site = ctx["site"] = Site() if task == "form" else None
    effects = sum(1 for step in sum(phases(task, ctx), []) if step["action"] in CHANGES)
    if fault == "crash":  # after any one of the task's effects, the same one for every design per seed
        dev.crash_after = rng.randint(1, effects)
    crash_point = dev.crash_after
    if fault == "user_edit":
        dev.user_edit_after = 1
    if fault == "planner_503":
        meter.down_at = 1
    stop_latency = None
    timer = None
    if fault == "stop":
        delay = rng.uniform(0.05, 0.6)

        def stop():
            dev.stopped_at = time.perf_counter()
            dev.cancel.set()
        timer = threading.Timer(delay, stop)
    started = time.perf_counter()
    error = None
    try:
        if timer:
            timer.start()
        while True:
            try:
                ARCHITECTURES[arch](dev, meter, task, ctx)
                break
            except PlannerDown:
                continue  # paused, checkpoint kept; asked again (the product's provider-wait path)
            except Stopped:
                break
    except Exception as e:  # a prototype failing is a result, not a harness crash
        error = f"{type(e).__name__}: {str(e)[:200]}"
    wall = time.perf_counter() - started
    if dev.stopped_at is not None:
        stop_latency = round((time.perf_counter() - dev.stopped_at) * 1000, 1) if error is None else None
        late = [a for a in meter.actions if a["t"] > dev.stopped_at and a["status"] == "done"
                and a["action"] in CHANGES]
        verdict = {"pass": not late, "stopped": True, "effects_after_stop": len(late)}
    else:
        try:
            verdict = ORACLES[task](root, ctx)
        except Exception as e:
            verdict = {"pass": False, "why": f"oracle error {e}"}
    if arch == "C_skill_replay" and ctx.get("cold") and verdict.get("pass"):
        SKILLS[task] = ["qualified"]  # stored only once its oracle passed
    dev.close()
    if site:
        site.close()
    shutil.rmtree(root, True)
    return {"arch": arch, "task": task, "fault": fault, "seed": seed, "wall_s": round(wall, 3),
            "crash_point": crash_point,
            "error": error, "stop_ms": stop_latency, "cold": bool(ctx.get("cold")),
            "local_policy_calls": ctx.get("local_policy_calls"), **meter.summary(), "verdict": verdict}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--tasks", default="doc,sheet,form")
    parser.add_argument("--arch", default=",".join(ARCHITECTURES))
    parser.add_argument("--faults", default="none,crash,user_edit,planner_503,stop")
    parser.add_argument("--out", default=str(HERE / "results.json"))
    args = parser.parse_args()
    # The code under test is what was imported now, at start: recorded now, not after the run.
    commit = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
    rows = []
    for task in args.tasks.split(","):
        for fault in args.faults.split(","):
            if fault == "user_edit" and task != "doc":
                continue
            for seed in range(args.runs):
                order = args.arch.split(",")
                random.Random(seed).shuffle(order)  # randomized order per seed
                for arch in order:
                    row = run_one(arch, task, None if fault == "none" else fault, seed)
                    rows.append(row)
                    print(json.dumps({k: row[k] for k in ("arch", "task", "fault", "planner_calls", "exchanges",
                                                          "local_s", "modeled_s", "error")}
                                     | {"pass": row["verdict"].get("pass")}), flush=True)
    env = {"python": platform.python_version(), "platform": platform.platform(),
           "commit": commit,
           "planner_s_modeled": PLANNER_S, "exchange_s_modeled": EXCHANGE_S, "fixed_context_chars": FIXED_CONTEXT}
    Path(args.out).write_text(json.dumps({"env": env, "rows": rows}, indent=1))
    print(json.dumps(aggregate(rows), indent=1))


def aggregate(rows: list[dict]) -> dict:
    out = {}
    for row in rows:
        key = f"{row['task']}|{row['fault'] or 'none'}|{row['arch']}"
        out.setdefault(key, []).append(row)
    table = {}
    for key, group in out.items():
        def p(values, q):
            values = sorted(values)
            return values[min(len(values) - 1, int(round(q * (len(values) - 1))))]
        passed = [g for g in group if g["verdict"].get("pass")]
        table[key] = {"n": len(group), "pass": len(passed), "errors": sum(1 for g in group if g["error"]),
                      "calls_median": statistics.median(g["planner_calls"] for g in group),
                      "exchanges_median": statistics.median(g["exchanges"] for g in group),
                      "local_s_p50": p([g["local_s"] for g in group], 0.5),
                      "local_s_p95": p([g["local_s"] for g in group], 0.95),
                      "modeled_s_p50": p([g["modeled_s"] for g in group], 0.5),
                      "prompt_chars_median": statistics.median(g["prompt_chars"] for g in group),
                      "duplicated": sum(1 for g in group if g["verdict"].get("duplicated")),
                      "stop_ms_max": max((g["stop_ms"] or 0) for g in group) if group[0]["fault"] == "stop" else None}
    return table


if __name__ == "__main__":
    main()
