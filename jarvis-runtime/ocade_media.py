"""
A finished video from an edit list, rendered here with ffmpeg: no model writes a filter graph.

The planner says which parts of which clips, in what order, with what opening and closing card,
grade and loudness; this renders each part to the same frame size, rate and audio format,
fades between parts, joins them, gives captions from each clip's own .srt (shifted to where
the part lands in the edit, beside the video and inside it as a subtitle track, and drawn in
the picture when asked), and normalises loudness in two passes so speech plays near the target
with its true peak below -1 dBTP. What it returns is measured from the saved file.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

FADE_S = 0.4  # each part fades in and out: a clean join, never a flash cut mid-word


class MediaError(Exception):
    pass


def _ffmpeg(args: list[str], cancel: threading.Event, timeout: float) -> str:
    """One ffmpeg run that STOP ends; its log for loudness, or MediaError with its last words."""
    process = subprocess.Popen(["ffmpeg", "-hide_banner", "-nostdin", "-y", *args],
                               stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    try:
        while True:
            try:
                _, log = process.communicate(timeout=0.5)
                break
            except subprocess.TimeoutExpired:
                timeout -= 0.5
                if cancel.is_set() or timeout <= 0:
                    process.kill()
                    process.communicate()
                    raise MediaError("Stopped before it finished" if cancel.is_set() else "Rendering took too long")
    finally:
        if process.poll() is None:
            process.kill()
    if process.returncode != 0:
        raise MediaError(f"ffmpeg could not render it: {log.strip().splitlines()[-1][:200] if log.strip() else 'no output'}")
    return log


def seconds_of(path: Path) -> float:
    raw = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
                         capture_output=True, text=True, timeout=20).stdout
    try:
        return float(json.loads(raw or "{}")["format"]["duration"])
    except (KeyError, ValueError):
        raise MediaError(f"{path.name} is not a video ffmpeg can read") from None


def _cues(srt: Path) -> list[tuple[float, float, str]]:
    def at(stamp: str) -> float:
        h, m, s = stamp.replace(",", ".").split(":")
        return int(h) * 3600 + int(m) * 60 + float(s)
    found = []
    for block in re.split(r"\n\s*\n", srt.read_text(encoding="utf-8-sig", errors="replace")):
        times = re.search(r"(\d+:\d\d:\d\d[,.]\d+)\s*-->\s*(\d+:\d\d:\d\d[,.]\d+)", block)
        if times:
            text = " ".join(block[times.end():].split())
            if text:
                found.append((at(times.group(1)), at(times.group(2)), text))
    return found


def _stamp(t: float) -> str:
    ms = round(max(t, 0) * 1000)
    return f"{ms // 3_600_000:02d}:{ms // 60_000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def _srt(cues: list[tuple[float, float, str]]) -> str:
    return "".join(f"{n}\n{_stamp(a)} --> {_stamp(b)}\n{text}\n\n" for n, (a, b, text) in enumerate(cues, 1))


def _text_filter(text: str, size: str) -> str:
    """A centred card's words, escaped for drawtext."""
    safe = text.replace("\\", "\\\\").replace("'", "\u2019").replace(":", "\\:").replace("%", "\\%")
    height = int(size.split("x")[1])
    return (f"drawtext=text='{safe}':fontcolor=white:fontsize={height // 12}:"
            "x=(w-text_w)/2:y=(h-text_h)/2")


