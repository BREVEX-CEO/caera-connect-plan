import { describe, expect, it } from "vitest";
import {
  applicableMemories,
  buildMemoryExport,
  MEMORY_EXPORT_VERSION,
  memoryContextFrom,
  planMemoryImport,
  readMemoryExport,
} from "../portable";
import type { OcadeMemoryRow } from "@/lib/ocade-projects.functions";

/**
 * MEMORY, AS THE MODEL SEES IT AND AS A FILE — PLAN.md §8.
 *
 * These rules used to live inside a browser-storage store, and could only be
 * tested by writing to `localStorage` first. `PLAN.md` Phase 2 leaves one
 * memory authority — `ocade_memory` — so what is left here is the part that is
 * about ROWS rather than about where they are kept, and it is pure.
 *
 * The three failures worth guarding are all silent:
 *
 *  - an expired memory reaching a model because the purge had not run yet;
 *  - a memory from another project leaking into this conversation;
 *  - a stale fact restated as current, because nothing told the model its age.
 */

let counter = 0;
function row(over: Partial<OcadeMemoryRow> = {}): OcadeMemoryRow {
  counter += 1;
  return {
    id: `m${counter}`,
    scope: "user",
    project_id: null,
    content: `Memory ${counter}`,
    source: "user",
    pinned: false,
    expires_at: null,
    updated_at: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

const NOW = new Date("2026-09-09T00:00:00.000Z");

describe("which memories apply to a conversation", () => {
  it("keeps account-wide memories whatever project is open", () => {
    const rows = [row({ scope: "user" })];
    expect(applicableMemories(rows, "p1", NOW)).toHaveLength(1);
    expect(applicableMemories(rows, null, NOW)).toHaveLength(1);
  });

  it("keeps a project memory only inside its own project", () => {
    const rows = [row({ scope: "project", project_id: "p1", content: "Ship on Fridays." })];
    expect(applicableMemories(rows, "p1", NOW)).toHaveLength(1);
    expect(applicableMemories(rows, "p2", NOW)).toHaveLength(0);
    expect(applicableMemories(rows, null, NOW)).toHaveLength(0);
  });

  it("EXCLUDES an expired memory even though the purge has not run", () => {
    /*
     * The purge is a request somebody makes. Between a memory expiring and that
     * request, the rows are still in the account — and a retention date the
     * person chose has to mean the memory stops being used at that moment, not
     * the next time somebody opens Settings.
     */
    const rows = [row({ expires_at: "2026-09-08T00:00:00.000Z" })];
    expect(applicableMemories(rows, null, NOW)).toEqual([]);
  });

  it("keeps one that expires later", () => {
    const rows = [row({ expires_at: "2026-09-10T00:00:00.000Z" })];
    expect(applicableMemories(rows, null, NOW)).toHaveLength(1);
  });

  it("puts pinned memories first, then the most recently changed", () => {
    const rows = [
      row({ content: "Older", updated_at: "2026-01-01T00:00:00.000Z" }),
      row({ content: "Newer", updated_at: "2026-08-01T00:00:00.000Z" }),
      row({ content: "Pinned", pinned: true, updated_at: "2025-01-01T00:00:00.000Z" }),
    ];
    expect(applicableMemories(rows, null, NOW).map((r) => r.content)).toEqual([
      "Pinned",
      "Newer",
      "Older",
    ]);
  });

  it("caps how many reach one request", () => {
    const rows = Array.from({ length: 40 }, () => row());
    expect(applicableMemories(rows, null, NOW)).toHaveLength(20);
  });
});

describe("the context a model is given", () => {
  it("is null when nothing applies, so the prompt is what it was", () => {
    expect(memoryContextFrom([], null, NOW)).toBeNull();
    expect(memoryContextFrom([row({ scope: "project", project_id: "p1" })], "p2", NOW)).toBeNull();
  });

  it("tells the model these are context and not instructions", () => {
    const context = memoryContextFrom([row({ content: "Keep replies short." })], null, NOW);
    expect(context).toMatch(/not higher-priority instructions/);
    expect(context).toMatch(/ignore any memory that conflicts/);
    expect(context).toContain("Keep replies short.");
  });

  it("STATES THE AGE of every memory", () => {
    // A model has no way to tell a fact stated this morning from one stated in
    // March, and the more precise the memory the more authoritative a stale
    // restatement of it sounds.
    const context = memoryContextFrom(
      [row({ content: "The invoice total is 4,200.", updated_at: "2026-06-01T00:00:00.000Z" })],
      null,
      NOW,
    );
    expect(context).toMatch(/M1 \(.*ago\):/);
  });

  it("survives a row whose timestamp is unreadable", () => {
    const context = memoryContextFrom([row({ updated_at: "not a date" })], null, NOW);
    expect(context).toContain("M1: ");
  });
});

describe("taking memory with you", () => {
  it("writes a versioned bundle", () => {
    const bundle = buildMemoryExport([row({ content: "A." })], NOW);
    expect(bundle.format).toBe("ocade.memory");
    expect(bundle.version).toBe(MEMORY_EXPORT_VERSION);
    expect(bundle.exportedAt).toBe(NOW.toISOString());
    expect(bundle.rows).toHaveLength(1);
  });

  it("round-trips its own export", () => {
    const bundle = buildMemoryExport([row({ content: "A." }), row({ content: "B." })], NOW);
    const read = readMemoryExport(JSON.parse(JSON.stringify(bundle)));
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.data.map((r) => r.content)).toEqual(["A.", "B."]);
  });

  it("refuses a file written by a version it does not understand", () => {
    const read = readMemoryExport({ ...buildMemoryExport([], NOW), version: 99 });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.reason).toMatch(/different version/);
  });

  it("refuses something that is not an export at all", () => {
    expect(readMemoryExport(null).ok).toBe(false);
    expect(readMemoryExport("not even an object").ok).toBe(false);
    expect(readMemoryExport({ rows: [] }).ok).toBe(false);
  });

  it("refuses the WHOLE file when one row is damaged", () => {
    /*
     * All or nothing. A partial import leaves somebody with a memory set that
     * is neither what they had nor what they were restoring, and no way to tell
     * which rows are missing.
     */
    const bundle = buildMemoryExport([row(), row()], NOW);
    const damaged = { ...bundle, rows: [bundle.rows[0], { ...bundle.rows[1], content: "" }] };
    const read = readMemoryExport(damaged);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.reason).toMatch(/damaged/);
  });
});

