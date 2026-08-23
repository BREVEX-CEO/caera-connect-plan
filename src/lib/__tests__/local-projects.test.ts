import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageAdapter, StoredRecord } from "@/lib/storage/types";

const rows = new Map<string, StoredRecord>();

const adapter: StorageAdapter = {
  mode: "browser_only",
  async put(dataClass, id, value) {
    const old = rows.get(id);
    const now = Date.now();
    rows.set(id, {
      id,
      dataClass,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      value,
    });
  },
  async get(_dataClass, id) {
    return (rows.get(id) ?? null) as StoredRecord<never> | null;
  },
  async list() {
    return [...rows.values()] as StoredRecord<never>[];
  },
  async delete(_dataClass, id) {
    rows.delete(id);
  },
  async clear() {
    rows.clear();
  },
};

vi.mock("@/lib/storage/resolver", () => ({ resolveAdapter: vi.fn(async () => adapter) }));

import {
  createLocalOutput,
  createLocalProject,
  deleteLocalProject,
  getLocalOutput,
  listLocalOutputs,
  listLocalProjects,
  purgeExpiredLocalOutputs,
  updateLocalProject,
} from "@/lib/projects/local-projects";

describe("device-authoritative projects and outputs", () => {
  beforeEach(() => rows.clear());

  it("creates, updates, archives and lists a project without a server", async () => {
    const project = await createLocalProject("user-1", { name: " Launch " });
    expect((await listLocalProjects("user-1"))[0]?.name).toBe("Launch");

    await updateLocalProject("user-1", project.id, {
      instructions: "Use primary sources.",
      archived: true,
    });
    expect(await listLocalProjects("user-1")).toEqual([]);
    expect((await listLocalProjects("user-1", true))[0]?.instructions).toBe("Use primary sources.");
  });

  it("versions outputs locally, preserves lineage and fingerprints content", async () => {
    const project = await createLocalProject("user-1", { name: "Research" });
    const first = await createLocalOutput("user-1", {
      projectId: project.id,
      kind: "document",
      title: "Brief",
      content: "Version one",
    });
    const second = await createLocalOutput("user-1", {
      parentOutputId: first.id,
      projectId: project.id,
      kind: "document",
      title: "Brief",
      content: "Version two",
    });

    expect(second.version).toBe(2);
    expect(second.lineage_id).toBe(first.lineage_id);
    expect(second.content_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect((await getLocalOutput("user-1", second.id)).content).toBe("Version two");
  });

  it("tombstones project children so another device cannot resurrect them", async () => {
    const project = await createLocalProject("user-1", { name: "Temporary" });
    await createLocalOutput("user-1", {
      projectId: project.id,
      kind: "other",
      title: "Child",
      content: "data",
    });

    await deleteLocalProject("user-1", project.id);
    expect(await listLocalProjects("user-1", true)).toEqual([]);
    expect(await listLocalOutputs("user-1", project.id)).toEqual([]);
    expect(
      [...rows.values()].some((row) => (row.value as { deleted_at?: string }).deleted_at),
    ).toBe(true);
  });

  it("purges only outputs whose retention has elapsed", async () => {
    await createLocalOutput("user-1", {
      kind: "other",
      title: "Expired",
      content: "old",
      retentionDays: 1,
    });
    await createLocalOutput("user-1", {
      kind: "other",
      title: "Kept",
      content: "new",
    });

    const result = await purgeExpiredLocalOutputs("user-1", new Date(Date.now() + 2 * 86_400_000));
    expect(result.removed).toBe(1);
    expect((await listLocalOutputs("user-1")).map((row) => row.title)).toEqual(["Kept"]);
  });
});
