import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
  cellText,
  compareCells,
  inferSortKind,
  matchesQuery,
  moveColumn,
  nextSort,
  orderColumns,
  pageWindow,
  toCsv,
  type CellValue,
  type SortDirection,
  type SortKind,
  type SortState,
} from "./data-table-model";
import {
  DEFAULT_TABLE_PREFERENCES,
  readTablePreferences,
  writeTablePreferences,
  type DataTablePreferences,
} from "./data-table-preferences";

/**
 * OCADE'S ONE TABLE.
 *
 * PLAN.md §M asks for this component to be COMPLETED rather than replaced, and
 * that is what happened: the same export, the same import path, the same
 * caption/columns/rows/onAction contract that `/status` already passes, with
 * the missing half built onto it. Nothing else in the repository renders a data
 * table, and nothing else should — a second one is how two tables end up
 * disagreeing about what "sorted" means.
 *
 * WHAT WAS HERE BEFORE, AND WHY IT CHANGED. Sorting was a `<select>` of column
 * names beside an Ascending/Descending toggle. That works with a mouse and is
 * invisible to a screen reader: nothing told it which column was sorted or
 * which way, because `aria-sort` lives on the header cell and there were no
 * sortable headers to put it on. Sorting is now done by pressing the header, so
 * the state is where assistive technology looks for it. Search, sorting,
 * pagination and the empty state all behave as they did.
 *
 * WHAT IS DELIBERATELY NOT HERE. There is no "select every row in the database"
 * button that the client fabricates by asking for a huge page. Selecting the
 * whole result set is only offered when the caller can genuinely enumerate it —
 * in client mode because every row is already in hand, and in server mode only
 * when the caller supplies a function that asks the server. The same rule
 * governs export: OCADE never writes a CSV of rows the person could not have
 * retrieved, and never implies it exported more than it did.
 */

export type { CellValue, SortDirection, SortKind, SortState };

/**
 * The original row shape, kept so existing callers compile unchanged.
 *
 * New callers should pass their own type: the component is generic and does not
 * need every field to be a string.
 */
export interface OcadeTableRow {
  id: string;
  [key: string]: string;
}

export interface OcadeTableColumn<Row = OcadeTableRow> {
  key: string;
  label: string;
  /** Reads the sortable, searchable, exportable value. Defaults to `row[key]`. */
  value?: (row: Row) => CellValue;
  /** Renders the cell. Defaults to the text of `value`. */
  render?: (row: Row) => ReactNode;
  /** `false` makes the column unsortable; otherwise the kind is inferred. */
  sort?: SortKind | false;
  align?: "start" | "end";
  /** The identifying column: never hideable, and the one that can be frozen. */
  required?: boolean;
  /** Excluded from CSV. Use for columns that are pure presentation. */
  exportable?: boolean;
  /** Shown under the label on the narrow-screen card. */
  hint?: string;
}

export interface OcadeTableRowAction<Row> {
  label: string;
  run: (row: Row) => void;
  /** Destructive actions are styled and announced as such. */
  destructive?: boolean;
  disabled?: boolean;
}

export interface OcadeTableBulkAction<Row> {
  label: string;
  run: (rows: readonly Row[]) => void | Promise<void>;
  destructive?: boolean;
}

export interface OcadeTableFilter<Row> {
  id: string;
  label: string;
  options: readonly { value: string; label: string }[];
  /** Keeps a row when the filter is set to `value`. */
  test: (row: Row, value: string) => boolean;
}

export interface OcadeTableServerMode<Row> {
  /** Rows matching the current query and filters on the server, not on this page. */
  total: number;
  page: number;
  pageSize: number;
  sort: SortState | null;
  query: string;
  filters: Record<string, string>;
  onChange: (next: {
    page: number;
    pageSize: number;
    sort: SortState | null;
    query: string;
    filters: Record<string, string>;
  }) => void;
  busy?: boolean;
  /**
   * Asks the server for the whole authorized result set, for export or
   * select-all. Absent means those actions are offered for this page only, and
   * labelled that way — never silently narrowed.
   */
  fetchAll?: () => Promise<readonly Row[]>;
}