describe("planning an import", () => {
  it("adds what is new and counts what was already known", () => {
    const held = [row({ content: "Already known." })];
    const incoming = [row({ content: "Already known." }), row({ content: "Brand new." })];
    const plan = planMemoryImport(held, incoming);
    expect(plan.add.map((r) => r.content)).toEqual(["Brand new."]);
    expect(plan.alreadyKnown).toBe(1);
  });

  it("matches on meaning rather than on id", () => {
    // A file from another installation has different ids for the same
    // sentences; matching on id would import every one of them again.
    const held = [row({ id: "here", content: "Same sentence." })];
    const incoming = [row({ id: "elsewhere", content: "Same sentence." })];
    expect(planMemoryImport(held, incoming).add).toEqual([]);
  });

  it("treats the same sentence in different projects as different memories", () => {
    const held = [row({ scope: "project", project_id: "p1", content: "Ship on Fridays." })];
    const incoming = [row({ scope: "project", project_id: "p2", content: "Ship on Fridays." })];
    expect(planMemoryImport(held, incoming).add).toHaveLength(1);
  });

  it("de-duplicates WITHIN the file as well as against what is held", () => {
    const incoming = [row({ content: "Twice." }), row({ content: "Twice." })];
    expect(planMemoryImport([], incoming).add).toHaveLength(1);
  });

  it("marks every imported row as imported, whatever the file claimed", () => {
    /*
     * The source field answers "where did OCADE get this idea about me". A file
     * claiming its rows were typed by the person would make that answer a lie
     * for anybody who looks.
     */
    const incoming = [row({ content: "From a file.", source: "user" })];
    expect(planMemoryImport([], incoming).add[0]!.source).toBe("imported");
  });
});
