"""Long-duration stability harness (requirement 191; resource use for 96).

Runs the real gateway and its MCP workers through repeated representative cycles (write a
text file, read it back, list the folder, write a workbook, verify the results) and samples
the whole process tree after every cycle: resident memory, CPU time, open files, threads and
child processes, and the workspace's disk use. It reports growth after a warm-up and fails on:

- memory that keeps growing (a leak),
- a call that does not return within its bound (an output-pipe hang),
- worker processes still alive after the gateway closed (orphans),
- open files or threads that keep growing (unreleased handles),
- disk use beyond what the cycles wrote.

Short runs are part of the companion suite (`tests/test_stability.py`); a long qualification
run is `python -m tests.stability --minutes 240 --out <folder>` on the target computer.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import time
from pathlib import Path

import anyio
import psutil

from ocade_agent.gateway import Gateway
from tests.test_gateway import intent

CALL_BOUND = 60  # seconds; a call that takes longer counts as a hang


def _tree(process: psutil.Process) -> list[psutil.Process]:
    try:
        return [process, *process.children(recursive=True)]
    except psutil.NoSuchProcess:
        return []


def sample(process: psutil.Process, workspace: Path) -> dict:
    rss = cpu = files = threads = 0
    members = _tree(process)
    for member in members:
        try:
            with member.oneshot():
                rss += member.memory_info().rss
                times = member.cpu_times()
                cpu += times.user + times.system
                threads += member.num_threads()
                files += member.num_handles() if os.name == "nt" else len(member.open_files())
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    disk = sum(path.stat().st_size for path in workspace.rglob("*") if path.is_file())
    return {"rssBytes": rss, "cpuSeconds": round(cpu, 3), "openFiles": files, "threads": threads,
            "children": len(members) - 1, "diskBytes": disk}


async def _cycle(gateway: Gateway, index: int) -> list[dict]:
    name = f"OCADE output/stability/{index}.txt"
    book = f"OCADE output/stability/{index}.xlsx"
    steps = [
        ("fs.write_text", {"path": name, "text": f"cycle {index}\n" * 50}),
        ("fs.read_text", {"path": name}),
        ("fs.list", {"path": "OCADE output/stability"}),
        ("office.write_workbook", {"path": book, "sheets": [{"name": "S", "rows": [[index], [2], ["=A1+A2"]]}]}),
        ("verify.checks", {"checks": [
            {"id": "text", "kind": "file_contains", "description": "text", "params": {"path": name, "text": f"cycle {index}"}},
            {"id": "book", "kind": "file_parses", "description": "book", "params": {"path": book}},
        ]}),
    ]
    receipts = []
    for operation, arguments in steps:
        with anyio.fail_after(CALL_BOUND):
            receipts.append(await gateway.run(intent(operation, arguments), gateway.epoch))
    return receipts


def _slope(values: list[float]) -> float:
    """Least-squares growth per cycle."""
    n = len(values)
    if n < 2:
        return 0.0
    mean_x, mean_y = (n - 1) / 2, sum(values) / n
    spread = sum((x - mean_x) ** 2 for x in range(n))
    return sum((x - mean_x) * (y - mean_y) for x, y in enumerate(values)) / spread


def run(cycles: int | None = None, minutes: float | None = None, warmup: int = 3) -> dict:
    workspace = Path(tempfile.mkdtemp(prefix="ocade-stability-"))
    home = Path(tempfile.mkdtemp(prefix="ocade-stability-home-"))
    me = psutil.Process()
    samples, failures, hangs = [], [], 0
    started = time.monotonic()
    workers: list[int] = []

    async def go() -> None:
        nonlocal hangs
        async with Gateway(str(workspace), home=str(home)) as gateway:
            index = 0
            while (cycles is None or index < cycles) and (minutes is None or time.monotonic() - started < minutes * 60):
                try:
                    receipts = await _cycle(gateway, index)
                except TimeoutError:
                    hangs += 1
                    break
                bad = [r for r in receipts if r["status"] != "observed"]
                if bad:
                    failures.append({"cycle": index, "receipt": bad[0]})
                samples.append({"cycle": index, **sample(me, workspace)})
                index += 1
            workers.extend(child.pid for child in me.children(recursive=True))

    try:
        anyio.run(go)
        time.sleep(0.5)
        orphans = [pid for pid in workers if psutil.pid_exists(pid) and psutil.Process(pid).status() != psutil.STATUS_ZOMBIE]
        steady = samples[warmup:] or samples
        rss_growth = _slope([s["rssBytes"] for s in steady])
        files_growth = _slope([s["openFiles"] for s in steady])
        threads_growth = _slope([s["threads"] for s in steady])
        written = sum(len(f"cycle {i}\n") * 50 for i in range(len(samples)))
        report = {
            "cycles": len(samples), "seconds": round(time.monotonic() - started, 1),
            "first": samples[0] if samples else None, "last": samples[-1] if samples else None,
            "rssGrowthBytesPerCycle": round(rss_growth), "openFilesGrowthPerCycle": round(files_growth, 3),
            "threadsGrowthPerCycle": round(threads_growth, 3), "hangs": hangs, "failedCycles": failures[:5],
            "orphanWorkers": orphans, "peakRssBytes": max((s["rssBytes"] for s in samples), default=0),
            "cpuSecondsPerCycle": round((samples[-1]["cpuSeconds"] - samples[0]["cpuSeconds"]) / max(1, len(samples) - 1), 4)
            if len(samples) > 1 else None,
        }
        problems = []
        if hangs:
            problems.append("a call did not return within its bound")
        if failures:
            problems.append("a cycle step did not complete")
        if orphans:
            problems.append("worker processes outlived the gateway")
        # More than 256 KiB per cycle after warm-up, sustained, is a leak, not allocator noise.
        if len(steady) >= 8 and rss_growth > 256 * 1024:
            problems.append("memory keeps growing")
        if len(steady) >= 8 and (files_growth > 0.5 or threads_growth > 0.5):
            problems.append("open files or threads keep growing")
        if samples and samples[-1]["diskBytes"] > written * 4 + 64 * 1024 * len(samples):
            problems.append("disk use beyond what the cycles wrote")
        report["problems"] = problems
        return report
    finally:
        shutil.rmtree(workspace, ignore_errors=True)
        shutil.rmtree(home, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--minutes", type=float, default=None)
    parser.add_argument("--cycles", type=int, default=None)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()
    report = run(cycles=args.cycles if args.cycles or args.minutes else 30, minutes=args.minutes)
    text = json.dumps(report, indent=2)
    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
        (args.out / "stability.json").write_text(text)
    print(text)
    return 1 if report["problems"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
