"""The local action journal (plan.md §11, P15): intent before effect, receipt after.

A crash, restart or lost acknowledgement must never repeat an effect blindly.
Before dispatch the intent is written as `started`; after, the receipt as
`finished`. When the server hands back an action this device already holds:

- `finished`: resend the stored receipt; the action is not run again.
- `started` and the action only reads: run it again; reading changes nothing.
- `started` and the action writes: the effect may have happened. Report
  `unknown` / `maybeChanged` and let the task wait for reconciliation, rather
  than guess.

This is the device's record of its own receipts, not a second task authority.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path


class Journal:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, isolation_level=None)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS actions (activity TEXT PRIMARY KEY, intent TEXT NOT NULL,"
            " state TEXT NOT NULL CHECK (state IN ('started', 'finished')), receipt TEXT)"
        )

    def get(self, activity: str) -> tuple[str, dict | None] | None:
        row = self.db.execute("SELECT state, receipt FROM actions WHERE activity = ?", (activity,)).fetchone()
        return (row[0], json.loads(row[1]) if row[1] else None) if row else None

    def start(self, activity: str, intent: dict) -> None:
        self.db.execute(
            "INSERT INTO actions (activity, intent, state) VALUES (?, ?, 'started')"
            " ON CONFLICT (activity) DO NOTHING",
            (activity, json.dumps(intent)),
        )

    def finish(self, activity: str, receipt: dict) -> None:
        self.db.execute(
            "UPDATE actions SET state = 'finished', receipt = ? WHERE activity = ?",
            (json.dumps(receipt), activity),
        )
