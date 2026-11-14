#!/usr/bin/env python3
"""Resumable, bounded shallow cloning of the OCADE 246-source research inventory."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
URL = re.compile(r"^(\d{3})\. (https://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+))$")
CANONICAL = {80: "https://github.com/bytedance/UI-TARS"}
DUPLICATES = {187: 78}  # All-Hands-AI/OpenHands resolves to OpenHands/OpenHands.


def revision(folder: Path) -> str:
    result = subprocess.run(["git", "-C", str(folder), "rev-parse", "HEAD"],
                            capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else "unknown"


def clone(entry: tuple[int, str, str, str], target: Path) -> dict:
    number, original, owner, repo = entry
    location = target / f"{number:03d}-{owner}-{repo}"
    result = {"number": number, "requested": original, "path": str(location.relative_to(HERE))}
    if number in DUPLICATES:
        return {**result, "status": "alias", "same_source_as": DUPLICATES[number]}
    if location.exists():
        if (location / ".git").exists():
            return {**result, "status": "existing", "commit": revision(location)}
        return {**result, "status": "blocked", "reason": "Destination exists but is not a Git checkout"}

    source = CANONICAL.get(number, original)
    temporary = Path(tempfile.mkdtemp(prefix=f".partial-{number:03d}-", dir=target))
    try:
        env = {**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_LFS_SKIP_SMUDGE": "1"}
        command = ["git", "clone", "--quiet", "--depth", "1", "--filter=blob:none",
                   "--single-branch", source, str(temporary)]
        process = subprocess.run(command, capture_output=True, text=True,
                                 env=env, timeout=900)
        if process.returncode != 0:
            return {**result, "status": "failed", "source": source,
                    "error": process.stderr.strip()[-500:]}
        temporary.rename(location)
        return {**result, "status": "cloned", "source": source, "commit": revision(location)}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {**result, "status": "failed", "source": source, "error": str(exc)[-500:]}
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jobs", type=int, default=2, help="Concurrent clones (1–4, default 2)")
    parser.add_argument("--limit", type=int, default=246, help="Process only the first N entries")
    parser.add_argument("--dry-run", action="store_true", help="List destinations without cloning")
    options = parser.parse_args()
    if not (1 <= options.jobs <= 4 and 1 <= options.limit <= 246):
        parser.error("--jobs must be 1–4 and --limit must be 1–246")
    rows = []
    for line in (HERE / "repos.txt").read_text(encoding="utf-8").splitlines():
        match = URL.fullmatch(line.strip())
        if match:
            number, url, owner, repo = match.groups()
            rows.append((int(number), url, owner, repo))
        elif line.strip() and not line.lstrip().startswith("#"):
            raise ValueError(f"Invalid inventory entry: {line!r}")
    if len(rows) != 246 or [x[0] for x in rows] != list(range(1, 247)):
        raise ValueError("Inventory must contain exactly 246 sequential, numbered URLs")
    rows = rows[:options.limit]
    if options.dry_run:
        for number, url, owner, repo in rows:
            print(f"{number:03d}: {url} -> checkouts/{number:03d}-{owner}-{repo}")
        return 0
    target = HERE / "checkouts"
    target.mkdir(exist_ok=True)
    status_file = target / "clone-status.json"
    results = {}
    if status_file.exists():
        results = {str(x["number"]): x for x in json.loads(status_file.read_text(encoding="utf-8"))}
    with ThreadPoolExecutor(max_workers=options.jobs) as pool:
        futures = {pool.submit(clone, entry, target): entry[0] for entry in rows}
        for done in as_completed(futures):
            record = done.result()
            results[str(record["number"])] = record
            staging = target / ".clone-status.tmp"
            staging.write_text(json.dumps(sorted(results.values(), key=lambda x: x["number"]),
                                          indent=2) + "\n", encoding="utf-8")
            staging.replace(status_file)
            print(f"{record['number']:03d}: {record['status']} {record.get('error', '')}", flush=True)
    failed = [r for r in results.values() if r["number"] <= options.limit
              and r["status"] in ("failed", "blocked")]
    print(f"Completed inventory entries: {options.limit}; unresolved: {len(failed)}; "
          f"log: {status_file}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
