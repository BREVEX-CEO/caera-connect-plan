import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyCodePatch,
  createCodeWorkspace,
  runWorkspaceCommand,
  undoCodeChange,
  type CodeCommandHost,
  type CodeCommandRequest,
} from "../code/workspace";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  const safeTempRoot = resolve(tmpdir());
  for (const root of roots.splice(0)) {
    const resolved = resolve(root);
    if (!resolved.startsWith(`${safeTempRoot}\\`) && !resolved.startsWith(`${safeTempRoot}/`)) {
      throw new Error(`Refusing to remove non-temporary test path: ${resolved}`);
    }
    await rm(resolved, { recursive: true, force: true });
  }
});

async function createObservedTemporaryHost(): Promise<CodeCommandHost> {
  const root = await mkdtemp(join(tmpdir(), "ocade-code-workspace-"));
  roots.push(root);

  return {
    id: "observed-node-temp-repository",
    kind: "temporary",
    async run(request: CodeCommandRequest) {
      for (const file of request.files) {
        const destination = join(root, ...file.path.split("/"));
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, file.content, "utf8");
      }
      const script = request.command === "test" ? "test.mjs" : "build.mjs";
      const startedAt = new Date().toISOString();
      try {
        const result = await execFileAsync(process.execPath, [join(root, script)], {
          cwd: root,
          timeout: 10_000,
          windowsHide: true,
        });
        return {
          exitCode: 0,
          stdout: result.stdout,
          stderr: result.stderr,
          startedAt,
          finishedAt: new Date().toISOString(),
          observed: true,
        };
      } catch (error) {
        const failure = error as Error & {
          code?: number;
          stdout?: string;
          stderr?: string;
        };
        return {
          exitCode: Number.isInteger(failure.code) ? Number(failure.code) : 1,
          stdout: failure.stdout ?? "",
          stderr: failure.stderr ?? failure.message,
          startedAt,
          finishedAt: new Date().toISOString(),
          observed: true,
        };
      }
    },
  };
}

const source = ["export function greet(name) {", '  return "hi " + name;', "}", ""].join("\n");

const patch = [
  "--- a/src/greet.mjs",
  "+++ b/src/greet.mjs",
  "@@ -1,3 +1,3 @@",
  " export function greet(name) {",
  '-  return "hi " + name;',
  "+  return `Hello, ${name}`;",
  " }",
  "",
].join("\n");

function repository() {
  const created = createCodeWorkspace({
    id: "real-temp-repository",
    name: "Observed temporary Node repository",
    files: [
      { path: "src/greet.mjs", content: source },
      {
        path: "test.mjs",
        content: [
          'import { greet } from "./src/greet.mjs";',
          'if (greet("Ada") !== "Hello, Ada") {',
          '  console.error("expected patched greeting");',
          "  process.exit(1);",
          "}",
          'console.log("focused test passed");',
          "",
        ].join("\n"),
      },
      {
        path: "build.mjs",
        content: [
          'import { readFile, mkdir, writeFile } from "node:fs/promises";',
          'const source = await readFile("src/greet.mjs", "utf8");',
          'if (!source.includes("Hello")) {',
          '  console.error("build refused unpatched source");',
          "  process.exit(1);",
          "}",
          'await mkdir("dist", { recursive: true });',
          'await writeFile("dist/manifest.json", JSON.stringify({ built: true }));',
          'console.log("build artifact written");',
          "",
        ].join("\n"),
      },
    ],
  });
  if (!created.ok) throw new Error(created.reason);
  return created.data;
}

describe("observed temporary-repository execution and recovery", () => {
  it("fails before the edit, passes after the exact patch, builds, then exercises undo", async () => {
    const host = await createObservedTemporaryHost();
    const initial = repository();

    const failed = await runWorkspaceCommand(initial, "test", host);
    expect(failed.ok).toBe(true);
    if (!failed.ok) throw new Error(failed.reason);
    expect(failed.data.observation.exitCode).toBe(1);
    expect(failed.data.receipt.verified).toBe(false);
    expect(failed.data.observation.stderr).toContain("expected patched greeting");

    const applied = await applyCodePatch(failed.data.workspace, patch, {
      id: "repair-change",
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) throw new Error(applied.reason);

    const passed = await runWorkspaceCommand(applied.data.workspace, "test", host);
    expect(passed.ok).toBe(true);
    if (!passed.ok) throw new Error(passed.reason);
    expect(passed.data.observation.exitCode).toBe(0);
    expect(passed.data.observation.stdout).toContain("focused test passed");
    expect(passed.data.receipt.verified).toBe(true);

    const built = await runWorkspaceCommand(passed.data.workspace, "build", host);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error(built.reason);
    expect(built.data.observation.exitCode).toBe(0);
    expect(built.data.observation.stdout).toContain("build artifact written");
    expect(built.data.receipt.verified).toBe(true);

    const undone = await undoCodeChange(built.data.workspace, "repair-change");
    expect(undone.ok).toBe(true);
    if (!undone.ok) throw new Error(undone.reason);
    expect(undone.data.workspace.files.find((file) => file.path === "src/greet.mjs")?.content).toBe(
      source,
    );

    const failedAgain = await runWorkspaceCommand(undone.data.workspace, "test", host);
    expect(failedAgain.ok).toBe(true);
    if (!failedAgain.ok) throw new Error(failedAgain.reason);
    expect(failedAgain.data.observation.exitCode).toBe(1);
    expect(failedAgain.data.workspace.history.map((entry) => [entry.kind, entry.status])).toEqual(
      expect.arrayContaining([
        ["command", "failed"],
        ["patch", "verified"],
        ["command", "verified"],
        ["undo", "verified"],
      ]),
    );
  }, 30_000);
});
