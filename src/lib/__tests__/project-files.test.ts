import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listProjectFiles,
  removeProjectFile,
  removeProjectFilesForProject,
  saveProjectFile,
} from "../project-files";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
    clear: () => storage.clear(),
  });
});

describe("project files are local, bounded and fingerprinted", () => {
  it("saves and lists only the selected project's files", async () => {
    const saved = await saveProjectFile({
      projectId: "p1",
      name: "brief.md",
      mime: "text/markdown",
      sizeBytes: 12,
      text: "Approved brief",
      id: "f1",
      now: new Date("2026-07-25T04:30:00.000Z"),
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error("unreachable");
    expect(saved.data.sha256).toHaveLength(64);
    expect(saved.data.folder).toBe("");
    expect(listProjectFiles("p1").ok).toBe(true);
    const other = listProjectFiles("p2");
    expect(other.ok && other.data).toEqual([]);
  });

  it("normalizes folders and refuses duplicate bytes at the same path", async () => {
    const first = await saveProjectFile({
      projectId: "p1",
      folder: "Research\\Notes",
      name: "brief.md",
      mime: "text/markdown",
      sizeBytes: 5,
      text: "brief",
      id: "folder-file",
    });
    expect(first.ok && first.data.folder).toBe("Research/Notes");
    const duplicate = await saveProjectFile({
      projectId: "p1",
      folder: "Research/Notes",
      name: "brief.md",
      mime: "text/markdown",
      sizeBytes: 5,
      text: "brief",
    });
    expect(duplicate.ok).toBe(false);
  });

  it("refuses missing text, oversized files and oversized extracted text", async () => {
    const base = { projectId: "p1", name: "x.txt", mime: "text/plain" };
    expect((await saveProjectFile({ ...base, sizeBytes: 1, text: "" })).ok).toBe(false);
    expect(
      (await saveProjectFile({ ...base, sizeBytes: 20 * 1024 * 1024 + 1, text: "x" })).ok,
    ).toBe(false);
    expect((await saveProjectFile({ ...base, sizeBytes: 1, text: "x".repeat(250_001) })).ok).toBe(
      false,
    );
  });

  it("fails closed on corrupt storage and never overwrites it", async () => {
    storage.set("ocade.project-files.v1", "{broken");
    const result = await saveProjectFile({
      projectId: "p1",
      name: "x.txt",
      mime: "text/plain",
      sizeBytes: 1,
      text: "x",
    });
    expect(result.ok).toBe(false);
    expect(storage.get("ocade.project-files.v1")).toBe("{broken");
  });

  it("deletes exactly one real file", async () => {
    await saveProjectFile({
      projectId: "p1",
      name: "x.txt",
      mime: "text/plain",
      sizeBytes: 1,
      text: "x",
      id: "f1",
    });
    expect(removeProjectFile("f1").ok).toBe(true);
    expect(removeProjectFile("f1").ok).toBe(false);
  });

  it("deletes only files owned by a removed project", async () => {
    await saveProjectFile({
      projectId: "p1",
      name: "one.txt",
      mime: "text/plain",
      sizeBytes: 1,
      text: "one",
      id: "f1",
    });
    await saveProjectFile({
      projectId: "p2",
      name: "two.txt",
      mime: "text/plain",
      sizeBytes: 1,
      text: "two",
      id: "f2",
    });
    const removed = removeProjectFilesForProject("p1");
    expect(removed.ok && removed.data.removed).toBe(1);
    const kept = listProjectFiles("p2");
    expect(kept.ok && kept.data.map((file) => file.id)).toEqual(["f2"]);
  });
});
