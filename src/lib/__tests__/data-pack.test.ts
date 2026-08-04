import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DATA_PACK,
  parseCsv,
  parseJsonRecords,
  summariseColumn,
  filterRows,
} from "../skills/packs/data-pack";

/**
 * REAL FILE TEST.
 *
 * Files are written to disk, read back, parsed, and the computed statistics are
 * checked against independently calculated values — so a wrong formula fails
 * here rather than reaching a user as a confident number.
 */

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ocade-data-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function csvFile(name: string, content: string) {
  const p = join(dir, name);
  await writeFile(p, content, "utf8");
  return parseCsv(await readFile(p, "utf8"));
}

describe("reading a real CSV", () => {
  it("parses a straightforward file", async () => {
    const r = await csvFile("sales.csv", "region,amount\nNorth,120\nSouth,80\n");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.columns).toEqual(["region", "amount"]);
    expect(r.data.rows).toHaveLength(2);
    expect(r.data.rows[0]).toEqual({ region: "North", amount: "120" });
    expect(r.evidence).toBe("2 rows × 2 columns.");
  });

  /**
   * A naive split(",") corrupts this silently — the row count still looks
   * plausible, so the damage is invisible until someone acts on it.
   */
  it("handles quoted fields containing commas", async () => {
    const r = await csvFile("q.csv", 'name,note\n"Smith, John","said ""hello"""\n');
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.rows[0].name).toBe("Smith, John");
    expect(r.data.rows[0].note).toBe('said "hello"');
  });

  it("handles a quoted field containing a newline", async () => {
    const r = await csvFile("m.csv", 'id,body\n1,"line one\nline two"\n');
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.rows).toHaveLength(1);
    expect(r.data.rows[0].body).toBe("line one\nline two");
  });

  it("REFUSES a ragged row rather than guessing which column a value belongs to", async () => {
    const r = await csvFile("bad.csv", "a,b,c\n1,2,3\n4,5\n");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't guess which column/i);
    expect(r.reason).toContain("Row 3");
  });

  it("reports an unclosed quote as possible truncation", async () => {
    const r = await csvFile("trunc.csv", 'a,b\n1,"unterminated\n');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/unclosed quote/i);
  });

  it("says a header-only file has no data, rather than returning zero rows as success", async () => {
    const r = await csvFile("empty.csv", "a,b\n");
    expect(r.ok).toBe(false);
  });
});

describe("reading real JSON", () => {
  it("parses a list of records", async () => {
    const p = join(dir, "d.json");
    await writeFile(
      p,
      JSON.stringify([
        { id: 1, name: "A" },
        { id: 2, name: "B" },
      ]),
      "utf8",
    );
    const r = parseJsonRecords(await readFile(p, "utf8"));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.rows).toHaveLength(2);
    expect(r.data.columns.sort()).toEqual(["id", "name"]);
  });

  it("unions fields across records rather than dropping the rare ones", () => {
    const r = parseJsonRecords(JSON.stringify([{ a: 1 }, { b: 2 }]));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.columns.sort()).toEqual(["a", "b"]);
    // A missing field is empty, not invented.
    expect(r.data.rows[0].b).toBe("");
  });

  it("reports invalid JSON with the parser's own message", () => {
    const r = parseJsonRecords("{not json");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/isn't valid JSON/i);
  });

  it("refuses a mixed list rather than silently skipping non-records", () => {
    const r = parseJsonRecords(JSON.stringify([{ a: 1 }, "not a record"]));
    expect(r.ok).toBe(false);
  });
});

/**
 * The core honesty rule for analysis: a statistic that cannot be computed
 * correctly is not returned.
 */
