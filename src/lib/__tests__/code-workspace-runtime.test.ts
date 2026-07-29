import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  createCodeWorkspace,
  runWorkspaceCommand,
  type CodeCommandHost,
  type CodeCommandRequest,
  type CodeCommandObservation,
} from "../code/workspace";

const exec = promisify(execFile);

/**
 * Code workspace — RUNTIME evidence against a real repository.
 *
 * Every other workspace test drives a fake host. This one materialises the
 * workspace's files onto a real temporary directory, runs a REAL process
 * against them, and reads the result back off disk.
 *
 * That closes the gap the sandbox tests do not: the sandbox proved isolation,
 * but nothing had proved the workspace → host → observation → receipt chain
 * against actual files and an actual process exit.
 *
 * The property that matters throughout: `observed` is true ONLY when the host
 * genuinely saw the process exit and captured its output. A dispatch is not an
 * observation, and a receipt built on an unobserved run would be a fabricated
 * result — exactly what §2.1 forbids.
 */

let root = "";

const sourceFile = (path: string, content: string) => ({ path, content });

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ocade-workspace-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/**
 * A host that writes the workspace to disk, runs node against it, and reports
 * only what it actually observed.
 */
function realHost(): CodeCommandHost {
  return {
    id: "temp-node-host",
    kind: "temporary",
    async run(request: CodeCommandRequest): Promise<CodeCommandObservation> {
      const startedAt = new Date().toISOString();
      const dir = join(root, request.workspaceId);
      await mkdir(dir, { recursive: true });

      // Materialise every file the workspace believes it has.
      for (const file of request.files) {
        const target = join(dir, file.path);
        await mkdir(join(target, ".."), { recursive: true });
        await writeFile(target, file.content, "utf8");
      }

      try {
        const { stdout, stderr } = await exec(process.execPath, ["main.mjs"], {
          cwd: dir,
          timeout: 30_000,
        });
        return {
          exitCode: 0,
          stdout,
          stderr,
          startedAt,
          finishedAt: new Date().toISOString(),
          observed: true, // the process really exited and was captured
        };
      } catch (error) {
        const e = error as { code?: number; stdout?: string; stderr?: string };
        return {
          exitCode: typeof e.code === "number" ? e.code : 1,
          stdout: e.stdout ?? "",
          stderr: e.stderr ?? "",
          startedAt,
          finishedAt: new Date().toISOString(),
          observed: true, // a non-zero exit is still an observation
        };
      }
    },
  };
}

function workspaceWith(files: Array<{ path: string; content: string }>) {
  const outcome = createCodeWorkspace({
    id: "ws-runtime",
    name: "Runtime workspace",
    files,
  });
  if (!outcome.ok) throw new Error(`workspace rejected: ${outcome.reason}`);
  return outcome.data;
}

describe("the workspace drives a real process against real files", () => {
  it("runs a command and observes a genuine successful exit", async () => {
    const workspace = workspaceWith([
      sourceFile("main.mjs", 'console.log("workspace ran for real");'),
    ]);

    const result = await runWorkspaceCommand(workspace, "test", realHost());

    expect(result.ok, result.ok ? "" : result.reason).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data.observation.observed).toBe(true);
    expect(result.data.observation.exitCode).toBe(0);
    expect(result.data.observation.stdout).toContain("workspace ran for real");
  }, 60_000);

  it("materialises nested files onto disk exactly as the workspace holds them", async () => {
    const workspace = workspaceWith([
      sourceFile("main.mjs", 'import { greet } from "./lib/greet.mjs";\nconsole.log(greet());'),
      sourceFile("lib/greet.mjs", 'export const greet = () => "from a nested module";'),
    ]);

    const result = await runWorkspaceCommand(workspace, "test", realHost());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");

    // The nested import resolved, which is only possible if the file really
    // landed at the right path.
    expect(result.data.observation.stdout).toContain("from a nested module");
    await expect(readFile(join(root, "ws-runtime", "lib", "greet.mjs"), "utf8")).resolves.toContain(
      "greet",
    );
  }, 60_000);

  it("reports a genuine FAILURE as a failure, with the real error text", async () => {
    const workspace = workspaceWith([
      sourceFile("main.mjs", 'throw new Error("the code under test is broken");'),
    ]);

    const result = await runWorkspaceCommand(workspace, "test", realHost());
    expect(result.ok).toBe(true); // the RUN was observed; the code failed
    if (!result.ok) throw new Error("unreachable");

    expect(result.data.observation.exitCode).not.toBe(0);
    expect(result.data.observation.stderr).toContain("the code under test is broken");
    expect(result.data.observation.observed).toBe(true);
  }, 60_000);
});

describe("the receipt reflects what was actually observed", () => {
  it("produces a receipt for an observed run", async () => {
    const workspace = workspaceWith([sourceFile("main.mjs", 'console.log("ok");')]);
    const result = await runWorkspaceCommand(workspace, "test", realHost());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data.receipt).toBeTruthy();
    expect(result.data.receipt.method).toBeTruthy();
    expect(result.data.receipt.at).toBeTruthy();
  }, 60_000);

  it("does NOT mark a receipt verified when the host never observed the exit", async () => {
    // The failure mode that matters: a host that dispatches and returns without
    // watching must not yield a verified result.
    const dishonest: CodeCommandHost = {
      id: "dispatch-only",
      kind: "temporary",
      async run() {
        return {
          exitCode: 0,
          stdout: "looks fine",
          stderr: "",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          observed: false, // dispatched, never watched
        };
      },
    };

    const workspace = workspaceWith([sourceFile("main.mjs", "")]);
    const result = await runWorkspaceCommand(workspace, "test", dishonest);

    if (result.ok) {
      expect(
        result.data.receipt.verified,
        "an unobserved run must never produce a verified receipt",
      ).toBe(false);
    } else {
      // Refusing outright is equally acceptable — and stricter.
      expect(result.reason).toMatch(/observ/i);
    }
  }, 60_000);

  it("refuses to run at all against an unavailable host", async () => {
    const unavailable: CodeCommandHost = {
      id: "none",
      kind: "unavailable",
      unavailableReason: "No sandbox host is connected.",
      run: async () => {
        throw new Error("must not be called");
      },
    };

    const workspace = workspaceWith([sourceFile("main.mjs", "")]);
    const result = await runWorkspaceCommand(workspace, "test", unavailable);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/sandbox host|unavailable/i);
  }, 60_000);
});
