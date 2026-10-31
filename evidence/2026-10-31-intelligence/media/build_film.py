"""Builds the 60-second film "The Mind of the Machine" from public-domain NASA B-roll plus
original graphics and an original synthesized score. Native FFmpeg/Pillow render: this is
NOT a web-editor run and NOT an OCADE autonomous run; it is the truthful native fallback the
plan allows. Every input is listed in the credits and in film-manifest.json.

    python build_film.py <broll.mp4> <out_dir>
"""

import json
import math
import random
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

W, H, FPS = 1920, 1080, 24
FONT = "/usr/share/fonts/opentype/inter/Inter-Light.otf"
FONT_BOLD = "/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf"
XF = 0.5  # crossfade seconds
BAR = 138  # 2.39:1 letterbox
# (start, end) in the B-roll, and the line shown under it.
SHOTS = [
    (104.6, "Every answer begins as electricity."),
    (75.2, "Thousands of processors, working as one."),
    (186.2, "Learning is arithmetic, repeated billions of times."),
    (195.0, ""),
    (112.0, "Heat is the price of thinking."),
    (205.2, "Models of our whole world."),
    (215.0, "From data, patterns emerge."),
    (68.0, "Built by people. Powered by computation."),
]
CARD = 7.0
SHOT = (60.0 + XF * (len(SHOTS) + 1) - 2 * CARD) / len(SHOTS)  # 6.3125 s each


def run(*args):
    subprocess.run(args, check=True)


def network_frames(seconds: float, seed: int):
    """An original animated neural network: layers of nodes, edges, travelling pulses."""
    rng = random.Random(seed)
    layers = [6, 9, 12, 9, 5]
    nodes = [
        [(220 + i * (W - 440) / (len(layers) - 1), H / 2 + (j - (n - 1) / 2) * 70 + rng.uniform(-8, 8))
         for j in range(n)]
        for i, n in enumerate(layers)
    ]
    edges = [(a, b) for l in range(len(layers) - 1) for a in nodes[l] for b in nodes[l + 1] if rng.random() < 0.55]
    pulses = [(rng.choice(edges), rng.uniform(0, 3), rng.uniform(0.6, 1.4)) for _ in range(140)]
    dust = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(0.5, 2.0)) for _ in range(500)]
    for f in range(int(seconds * FPS)):
        t = f / FPS
        img = Image.new("RGB", (W, H), (4, 8, 18))
        glow = Image.new("RGB", (W, H), (0, 0, 0))
        d, g = ImageDraw.Draw(img), ImageDraw.Draw(glow)
        for x, y, s in dust:
            yy = (y - t * 6 * s) % H
            d.point((x, yy), fill=(30, 50, 80))
        for a, b in edges:
            d.line([a, b], fill=(18, 40, 70), width=1)
        for (a, b), offset, speed in pulses:
            p = ((t * speed + offset) % 3) / 3
            x, y = a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p
            g.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(60, 200, 255))
        for layer in nodes:
            for x, y in layer:
                beat = 0.5 + 0.5 * math.sin(t * 2.2 + x * 0.01 + y * 0.02)
                c = (int(40 + 60 * beat), int(120 + 80 * beat), int(200 + 55 * beat))
                g.ellipse([x - 9, y - 9, x + 9, y + 9], fill=c)
                d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(220, 240, 255))
        yield ImageChops.add(ImageChops.add(img, glow.filter(ImageFilter.GaussianBlur(10))), glow)


def render_card(path: Path, seconds: float, seed: int, lines: list[tuple[str, str, int, float, int]]):
    """Animated network with timed text. lines: (text, font, size, appears_at, y)."""
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-", "-vf", text_filters(lines, seconds), "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE,
    )
    for frame in network_frames(seconds, seed):
        enc.stdin.write(frame.tobytes())
    enc.stdin.close()
    assert enc.wait() == 0


def esc(text: str) -> str:
    """drawtext reads ':' as an option separator and '\\' as an escape, even inside quotes."""
    return text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\u2019")


def text_filters(lines, seconds):
    # A soft dark band keeps text readable over the moving network.
    parts = [f"drawbox=x=0:y={H // 2 - 150}:w=iw:h=300:color=black@0.55:t=fill"]
    for text, font, size, start, y in lines:
        alpha = f"if(lt(t,{start}),0,if(lt(t,{start + 1.2}),(t-{start})/1.2,if(gt(t,{seconds - 1.0}),({seconds}-t)/1.0,1)))"
        parts.append(
            f"drawtext=fontfile={font}:text='{esc(text)}':fontsize={size}:fontcolor=white:alpha='{alpha}':"
            f"x=(w-text_w)/2:y={y}:shadowcolor=black@0.6:shadowx=0:shadowy=2"
        )
    return ",".join(parts)


