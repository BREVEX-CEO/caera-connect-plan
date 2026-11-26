import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRename,
  expectedRevision,
  RENAME_CONFLICT_MESSAGE,
} from "../../src/lib/chat/rename-sync.ts";
import type { OcadeConversationRow } from "../../src/lib/ocade.functions.ts";

const row = (id: string, title: string, title_revision?: number): OcadeConversationRow => ({
  id,
  title,
  pinned: false,
  archived: false,
  model_id: null,
  updated_at: "2026-11-26T10:00:00Z",
  created_at: "2026-11-26T10:00:00Z",
  ...(title_revision === undefined ? {} : { title_revision }),
});

test("a rename names the revision the list holds, and none for a row the account has not stored", () => {
  const rows = [row("a", "One", 3), row("b", "Two")];
  assert.equal(expectedRevision(rows, "a"), 3);
  assert.equal(expectedRevision(rows, "b"), undefined);
  assert.equal(expectedRevision(rows, "missing"), undefined);
});

test("an accepted rename keeps the title and the new revision and touches no other row", () => {
  const before = [row("a", "One", 3), row("b", "Two", 1)];
  const applied = applyRename(before, "a", "Renamed", { ok: true, titleRevision: 4 });
  assert.equal(applied.conflict, false);
  assert.deepEqual(
    applied.rows.map((r) => [r.id, r.title, r.title_revision]),
    [
      ["a", "Renamed", 4],
      ["b", "Two", 1],
    ],
  );
  assert.equal(before[0]!.title, "One", "the list it was given is not changed");
});

test("a rename from an out-of-date copy applies nothing and says why", () => {
  const before = [row("a", "One", 3)];
  const applied = applyRename(before, "a", "Stale", { ok: false, conflict: true });
  assert.equal(applied.conflict, true);
  assert.equal(applied.rows, before);
  assert.match(RENAME_CONFLICT_MESSAGE, /another device/);
});

test("an accepted rename without a revision keeps the old one rather than inventing one", () => {
  const applied = applyRename([row("a", "One", 3)], "a", "Renamed", { ok: true });
  assert.equal(applied.rows[0]!.title_revision, 3);
});