export interface OcadeDataTableProps<Row extends { id: string }> {
  caption: string;
  columns: readonly OcadeTableColumn<Row>[];
  rows: readonly Row[];
  /** The primary row action. Kept for the callers that already pass it. */
  onAction?: (row: Row) => void;
  actionLabel?: string;
  /** Additional per-row actions, decided per row so a row can offer none. */
  rowActions?: (row: Row) => readonly OcadeTableRowAction<Row>[];
  /** Enables saved column layout. Without it nothing is persisted. */
  tableId?: string;
  /** Separates one account's saved layout from another's on a shared browser. */
  preferenceScope?: string;
  selectable?: boolean;
  bulkActions?: readonly OcadeTableBulkAction<Row>[];
  filters?: readonly OcadeTableFilter<Row>[];
  pageSizeOptions?: readonly number[];
  defaultPageSize?: number;
  /** Keeps the identifying column visible while the rest scrolls sideways. */
  freezeFirstColumn?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  searchPlaceholder?: string;
  /** Offers a CSV of the rows the person can already see. */
  exportFileName?: string;
  server?: OcadeTableServerMode<Row>;
}

const DEFAULT_PAGE_SIZES = [5, 10, 25, 50] as const;

export function OcadeDataTable<Row extends { id: string } = OcadeTableRow>({
  caption,
  columns,
  rows,
  onAction,
  actionLabel = "Details",
  rowActions,
  tableId,
  preferenceScope = "device",
  selectable = false,
  bulkActions,
  filters,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  defaultPageSize,
  freezeFirstColumn = false,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = "No rows match this search.",
  searchPlaceholder,
  exportFileName,
  server,
}: OcadeDataTableProps<Row>) {
  const domId = useId();
  const columnKeys = useMemo(() => columns.map((column) => column.key), [columns]);

  /*
   * SAVED LAYOUT IS READ ONCE, AFTER MOUNT.
   *
   * Reading `localStorage` during render would make the server-rendered markup
   * and the first client render disagree for anybody who has ever hidden a
   * column, which React resolves by throwing the server's HTML away. The table
   * paints in its default layout for one frame and then adopts the saved one.
   */
  const [preferences, setPreferences] = useState<DataTablePreferences>(() => ({
    ...DEFAULT_TABLE_PREFERENCES,
    pageSize: defaultPageSize ?? DEFAULT_TABLE_PREFERENCES.pageSize,
  }));
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    if (!tableId) {
      setPreferencesLoaded(true);
      return;
    }
    const saved = readTablePreferences(preferenceScope, tableId);
    setPreferences({
      ...saved,
      pageSize: saved.pageSize || defaultPageSize || DEFAULT_TABLE_PREFERENCES.pageSize,
    });
    setPreferencesLoaded(true);
  }, [tableId, preferenceScope, defaultPageSize]);

  const savePreferences = useCallback(
    (next: DataTablePreferences) => {
      setPreferences(next);
      if (tableId && preferencesLoaded) writeTablePreferences(preferenceScope, tableId, next);
    },
    [tableId, preferenceScope, preferencesLoaded],
  );

  const [query, setQuery] = useState(server?.query ?? "");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(server?.filters ?? {});
  const [sort, setSort] = useState<SortState | null>(server?.sort ?? null);
  const [page, setPage] = useState(server?.page ?? 1);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);

  const pageSize = server?.pageSize ?? preferences.pageSize;

  /* Column order and visibility, resolved against the columns that exist now. */
  const orderedKeys = useMemo(
    () => orderColumns(columnKeys, preferences.order),
    [columnKeys, preferences.order],
  );
  const hidden = useMemo(() => new Set(preferences.hidden), [preferences.hidden]);
  const visibleColumns = useMemo(() => {
    const byKey = new Map(columns.map((column) => [column.key, column]));
    return orderedKeys
      .map((key) => byKey.get(key))
      .filter((column): column is OcadeTableColumn<Row> => Boolean(column))
      .filter((column) => column.required || !hidden.has(column.key));
  }, [columns, orderedKeys, hidden]);

  const valueOf = useCallback((column: OcadeTableColumn<Row>, row: Row): CellValue => {
    if (column.value) return column.value(row);
    return (row as unknown as Record<string, CellValue>)[column.key];
  }, []);

  /* Sort kinds are inferred from the data once per column, not per comparison. */
  const sortKinds = useMemo(() => {
    const kinds = new Map<string, SortKind>();
    for (const column of columns) {
      if (column.sort === false) continue;
      if (column.sort) {
        kinds.set(column.key, column.sort);
        continue;
      }
      kinds.set(column.key, inferSortKind(rows.slice(0, 200).map((row) => valueOf(column, row))));
    }
    return kinds;
  }, [columns, rows, valueOf]);

  /*
   * IN SERVER MODE THE ROWS ARE ALREADY THE ANSWER.
   *
   * Filtering or sorting them again here would reorder one page against the
   * whole result set and produce a table that looks sorted and is not.
   */
  const filtered = useMemo(() => {
    if (server) return rows;
    let result = rows;
    if (filters?.length) {
      for (const filter of filters) {
        const value = activeFilters[filter.id];
        if (!value) continue;
        result = result.filter((row) => filter.test(row, value));
      }
    }
    if (query.trim()) {
      result = result.filter((row) =>
        matchesQuery(
          columns.map((column) => cellText(valueOf(column, row))),
          query,
        ),
      );
    }
    if (sort) {
      const column = columns.find((entry) => entry.key === sort.key);
      if (column) {
        const kind = sortKinds.get(sort.key) ?? "text";
        const factor = sort.direction === "ascending" ? 1 : -1;
        result = [...result].sort(
          (a, b) => factor * compareCells(valueOf(column, a), valueOf(column, b), kind),
        );
      }
    }
    return result;
  }, [server, rows, filters, activeFilters, query, sort, columns, sortKinds, valueOf]);

  const total = server?.total ?? filtered.length;
  const currentPage = server?.page ?? page;
  const window = pageWindow(total, currentPage, pageSize);
  const visibleRows = server ? rows : filtered.slice(window.start, window.end);

  /* Every change of query, filter, sort or page size returns to page one. */
  const changeServer = useCallback(
    (patch: Partial<Parameters<OcadeTableServerMode<Row>["onChange"]>[0]>) => {
      if (!server) return;
      server.onChange({
        page: patch.page ?? server.page,
        pageSize: patch.pageSize ?? server.pageSize,
        sort: patch.sort !== undefined ? patch.sort : server.sort,
        query: patch.query ?? server.query,
        filters: patch.filters ?? server.filters,
      });
    },
    [server],
  );

  const applyQuery = (value: string) => {
    setQuery(value);
    setPage(1);
    if (server) changeServer({ query: value, page: 1 });
  };

  const applyFilter = (id: string, value: string) => {
    const next = { ...activeFilters };
    if (value) next[id] = value;
    else delete next[id];
    setActiveFilters(next);
    setPage(1);
    if (server) changeServer({ filters: next, page: 1 });
  };

  const clearFilters = () => {
    setActiveFilters({});
    setQuery("");
    setPage(1);
    if (server) changeServer({ filters: {}, query: "", page: 1 });
    setAnnouncement("Filters cleared.");
  };

  const applySort = (key: string) => {
    const state = nextSort(server?.sort ?? sort, key);
    setSort(state);
    setPage(1);
    if (server) changeServer({ sort: state, page: 1 });
    const column = columns.find((entry) => entry.key === key);
    setAnnouncement(
      `Sorted by ${column?.label ?? key}, ${state.direction === "ascending" ? "ascending" : "descending"}.`,
    );
  };

  const applyPageSize = (size: number) => {
    savePreferences({ ...preferences, pageSize: size });
    setPage(1);
    if (server) changeServer({ pageSize: size, page: 1 });
  };

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), window.pages);
    setPage(clamped);
    if (server) changeServer({ page: clamped });
  };

  const toggleColumn = (key: string) => {
    const column = columns.find((entry) => entry.key === key);
    if (column?.required) return;
    const nextHidden = hidden.has(key)
      ? preferences.hidden.filter((entry) => entry !== key)
      : [...preferences.hidden, key];
    savePreferences({ ...preferences, hidden: nextHidden, order: orderedKeys });
    setAnnouncement(`${column?.label ?? key} ${hidden.has(key) ? "shown" : "hidden"}.`);
  };

  const shiftColumn = (key: string, delta: number) => {
    savePreferences({
      ...preferences,
      order: moveColumn(orderedKeys, key, delta),
      hidden: preferences.hidden,
    });
  };

  const resetLayout = () => {
    savePreferences({ hidden: [], order: [], pageSize: preferences.pageSize });
    setAnnouncement("Column layout reset.");
  };

  /* ---- selection ---- */

  const selectedRows = useMemo(
    () => (server ? rows : filtered).filter((row) => selected.has(row.id)),
    [server, rows, filtered, selected],
  );

  const pageIds = visibleRows.map((row) => row.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setAnnouncement(`${next.size} row${next.size === 1 ? "" : "s"} selected.`);
  };

  const togglePage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) for (const id of pageIds) next.delete(id);
    else for (const id of pageIds) next.add(id);
    setSelected(next);
    setAnnouncement(`${next.size} row${next.size === 1 ? "" : "s"} selected.`);
  };

  /*
   * SELECT EVERY MATCHING ROW — only where every matching row can actually be
   * named. In client mode they are all here. In server mode this asks the
   * server, and when the caller has given no way to ask, the control is not
   * offered at all rather than quietly selecting one page.
   */
  const canSelectAllMatching = Boolean(selectable) && (!server || Boolean(server.fetchAll));
  const selectAllMatching = async () => {
    if (!server) {
      setSelected(new Set(filtered.map((row) => row.id)));
      setAnnouncement(`All ${filtered.length} matching rows selected.`);
      return;
    }
    if (!server.fetchAll) return;
    setBulkBusy(true);
    try {
      const all = await server.fetchAll();
      setSelected(new Set(all.map((row) => row.id)));
      setAnnouncement(`All ${all.length} matching rows selected.`);
    } finally {
      setBulkBusy(false);
    }
  };

  const clearSelection = () => {
    setSelected(new Set());
    setAnnouncement("Selection cleared.");
  };

  const runBulk = async (action: OcadeTableBulkAction<Row>) => {
    if (!selectedRows.length) return;
    setBulkBusy(true);
    try {
      await action.run(selectedRows);
    } finally {
      setBulkBusy(false);
    }
  };

  /* ---- export ---- */

  const exportableColumns = visibleColumns.filter((column) => column.exportable !== false);

  const runExport = async () => {
    if (!exportFileName) return;
    setExportBusy(true);
    try {
      const source: readonly Row[] = server
        ? server.fetchAll
          ? await server.fetchAll()
          : rows
        : filtered;
      const csv = toCsv(
        exportableColumns.map((column) => column.label),
        source.map((row) => exportableColumns.map((column) => valueOf(column, row))),
      );
      downloadCsv(`${exportFileName}.csv`, csv);
      setAnnouncement(`Exported ${source.length} row${source.length === 1 ? "" : "s"}.`);
    } finally {
      setExportBusy(false);
    }
  };

  /*
   * The label says what the file will contain. In server mode without a
   * `fetchAll`, that is this page — and claiming otherwise would be the export
   * equivalent of a fake success state.
   */
  const exportLabel = server && !server.fetchAll ? "Export this page (CSV)" : "Export CSV";

  /* ---- keyboard navigation ---- */

  const bodyRef = useRef<HTMLTableSectionElement | null>(null);
  const onRowKeyDown = (event: ReactKeyboardEvent<HTMLTableRowElement>, row: Row) => {
    const body = bodyRef.current;
    if (!body) return;
    const rowsEls = Array.from(body.querySelectorAll<HTMLTableRowElement>("tr[data-row]"));
    const index = rowsEls.indexOf(event.currentTarget);
    const focus = (target: number) => {
      const element = rowsEls[Math.min(Math.max(0, target), rowsEls.length - 1)];
      element?.focus();
      event.preventDefault();
    };
    switch (event.key) {
      case "ArrowDown":
        focus(index + 1);
        break;
      case "ArrowUp":
        focus(index - 1);
        break;
      case "Home":
        focus(0);
        break;
      case "End":
        focus(rowsEls.length - 1);
        break;
      case " ":
        if (selectable) {
          toggleRow(row.id);
          // Otherwise the page scrolls under the person's hands the moment they
          // tick a row, which is the same defect on every keyboard-driven list.
          event.preventDefault();
        }
        break;
      case "Enter":
        if (onAction) {
          onAction(row);
          event.preventDefault();
        }
        break;
      default:
        break;
    }
  };

  const activeFilterChips = Object.entries(activeFilters).flatMap(([id, value]) => {
    const filter = filters?.find((entry) => entry.id === id);
    if (!filter) return [];
    const option = filter.options.find((entry) => entry.value === value);
    return [{ id, label: `${filter.label}: ${option?.label ?? value}` }];
  });
  const hasActiveNarrowing = Boolean(query.trim()) || activeFilterChips.length > 0;

  const busy = loading || Boolean(server?.busy);

  return (
    <section aria-label={caption} className="space-y-3">
      {/* One live region for sort, selection, filter and export announcements. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Search table
          <input
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => applyQuery(event.target.value)}
            className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-3 text-foreground"
          />
        </label>

        {filters?.map((filter) => (
          <label key={filter.id} className="text-xs text-muted-foreground">
            {filter.label}
            <select
              value={activeFilters[filter.id] ?? ""}
              onChange={(event) => applyFilter(filter.id, event.target.value)}
              className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-foreground"
            >
              <option value="">Any</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        <label className="text-xs text-muted-foreground">
          Rows per page
          <select
            value={pageSize}
            onChange={(event) => applyPageSize(Number(event.target.value))}
            className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-foreground"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setLayoutOpen((open) => !open)}
          aria-expanded={layoutOpen}
          aria-controls={`${domId}-layout`}
          className="min-h-9 rounded-md border border-border/70 px-3 text-xs"
        >
          Columns
        </button>

        {exportFileName ? (
          <button
            type="button"
            onClick={() => void runExport()}
            disabled={exportBusy || busy}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border/70 px-3 text-xs disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {exportBusy ? "Preparing…" : exportLabel}
          </button>
        ) : null}
      </div>

      {layoutOpen ? (
        <div id={`${domId}-layout`} className="rounded-xl border border-border/60 bg-card/30 p-3">
          <p className="text-xs font-medium">Columns shown, and their order</p>
          <ul className="mt-2 space-y-1">
            {orderedKeys.map((key, index) => {
              const column = columns.find((entry) => entry.key === key);
              if (!column) return null;
              const isHidden = hidden.has(key) && !column.required;
              return (
                <li key={key} className="flex items-center gap-2 text-xs">
                  <label className="flex flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      disabled={column.required}
                      onChange={() => toggleColumn(key)}
                    />
                    <span>{column.label}</span>
                    {column.required ? (
                      <span className="text-muted-foreground">(always shown)</span>
                    ) : null}
                  </label>
                  <button
                    type="button"
                    onClick={() => shiftColumn(key, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${column.label} earlier`}
                    className="min-h-8 rounded border border-border/70 px-2 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftColumn(key, 1)}
                    disabled={index === orderedKeys.length - 1}
                    aria-label={`Move ${column.label} later`}
                    className="min-h-8 rounded border border-border/70 px-2 disabled:opacity-40"
                  >
                    ↓
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={resetLayout}
            className="mt-2 min-h-8 rounded-md border border-border/70 px-3 text-xs"
          >
            Reset columns
          </button>
          {!tableId ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              This layout applies to the current view only. It is not saved.
            </p>
          ) : null}
        </div>
      ) : null}

      {activeFilterChips.length || query.trim() ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {query.trim() ? (
            <button
              type="button"
              onClick={() => applyQuery("")}
              className="min-h-8 rounded-full border border-border/70 px-3 text-xs"
            >
              Search: {query.trim()} ✕
            </button>
          ) : null}
          {activeFilterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => applyFilter(chip.id, "")}
              className="min-h-8 rounded-full border border-border/70 px-3 text-xs"
            >
              {chip.label} ✕
            </button>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-8 rounded-md px-2 text-xs underline"
          >
            Clear filters
          </button>
        </div>
      ) : null}

      {selectable ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>
            {selected.size} selected
            {selected.size ? ` of ${total}` : ""}
          </span>
          {canSelectAllMatching && selected.size < total ? (
            <button
              type="button"
              onClick={() => void selectAllMatching()}
              disabled={bulkBusy}
              className="min-h-8 rounded-md border border-border/70 px-3 disabled:opacity-40"
            >
              Select all {total} matching
            </button>
          ) : null}
          {selected.size ? (
            <button
              type="button"
              onClick={clearSelection}
              className="min-h-8 rounded-md border border-border/70 px-3"
            >
              Clear selection
            </button>
          ) : null}
          {bulkActions?.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => void runBulk(action)}
              disabled={!selected.size || bulkBusy}
              className={`min-h-8 rounded-md border px-3 disabled:opacity-40 ${
                action.destructive ? "border-destructive/60 text-destructive" : "border-border/70"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm"
        >
          <p>{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 min-h-9 rounded-md border border-border/70 px-3 text-xs"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {/* WIDE SCREENS: the table. */}
      <div className="hidden overflow-x-auto rounded-xl border border-border/60 md:block">
        <table className="w-full min-w-[560px] text-left text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted/40">
            <tr>
              {selectable ? (
                <th scope="col" className="p-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={togglePage}
                      aria-label={`Select all ${pageIds.length} rows on this page`}
                    />
                    <span className="sr-only">Select rows on this page</span>
                  </label>
                </th>
              ) : null}
              {visibleColumns.map((column, index) => {
                const sortable = column.sort !== false;
                const active = (server?.sort ?? sort)?.key === column.key;
                const direction = active ? (server?.sort ?? sort)!.direction : undefined;
                const frozen = freezeFirstColumn && index === 0;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? direction : sortable ? "none" : undefined}
                    className={`p-0 font-medium ${column.align === "end" ? "text-right" : ""} ${
                      frozen ? "sticky left-0 z-10 bg-muted/60" : ""
                    }`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => applySort(column.key)}
                        className="flex min-h-9 w-full items-center gap-1 p-3 text-left font-medium"
                      >
                        {column.label}
                        {active ? (
                          direction === "ascending" ? (
                            <ArrowUp className="h-3 w-3" aria-hidden />
                          ) : (
                            <ArrowDown className="h-3 w-3" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />
                        )}
                      </button>
                    ) : (
                      <span className="block p-3">{column.label}</span>
                    )}
                  </th>
                );
              })}
              {onAction || rowActions ? (
                <th scope="col" className="p-3">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {busy
              ? Array.from({ length: Math.min(pageSize, 5) }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="border-t border-border/50">
                    <td
                      colSpan={
                        visibleColumns.length +
                        (selectable ? 1 : 0) +
                        (onAction || rowActions ? 1 : 0)
                      }
                      className="p-3"
                    >
                      <span className="block h-4 w-full rounded bg-muted/60 motion-safe:animate-pulse" />
                      <span className="sr-only">Loading rows</span>
                    </td>
                  </tr>
                ))
              : visibleRows.map((row) => (
                  <tr
                    key={row.id}
                    data-row
                    tabIndex={0}
                    onKeyDown={(event) => onRowKeyDown(event, row)}
                    aria-selected={selectable ? selected.has(row.id) : undefined}
                    className="border-t border-border/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {selectable ? (
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select ${cellText(valueOf(visibleColumns[0] ?? columns[0], row)) || row.id}`}
                        />
                      </td>
                    ) : null}
                    {visibleColumns.map((column, index) => (
                      <td
                        key={column.key}
                        className={`p-3 ${column.align === "end" ? "text-right" : ""} ${
                          freezeFirstColumn && index === 0 ? "sticky left-0 z-10 bg-card" : ""
                        }`}
                      >
                        {column.render ? column.render(row) : cellText(valueOf(column, row))}
                      </td>
                    ))}
                    {onAction || rowActions ? (
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {onAction ? (
                            <button
                              type="button"
                              onClick={() => onAction(row)}
                              className="min-h-9 underline"
                            >
                              {actionLabel}
                            </button>
                          ) : null}
                          {rowActions?.(row).map((action) => (
                            <button
                              key={action.label}
                              type="button"
                              disabled={action.disabled}
                              onClick={() => action.run(row)}
                              className={`min-h-9 underline disabled:opacity-40 ${
                                action.destructive ? "text-destructive" : ""
                              }`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
          </tbody>
        </table>
        {!busy && !visibleRows.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            {hasActiveNarrowing ? emptyMessage : "There is nothing here yet."}
          </p>
        ) : null}
      </div>

      {/*
       * NARROW SCREENS: the same rows as cards.
       *
       * A table with eight columns on a 320px screen is either unreadable or
       * scrolls the page sideways, which is the single most common mobile
       * defect. This is a real fallback rather than a smaller table: one card
       * per row, label and value stacked, the same actions.
       */}
      <div className="space-y-2 md:hidden">
        {busy ? (
          <p className="rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
            Loading rows…
          </p>
        ) : visibleRows.length ? (
          visibleRows.map((row) => (
            <article key={row.id} className="rounded-xl border border-border/60 p-3">
              {selectable ? (
                <label className="mb-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                  />
                  Select this row
                </label>
              ) : null}
              <dl className="space-y-1">
                {visibleColumns.map((column) => (
                  <div key={column.key} className="flex justify-between gap-3 text-xs">
                    <dt className="text-muted-foreground">{column.label}</dt>
                    <dd className="text-right">
                      {column.render ? column.render(row) : cellText(valueOf(column, row))}
                    </dd>
                  </div>
                ))}
              </dl>
              {onAction || rowActions ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {onAction ? (
                    <button
                      type="button"
                      onClick={() => onAction(row)}
                      className="min-h-9 rounded-md border border-border/70 px-3 text-xs"
                    >
                      {actionLabel}
                    </button>
                  ) : null}
                  {rowActions?.(row).map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={action.disabled}
                      onClick={() => action.run(row)}
                      className={`min-h-9 rounded-md border px-3 text-xs disabled:opacity-40 ${
                        action.destructive
                          ? "border-destructive/60 text-destructive"
                          : "border-border/70"
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
            {hasActiveNarrowing ? emptyMessage : "There is nothing here yet."}
          </p>
        )}
      </div>

      <nav aria-label={`${caption} pages`} className="flex items-center justify-between text-xs">
        <button
          type="button"
          disabled={window.page <= 1}
          onClick={() => goToPage(window.page - 1)}
          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border/70 px-3 disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Previous
        </button>
        <span>
          {window.total === 0
            ? "No rows"
            : `Showing ${window.from}–${window.to} of ${window.total}`}
          {" · "}
          Page {window.page} of {window.pages}
        </span>
        <button
          type="button"
          disabled={window.page >= window.pages}
          onClick={() => goToPage(window.page + 1)}
          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border/70 px-3 disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </nav>
    </section>
  );
}

/**
 * Hand the CSV to the browser.
 *
 * A Blob URL rather than a `data:` URL: Chrome refuses to navigate to a
 * `data:` URL from a top-level context, so the download silently did nothing.
 * The object URL is revoked on the next tick, after the click has been taken.
 */
function downloadCsv(fileName: string, csv: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
