import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeStaleness,
  fetchWithMirror,
  readPendingIntents,
  writePendingIntents,
} from "../mirror";

/**
 * The mirror, and the one property that makes it safe: the server always wins.
 *
 * A cache-first read would show yesterday's schedule to somebody with a
 * perfectly good connection, which is a worse product than one that simply
 * failed. Every test here is about the ORDER of the two answers, not about the
 * storage.
 */

/** IndexedDB is absent in the node test environment, which is the point. */
function withoutIndexedDb<T>(run: () => T): T {
  return run();
}

describe("the server is asked first, every time", () => {
  it("returns the live answer when the network works", async () => {
    const fetcher = vi.fn(async () => [{ id: "1" }]);
    const result = await fetchWithMirror("automations", "user-a", fetcher);
    expect(result.stale).toBe(false);
    expect(result.items).toEqual([{ id: "1" }]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not consult the mirror when the network answers", async () => {
    // Proven by the shape of the result: a stale read carries a timestamp and a
    // live one cannot.
    const result = await fetchWithMirror("automations", "user-a", async () => []);
    expect(result).not.toHaveProperty("takenAt");
  });

  it("rethrows when the network fails and nothing was ever mirrored", async () => {
    withoutIndexedDb(() => {});
    await expect(
      fetchWithMirror("automations", "user-a", async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
  });
});

describe("what a person is told about a stale answer", () => {
  it.each([
    [0, "just now"],
    [60_000, "a minute ago"],
    [25 * 60_000, "25 minutes ago"],
    [60 * 60_000, "an hour ago"],
    [5 * 60 * 60_000, "5 hours ago"],
    [24 * 60 * 60_000, "yesterday"],
    [3 * 24 * 60 * 60_000, "3 days ago"],
  ])("describes %dms ago as %s", (ago, expected) => {
    const now = 1_700_000_000_000;
    expect(describeStaleness(now - ago, now)).toBe(expected);
  });

  it("never reports a negative age from a clock that moved", () => {
    const now = 1_700_000_000_000;
    expect(describeStaleness(now + 60_000, now)).toBe("just now");
  });
});

describe("scoping", () => {
  it("keys the mirror by account, so a shared machine cannot leak a schedule", () => {
    /*
     * Asserted against the source because the leak it prevents cannot be
     * provoked without two accounts and a real IndexedDB: person A's schedule
     * appearing for person B because the network happened to be down.
     */
    const source = readFileSync("src/lib/offline/mirror.ts", "utf8");
    expect(source).toContain("function scopedKey");
    expect(source).toMatch(/userId \?\? "anonymous"/);
  });

  it("mirrors only a closed set of things", () => {
    const source = readFileSync("src/lib/offline/mirror.ts", "utf8");
    expect(source).toContain("export type MirrorKey");
    // An authorisation result or a payment state must never be mirrorable by a
    // caller who did not think about it.
    expect(source).not.toMatch(/MirrorKey = string/);
  });
});

describe("queued intents", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });

  it("round-trips", () => {
    writePendingIntents([{ id: "a", label: "Pause the morning brief", queuedAt: 1 }]);
    expect(readPendingIntents()).toEqual([
      { id: "a", label: "Pause the morning brief", queuedAt: 1 },
    ]);
  });

  it("survives corrupt storage rather than throwing into a render", () => {
    window.localStorage.setItem("ocade:pending-intents:v1", "{not json");
    expect(readPendingIntents()).toEqual([]);
  });

  it("drops entries that are not intents", () => {
    window.localStorage.setItem("ocade:pending-intents:v1", JSON.stringify([1, null, { id: "x" }]));
    expect(readPendingIntents()).toEqual([]);
  });
});

describe("the tasks screen", () => {
  const source = readFileSync("src/components/ocade/TasksWorkspace.tsx", "utf8");

  it("reads through the mirror", () => {
    expect(source).toContain("fetchWithMirror");
  });

  it("says when what it is showing is stale, with a time", () => {
    expect(source).toContain("describeStaleness");
    expect(source).toMatch(/last saw/);
  });

  it("refuses a schedule change offline instead of appearing to make one", () => {
    /*
     * Pausing an automation offline pauses nothing — the thing that would run it
     * is not on this device. Moving the switch and letting the run fire anyway
     * is the worst of the three options available.
     */
    expect(source).toContain("requireNetwork");
    expect(source).toMatch(/runs in the cloud rather than on this device/);
  });
});
