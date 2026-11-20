"""Watched folders (plan REPO-61/71): the person asked JARVIS to do something whenever a new file
arrives in one folder of this computer's JARVIS folder. This module notices new files itself:
a cheap directory listing every few seconds, no model call, nothing read inside any file. A file
counts once its size and modification time stay the same across two looks (so a download in
progress is not reported half-written); the server turns each new file into one scheduled run,
and refuses a second report of the same file.

Only regular files directly in a watched folder count; hidden and temporary download files are
ignored; a folder that leaves the JARVIS folder (`..`, a link elsewhere) is never listed.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

LOOK_SECONDS = 10.0
RULES_SECONDS = 300.0
MAX_ENTRIES = 1000
TEMPORARY = (".tmp", ".part", ".crdownload", ".download", ".partial")


def inside(workspace: Path, folder: str) -> Path | None:
    """The watched folder, only when it is really inside the JARVIS folder."""
    root = workspace.resolve()
    try:
        target = (root / folder).resolve()
        target.relative_to(root)
    except (OSError, ValueError):
        return None
    return target if target.is_dir() else None


def listing(folder: Path) -> dict[str, list[int]]:
    """Name to [size, modified ns] for the folder's own regular files, at most MAX_ENTRIES."""
    found: dict[str, list[int]] = {}
    try:
        with os.scandir(folder) as entries:
            for entry in entries:
                name = entry.name
                if name.startswith((".", "~$")) or name.lower().endswith(TEMPORARY):
                    continue
                try:
                    if not entry.is_file(follow_symlinks=False):
                        continue
                    facts = entry.stat(follow_symlinks=False)
                except OSError:
                    continue
                found[name] = [facts.st_size, facts.st_mtime_ns]
                if len(found) >= MAX_ENTRIES:
                    break
    except OSError:
        return {}
    return found


class Watcher:
    def __init__(self, workspace: Path, home: Path):
        self.workspace, self.path = workspace, home / "watches.json"
        self.rules: list[dict] = []
        self.rules_at = 0.0
        self.looked_at = 0.0
        try:
            self.state: dict = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            self.state = {}

    def due(self, now: float) -> bool:
        return now - self.looked_at >= LOOK_SECONDS

    def set_rules(self, rules: list[dict], now: float) -> None:
        self.rules = [r for r in rules if isinstance(r, dict) and isinstance(r.get("id"), str)
                      and isinstance(r.get("folder"), str)][:10]
        self.rules_at = now
        kept = {r["id"] for r in self.rules}
        self.state = {key: value for key, value in self.state.items() if key in kept}
        self._save()

    def look(self, now: float) -> list[dict]:
        """New, settled files since the last look: [{watchId, file, key}]."""
        self.looked_at = now
        events = []
        for rule in self.rules:
            folder = inside(self.workspace, rule["folder"])
            if folder is None:
                continue
            seen = listing(folder)
            state = self.state.get(rule["id"])
            if state is None:  # the first look is the starting point: files already there count as known
                self.state[rule["id"]] = {"known": seen, "settling": {}}
                continue
            known, settling = state["known"], state["settling"]
            for name, facts in seen.items():
                if known.get(name) == facts:
                    continue
                if settling.get(name) == facts:
                    events.append({"watchId": rule["id"], "file": name, "key": f"{name}:{facts[0]}:{facts[1]}"})
                else:
                    settling[name] = facts
            for name in list(settling):
                if name not in seen:
                    settling.pop(name)
            for name in list(known):
                if name not in seen:
                    known.pop(name)
        self._save()
        return events

    def reported(self, event: dict) -> None:
        """The server has a final answer for this file: it is known now."""
        state = self.state.get(event["watchId"])
        if state is None:
            return
        facts = state["settling"].pop(event["file"], None)
        if facts is not None:
            state["known"][event["file"]] = facts
        self._save()

    def _save(self) -> None:
        try:
            temporary = self.path.with_name(f".{self.path.name}.tmp")
            temporary.write_text(json.dumps(self.state), encoding="utf-8")
            os.replace(temporary, self.path)
        except OSError:
            pass