def render(root: Path, spec: dict, out: Path, cancel: threading.Event, timeout: float = 300) -> dict:
    """The edit `spec` rendered to `out` (an .mp4 that does not exist yet) with its .srt beside it."""
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise MediaError("This computer has no ffmpeg; install it, or edit in a video editor here")
    size = str(spec.get("frame") or "1280x720")
    width, height = (int(v) for v in size.split("x"))
    fps = int(spec.get("fps") or 30)
    grade = spec.get("grade") or {}
    look = (f"eq=contrast={grade.get('contrast', 1.05)}:saturation={grade.get('saturation', 1.1)}:"
            f"brightness={grade.get('brightness', 0)},"
            f"colorbalance=rm={grade.get('warmth', 0.03)}:bm={-grade.get('warmth', 0.03)}")
    frame = (f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
             f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps},format=yuv420p")
    audio = "aresample=48000,aformat=channel_layouts=stereo"
    encode = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k"]

    clips = []
    for clip in spec["clips"]:
        source = root / clip["path"]
        length = seconds_of(source)
        start = max(0.0, float(clip["from"]))
        end = min(float(clip["to"]), length)
        if end - start < 0.5:
            raise MediaError(f"{clip['path']} has no part from {clip['from']} to {clip['to']} s (it is {length:.1f} s long)")
        clips.append((source, start, end, clip.get("captions")))
    card_s = float(spec.get("cardSeconds") or 3)
    cards = [(spec[k], card_s) for k in ("opening", "closing") if spec.get(k)]
    if spec.get("length"):  # the exact running time asked for: the last part ends where it must
        source, start, end, captions = clips[-1]
        other = sum(e - s for _, s, e, _ in clips[:-1]) + sum(s for _, s in cards)
        end = start + float(spec["length"]) - other
        if end <= start + 0.5 or end > seconds_of(source) + 0.01:
            raise MediaError(f"{spec['length']} s cannot be reached by trimming the last part; choose other parts")
        clips[-1] = (source, start, end, captions)

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        parts, cues, at = [], [], 0.0
        plan = ([("card", spec["opening"], card_s)] if spec.get("opening") else []) + \
            [("clip", c, c[2] - c[1]) for c in clips] + \
            ([("card", spec["closing"], card_s)] if spec.get("closing") else [])
        for n, (kind, what, seconds) in enumerate(plan):
            part = work / f"part{n:03d}.mp4"
            fades = f"fade=in:st=0:d={FADE_S},fade=out:st={seconds - FADE_S:.3f}:d={FADE_S}"
            afades = f"afade=in:st=0:d={FADE_S},afade=out:st={seconds - FADE_S:.3f}:d={FADE_S}"
            if kind == "card":
                _ffmpeg(["-f", "lavfi", "-i", f"color=c=0x101418:s={size}:r={fps}:d={seconds}",
                         "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo", "-t", f"{seconds}",
                         "-vf", f"{_text_filter(what, size)},{fades},format=yuv420p", "-af", afades,
                         *encode, str(part)], cancel, timeout)
            else:
                source, start, end, captions = what
                if captions:
                    for a, b, text in _cues(root / captions):
                        if b > start and a < end:
                            cues.append((at + max(a, start) - start, at + min(b, end) - start, text))
                has_audio = bool(subprocess.run(
                    ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                     "-of", "csv=p=0", str(source)], capture_output=True, text=True, timeout=20).stdout.strip())
                inputs = ["-ss", f"{start:.3f}", "-t", f"{seconds:.3f}", "-i", str(source)]
                if not has_audio:
                    inputs += ["-f", "lavfi", "-t", f"{seconds:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
                _ffmpeg([*inputs, "-map", "0:v:0", "-map", "0:a:0" if has_audio else "1:a:0",
                         "-vf", f"{frame},{look},{fades}", "-af", f"{audio},{afades}", "-t", f"{seconds:.3f}",
                         *encode, str(part)], cancel, timeout)
            parts.append(part)
            at += seconds
        listing = work / "parts.txt"
        listing.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts))
        joined = work / "joined.mp4"
        _ffmpeg(["-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(joined)], cancel, timeout)

        target = float(spec.get("loudness") or -14)
        norm = f"loudnorm=I={target}:TP=-1.5:LRA=11"
        log = _ffmpeg(["-i", str(joined), "-af", f"{norm}:print_format=json", "-f", "null", "-"], cancel, timeout)
        measured = json.loads(log[log.rindex("{"):log.rindex("}") + 1])
        second = (f"{norm}:measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
                  f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
                  f"offset={measured['target_offset']}:linear=true,aresample=48000")
        srt = out.with_suffix(".srt")
        video_filter = []
        if cues:
            srt.write_text(_srt(cues), encoding="utf-8")
            if spec.get("burnCaptions"):
                shown = work / "captions.srt"
                shown.write_text(_srt(cues), encoding="utf-8")
                video_filter = ["-vf", f"subtitles={shown.as_posix()}:force_style='FontSize=20,Outline=2,MarginV=36'"]
        subtitle_in = ["-i", str(srt)] if cues else []
        _ffmpeg(["-i", str(joined), *subtitle_in, "-map", "0:v", "-map", "0:a",
                 *(["-map", "1:s", "-c:s", "mov_text"] if cues else []), *video_filter,
                 *(["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"] if video_filter else ["-c:v", "copy"]),
                 "-af", second, "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)],
                cancel, timeout)
    return {"seconds": round(seconds_of(out), 2), "parts": len(plan), "captions": len(cues),
            **({"captionsFile": srt.name} if cues else {})}
