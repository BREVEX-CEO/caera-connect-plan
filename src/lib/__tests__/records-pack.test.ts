import { describe, it, expect } from "vitest";
import {
  RECORDS_PACK,
  validateRecords,
  findDuplicates,
  findOrphans,
  type FieldRule,
} from "../skills/packs/records-pack";
import { parseCsv, type DataTable } from "../skills/packs/data-pack";

/**
 * These run against CSV parsed by the real data pack, so the two packs are
 * exercised together — which is how they are used.
 */

function csv(text: string): DataTable {
  const r = parseCsv(text);
  if (!r.ok) throw new Error(`fixture failed: ${r.reason}`);
  return r.data;
}

const CUSTOMERS = csv(
  [
    "id,name,email,signed_up",
    "C1,Acme Ltd,ops@acme.example,2026-01-15",
    "C2,Borden PLC,hello@borden.example,2026-02-01",
    "C3,Crane GmbH,team@crane.example,2026-03-10",
  ].join("\n"),
);

const RULES: FieldRule[] = [
  { column: "id", type: "text", required: true },
  { column: "name", type: "text", required: true },
  { column: "email", type: "email", required: true },
  { column: "signed_up", type: "date", required: false },
];

describe("the pack states its own limits", () => {
  it("says plainly that it cannot sign into business systems", () => {
    expect(RECORDS_PACK.coverageNote).toMatch(/cannot sign into SAP/i);
    expect(RECORDS_PACK.coverageNote).toMatch(/never creates or changes a record/i);
  });
});

describe("checking an export against its expected shape", () => {
  it("passes a clean file and says how much it checked", () => {
    const r = validateRecords(CUSTOMERS, RULES);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.problems).toHaveLength(0);
    expect(r.evidence).toMatch(/All 3 rows match/);
  });

  /**
   * The check that stops a false pass. Running rules against the wrong file
   * would otherwise find no problems and report success.
   */
  it("refuses when an expected column is absent, rather than reporting zero problems", () => {
    const wrongFile = csv("id,name\nC1,Acme Ltd");
    const r = validateRecords(wrongFile, RULES);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/missing 2 expected columns/i);
    expect(r.reason).toMatch(/won't report it as passing/i);
  });

  it("names the row and column of every problem, not just a count", () => {
    const dirty = csv(
      [
        "id,name,email,signed_up",
        "C1,Acme Ltd,not-an-email,2026-01-15",
        "C2,,hello@b.example,2026-02-01",
      ].join("\n"),
    );
    const r = validateRecords(dirty, RULES);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.problems).toEqual([
      {
        row: 2,
        column: "email",
        value: "not-an-email",
        problem: "doesn't look like an email address",
      },
      { row: 3, column: "name", value: "", problem: "is required but empty" },
    ]);
    expect(r.evidence).toMatch(/first at row 2, email/);
  });

  /**
   * A pattern check accepts 2026-02-30 and every downstream system quietly
   * turns it into 2 March. The date must be real, not merely well-shaped.
   */
  it("rejects a date that matches the pattern but does not exist", () => {
    const impossible = csv(
      ["id,name,email,signed_up", "C1,Acme,a@b.example,2026-02-30"].join("\n"),
    );
    const r = validateRecords(impossible, RULES);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.problems[0].problem).toBe("isn't a real date");
  });

  it("accepts a leap day in a leap year", () => {
    const leap = csv(["id,name,email,signed_up", "C1,Acme,a@b.example,2024-02-29"].join("\n"));
    const r = validateRecords(leap, RULES);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.problems).toHaveLength(0);
  });

  it("leaves an optional empty value alone", () => {
    const partial = csv(["id,name,email,signed_up", "C1,Acme,a@b.example,"].join("\n"));
    const r = validateRecords(partial, RULES);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.problems).toHaveLength(0);
  });

  it("checks number types without accepting text that starts with a digit", () => {
    const table = csv("qty,price\n5,10.50\n3kg,abc");
    const r = validateRecords(table, [
      { column: "qty", type: "integer", required: true },
      { column: "price", type: "decimal", required: true },
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.problems.map((p) => p.problem)).toEqual([
      "should be a whole number",
      "should be a number",
    ]);
  });

  it("reports unexpected extra columns without failing on them", () => {
    const extra = csv("id,name,email,signed_up,internal_note\nC1,Acme,a@b.example,2026-01-15,x");
    const r = validateRecords(extra, RULES);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.extraColumns).toEqual(["internal_note"]);
    expect(r.data.problems).toHaveLength(0);
  });

  it("refuses when given no rules at all", () => {
    expect(validateRecords(CUSTOMERS, []).ok).toBe(false);
  });
});

