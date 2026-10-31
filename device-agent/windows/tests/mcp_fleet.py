"""Measures the MCP dictionary's real limits on this machine (plan.md §6.4). Not a pass/fail test.

    python -m tests.mcp_fleet [output.json]

Reports separately: manifests indexed (catalog size), servers active at once
(processes), activation latency, resident memory per active server, and the
number of tool schemas a planner turn receives (bounded by routing, not by size).
"""

import json
import os
import sys
import tempfile
import time
from pathlib import Path

import anyio

from ocade_agent import catalog
from ocade_agent.gateway import Gateway
from tests.test_catalog import manifest
from tests.test_web import intent


def rss_kb(pid: int) -> int:
    try:
        for line in Path(f"/proc/{pid}/status").read_text().splitlines():
            if line.startswith("VmRSS:"):
                return int(line.split()[1])
    except OSError:
        pass
    return 0


def children_rss_kb() -> tuple[int, int]:
    me = os.getpid()
    total, count = 0, 0
    for entry in Path("/proc").iterdir():
        if entry.name.isdigit():
            try:
                if int((entry / "stat").read_text().split()[3]) == me:
                    total, count = total + rss_kb(int(entry.name)), count + 1
            except OSError:
                continue
    return total, count


def main() -> None:
    results = {"catalog": [], "active": []}
    for size in (10, 100, 1000, 5000):
        home = Path(tempfile.mkdtemp())
        (home / "mcp").mkdir()
        for index in range(size):
            (home / "mcp" / f"{index}.json").write_text(json.dumps(manifest(id=f"s{index}")))
        started = time.perf_counter()
        accepted, rejected = catalog.load(home)
        results["catalog"].append({"manifests": size, "trusted": len(accepted), "rejected": len(rejected),
                                   "loadSeconds": round(time.perf_counter() - started, 3)})

    home = Path(tempfile.mkdtemp())
    (home / "mcp").mkdir()
    for index in range(16):
        (home / "mcp" / f"{index}.json").write_text(json.dumps(manifest(id=f"s{index}")))
    external, _ = catalog.load(home)
    for active in (1, 2, 4, 8, 16):
        async def go():
            async with Gateway(tempfile.mkdtemp(), external=external, max_external=active) as gateway:
                started = time.perf_counter()
                async with anyio.create_task_group() as group:
                    for index in range(active):
                        group.start_soon(gateway.run, intent("mcp.read", {"server": f"s{index}", "tool": "echo",
                                                                           "arguments": {"text": "x"}}), 0)
                elapsed = time.perf_counter() - started
                memory, processes = children_rss_kb()
                return elapsed, memory, processes

        elapsed, memory, processes = anyio.run(go)
        results["active"].append({"servers": active, "activateAndCallSeconds": round(elapsed, 2),
                                  "workerProcesses": processes, "rssMiB": round(memory / 1024, 1),
                                  "rssMiBPerServer": round(memory / 1024 / max(processes, 1), 1)})
    results["planner"] = {"maxExternalToolSchemasPerTurn": 12, "note": "routeExternalTools caps what a turn sees"}
    text = json.dumps(results, indent=2)
    print(text)
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(text)


if __name__ == "__main__":
    main()
