import { describe, expect, it } from "vitest";
import {
  cellText,
  compareCells,
  csvCell,
  inferSortKind,
  matchesQuery,
  moveColumn,
  nextSort,
  orderColumns,
  pageWindow,
  toCsv,
} from "../data-table-model";

describe("cell text", () => {
  it("renders every cell type as the same string it searches and exports by", () => {
    expect(cellText("Website")).toBe("Website");
    expect(cellText(42)).toBe("42");
    expect(cellText(true)).toBe("Yes");
    expect(cellText(false)).toBe("No");
    expect(cellText(null)).toBe("");
    expect(cellText(undefined)).toBe("");
    expect(cellText(new Date("2026-09-03T10:00:00.000Z"))).toBe("2026-09-03T10:00:00.000Z");
  });

  it("does not render an invalid date as the words 'Invalid Date'", () => {
    expect(cellText(new Date("not a date"))).toBe("");
  });
});

describe("comparing cells", () => {
  it("orders numbers numerically, not as text", () => {
    // The defect this exists to prevent: "10" sorting before "9".
    expect(compareCells(9, 10, "number")).toBeLessThan(0);
    expect(compareCells("9", "10", "number")).toBeLessThan(0);
  });

  it("orders text with natural numbering so item 2 precedes item 10", () => {
    expect(compareCells("item 2", "item 10", "text")).toBeLessThan(0);
  });

  it("orders dates chronologically whether they arrive as Date or ISO text", () => {
    expect(compareCells(new Date("2026-01-01"), new Date("2026-06-01"), "date")).toBeLessThan(0);
    expect(compareCells("2026-01-01", "2026-06-01", "date")).toBeLessThan(0);
  });

  it("puts empty cells last in BOTH directions", () => {
    // Reversing a sort to see the other end of the data must not fill the top
    // of the table with rows that have no value at all.
    expect(compareCells(null, "a", "text")).toBeGreaterThan(0);
    expect(compareCells("a", null, "text")).toBeLessThan(0);
    expect(compareCells("", "a", "number")).toBeGreaterThan(0);
    expect(compareCells(null, undefined, "text")).toBe(0);
  });

  it("falls back to text rather than freezing when a numeric column holds a word", () => {
    // NaN compares false against everything, which makes a sort silently
    // stop sorting instead of failing.
    const result = compareCells("A-12", "B-3", "number");
    expect(result).toBeLessThan(0);
  });

  it("orders booleans false before true", () => {
    expect(compareCells(false, true, "boolean")).toBeLessThan(0);
    expect(compareCells("true", "false", "boolean")).toBeGreaterThan(0);
  });
});

describe("inferring how a column sorts", () => {
  it("reads numbers, dates, booleans and text from the values themselves", () => {
    expect(inferSortKind([1, 2, 3])).toBe("number");
    expect(inferSortKind(["1", "2.5", "-3"])).toBe("number");
    expect(inferSortKind([new Date(), new Date()])).toBe("date");
    expect(inferSortKind([true, false])).toBe("boolean");
    expect(inferSortKind(["Website", "Model"])).toBe("text");
  });

  it("ignores blanks, and calls an all-blank column text", () => {
    expect(inferSortKind([null, "5", undefined, "6"])).toBe("number");
    expect(inferSortKind([null, undefined, ""])).toBe("text");
  });

  it("does not call an identifier column numeric", () => {
    expect(inferSortKind(["A-12", "A-13"])).toBe("text");
  });
});

describe("searching", () => {
  it("is case-insensitive and accent-insensitive", () => {
    expect(matchesQuery(["Résumé"], "resume")).toBe(true);
    expect(matchesQuery(["WEBSITE"], "web")).toBe(true);
  });

  it("matches everything when the query is blank", () => {
    expect(matchesQuery(["anything"], "   ")).toBe(true);
  });

  it("does not match a row whose text does not contain the term", () => {
    expect(matchesQuery(["Website", "Operational"], "outage")).toBe(false);
  });
});