def render_shot(broll: str, start: float, caption: str, path: Path):
    grade = (
        "fps=24,scale=w='1920*(1+0.06*t/{d})':h=-2:eval=frame,crop=1920:1080,"
        "eq=contrast=1.10:saturation=1.08:gamma=0.96,"
        "curves=r='0/0 0.25/0.20 0.5/0.50 0.75/0.80 1/1':g='0/0.02 0.5/0.49 1/0.97':b='0/0.10 0.25/0.28 0.5/0.50 0.75/0.70 1/0.90',"
        "vignette=PI/4.5,"
        "drawbox=x=0:y=0:w=iw:h={bar}:color=black:t=fill,drawbox=x=0:y=ih-{bar}:w=iw:h={bar}:color=black:t=fill"
    ).format(d=SHOT, bar=BAR)
    if caption:
        alpha = f"if(lt(t,0.8),0,if(lt(t,1.8),t-0.8,if(gt(t,{SHOT - 1.2}),({SHOT - 0.2}-t),1)))"
        grade += (
            f",drawtext=fontfile={FONT}:text='{esc(caption)}':fontsize=40:fontcolor=white:alpha='{alpha}':"
            f"x=(w-text_w)/2:y=h-{BAR // 2}-20"
        )
    run("ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(SHOT + 0.1), "-i", broll, "-an", "-vf", grade,
        "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(path))


def score(path: Path):
    """An original ambient score: A-minor drone with slow motion, heartbeat pulses, two risers."""
    drone = ("0.10*sin(2*PI*110*t)*(0.7+0.3*sin(2*PI*0.09*t))+0.07*sin(2*PI*164.81*t)*(0.6+0.4*sin(2*PI*0.05*t))"
             "+0.05*sin(2*PI*220*t)+0.035*sin(2*PI*261.63*t)*(0.5+0.5*sin(2*PI*0.13*t))+0.02*sin(2*PI*329.63*t)")
    pulse = "if(gt(t,7),0.22*sin(2*PI*55*t)*exp(-9*mod(t-7,1.6)),0)"
    run("ffmpeg", "-v", "error", "-y",
        "-f", "lavfi", "-i", f"aevalsrc='{drone}+{pulse}':s=48000:d=60:c=stereo",
        "-f", "lavfi", "-i", "anoisesrc=d=60:c=pink:a=0.25:r=48000",
        "-filter_complex",
        "[1]lowpass=f=1800,volume='if(between(t,4.5,7),(t-4.5)/2.5,if(between(t,50,53),(t-50)/3,0))':eval=frame,"
        "afade=t=out:st=59:d=1,aformat=channel_layouts=stereo[n];"
        "[0][n]amix=inputs=2:normalize=0,aecho=0.8:0.7:120:0.25,afade=t=in:d=2.5,afade=t=out:st=56.5:d=3.5,"
        "loudnorm=I=-16:TP=-1.5:LRA=11[a]",
        "-map", "[a]", "-c:a", "pcm_s16le", str(path))


def main():
    broll, out = sys.argv[1], Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    parts = [out / "part-00.mp4"]
    render_card(parts[0], CARD, 7, [
        ("THE MIND OF THE MACHINE", FONT_BOLD, 92, 1.4, H // 2 - 70),
        ("a short film about artificial intelligence", FONT, 40, 2.8, H // 2 + 50),
    ])
    for index, (start, caption) in enumerate(SHOTS, 1):
        parts.append(out / f"part-{index:02d}.mp4")
        render_shot(broll, start, caption, parts[-1])
    parts.append(out / "part-99.mp4")
    render_card(parts[-1], CARD, 11, [
        ("Not magic. Mathematics, at scale.", FONT_BOLD, 64, 0.8, H // 2 - 60),
        ("Footage: NASA Ames Research Center (public domain)  ·  Score and graphics: original", FONT, 30, 2.6, H - 150),
    ])
    lengths = [CARD] + [SHOT] * len(SHOTS) + [CARD]
    inputs, chain, offset, label = [], "", 0.0, "[0:v]"
    for i, part in enumerate(parts):
        inputs += ["-i", str(part)]
    for i in range(1, len(parts)):
        offset += lengths[i - 1] - XF
        chain += f"{label}[{i}:v]xfade=transition=fade:duration={XF}:offset={offset:.4f}[v{i}];"
        label = f"[v{i}]"
    score(out / "score.wav")
    run("ffmpeg", "-v", "error", "-y", *inputs, "-i", str(out / "score.wav"),
        "-filter_complex", chain + f"{label}fade=t=in:d=1,fade=t=out:st=59:d=1,trim=0:60,setpts=PTS-STARTPTS[v]",
        "-map", "[v]", "-map", f"{len(parts)}:a", "-t", "60", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        str(out / "the-mind-of-the-machine.mp4"))
    (out / "film-manifest.json").write_text(json.dumps({
        "title": "The Mind of the Machine", "duration": 60, "size": [W, H], "fps": FPS,
        "footage": {"source": "NASA Ames Research Center B-roll, ARC-20190821-AAV3214-ModularSupercomputer-BRollResource-NASAWeb",
                    "license": "NASA media, generally not copyrighted (public domain); no NASA insignia shots used",
                    "shots": [{"start": s, "seconds": SHOT, "caption": c} for s, c in SHOTS]},
        "graphics": "original (Pillow-rendered neural network animation)",
        "score": "original (FFmpeg-synthesized drone, pulses, risers)",
        "method": "native FFmpeg/Pillow render; not a web editor; not an OCADE autonomous run",
    }, indent=2))


if __name__ == "__main__":
    main()
