"""Independent checks on the finished film, run through OCADE's own gateway where an operation
exists (media.inspect, verify.checks media_duration) and FFmpeg probes for the rest.

    PYTHONPATH=device-agent/windows python verify_film.py <film.mp4> <out_dir>
"""

import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import anyio

from ocade_agent.gateway import PROTOCOL, Gateway


def intent(operation, arguments):
    spec = PROTOCOL["operations"][operation]
    return {"v": 1, "key": operation, "operation": operation, "capability": spec["capability"], "risk": spec["risk"],
            "arguments": arguments,
            "deadlineUtc": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z")}


def ffmpeg_stats(film: Path) -> dict:
    loud = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(film), "-af", "ebur128", "-f", "null", "-"],
                          capture_output=True, text=True).stderr
    black = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(film), "-vf", "blackdetect=d=0.5:pix_th=0.08",
                            "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    scenes = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(film), "-vf", "select='gt(scene,0.3)',showinfo",
                             "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    integrated = re.findall(r"I:\s+(-?[0-9.]+) LUFS", loud)
    peak = re.findall(r"Peak:\s+(-?[0-9.]+) dBFS", loud)
    return {
        "integratedLoudnessLUFS": float(integrated[-1]) if integrated else None,
        "truePeakdBFS": float(peak[-1]) if peak else None,
        "blackSegmentsOver0_5s": re.findall(r"black_start:([0-9.]+) black_end:([0-9.]+)", black),
        "hardCutsDetected": len(re.findall(r"pts_time:", scenes)),
    }


def main():
    film, out = Path(sys.argv[1]), Path(sys.argv[2])
    workspace = Path(tempfile.mkdtemp())
    shutil.copy(film, workspace / "film.mp4")

    async def go():
        async with Gateway(str(workspace)) as gateway:
            facts = await gateway.run(intent("media.inspect", {"path": "film.mp4"}), gateway.epoch)
            check = await gateway.run(intent("verify.checks", {"checks": [
                {"id": "sixty_seconds", "description": "60 s", "kind": "media_duration",
                 "params": {"path": "film.mp4", "value": 60}}]}), gateway.epoch)
            return facts, check

    facts, check = anyio.run(go)
    frames = out / "VID-film-frames.jpg"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(film), "-vf", "fps=1/5,scale=480:-1,tile=4x3",
                    "-frames:v", "1", str(frames)], check=True)
    report = {"inspect": facts.get("evidence"), "verifier": check.get("evidence"), **ffmpeg_stats(film)}
    video = next(s for s in report["inspect"]["streams"] if s["type"] == "video")
    audio = [s for s in report["inspect"]["streams"] if s["type"] == "audio"]
    report["pass"] = {
        "duration60s": check["evidence"]["predicates"]["sixty_seconds"] is True,
        "fullHD": (video["width"], video["height"]) == (1920, 1080),
        "h264": video["codec"] == "h264",
        "hasAudio": bool(audio) and audio[0]["codec"] == "aac",
        "loudnessNearMinus16": report["integratedLoudnessLUFS"] is not None and abs(report["integratedLoudnessLUFS"] + 16) <= 1.5,
        "noUnintendedBlack": all(float(start) < 1.0 or float(end) > 58.5 for start, end in report["blackSegmentsOver0_5s"]),
    }
    (out / "VID-film-report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report["pass"], indent=2))


if __name__ == "__main__":
    main()
