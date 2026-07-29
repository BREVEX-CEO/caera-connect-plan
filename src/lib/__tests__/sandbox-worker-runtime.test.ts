import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Generated-code sandbox worker — REAL RUNTIME EVIDENCE (master plan §7.2).
 *
 * Unlike the rest of this repository's sandbox tests, which exercise the
 * request/receipt CONTRACT against a fake host, this suite spawns the actual
 * worker as a child process and makes it execute real scripts against a real
 * temporary filesystem. The escapes below are attempted for real and observed
 * to fail — this is runtime proof of the isolation boundary, not a source
 * review of it.
 *
 * What it does NOT prove: OS-level process limits (CPU, memory, wall clock) and
 * network denial, which the Node permission model / OS sandbox enforces around
 * this worker rather than inside it.
 */

const WORKER = join("scripts", "ocade-sandbox-worker.mjs");

let root = "";
let inputsRoot = "";
let outputsRoot = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ocade-sandbox-"));
  inputsRoot = join(root, "in");
  outputsRoot = join(root, "out");
  await mkdir(inputsRoot, { recursive: true });
  await mkdir(outputsRoot, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Execute a script in the real worker; never throws, always reports. */
async function runWorker(
  script: string,
  outputPaths: string[] = [],
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const requestFile = join(root, "request.json");
  await writeFile(
    requestFile,
    JSON.stringify({ script, inputsRoot, outputsRoot, outputPaths }),
    "utf8",
  );
  try {
    const { stdout, stderr } = await run(process.execPath, [WORKER, requestFile]);
    return { ok: true, stdout, stderr };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

describe("the sandbox runs legitimate work", () => {
  it("reads a declared input file", async () => {
    await writeFile(join(inputsRoot, "data.txt"), "hello from input", "utf8");
    const r = await runWorker(`sandbox.log(await sandbox.readText("data.txt"));`);
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.stdout).logs).toContain("hello from input");
  });

  it("writes a DECLARED output file to disk", async () => {
    const r = await runWorker(`await sandbox.writeText("result.txt", "written");`, ["result.txt"]);
    expect(r.ok).toBe(true);
    await expect(readFile(join(outputsRoot, "result.txt"), "utf8")).resolves.toBe("written");
  });

  it("creates nested directories for a declared output", async () => {
    const r = await runWorker(`await sandbox.writeText("deep/nested/x.txt", "ok");`, [
      "deep/nested/x.txt",
    ]);
    expect(r.ok).toBe(true);
    expect(existsSync(join(outputsRoot, "deep", "nested", "x.txt"))).toBe(true);
  });

  it("reports a failing script as a failure, never as success", async () => {
    const r = await runWorker(`throw new Error("script blew up");`);
    expect(r.ok).toBe(false);
    expect(r.stderr).toContain("script blew up");
  });

  it("surfaces the real message of a CROSS-REALM error, not a generic one", async () => {
    /**
     * An Error constructed inside the vm belongs to the vm's realm and is NOT
     * `instanceof` the worker's Error. A worker that tests only `instanceof`
     * throws away the message of essentially every script failure and reports
     * "Generated script failed." — leaving the user nothing to act on. This
     * pins the structural read that keeps failures diagnosable.
     */
    const r = await runWorker(`throw new Error("precise cause of failure");`);
    expect(r.stderr).toBe("precise cause of failure");
    expect(r.stderr).not.toContain("Generated script failed");
  });

  it("still reports a generic message when the throw carries none", async () => {
    const r = await runWorker(`throw { weird: true };`);
    expect(r.ok).toBe(false);
    expect(r.stderr).toContain("Generated script failed");
  });

  it("surfaces a thrown string as itself", async () => {
    const r = await runWorker(`throw "plain string failure";`);
    expect(r.ok).toBe(false);
    expect(r.stderr).toBe("plain string failure");
  });
});

describe("undeclared writes are refused at runtime", () => {
  it("refuses an output that was never declared", async () => {
    const r = await runWorker(`await sandbox.writeText("sneaky.txt", "x");`, ["allowed.txt"]);
    expect(r.ok).toBe(false);
    expect(r.stderr).toMatch(/was not declared/i);
    expect(existsSync(join(outputsRoot, "sneaky.txt"))).toBe(false);
  });

  it("refuses a non-text output", async () => {
    const r = await runWorker(`await sandbox.writeText("a.txt", { not: "text" });`, ["a.txt"]);
    expect(r.ok).toBe(false);
    expect(r.stderr).toMatch(/must be text/i);
  });
});

describe("path traversal is blocked — attempted for real", () => {
  const escapes = [
    ["parent traversal", "../escaped.txt"],
    ["deep traversal", "../../../escaped.txt"],
    ["windows backslash traversal", "..\\\\escaped.txt"],
    ["absolute posix path", "/etc/passwd"],
    ["traversal hidden mid-path", "safe/../../escaped.txt"],
  ] as const;

  for (const [label, path] of escapes) {
    it(`refuses a READ via ${label}`, async () => {
      const r = await runWorker(`await sandbox.readText(${JSON.stringify(path)});`);
      expect(r.ok).toBe(false);
      expect(r.stderr).toMatch(/escapes its scope|invalid|ENOENT/i);
    });

    it(`refuses a WRITE via ${label}`, async () => {
      const r = await runWorker(`await sandbox.writeText(${JSON.stringify(path)}, "pwned");`, [
        path,
      ]);
      expect(r.ok).toBe(false);
      // Nothing may be created outside the outputs root.
      expect(existsSync(join(root, "escaped.txt"))).toBe(false);
    });
  }

  it("refuses an empty or whitespace path", async () => {
    expect((await runWorker(`await sandbox.readText("  ");`)).ok).toBe(false);
  });

  it("refuses a path containing a NUL byte", async () => {
    const r = await runWorker(`await sandbox.readText("a\\u0000b");`);
    expect(r.ok).toBe(false);
  });
});

describe("the script cannot reach the host process", () => {
  const forbidden = [
    ["require", `require("node:fs");`],
    ["process", `process.exit(0);`],
    ["globalThis.process", `globalThis.process.env.SECRET;`],
    ["import()", `await import("node:fs");`],
    ["fetch", `await fetch("http://127.0.0.1:1");`],
  ] as const;

  for (const [label, script] of forbidden) {
    it(`has no access to ${label}`, async () => {
      const r = await runWorker(script);
      expect(r.ok).toBe(false);
    });
  }

  it("cannot use eval — dynamic code generation is disabled", async () => {
    const r = await runWorker(`eval("1 + 1");`);
    expect(r.ok).toBe(false);
  });

  it("cannot use the Function constructor", async () => {
    const r = await runWorker(`new Function("return 1")();`);
    expect(r.ok).toBe(false);
  });

  it("cannot mutate the frozen sandbox surface", async () => {
    // "use strict" is injected, so assigning to a frozen object throws.
    const r = await runWorker(`sandbox.readText = () => "hijacked";`);
    expect(r.ok).toBe(false);
  });
});

describe("logging is bounded", () => {
  it("truncates a very long log line", async () => {
    const r = await runWorker(`sandbox.log("x".repeat(50000));`);
    expect(r.ok).toBe(true);
    const [line] = JSON.parse(r.stdout).logs as string[];
    expect(line.length).toBe(10_000);
  });

  it("coerces non-string log values instead of throwing", async () => {
    const r = await runWorker(`sandbox.log(42); sandbox.log(null);`);
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.stdout).logs).toEqual(["42", "null"]);
  });
});

describe("sleep is bounded", () => {
  it("clamps a negative delay to zero and still completes", async () => {
    const r = await runWorker(`await sandbox.sleep(-5); sandbox.log("done");`);
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.stdout).logs).toContain("done");
  });

  it("treats a non-numeric delay as zero", async () => {
    const r = await runWorker(`await sandbox.sleep("abc"); sandbox.log("done");`);
    expect(r.ok).toBe(true);
  });
});
