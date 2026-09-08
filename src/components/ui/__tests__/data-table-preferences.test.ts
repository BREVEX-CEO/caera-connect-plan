import { describe, expect, it } from "vitest";
import {
  clearTablePreferences,
  DEFAULT_TABLE_PREFERENCES,
  readTablePreferences,
  tablePreferenceKey,
  writeTablePreferences,
  type PreferenceStorage,
} from "../data-table-preferences";

function memoryStorage(seed: Record<string, string> = {}): PreferenceStorage & {
  entries: Record<string, string>;
} {
  const entries: Record<string, string> = { ...seed };
  return {
    entries,
    getItem: (key) => (key in entries ? entries[key] : null),
    setItem: (key, value) => {
      entries[key] = value;
    },
    removeItem: (key) => {
      delete entries[key];
    },
  };
}

/** Storage that throws on every operation, as a blocked or full one does. */
const hostileStorage: PreferenceStorage = {
  getItem() {
    throw new Error("storage is blocked by policy");
  },
  setItem() {
    throw new Error("quota exceeded");
  },
  removeItem() {
    throw new Error("storage is blocked by policy");
  },
};

describe("table layout preferences", () => {
  it("keys one account's layout separately from another's on the same browser", () => {
    expect(tablePreferenceKey("user-a", "members")).toBe("ocade.table.user-a.members");
    expect(tablePreferenceKey("user-a", "members")).not.toBe(
      tablePreferenceKey("user-b", "members"),
    );
  });

  it("round-trips a layout", () => {
    const storage = memoryStorage();
    writeTablePreferences(
      "user-a",
      "members",
      { hidden: ["email"], order: ["name", "email"], pageSize: 25 },
      storage,
    );
    expect(readTablePreferences("user-a", "members", storage)).toEqual({
      hidden: ["email"],
      order: ["name", "email"],
      pageSize: 25,
    });
  });

  it("returns the default layout when nothing is saved", () => {
    expect(readTablePreferences("user-a", "members", memoryStorage())).toEqual(
      DEFAULT_TABLE_PREFERENCES,
    );
  });

  it("does not hand a table a page size that would slice backwards or hang the browser", () => {
    // localStorage is writable by anything on the origin and by the person's own
    // developer tools, so a stored value is untrusted input.
    for (const pageSize of [-1, 0, 1e9, Number.NaN, "twenty", null]) {
      const storage = memoryStorage({
        "ocade.table.user-a.members": JSON.stringify({ hidden: [], order: [], pageSize }),
      });
      expect(readTablePreferences("user-a", "members", storage).pageSize).toBe(
        DEFAULT_TABLE_PREFERENCES.pageSize,
      );
    }
  });

  it("discards junk inside a field without discarding the rest of the layout", () => {
    const storage = memoryStorage({
      "ocade.table.user-a.members": JSON.stringify({
        hidden: ["email", 7, null, ""],
        order: "not-a-list",
        pageSize: 25,
      }),
    });
    expect(readTablePreferences("user-a", "members", storage)).toEqual({
      hidden: ["email"],
      order: [],
      pageSize: 25,
    });
  });

  it("falls back to the default layout on unparseable storage rather than throwing", () => {
    const storage = memoryStorage({ "ocade.table.user-a.members": "{not json" });
    expect(readTablePreferences("user-a", "members", storage)).toEqual(DEFAULT_TABLE_PREFERENCES);
  });

  it("survives storage that throws on every operation", () => {
    // Private modes, enterprise policy and a full quota all do this. A table
    // that cannot read its preferences must still be a table.
    expect(readTablePreferences("user-a", "members", hostileStorage)).toEqual(
      DEFAULT_TABLE_PREFERENCES,
    );
    expect(() =>
      writeTablePreferences("user-a", "members", DEFAULT_TABLE_PREFERENCES, hostileStorage),
    ).not.toThrow();
    expect(() => clearTablePreferences("user-a", "members", hostileStorage)).not.toThrow();
  });

  it("survives having no storage at all, as on the server", () => {
    expect(readTablePreferences("user-a", "members", null)).toEqual(DEFAULT_TABLE_PREFERENCES);
    expect(() =>
      writeTablePreferences("user-a", "members", DEFAULT_TABLE_PREFERENCES, null),
    ).not.toThrow();
  });

  it("forgets one table without touching another", () => {
    const storage = memoryStorage();
    writeTablePreferences("user-a", "members", { hidden: ["a"], order: [], pageSize: 5 }, storage);
    writeTablePreferences("user-a", "devices", { hidden: ["b"], order: [], pageSize: 5 }, storage);
    clearTablePreferences("user-a", "members", storage);
    expect(readTablePreferences("user-a", "members", storage)).toEqual(DEFAULT_TABLE_PREFERENCES);
    expect(readTablePreferences("user-a", "devices", storage).hidden).toEqual(["b"]);
  });
});
