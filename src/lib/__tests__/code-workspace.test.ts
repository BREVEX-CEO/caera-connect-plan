import { describe, expect, it, vi } from "vitest";
import {
  analyseWorkspace,
  applicableInstructions,
  applyCodePatch,
  createCodeWorkspace,
  previewCodePatch,
  runWorkspaceCommand,
  searchWorkspaceText,
  undoCodeChange,
  type CodeCommandHost,
  type CodeCommandRequest,
  type CodeWorkspace,
} from "../code/workspace";

const NOW = new Date("2026-07-25T00:00:00.000Z");

const FILES = [
  {
    path: "AGENTS.md",
    content: "Keep edits minimal.\nRun the focused test before the full suite.",
  },
  {
    path: "src/AGENTS.md",
    content: "Source files use TypeScript.\nDo not edit generated files.",
  },
  {
    path: "src/greet.ts",
    content: ["export function greet(name: string) {", '  return "hi " + name;', "}", ""].join(
      "\n",
    ),
  },
  {
    path: "src/greet.test.ts",
    content: 'import { greet } from "./greet";\nexport const expected = greet("Ada");\n',
  },
  {
    path: "package.json",
    content: JSON.stringify({ scripts: { test: "vitest run", build: "vite build" } }, null, 2),
  },
];

const DIFF = [
  "--- a/src/greet.ts",
  "+++ b/src/greet.ts",
  "@@ -1,3 +1,3 @@",
  " export function greet(name: string) {",
  '-  return "hi " + name;',
  "+  return `Hello, ${name}`;",
  " }",
  "",
].join("\n");

function workspace(): CodeWorkspace {
  const created = createCodeWorkspace({
    id: "repo-1",
    name: "Temporary greeting repository",
    files: FILES,
    now: NOW,
  });
  if (!created.ok) throw new Error(created.reason);
  return created.data;
}

describe("repository intake and instructions", () => {
  it("normalizes safe paths and refuses duplicates, traversal, binary text, and oversized intake", () => {
    expect(workspace().files.map((file) => file.path)).toContain("src/greet.ts");
    expect(
      createCodeWorkspace({
        name: "duplicate",
        files: [
          { path: "src/a.ts", content: "a" },
          { path: "src\\a.ts", content: "b" },
        ],
      }).ok,
    ).toBe(false);
    expect(
      createCodeWorkspace({
        name: "traversal",
        files: [{ path: "../outside.ts", content: "no" }],
      }).ok,
    ).toBe(false);
    expect(
      createCodeWorkspace({
        name: "binary",
        files: [{ path: "src/a.ts", content: "before\u0000after" }],
      }).ok,
    ).toBe(false);
    expect(
      createCodeWorkspace({
        name: "large",
        files: [{ path: "src/a.ts", content: "x".repeat(2_000_001) }],
      }).ok,
    ).toBe(false);
  });

  it("applies root and nearest nested AGENTS instructions in order", () => {
    const instructions = applicableInstructions(workspace(), "src/greet.ts");
    expect(instructions.map((item) => item.path)).toEqual(["AGENTS.md", "src/AGENTS.md"]);
    expect(instructions.map((item) => item.content)).toEqual([
      expect.stringContaining("Keep edits minimal"),
      expect.stringContaining("Do not edit generated files"),
    ]);
  });
});

describe("analysis and search", () => {
  it("maps files, symbols, references, and dependency diagnostics from the same snapshot", () => {
    const analysis = analyseWorkspace(workspace());
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) throw new Error(analysis.reason);
    expect(analysis.data.map.totalFiles).toBe(5);
    expect(analysis.data.symbols.find((hit) => hit.symbol.name === "greet")?.path).toBe(
      "src/greet.ts",
    );
    expect(analysis.data.references.references.map((item) => item.path)).toContain(
      "src/greet.test.ts",
    );
    expect(analysis.data.diagnostics.brokenImports).toBe(0);
  });

  it("performs bounded text search with exact line evidence", () => {
    const result = searchWorkspaceText(workspace(), "greet");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data.length).toBeGreaterThan(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({ path: expect.any(String), line: expect.any(Number) }),
    );
    expect(result.data.every((hit) => hit.text.toLowerCase().includes("greet"))).toBe(true);
  });
});

