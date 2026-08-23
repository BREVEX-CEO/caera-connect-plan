/**
 * "BROWSER ONLY WRITES NEVER REACH THE CLOUD" HAS TO BE TRUE OF PROJECTS TOO.
 *
 * Settings › Privacy says exactly that. Chat honoured it. The Projects page did
 * not: it imported the server functions directly and inserted into
 * `ocade_projects` and `ocade_outputs` regardless of the mode, so a person who
 * chose Browser Only had their project names, up to twenty thousand characters
 * of their own project instructions, and every saved output uploaded anyway.
 *
 * A grep of `ocade-projects.functions.ts` for the privacy mode returned zero —
 * not a check that failed open, no check at all. That is why this test is
 * structural as well as behavioural: the defect was an import, so an import is
 * what it watches.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const remoteCalls: string[] = [];
const vault = new Map<string, unknown>();
let mode: "browser_only" | "private_sync" | "pc_vault" = "browser_only";

vi.mock("@/lib/ocade-projects.functions", () => {
  const record =
    (name: string) =>
    async (...args: unknown[]) => {
      remoteCalls.push(name);
      void args;
      return [] as unknown;
    };
  return {
    listProjects: record("listProjects"),
    createProject: record("createProject"),
    updateProject: record("updateProject"),
    deleteProject: record("deleteProject"),
    listOutputs: record("listOutputs"),
    getOutput: record("getOutput"),
    createOutput: record("createOutput"),
    deleteOutput: record("deleteOutput"),
    purgeExpiredOutputs: record("purgeExpiredOutputs"),
  };
});

vi.mock("@/lib/storage/resolver", () => ({
  getModeFor: async () => mode,
  resolveAdapter: async () => ({
    mode,
    put: async (_c: string, id: string, value: unknown) => {
      vault.set(id, value);
    },
    get: async (_c: string, id: string) => (vault.has(id) ? { id, value: vault.get(id) } : null),
    list: async () => [...vault.entries()].map(([id, value]) => ({ id, value })),
    delete: async (_c: string, id: string) => {
      vault.delete(id);
    },
    clear: async () => vault.clear(),
  }),
}));

const store = await import("../ocade-projects-store");

beforeEach(() => {
  remoteCalls.length = 0;
  vault.clear();
  mode = "browser_only";
});

describe("Browser Only never calls the server, at all", () => {
  it("creates a project without a single remote call", async () => {
    const project = await store.createProjectFor("u1", {
      name: "Divorce papers",
      instructions: "Private notes nobody else should see.",
    });
    expect(remoteCalls).toEqual([]);
    expect(project.name).toBe("Divorce papers");
  });

  it("keeps the instructions on the device, where the person put them", async () => {
    const project = await store.createProjectFor("u1", {
      name: "P",
      instructions: "x".repeat(20_000),
    });
    const listed = await store.listProjectsFor("u1");
    expect(listed[0].instructions).toHaveLength(20_000);
    expect(listed[0].id).toBe(project.id);
    expect(remoteCalls).toEqual([]);
  });

  it("reads, edits, archives and deletes without the network", async () => {
    const project = await store.createProjectFor("u1", { name: "One" });
    await store.updateProjectFor("u1", { id: project.id, name: "Two" });
    expect((await store.listProjectsFor("u1"))[0].name).toBe("Two");

    await store.updateProjectFor("u1", { id: project.id, archived: true });
    expect(await store.listProjectsFor("u1")).toHaveLength(0);
    expect(await store.listProjectsFor("u1", { includeArchived: true })).toHaveLength(1);

    await store.deleteProjectFor("u1", project.id);
    expect(await store.listProjectsFor("u1", { includeArchived: true })).toHaveLength(0);
    expect(remoteCalls).toEqual([]);
  });

  it("saves and reads outputs without the network", async () => {
    const output = await store.createOutputFor("u1", {
      title: "Draft",
      kind: "document",
      content: "The body of the document.",
    });
    const read = await store.getOutputFor("u1", output.id);
    expect(read?.content).toBe("The body of the document.");
    expect(read?.version).toBe(1);
    expect(remoteCalls).toEqual([]);
  });

  it("reports that this data stays on the device, so a screen can say so", async () => {
    expect(await store.projectsStayOnThisDevice("u1")).toBe(true);
    mode = "private_sync";
    expect(await store.projectsStayOnThisDevice("u1")).toBe(false);
  });
});

describe("local outputs follow the same versioning rules as the server", () => {
  it("gives a new lineage version 1, and a child the next version", async () => {
    const first = await store.createOutputFor("u1", {
      title: "Report",
      kind: "document",
      content: "v1",
    });
    expect(first.version).toBe(1);
    expect(first.lineage_id).toBe(first.id);

    const second = await store.createOutputFor("u1", {
      title: "Report",
      kind: "document",
      content: "v2",
      parentOutputId: first.id,
    });
    expect(second.version).toBe(2);
    expect(second.lineage_id).toBe(first.lineage_id);
    expect(second.id).not.toBe(first.id);
  });

  it("refuses a 'new version' that changes the title, exactly as the server does", async () => {
    const first = await store.createOutputFor("u1", { title: "A", kind: "document", content: "1" });
    await expect(
      store.createOutputFor("u1", {
        title: "B",
        kind: "document",
        content: "2",
        parentOutputId: first.id,
      }),
    ).rejects.toThrow(/project, conversation, kind and title/);
  });

  it("hashes and sizes the content, so a stored output is checkable", async () => {
    const output = await store.createOutputFor("u1", {
      title: "T",
      kind: "document",
      content: "hello",
    });
    expect(output.size_bytes).toBe(5);
    expect(output.content_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hides an output whose retention has passed, without waiting for a sweep", async () => {
    await store.createOutputFor("u1", {
      title: "Expiring",
      kind: "document",
      content: "x",
      retentionDays: -1,
    });
    expect(await store.listOutputsFor("u1")).toHaveLength(0);
    expect(await store.purgeExpiredOutputsFor("u1")).toBe(1);
  });
});

describe("Private Sync still uses the server, so the sweep is not quietly lost", () => {
  it("delegates every operation rather than answering locally", async () => {
    mode = "private_sync";
    await store.listProjectsFor("u1");
    await store.purgeExpiredOutputsFor("u1");
    expect(remoteCalls).toContain("listProjects");
    expect(remoteCalls).toContain("purgeExpiredOutputs");
  });
});

describe("the page cannot go back to calling the server directly", () => {
  it("imports the privacy-aware store, not the raw project server functions", () => {
    const page = readFileSync("src/routes/_authenticated/ocade.projects.tsx", "utf8");
    expect(page).toContain("@/lib/ocade-projects-store");
    /*
     * `listProjectConversations` and `setConversationProject` are still
     * imported from the functions module and are allowed: they move a
     * conversation between projects, and conversation storage is already gated
     * by the chats privacy mode in `ocade-chat-store`. What must not come back
     * is the project and output CRUD.
     */
    for (const forbidden of [
      "listProjects,",
      "createProject,",
      "updateProject,",
      "deleteProject,",
      "listOutputs,",
      "createOutput,",
      "deleteOutput,",
    ]) {
      expect(
        page.includes(forbidden),
        `${forbidden} is imported again from the server functions; Browser Only would upload once more`,
      ).toBe(false);
    }
  });
});
