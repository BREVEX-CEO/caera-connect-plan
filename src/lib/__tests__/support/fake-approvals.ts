/**
 * AN IN-MEMORY `ocade_approvals`, INCLUDING ITS TWO FUNCTIONS.
 *
 * The approval queue is decided by a database function on purpose — a decision
 * has to be one statement, or two phones answering together can both believe
 * they decided it. That rule cannot be tested against a stub that returns
 * whatever a test wants, so this reproduces it: `ocade_decide_approval` updates
 * only a row that is still pending and still in date, and returns nothing
 * otherwise.
 *
 * The clock is settable, because expiry is the other half of what is being
 * proved and waiting two real minutes for it is not a test.
 */

export interface ApprovalRow {
  id: string;
  user_id: string;
  summary: string;
  risk: string;
  status: string;
  requested_at: string;
  expires_at: string;
  decided_by_device: string | null;
  decided_at: string | null;
}

export interface FakeApprovalStore {
  rows: ApprovalRow[];
  reset: () => void;
  /** Move the store's clock, which is what the two functions compare against. */
  setNow: (at: Date) => void;
  signedInAs: (userId: string | null) => void;
  failNext: (message?: string) => void;
  client: unknown;
}

export function createFakeApprovalStore(userId = "user-1"): FakeApprovalStore {
  let rows: ApprovalRow[] = [];
  let currentUser: string | null = userId;
  let failure: string | null = null;
  let clock = new Date("2026-07-23T10:00:00Z");

  function takeFailure(): string | null {
    const held = failure;
    failure = null;
    return held;
  }

  const mine = () => rows.filter((row) => row.user_id === currentUser);

  function query(kind: "select" | "insert" | "delete", payload?: Partial<ApprovalRow>) {
    const predicates: Array<(row: ApprovalRow) => boolean> = [];

    const runner = {
      eq(column: keyof ApprovalRow, value: unknown) {
        predicates.push((row) => row[column] === value);
        return runner;
      },
      neq(column: keyof ApprovalRow, value: unknown) {
        predicates.push((row) => row[column] !== value);
        return runner;
      },
      order() {
        return runner;
      },
      /*
       * Present and returning the chain, because the store bounds this list.
       * A runner missing a method the code calls does not fail loudly — the
       * chain becomes undefined, the await throws, the store's catch turns it
       * into an empty list, and the test reads as "nothing was stored".
       */
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
      run(single: boolean) {
        const failed = takeFailure();
        if (failed) {
          return Promise.resolve({ data: null, error: { message: failed, code: undefined } });
        }
        const matching = mine().filter((row) => predicates.every((test) => test(row)));

        if (kind === "select") {
          return Promise.resolve({ data: single ? (matching[0] ?? null) : matching, error: null });
        }
        if (kind === "delete") {
          const removed = new Set(matching.map((row) => row.id));
          rows = rows.filter((row) => !removed.has(row.id));
          return Promise.resolve({
            data: single ? (matching[0] ?? null) : matching,
            error: null,
          });
        }

        const given = payload as Partial<ApprovalRow>;
        if (given.id && rows.some((row) => row.id === given.id)) {
          // The primary key, reported the way PostgREST reports it.
          return Promise.resolve({
            data: null,
            error: { message: "duplicate key value", code: "23505" },
          });
        }
        const row: ApprovalRow = {
          id: given.id ?? `approval-${rows.length + 1}`,
          user_id: given.user_id ?? (currentUser as string),
          summary: given.summary ?? "",
          risk: given.risk ?? "confirm",
          status: given.status ?? "pending",
          requested_at: given.requested_at ?? clock.toISOString(),
          expires_at: given.expires_at ?? clock.toISOString(),
          decided_by_device: null,
          decided_at: null,
        };
        rows = [...rows, row];
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
      if (table !== "ocade_approvals") throw new Error(`unexpected table: ${table}`);
      return {
        select: () => query("select"),
        insert: (row: Partial<ApprovalRow>) => query("insert", row),
        delete: () => query("delete"),
      };
    },
    async rpc(name: string, args?: Record<string, unknown>) {
      const failed = takeFailure();
      if (failed) return { data: null, error: { message: failed } };

      if (name === "ocade_expire_due_approvals") {
        const lapsed: ApprovalRow[] = [];
        rows = rows.map((row) => {
          if (
            row.user_id !== currentUser ||
            row.status !== "pending" ||
            Date.parse(row.expires_at) > clock.getTime()
          ) {
            return row;
          }
          const expired = { ...row, status: "expired" };
          lapsed.push(expired);
          return expired;
        });
        return { data: lapsed, error: null };
      }

      if (name === "ocade_decide_approval") {
        const id = args?._id as string;
        const status = args?._status as string;
        const device = (args?._device_id as string | undefined) ?? null;
        if (!["approved", "denied", "cancelled"].includes(status)) {
          return {
            data: null,
            error: { message: "An approval can only be approved, denied or cancelled" },
          };
        }
        let decided: ApprovalRow | null = null;
        rows = rows.map((row) => {
          /*
           * The conditional update, exactly as the function writes it. A second
           * decider finds the row no longer pending and changes nothing, which
           * is what makes "already answered" reportable rather than silent.
           */
          if (
            row.id !== id ||
            row.user_id !== currentUser ||
            row.status !== "pending" ||
            Date.parse(row.expires_at) <= clock.getTime()
          ) {
            return row;
          }
          decided = {
            ...row,
            status,
            decided_by_device: device ?? row.decided_by_device,
            decided_at: clock.toISOString(),
          };
          return decided;
        });
        return { data: decided, error: null };
      }

      throw new Error(`unexpected function: ${name}`);
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
      clock = new Date("2026-07-23T10:00:00Z");
    },
    setNow(at: Date) {
      clock = at;
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
