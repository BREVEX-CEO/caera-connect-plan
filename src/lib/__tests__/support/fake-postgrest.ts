/**
 * A SMALL POSTGREST THAT BEHAVES LIKE THE REAL ONE.
 *
 * Several stores are now thin typed views over one table each, and the rules
 * worth proving are theirs: what they refuse, what they report as a failure,
 * what they cascade. Testing those needs something that answers like the
 * database rather than a stub that returns whatever the test wants.
 *
 * WHAT IT ENFORCES, because a fake that is more permissive than the database
 * lets a store pass here and fail in production:
 *
 *  - rows are scoped to the signed-in account, as row-level security scopes
 *    them, so a store that forgets its own scope is not silently rewarded;
 *  - `NOT NULL` columns and defaults are applied on insert, so a column left
 *    undefined does not read back as a legal value;
 *  - a duplicate primary key is refused with 23505 and a missing foreign key
 *    with 23503, which is what the stores branch on;
 *  - a delete cascades along the declared parent columns.
 *
 * It is not a database. It has no types, no constraints beyond the ones a table
 * declares here, and no transactions. What it is, is honest about the handful
 * of behaviours the code under test actually depends on.
 */

export interface TableShape {
  /** Column defaults applied on insert when the caller leaves one out. */
  defaults?: Record<string, unknown>;
  /** Columns whose value must be present in another table's rows. */
  references?: Array<{ column: string; table: string; onDelete?: "cascade" }>;
}

type Row = Record<string, unknown>;

interface Filter {
  column: string;
  value: unknown;
  operator: "eq" | "neq" | "is";
}

export interface FakePostgrest {
  rowsIn: (table: string) => Row[];
  seed: (table: string, rows: Row[]) => void;
  reset: () => void;
  signedInAs: (userId: string | null) => void;
  failNext: (message?: string, code?: string) => void;
  client: unknown;
}

let sequence = 0;
function nextId(): string {
  sequence += 1;
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

export function createFakePostgrest(
  tables: Record<string, TableShape>,
  userId = "user-1",
): FakePostgrest {
  let data: Record<string, Row[]> = {};
  let currentUser: string | null = userId;
  let failure: { message: string; code?: string } | null = null;

  const reset = () => {
    data = Object.fromEntries(Object.keys(tables).map((name) => [name, []]));
    currentUser = userId;
    failure = null;
    sequence = 0;
  };
  reset();

  function takeFailure() {
    const held = failure;
    failure = null;
    return held;
  }

  /** Row-level security, as the policies write it: the account's own rows. */
  const visible = (table: string) =>
    data[table]!.filter((row) => !("user_id" in row) || row.user_id === currentUser);

  function matches(row: Row, filters: Filter[]): boolean {
    return filters.every((filter) => {
      if (filter.operator === "is") return row[filter.column] === filter.value;
      if (filter.operator === "neq") return row[filter.column] !== filter.value;
      return row[filter.column] === filter.value;
    });
  }

  /** Delete `ids` from `table`, then whatever declared them as a parent. */
  function cascade(table: string, ids: unknown[]) {
    for (const [name, shape] of Object.entries(tables)) {
      for (const reference of shape.references ?? []) {
        if (reference.table !== table || reference.onDelete !== "cascade") continue;
        const orphans = data[name]!.filter((row) => ids.includes(row[reference.column]));
        if (orphans.length === 0) continue;
        const orphanIds = orphans.map((row) => row.id);
        data[name] = data[name]!.filter((row) => !ids.includes(row[reference.column]));
        cascade(name, orphanIds);
      }
    }
  }

  function query(
    table: string,
    kind: "select" | "insert" | "update" | "upsert" | "delete",
    payload?: Row,
  ) {
    const filters: Filter[] = [];

    const runner = {
      eq(column: string, value: unknown) {
        filters.push({ column, value, operator: "eq" });
        return runner;
      },
      neq(column: string, value: unknown) {
        filters.push({ column, value, operator: "neq" });
        return runner;
      },
      is(column: string, value: unknown) {
        filters.push({ column, value, operator: "is" });
        return runner;
      },
      order() {
        return runner;
      },
      limit() {
        return runner;
      },
      range() {
        return runner;
      },
      select() {
        return runner;
      },
      single() {
        return runner.run(true);
      },
      maybeSingle() {
        return runner.run(true);
      },
      run(single: boolean): Promise<{ data: unknown; error: unknown }> {
        const failed = takeFailure();
        if (failed) return Promise.resolve({ data: null, error: failed });

        const shape = tables[table];
        if (!shape) throw new Error(`unexpected table: ${table}`);

        if (kind === "select") {
          const found = visible(table).filter((row) => matches(row, filters));
          return Promise.resolve({ data: single ? (found[0] ?? null) : found, error: null });
        }

        if (kind === "delete") {
          const doomed = visible(table).filter((row) => matches(row, filters));
          const ids = doomed.map((row) => row.id);
          data[table] = data[table]!.filter((row) => !ids.includes(row.id));
          cascade(table, ids);
          return Promise.resolve({ data: single ? (doomed[0] ?? null) : doomed, error: null });
        }

        if (kind === "update") {
          const touched: Row[] = [];
          data[table] = data[table]!.map((row) => {
            if (!visible(table).includes(row) || !matches(row, filters)) return row;
            const updated = { ...row, ...payload };
            touched.push(updated);
            return updated;
          });
          return Promise.resolve({ data: single ? (touched[0] ?? null) : touched, error: null });
        }

        // insert / upsert
        const given = { ...payload } as Row;
        for (const reference of shape.references ?? []) {
          const value = given[reference.column];
          if (value == null) continue;
          if (!data[reference.table]!.some((row) => row.id === value)) {
            return Promise.resolve({
              data: null,
              error: { message: "foreign key violation", code: "23503" },
            });
          }
        }

        const existing = given.id ? data[table]!.find((row) => row.id === given.id) : undefined;
        if (existing) {
          if (kind === "insert") {
            return Promise.resolve({
              data: null,
              error: { message: "duplicate key value", code: "23505" },
            });
          }
          const merged = { ...existing, ...given };
          data[table] = data[table]!.map((row) => (row.id === merged.id ? merged : row));
          return Promise.resolve({ data: single ? merged : [merged], error: null });
        }

        const now = new Date().toISOString();
        const row: Row = {
          id: given.id ?? nextId(),
          created_at: now,
          updated_at: now,
          ...shape.defaults,
          ...given,
        };
        data[table] = [...data[table]!, row];
        return Promise.resolve({ data: single ? row : [row], error: null });
      },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        return runner.run(false).then(resolve, reject);
      },
    };
    return runner;
  }

  const client = {
    from(table: string) {
      return {
        select: () => query(table, "select"),
        insert: (row: Row) => query(table, "insert", row),
        update: (patch: Row) => query(table, "update", patch),
        upsert: (row: Row) => query(table, "upsert", row),
        delete: () => query(table, "delete"),
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
    rowsIn: (table: string) => data[table] ?? [],
    seed(table, rows) {
      data[table] = [...(data[table] ?? []), ...rows];
    },
    reset,
    signedInAs(next) {
      currentUser = next;
    },
    failNext(message = "Failed to fetch", code) {
      failure = { message, code };
    },
    client,
  };
}
