#!/usr/bin/env python3
"""Owner-directed model comparison (plan.md §19.4): four tasks, one configuration, one machine.

    python tests/jarvis/benchmark.py --configuration a --out <empty dir> [--only calc gimp car advert]

The harness builds each task's inputs, opens the application a task says is already open, and
hands OCADE only the person's request. OCADE (scripts/jarvis-live.mjs: the real authority, the
real companion and the staging model route `ocade-intelligence-benchmark/<configuration>`)
discovers the applications and chooses how to work. Afterwards an independent oracle checks the
files. The application names here are benchmark requirements; none reaches OCADE's product code.

Recorded per task: verdict, oracle detail, OCADE's own timing (first action, model calls, tokens),
wall time, CPU/RAM samples, interventions, timestamped screenshots and the report. Nothing is
graded by the model and no deliverable is created by the harness.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import platform
import random
import shutil
import statistics
import subprocess
import sys
import tempfile
import threading
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SYSTEM = platform.system()  # Windows, Darwin, Linux


def tool(names: list[str], patterns: list[str]) -> str | None:
    """An installed program for harness setup and oracles (never for OCADE)."""
    for name in names:
        if found := shutil.which(name):
            return found
    for pattern in patterns:
        if hits := sorted(glob.glob(pattern)):
            return hits[-1]
    return None


PROGRAMS = os.environ.get("ProgramFiles", r"C:\Program Files")
SOFFICE = tool(["soffice", "libreoffice"], [rf"{PROGRAMS}\LibreOffice\program\soffice.exe",
                                            "/Applications/LibreOffice.app/Contents/MacOS/soffice"])
GIMP = tool(["gimp", "gimp-3.0", "gimp-2.10"], [rf"{PROGRAMS}\GIMP*\bin\gimp-[0-9]*.exe",
                                                "/Applications/GIMP*.app/Contents/MacOS/gimp*"])
BLENDER = tool(["blender"], [rf"{PROGRAMS}\Blender Foundation\Blender*\blender.exe",
                             "/Applications/Blender.app/Contents/MacOS/Blender"])
FFPROBE = tool(["ffprobe"], [])


class Watch:
    """Screenshots every `every` seconds and CPU/RAM samples while a task runs."""

    def __init__(self, folder: Path, every: float = 20):
        self.folder, self.every, self.samples, self.stop = folder, every, [], threading.Event()
        folder.mkdir(parents=True, exist_ok=True)
        self.thread = threading.Thread(target=self.run, daemon=True)

    def shot(self, label: str) -> None:
        try:
            from PIL import ImageGrab

            ImageGrab.grab().save(self.folder / f"{time.strftime('%Y%m%dT%H%M%S')}-{label}.png")
        except Exception as error:  # a headless machine has no screen: say so, once
            (self.folder / "no-screen.txt").write_text(f"{type(error).__name__}: {error}\n")

    def run(self) -> None:
        import psutil

        while not self.stop.wait(self.every):
            memory = psutil.virtual_memory()
            self.samples.append({"cpu": psutil.cpu_percent(), "ramUsedMb": round(memory.used / 2**20)})
            self.shot("during")

    def __enter__(self):
        self.shot("start")
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.stop.set()
        self.thread.join(timeout=5)
        self.shot("final")

    def summary(self) -> dict:
        cpu = [s["cpu"] for s in self.samples] or [0]
        ram = [s["ramUsedMb"] for s in self.samples] or [0]
        return {"cpuMeanPercent": round(statistics.mean(cpu), 1), "cpuMaxPercent": max(cpu),
                "ramMaxUsedMb": max(ram), "samples": len(self.samples)}


def ocade(ws: Path, request: str, report: Path, configuration: str, minutes: int,
          grants=("computer_control", "screen", "apps")) -> tuple[dict, float]:
    command = ["node", "scripts/jarvis-live.mjs", "--workspace", str(ws), "--confirm-effects",
               "--minutes", str(minutes), "--report", str(report)]
    for grant in grants:
        command += ["--grant", grant]
    env = dict(os.environ, OCADE_INTELLIGENCE_FUNCTION=f"ocade-intelligence-benchmark/{configuration}",
               OCADE_LIVE_EMAIL=f"ocade-bench-{configuration}-{SYSTEM.lower()}-{int(time.time())}@example.com")
    started = time.monotonic()
    run = subprocess.run([*command, request], cwd=ROOT, env=env, capture_output=True, text=True,
                         timeout=minutes * 60 + 600)
    (report.parent / f"{report.stem}.log").write_text(run.stdout[-20000:] + "\n--- stderr ---\n" + run.stderr[-20000:])
    live = json.loads(report.read_text()) if report.exists() else {}
    return live, time.monotonic() - started


def files(ws: Path, *suffixes: str) -> list[Path]:
    return sorted(p for p in ws.rglob("*") if p.is_file() and p.suffix.lower() in suffixes)


# --------------------------------------------------------------------------- 1 Calc
def calc(ws: Path, rng: random.Random):
    import openpyxl

    book = openpyxl.Workbook()
    sheet = book.active
    sheet.title = "Budget"
    values = [rng.randint(10, 90) for _ in range(6)]
    for row, value in enumerate(values, 1):
        sheet[f"A{row}"], sheet[f"B{row}"] = f"Item {row}", value
    sheet["A7"], sheet["B7"] = "Item 7", rng.randint(10, 90)
    sheet["A8"], sheet["B8"] = "Total", "=SUM(B1:B7)"
    sheet["A9"], sheet["B9"] = "Share of item 7", "=B7/B8"
    path = ws / f"budget_{rng.randint(100, 999)}.xlsx"
    book.save(path)
    subprocess.Popen([SOFFICE, "--calc", "--norestore", str(path)], stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL)
    time.sleep(25)

    def oracle() -> tuple[bool, str]:
        formulas, cached = openpyxl.load_workbook(path), openpyxl.load_workbook(path, data_only=True)
        f, c = formulas.worksheets[0], cached.worksheets[0]
        total = sum(values) + 128
        ok = (c["B7"].value == 128 and str(f["B8"].value).upper().startswith("=SUM")
              and c["B8"].value == total and abs((c["B9"].value or 0) - 128 / total) < 1e-9
              and all(c[f"B{r}"].value == v for r, v in enumerate(values, 1)))
        return ok, f"B7={c['B7'].value} B8={f['B8'].value}->{c['B8'].value} (want {total}) B9={c['B9'].value}"

    return f"In LibreOffice Calc, set cell B7 of {path.name} to 128, recalculate, save it and check the result.", oracle, 15


# --------------------------------------------------------------------------- 2 GIMP
def xcf(path: Path, layers: list) -> None:
    """A GIMP project (.xcf, uncompressed): (name, RGBA image, visible), top layer first."""
    import struct

    width, height = layers[0][1].size
    u32 = lambda *v: struct.pack(">" + "I" * len(v), *v)
    out = bytearray(b"gimp xcf file\0" + u32(width, height, 0) + u32(17, 1) + b"\0" + u32(0, 0))
    table = len(out)
    out += b"\0" * 4 * (len(layers) + 1) + u32(0)  # layer pointers, end, no channels
    for index, (name, image, visible) in enumerate(layers):
        struct.pack_into(">I", out, table + 4 * index, len(out))
        raw = name.encode() + b"\0"
        out += u32(width, height, 1, len(raw)) + raw
        out += u32(6, 4, 255, 8, 4, int(visible), 15, 8, 0, 0, 0, 0)
        hierarchy = len(out) + 8
        out += u32(hierarchy, 0) + u32(width, height, 4, hierarchy + 20, 0)
        tiles = [(x, y) for y in range(0, height, 64) for x in range(0, width, 64)]
        level = len(out)
        out += u32(width, height) + b"\0" * 4 * len(tiles) + u32(0)
        for number, (x, y) in enumerate(tiles):
            struct.pack_into(">I", out, level + 8 + 4 * number, len(out))
            out += image.crop((x, y, min(x + 64, width), min(y + 64, height))).tobytes()
    path.write_bytes(bytes(out))


def xcf_layers(path: Path) -> dict[str, bool]:
    """Layer name -> visible, read from a GIMP .xcf (enough of the format for this check)."""
    import struct

    data = path.read_bytes()
    version = int(data[10:13]) if data[10:13].isdigit() else 0
    at = 14 + 12 + (4 if version >= 4 else 0)
    while True:  # image properties
        kind, size = struct.unpack(">II", data[at:at + 8])
        at += 8 + size
        if kind == 0:
            break
    wide = version >= 11
    pointers = []
    while True:
        (pointer,) = struct.unpack(">Q" if wide else ">I", data[at:at + (8 if wide else 4)])
        at += 8 if wide else 4
        if not pointer:
            break
        pointers.append(pointer)
    layers = {}
    for pointer in pointers:
        at = pointer + 12
        (length,) = struct.unpack(">I", data[at:at + 4])
        name = data[at + 4:at + 4 + length].rstrip(b"\0").decode("utf-8", "replace")
        at += 4 + length
        visible = True
        while True:
            kind, size = struct.unpack(">II", data[at:at + 8])
            if kind == 8:
                (visible,) = struct.unpack(">I", data[at + 8:at + 12])
            at += 8 + size
            if kind == 0:
                break
        layers[name] = bool(visible)
    return layers


def gimp(ws: Path, rng: random.Random):
    from PIL import Image, ImageDraw

    size = (1200, 800)
    background = Image.new("RGBA", size, (rng.randrange(150, 255), 220, 240, 255))
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((380, 560, 900, 680), fill=(20, 20, 20, 170))
    subject = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(subject).rounded_rectangle((420, 260, 860, 580), 40, fill=(200, 40, 40, 255))
    title = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(title).rectangle((60, 60, 520, 140), fill=(30, 60, 160, 255))
    path = ws / f"poster_{rng.randint(100, 999)}.xcf"
    xcf(path, [("Title", title, True), ("Subject", subject, True), ("Shadow", shadow, True), ("Background", background, True)])
    started = time.time()
    subprocess.Popen([GIMP, str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(40)

    def oracle() -> tuple[bool, str]:
        saved = [p for p in files(ws, ".xcf") if p.stat().st_mtime > started]
        for project in saved:
            layers = xcf_layers(project)
            others = {k: v for k, v in layers.items() if k != "Shadow"}
            if layers.get("Shadow") is False and set(others) == {"Title", "Subject", "Background"} and all(others.values()):
                return True, f"{project.name}: {layers}"
        return False, f"saved projects {[p.name for p in saved]}; layers {[xcf_layers(p) for p in saved]}"

    return (f"{path.name} is open in GIMP. Turn off the layer called Shadow, check that the picture changed, and save the project.",
            oracle, 15)


# --------------------------------------------------------------------------- 3 car
CAR_REQUEST = (
    "Design an original electric sports car. In FreeCAD, build the body-in-white, chassis, body panels, wheels, "
    "suspension, steering and interior to real, consistent dimensions. Bring the same car into Blender with realistic "
    "materials and render at least two cinematic stills. In a spreadsheet, list every component with its dimensions, "
    "material and mass, with live totals, including the overall length, width, height, wheelbase and track. "
    "Check that the dimensions agree across the CAD model, the Blender scene and the spreadsheet. "
    "Keep the FreeCAD, Blender and spreadsheet files editable."
)


def blend_facts(path: Path) -> dict:
    script = ("import bpy,json,mathutils\nm=[o for o in bpy.data.objects if o.type=='MESH']\n"
              "pts=[o.matrix_world@mathutils.Vector(c) for o in m for c in o.bound_box]\n"
              "d=[max(p[i] for p in pts)-min(p[i] for p in pts) for i in range(3)] if pts else [0,0,0]\n"
              "print('FACTS'+json.dumps({'meshes':len(m),'materials':len(bpy.data.materials),"
              "'cameras':len([o for o in bpy.data.objects if o.type=='CAMERA']),"
              "'lights':len([o for o in bpy.data.objects if o.type=='LIGHT']),'size':sorted(d,reverse=True),"
              "'unit':bpy.context.scene.unit_settings.scale_length,'strips':len(bpy.context.scene.sequence_editor.sequences_all) if bpy.context.scene.sequence_editor else 0}))")
    run = subprocess.run([BLENDER, "-b", str(path), "--python-expr", script], capture_output=True, text=True, timeout=300)
    line = next((l for l in run.stdout.splitlines() if l.startswith("FACTS")), None)
    return json.loads(line[5:]) if line else {"error": run.stderr[-300:]}


def sheet_rows(path: Path) -> list[list]:
    import openpyxl

    if path.suffix.lower() == ".ods":
        out = Path(tempfile.mkdtemp())
        subprocess.run([SOFFICE, "--headless", "--convert-to", "xlsx", "--outdir", str(out), str(path)], timeout=180)
        path = out / (path.stem + ".xlsx")
    book = openpyxl.load_workbook(path, data_only=True)
    return [[c for c in row] for sheet in book.worksheets for row in sheet.iter_rows(values_only=True)]


def labelled(rows: list[list], word: str) -> float | None:
    for row in rows:
        if any(isinstance(c, str) and word in c.lower() for c in row):
            numbers = [c for c in row if isinstance(c, (int, float))]
            if numbers:
                return float(numbers[0])
    return None


def car_check(ws: Path) -> tuple[bool, str, dict]:
    from PIL import Image, ImageStat

    cad, blends = files(ws, ".fcstd"), files(ws, ".blend")
    sheets = files(ws, ".xlsx", ".ods")
    renders = [p for p in files(ws, ".png", ".jpg", ".jpeg") if Image.open(p).size[0] >= 1280
               and max(ImageStat.Stat(Image.open(p).convert("L")).stddev) > 10]
    facts: dict = {"cad": [p.name for p in cad], "blend": [p.name for p in blends], "sheets": [p.name for p in sheets],
                   "renders": [p.name for p in renders]}
    if not (cad and blends and sheets):
        return False, json.dumps(facts), facts
    with zipfile.ZipFile(cad[0]) as z:
        facts["cadObjects"] = z.read("Document.xml").decode("utf-8", "replace").count("<Object type=")
    facts["blendFacts"] = blend_facts(blends[0])
    rows = sheet_rows(sheets[0])
    facts["sheet"] = {k: labelled(rows, k) for k in ("length", "width", "height", "wheelbase", "track", "mass")}
    facts["sheetRows"] = len(rows)
    size = facts["blendFacts"].get("size") or [0]
    length_m = size[0] * (facts["blendFacts"].get("unit") or 1)
    sheet_length = facts["sheet"]["length"] or 0
    sheet_length_m = sheet_length / 1000 if sheet_length > 50 else sheet_length
    facts["lengthAgreement"] = round(abs(length_m - sheet_length_m) / sheet_length_m, 3) if sheet_length_m else None
    wheelbase = facts["sheet"]["wheelbase"] or 0
    ok = (facts["cadObjects"] >= 8 and facts["blendFacts"].get("meshes", 0) >= 8
          and facts["blendFacts"].get("materials", 0) >= 3 and facts["blendFacts"].get("cameras", 0) >= 1
          and len(renders) >= 2 and facts["sheetRows"] >= 9 and facts["lengthAgreement"] is not None
          and facts["lengthAgreement"] <= 0.05 and wheelbase > 0)
    return ok, json.dumps(facts)[:1500], facts


def car(ws: Path, rng: random.Random):
    def oracle():
        ok, detail, _ = car_check(ws)
        return ok, detail

    return CAR_REQUEST, oracle, 120


# --------------------------------------------------------------------------- 4 advert
def media(path: Path) -> dict:
    run = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,avg_frame_rate",
                          "-of", "json", str(path)], capture_output=True, text=True, timeout=120)
    info = json.loads(run.stdout or "{}")
    video = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
    return {"duration": float(info.get("format", {}).get("duration") or 0), "width": video.get("width", 0),
            "height": video.get("height", 0), "audio": any(s.get("codec_type") == "audio" for s in info.get("streams", []))}


ADVERT_REQUEST = (
    "Using the electric sports car in this folder (the FreeCAD, Blender and spreadsheet files), make a premium 60-second "
    "commercial: animate the actual car with realistic movement, cinematic camera moves, professional colour grading, "
    "transitions and motion blur, with music and original or properly licensed engine, tyre, wind, mechanical and "
    "ambient sound effects. Edit it in Blender's Video Sequencer and Kdenlive (use CapCut too if this computer has it). "
    "Deliver a horizontal 60-second video, a vertical social version, a promotional poster made in GIMP, and every "
    "editable project file."
)


def advert_check(ws: Path, since: float) -> tuple[bool, dict]:
    videos = [(p, media(p)) for p in files(ws, ".mp4", ".mov", ".mkv") if p.stat().st_mtime > since]
    horizontal = [p.name for p, m in videos if 58 <= m["duration"] <= 62 and m["width"] > m["height"] and m["audio"]]
    vertical = [p.name for p, m in videos if m["height"] > m["width"] and m["audio"] and m["duration"] >= 10]
    posters = [p.name for p in files(ws, ".png", ".jpg", ".jpeg") if p.stat().st_mtime > since
               and max(__import__("PIL.Image", fromlist=["Image"]).open(p).size) >= 1000]
    projects = [p.name for p in files(ws, ".kdenlive", ".otio", ".xcf") if p.stat().st_mtime > since]
    facts = {"videos": {p.name: m for p, m in videos}, "horizontal": horizontal, "vertical": vertical,
             "posters": posters, "projects": projects}
    ok = bool(horizontal and vertical and posters and any(n.endswith(".xcf") for n in projects)
              and any(n.endswith((".kdenlive", ".otio")) for n in projects))
    return ok, facts


def advert(ws: Path, rng: random.Random, car_ws: Path | None = None):
    if car_ws and car_ws.exists():
        for item in car_ws.rglob("*"):
            if item.is_file():
                target = ws / item.relative_to(car_ws)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, target)
    started = time.time()

    def oracle():
        ok, facts = advert_check(ws, started)
        return ok, json.dumps(facts)[:1500]

    return ADVERT_REQUEST, oracle, 150


def crash_watch(stop: threading.Event, record: dict, after: float = 20) -> None:
    """Kill the first Blender process that has run `after` seconds: the injected application crash."""
    import psutil

    while not stop.wait(2):
        for process in psutil.process_iter(["name", "create_time"]):
            name = (process.info["name"] or "").lower()
            if "blender" in name and time.time() - process.info["create_time"] > after:
                try:
                    process.kill()
                    record.update(killed=name, at=time.strftime("%Y-%m-%dT%H:%M:%S"))
                except psutil.Error:
                    continue
                return


TASKS = {"calc": calc, "gimp": gimp, "car": car, "advert": advert}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--configuration", choices=["a", "b", "c"], required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--only", nargs="*", choices=list(TASKS), default=list(TASKS))
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    base = Path(tempfile.mkdtemp(prefix="ocade-bench-"))
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    summary = {"configuration": args.configuration, "system": SYSTEM, "machine": platform.platform(), "commit": commit,
               "programs": {"soffice": SOFFICE, "gimp": GIMP, "blender": BLENDER, "ffprobe": FFPROBE}, "results": []}
    car_ws = None
    for name in args.only:
        ws = base / name
        ws.mkdir()
        rng = random.Random(f"{args.seed}:{name}")
        record: dict = {"task": name, "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        try:
            request, oracle, minutes = advert(ws, rng, car_ws) if name == "advert" else TASKS[name](ws, rng)
            record["request"] = request
            with Watch(out / name / "screenshots") as watch:
                live, wall = ocade(ws, request, out / name / "report.json", args.configuration, minutes)
            if name == "advert" and live.get("status") == "done":
                rows = sheet_rows(files(ws, ".xlsx", ".ods")[0]) if files(ws, ".xlsx", ".ods") else []
                old = labelled(rows, "wheelbase")
                new = round((old or 2700) + 150)
                change = (f"Change the car's wheelbase to {new} mm and make the suspension 15% stiffer with 10 mm less "
                          "ride height. Update every dependent file: the CAD model, the Blender scene, the spreadsheet, "
                          "the renders, both videos, the poster and the editable projects.")
                stop, crash = threading.Event(), {}
                threading.Thread(target=crash_watch, args=(stop, crash), daemon=True).start()
                changed_at = time.time()
                with Watch(out / name / "screenshots-change") as watch2:
                    live2, wall2 = ocade(ws, change, out / name / "report-change.json", args.configuration, 120)
                stop.set()
                after = labelled(sheet_rows(files(ws, ".xlsx", ".ods")[0]), "wheelbase") if files(ws, ".xlsx", ".ods") else None
                ok2, facts2 = advert_check(ws, changed_at)
                record["change"] = {"request": change, "status": live2.get("status"), "wallSeconds": round(wall2, 1),
                                    "wheelbaseBefore": old, "wheelbaseAfter": after, "artifactsRebuilt": facts2,
                                    "crash": crash, "recovered": bool(crash) and live2.get("status") == "done",
                                    "pass": ok2 and after == new and live2.get("status") == "done",
                                    "timing": live2.get("timing"), "resources": watch2.summary()}
            ok, detail = oracle()
            timing = live.get("timing") or {}
            record.update(
                pass_=bool(ok and live.get("status") == "done" and record.get("change", {}).get("pass", True)),
                oraclePassed=ok, detail=detail, status=live.get("status"), blocker=(live.get("blocker") or "")[:400],
                wallSeconds=round(wall, 1), timing=timing, interventions=len(live.get("confirmations") or []),
                steps=len(live.get("decisions") or []), resources=watch.summary(),
                operations=[(d.get("intent") or {}).get("operation") for d in live.get("decisions") or []])
            if name == "car":
                car_ws = ws
        except Exception as error:
            record.update(pass_=False, status="harness_error", detail=f"{type(error).__name__}: {error}"[:600])
        record["pass"] = record.pop("pass_", False)
        summary["results"].append(record)
        (out / "summary.json").write_text(json.dumps(summary, indent=2, default=str))
        for artifact in ws.rglob("*"):  # editable outputs, bounded per file for artifact storage
            if artifact.is_file() and artifact.stat().st_size < 300 * 2**20:
                target = out / name / "workspace" / artifact.relative_to(ws)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(artifact, target)
        print(f"{name}: {'PASS' if record['pass'] else 'FAIL'} status={record.get('status')} {str(record.get('detail'))[:300]}",
              flush=True)
    print(json.dumps({r["task"]: r["pass"] for r in summary["results"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
