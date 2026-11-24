#!/usr/bin/env python3
"""Bounded Stop hook. The ledger is not proof; Opus + actual CI must verify it."""
import hashlib, json, re, subprocess, sys
from pathlib import Path

TASKS = Path("TASKS.md")
MAX_STALLS = 5
ITEM = re.compile(r"^([ \t]*)[-*] \[([ xX!])\] (.+)$", re.M)
SHA = re.compile(r"^Final verification: PASS ([0-9a-f]{40})\s*$", re.M)

def state_path():
    git_dir = subprocess.check_output(["git", "rev-parse", "--absolute-git-dir"], text=True).strip()
    return Path(git_dir) / "ocade-autopilot.json"

def block(reason):
    print(reason, file=sys.stderr)
    return 2


def invalid_ledger(reason):
    print(reason, file=sys.stderr)
    return 1

def run():
    if not TASKS.exists():
        return invalid_ledger("Autopilot ledger missing. Restore/reconcile TASKS.md; do not claim completion.")
    text = TASKS.read_text(encoding="utf-8")
    status = re.search(r"^Status:\s*(RUNNING|PAUSED|BLOCKED|COMPLETE)\s*$", text, re.M)
    if not status:
        return invalid_ledger("Autopilot ledger has no valid status. Restore it; do not claim completion.")
    status = status.group(1)
    if status == "PAUSED":
        return 0
    rows = list(ITEM.finditer(text))
    open_rows = [m.group(3) for m in rows if m.group(2) == " "]
    blocked = [m.group(3) for m in rows if m.group(2) == "!"]
    # Also reject checked parents with unfinished nested children.
    invalid_parents = []
    parents = []
    for m in rows:
        indent = len(m.group(1).expandtabs(4))
        while parents and parents[-1][0] >= indent:
            parents.pop()
        if m.group(2) in (" ", "!"):
            invalid_parents.extend(p[2] for p in parents if p[1].lower() == "x")
        parents.append((indent, m.group(2), m.group(3)))
    has_final_tasks = all(re.search(r"^[-*] \[[ xX!]\] F"+str(i)+r"\.", text, re.M) for i in range(1, 5))
    receipt = SHA.search(text)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    complete = bool(rows and not open_rows and not blocked and not invalid_parents and has_final_tasks and receipt and receipt.group(1) == head)
    if complete and status == "COMPLETE":
        return 0
    if status == "BLOCKED" and blocked and not invalid_parents:
        print(f"Autopilot stopped BLOCKED, {len(blocked)} incomplete. No completion claim.", file=sys.stderr)
        return 0
    # Only a bounded series of stop-hook continuations; reset on a new turn.
    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        payload = {}
    path = state_path()
    try:
        state = json.loads(path.read_text())
    except (OSError, ValueError):
        state = {}
    # Stable per-row dispositions, not raw count: splitting cannot look like verified completion.
    ids = [m.group(3).split(" — map:",1)[0] for m in rows if m.group(2).lower() == "x"]
    digest = hashlib.sha256("\n".join(sorted(ids)).encode()).hexdigest()
    stalls = (state.get("stalls",0) + 1 if state.get("digest") == digest else 0) if payload.get("stop_hook_active") else 0
    path.write_text(json.dumps({"digest": digest, "stalls": stalls}))
    if stalls >= MAX_STALLS:
        print("Autopilot safety escape: no verified progress. Report PARTIAL/BLOCKED, not DONE; resume independent work when possible.", file=sys.stderr)
        return 0
    if invalid_parents:
        return block("Reopen checked parents with incomplete descendants: " + invalid_parents[0][:180])
    if open_rows:
        return block(f"Autopilot: {len(open_rows)} open, {len(blocked)} blocked (incomplete). Continue next dependency-ready authorized task; candidate/approval blockers must not trigger unauthorized actions. Next ledger item: {open_rows[0][:180]}")
    if blocked:
        return block(f"{len(blocked)} blocked tasks remain INCOMPLETE. Recheck dependencies, reopen resolvable work; if truly no actionable work, set BLOCKED and report, never COMPLETE.")
    if not complete:
        return block("Checklist exhausted, not complete. Add missing F1–F4 closure gates, reconcile current requirements, reopen gaps, obtain actual exact-SHA CI and Opus verification before recording PASS. Never fabricate a receipt.")
    return block("All ledger gates marked verified; set COMPLETE and issue the independent evidence report only if genuine verification exists.")

if __name__ == "__main__":
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Autopilot hook error: {exc}. Verification unavailable; report UNTESTED/BLOCKED, not DONE.", file=sys.stderr)
        sys.exit(1)
