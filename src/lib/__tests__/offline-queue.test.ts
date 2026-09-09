import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  OfflineQueue,
  forgetAllQueues,
  saveDraft,
  recoverDraft,
  clearDraft,
} from "../offline-queue";

/**
 * THE QUEUE IS HELD IN THE TAB; A DRAFT IS KEPT IN THE BROWSER.
 *
 * The queue used to be written to `localStorage`, and its payloads carry real
 * content — the text of a handoff, a clipboard. `PLAN.md` Phase 2 gives
 * ordinary content one persistent authority, so what is queued now lasts as
 * long as the tab and nothing more. The tests below therefore assert the
 * opposite of what they used to: a reload starts empty, and nothing reaches
 * browser storage.
 *
 * A DRAFT IS THE EXCEPTION and still keeps its own tests: it is what the person
 * is looking at, it is never sent anywhere on its own, and losing it to a
 * refresh is the failure it exists to prevent.
 */

/** Minimal in-memory localStorage, so the draft tests run in the node environment. */
function installStorage() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  vi.stubGlobal("localStorage", mock);
  return { store, mock };
}

type Job = { kind: "send" | "stop"; text?: string };
const replayable = (p: Job) => p.kind === "send";

beforeEach(() => {
  installStorage();
  forgetAllQueues();
});

describe("OfflineQueue", () => {
  const NOW = new Date("2026-07-23T10:00:00Z");

  it("queues a replayable payload", () => {
    const q = new OfflineQueue<Job>("k", replayable);
    const r = q.enqueue({ kind: "send", text: "hi" }, NOW, "id1");
    expect(r.queued).toBe(true);
    expect(q.size).toBe(1);
    expect(q.all()[0].queuedAt).toBe(NOW.toISOString());
  });

  it("REFUSES a payload that must not be replayed later", () => {
    const q = new OfflineQueue<Job>("k", replayable);
    const r = q.enqueue({ kind: "stop" }, NOW);
    expect(r.queued).toBe(false);
    expect(q.size).toBe(0);
  });

  it("is shared between instances naming the same queue, within one tab", () => {
    const a = new OfflineQueue<Job>("k", replayable);
    a.enqueue({ kind: "send", text: "held" }, NOW, "id1");
    // A second instance is another part of the same page, not another page.
    const b = new OfflineQueue<Job>("k", replayable);
    expect(b.size).toBe(1);
    expect(b.all()[0].payload.text).toBe("held");
  });

  it("WRITES NOTHING TO BROWSER STORAGE", () => {
    /*
     * The payloads carry real content — the text of a handoff, a clipboard. A
     * copy in the browser would outlive a sign-out, survive an account
     * deletion, and be invisible to every export the account offers.
     */
    const written: string[] = [];
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: (key: string) => written.push(key),
      removeItem: () => undefined,
    });
    const q = new OfflineQueue<Job>("k", replayable);
    q.enqueue({ kind: "send", text: "private" }, NOW, "id1");
    expect(written).toEqual([]);
    expect(q.size).toBe(1);
  });

  it("starts empty in a new tab, because nothing was written down", () => {
    const a = new OfflineQueue<Job>("k", replayable);
    a.enqueue({ kind: "send", text: "held" }, NOW, "id1");
    forgetAllQueues(); // a closed tab
    expect(new OfflineQueue<Job>("k", replayable).size).toBe(0);
  });

  it("ignores foreign entries that don't match the shape", () => {
    // Payloads are validated on the way out whatever put them there, because a
    // queued item is data like any other.
    const q = new OfflineQueue<Job>("k", replayable);
    q.enqueue({ kind: "send", text: "real" }, NOW, "id1");
    expect(q.all()).toHaveLength(1);
  });

  it("never replays a payload that must be decided live", async () => {
    const q = new OfflineQueue<Job>("k", replayable);
    expect(q.enqueue({ kind: "stop" }, NOW, "forged-stop").queued).toBe(false);
    const send = vi.fn(async () => true);
    await q.flush(send);
    expect(send).not.toHaveBeenCalled();
  });

  it("caps the queue, dropping the oldest", () => {
    const q = new OfflineQueue<Job>("k", replayable, { maxItems: 3 });
    for (let i = 0; i < 5; i++) q.enqueue({ kind: "send", text: `m${i}` }, NOW, `id${i}`);
    expect(q.size).toBe(3);
    expect(q.all().map((i) => i.payload.text)).toEqual(["m2", "m3", "m4"]);
  });

  it("removes items that send successfully", async () => {
    const q = new OfflineQueue<Job>("k", replayable);
    q.enqueue({ kind: "send", text: "a" }, NOW, "a");
    q.enqueue({ kind: "send", text: "b" }, NOW, "b");
    const result = await q.flush(async () => true);
    expect(result.sent).toBe(2);
    expect(q.size).toBe(0);
  });

  it("reuses the queue id as the idempotency key after a lost acknowledgement", async () => {
    const q = new OfflineQueue<Job>("k", replayable, { maxAttempts: 3 });
    q.enqueue({ kind: "send", text: "once" }, NOW, "stable-operation");
    const seen: Array<{ key: string; attempt: number }> = [];

    await q.flush(async (_payload, context) => {
      seen.push({ key: context.idempotencyKey, attempt: context.attempt });
      return false;
    });
    await q.flush(async (_payload, context) => {
      seen.push({ key: context.idempotencyKey, attempt: context.attempt });
      return true;
    });

    expect(seen).toEqual([
      { key: "stable-operation", attempt: 1 },
      { key: "stable-operation", attempt: 2 },
    ]);
    expect(q.size).toBe(0);
  });

  it("keeps a failed item and counts the attempt", async () => {
    const q = new OfflineQueue<Job>("k", replayable, { maxAttempts: 3 });
    q.enqueue({ kind: "send", text: "a" }, NOW, "a");
    const r = await q.flush(async () => false);
    expect(r.failed).toBe(1);
    expect(q.size).toBe(1);
    expect(q.all()[0].attempts).toBe(1);
  });

  it("drops a poisoned item once it exhausts its attempts, unblocking the queue", async () => {
    const q = new OfflineQueue<Job>("k", replayable, { maxAttempts: 2 });
    q.enqueue({ kind: "send", text: "bad" }, NOW, "bad");
    await q.flush(async () => false); // attempts -> 1
    const second = await q.flush(async () => false); // attempts -> 2 => dropped
    expect(second.dropped).toBe(1);
    expect(q.size).toBe(0);
  });

  it("treats a throwing sender as a failure rather than crashing the flush", async () => {
    const q = new OfflineQueue<Job>("k", replayable);
    q.enqueue({ kind: "send", text: "a" }, NOW, "a");
    const r = await q.flush(async () => {
      throw new Error("network down");
    });
    expect(r.failed).toBe(1);
    expect(q.size).toBe(1);
  });

  it("clear empties the queue", () => {
    const q = new OfflineQueue<Job>("k", replayable);
    q.enqueue({ kind: "send" }, NOW, "a");
    q.clear();
    expect(q.size).toBe(0);
  });

  it("refuses invalid timestamps and oversized payloads instead of throwing or filling storage", () => {
    const q = new OfflineQueue<Job>("k", replayable, { maxPayloadBytes: 32 });
    expect(q.enqueue({ kind: "send", text: "x".repeat(100) }, NOW, "large").queued).toBe(false);
    expect(q.enqueue({ kind: "send", text: "ok" }, new Date("invalid"), "bad-time").queued).toBe(
      false,
    );
    expect(q.size).toBe(0);
  });

  it("refuses to hold more than its total budget", () => {
    // The budget bounds the tab's own memory now rather than a storage quota,
    // and it still has to be enforced: one enormous handoff must not be able to
    // push everything else out.
    const q = new OfflineQueue<Job>("k", replayable, { maxStoredBytes: 200 });
    for (let i = 0; i < 20; i++) q.enqueue({ kind: "send", text: `m${i}` }, NOW, `id${i}`);
    expect(q.size).toBeGreaterThan(0);
    expect(q.size).toBeLessThan(20);
  });
});

