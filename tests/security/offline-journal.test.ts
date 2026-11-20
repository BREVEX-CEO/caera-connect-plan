/**
 * Offline unsent turns are private to their account (plan 14B.2): A writes offline, signs out
 * (locked, not erased), B signs in on the same browser and sees nothing of A's, A signs in again
 * and gets exactly their turns back; deleting A erases them. Real AES-GCM, IndexedDB in memory.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

type Journal = typeof import("../../src/lib/chat/unsynced-turns.ts");
let journal: Journal;
let workDir: string;

before(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), "ocade-journal-"));
  const outfile = path.join(workDir, "journal.mjs");
  await build({
    entryPoints: [path.resolve(import.meta.dirname, "../../src/lib/chat/unsynced-turns.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  journal = await import(pathToFileURL(outfile).href);
});

after(() => rmSync(workDir, { recursive: true, force: true }));

const turn = (clientKey: string, content: string) => ({
  clientKey,
  conversationId: "c1",
  role: "user" as const,
  content,
  modelId: null,
  providerId: null,
  attachments: [],
  createdAt: new Date().toISOString(),
});

test("A → sign out → B → A: B never sees A's turns, A gets them back", async () => {
  await journal.openJournal("account-a");
  assert.equal(await journal.rememberUnsyncedTurn(turn("a1", "A's private offline note")), true);

  journal.lockJournal("account-a");
  assert.deepEqual(journal.unsyncedTurns(), [], "locked: nothing decrypted stays in memory");

  await journal.openJournal("account-b");
  assert.deepEqual(journal.unsyncedTurns(), [], "B sees none of A's turns");
  assert.equal(await journal.rememberUnsyncedTurn(turn("b1", "B's note")), true);
  journal.lockJournal("account-b");

  await journal.openJournal("account-a");
  assert.deepEqual(
    journal.unsyncedTurns().map((t) => t.content),
    ["A's private offline note"],
    "A reopens exactly their own turns",
  );
});

test("a lock for another account leaves the open one alone", async () => {
  await journal.openJournal("account-a");
  journal.lockJournal("account-b");
  assert.equal(journal.unsyncedTurns().length, 1);
});

test("deleting an account erases its turns; the other account's survive", async () => {
  await journal.forgetAllUnsyncedTurns("account-a");
  await journal.openJournal("account-a");
  assert.deepEqual(journal.unsyncedTurns(), []);
  journal.lockJournal("account-a");
  await journal.openJournal("account-b");
  assert.deepEqual(
    journal.unsyncedTurns().map((t) => t.content),
    ["B's note"],
  );
});

test("the stored rows are ciphertext, never the typed words", async () => {
  const rows: { data: ArrayBuffer }[] = await new Promise((resolve, reject) => {
    const request = indexedDB.open("ocade-offline-journal", 1);
    request.onsuccess = () => {
      const read = request.result.transaction("turns").objectStore("turns").getAll();
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    };
    request.onerror = () => reject(request.error);
  });
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.doesNotMatch(new TextDecoder().decode(row.data), /note/);
  }
});
