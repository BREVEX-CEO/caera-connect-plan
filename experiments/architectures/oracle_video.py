"""
Independent check of an edited video: reads only the files the run left, never its claims.

python3 oracle_video.py <workspace> [<contact-sheet.png>]
Checks: container/duration/resolution/fps/codecs; which source clips appear and in what order
(1 frame per second matched to the source clips' frames); a title and a closing card (plain
background with text); captions (a subtitle stream, a sidecar .srt/.vtt, or burned-in text found by OCR)
and that caption words come from the clips' own captions; loudness (EBU R128) and true peak;
scene cuts; an editable project file that names the clips.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ws = Path(sys.argv[1])
out = ws / "AI_Technology.mp4"
clips = sorted((ws / "clips").glob("*.mp4"))


def probe(path: Path) -> dict:
    raw = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate",
                          "-of", "json", str(path)], capture_output=True, text=True).stdout
    return json.loads(raw)


def frames(path: Path, every: float, size=(32, 18)) -> list[list[int]]:
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vf",
                        f"fps=1/{every},scale={size[0]}:{size[1]},format=gray", f"{tmp}/f%05d.png"],
                       timeout=600)
        return [list(Image.open(p).get_flattened_data()) for p in sorted(Path(tmp).glob("f*.png"))]


def distance(a: list[int], b: list[int]) -> float:
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def card(frame: list[int]) -> bool:
    """A plain background with a few lines of text, not footage: almost every pixel near one value."""
    mean = sum(frame) / len(frame)
    return sum(abs(v - mean) < 24 for v in frame) / len(frame) > 0.9


def words(text: str) -> set[str]:
    return set(re.findall(r"[a-z]{4,}", text.lower()))


def ocr_frames(path: Path, every: float, crop: str | None = None, start: float = 0, length: float | None = None) -> str:
    with tempfile.TemporaryDirectory() as tmp:
        window = ["-ss", str(start)] + (["-t", str(length)] if length else [])
        subprocess.run(["ffmpeg", "-v", "error", *window, "-i", str(path), "-vf",
                        f"fps=1/{every}" + (f",{crop}" if crop else ""), f"{tmp}/c%04d.png"], timeout=600)
        return " ".join(subprocess.run(["tesseract", str(p), "-", "--psm", "6"], capture_output=True,
                                       text=True).stdout for p in sorted(Path(tmp).glob("c*.png")))


CAPTION_AREA = "crop=iw:ih*0.28:0:ih*0.72"
# Text the footage already carries (a narrator's on-screen graphics) is not a caption the edit added.
cache = Path(tempfile.gettempdir()) / "ocade-oracle-footage-text.json"
footage_text = json.loads(cache.read_text()) if cache.exists() else {}


result: dict = {"exists": out.exists()}
if not out.exists():
    print(json.dumps({**result, "pass": False}))
    sys.exit()
info = probe(out)
video = next((s for s in info["streams"] if s["codec_type"] == "video"), {})
audio = next((s for s in info["streams"] if s["codec_type"] == "audio"), {})
result.update(duration=round(float(info["format"]["duration"]), 3), width=video.get("width"),
              height=video.get("height"), fps=video.get("r_frame_rate"), video=video.get("codec_name"),
              audio=audio.get("codec_name"),
              subtitleStream=any(s["codec_type"] == "subtitle" for s in info["streams"]))

# Which clip each second comes from: the nearest source frame, if it is near enough.
library = [(clip.name, f) for clip in clips for f in frames(clip, 1)]
timeline = []
seconds = frames(out, 1)
for f in seconds:
    best = min(library, key=lambda item: distance(item[1], f))
    timeline.append(best[0] if distance(best[1], f) < 12 else None)
order = []
for name in timeline:
    if name and (not order or order[-1] != name):
        order.append(name)
duration = result["duration"]
title_words = words(ocr_frames(out, 1, start=0.5, length=2.5))
closing_words = words(ocr_frames(out, 1, start=max(0, duration - 3), length=2.5))
result.update(clipsUsed=len({n for n in timeline if n}), clipOrder=order,
              titleText=sorted(title_words)[:12], closingText=sorted(closing_words)[:12],
              titleCard=bool(title_words) and card(seconds[0]), closingCard=bool(closing_words) and card(seconds[-1]))

# Captions: a stream, a sidecar file, or burned-in text that OCR can read.
source_words = set().union(*(words(p.read_text(errors="ignore")) for p in (ws / "clips").glob("*.srt")))
sidecars = [p for p in ws.glob("*.srt")] + [p for p in ws.glob("*.vtt")]
caption_text = " ".join(p.read_text(errors="ignore") for p in sidecars)
if result["subtitleStream"]:
    caption_text += subprocess.run(["ffmpeg", "-v", "error", "-i", str(out), "-map", "0:s:0", "-f", "srt", "-"],
                                   capture_output=True, text=True).stdout
for clip in clips:
    if clip.name not in footage_text:
        footage_text[clip.name] = sorted(words(ocr_frames(clip, 2, CAPTION_AREA)))
cache.write_text(json.dumps(footage_text))
already = set().union(*(set(v) for v in footage_text.values())) if footage_text else set()
ocr = ocr_frames(out, 2, CAPTION_AREA)
result["sidecarCaptions"] = [p.name for p in sidecars]
found = words(caption_text) | words(ocr)
matched = found & source_words
added = (words(caption_text) & source_words) | ((words(ocr) & source_words) - already)
# Captions the footage already carries count as captions on screen; the edit's own are reported apart.
result.update(captionWordsShown=len(matched), captionWordsAdded=len(added),
              captionWordsElsewhere=len(found - source_words), footageTextWords=len(words(ocr) & already))

loud = subprocess.run(["ffmpeg", "-nostats", "-i", str(out), "-filter_complex", "ebur128=peak=true", "-f", "null", "-"],
                      capture_output=True, text=True).stderr
integrated = re.findall(r"I:\s+(-?[\d.]+) LUFS", loud)
peak = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", loud)
result.update(loudnessLUFS=float(integrated[-1]) if integrated else None, truePeakDBFS=float(peak[-1]) if peak else None)
cuts = subprocess.run(["ffmpeg", "-v", "info", "-i", str(out), "-vf", "select='gt(scene,0.3)',metadata=print",
                       "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
result["sceneChanges"] = cuts.count("lavfi.scene_score")
# A project file names the clips it cuts. Only these formats open in an editor; a script or
# a JSON of the run's own design is reproducible but not editable in one, and is said so.
EDITOR_FORMATS = (".otio", ".mlt", ".edl", ".xml", ".fcpxml", ".kdenlive")
projects = [p for p in ws.iterdir() if p.suffix.lower() in EDITOR_FORMATS + (".json", ".py", ".sh", ".txt")]
result["projectFiles"] = [p.name for p in projects if sum(c.stem[:20] in p.read_text(errors="ignore") for c in clips) >= 3]
result["editorProject"] = any(Path(n).suffix.lower() in EDITOR_FORMATS for n in result["projectFiles"])

if len(sys.argv) > 2:  # contact sheet: a frame every 10 s, for a person to look at
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", str(out), "-vf", "fps=1/10,scale=320:180,tile=4x3",
                        "-frames:v", "1", sys.argv[2]], timeout=600)

result["pass"] = bool(
    abs(result["duration"] - 120) <= 0.5 and (result["width"], result["height"]) == (1280, 720)
    and result["fps"] in ("30/1", "30000/1001") and result["video"] == "h264" and result["audio"] == "aac"
    and result["clipsUsed"] >= 3 and result["titleCard"] and result["closingCard"]
    and result["captionWordsShown"] >= 15 and result["projectFiles"]
    and result["loudnessLUFS"] is not None and -24 <= result["loudnessLUFS"] <= -12
    and (result["truePeakDBFS"] or 0) <= -0.5)
print(json.dumps(result))
