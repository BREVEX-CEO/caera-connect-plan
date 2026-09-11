/**
 * AN IN-MEMORY `public.devices`, BEHAVING LIKE THE REAL ONE.
 *
 * Paired devices are rows in the account now, so the store's own rules — the
 * refusal to re-pair a revoked id, the tombstone, the refusal to refresh a
 * revoked device's trust — can only be exercised against something that answers
 * like the table.
 *
 * It enforces what the table enforces rather than returning whatever a test
 * wants: an update matches on id, a delete removes, and a filtered update
 * touches nothing when the filter excludes the row. A fake more permissive than
 * the database would let the store pass here and fail in production, which is
 * the one way a fake can do harm.
 */
export interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  kind: "desktop" | "mobile";
  platform: string | null;
  created_at: string;
  last_active_at: string;
  revoked_at: string | null;
}

interface Filter {
  column: keyof DeviceRow;
  value: unknown;
  /** `is` compares against null; `eq` compares by value. */
  operator: "eq" | "is";
}

export interface FakeDeviceStore {
  rows: DeviceRow[];
  reset: () => void;
  /** The signed-in account, or null to act signed out. */
  signedInAs: (userId: string | null) => void;
  /** Make the next request fail, the way an unreachable account does. */
  failNext: (message?: string) => void;
  /**
   * The stand-in for the Supabase client, handed to `vi.mock`.
   *
   * Exposed rather than installed here: `vi.mock` is hoisted above every import
   * in a test file, so its factory has to be written there. A helper that
   * called `vi.mock` itself would run after the module under test had already
   * imported the real client, and every test would silently exercise nothing.
   */
  client: unknown;
}

export function createFakeDeviceStore(userId = "user-1"): FakeDeviceStore {
  let rows: DeviceRow[] = [];
  let currentUser: string | null = userId;
  let failure: string | null = null;

  function takeFailure(): string | null {
    const held = failure;
    failure = null;
    return held;
  }

  function matches(row: DeviceRow, filters: Filter[]): boolean {
    return filters.every((filter) =>
      filter.operator === "is" ? row[filter.column] === null : row[filter.column] === filter.value,
    );
  }

  /**
   * A chainable query, ending in a promise or in `.select().maybeSingle()`.
   *
   * Written as one object that carries its own filters so the chain can be
   * built in any order, which is how the real client behaves and how the store
   * actually calls it.
   */
  function query(kind: "select" | "update" | "delete" | "upsert", payload?: Partial<DeviceRow>) {
    const filters: Filter[] = [];
    let returning = false;
    let capped: number | null = null;

    const runner = {
      eq(column: keyof DeviceRow, value: unknown) {
        filters.push({ column, value, operator: "eq" });
        return runner;
      },
      is(column: keyof DeviceRow, value: unknown) {
        filters.push({ column, value: value as unknown, operator: "is" });
        return runner;
      },
      order() {
        return runner;
      },
      /*
       * The store caps its list since Phase 18's bounded-read gate, and a fake
       * that did not answer `.limit()` turned every read into `undefined`.
       * Honouring it here also keeps the fake honest: a cap the real client
       * applies is a cap these tests should see.
       */
      limit(count: number) {
        capped = count;
        return runner;
      },
      select() {
        returning = true;
        return runner;
      },
      maybeSingle() {
        return runner.run(true);
      },
      run(single: boolean) {
        const failed = takeFailure();
        if (failed) return Promise.resolve({ data: null, error: { message: failed } });

        if (kind === "select") {
          const found = rows.filter((row) => matches(row, filters));
          const bounded = capped === null ? found : found.slice(0, capped);
          return Promise.resolve({ data: single ? (bounded[0] ?? null) : bounded, error: null });
        }
        if (kind === "delete") {
          const kept = rows.filter((row) => !matches(row, filters));
          const removed = rows.filter((row) => matches(row, filters));
          rows = kept;
          return Promise.resolve({
            data: single ? (removed[0] ?? null) : removed,
            error: null,
          });
        }
        if (kind === "upsert") {
          const given = payload as Partial<DeviceRow>;
          const index = rows.findIndex((row) => row.id === given.id);
          if (index >= 0) {
            rows[index] = { ...rows[index], ...given };
            return Promise.resolve({ data: returning ? rows[index] : null, error: null });
          }
          /*
           * COLUMN DEFAULTS ARE APPLIED, as the database applies them. Leaving
           * `revoked_at` undefined instead of null is the specific way a fake
           * lies: `revoked_at !== null` would then be true for a brand-new
           * device, and every freshly paired phone would read as revoked.
           */
          const next: DeviceRow = {
            platform: null,
            revoked_at: null,
            created_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
            ...given,
          } as DeviceRow;
          rows = [next, ...rows];
          return Promise.resolve({ data: returning ? next : null, error: null });
        }
        const touched: DeviceRow[] = [];
        rows = rows.map((row) => {
          if (!matches(row, filters)) return row;
          const updated = { ...row, ...payload } as DeviceRow;
          touched.push(updated);
          return updated;
        });
        return Promise.resolve({
          data: single ? (touched[0] ?? null) : touched,
          error: null,
        });
      },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        return runner.run(false).then(resolve, reject);
      },
    };
    return runner;
  }

  const client = {
    from(table: string) {
      if (table !== "devices") throw new Error(`unexpected table: ${table}`);
      return {
        select: () => query("select"),
        update: (patch: Partial<DeviceRow>) => query("update", patch),
        delete: () => query("delete"),
        upsert: (row: Partial<DeviceRow>) => query("upsert", row),
      };
    },
    auth: {
      getUser: async () => ({
        data: { user: currentUser ? { id: currentUser } : null },
        error: null,
      }),
    },
  };

  return {
    get rows() {
      return rows;
    },
    reset() {
      rows = [];
      currentUser = userId;
      failure = null;
    },
    signedInAs(next: string | null) {
      currentUser = next;
    },
    failNext(message = "Failed to fetch") {
      failure = message;
    },
    client,
  };
}
