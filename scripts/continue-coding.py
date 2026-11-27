#!/usr/bin/env python3
"""Stop hook: do not let a turn end while authorized coding items remain open.

The queue is Part 0A of PROGRESS.md: every line `- [ ] N.` that is not marked BLOCKED is open work.
A turn may end only when: no such item is open; the owner created `.claude/OWNER_STOP` (STOP, WAIT, PAUSE
or HOLD); or four consecutive stop attempts happened with no new commit and no change in the open count
(an agent that cannot make progress must say what is blocked, mark the item BLOCKED in PROGRESS.md and
move to another item, not loop). Exit code 2 sends the message on stderr back to the agent.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

LIMIT_WITHOUT_PROGRESS = 4


def git(*args: str) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True, check=False).stdout.strip()


def open_items(text: str) -> list[str]:
    section = re.search(r"^## Part 0A.*?(?=^## )", text, re.S | re.M)
    if not section:
        return []
    return [line for line in section.group(0).splitlines()
            if re.match(r"- \[ \] \d+\.", line) and "BLOCKED" not in line]


def main() -> int:
    root = Path(git("rev-parse", "--show-toplevel") or ".")
    if (root / ".claude" / "OWNER_STOP").exists():
        return 0
    progress = root / "PROGRESS.md"
    if not progress.is_file():
        return 0
    items = open_items(progress.read_text(encoding="utf-8"))
    if not items:
        return 0
    state_file = Path(git("rev-parse", "--git-dir") or ".git") / "continue-coding.json"
    try:
        state = json.loads(state_file.read_text())
    except (OSError, ValueError):
        state = {}
    mark = {"head": git("rev-parse", "HEAD"), "open": len(items)}
    blocked = state.get("blocks", 0) + 1 if {k: state.get(k) for k in mark} == mark else 1
    state_file.write_text(json.dumps({**mark, "blocks": blocked}))
    if blocked > LIMIT_WITHOUT_PROGRESS:
        print(f"continue-coding: {len(items)} items still open but {LIMIT_WITHOUT_PROGRESS} stop attempts "
              "made no commit; allowing the stop. Record the blocker in PROGRESS.md.", file=sys.stderr)
        return 0
    first = "; ".join(line[:90] for line in items[:3])
    print(f"Do not stop: {len(items)} coding items are still open in PROGRESS.md Part 0A (first: {first}). "
          "Audit the next one against plan.md and the code, implement what is missing, test it, record it in "
          "PROGRESS.md, commit and push, then take the next item. If one item is truly blocked, mark it "
          "BLOCKED with the reason and move to another. A push, a dispatched matrix or pending CI is not a "
          "reason to stop.", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
