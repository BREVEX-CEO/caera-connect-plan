"""The local action journal (plan.md §11, P15): intent before effect, receipt after.

A crash, restart or lost acknowledgement must never repeat an effect blindly.
Before dispatch the intent is written as `started`; after, the receipt as
`finished`. When the server hands back an action this device already holds:

- `finished`: resend the stored receipt; the action is not run again. The first
  finished receipt is immutable even when two companions race to finish.
- `started` and an audited pure local inspection: it may run again.
- Other `started` actions, including opaque operations declared as reads: the
  effect may have happened. Report `unknown` / `maybeChanged` and reconcile.
- A repeated activity id must carry the same immutable intent. A mismatch is
  refused without replacing the original intent, state or receipt.

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

    def start(self, activity: str, intent: dict) -> bool:
        """Atomically claim a new action; an existing id keeps its original intent."""
        cursor = self.db.execute(
            "INSERT INTO actions (activity, intent, state) VALUES (?, ?, 'started')"
            " ON CONFLICT (activity) DO NOTHING",
            (activity, json.dumps(intent)),
        )
        return cursor.rowcount == 1

    def matches(self, activity: str, intent: dict) -> bool:
        """Compare durable intent identity, ignoring only JSON object key order."""
        row = self.db.execute("SELECT intent FROM actions WHERE activity = ?", (activity,)).fetchone()
        if row is None:
            return False
        saved = json.dumps(json.loads(row[0]), sort_keys=True, separators=(",", ":"))
        received = json.dumps(intent, sort_keys=True, separators=(",", ":"))
        return saved == received

    def finish(self, activity: str, receipt: dict) -> dict:
        """First finish wins; every contender receives that exact durable receipt."""
        self.db.execute(
            "UPDATE actions SET state = 'finished', receipt = ? WHERE activity = ? AND state = 'started'",
            (json.dumps(receipt), activity),
        )
        row = self.db.execute(
            "SELECT receipt FROM actions WHERE activity = ? AND state = 'finished'", (activity,)
        ).fetchone()
        if row is None or row[0] is None:
            raise ValueError("journal_action_not_finished")
        return json.loads(row[0])