describe("the page window", () => {
  it("describes the slice it hands back, so the sentence cannot disagree", () => {
    const window = pageWindow(11, 2, 3);
    expect(window).toMatchObject({ page: 2, pages: 4, from: 4, to: 6, start: 3, end: 6 });
  });

  it("clamps a page beyond the end back into range", () => {
    expect(pageWindow(11, 99, 3).page).toBe(4);
    expect(pageWindow(11, 0, 3).page).toBe(1);
    expect(pageWindow(11, Number.NaN, 3).page).toBe(1);
  });

  it("reports no rows rather than 'showing 1-0 of 0'", () => {
    const window = pageWindow(0, 1, 10);
    expect(window).toMatchObject({ page: 1, pages: 1, from: 0, to: 0, total: 0 });
  });

  it("survives a nonsensical page size", () => {
    expect(pageWindow(5, 1, 0).pages).toBe(5);
  });
});

describe("pressing a header", () => {
  it("starts a new column ascending rather than inheriting the last direction", () => {
    expect(nextSort({ key: "name", direction: "descending" }, "state")).toEqual({
      key: "state",
      direction: "ascending",
    });
  });

  it("reverses the column already sorted", () => {
    expect(nextSort({ key: "name", direction: "ascending" }, "name")).toEqual({
      key: "name",
      direction: "descending",
    });
    expect(nextSort(null, "name")).toEqual({ key: "name", direction: "ascending" });
  });
});

describe("CSV", () => {
  it("neutralises every character a spreadsheet treats as the start of a formula", () => {
    // CSV injection: a value typed into the product becoming executable content
    // in whoever opens the export.
    /*
     * The neutralising quote goes on the VALUE, and the value may then be
     * wrapped in CSV quoting because it also contains a comma or a quote mark.
     * The guarantee is about what the spreadsheet finally reads, so the wrapper
     * is unwrapped first — asserting on the raw field would pass for a cell
     * that was quoted and never neutralised.
     */
    const asRead = (field: string) =>
      field.startsWith('"') ? field.slice(1, -1).replace(/""/g, '"') : field;

    for (const dangerous of ["=1+1", '=HYPERLINK("http://x","c")', "+1", "-1", "@SUM(A1)"]) {
      expect(asRead(csvCell(dangerous)).startsWith("'")).toBe(true);
    }
    // Leading whitespace is stripped by spreadsheets before the formula test.
    expect(asRead(csvCell("\t=cmd")).startsWith("'")).toBe(true);
    expect(asRead(csvCell("\r=cmd")).startsWith("'")).toBe(true);
  });

  it("leaves an ordinary negative-looking word alone only when it is not leading", () => {
    expect(csvCell("Model-7")).toBe("Model-7");
  });

  it("quotes and doubles quotes, commas and newlines", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("writes a BOM and CRLF so readers do not mangle non-ASCII names", () => {
    const csv = toCsv(["Name"], [["Rén"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("\r\n");
    expect(csv).toContain("Rén");
  });

  it("escapes a dangerous HEADER too", () => {
    expect(toCsv(["=cmd"], [])).toContain("'=cmd");
  });
});

describe("column order", () => {
  it("keeps a saved order and appends columns the person has never seen", () => {
    // A stored order is a snapshot. Treating it as the whole truth makes a newly
    // added column invisible to everybody who ever reordered the table.
    expect(orderColumns(["a", "b", "c"], ["c", "a"])).toEqual(["c", "a", "b"]);
  });

  it("drops a saved key for a column that no longer exists", () => {
    expect(orderColumns(["a", "b"], ["gone", "b"])).toEqual(["b", "a"]);
  });

  it("moves a column without losing or duplicating one", () => {
    expect(moveColumn(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moveColumn(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveColumn(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveColumn(["a", "b", "c"], "missing", 1)).toEqual(["a", "b", "c"]);
  });
});
