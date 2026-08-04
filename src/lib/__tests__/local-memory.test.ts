import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addLocalMemory,
  clearLocalMemory,
  deleteLocalMemory,
  inspectLocalMemory,
  localMemoryContext,
  purgeExpiredLocalMemory,
  setLocalMemoryEnabled,
  updateLocalMemory,
} from "../local-memory";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  });
});

describe("local memory is opt-in, scoped and fail-closed", () => {
  it("starts off and refuses writes until the user opts in", () => {
    const initial = inspectLocalMemory();
    expect(initial.ok && initial.data.enabled).toBe(false);
    expect(addLocalMemory({ content: "Keep replies short." }).ok).toBe(false);
  });

  it("adds, edits, pins, scopes and deletes reviewable memories", () => {
    expect(setLocalMemoryEnabled(true).ok).toBe(true);
    const user = addLocalMemory({ content: "Keep replies short.", id: "m1" });
    const project = addLocalMemory({
      content: "Use SI units.",
      scope: "project",
      projectId: "p1",
      id: "m2",
    });
    expect(user.ok && project.ok).toBe(true);
    expect(updateLocalMemory({ id: "m1", content: "Use concise replies.", pinned: true }).ok).toBe(
      true,
    );
    const p1 = localMemoryContext("p1");
    expect(p1.ok && p1.data).toContain("Use SI units.");
    const p2 = localMemoryContext("p2");
    expect(p2.ok && p2.data).not.toContain("Use SI units.");
    expect(deleteLocalMemory("m2").ok).toBe(true);
    expect(clearLocalMemory().ok).toBe(true);
  });

  it("excludes expired rows from Chat context without hiding them from review", () => {
    setLocalMemoryEnabled(true);
    addLocalMemory({
      content: "Old preference",
      expiresAt: "2026-01-01T00:00:00.000Z",
      id: "expired",
    });
    const context = localMemoryContext(null, new Date("2026-07-25T00:00:00.000Z"));
    expect(context.ok && context.data).toBe(null);
    const state = inspectLocalMemory();
    expect(state.ok && state.data.rows).toHaveLength(1);
    const purged = purgeExpiredLocalMemory(new Date("2026-07-25T00:00:00.000Z"));
    expect(purged.ok && purged.data.removed).toBe(1);
  });

  it("never overwrites corrupt storage", () => {
    storage.set("ocade.memory.local.v1", "{broken");
    expect(setLocalMemoryEnabled(true).ok).toBe(false);
    expect(storage.get("ocade.memory.local.v1")).toBe("{broken");
  });
});
