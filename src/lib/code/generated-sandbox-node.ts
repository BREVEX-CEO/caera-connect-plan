import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GeneratedSandboxHost,
  GeneratedSandboxRequest,
  SandboxFileObservation,
  SandboxHostObservation,
} from "./generated-sandbox";

const workerPath = fileURLToPath(
  new URL("../../../scripts/ocade-sandbox-worker.mjs", import.meta.url),
);

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function directoryBytes(root: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    total += entry.isDirectory() ? await directoryBytes(path) : (await stat(path)).size;
  }
  return total;
}

async function terminate(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolveExit) => {
    const fallback = setTimeout(resolveExit, 2_000);
    child.once("exit", () => {
      clearTimeout(fallback);
      resolveExit();
    });
  });
  child.kill("SIGKILL");
  await exited;
}

export function createNodePermissionSandboxHost(): GeneratedSandboxHost {
  return {
    id: "node-permission-vm",
    kind: "node-permission-vm",
    supportedLanguages: ["javascript"],
    async run(
      request: GeneratedSandboxRequest,
      signal?: AbortSignal,
    ): Promise<SandboxHostObservation> {
      if (request.language !== "javascript") {
        throw new Error("The Node permission host refuses non-JavaScript source.");
      }
      if (request.network !== "disabled") {
        throw new Error("This host always denies network access, including approved requests.");
      }

      const startedAt = new Date().toISOString();
      const root = await mkdtemp(join(tmpdir(), "ocade-generated-"));
      const inputsRoot = join(root, "inputs");
      const outputsRoot = join(root, "outputs");
      const requestPath = join(root, "request.json");
      let child: ReturnType<typeof spawn> | null = null;
      let exitCode = 1;
      let cancelled = false;
      let timedOut = false;
      let limitExceeded: SandboxHostObservation["limitExceeded"];
      let stdout = "";
      let stderr = "";
      let processExitObserved = false;
      let temporaryRootRemoved = false;
      const outputs: SandboxFileObservation[] = [];
      const inputHashesAfter: Array<{ path: string; sha256: string }> = [];

      try {
        await mkdir(inputsRoot, { recursive: true });
        await mkdir(outputsRoot, { recursive: true });
        for (const input of request.inputs) {
          const path = join(inputsRoot, input.path);
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, input.content, "utf8");
        }
        for (const output of request.outputs) {
          if (output.existingContent === undefined) continue;
          const path = join(outputsRoot, output.path);
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, output.existingContent, "utf8");
        }
        await writeFile(
          requestPath,
          JSON.stringify({
            script: request.script,
            inputsRoot,
            outputsRoot,
            outputPaths: request.outputs.map((output) => output.path),
          }),
          "utf8",
        );

        child = spawn(
          process.execPath,
          [
            "--permission",
            `--allow-fs-read=${workerPath}`,
            `--allow-fs-read=${requestPath}`,
            `--allow-fs-read=${inputsRoot}`,
            `--allow-fs-write=${outputsRoot}`,
            `--max-old-space-size=${request.limits.memoryMb}`,
            workerPath,
            requestPath,
          ],
          { cwd: root, env: { PATH: process.env.PATH ?? "" }, stdio: ["ignore", "pipe", "pipe"] },
        );
        const childExit = new Promise<number>((resolveExit, rejectExit) => {
          child!.once("error", rejectExit);
          child!.once("exit", (code) => {
            processExitObserved = true;
            resolveExit(code ?? 137);
          });
        });

        let completed = false;
        const stop = async (
          reason: "cancelled" | "timedOut" | "storage" | "output",
        ): Promise<void> => {
          if (completed || !child) return;
          if (reason === "cancelled") cancelled = true;
          if (reason === "timedOut") timedOut = true;
          if (reason === "storage" || reason === "output") limitExceeded = reason;
          await terminate(child);
        };
        const abort = () => void stop("cancelled");
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) await stop("cancelled");
        const timeout = setTimeout(() => void stop("timedOut"), request.limits.wallTimeMs);
        const monitor = setInterval(() => {
          void directoryBytes(outputsRoot)
            .then((bytes) => {
              if (bytes > request.limits.storageBytes) return stop("storage");
              if (bytes > request.limits.outputBytes) return stop("output");
            })
            .catch(() => undefined);
        }, 20);

        child.stdout!.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
          if (Buffer.byteLength(stdout) > request.limits.outputBytes) void stop("output");
        });
        child.stderr!.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
          if (Buffer.byteLength(stderr) > request.limits.outputBytes) void stop("output");
        });
        exitCode = await childExit;
        completed = true;
        clearTimeout(timeout);
        clearInterval(monitor);
        signal?.removeEventListener("abort", abort);

        for (const input of request.inputs) {
          const content = await readFile(join(inputsRoot, input.path), "utf8");
          inputHashesAfter.push({ path: input.path.replace(/\\/g, "/"), sha256: digest(content) });
        }
        for (const rule of request.outputs) {
          try {
            const content = await readFile(join(outputsRoot, rule.path), "utf8");
            outputs.push({
              path: rule.path.replace(/\\/g, "/"),
              content,
              sha256: digest(content),
              bytes: Buffer.byteLength(content),
              mediaType: rule.mediaType,
            });
          } catch {
            // A declared output is optional until acceptance; absent files are not invented.
          }
        }
      } finally {
        if (child) await terminate(child);
        await rm(root, { recursive: true, force: true });
        temporaryRootRemoved = true;
      }

      return {
        hostId: "node-permission-vm",
        isolation: "node-permission-vm",
        language: "javascript",
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode,
        cancelled,
        timedOut,
        limitExceeded,
        stdout,
        stderr,
        outputs,
        inputHashesAfter,
        networkDenied: true,
        childProcessesDenied: true,
        readScopeEnforced: true,
        writeScopeEnforced: true,
        processExitObserved,
        processTreeTerminated:
          processExitObserved && (child?.exitCode !== null || child?.signalCode !== null),
        temporaryRootRemoved,
      };
    },
  };
}
