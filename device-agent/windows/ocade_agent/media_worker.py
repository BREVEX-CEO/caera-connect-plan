"""The `media_engine` worker: audio, video and 3D scenes as typed operations (plan.md M1, M2).

Every operation takes data the planner chose — source in/out points, grades,
transitions, titles, sound layers, or a scene of shapes, materials and lights —
and executes it with an engine found on this computer: FFmpeg for audio and
video, the bundled browser engine for 3D. None of them contains a shot list,
template, font file, object model or output name of its own. A missing engine is
a refusal the planner sees before anything is written, never a half-finished file.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from mcp.server.mcpserver import MCPServer

from . import scene_gl
from .sandbox import MEDIA_INPUT_OPTIONS, PASSIVE_IMAGE_FORMATS, Refused, guarded as _evidence, output_path, preview_jpeg, resolve, sha256, write_atomically

app = MCPServer("ocade-media")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
TRANSITIONS = {
    "fade", "fadeblack", "fadewhite", "dissolve", "wipeleft", "wiperight", "slideleft", "slideright",
    "smoothleft", "smoothright", "smoothup", "smoothdown", "circleopen", "circleclose", "zoomin",
    "radial", "hlwind", "hrwind", "squeezeh", "squeezev", "distance", "pixelize", "hblur", "fadegrays",
}


def _engine(name: str) -> str:
    found = shutil.which(name)
    if not found:
        raise Refused("no_media_engine")
    return found


def _probe(source: Path) -> dict:
    run = subprocess.run(
        [_engine("ffprobe"), "-v", "error", "-show_format", "-show_streams", "-of", "json", *MEDIA_INPUT_OPTIONS, str(source)],
        capture_output=True, timeout=60, text=True,
    )
    if run.returncode != 0:
        raise Refused("unreadable_media")
    return json.loads(run.stdout)


@app.tool()
@_evidence
def media_inspect(path: str) -> dict:
    """Technical facts of an image (Pillow) or audio/video file (ffprobe): never its pixels."""
    source = resolve(WORKSPACE, path)
    if not source.is_file():
        raise Refused("not_a_file")
    try:
        from PIL import Image

        with Image.open(source, formats=PASSIVE_IMAGE_FORMATS) as image:
            orientation = image.getexif().get(274, 1)
            width, height = image.size
            if orientation in (5, 6, 7, 8):
                width, height = height, width
            return {
                "sha256": sha256(source),
                "kind": "image",
                "format": image.format,
                "width": width,
                "height": height,
                "mode": image.mode,
                "orientation": "landscape" if width > height else "portrait" if height > width else "square",
            }
    except (OSError, ValueError):
        pass  # not an image: try it as media
    facts = _probe(source)
    streams = [
        {
            "type": s.get("codec_type"),
            "codec": s.get("codec_name"),
            "width": s.get("width"),
            "height": s.get("height"),
            "fps": s.get("avg_frame_rate"),
            "channels": s.get("channels"),
        }
        for s in facts.get("streams", [])[:8]
    ]
    return {
        "sha256": sha256(source),
        "kind": "media",
        "container": facts.get("format", {}).get("format_name"),
        "duration": float(facts.get("format", {}).get("duration", 0) or 0),
        "streams": streams,
    }


@app.tool()
@_evidence
def media_trim(source: str, start: float, end: float, output: str) -> dict:
    """Cut [start, end) seconds of a media file into a new file with ffmpeg; the source is only read."""
    origin = resolve(WORKSPACE, source)
    target = output_path(WORKSPACE, output)
    executable = _engine("ffmpeg")
    if end <= start or not origin.is_file():
        raise Refused("invalid_range")

    def cut(temporary: Path) -> None:
        run = subprocess.run(
            [executable, "-v", "error", "-y", "-ss", str(start), "-to", str(end), *MEDIA_INPUT_OPTIONS, "-i", str(origin),
             "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", "-f", "mp4", str(temporary)],
            capture_output=True, timeout=600,
        )
        if run.returncode != 0:
            raise Refused("media_engine_failed")

    return {"sha256": write_atomically(target, cut), "engine": "ffmpeg"}


@app.tool()
@_evidence
def media_preview(path: str, at: list[float] | None = None) -> dict:
    """Let the planner SEE a file: an image (photo, render, screenshot) as a small JPEG, or a
    video as a labelled contact sheet of frames (evenly spaced, or at the given seconds)."""
    import io

    from PIL import Image, ImageDraw

    source = resolve(WORKSPACE, path)
    if not source.is_file():
        raise Refused("not_a_file")
    try:
        with Image.open(source, formats=PASSIVE_IMAGE_FORMATS) as image:
            image.load()
            return {"kind": "image", "width": image.width, "height": image.height,
                    "preview": preview_jpeg(image)}
    except (OSError, ValueError):
        pass
    facts = _probe(source)
    duration = float(facts.get("format", {}).get("duration", 0) or 0)
    if duration <= 0 or not any(s.get("codec_type") == "video" for s in facts.get("streams", [])):
        raise Refused("no_video_stream")
    times = sorted(t for t in (at or [duration * (i + 0.5) / 9 for i in range(9)]) if 0 <= t < duration)[:12]
    if not times:
        raise Refused("invalid_range")
    tiles = []
    for moment in times:
        frame = subprocess.run(
            [_engine("ffmpeg"), "-v", "error", "-ss", f"{moment}", *MEDIA_INPUT_OPTIONS, "-i", str(source), "-frames:v", "1",
             "-vf", "scale=320:-2", "-f", "image2pipe", "-vcodec", "png", "-"],
            capture_output=True, timeout=120,
        ).stdout
        if frame:
            tile = Image.open(io.BytesIO(frame)).convert("RGB")
            ImageDraw.Draw(tile).text((6, 4), f"{moment:.1f}s", fill=(255, 230, 0))
            tiles.append(tile)
    if not tiles:
        raise Refused("media_engine_failed")
    columns = 3 if len(tiles) > 4 else 2 if len(tiles) > 1 else 1
    rows = -(-len(tiles) // columns)
    sheet = Image.new("RGB", (columns * tiles[0].width, rows * tiles[0].height))
    for index, tile in enumerate(tiles):
        sheet.paste(tile, ((index % columns) * tiles[0].width, (index // columns) * tiles[0].height))
    return {"kind": "video", "duration": round(duration, 3), "frames": [round(t, 2) for t in times],
            "preview": preview_jpeg(sheet)}


@app.tool()
@_evidence
def media_analyze(path: str, threshold: float = 0.3) -> dict:
    """Split a video into shots and describe each with numbers the planner can choose from:
    brightness, colourfulness, motion and sound level. The pixels never leave the computer."""
    source = resolve(WORKSPACE, path)
    if not source.is_file():
        raise Refused("not_a_file")
    facts = _probe(source)
    duration = float(facts.get("format", {}).get("duration", 0) or 0)
    has_audio = any(s.get("codec_type") == "audio" for s in facts.get("streams", []))
    if not any(s.get("codec_type") == "video" for s in facts.get("streams", [])):
        raise Refused("no_video_stream")
    run = subprocess.run(
        [_engine("ffmpeg"), "-v", "error", *MEDIA_INPUT_OPTIONS, "-i", str(source), "-an", "-vf",
         "fps=4,scale=256:-2,select='gte(scene,0)',signalstats,metadata=print:file=-", "-f", "null", "-"],
        capture_output=True, text=True, timeout=900,
    )
    if run.returncode != 0:
        raise Refused("media_engine_failed")
    frames, current = [], {}
    for line in run.stdout.splitlines():
        if line.startswith("frame:"):
            if current:
                frames.append(current)
            current = {"t": float(re.search(r"pts_time:([0-9.]+)", line).group(1))}
        elif "=" in line:
            key, _, value = line.partition("=")
            if key in ("lavfi.scene_score", "lavfi.signalstats.YAVG", "lavfi.signalstats.SATAVG"):
                current[key.rsplit(".", 1)[1]] = float(value)
    if current:
        frames.append(current)
    loudness = {}
    if has_audio:
        audio = subprocess.run(
            [_engine("ffmpeg"), "-v", "error", *MEDIA_INPUT_OPTIONS, "-i", str(source), "-vn", "-af",
             "asetnsamples=n=12000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
             "-f", "null", "-"],
            capture_output=True, text=True, timeout=900,
        )
        time = None
        for line in audio.stdout.splitlines():
            if line.startswith("frame:"):
                time = float(re.search(r"pts_time:([0-9.]+)", line).group(1))
            elif line.startswith("lavfi.astats.Overall.RMS_level=") and time is not None:
                value = line.split("=", 1)[1]
                loudness[time] = float(value) if value not in ("-inf", "nan") else -120.0
    shots, start = [], 0.0
    for index, frame in enumerate(frames):
        cut = index > 0 and frame.get("scene_score", 0) >= threshold
        last = index == len(frames) - 1
        if cut or last:
            end = duration if last else frame["t"]
            inside = [f for f in frames if start <= f["t"] < end] or [frame]
            levels = [v for t, v in loudness.items() if start <= t < end]
            shots.append({
                "start": round(start, 2),
                "end": round(end, 2),
                "brightness": round(sum(f.get("YAVG", 0) for f in inside) / len(inside) / 255, 3),
                "colour": round(sum(f.get("SATAVG", 0) for f in inside) / len(inside) / 128, 3),
                "motion": round(sum(f.get("scene_score", 0) for f in inside[1:]) / max(len(inside) - 1, 1), 4),
                "soundDb": round(sum(levels) / len(levels), 1) if levels else None,
                "peakSoundAt": round(max(((t, v) for t, v in loudness.items() if start <= t < end),
                                         key=lambda item: item[1])[0], 2) if levels else None,
            })
            start = frame["t"]
    return {"sha256": sha256(source), "duration": round(duration, 3), "hasAudio": has_audio,
            "shots": shots[:80], "shotCount": len(shots)}


def _title_frame(title: dict, width: int, height: int, bar: int, path: Path) -> None:
    """One title drawn on a transparent full frame with the bundled Pillow, so type never depends
    on how this computer's ffmpeg was built (drawtext needs libfreetype, often missing)."""
    from PIL import Image, ImageDraw, ImageFont

    size = title.get("size", 64)
    try:
        font = ImageFont.truetype(title["font"], size) if title.get("font") else ImageFont.load_default(size)
    except OSError:
        try:
            font = ImageFont.truetype(f"{title['font']}.ttf", size)
        except OSError:
            font = ImageFont.load_default(size)  # an installed family name Pillow cannot resolve
    frame = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    left, top, right, bottom = draw.textbbox((0, 0), title["text"], font=font)
    text_w, text_h = right - left, bottom - top
    # Positions are inside the picture, never on a letterbox bar.
    y = {"top": max(height * 0.12, bar + height * 0.05), "center": (height - text_h) / 2,
         "lower_third": min(height * 0.74, height - bar - height * 0.06 - text_h),
         "bottom": min(height * 0.86, height - bar - height * 0.04) - text_h}[title.get("position", "center")]
    x = (width - text_w) / 2
    if title.get("box"):
        pad = size // 2
        draw.rectangle((x - pad, y - pad, x + text_w + pad, y + text_h + pad), fill=(0, 0, 0, round(255 * title["box"])))
    colour = title.get("color", "white")
    draw.text((x - left, y - top + 3), title["text"], font=font, fill=(0, 0, 0, 140))  # soft shadow
    draw.text((x - left, y - top), title["text"], font=font, fill=colour)
    frame.save(path)