describe("summarising a column honestly", () => {
  const table = () => {
    const r = parseCsv("region,amount,note\nNorth,120,ok\nSouth,80,fine\nEast,40,good\n");
    if (!r.ok) throw new Error("fixture failed");
    return r.data;
  };

  it("computes statistics that match hand calculation", () => {
    const r = summariseColumn(table(), "amount");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    // 120 + 80 + 40 = 240; mean 80; min 40; max 120.
    expect(r.data.sum).toBe(240);
    expect(r.data.mean).toBe(80);
    expect(r.data.min).toBe(40);
    expect(r.data.max).toBe(120);
    expect(r.data.count).toBe(3);
  });

  it("recognises a text column and offers only the count", () => {
    const r = summariseColumn(table(), "note");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.numeric).toBe(false);
    expect(r.data.mean).toBeUndefined();
    expect(r.evidence).toMatch(/only the count/i);
  });

  /**
   * A mean over "the rows that happened to parse" is a DIFFERENT number from
   * the one asked for, and it looks identical. Refusing is the only honest
   * option.
   */
  it("REFUSES to average a column that mixes numbers and text", () => {
    const r = parseCsv("v\n10\n20\nN/A\n40\n");
    if (!r.ok) throw new Error("fixture failed");
    const s = summariseColumn(r.data, "v");
    expect(s.ok).toBe(false);
    if (s.ok) throw new Error("unreachable");
    expect(s.reason).toMatch(/won't average part of a column/i);
    expect(s.reason).toContain("N/A");
  });

  /** An empty column has no mean. It does not have a mean of zero. */
  it("does not invent a mean of zero for an empty column", () => {
    const r = parseCsv("a,b\n1,\n2,\n");
    if (!r.ok) throw new Error("fixture failed");
    const s = summariseColumn(r.data, "b");
    expect(s.ok).toBe(true);
    if (!s.ok) throw new Error("unreachable");
    expect(s.data.mean).toBeUndefined();
    expect(s.data.count).toBe(0);
    expect(s.evidence).toMatch(/nothing to average/i);
  });

  it("names the available columns when asked for one that doesn't exist", () => {
    const s = summariseColumn(table(), "profit");
    expect(s.ok).toBe(false);
    if (s.ok) throw new Error("unreachable");
    expect(s.reason).toContain("region, amount, note");
  });

  it("handles thousands separators without misreading the value", () => {
    const r = parseCsv("v\n1,000\n2,000\n");
    // A comma inside an unquoted field makes this ragged — refused, not guessed.
    expect(r.ok).toBe(false);
  });

  it("reads quoted thousands separators correctly", () => {
    const r = parseCsv('v\n"1,000"\n"2,000"\n');
    if (!r.ok) throw new Error("fixture failed");
    const s = summariseColumn(r.data, "v");
    if (!s.ok) throw new Error("unreachable");
    expect(s.data.sum).toBe(3000);
  });
});

describe("filtering reports what it actually matched", () => {
  it("states how many of how many matched", () => {
    const r = parseCsv("region,amount\nNorth,120\nSouth,80\nNorth,40\n");
    if (!r.ok) throw new Error("fixture failed");
    const f = filterRows(r.data, "region", "North");
    expect(f.ok).toBe(true);
    if (!f.ok) throw new Error("unreachable");
    expect(f.data.rows).toHaveLength(2);
    expect(f.evidence).toBe("2 of 3 rows match region = “North”.");
  });

  it("reports zero matches honestly rather than as an error", () => {
    const r = parseCsv("region,amount\nNorth,120\n");
    if (!r.ok) throw new Error("fixture failed");
    const f = filterRows(r.data, "region", "West");
    expect(f.ok).toBe(true);
    if (!f.ok) throw new Error("unreachable");
    expect(f.data.rows).toHaveLength(0);
    expect(f.evidence).toMatch(/0 of 1 rows/);
  });
});

describe("the pack is honest about itself", () => {
  it("is read-only — analysis never modifies the source data", () => {
    for (const c of DATA_PACK.capabilities) {
      expect(c.mutating).toBe(false);
    }
  });

  it("uses direct file access, never vision", () => {
    for (const c of DATA_PACK.capabilities) {
      expect(c.methods).toEqual(["file"]);
    }
  });
});
