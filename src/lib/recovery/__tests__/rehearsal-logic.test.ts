import { describe, expect, it } from "vitest";
import {
  buildReport,
  compareInventories,
  digestRows,
  evidenceLeaks,
  insertStatementFor,
  inventoryOf,
  quoteIdentifier,
  restoreOrder,
  type RecoveryBackup,
} from "../rehearsal";

/*
 * The parts of a restore that are decided before any database is touched.
 *
 * `recovery-rehearsal.test.ts` runs the whole thing against real PostgreSQL,
 * which takes twenty seconds and answers "did it work". These answer "would we
 * notice if it did not" -- the comparison that must not accept a wrong restore,
 * the ordering that must not put a child before its parent, and the statement
 * builder that must not let a row's contents become SQL.
 */

const backup = (tables: RecoveryBackup["tables"]): RecoveryBackup => ({
  schemaVersion: 1,
  takenAt: "2026-09-10T00:00:00.000Z",
  release: "0.1.0",
  migrationCount: 95,
  tables,
});

describe("the digest that decides whether a restore is correct", () => {
  it("ignores row order and column order, which a correct restore may change", () => {
    const a = digestRows([
      { id: 1, body: "one" },
      { id: 2, body: "two" },
    ]);
    const b = digestRows([
      { body: "two", id: 2 },
      { body: "one", id: 1 },
    ]);
    expect(a).toBe(b);
  });

  it("changes when any value changes, including a null becoming empty", () => {
    const base = digestRows([{ id: 1, body: "one" }]);
    expect(digestRows([{ id: 1, body: "onE" }])).not.toBe(base);
    expect(digestRows([{ id: 1, body: null }])).not.toBe(digestRows([{ id: 1, body: "" }]));
    expect(digestRows([{ id: 1 }])).not.toBe(base);
  });

  it("distinguishes a missing row from an added one", () => {
    expect(digestRows([{ id: 1 }])).not.toBe(digestRows([{ id: 1 }, { id: 2 }]));
  });

  it("reveals nothing about the values it covers", () => {
    const digest = digestRows([
      { email: "alice@example.com", body: "my card is 4111111111111111" },
    ]);
    expect(digest).toMatch(/^[0-9a-f]{16}$/);
    expect(digest).not.toContain("alice");
    expect(digest).not.toContain("4111");
  });
});

describe("comparing a backup with what came back", () => {
  const before = inventoryOf(
    backup([
      { table: "public.ocade_conversations", rows: [{ id: 1 }, { id: 2 }] },
      { table: "public.ocade_messages", rows: [{ id: 9, body: "hello" }] },
    ]),
  );

  it("passes an identical restore", () => {
    expect(compareInventories(before, before)).toEqual([]);
  });

  it("refuses a restore that returns the right COUNT of wrong rows", () => {
    const after = inventoryOf(
      backup([
        { table: "public.ocade_conversations", rows: [{ id: 1 }, { id: 2 }] },
        { table: "public.ocade_messages", rows: [{ id: 9, body: "goodbye" }] },
      ]),
    );
    const differences = compareInventories(before, after);
    expect(differences).toHaveLength(1);
    expect(differences[0].problem).toBe("contents");
    // The report names the table and never the row that differed.
    expect(JSON.stringify(differences)).not.toContain("goodbye");
  });

  it("names a table that did not come back at all", () => {
    const after = inventoryOf(
      backup([{ table: "public.ocade_conversations", rows: [{ id: 1 }, { id: 2 }] }]),
    );
    expect(compareInventories(before, after)[0]).toMatchObject({
      table: "public.ocade_messages",
      problem: "missing",
    });
  });

  it("catches a short restore and a long one", () => {
    const short = inventoryOf(
      backup([
        { table: "public.ocade_conversations", rows: [{ id: 1 }] },
        { table: "public.ocade_messages", rows: [{ id: 9, body: "hello" }] },
      ]),
    );
    expect(compareInventories(before, short)[0].problem).toBe("row_count");

    const doubled = inventoryOf(
      backup([
        { table: "public.ocade_conversations", rows: [{ id: 1 }, { id: 2 }] },
        { table: "public.ocade_messages", rows: [{ id: 9 }, { id: 9 }] },
      ]),
    );
    expect(compareInventories(before, doubled)[0].problem).toBe("row_count");
  });

  it("notices rows that appeared in a table the backup had empty", () => {
    const withEmpty = inventoryOf(backup([{ table: "public.audit", rows: [] }]));
    const withRows = inventoryOf(backup([{ table: "public.audit", rows: [{ id: 1 }] }]));
    expect(compareInventories(withEmpty, withRows)[0].problem).toBe("row_count");
    expect(compareInventories([], withRows)[0].problem).toBe("unexpected");
  });
});

