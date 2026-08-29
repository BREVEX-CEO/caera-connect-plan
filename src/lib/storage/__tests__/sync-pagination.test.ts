import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * THE ROW CAP IS SILENT, WHICH IS WHAT MAKES IT DANGEROUS.
 *
 * PostgREST refuses to return more than `db-max-rows` (1,000 by default on
 * Supabase) and says nothing about having truncated: the response is a
 * well-formed array of the first N rows, no error, no marker. `list` used to
 * issue one unbounded `select("*")`, so an account with more than N records in
 * a data class synchronised the first N and quietly never saw the rest. No
 * failure, no report, and the missing records looked like records the user had
 * never written.
 *
 * The fake below behaves exactly like that server: it enforces a cap, honours
 * `.limit()` and `.gt("id", …)`, and counts requests. A test that mocked a
 * cooperative server would pass against the old code too and prove nothing.
 */

const CAP = 1000;

/** Rows are keyed by a zero-padded id so string ordering is stable. */
function seed(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    user_id: "user-1",
    data_class: "chats",
    id: `rec-${String(i).padStart(6, "0")}`,
    value: { n: i },
    created_at: new Date(1_700_000_000_000 + i).toISOString(),
    updated_at: new Date(1_700_000_000_000 + i).toISOString(),
  }));
}

const server = { rows: seed(0), requests: 0, maxRowsSeen: 0 };

function builder() {
  const state = { gt: null as string | null, limit: Number.POSITIVE_INFINITY };
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit(n: number) {
      state.limit = n;
      return chain;
    },
    gt(_column: string, value: string) {
      state.gt = value;
      return chain;
    },
    then(resolve: (value: { data: unknown[]; error: null }) => void) {
      server.requests += 1;
      let rows = [...server.rows].sort((a, b) => a.id.localeCompare(b.id));
      if (state.gt !== null) rows = rows.filter((r) => r.id > state.gt!);
      // The server's own ceiling wins over whatever the client asked for.
      const wanted = Math.min(state.limit, CAP);
      const page = rows.slice(0, wanted);
      server.maxRowsSeen = Math.max(server.maxRowsSeen, page.length);
      resolve({ data: page, error: null });
    },
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => builder(),
  },
}));

vi.mock("../indexeddb-adapter", () => ({
  indexedDbAdapter: {
    list: async () => [],
    put: async () => {},
    get: async () => null,
    delete: async () => {},
    clear: async () => {},
    mode: "browser_only",
  },
}));

vi.mock("../sync-queue", () => ({
  enqueue: async () => {},
  enqueueDelete: async () => {},
  drainNow: async () => {},
}));

const { syncAdapter } = await import("../sync-adapter");

describe("reading every record when the server will not send them all at once", () => {
  beforeEach(async () => {
    server.requests = 0;
    server.maxRowsSeen = 0;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("ocade-private-sync-cache");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Private Sync test database is still open."));
    });
  });

  it("reads all 2,500 records past a 1,000-row server cap", async () => {
    server.rows = seed(2500);
    const rows = await syncAdapter.list("chats");
    expect(rows).toHaveLength(2500);
    // The old single unbounded request could only ever have returned 1,000.
    expect(server.requests).toBeGreaterThan(1);
  });

  it("never asks for more rows than the server will give", async () => {
    server.rows = seed(2500);
    await syncAdapter.list("chats");
    expect(server.maxRowsSeen).toBeLessThanOrEqual(CAP);
  });

  it("returns every record exactly once, in no particular order but complete", async () => {
    server.rows = seed(1600);
    const rows = await syncAdapter.list("chats");
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.size).toBe(1600);
    expect(ids.has("rec-000000")).toBe(true);
    expect(ids.has("rec-001599")).toBe(true);
  });

  it("stops after one request when everything fits in one page", async () => {
    server.rows = seed(12);
    const rows = await syncAdapter.list("chats");
    expect(rows).toHaveLength(12);
    // A short page is the end. Asking again would be a wasted round trip on
    // the overwhelmingly common case of a small account.
    expect(server.requests).toBe(1);
  });

  it("asks once more when the last page is exactly full, because it cannot know", async () => {
    server.rows = seed(500);
    await syncAdapter.list("chats");
    expect(server.requests).toBe(2);
  });

  it("handles an empty account without a request loop", async () => {
    server.rows = seed(0);
    expect(await syncAdapter.list("chats")).toHaveLength(0);
    expect(server.requests).toBe(1);
  });
});
