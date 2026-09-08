/**
 * A PERSON'S TABLE LAYOUT, REMEMBERED.
 *
 * PLAN.md §M asks for column order and visibility to persist per user and per
 * table. Somebody who hides six columns on the members table and comes back
 * tomorrow to all fourteen has not been given a preference; they have been
 * given a chore.
 *
 * WHERE IT IS STORED, AND WHY THAT IS HONEST. This writes to `localStorage` on
 * the device. It is a display preference — nothing here is account data, and
 * nothing here changes what the server will hand out — so it does not need a
 * row in a database, and storing it locally keeps it working offline. The cost
 * is that the layout does not follow somebody to a second machine, which is
 * why the scope is part of the key rather than assumed: when a caller passes
 * the signed-in account id, two people sharing a browser profile do not
 * inherit each other's layout.
 *
 * READS NEVER THROW. Storage is unavailable in private modes, disabled by
 * policy, and full often enough that a table which crashes when it cannot read
 * its own preferences is a table that crashes. Every failure here falls back to
 * the default layout, which is always a correct table.
 */

export interface DataTablePreferences {
  /** Column keys hidden by the person, in no particular order. */
  hidden: string[];
  /** Column keys in the order they arranged them. */
  order: string[];
  /** Rows per page. */
  pageSize: number;
}

export const DEFAULT_TABLE_PREFERENCES: DataTablePreferences = {
  hidden: [],
  order: [],
  pageSize: 10,
};

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The storage key.
 *
 * The scope comes first so every key for one account shares a prefix, which is
 * what makes "forget this account's layouts on sign-out" a prefix scan rather
 * than a list of table ids somebody has to remember to update.
 */
export function tablePreferenceKey(scope: string, tableId: string): string {
  return `ocade.table.${scope}.${tableId}`;
}

function browserStorage(): PreferenceStorage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    // Access itself throws when storage is blocked by policy.
    return null;
  }
}

/**
 * Read a saved layout, or the default.
 *
 * VALIDATES RATHER THAN TRUSTS. `localStorage` is writable by anything running
 * on the origin and by the person themselves through developer tools, so a
 * stored value is untrusted input: a `pageSize` of `-1` slices backwards and a
 * `hidden` list of every column renders a table with no columns at all. Each
 * field is checked and falls back on its own, so one bad field does not discard
 * a layout that is otherwise fine.
 */
export function readTablePreferences(
  scope: string,
  tableId: string,
  storage: PreferenceStorage | null = browserStorage(),
): DataTablePreferences {
  if (!storage) return { ...DEFAULT_TABLE_PREFERENCES };
  let raw: string | null = null;
  try {
    raw = storage.getItem(tablePreferenceKey(scope, tableId));
  } catch {
    return { ...DEFAULT_TABLE_PREFERENCES };
  }
  if (!raw) return { ...DEFAULT_TABLE_PREFERENCES };

  try {
    const parsed = JSON.parse(raw) as Partial<DataTablePreferences> | null;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_TABLE_PREFERENCES };
    return {
      hidden: stringList(parsed.hidden),
      order: stringList(parsed.order),
      pageSize: positiveSize(parsed.pageSize),
    };
  } catch {
    return { ...DEFAULT_TABLE_PREFERENCES };
  }
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function positiveSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_TABLE_PREFERENCES.pageSize;
  }
  const size = Math.floor(value);
  // An unbounded page size read from storage is a denial of service against the
  // person's own browser: one render of two million rows.
  if (size < 1 || size > 500) return DEFAULT_TABLE_PREFERENCES.pageSize;
  return size;
}

/** Save a layout. A storage failure loses the preference and nothing else. */
export function writeTablePreferences(
  scope: string,
  tableId: string,
  preferences: DataTablePreferences,
  storage: PreferenceStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      tablePreferenceKey(scope, tableId),
      JSON.stringify({
        hidden: stringList(preferences.hidden),
        order: stringList(preferences.order),
        pageSize: positiveSize(preferences.pageSize),
      }),
    );
  } catch {
    /* Full, blocked, or private. The table still works. */
  }
}

/** Forget one table's layout. */
export function clearTablePreferences(
  scope: string,
  tableId: string,
  storage: PreferenceStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(tablePreferenceKey(scope, tableId));
  } catch {
    /* Nothing to do and nothing at risk. */
  }
}
