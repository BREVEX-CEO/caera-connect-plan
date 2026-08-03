import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProjectFolder,
  listProjectFolders,
  removeProjectFolder,
  removeProjectFoldersForProject,
} from "../project-folders";
import { saveProjectFile } from "../project-files";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  });
});

describe("project folders", () => {
  it("creates normalized folders and isolates them by project", () => {
    expect(createProjectFolder({ projectId: "p1", path: "Research\\Notes", id: "d1" }).ok).toBe(
      true,
    );
    expect(createProjectFolder({ projectId: "p1", path: "../escape" }).ok).toBe(false);
    const p1 = listProjectFolders("p1");
    const p2 = listProjectFolders("p2");
    expect(p1.ok && p1.data.map((folder) => folder.path)).toEqual(["Research/Notes"]);
    expect(p2.ok && p2.data).toEqual([]);
  });

  it("refuses to delete a folder containing files", async () => {
    createProjectFolder({ projectId: "p1", path: "Research", id: "d1" });
    await saveProjectFile({
      projectId: "p1",
      folder: "Research",
      name: "brief.md",
      mime: "text/markdown",
      sizeBytes: 5,
      text: "brief",
      id: "f1",
    });
    expect(removeProjectFolder("p1", "Research").ok).toBe(false);
  });

  it("purges only the deleted project's folders", () => {
    createProjectFolder({ projectId: "p1", path: "One", id: "d1" });
    createProjectFolder({ projectId: "p2", path: "Two", id: "d2" });
    const removed = removeProjectFoldersForProject("p1");
    expect(removed.ok && removed.data.removed).toBe(1);
    const kept = listProjectFolders("p2");
    expect(kept.ok && kept.data.map((folder) => folder.path)).toEqual(["Two"]);
  });
});