describe("finding duplicated records", () => {
  it("reports which rows share a key", () => {
    const dupes = csv("id,name\nC1,Acme\nC2,Borden\nC1,Acme Limited");
    const r = findDuplicates(dupes, ["id"]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.duplicates).toEqual([{ key: "C1", rows: [2, 4] }]);
    expect(r.evidence).toMatch(/rows 2, 4/);
  });

  it("handles a composite key", () => {
    const table = csv("region,code\nEU,A1\nUS,A1\nEU,A1");
    const single = findDuplicates(table, ["code"]);
    const composite = findDuplicates(table, ["region", "code"]);
    if (!single.ok || !composite.ok) throw new Error("unreachable");
    expect(single.data.duplicates[0].rows).toEqual([2, 3, 4]);
    expect(composite.data.duplicates).toEqual([{ key: "EU · A1", rows: [2, 4] }]);
  });

  /**
   * Rows with no key are missing IDs, not one duplicate group. Merging them
   * would be a data-loss bug in whatever imports the file next.
   */
  it("separates blank keys from genuine duplicates", () => {
    const table = csv("id,name\n,Acme\n,Borden\nC1,Crane");
    const r = findDuplicates(table, ["id"]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.duplicates).toHaveLength(0);
    expect(r.data.blankKeyRows).toEqual([2, 3]);
    expect(r.evidence).toMatch(/2 rows have no key at all/);
  });

  it("cannot be fooled by a value containing the key joiner", () => {
    // "A" + "B|C" must not collide with "A|B" + "C".
    const table = csv("a,b\nX,Y·Z\nX·Y,Z");
    const r = findDuplicates(table, ["a", "b"]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.duplicates).toHaveLength(0);
  });

  it("reports honestly when there are none", () => {
    const r = findDuplicates(CUSTOMERS, ["id"]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/No duplicates across 3 rows/);
  });

  it("refuses a key column that isn't in the file", () => {
    expect(findDuplicates(CUSTOMERS, ["customer_id"]).ok).toBe(false);
    expect(findDuplicates(CUSTOMERS, []).ok).toBe(false);
  });
});

describe("finding references that point nowhere", () => {
  const ORDERS = csv(
    ["order_id,customer_id,total", "O1,C1,100", "O2,C9,250", "O3,C2,75", "O4,,50"].join("\n"),
  );

  it("finds orders whose customer isn't in the customer export", () => {
    const r = findOrphans(ORDERS, "customer_id", CUSTOMERS, "id");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toEqual([{ row: 3, value: "C9" }]);
    expect(r.evidence).toMatch(/1 of 4 references point at records that aren't/);
  });

  it("does not treat a blank reference as an orphan", () => {
    const r = findOrphans(ORDERS, "customer_id", CUSTOMERS, "id");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.map((o) => o.row)).not.toContain(5);
  });

  it("confirms a clean set", () => {
    const clean = csv("order_id,customer_id\nO1,C1\nO2,C2");
    const r = findOrphans(clean, "customer_id", CUSTOMERS, "id");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(0);
    expect(r.evidence).toMatch(/All 2 references resolve/);
  });

  /**
   * If the parent key column is empty everywhere, EVERY reference looks broken.
   * Reporting "4 orphans" there sends someone chasing a problem that is
   * actually "you exported the wrong file".
   */
  it("refuses when the referenced column is empty in every row", () => {
    const empty = csv("id,name\n,Acme\n,Borden");
    const r = findOrphans(ORDERS, "customer_id", empty, "id");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/exported the right file/i);
  });

  it("refuses a column that isn't in either file", () => {
    expect(findOrphans(ORDERS, "nope", CUSTOMERS, "id").ok).toBe(false);
    expect(findOrphans(ORDERS, "customer_id", CUSTOMERS, "nope").ok).toBe(false);
  });
});
