"""Acceptance run: enhance a photograph to 3840x2160 in a real third-party web editor (Photopea),
operated only through OCADE's gateway and web worker, then verify the export independently.

    OCADE_EVIDENCE_DIR=... python -m tests.qualify_photo_web <source.jpg>   (needs a display + network)

Not a unit test. The step sequence is this run's script (a stand-in for planner turns); no
part of it lives in production routing. Evidence: per-step receipts, screenshots, output hash.
"""

import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

import anyio
from PIL import Image, ImageFilter, ImageStat

from ocade_agent.gateway import Gateway
from tests.test_web import intent

SITE = "www.photopea.com"


def menu(top, *items):
    steps = [("web.click", {"selector": f'.topbar button:text-is("{top}")'})]
    return steps + [("web.click", {"selector": f'.enab .label:text-is("{item}")'}) for item in items]


def field(window, index, value):
    return ("web.fill", {"selector": f".window.{window} input[type=text]:visible >> nth={index}", "value": value})


def ok(window):
    return ("web.click", {"selector": f'.window.{window} button:text-is("OK")'})


STEPS = [
    ("web.click", {"selector": 'button:has-text("Start using Photopea") >> nth=0'}),
    ("web.upload", {"selector": "input[type=file]", "path": "source.jpg"}),
    ("shot", "01-opened"),
    *menu("Image", "Canvas Size..."),
    field("csize", 1, "1080"),
    ok("csize"),
    *menu("Image", "Image Size..."),
    ("web.select", {"selector": ".window.isize select >> nth=2", "option": "Bicubic Sharper"}),
    field("isize", 0, "3840"),  # height follows at 16:9 (proportions linked)
    ("shot", "02-image-size"),
    ok("isize"),
    *menu("Filter", "Sharpen", "Unsharp Mask..."),
    field("afw_UnsM", 0, "80"),
    field("afw_UnsM", 1, "1.2"),
    ok("afw_UnsM"),
    *menu("Image", "Adjustments", "Vibrance..."),
    field("afw_vibA", 0, "40"),
    field("afw_vibA", 1, "10"),
    ("shot", "03-vibrance"),
    ok("afw_vibA"),
    ("shot", "04-edited"),
    *menu("File", "Export as", "JPG"),
    ("shot", "05-export-dialog"),
    ("web.download", {"selector": '.window.saveforweb button:text-is("Save")', "output": "OCADE output/photo-4k.jpg"}),
]


async def run(workspace: Path, evidence: Path) -> list[dict]:
    log = []
    async with Gateway(str(workspace), home=tempfile.mkdtemp()) as gateway:
        call = lambda op, args: gateway.run(intent(op, args), gateway.epoch)  # noqa: E731
        opened = await call("web.open", {"url": f"https://{SITE}/"})
        log.append({"op": "web.open", "status": opened["status"], "error": opened.get("errorCode")})
        if opened["status"] != "observed":
            return log
        page = opened["evidence"]["page"]
        for op, args in STEPS:
            if op == "shot":
                name = f"IMG-photopea-{args}.png"
                shot = await call("web.screenshot", {"page": page, "output": f"OCADE output/{name}"})
                if shot["status"] == "observed":
                    shutil.copy(workspace / "OCADE output" / name, evidence / name)
                continue
            result = await call(op, {"page": page, **args})
            log.append({"op": op, "args": args, "status": result["status"], "error": result.get("errorCode"),
                        "evidence": {k: v for k, v in (result.get("evidence") or {}).items() if k in ("matches", "sha256", "bytes", "magic", "attached", "url", "title")}})
            print(json.dumps(log[-1])[:300], flush=True)
            # A read-back that does not match is a failed step, whatever the status says.
            if result["status"] != "observed" or (result.get("evidence") or {}).get("matches") is False and op != "web.upload":
                break
    return log


def verify(source: Path, output: Path) -> dict:
    """Independent checks on the saved export, against the untouched source."""
    edited = Image.open(output)
    reference = Image.open(source).convert("RGB")
    top = (reference.height - 1080) // 2
    plain = reference.crop((0, top, 1920, top + 1080)).resize((3840, 2160), Image.BICUBIC)
    rgb = edited.convert("RGB")
    sharp = lambda im: ImageStat.Stat(im.convert("L").filter(ImageFilter.FIND_EDGES)).var[0]  # noqa: E731
    saturation = lambda im: ImageStat.Stat(im.convert("HSV")).mean[1]  # noqa: E731
    return {
        "format": edited.format,
        "size": list(edited.size),
        "is3840x2160": edited.size == (3840, 2160),
        "edgeVarianceEdited": round(sharp(rgb), 1),
        "edgeVariancePlainBicubic": round(sharp(plain), 1),
        "sharperThanPlainUpscale": sharp(rgb) > sharp(plain) * 1.05,
        "saturationEdited": round(saturation(rgb), 1),
        "saturationPlain": round(saturation(plain), 1),
        "moreSaturated": saturation(rgb) > saturation(plain) + 2,
        "note": "Upscaled 2x from a 1920-wide source: pixel upscale plus sharpening, not recovered native detail.",
    }


def main() -> None:
    source = Path(sys.argv[1])
    evidence = Path(os.environ.get("OCADE_EVIDENCE_DIR", tempfile.mkdtemp()))
    evidence.mkdir(parents=True, exist_ok=True)
    workspace = Path(tempfile.mkdtemp())
    shutil.copy(source, workspace / "source.jpg")
    before = hashlib.sha256((workspace / "source.jpg").read_bytes()).hexdigest()
    log = anyio.run(run, workspace, evidence)
    output = workspace / "OCADE output" / "photo-4k.jpg"
    report = {"steps": log, "sourceSha256": before,
              "sourceUnchanged": hashlib.sha256((workspace / "source.jpg").read_bytes()).hexdigest() == before}
    if output.exists():
        shutil.copy(output, evidence / "IMG-photopea-photo-4k.jpg")
        report |= {"outputSha256": hashlib.sha256(output.read_bytes()).hexdigest(), "verify": verify(workspace / "source.jpg", output)}
    (evidence / "IMG-photopea-report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != "steps"}, indent=2))


if __name__ == "__main__":
    main()
