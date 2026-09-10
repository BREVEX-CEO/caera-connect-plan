import { describe, expect, it } from "vitest";
import {
  buildAccountExport,
  clearAccountDataClass,
  type DynamicTableClient,
  type ExportedRow,
  type PostgrestFailure,
} from "../data-rights";
import { ACCOUNT_DATA_CLASSES, type AccountTable } from "../data-classes";

/**
 * THE TWO FAILURES AN EXPORT HAS, AND NEITHER OF THEM RAISES AN ERROR.
 *
 * PostgREST returns at most `db-max-rows` — a thousand by default — and says
 * nothing about the rest. An unpaged export therefore hands somebody a file
 * that looks complete and stops partway, which is worse than failing, because
 * they will rely on it. The second failure is quieter still: a cascaded child
 * read with too many parent ids in one query string is refused by a proxy long
 * before the account is unusual, and the export loses every message while
 * keeping every conversation title.
 *
 * Neither reproduces against a database with three rows in it. So the database
 * is a parameter, and these tests hand it thousands.
 */

/** A fake that answers `.range()` honestly, one page at a time. */
function fakeDatabase(options: {
  rows?: Partial<Record<AccountTable, ExportedRow[]>>;
  failOn?: AccountTable;
  /** Every `.in()` list this fake was asked for, to check chunking. */
  seenIdBatches?: number[];
  deleted?: AccountTable[];
}): DynamicTableClient {
  const rows = options.rows ?? {};
  const page = (all: ExportedRow[], failure: PostgrestFailure) => ({
    range: (from: number, to: number) =>
      Promise.resolve({ data: failure ? null : all.slice(from, to + 1), error: failure }),
  });
  return {
    from(table: AccountTable) {
      const failure = options.failOn === table ? { message: "permission denied" } : null;
      const all = rows[table] ?? [];
      return {
        select: () => ({
          eq: () => page(all, failure),
          in: (_column: string, values: readonly string[]) => {
            options.seenIdBatches?.push(values.length);
            const matching = all.filter((row) => values.includes(String(row.parent)));
            return page(matching, failure);
          },
        }),
        delete: () => ({
          eq: () => {
            options.deleted?.push(table);
            return Promise.resolve({ error: failure });
          },
        }),
      };
    },
  };
}

function manyRows(
  count: number,
  extra: (index: number) => ExportedRow = () => ({}),
): ExportedRow[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `row-${index}`,
    ...extra(index),
  }));
}

describe("exporting an account", () => {
  it("reads past the first page rather than stopping at it", async () => {
    // 1,700 conversations is three pages of 500 and a remainder. An unpaged
    // read returns the first page and reports it as the whole account.
    const conversations = manyRows(1_700);
    const result = await buildAccountExport(
      fakeDatabase({ rows: { ocade_conversations: conversations } }),
      "account-1",
    );
    const table = result.classes
      .flatMap((entry) => entry.tables)
      .find((entry) => entry.table === "ocade_conversations");
    expect(table?.rows).toHaveLength(1_700);
    expect(result.rowCount).toBe(1_700);
    expect(result.partial).toBe(false);
  });

  it("reads the messages inside those conversations, not just their titles", async () => {
    const conversations = manyRows(600);
    const messages = manyRows(600, (index) => ({ parent: `row-${index}`, body: "hello" })).map(
      (row, index) => ({ ...row, id: `message-${index}` }),
    );
    const seenIdBatches: number[] = [];
    const result = await buildAccountExport(
      fakeDatabase({
        rows: { ocade_conversations: conversations, ocade_messages: messages },
        seenIdBatches,
      }),
      "account-1",
    );
    const table = result.classes
      .flatMap((entry) => entry.tables)
      .find((entry) => entry.table === "ocade_messages");
    expect(table?.rows).toHaveLength(600);
    // Chunked, so the id list cannot outgrow a query string.
    expect(Math.max(...seenIdBatches)).toBeLessThanOrEqual(100);
  });

  it("says which table failed instead of pretending the class is empty", async () => {
    const result = await buildAccountExport(
      fakeDatabase({ rows: { ocade_memory: manyRows(3) }, failOn: "ocade_memory" }),
      "account-1",
    );
    const table = result.classes
      .flatMap((entry) => entry.tables)
      .find((entry) => entry.table === "ocade_memory");
    expect(table?.unavailable).toBe("permission denied");
    expect(result.partial).toBe(true);
    expect(result.notes.join(" ")).toMatch(/could not be read/i);
  });

  it("covers every class the map declares, including the ones it will not delete", async () => {
    const result = await buildAccountExport(fakeDatabase({}), "account-1");
    expect(result.classes.map((entry) => entry.id)).toEqual(
      ACCOUNT_DATA_CLASSES.map((entry) => entry.id),
    );
    for (const id of ["billing", "legal", "profile"]) {
      const entry = result.classes.find((candidate) => candidate.id === id);
      expect(entry?.retention, id).toBeTruthy();
      expect(entry?.tables.length, id).toBeGreaterThan(0);
    }
  });

  it("carries the account it was made for, and when", async () => {
    const result = await buildAccountExport(fakeDatabase({}), "account-42");
    expect(result.accountId).toBe("account-42");
    expect(Number.isNaN(Date.parse(result.generatedAt))).toBe(false);
    expect(result.schemaVersion).toBeGreaterThan(0);
  });

  it("says what is NOT in the file, because a reader cannot see an absence", async () => {
    const result = await buildAccountExport(fakeDatabase({}), "account-1");
    const notes = result.notes.join(" ");
    /*
     * This note used to name the "Browser Only" and "PC Vault" data classes
     * `PLAN.md` Phase 2 removed. What it must still do is state the absence:
     * an export cannot contain what OCADE never received.
     */
    expect(notes).toMatch(/never received/i);
    expect(notes).not.toMatch(/Browser Only|PC Vault/i);
    expect(notes).toMatch(/Offline Intelligence/);
  });
});

