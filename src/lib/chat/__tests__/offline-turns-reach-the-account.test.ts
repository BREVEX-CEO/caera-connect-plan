import { afterEach, describe, expect, it, vi } from "vitest";
import {
  forgetAllUnsyncedTurns,
  rememberUnsyncedTurn,
  unsyncedTurns,
} from "@/lib/chat/unsynced-turns";

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
let failNext = false;

vi.mock("@/lib/ocade.functions", () => ({
  appendOcadeMessage: vi.fn(async ({ data }: { data: { clientKey: string } }) => {
    if (failNext) throw new Error("network");
    if (appended.includes(data.clientKey)) return null; // The server's own guard.
    appended.push(data.clientKey);
    return { id: data.clientKey };
  }),
  listMessages: vi.fn(async () => []),
}));

const { flushUnsyncedTurns } = await import("@/lib/ocade-chat-store");

function waiting(clientKey: string, createdAt: string) {
  rememberUnsyncedTurn({
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

afterEach(() => {
  forgetAllUnsyncedTurns();
  appended.length = 0;
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
