import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WORK DONE OFFLINE HAS TO REACH THE ACCOUNT.
 *
 * The buffer had a writer and a reader and nothing that drained it. A turn
 * produced while the database was unreachable was held in the tab, shown as
 * unsynchronised, and then lost when the tab closed — the synchronisation
 * `PLAN.md` Phase 8 is about never ran at all. Its own documentation described
 * a flush and an in-flight guard; the guard was unused and the flush did not
 * exist.
 *
 * The server mock refuses a second row for a key it has already seen, which is
 * what the real `appendOcadeMessage` does. That is where exactly-once actually
 * lives, so the tests below assert against it rather than against the drain's
 * own bookkeeping.
 */
const appended: string[] = [];
const created: string[] = [];
let failNext = false;

vi.mock("@/lib/ocade.functions", () => ({
  appendOcadeMessage: vi.fn(async ({ data }: { data: { clientKey: string } }) => {
    if (failNext) throw new Error("network");
    if (appended.includes(data.clientKey)) return null; // The server's own guard.
    appended.push(data.clientKey);
    return { id: data.clientKey };
  }),
  createConversation: vi.fn(async ({ data }: { data: { id: string } }) => {
    if (failNext) throw new Error("network");
    created.push(data.id);
    return { id: data.id };
  }),
  listMessages: vi.fn(async () => []),
}));

/** A fresh module graph is what a browser restart gives the journal. */
async function boot(account: string) {
  vi.resetModules();
  const journal = await import("@/lib/chat/unsynced-turns");
  const store = await import("@/lib/ocade-chat-store");
  await journal.openJournal(account);
  return { ...journal, ...store };
}

let app: Awaited<ReturnType<typeof boot>>;
const flushUnsyncedTurns = () => app.flushUnsyncedTurns();
const unsyncedTurns = () => app.unsyncedTurns();

function waiting(clientKey: string, createdAt: string) {
  app.rememberUnsyncedTurn({
    clientKey,
    conversationId: "c1",
    role: "user",
    content: `held ${clientKey}`,
    modelId: null,
    providerId: null,
    attachments: [],
    createdAt,
  });
}

beforeEach(async () => {
  app = await boot("account-a");
});

afterEach(async () => {
  await app.forgetAllUnsyncedTurns("account-a");
  appended.length = 0;
  created.length = 0;
  failNext = false;
});

describe("turns written while the database was unreachable", () => {
  it("are uploaded when it becomes reachable", async () => {
    waiting("k1", "2026-01-01T00:00:00.000Z");
    waiting("k2", "2026-01-01T00:00:01.000Z");

    expect(await flushUnsyncedTurns()).toEqual({ uploaded: 2, waiting: 0 });
    expect(appended).toEqual(["k1", "k2"]);
  });

  it("are uploaded oldest first, so a transcript reads in order", async () => {
    waiting("later", "2026-01-01T00:00:09.000Z");
    waiting("earlier", "2026-01-01T00:00:01.000Z");

    await flushUnsyncedTurns();
    expect(appended).toEqual(["earlier", "later"]);
  });

  it("survive a drain that fails, rather than being forgotten", async () => {
    waiting("k1", "2026-01-01T00:00:00.000Z");
    failNext = true;

    expect(await flushUnsyncedTurns()).toEqual({ uploaded: 0, waiting: 1 });
    expect(unsyncedTurns()).toHaveLength(1);

    // And the next reconnect gets them there.
    failNext = false;
    expect(await flushUnsyncedTurns()).toEqual({ uploaded: 1, waiting: 0 });
    expect(appended).toEqual(["k1"]);
  });

  it("produce one row however many times a reconnect fires", async () => {
    waiting("k1", "2026-01-01T00:00:00.000Z");

    // Two drains racing, then a third afterwards: the tab reconnecting twice,
    // or two tabs draining the same account at the same moment.
    await Promise.all([flushUnsyncedTurns(), flushUnsyncedTurns()]);
    await flushUnsyncedTurns();

    expect(appended).toEqual(["k1"]);
    expect(unsyncedTurns()).toHaveLength(0);
  });
});

describe("after the browser restarts", () => {
  /*
   * Until the encrypted write has reached the journal, not for a fixed 20 ms: under load
   * (a busy machine, the whole suite at once) the write took longer and the "restart"
   * read an empty journal.
   */
  const stored = () =>
    new Promise<number>((resolve) => {
      const open = indexedDB.open("ocade-offline-journal");
      open.onsuccess = () => {
        const names = open.result.objectStoreNames;
        if (!names.contains("turns")) return resolve(0);
        const count = open.result.transaction("turns").objectStore("turns").count();
        count.onsuccess = () => resolve(count.result);
      };
      open.onerror = () => resolve(0);
    });
  const settle = async (want: "some" | "none" = "some") => {
    const done = async () => (await stored()) > 0 === (want === "some");
    for (let waited = 0; waited < 3000 && !(await done()); waited += 20) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  };

  it("are still there, encrypted, and upload exactly once", async () => {
    waiting("r1", "2026-01-01T00:00:00.000Z");
    await settle();

    // Nothing readable on disk: the journal holds ciphertext only.
    const raw = await new Promise<unknown[]>((resolve) => {
      const open = indexedDB.open("ocade-offline-journal");
      open.onsuccess = () => {
        const all = open.result.transaction("turns").objectStore("turns").getAll();
        all.onsuccess = () => resolve(all.result);
      };
    });
    expect(JSON.stringify(raw)).not.toContain("held r1");

    app = await boot("account-a");
    expect(unsyncedTurns().map((turn) => turn.clientKey)).toEqual(["r1"]);
    expect(await flushUnsyncedTurns()).toEqual({ uploaded: 1, waiting: 0 });
    await settle("none");

    app = await boot("account-a");
    expect(unsyncedTurns()).toEqual([]);
    expect(appended).toEqual(["r1"]);
  });

  it("belong to their account and no other", async () => {
    waiting("mine", "2026-01-01T00:00:00.000Z");
    await settle();
    app = await boot("account-b");
    expect(unsyncedTurns()).toEqual([]);
    app = await boot("account-a");
    expect(unsyncedTurns()).toHaveLength(1);
  });

  it("are deleted with their key when the account signs out", async () => {
    waiting("gone", "2026-01-01T00:00:00.000Z");
    await settle();
    await app.forgetAllUnsyncedTurns("account-a");
    app = await boot("account-a");
    expect(unsyncedTurns()).toEqual([]);
  });

  it("create a chat that was started offline before its first turn", async () => {
    app.rememberUnsyncedTurn({
      clientKey: "t1",
      conversationId: "11111111-1111-4111-8111-111111111111",
      title: "Started offline",
      role: "user",
      content: "hello",
      modelId: null,
      providerId: null,
      attachments: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await flushUnsyncedTurns();
    expect(created).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(appended).toEqual(["t1"]);
  });
});