describe("clearing one class", () => {
  it("clears the class and names every table it emptied", async () => {
    const deleted: AccountTable[] = [];
    const receipt = await clearAccountDataClass(fakeDatabase({ deleted }), "account-1", {
      dataClass: "conversations",
      confirmation: "Conversations",
    });
    expect(deleted).toEqual(["ocade_conversations", "ocade_outputs"]);
    // The cascaded child is named on the receipt even though it is never
    // deleted directly: the person is owed a true account of what went.
    expect(receipt.cleared).toContain("ocade_messages");
    expect(receipt.offlineIntelligencePreserved).toBe(true);
  });

  it("refuses a class that has to be kept, and says why", async () => {
    const deleted: AccountTable[] = [];
    for (const id of ["billing", "legal", "profile"]) {
      await expect(
        clearAccountDataClass(fakeDatabase({ deleted }), "account-1", {
          dataClass: id,
          confirmation: "anything",
        }),
      ).rejects.toThrow(/retention|consent|account/i);
    }
    expect(deleted).toEqual([]);
  });

  it("refuses a confirmation that does not match, without deleting anything", async () => {
    const deleted: AccountTable[] = [];
    await expect(
      clearAccountDataClass(fakeDatabase({ deleted }), "account-1", {
        dataClass: "memory",
        confirmation: "yes",
      }),
    ).rejects.toThrow(/Type Memory exactly/);
    expect(deleted).toEqual([]);
  });

  it("accepts the label in any case, because a phrase is consent and not a password", async () => {
    const deleted: AccountTable[] = [];
    await clearAccountDataClass(fakeDatabase({ deleted }), "account-1", {
      dataClass: "memory",
      confirmation: "  memory ",
    });
    expect(deleted).toEqual(["ocade_memory"]);
  });

  it("refuses a class that does not exist", async () => {
    await expect(
      clearAccountDataClass(fakeDatabase({}), "account-1", {
        dataClass: "everything",
        confirmation: "everything",
      }),
    ).rejects.toThrow(/not a data class/i);
  });

  it("stops on a table that will not clear rather than reporting success", async () => {
    /*
     * A deletion that half-worked and said "done" is the failure that costs
     * trust: the person believes their conversations are gone and they are not.
     */
    await expect(
      clearAccountDataClass(fakeDatabase({ failOn: "ocade_outputs" }), "account-1", {
        dataClass: "conversations",
        confirmation: "Conversations",
      }),
    ).rejects.toThrow(/ocade_outputs could not be cleared/);
  });
});
