import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ensureCurrentDeviceIdentity, getOfflineCurrentDeviceIdentity } from "../device-identity";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/integrations/supabase/on-demand", () => ({ loadSupabaseClient: mocks.load }));

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let account: string;
let refusal: string | undefined;
let storage: Map<string, string>;
let grantInsertFails: boolean;

beforeEach(() => {
  tables = { devices: [], browser_grants: [] };
  account = "account-one";
  refusal = undefined;
  grantInsertFails = false;
  storage = new Map([["caera.browser_install_id", "install-one"]]);
  vi.stubGlobal("window", {
    location: { origin: "https://ocade.invalid" },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  let pending = Promise.resolve<unknown>(null);
  vi.stubGlobal("navigator", {
    onLine: true,
    userAgent: "Chrome Windows",
    locks: {
      request: (_key: string, run: () => Promise<unknown>) => {
        const next = pending.then(run);
        pending = next.catch(() => null);
        return next;
      },
    },
  });
  mocks.load.mockResolvedValue({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: account } } }, error: null }),
    },
    from: (table: string) => {
      let inserted: Row | undefined;
      let deleting = false;
      const filters: [string, unknown][] = [];
      const run = async () => {
        if (refusal === table || (inserted && grantInsertFails && table === "browser_grants")) {
          return { data: null, error: { message: "database unavailable" } };
        }
        if (inserted) {
          const row = { id: crypto.randomUUID(), revoked_at: null, ...inserted };
          tables[table]!.push(row);
          return { data: row, error: null };
        }
        const found = tables[table]!.filter((row) =>
          filters.every(([key, value]) => row[key] === value),
        );
        if (deleting) tables[table] = tables[table]!.filter((row) => !found.includes(row));
        return { data: found.at(-1) ?? null, error: null };
      };
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        insert: (row: Row) => {
          inserted = row;
          return query;
        },
        delete: () => {
          deleting = true;
          return query;
        },
        single: run,
        maybeSingle: run,
        then: (resolve: (value: unknown) => unknown) => run().then(resolve),
      };
      return query;
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("registers once across simultaneous tabs, then makes the verified identity available offline", async () => {
  const results = await Promise.all([ensureCurrentDeviceIdentity(), ensureCurrentDeviceIdentity()]);
  expect(results[0]).toEqual(results[1]);
  expect(tables.devices).toHaveLength(1);
  expect(tables.browser_grants).toHaveLength(1);
  expect(await getOfflineCurrentDeviceIdentity()).toEqual(results[0]);
});

it("does not reuse another account's cached identity", async () => {
  await ensureCurrentDeviceIdentity();
  account = "account-two";
  expect(await getOfflineCurrentDeviceIdentity()).toBeNull();
  expect(await ensureCurrentDeviceIdentity()).toMatchObject({ accountId: account });
  expect(tables.devices).toHaveLength(2);
});

it.each(["devices", "browser_grants"])("never re-registers a revoked %s row", async (table) => {
  await ensureCurrentDeviceIdentity();
  tables[table]![0]!.revoked_at = new Date().toISOString();
  expect(await ensureCurrentDeviceIdentity()).toBeNull();
  expect(await getOfflineCurrentDeviceIdentity()).toBeNull();
  expect(tables.devices).toHaveLength(1);
});

it("fails closed on a grant lookup failure instead of creating a second device", async () => {
  refusal = "browser_grants";
  await expect(ensureCurrentDeviceIdentity()).rejects.toThrow("could not be verified");
  expect(tables.devices).toHaveLength(0);
});

it("removes an incomplete registration when grant insertion fails", async () => {
  grantInsertFails = true;
  await expect(ensureCurrentDeviceIdentity()).rejects.toThrow("could not be registered");
  expect(tables.devices).toHaveLength(0);
  expect(await getOfflineCurrentDeviceIdentity()).toBeNull();
});