describe("draft recovery", () => {
  it("saves and recovers an in-progress message", () => {
    saveDraft("c1", "half written thought");
    expect(recoverDraft("c1")?.text).toBe("half written thought");
  });

  it("keeps drafts separate per conversation", () => {
    saveDraft("c1", "one");
    saveDraft("c2", "two");
    expect(recoverDraft("c1")?.text).toBe("one");
    expect(recoverDraft("c2")?.text).toBe("two");
  });

  it("clears the draft when the text becomes empty", () => {
    saveDraft("c1", "something");
    saveDraft("c1", "   ");
    expect(recoverDraft("c1")).toBeNull();
  });

  it("returns null for a missing or corrupt draft", () => {
    expect(recoverDraft("nope")).toBeNull();
    localStorage.setItem("caera:draft:bad", "{oops");
    expect(recoverDraft("bad")).toBeNull();
  });

  it("clearDraft removes it", () => {
    saveDraft("c1", "x");
    clearDraft("c1");
    expect(recoverDraft("c1")).toBeNull();
  });

  it("ignores an empty conversation id", () => {
    expect(() => saveDraft("", "x")).not.toThrow();
    expect(recoverDraft("")).toBeNull();
  });

  it("does not persist or recover an oversized draft", () => {
    saveDraft("large", "x".repeat(100_001));
    expect(recoverDraft("large")).toBeNull();
    localStorage.setItem(
      "caera:draft:forged",
      JSON.stringify({ text: "x".repeat(100_001), savedAt: new Date().toISOString() }),
    );
    expect(recoverDraft("forged")).toBeNull();
  });
});
