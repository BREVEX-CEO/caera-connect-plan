/**
 * THE ARITHMETIC BEHIND A DATA TABLE, WITH NO REACT IN IT.
 *
 * Sorting, filtering, paging and CSV encoding are the parts of a table that are
 * easy to get subtly wrong and impossible to check by looking at a screenshot:
 * "3 of 12" when there are 11, a numeric column ordered as text so 10 comes
 * before 9, a CSV cell that a spreadsheet executes as a formula. Keeping them
 * here — pure, typed, and free of any rendering concern — is what makes them
 * testable exhaustively rather than sampled through the DOM.
 *
 * `ocade-data-table.tsx` is the only intended consumer. It stays the canonical
 * table component; this is its arithmetic, not a second table.
 */

/** Everything a cell can hold before it is rendered or exported. */
export type CellValue = string | number | boolean | Date | null | undefined;

/** How two cells of a column are ordered against each other. */
export type SortKind = "text" | "number" | "date" | "boolean";

export type SortDirection = "ascending" | "descending";

export interface SortState {
  key: string;
  direction: SortDirection;
}

/**
 * The text a cell shows, searches by, and exports as.
 *
 * One function for all three so a row can never be found by a search term that
 * does not appear on screen, or exported as something different from what was
 * read.
 */
export function cellText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * Order two cells.
 *
 * EMPTY SORTS LAST IN BOTH DIRECTIONS. Reversing the direction to bring blanks
 * to the top is never what somebody wants: they reversed the sort to see the
 * other end of the data, not to see the rows that have none.
 */
export function compareCells(a: CellValue, b: CellValue, kind: SortKind): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  switch (kind) {
    case "number": {
      const left = typeof a === "number" ? a : Number(cellText(a));
      const right = typeof b === "number" ? b : Number(cellText(b));
      // A value that is not a number at all cannot claim an order against one
      // that is, so it falls back to text rather than to NaN, which compares
      // false against everything and silently freezes the sort.
      if (Number.isNaN(left) || Number.isNaN(right)) {
        return cellText(a).localeCompare(cellText(b));
      }
      return left === right ? 0 : left < right ? -1 : 1;
    }
    case "date": {
      const left = a instanceof Date ? a.getTime() : Date.parse(cellText(a));
      const right = b instanceof Date ? b.getTime() : Date.parse(cellText(b));
      if (Number.isNaN(left) || Number.isNaN(right)) {
        return cellText(a).localeCompare(cellText(b));
      }
      return left === right ? 0 : left < right ? -1 : 1;
    }
    case "boolean": {
      const left = a === true || a === "true" ? 1 : 0;
      const right = b === true || b === "true" ? 1 : 0;
      return left - right;
    }
    default:
      return cellText(a).localeCompare(cellText(b), undefined, {
        numeric: true,
        sensitivity: "base",
      });
  }
}

/**
 * Decide how a column sorts from what is actually in it.
 *
 * A column declared `text` that holds numbers orders 10 before 9, and a column
 * declared `number` that holds identifiers turns "A-12" into NaN. Inferring
 * from the values means a consumer only has to declare a kind when the data is
 * genuinely ambiguous.
 */
export function inferSortKind(values: readonly CellValue[]): SortKind {
  const present = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (!present.length) return "text";
  if (present.every((value) => value instanceof Date)) return "date";
  if (present.every((value) => typeof value === "boolean")) return "boolean";
  if (
    present.every(
      (value) => typeof value === "number" || (typeof value === "string" && isNumericText(value)),
    )
  ) {
    return "number";
  }
  return "text";
}

function isNumericText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return Number.isFinite(Number(trimmed));
}

/**
 * Does any of a row's visible text contain the search term?
 *
 * Case-insensitive and accent-insensitive, because somebody searching "resume"
 * expects to find "résumé" and has no way to know which one was typed in.
 */
export function matchesQuery(texts: readonly string[], query: string): boolean {
  const needle = foldForSearch(query);
  if (!needle) return true;
  return texts.some((text) => foldForSearch(text).includes(needle));
}

function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export interface PageWindow {
  /** The page actually shown, clamped into range. */
  page: number;
  pages: number;
  /** 1-based index of the first visible row, or 0 when there are none. */
  from: number;
  /** 1-based index of the last visible row, or 0 when there are none. */
  to: number;
  total: number;
  /** Slice bounds for the current page. */
  start: number;
  end: number;
}

/**
 * "Showing 4-6 of 11" — computed once so the slice and the sentence can never
 * disagree, which is the bug this replaces: a page clamped in one place and
 * described in another.
 */
export function pageWindow(total: number, page: number, pageSize: number): PageWindow {
  const size = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const start = (current - 1) * size;
  const end = Math.min(start + size, total);
  return {
    page: current,
    pages,
    from: total === 0 ? 0 : start + 1,
    to: end,
    total,
    start,
    end,
  };
}

/**
 * The next sort state when a header is pressed.
 *
 * Pressing a different column starts it ascending — never inheriting the
 * previous column's direction, which makes the first press of a new column
 * appear to do nothing when the data happens to be symmetric.
 */
export function nextSort(current: SortState | null, key: string): SortState {
  if (!current || current.key !== key) return { key, direction: "ascending" };
  return { key, direction: current.direction === "ascending" ? "descending" : "ascending" };
}

/*
 * CSV, AND THE REASON THE ESCAPING IS NOT COSMETIC.
 *
 * A spreadsheet treats a cell beginning with =, +, - or @ as a formula, so a
 * value like `=HYPERLINK("http://attacker","click")` typed into a name field
 * and exported becomes executable content in the reader's spreadsheet. That is
 * CSV injection, and it is a real path from "somebody typed a string into your
 * product" to "somebody's machine fetched a URL". Prefixing the cell with a
 * single quote makes the spreadsheet treat it as text.
 *
 * The leading tab and carriage return are here because both are treated as
 * whitespace before the formula character by at least one major spreadsheet,
 * so `\t=cmd` re-enters the same hole through the back door.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV field: formula-neutralised, then quoted if it needs to be. */
export function csvCell(value: CellValue): string {
  const text = cellText(value);
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

/**
 * A complete CSV document.
 *
 * CRLF line endings and a UTF-8 BOM, because the readers people actually have
 * open a BOM-less UTF-8 CSV as the local codepage and turn every non-ASCII name
 * into mojibake.
 */
export function toCsv(headers: readonly string[], rows: readonly (readonly CellValue[])[]): string {
  const lines = [headers.map((header) => csvCell(header)).join(",")];
  for (const row of rows) lines.push(row.map((cell) => csvCell(cell)).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/**
 * Column keys in the order a person arranged them, with any column they have
 * never seen appended rather than dropped.
 *
 * A stored order is a snapshot of the columns that existed when it was saved.
 * Treating it as the whole truth makes a newly added column invisible to
 * everybody who ever reordered that table — a silent data-loss bug that only
 * shows up for long-standing users.
 */
export function orderColumns(all: readonly string[], order: readonly string[]): string[] {
  const known = new Set(all);
  const placed = order.filter((key) => known.has(key));
  const seen = new Set(placed);
  return [...placed, ...all.filter((key) => !seen.has(key))];
}

/** Move a column one place left or right, returning a new order. */
export function moveColumn(order: readonly string[], key: string, delta: number): string[] {
  const index = order.indexOf(key);
  if (index < 0) return [...order];
  const target = Math.min(Math.max(0, index + delta), order.length - 1);
  if (target === index) return [...order];
  const next = [...order];
  next.splice(index, 1);
  next.splice(target, 0, key);
  return next;
}
