"""Acceptance runner for media tasks (plan.md M1–M3): executes a plan file through the real
gateway and workers, then the separate verifier, and writes a timed report.

    PYTHONPATH=device-agent/windows python -m tests.qualify_media <plan.json> <inputs-dir> <report.json>

Not a unit test and not production routing: the plan file holds the steps a planner chose
(its author is recorded in the plan itself), so a run proves OCADE's hands and verifier, and
the timing of each phase, never that the production planner chose those steps.
"""

import hashlib
import json
import platform
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import anyio

from ocade_agent.gateway import PROTOCOL, Gateway
from tests.test_web import intent as short_intent


def intent(operation: str, arguments: dict) -> dict:
    """An intent whose deadline allows the operation's own time bound, as the planner sets it."""
    step = short_intent(operation, arguments)
    seconds = PROTOCOL["operations"][operation].get("seconds", 300) + 60
    step["deadlineUtc"] = (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat().replace("+00:00", "Z")
    return step


def utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def main() -> None:
    plan_path, inputs, report_path = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    plan = json.loads(plan_path.read_text())
    workspace = Path(tempfile.mkdtemp())
    for name in plan.get("inputs", []):
        shutil.copy(inputs / name, workspace / name)
    before = {name: hashlib.sha256((workspace / name).read_bytes()).hexdigest() for name in plan.get("inputs", [])}
    started_at, started = utc(), time.monotonic()
    log = []

    async def go():
        async with Gateway(str(workspace), home=tempfile.mkdtemp()) as gateway:
            for step in plan["steps"] + [{"op": "verify.checks", "args": {"checks": plan["checks"]}, "phase": "verify"}]:
                begun = utc()
                result = await gateway.run(intent(step["op"], step["args"]), gateway.epoch)
                log.append({"op": step["op"], "phase": step.get("phase", "act"), "startedAt": begun, "endedAt": utc(),
                            "status": result["status"], "error": result.get("errorCode"),
                            "durationMs": result["evidence"].get("durationMs"),
                            "evidence": {k: v for k, v in result["evidence"].items() if k != "durationMs"}})
                print(json.dumps({k: log[-1][k] for k in ("op", "status", "error", "durationMs")}), flush=True)
                if result["status"] != "observed":
                    return

    anyio.run(go)
    verified_at = utc()
    delivered = Path(plan.get("deliverTo", report_path.parent))
    delivered.mkdir(parents=True, exist_ok=True)
    for name in plan.get("deliver", []):
        if (workspace / name).is_file():
            shutil.copy(workspace / name, delivered / Path(name).name)
    delivered_at, total = utc(), time.monotonic() - started
    phases: dict[str, float] = {}
    for entry in log:
        phases[entry["phase"]] = round(phases.get(entry["phase"], 0) + (entry["durationMs"] or 0), 1)
    verdict = log[-1]["evidence"].get("predicates", {}) if log and log[-1]["op"] == "verify.checks" else {}
    report = {
        "task": plan["task"],
        "planAuthor": plan["planAuthor"],
        "acceptedAt": plan.get("acceptedAt", started_at),
        "runStartedAt": started_at,
        "verifiedAt": verified_at,
        "deliveredAt": delivered_at,
        "runElapsedMs": round(total * 1000, 1),
        "activeExecutionMs": round(sum(entry["durationMs"] or 0 for entry in log), 1),
        "phaseMs": phases,
        "steps": log,
        "checks": verdict,
        "passed": bool(verdict) and all(value is True for value in verdict.values()),
        "inputsUnchanged": all(
            hashlib.sha256((workspace / name).read_bytes()).hexdigest() == digest for name, digest in before.items()),
        "environment": {
            "os": platform.platform(), "python": platform.python_version(),
            "commit": subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip(),
            "ffmpeg": (subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True).stdout.split("\n")[0]
                       if shutil.which("ffmpeg") else None),
        },
    }
    report_path.write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in ("passed", "checks", "runElapsedMs", "activeExecutionMs", "phaseMs")}, indent=2))


if __name__ == "__main__":
    main()
