/**
 * The rules that make background sync safe.
 *
 * Before this existed, `private_sync` wrote nothing to the device and had no
 * queue at all, so there was nothing to test: a message sent offline was
 * simply gone. These pin the properties that replaced that — no duplicates on
 * reconnect, no lost message on a failure, deletions that actually travel, and
 * a product-level state instead of a broken Chat when the server is down.
 */
import { describe, it, expect } from "vitest";
import {
  drainOutbox,
  backoffFor,
  MAX_BACKOFF_MS,
  ATTEMPTS_BEFORE_REPORTING,
  type OutboxEntry,
  type OutboxStore,
} from "../outbox";

function memoryStore(seed: OutboxEntry[] = []): OutboxStore & { entries: OutboxEntry[] } {
  const entries = [...seed];
  return {
    entries,
    async all() {
      return [...entries];
    },
    async put(entry) {
      const i = entries.findIndex((e) => e.id === entry.id);
      if (i >= 0) entries[i] = entry;
      else entries.push(entry);
    },
    async remove(id) {
      const i = entries.findIndex((e) => e.id === id);
      if (i >= 0) entries.splice(i, 1);
    },
  };
}

const entry = (over: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: "put:chats:a",
  kind: "message",
  conversationId: "c1",
  payload: { dataClass: "chats", id: "a", value: {} },
  queuedAt: "2026-01-01T00:00:00.000Z",
  attempts: 0,
  nextAttemptAt: 0,
  ...over,
});

describe("draining", () => {
  it("delivers and removes, so a reconnect cannot send twice", async () => {
    const store = memoryStore([entry()]);
    const seen: string[] = [];
    const deps = {
      store,
      deliver: async (e: OutboxEntry) => {
        seen.push(e.id);
        return { ok: true };
      },
      now: () => 1000,
      online: () => true,
    };
    await drainOutbox(deps);
    // A second drain, exactly as `online` firing twice would produce.
    await drainOutbox(deps);
    expect(seen).toEqual(["put:chats:a"]);
    expect(store.entries).toHaveLength(0);
  });

  it("keeps a failed entry rather than losing the message", async () => {
    const store = memoryStore([entry()]);
    const result = await drainOutbox({
      store,
      deliver: async () => ({ ok: false, reason: "network down" }),
      now: () => 1000,
      online: () => true,
    });
    expect(result.delivered).toBe(0);
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].attempts).toBe(1);
    expect(store.entries[0].lastError).toBe("network down");
  });

  it("does not retry before the backoff has elapsed", async () => {
    const store = memoryStore([entry({ attempts: 2, nextAttemptAt: 10_000 })]);
    let called = 0;
    await drainOutbox({
      store,
      deliver: async () => {
        called += 1;
        return { ok: true };
      },
      now: () => 5_000,
      online: () => true,
    });
    expect(called).toBe(0);
  });

  it("sends nothing at all while offline, and reports what is waiting", async () => {
    const store = memoryStore([entry(), entry({ id: "put:chats:b" })]);
    let called = 0;
    const result = await drainOutbox({
      store,
      deliver: async () => {
        called += 1;
        return { ok: true };
      },
      now: () => 1000,
      online: () => false,
    });
    expect(called).toBe(0);
    expect(result.remaining).toBe(2);
    expect(result.shouldReport).toBe(false);
  });

  it("sends oldest first, so a conversation does not read backwards", async () => {
    const store = memoryStore([
      entry({ id: "put:chats:c", queuedAt: "2026-01-01T00:00:03.000Z" }),
      entry({ id: "put:chats:a", queuedAt: "2026-01-01T00:00:01.000Z" }),
      entry({ id: "put:chats:b", queuedAt: "2026-01-01T00:00:02.000Z" }),
    ]);
    const order: string[] = [];
    await drainOutbox({
      store,
      deliver: async (e) => {
        order.push(e.id);
        return { ok: true };
      },
      now: () => 1000,
      online: () => true,
    });
    expect(order).toEqual(["put:chats:a", "put:chats:b", "put:chats:c"]);
  });

  it("drops an entry the server will never accept, and says so", async () => {
    const store = memoryStore([entry()]);
    const result = await drainOutbox({
      store,
      deliver: async () => ({ ok: false, permanent: true, reason: "conversation deleted" }),
      now: () => 1000,
      online: () => true,
    });
    expect(store.entries).toHaveLength(0);
    expect(result.shouldReport).toBe(true);
  });

  it("only reports trouble after several failures, not on the first blip", async () => {
    const store = memoryStore([entry()]);
    const deliver = async () => ({ ok: false, reason: "timeout" });
    let now = 0;
    for (let i = 1; i <= ATTEMPTS_BEFORE_REPORTING; i += 1) {
      now += MAX_BACKOFF_MS * 2;
      const result = await drainOutbox({ store, deliver, now: () => now, online: () => true });
      expect(result.shouldReport).toBe(i >= ATTEMPTS_BEFORE_REPORTING);
    }
    // And the message is still queued, because losing it would be worse.
    expect(store.entries).toHaveLength(1);
  });

  it("treats a thrown delivery as a retryable failure, not a crash", async () => {
    const store = memoryStore([entry()]);
    const result = await drainOutbox({
      store,
      deliver: async () => {
        throw new Error("boom");
      },
      now: () => 1000,
      online: () => true,
    });
    expect(result.failed).toBe(1);
    expect(store.entries[0].lastError).toBe("boom");
  });
});

describe("backoff", () => {
  it("grows and is capped, so a laptop reopened after a weekend syncs promptly", () => {
    expect(backoffFor(1)).toBeLessThanOrEqual(1000);
    expect(backoffFor(20)).toBeLessThanOrEqual(MAX_BACKOFF_MS);
    expect(backoffFor(20)).toBeGreaterThan(MAX_BACKOFF_MS / 2 - 1);
  });

  it("jitters, so every device does not reconnect in the same instant", () => {
    const values = new Set(Array.from({ length: 40 }, () => backoffFor(6)));
    expect(values.size).toBeGreaterThan(1);
  });
});