describe("the order rows go back in", () => {
  it("puts a parent before its child", () => {
    const { order } = restoreOrder(
      ["public.ocade_messages", "public.ocade_conversations", "auth.users"],
      [
        { table: "public.ocade_messages", dependsOn: "public.ocade_conversations" },
        { table: "public.ocade_conversations", dependsOn: "auth.users" },
      ],
    );
    expect(order).toEqual(["auth.users", "public.ocade_conversations", "public.ocade_messages"]);
  });

  it("does not treat a self-reference as unorderable", () => {
    // A threaded table pointing at its own parent row is ordinary, and calling
    // it a cycle would report half the schema as unorderable.
    const { order, unordered } = restoreOrder(
      ["public.ocade_tasks"],
      [{ table: "public.ocade_tasks", dependsOn: "public.ocade_tasks" }],
    );
    expect(unordered).toEqual([]);
    expect(order).toEqual(["public.ocade_tasks"]);
  });

  it("still restores a real cycle, and names it and everything behind it", () => {
    const { order, unordered } = restoreOrder(
      ["a", "b", "c"],
      [
        { table: "a", dependsOn: "b" },
        { table: "b", dependsOn: "a" },
        { table: "c", dependsOn: "a" },
      ],
    );
    /*
     * `c` is not itself in the cycle -- it depends on `a`, which is. No insert
     * order places it either, so it is reported with them rather than left
     * looking orderable: an operator reading this needs the whole set whose
     * constraints have to be deferred, not the two tables at its centre.
     */
    expect(unordered).toEqual(["a", "b", "c"]);
    expect(order.sort()).toEqual(["a", "b", "c"]);
  });

  it("ignores an edge to a table that is not being restored", () => {
    const { order, unordered } = restoreOrder(
      ["public.ocade_outputs"],
      [{ table: "public.ocade_outputs", dependsOn: "storage.objects" }],
    );
    expect(unordered).toEqual([]);
    expect(order).toEqual(["public.ocade_outputs"]);
  });

  it("is stable, so two runs restore in the same order", () => {
    const tables = ["c", "a", "b"];
    const edges = [{ table: "c", dependsOn: "a" }];
    expect(restoreOrder(tables, edges).order).toEqual(restoreOrder(tables, edges).order);
  });
});

describe("building the INSERT", () => {
  it("binds every value instead of interpolating it", () => {
    const statement = insertStatementFor("ocade_messages", {
      id: 1,
      body: "'); drop table ocade_messages; --",
    });
    expect(statement.sql).not.toContain("drop table");
    expect(statement.sql).toBe(
      'insert into "public"."ocade_messages" ("body", "id") values ($1, $2)',
    );
    expect(statement.params).toEqual(["'); drop table ocade_messages; --", 1]);
  });

  it("quotes an identifier so a reserved word or a quote cannot break out", () => {
    expect(quoteIdentifier("order")).toBe('"order"');
    expect(quoteIdentifier('a"; drop table t; --')).toBe('"a""; drop table t; --"');
  });

  it("sends a jsonb column back as text Postgres re-parses", () => {
    const statement = insertStatementFor("ocade_outputs", { id: 1, meta: { kind: "note" } });
    expect(statement.params).toContain('{"kind":"note"}');
  });

  it("sends a timestamp back in a form that round-trips", () => {
    const statement = insertStatementFor("t", { at: new Date("2026-09-10T12:00:00.000Z") });
    expect(statement.params).toEqual(["2026-09-10T12:00:00.000Z"]);
  });

  it("restores into the schema it was told, not always public", () => {
    expect(insertStatementFor("objects", { id: 1 }, "storage").sql).toContain(
      '"storage"."objects"',
    );
  });
});

describe("the evidence file", () => {
  const report = (over: Partial<Parameters<typeof buildReport>[0]> = {}) =>
    buildReport({
      rehearsedAt: "2026-09-10T00:00:00.000Z",
      release: "0.1.0",
      migrationCount: 95,
      inventory: [{ table: "public.ocade_messages", rowCount: 2, digest: "abc" }],
      steps: [{ step: "rows restored", status: "passed", detail: "2 row(s)" }],
      ...over,
    });

  it("is only recovered when every step passed", () => {
    expect(report().recovered).toBe(true);
    expect(
      report({ steps: [{ step: "rows restored", status: "failed", detail: "no" }] }).recovered,
    ).toBe(false);
    // No steps is not a pass. A rehearsal that returned early proved nothing.
    expect(report({ steps: [] }).recovered).toBe(false);
  });

  it("refuses to ship a credential, an address or a connection string", () => {
    expect(evidenceLeaks(report())).toEqual([]);
    for (const [name, poisoned] of [
      ["email address", "restored alice@example.com"],
      ["connection string", "postgresql://user:pw@db.example.com:5432/postgres"],
      ["jwt", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig"],
      ["bearer token", "sk-abcdefghijklmnopqrstuvwxyz"],
    ] as const) {
      const leaked = report({
        steps: [{ step: "rows restored", status: "passed", detail: poisoned }],
      });
      expect(evidenceLeaks(leaked)).toContain(name);
    }
  });
});