def _atempo(speed: float) -> str:
    steps = []
    while speed > 2.0:
        steps.append("atempo=2.0")
        speed /= 2.0
    while speed < 0.5:
        steps.append("atempo=0.5")
        speed /= 0.5
    return ",".join(steps + [f"atempo={speed:.6f}"])


@app.tool()
@_evidence
def media_render_timeline(
    output: str, duration: float, clips: list[dict], width: int = 1920, height: int = 1080, fps: int = 24,
    titles: list[dict] | None = None, overlays: list[dict] | None = None, audio: list[dict] | None = None,
    clipAudioGain: float = 0.0, letterbox: float | None = None, loudness: float = -14.0,  # noqa: N803
    fadeIn: float = 0.0, fadeOut: float = 0.0,  # noqa: N803
) -> dict:
    """Render the planner's edit decision list to an exact-length H.264/AAC video."""
    ffmpeg = _engine("ffmpeg")
    target = output_path(WORKSPACE, output)
    inputs, graph, lengths, audio_parts = [], [], [], []
    for index, clip in enumerate(clips):
        source = resolve(WORKSPACE, clip["source"])
        if not source.is_file():
            raise Refused("not_a_file")
        facts = _probe(source)
        available = float(facts.get("format", {}).get("duration", 0) or 0)
        start, end, speed = clip["in"], clip["out"], clip.get("speed", 1.0)
        if end <= start or end > available + 0.05:
            raise Refused("clip_out_of_range")
        length = (end - start) / speed
        lengths.append(length)
        inputs += ["-ss", f"{start}", "-t", f"{end - start}", *MEDIA_INPUT_OPTIONS, "-i", str(source)]
        grade = clip.get("grade") or {}
        motion = clip.get("motion") or {}
        zoom_from, zoom_to = motion.get("zoomFrom", 1.0), motion.get("zoomTo", 1.0)
        pan_x, pan_y = motion.get("panX", 0.0), motion.get("panY", 0.0)
        chain = [
            f"setpts=(PTS-STARTPTS)/{speed}",
            f"fps={fps}",
            f"scale={width}:{height}:force_original_aspect_ratio=increase",
            f"crop={width}:{height}",
        ]
        if zoom_from != 1.0 or zoom_to != 1.0 or pan_x or pan_y:
            # A slow camera move: scale up over time, crop a window that drifts with the pan.
            zoom = f"({zoom_from}+({zoom_to}-{zoom_from})*t/{length})"
            chain += [f"scale=w='ceil({width}*{zoom}/2)*2':h='ceil({height}*{zoom}/2)*2':eval=frame",
                      f"crop={width}:{height}:x='(iw-{width})*(0.5+{pan_x / 2}*t/{length})':"
                      f"y='(ih-{height})*(0.5+{pan_y / 2}*t/{length})'"]
        if grade.get("exposure"):
            chain.append(f"exposure=exposure={grade['exposure']}")
        if grade.get("temperature"):
            chain.append(f"colortemperature=temperature={grade['temperature']}")
        chain.append(f"eq=contrast={grade.get('contrast', 1.0)}:saturation={grade.get('saturation', 1.0)}"
                     f":gamma={grade.get('gamma', 1.0)}:brightness={grade.get('brightness', 0.0)}")
        if grade.get("sharpen"):
            chain.append(f"unsharp=5:5:{grade['sharpen']}:5:5:0")
        if grade.get("vignette"):
            chain.append(f"vignette=angle={0.2 + 0.6 * grade['vignette']}")
        # setpts leaves no declared frame rate on ffmpeg 7+; xfade and concat need a constant one.
        chain += [f"trim=duration={length:.4f}", "setpts=PTS-STARTPTS", f"fps={fps}", f"settb=1/{fps}", "setsar=1",
                  "format=yuv420p"]
        graph.append(f"[{index}:v]{','.join(chain)}[c{index}]")
        if clip.get("audio", True) and any(s.get("codec_type") == "audio" for s in facts.get("streams", [])):
            audio_parts.append((index, length, clip.get("audioGain", 0.0) + clipAudioGain, speed))

    # Join shots: hard cuts by concatenation, transitions by xfade, each at its exact offset.
    label, timeline, starts = "[c0]", lengths[0], [0.0]
    for index in range(1, len(clips)):
        transition = clips[index].get("transition") or {}
        kind, overlap = transition.get("type", "cut"), transition.get("duration", 0.0)
        if kind == "cut" or overlap <= 0:
            # concat answers in microseconds and (ffmpeg 7+) with no declared frame rate; xfade
            # later needs both sides at a constant fps and a 1/fps time base
            graph.append(f"{label}[c{index}]concat=n=2:v=1:a=0,fps={fps},settb=1/{fps}[j{index}]")
            starts.append(timeline)
            timeline += lengths[index]
        else:
            if kind not in TRANSITIONS or overlap >= min(lengths[index], lengths[index - 1]):
                raise Refused("invalid_transition")
            offset = timeline - overlap
            graph.append(f"{label}[c{index}]xfade=transition={kind}:duration={overlap}:offset={offset:.4f}[j{index}]")
            starts.append(offset)
            timeline = offset + lengths[index]
        label = f"[j{index}]"
    graph.append(f"{label}tpad=stop_mode=clone:stop_duration={max(duration - timeline, 0) + 1},"
                 f"trim=duration={duration}[base]")
    label = "[base]"

    # Images sit on the picture, under the letterbox and the type.
    count = len(clips)
    for number, overlay in enumerate(overlays or []):
        image = resolve(WORKSPACE, overlay["image"])
        if not image.is_file():
            raise Refused("not_a_file")
        from PIL import Image

        try:
            with Image.open(image, formats=PASSIVE_IMAGE_FORMATS) as raster:
                raster.verify()
        except (OSError, ValueError):
            raise Refused("unsupported_image")
        inputs += ["-protocol_whitelist", "file", "-f", "image2", "-pattern_type", "none",
                   "-loop", "1", "-framerate", str(fps), "-t", str(duration), "-i", str(image)]
        start, end = overlay["start"], overlay["end"]
        scale = overlay.get("width", width)
        zoom_to = overlay.get("zoomTo", 1.0)
        size = f"'ceil({scale}*(1+({zoom_to}-1)*clip((t-{start})/{end - start},0,1))/2)*2'"
        fade_in, fade_out = overlay.get("fadeIn", 0.5), overlay.get("fadeOut", 0.5)
        graph.append(
            f"[{count}:v]format=rgba,scale=w={size}:h=-2:eval=frame,"
            f"fade=t=in:st={start}:d={max(fade_in, 0.01)}:alpha=1,"
            f"fade=t=out:st={max(end - fade_out, start)}:d={max(fade_out, 0.01)}:alpha=1[o{number}]"
        )
        x = overlay.get("x", 0.5)
        y = overlay.get("y", 0.5)
        graph.append(f"{label}[o{number}]overlay=x='(W-w)*{x}':y='(H-h)*{y}':eval=frame:format=auto:"
                     f"enable='between(t,{start},{end})'[v{number}]")
        label = f"[v{number}]"
        count += 1

    finish = ["setsar=1"]
    bar = max(0, round((height - width / letterbox) / 2)) if letterbox else 0
    if bar:
        finish += [f"drawbox=x=0:y=0:w=iw:h={bar}:color=black:t=fill", f"drawbox=x=0:y=ih-{bar}:w=iw:h={bar}:color=black:t=fill"]
    graph.append(f"{label}{','.join(finish)}[boxed]")
    label, finish = "[boxed]", []
    frames = Path(tempfile.mkdtemp(prefix="ocade-titles-"))
    for number, title in enumerate(titles or []):
        frame = frames / f"title{number}.png"
        _title_frame(title, width, height, bar, frame)
        start, end = title["start"], title["end"]
        fade_in, fade_out = title.get("fadeIn", 0.6), title.get("fadeOut", 0.6)
        inputs += ["-protocol_whitelist", "file", "-f", "image2", "-pattern_type", "none",
                   "-loop", "1", "-framerate", str(fps), "-t", str(duration), "-i", str(frame)]
        graph.append(f"[{count}:v]format=rgba,fade=t=in:st={start}:d={max(fade_in, 0.01)}:alpha=1,"
                     f"fade=t=out:st={max(end - fade_out, start)}:d={max(fade_out, 0.01)}:alpha=1[t{number}]")
        graph.append(f"{label}[t{number}]overlay=0:0:format=auto:enable='between(t,{start},{end})'[tv{number}]")
        label = f"[tv{number}]"
        count += 1
    if fadeIn:
        finish.append(f"fade=t=in:st=0:d={fadeIn}")
    if fadeOut:
        finish.append(f"fade=t=out:st={duration - fadeOut}:d={fadeOut}")
    graph.append(f"{label}{','.join(finish + ['format=yuv420p'])}[vout]")

    # Sound: clip sound and the planner's layers, music ducked under everything else.
    beds, effects = [], []
    for index, length, gain, speed in audio_parts:
        delay = int(starts[index] * 1000)
        graph.append(f"[{index}:a]aresample=48000,aformat=channel_layouts=stereo,{_atempo(speed)},"
                     f"atrim=duration={length:.4f},afade=t=in:d=0.08,afade=t=out:st={max(length - 0.12, 0)}:d=0.12,"
                     f"volume={gain}dB,adelay={delay}|{delay},apad=whole_dur={duration}[ca{index}]")
        effects.append(f"[ca{index}]")
    for number, layer in enumerate(audio or []):
        length = layer["duration"]
        if layer.get("source"):
            source = resolve(WORKSPACE, layer["source"])
            if not source.is_file():
                raise Refused("not_a_file")
            inputs += ["-ss", str(layer.get("in", 0.0)), "-t", str(length), *MEDIA_INPUT_OPTIONS, "-i", str(source)]
            head = f"[{count}:a]aresample=48000,aformat=channel_layouts=stereo"
            count += 1
        else:
            synth = layer["synth"]
            kind = synth["kind"]
            frequency, to = synth.get("frequency", 220.0), synth.get("toFrequency", synth.get("frequency", 220.0))
            if kind == "noise":
                source = f"anoisesrc=d={length}:c={synth.get('color', 'pink')}:a=0.5:r=48000"
            elif kind == "sine":
                source = f"sine=f={frequency}:d={length}:r=48000"
            else:  # sweep: the phase of a linear chirp from frequency to toFrequency
                source = f"aevalsrc='0.5*sin(2*PI*({frequency}*t+({to}-{frequency})/(2*{length})*t*t))':d={length}:s=48000"
            inputs += ["-f", "lavfi", "-i", source]
            head = f"[{count}:a]aformat=channel_layouts=stereo"
            count += 1
            if synth.get("decay"):
                head += f",volume='exp(-{synth['decay']}*t)':eval=frame"
        filters = [head]
        if layer.get("highpass"):
            filters.append(f"highpass=f={layer['highpass']}")
        if layer.get("lowpass"):
            filters.append(f"lowpass=f={layer['lowpass']}")
        filters.append(f"atrim=duration={length}")
        if layer.get("fadeIn"):
            filters.append(f"afade=t=in:d={layer['fadeIn']}")
        if layer.get("fadeOut"):
            filters.append(f"afade=t=out:st={max(length - layer['fadeOut'], 0)}:d={layer['fadeOut']}")
        delay = int(layer["start"] * 1000)
        # Every mix input lasts the whole programme: with inputs that end early, amix on
        # ffmpeg 7+ sometimes ended the mix with them (silence for the rest of the film).
        filters += [f"volume={layer.get('gain', 0.0)}dB", f"adelay={delay}|{delay}", f"apad=whole_dur={duration}"]
        graph.append(",".join(filters) + f"[l{number}]")
        (beds if layer.get("role") == "music" else effects).append(f"[l{number}]")
    mixed = None
    if effects:
        graph.append(f"{''.join(effects)}amix=inputs={len(effects)}:normalize=0:duration=longest[fx]")
        mixed = "[fx]"
    if beds:
        graph.append(f"{''.join(beds)}amix=inputs={len(beds)}:normalize=0:duration=longest[bed]")
        if mixed:
            graph.append("[fx]asplit=2[fxa][fxkey]")
            graph.append("[bed][fxkey]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=350[ducked]")
            graph.append("[fxa][ducked]amix=inputs=2:normalize=0:duration=longest[mix]")
            mixed = "[mix]"
        else:
            mixed = "[bed]"
    if mixed:
        graph.append(f"{mixed}apad,atrim=duration={duration},loudnorm=I={loudness}:TP=-1.5:LRA=11,"
                     f"aresample=48000,afade=t=out:st={max(duration - max(fadeOut, 0.5), 0)}:d={max(fadeOut, 0.5)}[aout]")

    def encode(temporary: Path) -> None:
        command = [ffmpeg, "-v", "error", "-y", *inputs, "-filter_complex", ";".join(graph), "-map", "[vout]"]
        if mixed:
            command += ["-map", "[aout]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]
        command += ["-r", str(fps), "-frames:v", str(round(duration * fps)), "-t", str(duration),
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", "-f", "mp4", str(temporary)]
        run = subprocess.run(command, capture_output=True, text=True, timeout=3600)
        if run.returncode != 0:
            print(f"ffmpeg: {run.stderr[-600:]}", file=sys.stderr)  # local diagnostics only
            raise Refused("media_engine_failed")

    try:
        digest = write_atomically(target, encode)
    finally:
        shutil.rmtree(frames, ignore_errors=True)
    return {"sha256": digest, "engine": "ffmpeg", "duration": duration, "frames": round(duration * fps),
            "clips": len(clips), "layers": len(audio or []), "titles": len(titles or [])}


@app.tool()
@_evidence
async def scene_render(scene: dict, output: str, project: str) -> dict:
    """Render a typed 3D scene to a PNG and save the scene itself as the editable project."""
    return await _scene_render(scene, output, project)


async def _scene_render(scene: dict, output: str, project: str) -> dict:
    image_target = output_path(WORKSPACE, output)
    project_target = output_path(WORKSPACE, project)
    if image_target == project_target:
        raise Refused("output_path_conflict")
    if image_target.suffix.lower() != ".png":
        raise Refused("png_output_only")
    width, height = scene["render"]["width"], scene["render"]["height"]
    try:
        scene_gl.compile_shader(scene)  # refuse a bad scene before starting a browser
    except (KeyError, ValueError):
        raise Refused("invalid_scene")
    try:
        renderer, image = await scene_gl.render(scene, width, height)
    except Exception:
        raise Refused("no_3d_engine")
    text = json.dumps(scene, indent=2, sort_keys=True)
    project_sha = write_atomically(project_target, lambda temporary: temporary.write_text(text, encoding="utf-8"))
    from PIL.PngImagePlugin import PngInfo

    info = PngInfo()
    info.add_text("ocade:engine", scene_gl.ENGINE)
    info.add_text("ocade:project", project)
    info.add_text("ocade:project-sha256", project_sha)
    image_sha = write_atomically(image_target, lambda temporary: image.save(temporary, "PNG", pnginfo=info))
    shapes = sum(len(part["shapes"]) for part in scene["parts"])
    return {"sha256": {"image": image_sha, "project": project_sha}, "engine": scene_gl.ENGINE,
            "renderer": str(renderer)[:120], "width": width, "height": height, "parts": len(scene["parts"]),
            "shapes": shapes, "materials": len(scene["materials"]), "samples": scene["render"].get("samples", 4)}


if __name__ == "__main__":
    app.run("stdio")
