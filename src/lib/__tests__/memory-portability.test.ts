import { beforeEach, describe, expect, it } from "vitest";
import {
  addLocalMemory,
  clearLocalMemory,
  exportLocalMemory,
  importLocalMemory,
  inspectLocalMemory,
  MEMORY_EXPORT_VERSION,
  setLocalMemoryEnabled,
} from "@/lib/local-memory";

/**
 * Carrying what OCADE remembers — PLAN.md §8's memory import and export.
 *
 * Memory nobody can take out is memory somebody is locked into, and a person
 * moving to a new machine, or leaving, should be able to carry it or verify it
 * was carried. So these tests are mostly about the ways a restore can go
 * quietly wrong: a file from a future version accepted on a guess, one damaged
 * row importing the rest, a merge that duplicates everything it already had,
 * and a file that turns memory back on somewhere it was deliberately turned
 * off.
 */

/** A localStorage that behaves, since the module refuses without one. */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  get length() {
    return this.data.size;
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  setLocalMemoryEnabled(true);
  clearLocalMemory();
});

function remember(content: string) {
  const result = addLocalMemory({ content, scope: "user", source: "user", expiresAt: null });
  expect(result.ok, result.ok ? "" : result.reason).toBe(true);
}

describe("export", () => {
  it("carries the memories and says which format they are in", () => {
    remember("Prefers short answers.");
    const exported = exportLocalMemory(new Date("2026-09-04T00:00:00.000Z"));
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.data.format).toEqual("ocade.memory");
    expect(exported.data.version).toEqual(MEMORY_EXPORT_VERSION);
    expect(exported.data.rows.map((row) => row.content)).toEqual(["Prefers short answers."]);
  });

  it("does not carry whether memory is switched on", () => {
    /*
     * It is a setting about a device, not a memory. Carrying it would mean
     * opening a file could turn memory on somewhere it had deliberately been
     * turned off.
     */
    remember("Anything.");
    const exported = exportLocalMemory();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(Object.keys(exported.data)).not.toContain("enabled");
  });

  it("exports an empty set rather than refusing", () => {
    // Somebody checking that OCADE remembers nothing about them is asking a
    // real question, and a file saying so is a real answer.
    const exported = exportLocalMemory();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.data.rows).toEqual([]);
  });
});

describe("import", () => {
  const bundleOf = (contents: string[]) => ({
    format: "ocade.memory" as const,
    version: MEMORY_EXPORT_VERSION,
    exportedAt: "2026-09-04T00:00:00.000Z",
    rows: contents.map((content, index) => ({
      id: `r${index}`,
      scope: "user" as const,
      project_id: null,
      content,
      source: "user" as const,
      pinned: false,
      expires_at: null,
      updated_at: "2026-09-04T00:00:00.000Z",
    })),
  });

  it("adds what is new and keeps what was already here", () => {
    remember("Already known.");
    const result = importLocalMemory(bundleOf(["Already known.", "Brand new."]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ added: 1, alreadyKnown: 1, total: 2 });
  });

  it("marks everything it imported as imported, whatever the file said", () => {
    // The source field answers "where did OCADE get this idea about me", and a
    // file claiming its rows were typed by the person would make that a lie.
    const result = importLocalMemory(bundleOf(["From a file."]));
    expect(result.ok).toBe(true);
    const state = inspectLocalMemory();
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    expect(state.data.rows.map((row) => row.source)).toEqual(["imported"]);
  });

  it("replaces only when asked to by name", () => {
    remember("The old one.");
    const merged = importLocalMemory(bundleOf(["The new one."]), "merge");
    expect(merged.ok && merged.data.total).toEqual(2);

    clearLocalMemory();
    remember("The old one.");
    const replaced = importLocalMemory(bundleOf(["The new one."]), "replace");
    expect(replaced.ok && replaced.data.total).toEqual(1);
    const state = inspectLocalMemory();
    expect(state.ok && state.data.rows.map((row) => row.content)).toEqual(["The new one."]);
  });

  it("refuses a file from a version it does not understand", () => {
    const result = importLocalMemory({ ...bundleOf(["Anything."]), version: 99 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/different version/i);
  });

  it("refuses something that is not an OCADE export at all", () => {
    expect(importLocalMemory({ rows: [] }).ok).toBe(false);
    expect(importLocalMemory("not even an object").ok).toBe(false);
    expect(importLocalMemory(null).ok).toBe(false);
  });

  it("imports nothing at all when one row is damaged", () => {
    /*
     * ALL OR NOTHING. A partial import leaves somebody with a memory set that
     * is neither what they had nor what they were restoring, and no way to
     * tell which rows are missing.
     */
    remember("Untouched.");
    const damaged = bundleOf(["Fine.", "Also fine."]);
    (damaged.rows[1] as unknown as { content: unknown }).content = 42;
    const result = importLocalMemory(damaged);
    expect(result.ok).toBe(false);
    const state = inspectLocalMemory();
    expect(state.ok && state.data.rows.map((row) => row.content)).toEqual(["Untouched."]);
  });

  it("does not turn memory on", () => {
    setLocalMemoryEnabled(false);
    importLocalMemory(bundleOf(["Something."]));
    const state = inspectLocalMemory();
    expect(state.ok && state.data.enabled, "importing a file switched memory on").toBe(false);
  });

  it("round-trips through export without duplicating anything", () => {
    remember("One.");
    remember("Two.");
    const exported = exportLocalMemory();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const result = importLocalMemory(exported.data);
    expect(result.ok && result.data).toMatchObject({ added: 0, alreadyKnown: 2, total: 2 });
  });
});