describe("exact patch, checkpoint, and exercised recovery", () => {
  it("previews without mutation, applies with before/after hashes, then restores byte-for-byte", async () => {
    const original = workspace();
    const preview = await previewCodePatch(original, DIFF);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error(preview.reason);
    expect(original.files.find((file) => file.path === "src/greet.ts")?.content).toContain('"hi "');
    expect(preview.data.after).toContain("Hello");

    const applied = await applyCodePatch(original, DIFF, {
      id: "change-1",
      now: NOW,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) throw new Error(applied.reason);
    expect(applied.data.change.undoVerified).toBe(true);
    expect(applied.data.change.patchText).toBe(DIFF);
    expect(applied.data.change.beforeSha256).not.toBe(applied.data.change.afterSha256);
    expect(
      applied.data.workspace.files.find((file) => file.path === "src/greet.ts")?.content,
    ).toContain("Hello");

    const undone = await undoCodeChange(applied.data.workspace, "change-1", {
      now: new Date(NOW.getTime() + 1_000),
    });
    expect(undone.ok).toBe(true);
    if (!undone.ok) throw new Error(undone.reason);
    expect(undone.data.workspace.files).toEqual(original.files);
    expect(undone.data.change.status).toBe("undone");
  });

  it("refuses stale patch context and stale undo without changing the snapshot", async () => {
    const original = workspace();
    const stalePatch = DIFF.replace('  return "hi " + name;', '  return "hello " + name;');
    const refused = await applyCodePatch(original, stalePatch);
    expect(refused.ok).toBe(false);
    expect(original.files).toEqual(workspace().files);

    const applied = await applyCodePatch(original, DIFF, { id: "change-1", now: NOW });
    if (!applied.ok) throw new Error(applied.reason);
    const drifted: CodeWorkspace = {
      ...applied.data.workspace,
      files: applied.data.workspace.files.map((file) =>
        file.path === "src/greet.ts" ? { ...file, content: `${file.content}// drift\n` } : file,
      ),
    };
    const undo = await undoCodeChange(drifted, "change-1");
    expect(undo.ok).toBe(false);
    expect(drifted.files.find((file) => file.path === "src/greet.ts")?.content).toContain(
      "// drift",
    );
  });
});

describe("observed command execution on temporary repositories", () => {
  it("records real host observations for test and build without inventing success", async () => {
    let current = workspace();
    const applied = await applyCodePatch(current, DIFF, { id: "change-1", now: NOW });
    if (!applied.ok) throw new Error(applied.reason);
    current = applied.data.workspace;

    const host: CodeCommandHost = {
      id: "temporary-test-host",
      kind: "temporary",
      run: vi.fn(async ({ command, files }: CodeCommandRequest) => {
        const source = files.find((file) => file.path === "src/greet.ts")?.content ?? "";
        const ok = source.includes("Hello");
        return {
          exitCode: ok ? 0 : 1,
          stdout: ok ? `${command}: observed pass` : "",
          stderr: ok ? "" : `${command}: expected patched source`,
          startedAt: "2026-07-25T00:00:01.000Z",
          finishedAt: "2026-07-25T00:00:02.000Z",
          observed: true,
        };
      }),
    };

    const tested = await runWorkspaceCommand(current, "test", host);
    expect(tested.ok).toBe(true);
    if (!tested.ok) throw new Error(tested.reason);
    expect(tested.data.receipt.verified).toBe(true);
    expect(tested.data.observation.exitCode).toBe(0);

    const built = await runWorkspaceCommand(tested.data.workspace, "build", host);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error(built.reason);
    expect(built.data.workspace.history.at(-1)).toEqual(
      expect.objectContaining({ kind: "command", status: "verified" }),
    );
    expect(host.run).toHaveBeenCalledTimes(2);
  });

  it("records a failing command as failed and leaves source unchanged", async () => {
    const original = workspace();
    const host: CodeCommandHost = {
      id: "failing-host",
      kind: "temporary",
      run: async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "one test failed",
        startedAt: "2026-07-25T00:00:01.000Z",
        finishedAt: "2026-07-25T00:00:02.000Z",
        observed: true,
      }),
    };
    const result = await runWorkspaceCommand(original, "test", host);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data.receipt.verified).toBe(false);
    expect(result.data.workspace.history.at(-1)?.status).toBe("failed");
    expect(result.data.workspace.files).toEqual(original.files);
  });

  it("refuses an unavailable or pre-cancelled host instead of emitting a receipt", async () => {
    const unavailable: CodeCommandHost = {
      id: "missing",
      kind: "unavailable",
      unavailableReason: "Desktop companion is not connected.",
      run: vi.fn(),
    };
    expect((await runWorkspaceCommand(workspace(), "test", unavailable)).ok).toBe(false);
    expect(unavailable.run).not.toHaveBeenCalled();

    const controller = new AbortController();
    controller.abort();
    const available: CodeCommandHost = {
      id: "available",
      kind: "temporary",
      run: vi.fn(),
    };
    expect((await runWorkspaceCommand(workspace(), "test", available, controller.signal)).ok).toBe(
      false,
    );
    expect(available.run).not.toHaveBeenCalled();
  });
});
